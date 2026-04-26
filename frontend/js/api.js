// frontend/js/api.js
(function () {
  // Базовый URL берём из config.js (на одном домене оставляем пустым).
  // Если фронт открыли через file:// или Live Server — можно задать baseURL в config.js.
  const cfgBase = (window.APP_CONFIG && typeof window.APP_CONFIG.baseURL === 'string') ? window.APP_CONFIG.baseURL : '';

  // Fallback для локальной разработки, если baseURL не задан
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  const looksLikeLocal = isHttp && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  const BASE = cfgBase || (looksLikeLocal && location.port === '3000' ? '' : (looksLikeLocal ? 'http://localhost:3000' : ''));

  async function request(method, path, data) {
    const url = BASE + "/api" + path;

    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include", // обязательно для cookie-сессий
    };

    if (data !== undefined) {
      opts.body = JSON.stringify(data);
    }

    const res = await fetch(url, opts);

    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok) {
      const msg = payload?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  window.ApiClient = {
    get: (path) => request("GET", path),
    post: (path, data) => request("POST", path, data),
  };
})();