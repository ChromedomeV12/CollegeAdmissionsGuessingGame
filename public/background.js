/* Admissions Oracle — ambient constellation.
   A sparse field of dim "applicant" stars (Tokyo Night blue, a few
   magenta admits) rotating slowly behind the app on #ao-bg.

   Graceful by default:
   - no canvas, no THREE (CDN blocked), or WebGL failure -> canvas hides,
     the app is untouched;
   - prefers-reduced-motion -> a single static frame, no animation loop;
   - theme changes are picked up via a MutationObserver on data-theme;
   - resize keeps the camera honest; pagehide/unload disposes everything. */
(function () {
  "use strict";

  var canvas = document.getElementById("ao-bg");
  if (!canvas) return;

  if (typeof window.THREE === "undefined") {
    canvas.style.display = "none";
    return;
  }

  var PALETTES = {
    dark: { star: "#7aa2f7", admit: "#bb9af7", opacity: 0.55 },
    light: { star: "#2e7de9", admit: "#9854f1", opacity: 0.38 }
  };

  var STAR_COUNT = 250;
  var ADMIT_EVERY = 12; // one sparse magenta admit per dozen applicants

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (err) {
    canvas.style.display = "none";
    return;
  }
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  camera.position.z = 70;

  var group = new THREE.Group();
  scene.add(group);

  var positions = new Float32Array(STAR_COUNT * 3);
  var colors = new Float32Array(STAR_COUNT * 3);
  var i;
  for (i = 0; i < STAR_COUNT; i++) {
    // loose disc with a slight vertical spread, pushed just behind center
    var radius = 14 + Math.random() * 46;
    var theta = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 56;
    positions[i * 3 + 2] = Math.sin(theta) * radius - 10;
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  var material = new THREE.PointsMaterial({
    size: 0.9,
    transparent: true,
    opacity: PALETTES.dark.opacity,
    vertexColors: true,
    depthWrite: false,
    sizeAttenuation: true
  });

  group.add(new THREE.Points(geometry, material));

  var tmpStar = new THREE.Color();
  var tmpAdmit = new THREE.Color();

  function currentPalette() {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? PALETTES.light
      : PALETTES.dark;
  }

  function renderFrame() {
    renderer.render(scene, camera);
  }

  function applyTheme() {
    var palette = currentPalette();
    tmpStar.set(palette.star);
    tmpAdmit.set(palette.admit);
    for (var i = 0; i < STAR_COUNT; i++) {
      var c = i % ADMIT_EVERY === 0 ? tmpAdmit : tmpStar;
      // slight per-star dimming keeps the field matte, not glossy
      var fade = 0.55 + Math.random() * 0.45;
      colors[i * 3] = c.r * fade;
      colors[i * 3 + 1] = c.g * fade;
      colors[i * 3 + 2] = c.b * fade;
    }
    geometry.attributes.color.needsUpdate = true;
    material.opacity = palette.opacity;
    renderFrame(); // keeps the static reduced-motion frame in sync
  }

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderFrame();
  }

  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var rafId = 0;
  function tick() {
    group.rotation.y += 0.0007;
    group.rotation.x = Math.sin(group.rotation.y * 0.6) * 0.05;
    renderFrame();
    rafId = window.requestAnimationFrame(tick);
  }

  var observer = null;
  if (typeof window.MutationObserver === "function") {
    observer = new MutationObserver(function (mutations) {
      for (var j = 0; j < mutations.length; j++) {
        if (mutations[j].attributeName === "data-theme") applyTheme();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
  }

  window.addEventListener("resize", resize);

  resize();
  applyTheme();
  if (!reduceMotion) rafId = window.requestAnimationFrame(tick);

  function cleanup() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    window.removeEventListener("resize", resize);
    if (observer) observer.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }
  window.addEventListener("pagehide", cleanup);
  window.addEventListener("unload", cleanup);
})();
