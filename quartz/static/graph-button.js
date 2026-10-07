// The graph button beside the search bar opens the graph overlay that Quartz
// builds inside the page (the old sidebar panel is hidden).
document.addEventListener("click", function (e) {
  if (e.target.closest(".graph-close")) {
    var open = document.querySelector(".global-graph-outer");
    if (open) open.classList.remove("active");
    return;
  }
  if (!e.target.closest(".graph-open")) return;
  // After this click has finished bubbling, or Quartz's click-outside handler
  // closes the overlay again straight away.
  setTimeout(function () {
    var icon = document.querySelector(".global-graph-icon");
    if (icon) icon.click();
  }, 0);
});
