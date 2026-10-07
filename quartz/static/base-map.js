// Renders the Bases map view. bases-map.py puts each map's markers on a
// <div class="base-map-embed" data-map="..."> at build time. Leaflet is loaded
// from this site only when a page has one, so no other page pays for it.
// This is a port of the Publish map (render-leaflet, markers and tile-layers
// in Tenebrous-Obsidian/src/scripts/features/bases/map).
(function () {
  var VENDOR = "/static/vendor/leaflet/";
  var loading = null;

  function css(href) {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    // First in <head>, so the theme's rules win when specificity ties.
    document.head.insertBefore(l, document.head.firstChild);
  }

  function script(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadLeaflet() {
    if (window.L && window.L.markerClusterGroup) return Promise.resolve();
    if (loading) return loading;
    css(VENDOR + "leaflet.css");
    css(VENDOR + "MarkerCluster.css");
    css(VENDOR + "MarkerCluster.Default.css");
    loading = script(VENDOR + "leaflet.js").then(function () {
      return script(VENDOR + "markercluster.js");
    });
    return loading;
  }

  var OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var ESRI = '&copy; <a href="https://www.esri.com/">Esri</a>';
  var STREET = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
  var BASE_LAYERS = {
    Satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: ESRI,
      maxZoom: 19,
    },
    Topographic: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: OSM + ', <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)',
      maxZoom: 17,
    },
  };
  var WORLD = [[-56, -180], [78, 180]];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function markerHtml(m) {
    var color = m.color || "var(--interactive-accent)";
    var icon = m.icon
      ? '<div class="base-map-marker-icon" style="-webkit-mask-image:url(/static/lucide/' + m.icon + ".svg);mask-image:url(/static/lucide/" + m.icon + '.svg)"></div>'
      : "";
    return '<div class="base-map-marker" style="background-color:' + color + '" aria-label="' + esc(m.name) + '">' + icon + "</div>";
  }

  function popup(m) {
    var a = document.createElement("a");
    a.className = "internal";
    a.textContent = m.name;
    a.href = m.url;
    return a;
  }

  function render(el, data) {
    var map = L.map(el, { zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 120 });
    // Fit the world exactly (no snapping), so no empty strip shows at the edges.
    function fitWorld(setMin) {
      map.options.zoomSnap = 0;
      map.fitBounds(WORLD, { animate: false });
      map.options.zoomSnap = 0.25;
      if (setMin) map.setMinZoom(map.getZoom());
    }
    fitWorld(false);
    var street = L.tileLayer(STREET, { attribution: ESRI, maxZoom: 20, noWrap: true });
    var layers = { Street: street };
    Object.keys(BASE_LAYERS).forEach(function (name) {
      var b = BASE_LAYERS[name];
      layers[name] = L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom, noWrap: true });
    });
    street.addTo(map);
    L.control.layers(layers).addTo(map);
    L.control.scale({ imperial: false, metric: true }).addTo(map);

    var clusters = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: function (c) {
        return L.divIcon({
          html: '<div class="base-map-cluster">' + c.getChildCount() + "</div>",
          className: "",
          iconSize: [32, 32],
        });
      },
    });
    data.markers.forEach(function (m) {
      var icon = L.divIcon({ html: markerHtml(m), className: "", iconSize: [26, 26] });
      clusters.addLayer(L.marker([m.lat, m.lng], { icon: icon, title: m.name }).bindPopup(popup(m)));
    });
    map.addLayer(clusters);
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        map.invalidateSize();
        map.options.zoomSnap = 0;
        var fit = map.getBoundsZoom(WORLD);
        map.options.zoomSnap = 0.25;
        if (map.getZoom() <= map.getMinZoom() + 0.01 || map.getZoom() < fit) fitWorld(true);
        else map.setMinZoom(fit);
      }).observe(el);
    }
    map.setMinZoom(map.getZoom());
  }

  function init() {
    var els = document.querySelectorAll(".base-map-embed:not([data-ready])");
    if (!els.length) return;
    loadLeaflet().then(function () {
      els.forEach(function (el) {
        if (el.dataset.ready) return;
        el.dataset.ready = "1";
        try {
          render(el, JSON.parse(el.dataset.map));
        } catch (e) {
          console.error("[base-map]", e);
          el.remove();
        }
      });
    });
  }

  document.addEventListener("nav", init);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
