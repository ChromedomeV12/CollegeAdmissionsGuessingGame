/* Ambient waves — hybrid contour backdrop driver. Classic script.
   The SVG layer is the RELIABLE PRIMARY wave design in both modes:
   .aw-contours draws five crisp parallel Bezier contour lines (the
   recognizable topographic wave shape, never dimmed, never blurred)
   over one narrow soft ribbon (.aw-c) and two broad blurred edge
   ribbons (.aw-a/.aw-b).
   Enhancement path: when window.THREE (classic CDN build) and WebGL are
   available, renders broad antialiased sine bands onto
   #ambient-wave-canvas with an orthographic fullscreen ShaderMaterial as
   a subtle supplementary sheen — the contour group keeps identical
   opacity and the ribbons are never dimmed below their
   .has-wave-webgl floor. .has-wave-webgl and data-wave-rendered="true"
   are applied only after the first successful on-screen render, so a
   dead shader/context can never erase the SVG layer.
   Fallback path: the SVG ribbons stay fully visible and keep drifting via
   --wave-* custom properties. Scroll writes a target progress; a short
   eased rAF settle (<= ~220ms) runs only after scroll/resize and STOPS —
   there is no permanent animation loop, no particles, no rotation.
   Rendering happens on demand only: init, scroll settle, resize, theme
   change. DPR is capped at 1.5, the drawing buffer is preserved for
   diagnosability, and GL resources are disposed on pagehide.
   With prefers-reduced-motion no listeners are bound: exactly one static
   frame is drawn and the SVGs rest at their static CSS defaults. */
(function () {
  "use strict";

  var container = document.querySelector(".ambient-waves");
  if (!container) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function px(value) {
    return value.toFixed(2) + "px";
  }

  /* Normalized scroll progress through the document, clamped to [0, 1]. */
  function scrollProgress() {
    var doc = document.documentElement;
    var range = Math.max(1, doc.scrollHeight - window.innerHeight);
    return clamp(window.scrollY / range, 0, 1);
  }

  /* ------------------------------------------------------------------ *
   *  Fallback driver — CSS custom-property drift for the SVG ribbons.  *
   *  Runs whether or not WebGL succeeds (the ribbons stay as a faint   *
   *  supporting wash under the canvas). Travel clamped to <= 72px.     *
   * ------------------------------------------------------------------ */
  function updateFallback(p) {
    container.style.setProperty("--wave-y-a", px(-64 * p));
    container.style.setProperty("--wave-x-b", px(-30 * p));
    container.style.setProperty("--wave-y-b", px(72 * p));
    container.style.setProperty("--wave-x-c", px(36 * p));
    container.style.setProperty("--wave-y-c", px(-48 * p));
    /* Contour group parallax: 28px right / 56px up at full scroll —
       total travel ~62.6px, inside the <= 72px budget. */
    container.style.setProperty("--wave-x-ct", px(28 * p));
    container.style.setProperty("--wave-y-ct", px(-56 * p));
  }

  /* ------------------------------------------------------------------ *
   *  WebGL enhancement. Any failure along the way leaves the SVG       *
   *  fallback at full strength and quietly aborts.                     *
   * ------------------------------------------------------------------ */
  var THREE = window.THREE;
  var canvas = document.getElementById("ambient-wave-canvas");
  var gl = null; // { renderer, scene, camera, uniforms, geometry, material }

  /* Exact Tokyo anchors only — identical to the styles-v2.css tokens. */
  var PALETTES = {
    night: {
      a1: "#7aa2f7", a2: "#bb9af7", /* band A: blue -> magenta   */
      b1: "#7dcfff", b2: "#7aa2f7", /* band B: cyan -> blue      */
      c1: "#bb9af7", c2: "#7dcfff", /* band C: magenta -> cyan   */
      alpha: [0.16, 0.14, 0.10]     /* effective band peaks, 0.10-0.18 */
    },
    day: {
      a1: "#2e7de9", a2: "#9854f1",
      b1: "#00719c", b2: "#2e7de9",
      c1: "#9854f1", c2: "#00719c",
      alpha: [0.12, 0.105, 0.08]    /* effective band peaks, 0.07-0.13 */
    }
  };

  /* Scroll-driven motion budget: vertical lift <= 54px plus sine phase
     drift <= ~26px keeps total apparent travel <= 90px at any viewport. */
  var LIFT_MAX_PX = 54;
  var PHASE_MAX = 0.9;
  var SETTLE_EASE = 0.38;   /* per-frame lerp; settles in ~150-220ms */
  var SETTLE_EPSILON = 0.002;
  var DPR_CAP = 1.5;

  var VERT = [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = vec4(position.xy, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* Bands live in CSS-pixel space. Each centerline is a sine with a
     quadratic bend (a Bezier-like sweep); band intensity is a smoothstep
     distance field around the centerline, which is what antialiases the
     edges. Longitudinal smoothstep fades taper the band ends so nothing
     hits a viewport edge. Color is the weight-normalized mix of the
     per-band gradients; alpha is the clamped weight sum, so peak alpha
     per band equals its uAlpha entry. */
  var FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform vec2 uRes;",
    "uniform float uPhase;",
    "uniform float uLift;",
    "uniform vec3 uColA1; uniform vec3 uColA2;",
    "uniform vec3 uColB1; uniform vec3 uColB2;",
    "uniform vec3 uColC1; uniform vec3 uColC2;",
    "uniform vec3 uAlpha;",
    "",
    "float band(float xn, float y, float freq, float phase, float center,",
    "           float amp, float width, float feather, float bend) {",
    "  float cy = center + amp * sin(xn * freq + phase) + bend * xn * xn;",
    "  float d = abs(y - cy);",
    "  return 1.0 - smoothstep(width - feather, width + feather, d);",
    "}",
    "",
    "void main() {",
    "  float H = uRes.y;",
    "  float xn = vUv.x;",
    "  float y = vUv.y * H;",
    "",
    "  float endA = smoothstep(0.00, 0.16, xn) * (1.0 - smoothstep(0.88, 1.00, xn));",
    "  float endB = smoothstep(0.04, 0.20, xn) * (1.0 - smoothstep(0.84, 1.00, xn));",
    "  float endC = smoothstep(0.00, 0.22, xn) * (1.0 - smoothstep(0.78, 1.00, xn));",
    "",
    /* A — broad silk across the upper-left, pulled down-center on the right. */
    "  float wA = band(xn, y, 4.2, uPhase,",
    "                  H * 0.80 + uLift, 30.0, H * 0.085, H * 0.100, -0.22 * H) * endA;",
    /* B — lower-right counter-sweep, drifting the other way. */
    "  float wB = band(xn, y, 3.4, -uPhase * 0.8 + 1.3,",
    "                  H * 0.16 + uLift * 0.8, 26.0, H * 0.080, H * 0.095, 0.20 * H) * endB;",
    /* C — broad central diagonal wash, upper-left to lower-right. */
    "  float wC = band(xn, y, 2.6, uPhase * 0.6 + 2.6,",
    "                  H * 0.50 + uLift * 0.5 + (xn - 0.5) * -0.28 * H,",
    "                  22.0, H * 0.120, H * 0.160, 0.0) * endC;",
    "",
    "  float tA = smoothstep(0.05, 0.85, xn);",
    "  float tB = smoothstep(0.90, 0.15, xn);",
    "  float tC = smoothstep(0.10, 0.90, xn);",
    "  vec3 cA = mix(uColA1, uColA2, tA);",
    "  vec3 cB = mix(uColB1, uColB2, tB);",
    "  vec3 cC = mix(uColC1, uColC2, tC);",
    "",
    "  float aA = wA * uAlpha.x;",
    "  float aB = wB * uAlpha.y;",
    "  float aC = wC * uAlpha.z;",
    "  float sum = aA + aB + aC;",
    "  vec3 col = (cA * aA + cB * aB + cC * aC) / max(sum, 1e-5);",
    "  gl_FragColor = vec4(col, clamp(sum, 0.0, 1.0));",
    "}"
  ].join("\n");

  function currentPalette() {
    var theme = document.documentElement.getAttribute("data-theme");
    return theme === "light" ? PALETTES.day : PALETTES.night;
  }

  function setColor(uniform, hex) {
    uniform.value.set(hex);
  }

  function applyTheme() {
    if (!gl) return;
    var p = currentPalette();
    var u = gl.uniforms;
    setColor(u.uColA1, p.a1); setColor(u.uColA2, p.a2);
    setColor(u.uColB1, p.b1); setColor(u.uColB2, p.b2);
    setColor(u.uColC1, p.c1); setColor(u.uColC2, p.c2);
    u.uAlpha.value.set(p.alpha[0], p.alpha[1], p.alpha[2]);
  }

  function resizeRenderer() {
    if (!gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    var w = container.clientWidth || window.innerWidth;
    var h = container.clientHeight || window.innerHeight;
    gl.renderer.setPixelRatio(dpr);
    gl.renderer.setSize(w, h, false);
    gl.uniforms.uRes.value.set(w, h);
  }

  /* True only after a frame has been rendered without a GL error. Until
     then .has-wave-webgl / data-wave-rendered stay off, so a broken
     shader or lost context can never suppress the primary SVG ribbons. */
  var renderedOnce = false;

  function renderFrame() {
    if (!gl) return;
    gl.renderer.render(gl.scene, gl.camera);
    if (!renderedOnce) {
      var ctx = gl.renderer.getContext();
      if (!ctx.isContextLost() && ctx.getError() === ctx.NO_ERROR) {
        renderedOnce = true;
        container.classList.add("has-wave-webgl");
        container.setAttribute("data-wave-rendered", "true");
      }
    }
  }

  function initGL() {
    if (!THREE || !canvas) return;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        depth: false,
        stencil: false,
        /* The shader outputs STRAIGHT (non-premultiplied) alpha; declare
           that so the compositor does not misinterpret out-of-range
           premultiplied rgb (a cause of the invisible-canvas failure). */
        premultipliedAlpha: false,
        /* Keep the frame readable for pixel probes/screenshot diagnosis. */
        preserveDrawingBuffer: true,
        powerPreference: "low-power"
      });
    } catch (err) {
      return; /* WebGL unavailable — SVG fallback stays fully visible. */
    }
    if (!renderer.getContext()) {
      return;
    }
    renderer.setClearColor(0x000000, 0);

    var uniforms = {
      uRes:   { value: new THREE.Vector2(1, 1) },
      uPhase: { value: 0 },
      uLift:  { value: 0 },
      uColA1: { value: new THREE.Color(PALETTES.night.a1) },
      uColA2: { value: new THREE.Color(PALETTES.night.a2) },
      uColB1: { value: new THREE.Color(PALETTES.night.b1) },
      uColB2: { value: new THREE.Color(PALETTES.night.b2) },
      uColC1: { value: new THREE.Color(PALETTES.night.c1) },
      uColC2: { value: new THREE.Color(PALETTES.night.c2) },
      uAlpha: { value: new THREE.Vector3(0.16, 0.14, 0.10) }
    };
    var geometry = new THREE.PlaneGeometry(2, 2);
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    var scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    gl = {
      renderer: renderer, scene: scene, camera: camera,
      uniforms: uniforms, geometry: geometry, material: material
    };
    /* .has-wave-webgl is intentionally NOT set here — renderFrame() adds
       it (plus data-wave-rendered) only after the first clean frame. */
    applyTheme();
    resizeRenderer();
  }

  /* ------------------------------------------------------------------ *
   *  Scroll driver — demand-driven settle, never a permanent loop.     *
   * ------------------------------------------------------------------ */
  var target = 0;      /* eased toward this scroll progress */
  var current = 0;     /* value actually rendered           */
  var settling = false;

  function applyProgress(p) {
    if (!gl) return;
    gl.uniforms.uPhase.value = p * PHASE_MAX;
    gl.uniforms.uLift.value = p * LIFT_MAX_PX;
  }

  /* Runs only while |current - target| is meaningful, then stops. */
  function settleFrame() {
    var delta = target - current;
    if (Math.abs(delta) <= SETTLE_EPSILON) {
      current = target;
      settling = false;
      applyProgress(current);
      renderFrame();
      return;
    }
    current += delta * SETTLE_EASE;
    applyProgress(current);
    renderFrame();
    requestAnimationFrame(settleFrame);
  }

  function requestSettle() {
    if (settling) return;
    settling = true;
    requestAnimationFrame(settleFrame);
  }

  function onScroll() {
    target = scrollProgress();
    updateFallback(target);
    if (gl) requestSettle();
  }

  function onResize() {
    target = scrollProgress();
    updateFallback(target);
    if (gl) {
      resizeRenderer();
      requestSettle();
    }
  }

  function onThemeChange() {
    if (!gl) return;
    applyTheme();
    renderFrame();
  }

  function dispose() {
    if (!gl) return;
    gl.geometry.dispose();
    gl.material.dispose();
    gl.renderer.dispose();
    if (typeof gl.renderer.forceContextLoss === "function") {
      gl.renderer.forceContextLoss();
    }
    gl = null;
  }

  initGL();

  if (reduceMotion.matches) {
    /* One static frame at rest; no listeners, no movement anywhere. */
    target = current = 0;
    renderFrame();
    return;
  }

  /* Theme changes recolor/rebalance the shader bands (CSS handles the
     SVG fallback itself via the Tokyo custom properties). */
  var themeObserver = null;
  if (gl && typeof MutationObserver === "function") {
    themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("pagehide", function () {
    if (themeObserver) themeObserver.disconnect();
    dispose();
  });

  /* Initial paint. */
  target = current = scrollProgress();
  updateFallback(target);
  applyProgress(target);
  renderFrame();
})();
