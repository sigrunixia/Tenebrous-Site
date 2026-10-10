// Search. The index (title, description and the start of each note) is fetched the first time
// search is opened. A word matches when it starts a word in the title or appears in the text.
(function () {
  var index = null;
  var loading = null;
  var dialog;

  var fold = function (s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  };

  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch("/static/search-index.json")
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          index = rows.map(function (r) { return { u: r.u, t: r.t, d: r.d, x: r.x, ft: fold(r.t), fx: fold(r.t + " " + r.d + " " + r.x) }; });
          return index;
        });
    }
    return loading;
  }

  function score(row, words) {
    var s = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (row.fx.indexOf(w) === -1) return 0;
      s += row.ft.indexOf(w) === 0 ? 6 : row.ft.indexOf(w) > -1 ? 4 : 1;
    }
    return s;
  }

  function snippet(row, words) {
    var text = row.d || row.x;
    var at = fold(row.x).indexOf(words[0]);
    if (at > 80) text = "…" + row.x.slice(at - 60, at + 120);
    return text.slice(0, 180);
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  function run(q) {
    var out = dialog.querySelector(".search-results");
    var words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) { out.innerHTML = ""; return; }
    load().then(function (rows) {
      var hits = rows
        .map(function (r) { return { r: r, s: score(r, words) }; })
        .filter(function (h) { return h.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 12);
      out.innerHTML = hits.length
        ? hits.map(function (h) { return '<li><a href="' + h.r.u + '"><strong>' + esc(h.r.t) + "</strong><span>" + esc(snippet(h.r, words)) + "</span></a></li>"; }).join("")
        : '<li class="search-none">Nothing found</li>';
    });
  }

  function open() {
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "search";
      dialog.setAttribute("aria-label", "Search");
      dialog.innerHTML = '<input type="search" class="search-input" placeholder="Search" aria-label="Search the site" autocomplete="off"><ul class="search-results"></ul>';
      dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
      dialog.querySelector("input").addEventListener("input", function (e) { run(e.target.value); });
      dialog.querySelector("input").addEventListener("keydown", function (e) {
        if (e.key === "Enter") { var a = dialog.querySelector(".search-results a"); if (a) a.click(); }
      });
      document.body.appendChild(dialog);
    }
    dialog.showModal();
    dialog.querySelector("input").focus();
    load();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".search-button")) open();
  });
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "")) || e.target.isContentEditable;
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(); }
  });
})();
