// Click to zoom for images in a note (added to pages by passes/lightbox.py). The image
// opens at full size in a dialog, and a click, Escape or the close button puts it away.
(function () {
  var SKIP = "a, .infobox, .bases-card, .base-map-embed, .page-footer, .popover, .site-header, .lightbox";
  var dialog;

  function images() {
    return Array.prototype.filter.call(document.querySelectorAll("article img"), function (img) {
      return !img.closest(SKIP);
    });
  }

  function label(img) {
    var alt = img.getAttribute("alt");
    return (alt && alt.trim() ? alt.trim() : "Image") + ", enlarge";
  }

  function prepare() {
    images().forEach(function (img) {
      if (img.hasAttribute("data-zoom")) return;
      img.setAttribute("data-zoom", "");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", label(img));
    });
  }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    dialog.setAttribute("aria-label", "Enlarged image");
    dialog.innerHTML = '<img alt=""><button type="button" class="lightbox-close" aria-label="Close">&times;</button>';
    dialog.addEventListener("click", function () {
      dialog.close();
    });
    document.body.appendChild(dialog);
  }

  function open(img) {
    if (!dialog || !dialog.isConnected) build();
    var big = dialog.querySelector("img");
    big.src = img.currentSrc || img.src;
    big.alt = img.getAttribute("alt") || "";
    dialog.showModal();
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest && e.target.closest("img[data-zoom]");
    if (img) open(img);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var img = e.target.closest && e.target.closest("img[data-zoom]");
    if (!img) return;
    e.preventDefault();
    open(img);
  });
  document.addEventListener("nav", prepare);
  prepare();
})();
