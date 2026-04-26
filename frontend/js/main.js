/* =========================
   Mentorium / main.js
   - UX: toasts, loading states, disable buttons
   - Auth UI refresh (no reload)
   - Payment modal flow (test purchase via /api/purchase)
   - Cookie consent banner
   - Test mode modal (show once)
   - Fade-in reveal (IntersectionObserver)
   - ✅ Latin-only course URLs: /ege.html, /oge.html
   ========================= */

/* =========================
   1) Toasts
   ========================= */

function ensureToastRoot() {
  let root = document.getElementById('mc-toast-root');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'mc-toast-root';
  root.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: min(420px, calc(100vw - 32px));
    align-items: center;
  `;

  const mount = () => document.body && document.body.appendChild(root);
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  return root;
}

function toast(message, type = 'info', ttl = 3200) {
  const root = ensureToastRoot();

  const el = document.createElement('div');
  const bg = type === 'success' ? '#0f9d58' : type === 'error' ? '#d93025' : '#1a73e8';

  el.style.cssText = `
    background: ${bg};
    color: #fff;
    padding: 12px 14px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,.22);
    font: 14px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    display: flex;
    align-items: start;
    gap: 10px;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity .16s ease, transform .16s ease;
    word-break: break-word;
    width: 100%;
  `;

  const msg = document.createElement('div');
  msg.textContent = String(message || '');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    margin-left: auto;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    opacity: .9;
  `;

  const remove = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => el.remove(), 180);
  };

  closeBtn.addEventListener('click', remove);

  el.appendChild(msg);
  el.appendChild(closeBtn);
  root.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  if (ttl > 0) setTimeout(remove, ttl);
}

/* =========================
   2) Small helpers
   ========================= */

function $(id) {
  return document.getElementById(id);
}

function openModal(id) {
  const el = $(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = $(id);
  if (el) el.style.display = 'none';
}

function setBtnLoading(btn, isLoading, loadingText = 'Подождите…') {
  if (!btn) return;
  if (!btn.dataset.mcOriginalText) btn.dataset.mcOriginalText = btn.innerHTML;

  btn.disabled = !!isLoading;
  btn.style.opacity = isLoading ? '0.75' : '';
  btn.style.pointerEvents = isLoading ? 'none' : '';
  btn.innerHTML = isLoading ? loadingText : btn.dataset.mcOriginalText;
}

function lockWidthForButton(btn) {
  if (!btn || btn.dataset.lockedWidth) return;
  const w = btn.getBoundingClientRect().width;
  if (w > 0) {
    btn.style.minWidth = Math.ceil(w) + 'px';
    btn.dataset.lockedWidth = '1';
  }
}

/* =========================
   3) Course helpers (IMPORTANT)
   ========================= */

function normCourse(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('огэ') || s.includes('oge')) return 'огэ';
  return 'егэ';
}

function courseLabel(course) {
  return course === 'огэ' ? 'ОГЭ' : 'ЕГЭ';
}

/**
 * ✅ ONLY LATIN URLS
 */
function coursePage(course) {
  return course === 'огэ' ? '/oge.html' : '/ege.html';
}

/* =========================
   4) Fade-in reveal
   ========================= */

function initFadeInReveal() {
  const els = Array.from(document.querySelectorAll('.fade-in'));
  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -10% 0px' }
  );

  els.forEach((el) => io.observe(el));
}

/* =========================
   5) API wrappers
   ========================= */

async function getMeSafe() {
  try {
    const me = await ApiClient.get('/auth/me'); // ApiClient добавляет /api
    return me?.user ? me.user : null;
  } catch {
    return null;
  }
}

function userHasCourse(user, course) {
  const list = user?.purchases || user?.courses || [];
  return (list || []).some((x) => {
    if (!x) return false;
    if (typeof x === 'string') return normCourse(x) === course;
    if (typeof x === 'object') return normCourse(x.course || x.slug || x.name) === course;
    return false;
  });
}

function setBuyButtonState(btn, isOwned) {
  if (!btn) return;

  if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;

  if (isOwned) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.dataset.owned = '1';
    btn.innerHTML = `<i class="fas fa-check"></i> Куплено`;
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.dataset.owned = '0';
    btn.innerHTML = btn.dataset.originalText;
  }
}

function setCourseLinksAccess(course, hasAccess) {
  const urlAbs = coursePage(course); // "/oge.html"
  const urlRel = urlAbs.replace(/^\//, ''); // "oge.html"

  const links = Array.from(document.querySelectorAll(`a[href="${urlAbs}"], a[href="${urlRel}"]`));

  links.forEach((a) => {
    if (hasAccess) {
      a.style.pointerEvents = '';
      a.style.opacity = '';
      a.removeAttribute('data-locked');
    } else {
      a.style.pointerEvents = 'none';
      a.style.opacity = '0.6';
      a.setAttribute('data-locked', '1');
    }
  });
}

/* =========================
   6) Courses (prices from server)
   ========================= */

let COURSES_CACHE = null;

async function loadCourses() {
  if (COURSES_CACHE) return COURSES_CACHE;

  try {
    const r = await ApiClient.get('/courses');
    const arr = r?.courses || [];
    COURSES_CACHE = arr.reduce((acc, it) => {
      const c = normCourse(it.course);
      acc[c] = it;
      return acc;
    }, {});
  } catch {
    COURSES_CACHE = {
      'егэ': { course: 'егэ', title: 'ЕГЭ — Математика', priceRub: 1990 },
      'огэ': { course: 'огэ', title: 'ОГЭ — Математика', priceRub: 1490 },
    };
  }

  return COURSES_CACHE;
}

async function getCoursePriceRub(course) {
  const map = await loadCourses();
  return Number(map?.[course]?.priceRub || (course === 'огэ' ? 1490 : 1990));
}

async function getCourseTitle(course) {
  const map = await loadCourses();
  return String(map?.[course]?.title || `${courseLabel(course)} — Математика`);
}

/* =========================
   7) Auth UI refresh
   ========================= */

async function refreshAuthUI() {
  const loginBtn = $('loginBtn');
  const registerBtn = $('registerBtn');
  const profileBtn = $('profileBtn');
  const logoutBtn = $('logoutBtn');

  const user = await getMeSafe();
  const isAuth = !!user;

  if (loginBtn) loginBtn.style.display = isAuth ? 'none' : 'inline-block';
  if (registerBtn) registerBtn.style.display = isAuth ? 'none' : 'inline-block';
  if (profileBtn) profileBtn.style.display = isAuth ? 'inline-block' : 'none';
  if (logoutBtn) logoutBtn.style.display = isAuth ? 'inline-block' : 'none';

  const buyButtons = document.querySelectorAll('.buy-btn');
  buyButtons.forEach((btn) => {
    lockWidthForButton(btn);
    const course = normCourse(btn.getAttribute('data-course') || btn.textContent);
    const owned = isAuth && userHasCourse(user, course);
    setBuyButtonState(btn, owned);
  });

  setCourseLinksAccess('егэ', isAuth && userHasCourse(user, 'егэ'));
  setCourseLinksAccess('огэ', isAuth && userHasCourse(user, 'огэ'));

  return user;
}

/* =========================
   8) Payment modal flow
   ========================= */

const PaymentFlow = (() => {
  let currentCourse = null;

  function showStep(stepId) {
    ['courseSelectionStep', 'paymentStep', 'paymentSuccessStep'].forEach((s) => {
      const node = $(s);
      if (node) node.style.display = s === stepId ? '' : 'none';
    });
  }

  function resetModal() {
    currentCourse = null;

    const coursesList = $('coursesList');
    if (coursesList) coursesList.innerHTML = '';

    const priceBox = $('coursePriceDisplay');
    if (priceBox) priceBox.style.display = 'none';

    const proceed = $('proceedToPayment');
    if (proceed) proceed.disabled = true;

    const order = $('orderSummary');
    if (order) order.innerHTML = '';

    const successMsg = $('successMessage');
    if (successMsg) successMsg.textContent = 'Доступ к курсу открыт.';

    showStep('courseSelectionStep');
  }

  async function renderCourseChoice(course) {
    const coursesList = $('coursesList');
    const proceed = $('proceedToPayment');
    const priceBox = $('coursePriceDisplay');
    const priceSpan = $('selectedCoursePrice');

    if (!coursesList) return;

    const title = await getCourseTitle(course);
    const price = await getCoursePriceRub(course);

    coursesList.innerHTML = `
      <div class="course-option" data-course="${course}"
          style="border:2px solid var(--light-gray); border-radius:10px; padding:14px; cursor:pointer; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <div style="font-weight:800; font-size:1.05rem; color: var(--dark);">${title}</div>
            <div style="color: var(--text-light); font-size:.92rem; margin-top:4px;">
              Пожизненный доступ • Тестовая оплата
            </div>
          </div>
          <div style="font-weight:800; color: var(--primary); white-space:nowrap;">${price} ₽</div>
        </div>
      </div>
    `;

    const opt = coursesList.querySelector('.course-option');
    if (!opt) return;

    opt.addEventListener('click', () => {
      currentCourse = course;
      if (priceBox) priceBox.style.display = '';
      if (priceSpan) priceSpan.textContent = String(price);
      if (proceed) proceed.disabled = false;
    });
  }

  async function openForCourse(course) {
    resetModal();

    const user = await getMeSafe();
    if (!user) {
      openModal('accessDeniedModal');
      return;
    }

    if (userHasCourse(user, course)) {
      await refreshAuthUI();
      toast('Этот курс уже куплен. Повторная покупка недоступна.', 'info');
      return;
    }

    await renderCourseChoice(course);
    openModal('coursePaymentModal');
  }

  async function proceed() {
    if (!currentCourse) return;

    const order = $('orderSummary');
    const title = await getCourseTitle(currentCourse);
    const price = await getCoursePriceRub(currentCourse);

    if (order) {
      order.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <div><b>${title}</b></div>
          <div><b>${price} ₽</b></div>
        </div>
        <div style="color: var(--text-light); font-size:.95rem;">
          Оплата тестовая: деньги не списываются. После подтверждения доступ откроется сразу.
        </div>
      `;
    }

    showStep('paymentStep');
  }

  async function confirm() {
    if (!currentCourse) return;

    const confirmBtn = $('confirmPayment');
    setBtnLoading(confirmBtn, true, '⏳ Обрабатываем…');

    try {
      await ApiClient.post('/purchase', { course: currentCourse });

      const successMsg = $('successMessage');
      if (successMsg) successMsg.textContent = `Доступ к курсу ${courseLabel(currentCourse)} открыт.`;

      showStep('paymentSuccessStep');

      await refreshAuthUI();
      toast('Оплата успешна ✅ Доступ открыт.', 'success');

      const btn =
        document.querySelector(`.buy-btn[data-course="${courseLabel(currentCourse)}"]`) ||
        Array.from(document.querySelectorAll('.buy-btn')).find(
          (b) => normCourse(b.getAttribute('data-course') || b.textContent) === currentCourse
        );
      setBuyButtonState(btn, true);
    } catch (err) {
      toast(err?.message || 'Ошибка оплаты', 'error');
      showStep('courseSelectionStep');
    } finally {
      setBtnLoading(confirmBtn, false, '');
    }
  }

  function wire() {
    const closeBtn = $('closeCoursePaymentModal');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal('coursePaymentModal'));

    const proceedBtn = $('proceedToPayment');
    if (proceedBtn) proceedBtn.addEventListener('click', proceed);

    const backBtn = $('backToCourseStep');
    if (backBtn) backBtn.addEventListener('click', () => showStep('courseSelectionStep'));

    const confirmBtn = $('confirmPayment');
    if (confirmBtn) confirmBtn.addEventListener('click', confirm);

    const goProfile = $('goToProfileBtn');
    if (goProfile) goProfile.addEventListener('click', () => (window.location.href = '/profile.html'));

    const startLearning = $('startLearningBtn');
    if (startLearning) {
      startLearning.addEventListener('click', () => {
        if (!currentCourse) return;
        window.location.href = coursePage(currentCourse);
      });
    }
  }

  return { openForCourse, wire };
})();

/* =========================
   9) Debug badge (?debug=1)
   ========================= */



/* =========================
   10) Cookie consent
   ========================= */

(function cookieConsentInit() {
  const KEY = 'cookie_consent_v1'; // "accepted" | "rejected"

  function getConsent() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  function setConsent(value) {
    try { localStorage.setItem(KEY, value); } catch {}
  }

  function hideBanner() {
    const el = $('cookieBanner');
    if (el) el.style.display = 'none';
  }

  function showBanner() {
    const el = $('cookieBanner');
    if (el) el.style.display = 'block';
  }

  // Заглушки: если потом добавишь аналитику — вот сюда.
  function enableOptionalCookies() {}
  function disableOptionalCookies() {}

  function initUI() {
  const consent = getConsent();

  if (!consent) showBanner();
  else hideBanner();

  if (consent === 'accepted') enableOptionalCookies();
  else disableOptionalCookies();

  // Поддерживаем оба варианта разметки (в index.html сейчас встречаются разные id)
  const acceptBtn = $('cookieAccept') || $('cookieAcceptBtn');
  const rejectBtn = $('cookieReject') || $('cookieDeclineBtn');
  const checkbox = $('cookieConsentCheckbox');

  // Если есть чекбокс согласия — не даём нажать "Принять" пока не отметили
  if (acceptBtn && checkbox) {
    const sync = () => {
      acceptBtn.disabled = !checkbox.checked;
      acceptBtn.style.opacity = checkbox.checked ? '1' : '0.6';
      acceptBtn.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
    };
    sync();
    checkbox.addEventListener('change', sync);
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      if (checkbox && !checkbox.checked) {
        toast('Поставьте галочку согласия с cookie', 'info', 2200);
        return;
      }
      setConsent('accepted');
      enableOptionalCookies();
      hideBanner();
      toast('Cookie приняты', 'success', 1800);
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => {
      setConsent('rejected');
      disableOptionalCookies();
      hideBanner();
      toast('Необязательные cookie отключены', 'info', 2200);
    });
  }
}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
  else initUI();
})();

/* =========================
   11) Test mode modal (show once)
   ========================= */

(function testModeModalInit() {
  const KEY = 'mc_test_mode_ack_v1';

  function show() {
    const m = $('testModeModal');
    if (m) m.style.display = 'flex';
  }

  function hide() {
    const m = $('testModeModal');
    if (m) m.style.display = 'none';
  }

  function getAck() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  function setAck() {
    try { localStorage.setItem(KEY, '1'); } catch {}
  }

  function wire() {
    const btn = $('testModeCloseBtn');
    const modal = $('testModeModal');

    if (btn) {
      btn.addEventListener('click', () => {
        setAck();
        hide();
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          setAck();
          hide();
        }
      });
    }
  }

  function init() {
    wire();
    if (getAck() === '1') return;
    setTimeout(show, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* =========================
   12) Main wiring
   ========================= */

document.addEventListener('DOMContentLoaded', () => {
  initFadeInReveal();

  // Open auth modals
  const loginBtn = $('loginBtn');
  const registerBtn = $('registerBtn');

  if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('loginModal'); });
  if (registerBtn) registerBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('registerModal'); });

  // Close auth modals
  const closeLogin = $('closeLoginModal');
  const closeRegister = $('closeRegisterModal');
  if (closeLogin) closeLogin.addEventListener('click', () => closeModal('loginModal'));
  if (closeRegister) closeRegister.addEventListener('click', () => closeModal('registerModal'));

  // Switch auth modals
  const showRegister = $('showRegister');
  const showLogin = $('showLogin');
  if (showRegister) showRegister.addEventListener('click', (e) => { e.preventDefault(); closeModal('loginModal'); openModal('registerModal'); });
  if (showLogin) showLogin.addEventListener('click', (e) => { e.preventDefault(); closeModal('registerModal'); openModal('loginModal'); });

  // Click outside to close modals
  ['loginModal', 'registerModal', 'coursePaymentModal', 'accessDeniedModal'].forEach((mid) => {
    const m = $(mid);
    if (!m) return;
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(mid); });
  });

  // Login submit
  const loginForm = $('modalLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      const email = $('loginEmail')?.value || '';
      const password = $('loginPassword')?.value || '';

      try {
        setBtnLoading(submitBtn, true, 'Входим…');
        await ApiClient.post('/auth/login', { email, password });
        closeModal('loginModal');
        await refreshAuthUI();
        toast('Вход выполнен ✅', 'success');
      } catch (err) {
        toast(err?.message || 'Ошибка входа', 'error');
      } finally {
        setBtnLoading(submitBtn, false);
      }
    });
  }

// Register submit
const registerForm = $('modalRegisterForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    const name = $('registerName')?.value || '';
    const email = $('registerEmail')?.value || '';
    const password = $('registerPassword')?.value || '';

    try {
      setBtnLoading(submitBtn, true, 'Создаём аккаунт…');

      const payload = { email, password };
      if (String(name).trim()) payload.name = String(name).trim();

      await ApiClient.post('/auth/register', payload);

      closeModal('registerModal');
      await refreshAuthUI();
      toast('Регистрация успешна ✅', 'success');
    } catch (err) {
      toast(err?.message || 'Ошибка регистрации', 'error');
    } finally {
      setBtnLoading(submitBtn, false);
    }
  });
}

  // Logout
  const logoutBtn = $('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        setBtnLoading(logoutBtn, true, 'Выходим…');
        await ApiClient.post('/auth/logout', {});
        await refreshAuthUI();
        toast('Вы вышли из аккаунта', 'success');
      } catch (err) {
        toast(err?.message || 'Ошибка выхода', 'error');
      } finally {
        setBtnLoading(logoutBtn, false);
      }
    });
  }

  // Buy buttons => open payment modal
  const buyButtons = document.querySelectorAll('.buy-btn');
  buyButtons.forEach((btn) => {
    lockWidthForButton(btn);

    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const course = normCourse(btn.getAttribute('data-course') || btn.textContent || '');
      const user = await getMeSafe();

      if (!user) {
        openModal('accessDeniedModal');
        return;
      }

      if (userHasCourse(user, course)) {
        setBuyButtonState(btn, true);
        toast('Этот курс уже куплен.', 'info');
        return;
      }

      await PaymentFlow.openForCourse(course);
    });
  });

  // Buttons in accessDeniedModal
  const goToLoginBtn = $('goToLoginBtn');
  const goToRegisterBtn = $('goToRegisterBtn');
  if (goToLoginBtn) goToLoginBtn.addEventListener('click', () => { closeModal('accessDeniedModal'); openModal('loginModal'); });
  if (goToRegisterBtn) goToRegisterBtn.addEventListener('click', () => { closeModal('accessDeniedModal'); openModal('registerModal'); });

  // Wire payment modal controls
  PaymentFlow.wire();

  // Initial UI refresh
  refreshAuthUI();
});
