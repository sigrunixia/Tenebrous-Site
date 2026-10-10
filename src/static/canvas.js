// Pan and zoom for a canvas page. Drag to move, scroll or pinch to zoom, arrow keys to move, + and - to zoom.
(function () {
  var box = document.querySelector(".canvas-container");
  if (!box) return;
  var world = box.querySelector(".canvas-world");
  var scale = 1, x = 0, y = 0, fit = 1;
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function apply() {
    world.style.transform = "translate(" + x + "px," + y + "px) scale(" + scale + ")";
  }

  function reset() {
    var w = world.offsetWidth, h = world.offsetHeight;
    fit = Math.min(box.clientWidth / w, 1);
    scale = fit;
    x = (box.clientWidth - w * scale) / 2;
    y = 0;
    apply();
  }

  function zoomAt(factor, cx, cy) {
    var next = Math.min(Math.max(scale * factor, Math.min(fit, 0.1)), 5);
    var k = next / scale;
    x = cx - (cx - x) * k;
    y = cy - (cy - y) * k;
    scale = next;
    apply();
  }

  box.addEventListener("wheel", function (e) {
    e.preventDefault();
    var r = box.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });

  var pointers = new Map(), last = null, pinch = 0;
  box.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button, a")) return;
    pointers.set(e.pointerId, e);
    box.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
  });
  box.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) {
      var p = Array.from(pointers.values());
      var d = Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
      if (pinch) {
        var r = box.getBoundingClientRect();
        zoomAt(d / pinch, (p[0].clientX + p[1].clientX) / 2 - r.left, (p[0].clientY + p[1].clientY) / 2 - r.top);
      }
      pinch = d;
    } else if (last) {
      x += e.clientX - last.x;
      y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      apply();
    }
  });
  function up(e) {
    pointers.delete(e.pointerId);
    pinch = 0;
    last = pointers.size === 1 ? { x: Array.from(pointers.values())[0].clientX, y: Array.from(pointers.values())[0].clientY } : null;
  }
  box.addEventListener("pointerup", up);
  box.addEventListener("pointercancel", up);

  box.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var cx = box.clientWidth / 2, cy = box.clientHeight / 2;
    if (b.classList.contains("canvas-zoom-in")) zoomAt(1.3, cx, cy);
    else if (b.classList.contains("canvas-zoom-out")) zoomAt(1 / 1.3, cx, cy);
    else reset();
  });

  box.addEventListener("keydown", function (e) {
    var step = 80;
    if (e.key === "ArrowLeft") x += step;
    else if (e.key === "ArrowRight") x -= step;
    else if (e.key === "ArrowUp") y += step;
    else if (e.key === "ArrowDown") y -= step;
    else if (e.key === "+" || e.key === "=") zoomAt(1.3, box.clientWidth / 2, box.clientHeight / 2);
    else if (e.key === "-") zoomAt(1 / 1.3, box.clientWidth / 2, box.clientHeight / 2);
    else if (e.key === "0") reset();
    else return;
    e.preventDefault();
    apply();
  });

  if (!calm) world.style.transition = "none";
  reset();
  window.addEventListener("resize", reset);
})();
