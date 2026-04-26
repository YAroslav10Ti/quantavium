const mongoose = require('mongoose');

function getUserModel() {
  try {
    return mongoose.model('User');
  } catch (e) {
    throw new Error('User model not found in mongoose. Проверь имя модели (mongoose.model("User")).');
  }
}

function extractUserId(req) {
  return (
    req.session?.userId ||
    req.session?.user?._id ||
    req.session?.user?.id ||
    req.session?.uid ||
    null
  );
}

async function requireAuth(req, res, next) {
  const userId = extractUserId(req);

  // не авторизован
  if (!userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Необходимо войти в аккаунт' });
    }
    return res.redirect(302, '/');
  }

  try {
    const User = getUserModel();
    const user = await User.findById(userId).lean();
    if (!user) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Пользователь не найден' });
      }
      return res.redirect(302, '/');
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('requireAuth error:', err);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
    return res.status(500).send('Ошибка сервера');
  }
}

function normalizeCourseName(name) {
  return String(name || '').trim().toUpperCase();
}

function requireCourse(courseName) {
  const need = normalizeCourseName(courseName);

  return (req, res, next) => {
    const user = req.user;

    const raw = user?.purchasedCourses || user?.courses || user?.paidCourses || [];
    const owned = Array.isArray(raw) ? raw.map(normalizeCourseName) : [];

    if (!owned.includes(need)) {
      return res.status(403).send('Доступ к курсу не оплачен');
    }

    return next();
  };
}

module.exports = { requireAuth, requireCourse };
