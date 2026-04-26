// backend/src/server.js
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const mongoose = require('mongoose');

const cookieParser = require('cookie-parser');
const session = require('express-session');

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const MongoStorePkg = require('connect-mongo');
const MongoStore = MongoStorePkg?.create ? MongoStorePkg : (MongoStorePkg?.default || MongoStorePkg);

const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Payment = require('./models/Payment');

const { requireAuth } = require('./middleware/auth');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = process.env.NODE_ENV === 'production';


// В продакшене SESSION_SECRET должен быть задан явно, иначе сессии будут слетать после рестартов
if (IS_PROD && !process.env.SESSION_SECRET) {
  console.error('❌ SESSION_SECRET is required in production.');
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required. Set it in environment variables (.env)');
  process.exit(1);
}

const frontendDir = path.resolve(__dirname, '../../frontend');
console.log('✅ Frontend dir:', frontendDir);

/* ---------------- helpers ---------------- */

function safeLower(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Нормализуем курс строго в внутренние значения:
 * - 'егэ'
 * - 'огэ'
 */
function normalizeCourse(course) {
  const c = safeLower(course);

  // допускаем любые вариации, но храним внутри только русские 'егэ'/'огэ'
  if (c === 'егэ' || c === 'ege' || c === 'eгэ') return 'егэ';
  if (c === 'огэ' || c === 'oge' || c === 'oгэ') return 'огэ';
  if (c.includes('егэ')) return 'егэ';
  if (c.includes('огэ')) return 'огэ';

  return '';
}

function coursePriceRub(course) {
  return course === 'егэ' ? 1990 : 1490;
}

function userPublic(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    purchases: u.purchases || [],
    createdAt: u.createdAt,
  };
}

async function userHasCourse(userId, course) {
  const user = await User.findById(userId);
  if (!user) return { ok: false, code: 401, user: null };

  const has = (user.purchases || []).some((p) => p.course === course);
  if (!has) return { ok: false, code: 403, user };

  return { ok: true, code: 200, user };
}

async function grantCourseAccessIfSucceeded(payment) {
  if (!payment || payment.status !== 'succeeded') return;

  const user = await User.findById(payment.userId);
  if (!user) return;

  const already = (user.purchases || []).some((p) => p.course === payment.course);
  if (!already) {
    user.purchases.push({ course: payment.course });
    await user.save();
  }
}

/**
 * Маппинг курса -> латинские папки/страницы
 * Важно: URL и имена файлов/папок только латиницей.
 */
function courseFolderName(course) {
  return course === 'егэ' ? 'ege' : 'oge';
}

function coursePageFile(course) {
  return course === 'егэ' ? 'ege.html' : 'oge.html';
}

function coursePublicPath(course) {
  return course === 'егэ' ? '/ege.html' : '/oge.html';
}

/* ---------------- security & middleware (ORDER MATTERS) ---------------- */

if (IS_PROD) {
  app.set('trust proxy', 1);
}

// В PROD нужно явно разрешить домен фронта (иначе cookie-сессии не поедут).
// Формат: FRONTEND_ORIGINS="https://example.ru,https://www.example.ru"
const allowedOrigins = Array.from(
  new Set(
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...(String(process.env.FRONTEND_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)),
    ]
  )
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl/postman
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Минимальная CSRF-защита для cookie-сессий:
// Разрешаем POST/PUT/PATCH/DELETE только если Origin/Referer совпадает с нашим доменом (или localhost в dev).
function csrfBasic(req, res, next) {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  // Разрешаем только для /api/*
  if (!req.path.startsWith('/api/')) return next();

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';

  // В dev можно проще
  if (!IS_PROD) return next();

  // В проде: должен быть origin или referer с этим же host
  const ok =
    (origin && origin.includes(host)) ||
    (referer && referer.includes(host));

  if (!ok) {
    return res.status(403).json({ success: false, message: 'CSRF protection: invalid origin' });
  }

  return next();
}

app.use(csrfBasic);

app.use(
  helmet({
    contentSecurityPolicy: IS_PROD
      ? {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://js.stripe.com"],
            connectSrc: ["'self'", "http://localhost:3000", "http://127.0.0.1:3000", "ws:", "wss:"],
            frameSrc: ["'self'", "https://js.stripe.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// body parsing
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// session
app.use(
  session({
    name: 'mindcraft.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create
      ? MongoStore.create({ mongoUrl: MONGODB_URI })
      : MongoStore({ mongoUrl: MONGODB_URI }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD ? 'auto' : false,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 дней
    },
  })
);

// rate limit для auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// rate limit для покупок/платежей
const payLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ---------------- DB ---------------- */

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((e) => {
    console.error('❌ MongoDB connection error:', e);
    process.exit(1);
  });

/* ---------------- API ---------------- */

// health
app.get('/api/health', (req, res) => res.json({ success: true, ok: true }));

// whoami
app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session?.userId) return res.json({ success: true, user: null });

    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ success: true, user: null });
    }

    return res.json({ success: true, user: userPublic(user) });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// register (только email+пароль; name опционально)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const nameRaw = String(req.body.name || '').trim();
    const email = safeLower(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Введите email и пароль' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Пароль минимум 6 символов' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: 'Email уже зарегистрирован' });

    const name = nameRaw || String(email).split('@')[0] || 'Пользователь';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    req.session.userId = String(user._id);
    return res.json({ success: true, user: userPublic(user) });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = safeLower(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Введите email и пароль' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Неверный email или пароль' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: 'Неверный email или пароль' });

    req.session.userId = String(user._id);
    return res.json({ success: true, user: userPublic(user) });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// logout
app.post('/api/auth/logout', (req, res) => {
  if (!req.session) return res.json({ success: true });

  req.session.destroy(() => {
    res.clearCookie('mindcraft.sid');
    res.json({ success: true });
  });
});

// courses
app.get('/api/courses', (req, res) => {
  return res.json({
    success: true,
    courses: [
      { course: 'егэ', title: 'ЕГЭ — Математика', priceRub: 1990 },
      { course: 'огэ', title: 'ОГЭ — Математика', priceRub: 1490 },
    ],
  });
});

/* ---------------- COMPAT: старый эндпоинт для фронта (/api/purchase) ---------------- */
app.post('/api/purchase', payLimiter, requireAuth, async (req, res) => {
  try {
    const course = normalizeCourse(req.body.course);
    if (!course) return res.status(400).json({ success: false, message: 'Неизвестный курс' });

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ success: false, message: 'Не авторизован' });

    const alreadyBought = (user.purchases || []).some((p) => p.course === course);
    if (alreadyBought) return res.status(409).json({ success: false, message: 'Курс уже куплен' });

    const amountRub = coursePriceRub(course);

    const payment = await Payment.create({
      userId: user._id,
      course,
      amountRub,
      status: 'created',
      provider: 'test',
    });

    // ТЕСТОВЫЙ режим оплаты управляется env: PAYMENT_TEST_MODE=true/false
    const TEST_PAYMENTS = String(process.env.PAYMENT_TEST_MODE || 'true') === 'true';

    if (TEST_PAYMENTS) {
      payment.status = 'succeeded';
      await payment.save();

      await grantCourseAccessIfSucceeded(payment);

      const freshUser = await User.findById(req.session.userId);

      return res.json({
        success: true,
        message: 'Тестовая оплата успешна. Средства не списываются. Доступ открыт.',
        payment: { id: payment._id, status: payment.status, amountRub: payment.amountRub, course: payment.course },
        user: userPublic(freshUser),
        testMode: true,
      });
    }

    // Если тестовый режим выключен — пока просто создаём платёж и говорим, что реальная оплата не подключена
    payment.status = 'created';
    await payment.save();

    return res.status(501).json({
      success: false,
      message: 'Реальная оплата ещё не подключена. Сейчас доступ выдаётся только в тестовом режиме.',
      testMode: false,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

/* ---------------- Protected materials API ---------------- */
app.get(/^\/api\/materials\/(.+?)\/(.+)$/, requireAuth, async (req, res) => {
  try {
    const courseRaw = req.params[0];
    const rel = req.params[1] || '';
    const course = normalizeCourse(courseRaw);

    if (!course) return res.status(404).send('Not found');
    if (rel.includes('..')) return res.status(400).send('Bad request');

    const chk = await userHasCourse(req.session.userId, course);
    if (!chk.ok) return res.status(chk.code).send(chk.code === 403 ? 'Forbidden' : 'Not authorized');

    const folderName = courseFolderName(course);
    const base = path.join(frontendDir, folderName);
    const absPath = path.join(base, rel);

    if (!absPath.startsWith(base)) return res.status(400).send('Bad request');
    if (!fs.existsSync(absPath)) return res.status(404).send('Not found');

    return res.sendFile(absPath);
  } catch (e) {
    return res.status(500).send('Server error');
  }
});

/* ---------------- STATIC FRONTEND (PUBLIC) ---------------- */

app.use('/js', express.static(path.join(frontendDir, 'js')));
app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/images', express.static(path.join(frontendDir, 'images')));
app.use('/legal', express.static(path.join(frontendDir, 'legal')));

// публичные страницы
app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

app.get('/profile', (req, res) => res.sendFile(path.join(frontendDir, 'profile.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(frontendDir, 'profile.html')));

/* ---------------- Redirect old Cyrillic URLs -> Latin ---------------- */
app.get(['/ЕГЭ.html', '/%D0%95%D0%93%D0%AD.html'], (req, res) => res.redirect(301, '/ege.html'));
app.get(['/ОГЭ.html', '/%D0%9E%D0%93%D0%AD.html'], (req, res) => res.redirect(301, '/oge.html'));

/* ---------------- Protected course pages (Latin URLs only) ---------------- */

app.get('/ege.html', requireAuth, async (req, res) => {
  const chk = await userHasCourse(req.session.userId, 'егэ');
  if (!chk.ok) return res.status(chk.code).send(chk.code === 403 ? 'Forbidden' : 'Not authorized');
  return res.sendFile(path.join(frontendDir, 'ege.html'));
});

app.get('/oge.html', requireAuth, async (req, res) => {
  const chk = await userHasCourse(req.session.userId, 'огэ');
  if (!chk.ok) return res.status(chk.code).send(chk.code === 403 ? 'Forbidden' : 'Not authorized');
  return res.sendFile(path.join(frontendDir, 'oge.html'));
});

app.get(/^\/ege\/(.+)$/, requireAuth, async (req, res) => {
  const chk = await userHasCourse(req.session.userId, 'егэ');
  if (!chk.ok) return res.status(chk.code).send(chk.code === 403 ? 'Forbidden' : 'Not authorized');

  const rel = req.params[0];
  if (String(rel).includes('..')) return res.status(400).send('Bad request');

  const base = path.join(frontendDir, 'ege');
  const absPath = path.join(base, rel);
  if (!absPath.startsWith(base)) return res.status(400).send('Bad request');

  return res.sendFile(absPath);
});

app.get(/^\/oge\/(.+)$/, requireAuth, async (req, res) => {
  const chk = await userHasCourse(req.session.userId, 'огэ');
  if (!chk.ok) return res.status(chk.code).send(chk.code === 403 ? 'Forbidden' : 'Not authorized');

  const rel = req.params[0];
  if (String(rel).includes('..')) return res.status(400).send('Bad request');

  const base = path.join(frontendDir, 'oge');
  const absPath = path.join(base, rel);
  if (!absPath.startsWith(base)) return res.status(400).send('Bad request');

  return res.sendFile(absPath);
});

/* ---------------- Error handler (в конце) ---------------- */
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Ошибка сервера' });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(`✅ Server running: http://localhost:${PORT}`);
});