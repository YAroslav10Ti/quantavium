(async function () {
  function getCourseFromScriptTag() {
    // Берём data-course у текущего тега <script src="/js/coursePage.js" data-course="...">
    const scripts = document.querySelectorAll('script[src*="/js/coursePage.js"]');
    const last = scripts[scripts.length - 1];
    return (last?.dataset?.course || "").toLowerCase();
  }

  function renderNoAuth(courseContent) {
    courseContent.innerHTML = `
      <div class="error-message">
        <h3>🔒 Нужно войти в аккаунт</h3>
        <p>Авторизуйтесь на главной странице.</p>
        <button id="goHomeBtn" class="primary-btn">Перейти на главную</button>
      </div>
    `;
    document.getElementById("goHomeBtn")?.addEventListener("click", () => {
      window.location.href = "/index.html";
    });
  }

  function renderNoAccess(courseContent, title) {
    courseContent.innerHTML = `
      <div class="error-message">
        <h3>❌ Доступ к курсу закрыт</h3>
        <p>У вас нет активного доступа к курсу <b>${title}</b>.</p>
        <p>Перейдите на главную и оформите тестовую покупку.</p>
        <button id="goBuyBtn" class="primary-btn">Перейти к покупке</button>
      </div>
    `;
    document.getElementById("goBuyBtn")?.addEventListener("click", () => {
      window.location.href = "/index.html#courses";
    });
  }

  function renderCourse(courseContent, course) {
    // Ссылки на материалы через защищённый API:
    // /api/materials/ЕГЭ/... и /api/materials/ОГЭ/...
    if (course === "егэ") {
      courseContent.innerHTML = `
        <div class="course-content">
          <h2>Добро пожаловать на курс ЕГЭ по математике!</h2>
          <p>Материалы доступны только после тестовой покупки.</p>

          <div class="materials-section">
            <h3>📚 Учебные материалы</h3>
            <div class="material-item">
              <a href="/api/materials/ЕГЭ/Задание1.txt" target="_blank" rel="noopener">
                📄 Задание 1 — (txt)
              </a>
            </div>
            <div class="muted" style="margin-top:10px;">
              Остальные материалы можно добавить позже — ссылки появятся автоматически.
            </div>
          </div>
        </div>
      `;
      return;
    }

    // ОГЭ
    courseContent.innerHTML = `
      <div class="course-content">
        <h2>Добро пожаловать на курс ОГЭ по математике!</h2>
        <p>Материалы доступны только после тестовой покупки.</p>

        <div class="materials-section">
          <h3>📚 Учебные материалы</h3>
          <div class="material-item"><a href="/api/materials/ОГЭ/20.1.pdf" target="_blank" rel="noopener">📄 20.1 (pdf)</a></div>
          <div class="material-item"><a href="/api/materials/ОГЭ/20.2.pdf" target="_blank" rel="noopener">📄 20.2 (pdf)</a></div>
          <div class="material-item"><a href="/api/materials/ОГЭ/20.3.pdf" target="_blank" rel="noopener">📄 20.3 (pdf)</a></div>
          <div class="material-item"><a href="/api/materials/ОГЭ/20.4.pdf" target="_blank" rel="noopener">📄 20.4 (pdf)</a></div>
          <div class="material-item"><a href="/api/materials/ОГЭ/Задание5.txt" target="_blank" rel="noopener">📄 Задание 5 (txt)</a></div>
        </div>
      </div>
    `;
  }

  async function init() {
    const course = getCourseFromScriptTag(); // "егэ" или "огэ"
    const courseContent = document.getElementById("courseContent");
    if (!courseContent) return;

    const title = course === "егэ" ? "ЕГЭ — Математика" : "ОГЭ — Математика";

    try {
      const me = await ApiClient.get("/auth/me");
      if (!me?.success || !me.user) {
        renderNoAuth(courseContent);
        return;
      }

      // синхронизация (если нужно)
      localStorage.setItem("currentUser", JSON.stringify(me.user));

      const has = await CourseAccess.checkAccess(course);
      if (!has) {
        renderNoAccess(courseContent, title);
        return;
      }

      renderCourse(courseContent, course);
    } catch (e) {
      courseContent.innerHTML = `<div class="error-message"><h3>Ошибка</h3><p>Не удалось загрузить страницу курса.</p></div>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();