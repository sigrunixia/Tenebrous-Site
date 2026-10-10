// Link previews. Hovering (or focusing) a link to another page on the site shows the start of that page
// beside the link. The preview does not scroll; clicking it opens the page. Pages are fetched once and kept.
// Touch screens do not get previews, and Escape closes one.
(function () {
  if (!window.matchMedia("(hover: hover)").matches) return;
  var cache = new Map();
  var box = null, timer = 0, hideTimer = 0, current = null;

  function target(el) {
    var a = el.closest && el.closest("article a[href]");
    if (!a || a.closest(".infobox, .toc, .bases-group-heading, .breadcrumb")) return null;
    var href = a.getAttribute("href");
    if (!/^\/(?!\/)/.test(href) || a.target === "_blank") return null;
    var url = new URL(href, location.href);
    if (url.pathname === location.pathname && url.hash) return null;
    if (/\.(png|jpe?g|webp|svg|xml|json)$/i.test(url.pathname)) return null;
    return { a: a, url: url };
  }

  function fetchPage(url) {
    var key = url.pathname;
    if (!cache.has(key)) {
      cache.set(key, fetch(key)
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (text) {
          if (!text) return null;
          var doc = new DOMParser().parseFromString(text, "text/html");
          var art = doc.querySelector("article");
          if (!art) return null;
          art.querySelectorAll(".infobox, .breadcrumb, script, style").forEach(function (n) { n.remove(); });
          return art.innerHTML;
        })
        .catch(function () { return null; }));
    }
    return cache.get(key);
  }

  function place(a) {
    var r = a.getBoundingClientRect();
    var w = Math.min(box.offsetWidth, innerWidth - 16);
    var left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    var below = innerHeight - r.bottom > box.offsetHeight + 12 || r.top < box.offsetHeight + 12;
    box.style.left = left + scrollX + "px";
    box.style.top = (below ? r.bottom + 6 : r.top - box.offsetHeight - 6) + scrollY + "px";
  }

  function show(t) {
    fetchPage(t.url).then(function (html) {
      if (!html || current !== t.a) return;
      hide(true);
      box = document.createElement("div");
      box.className = "popover";
      box.innerHTML = '<div class="popover-inner markdown-reading-view">' + html + "</div>";
      box.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
      box.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        location.assign(t.url.href);
      });
      box.addEventListener("mouseleave", function () { schedule(); });
      document.body.appendChild(box);
      if (t.url.hash) {
        var el = box.querySelector(CSS.escape ? "#" + CSS.escape(decodeURIComponent(t.url.hash.slice(1))) : null);
        if (el) box.querySelector(".popover-inner").scrollTop = el.offsetTop - 8;
      }
      place(t.a);
      requestAnimationFrame(function () { if (box) box.classList.add("visible"); });
    });
  }

  function hide(now) {
    clearTimeout(timer);
    if (box) { box.remove(); box = null; }
    if (now) clearTimeout(hideTimer);
  }

  function schedule() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { current = null; hide(true); }, 180);
  }

  function enter(e) {
    var t = target(e.target);
    if (!t) return;
    clearTimeout(hideTimer);
    if (current === t.a && box) return;
    current = t.a;
    clearTimeout(timer);
    timer = setTimeout(function () { show(t); }, 200);
  }

  function leave(e) {
    var t = target(e.target);
    if (!t) return;
    clearTimeout(timer);
    schedule();
  }

  document.addEventListener("mouseover", enter);
  document.addEventListener("mouseout", leave);
  document.addEventListener("focusin", enter);
  document.addEventListener("focusout", leave);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { current = null; hide(true); } });
  window.addEventListener("scroll", function () { if (box && current) place(current); }, { passive: true });
})();
