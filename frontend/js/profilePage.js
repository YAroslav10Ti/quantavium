(async function () {
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const ch of children) node.appendChild(ch);
    return node;
  }

  async function loadProfile() {
    const meBlock = document.getElementById("meBlock");
    const coursesBlock = document.getElementById("coursesBlock");

    try {
      const me = await ApiClient.get("/auth/me");

      // Не авторизован
      if (!me?.user) {
        meBlock.innerHTML = "";
        meBlock.appendChild(
          el("div", {}, [
            document.createTextNode("Вы не авторизованы. "),
            el("a", { class: "link", href: "/index.html" }, [document.createTextNode("Перейти на главную")]),
          ])
        );
        coursesBlock.textContent = "Нет данных";
        return;
      }

      const user = me.user;

      // Заголовок профиля (без лишних персональных данных)
      meBlock.innerHTML = "";
      meBlock.appendChild(
        el("div", {}, [
          el("b", { text: user.name || "Пользователь" }),
          document.createTextNode(" — "),
          el("span", { text: user.email || "" }),
        ])
      );

      const purchases = Array.isArray(user.purchases) ? user.purchases : [];

      if (!purchases.length) {
        coursesBlock.innerHTML = "";
        coursesBlock.appendChild(
          el("div", {}, [
            document.createTextNode("Пока нет купленных курсов. "),
            el("a", { class: "link", href: "/index.html#courses" }, [document.createTextNode("Купить курс")]),
          ])
        );
        return;
      }

      const map = {
        егэ: { title: "ЕГЭ — Математика", link: "/ege.html" },
        огэ: { title: "ОГЭ — Математика", link: "/oge.html" },
      };

      coursesBlock.innerHTML = "";
      const ul = el("ul");
      for (const p of purchases) {
        const c = String(p.course || "").toLowerCase();
        const item = map[c] || { title: c || "Курс", link: "#" };
        const a = el("a", { class: "link", href: item.link, text: item.title });
        ul.appendChild(el("li", {}, [a]));
      }
      coursesBlock.appendChild(ul);
    } catch (e) {
      meBlock.textContent = "Ошибка загрузки профиля";
      coursesBlock.textContent = "";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadProfile);
  } else {
    loadProfile();
  }
})();