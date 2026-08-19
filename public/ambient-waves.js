/* Ambient waves — scroll-responsive backdrop driver.
   Classic script, no dependencies. Writes --wave-* custom properties on
   .ambient-waves from window.scrollY via a passive listener throttled with
   requestAnimationFrame. No continuous loop: values change only on
   scroll/resize. With prefers-reduced-motion the listeners are never bound
   and the layers rest at their static CSS defaults. Total travel is
   clamped to <= 104px per axis over the full document. */
(function () {
  "use strict";

  var layers = document.querySelector(".ambient-waves");
  if (!layers) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  var ticking = false;

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function px(value) {
    return value.toFixed(2) + "px";
  }

  function update() {
    ticking = false;
    var doc = document.documentElement;
    var scrollRange = Math.max(1, doc.scrollHeight - window.innerHeight);
    // Normalized scroll progress through the document, clamped to [0, 1].
    var p = clamp(window.scrollY / scrollRange, 0, 1);

    layers.style.setProperty("--wave-y-a", px(-88 * p));
    layers.style.setProperty("--wave-x-b", px(-36 * p));
    layers.style.setProperty("--wave-y-b", px(104 * p));
    layers.style.setProperty("--wave-x-c", px(44 * p));
    layers.style.setProperty("--wave-y-c", px(-52 * p));
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  update();
})();
