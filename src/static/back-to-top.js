// The back-to-top button (added to every page by page-nav.py). It appears after the
// reader has scrolled a screen or so, and goes back to the top, without animation
// for anyone who has asked for reduced motion.
(function () {
  function button() {
    return document.querySelector(".back-to-top");
  }
  function update() {
    var b = button();
    if (!b) return;
    b.hidden = window.scrollY < 600;
  }
  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("nav", update);
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".back-to-top")) return;
    var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
    var main = document.getElementById("main-content");
    if (main) main.focus({ preventScroll: true });
  });
  update();
})();
