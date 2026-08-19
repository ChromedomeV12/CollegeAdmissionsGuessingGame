/* Sculpted-fold wallpaper — procedural relief backdrop driver. Classic script.

   PRIMARY: when window.THREE (classic CDN build) and WebGL are available,
   #ambient-wave-canvas paints an OPAQUE full-viewport relief: six broad
   organic fold boundaries sweeping lower-left to upper-right. Each boundary
   is a low-frequency sine curve with a second harmonic and a quadratic
   (Bezier-like) bend. Per pixel, the six signed distances form a layer id;
   each layer is filled with a base color mixed in JS from exact Tokyo
   anchors, then sculpted with a narrow crest highlight (smoothstep band on
   the near side of its boundary) and a wider valley shadow (smoothstep band
   on the far side), plus a soft top-left directional light and a gentle
   vignette. Grain <= 1% keeps the surface from banding.

   MOTION: a slow breathing drift (uTime, full cycle ~110s) plus scroll
   parallax (uShift, <= 64px) and an optional pointer nudge (<= 8px). The
   render loop is capped at 30fps and pauses when document.hidden. With
   prefers-reduced-motion exactly one static frame is drawn and no listeners
   are bound at all.

   FALLBACK: the .aw-fallback SVG (six broad closed Bezier fold shapes with
   valley -> fold -> crest gradients) stays fully visible until the first
   canvas frame renders without a GL error; only then does the container get
   data-wave-rendered="true", which hides the SVG. Any failure — no THREE,
   no WebGL, broken shader, lost context — leaves the fallback untouched.
   DPR is capped at 1.5 and all GL resources are disposed on pagehide. */
(function () {
  "use strict";

  var container = document.querySelector(".ambient-waves");
  if (!container) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  /* Normalized scroll progress through the document, clamped to [0, 1]. */
  function scrollProgress() {
    var doc = document.documentElement;
    var range = Math.max(1, doc.scrollHeight - window.innerHeight);
    return clamp(window.scrollY / range, 0, 1);
  }

  /* ------------------------------------------------------------------ *
   *  Fallback driver — one CSS custom property, --wave-shift, drifts   *
   *  the SVG fold sheet by at most 64px over full scroll, mirroring    *
   *  the shader's uShift so the WebGL/SVG handoff is seamless.         *
   * ------------------------------------------------------------------ */
  var SHIFT_MAX_PX = 64;
  function updateFallback(p) {
    container.style.setProperty("--wave-shift", (-(SHIFT_MAX_PX * p)).toFixed(2) + "px");
  }

  /* ------------------------------------------------------------------ *
   *  WebGL primary. Any failure along the way leaves the SVG fallback  *
   *  fully visible and quietly aborts.                                 *
   * ------------------------------------------------------------------ */
  var THREE = window.THREE;
  var canvas = document.getElementById("ambient-wave-canvas");
  var gl = null; // { renderer, scene, camera, uniforms, geometry, material }

  /* Exact Tokyo anchors only — identical to the styles-v2.css tokens.
     Layer bases are blends of these anchors + #16161e (bg-canvas-2);
     crest highlights and valley shadows are computed in the shader from
     the same uniforms. Mix factors below interpolate linear RGB, which
     matches how color-mix(in srgb, ...) interpolates after gamma decode —
     close enough for low-saturation folds. */
  var PALETTES = {
    night: {
      bg:      "#16161e", /* deep valley floor   */
      crest:   "#c0caf5", /* crest highlight mix */
      crestHi: "#7aa2f7", /* accent crest tint   */
      /* six fold layer bases, dark valley -> lit crest */
      layers: ["#16161e", "#1a1b26", "#1a1b26", "#1a1b26", "#1a1b26", "#1a1b26"],
      /* per-layer blend targets + factors (toward the accent/anchor) */
      tints: [
        { hex: "#565f89", k: 0.10 }, /* comment  */
        { hex: "#565f89", k: 0.16 },
        { hex: "#bb9af7", k: 0.16 }, /* magenta  */
        { hex: "#7aa2f7", k: 0.20 }, /* blue     */
        { hex: "#bb9af7", k: 0.24 },
        { hex: "#7aa2f7", k: 0.28 }
      ]
    },
    day: {
      bg:      "#e1e2e7",
      crest:   "#e1e2e7", /* highlight lifts toward canvas white */
      crestHi: "#2e7de9",
      layers: ["#e1e2e7", "#e1e2e7", "#e1e2e7", "#e1e2e7", "#e1e2e7", "#e1e2e7"],
      tints: [
        { hex: "#343b58", k: 0.28 }, /* foreground slate */
        { hex: "#848cb5", k: 0.36 }, /* comment slate    */
        { hex: "#848cb5", k: 0.28 },
        { hex: "#9854f1", k: 0.20 }, /* restrained magenta */
        { hex: "#2e7de9", k: 0.22 }, /* restrained blue    */
        { hex: "#2e7de9", k: 0.16 }
      ]
    }
  };

  /* Relief/motion budget. */
  var DRIFT_PERIOD_S = 110;  /* breathing cycle — well over the 45s floor  */
  var POINTER_MAX_PX = 8;
  var FPS_CAP = 30;
  var DPR_CAP = 1.5;

  var VERT = [
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = uv;",
    "  gl_Position = vec4(position.xy, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* The relief is built in an aspect-correct uv space (x spans the viewport
     aspect, y spans 0..1). Six fold boundaries are stacked bottom to top;
     each boundary curve y = f(x) combines:
       - a low-frequency sine plus a quarter-amplitude second harmonic
         (broad organic sweep, never busy);
       - a quadratic bend (Bezier-like pull toward the upper right);
       - a slow time drift whose period is per-boundary so the cloth
         breathes without spinning;
       - scroll (uShift) and pointer (uPointer) offsets in uv units.
     Signed distance d = y - f(x) is positive above the boundary (crest
     side). Layer id = number of boundaries below the pixel. Per layer:
       base   = uLayer[i] (pre-mixed Tokyo anchor blends);
       crest  = narrow smoothstep band for 0 < d < wCrest mixes toward
                uCrest / uCrestHi — the soft highlight on the fold's lip;
       valley = wider smoothstep band for -wValley < d < 0 pulls toward
                uBg — the deep smooth inner shadow under the fold;
       light  = a soft top-left directional gradient fakes global shading.
     Grain: one hash-based dither at <= 1% amplitude, static per frame. */
  var FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform float uShift;",    /* uv units, <= 0 (scrolls folds upward) */
    "uniform vec2 uPointer;",   /* uv units, |.| <= ~8px                */
    "uniform vec3 uBg;",
    "uniform vec3 uCrest;",
    "uniform vec3 uCrestHi;",
    "uniform vec3 uLayer0; uniform vec3 uLayer1; uniform vec3 uLayer2;",
    "uniform vec3 uLayer3; uniform vec3 uLayer4; uniform vec3 uLayer5;",
    "",
    "float hash21(vec2 p) {",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",
    "",
    /* Boundary: center c, amplitude a, freq f, phase p, bend b. One broad
       sine plus a quarter-amplitude second harmonic, bent upward at the
       edges by the quadratic term. */
    "float fold(float x, float c, float a, float f, float p, float b, float t) {",
    "  float w = a * sin(x * f + p + t) + 0.25 * a * sin(x * f * 2.13 + p * 1.7 - t * 0.6);",
    "  return c + w + b * (x - 0.5) * (x - 0.5) - 0.25 * b;",
    "}",
    "",
    "void main() {",
    "  float aspect = uRes.x / uRes.y;",
    "  float x = vUv.x * aspect;",
    "  float y = vUv.y - uShift + uPointer.y;",
    "  float px = x + uPointer.x;",
    "",
    /* Six boundaries, bottom (0) to top (5). Amplitudes are ~0.5x the
       layer spacing so neighboring folds visibly overlap and slide over
       each other like stacked cloth. Negative bend pulls the curve down
       at both edges (edges recede, mid-ridge catches the light). */
    "  float t = uTime;",
    "  float d0 = y - fold(px, 0.04, 0.085, 2.1, 0.4, -0.30,  t        );",
    "  float d1 = y - fold(px, 0.22, 0.090, 1.7, 1.9, -0.24,  t * 0.83 );",
    "  float d2 = y - fold(px, 0.40, 0.095, 2.5, 3.1, -0.32,  t * 1.13 );",
    "  float d3 = y - fold(px, 0.58, 0.090, 1.9, 4.4, -0.26,  t * 0.71 );",
    "  float d4 = y - fold(px, 0.76, 0.085, 2.9, 5.6, -0.34,  t * 0.97 );",
    "  float d5 = y - fold(px, 0.93, 0.080, 2.3, 0.9, -0.28,  t * 1.21 );",
    "",
    "  int layer = 0;",
    "  float dNear = d0;",
    "  if (d0 > 0.0) { layer = 1; dNear = d1; }",
    "  if (d1 > 0.0) { layer = 2; dNear = d2; }",
    "  if (d2 > 0.0) { layer = 3; dNear = d3; }",
    "  if (d3 > 0.0) { layer = 4; dNear = d4; }",
    "  if (d4 > 0.0) { layer = 5; dNear = d5; }",
    "  if (d5 > 0.0) { layer = 6; dNear = d5; }",
    "",
    "  vec3 base = uLayer0;",
    "  if (layer == 1) base = uLayer1;",
    "  else if (layer == 2) base = uLayer2;",
    "  else if (layer == 3) base = uLayer3;",
    "  else if (layer == 4) base = uLayer4;",
    "  else if (layer >= 5) base = uLayer5;",
    "",
    /* dNear > 0: this side of the boundary catches the crest highlight
       (narrow band). dNear < 0: the pixel sits in the valley under the
       boundary above (wide, deep, smooth shadow). */
    "  float wCrest = 0.075;",
    "  float wValley = 0.240;",
    "  float crestBand = smoothstep(wCrest, 0.0, dNear) * step(0.0, dNear);",
    "  float valleyBand = smoothstep(-wValley, 0.0, dNear) * step(dNear, 0.0);",
    "",
    "  vec3 crestCol = mix(uCrest, uCrestHi, 0.35 + 0.30 * vUv.x);",
    "  vec3 col = base;",
    "  col = mix(col, uBg, valleyBand * 0.72);",
    "  col = mix(col, crestCol, crestBand * 0.42);",
    "",
    /* Soft directional light from the upper-left; gentle vignette. */
    "  float light = 1.0 + 0.12 * (vUv.y - 0.5) - 0.07 * (vUv.x - 0.4);",
    "  col *= light;",
    "  float vig = smoothstep(1.25, 0.55, length(vUv - vec2(0.5, 0.45)));",
    "  col *= mix(0.90, 1.0, vig);",
    "",
    "  col += (hash21(gl_FragCoord.xy) - 0.5) * 0.012; /* <= 1% grain */",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function currentPalette() {
    var theme = document.documentElement.getAttribute("data-theme");
    return theme === "light" ? PALETTES.day : PALETTES.night;
  }

  /* Mix two #rrggbb anchors in gamma space; factor 0..1. */
  function mixHex(a, b, k) {
    var ca = new THREE.Color(a);
    var cb = new THREE.Color(b);
    ca.lerp(cb, k);
    return ca;
  }

  function applyTheme() {
    if (!gl) return;
    var p = currentPalette();
    var u = gl.uniforms;
    u.uBg.value.set(p.bg);
    u.uCrest.value.set(p.crest);
    u.uCrestHi.value.set(p.crestHi);
    for (var i = 0; i < 6; i++) {
      u["uLayer" + i].value.copy(mixHex(p.layers[i], p.tints[i].hex, p.tints[i].k));
    }
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
     then data-wave-rendered stays off and the SVG fallback keeps painting
     the wallpaper, so a broken shader or lost context can never blank the
     backdrop. */
  var renderedOnce = false;

  function renderFrame() {
    if (!gl) return;
    gl.renderer.render(gl.scene, gl.camera);
    if (!renderedOnce) {
      var ctx = gl.renderer.getContext();
      if (!ctx.isContextLost() && ctx.getError() === ctx.NO_ERROR) {
        renderedOnce = true;
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
        alpha: false,            /* opaque wallpaper — no compositing games */
        antialias: false,        /* edges are smoothstepped in-shader */
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power"
      });
    } catch (err) {
      return; /* WebGL unavailable — SVG fallback stays fully visible. */
    }
    if (!renderer.getContext()) {
      return;
    }
    renderer.setClearColor(0x000000, 1);

    var uniforms = {
      uRes:     { value: new THREE.Vector2(1, 1) },
      uTime:    { value: 0 },
      uShift:   { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uBg:      { value: new THREE.Color(PALETTES.night.bg) },
      uCrest:   { value: new THREE.Color(PALETTES.night.crest) },
      uCrestHi: { value: new THREE.Color(PALETTES.night.crestHi) },
      uLayer0:  { value: new THREE.Color(PALETTES.night.layers[0]) },
      uLayer1:  { value: new THREE.Color(PALETTES.night.layers[1]) },
      uLayer2:  { value: new THREE.Color(PALETTES.night.layers[2]) },
      uLayer3:  { value: new THREE.Color(PALETTES.night.layers[3]) },
      uLayer4:  { value: new THREE.Color(PALETTES.night.layers[4]) },
      uLayer5:  { value: new THREE.Color(PALETTES.night.layers[5]) }
    };
    var geometry = new THREE.PlaneGeometry(2, 2);
    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
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
    /* data-wave-rendered is intentionally NOT set here — renderFrame()
       adds it only after the first clean frame. */
    applyTheme();
    resizeRenderer();
  }

  /* ------------------------------------------------------------------ *
   *  Motion driver — 30fps-capped loop, pauses when hidden.            *
   * ------------------------------------------------------------------ */
  var rafId = 0;
  var lastFrame = 0;
  var startTs = 0;
  var pointerTarget = { x: 0, y: 0 }; /* px, clamped to +-POINTER_MAX_PX */
  var pointerCurrent = { x: 0, y: 0 };

  function applyScroll() {
    var p = scrollProgress();
    updateFallback(p);
    if (gl) {
      /* Negative: folds rise as the page scrolls down. */
      gl.uniforms.uShift.value = -(SHIFT_MAX_PX * p) /
        Math.max(1, container.clientHeight || window.innerHeight);
    }
  }

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (!startTs) startTs = ts;
    if (ts - lastFrame < 1000 / FPS_CAP - 1) return; /* 30fps cap */
    lastFrame = ts;
    if (!gl) return;

    /* Breathing drift: one full sine cycle per DRIFT_PERIOD_S. */
    var t = ((ts - startTs) / 1000) * (Math.PI * 2 / DRIFT_PERIOD_S) * 6.0;
    gl.uniforms.uTime.value = t;

    /* Pointer easing toward target. */
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.06;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.06;
    var h = Math.max(1, container.clientHeight || window.innerHeight);
    gl.uniforms.uPointer.value.set(pointerCurrent.x / h, pointerCurrent.y / h);

    renderFrame();
  }

  function onScroll() {
    applyScroll();
    if (gl && !renderedOnce) renderFrame();
  }

  function onResize() {
    applyScroll();
    if (gl) {
      resizeRenderer();
      renderFrame();
    }
  }

  function onPointerMove(e) {
    var nx = (e.clientX / window.innerWidth) * 2 - 1;
    var ny = (e.clientY / window.innerHeight) * 2 - 1;
    pointerTarget.x = clamp(nx * POINTER_MAX_PX, -POINTER_MAX_PX, POINTER_MAX_PX);
    pointerTarget.y = clamp(ny * POINTER_MAX_PX, -POINTER_MAX_PX, POINTER_MAX_PX);
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        lastFrame = 0;
      }
    } else if (!rafId) {
      rafId = requestAnimationFrame(frame);
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
    renderFrame();
    return;
  }

  /* Theme changes recolor the relief (CSS handles the SVG fallback itself
     via the Tokyo custom properties). */
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
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", function () {
    if (themeObserver) themeObserver.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    dispose();
  });

  /* Initial paint + start the breathing loop. */
  applyScroll();
  renderFrame();
  if (gl) rafId = requestAnimationFrame(frame);
})();
