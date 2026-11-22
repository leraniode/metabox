/* Underlight halftone 0.2. A positive halftone field: the dots are the colour.
   Two sources in opposite corners, a rotated lattice, dot size follows the light. The pointer is a spotlight.
   Still when untouched. It reads --ul-duet-a and --ul-duet-b */
(function () {
  "use strict";

  function rgb(value, probe) {
    var fallback = [200, 60, 180];

    if (!value || !probe) return fallback;

    // Let the browser parse CSS colour syntax, including named colours,
    // rgb(), hsl(), and supported hexadecimal formats.
    probe.fillStyle = "#c83cb4";
    probe.fillStyle = value.trim();

    var normalized = probe.fillStyle;
    var match = /^#([0-9a-f]{6})$/i.exec(normalized);

    if (!match) {
      match = /^#([0-9a-f]{3})$/i.exec(normalized);
      if (match) {
        var shortHex = match[1];
        normalized =
          "#" +
          shortHex[0] +
          shortHex[0] +
          shortHex[1] +
          shortHex[1] +
          shortHex[2] +
          shortHex[2];
        match = /^#([0-9a-f]{6})$/i.exec(normalized);
      }
    }

    if (!match) return fallback;

    var n = parseInt(match[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function init(canvas, opts) {
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new TypeError("ULHalftone.init expects a canvas element.");
    }

    var ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("ULHalftone could not acquire a 2D canvas context.");
    }

    var root = document.documentElement;
    var scene = canvas.closest(".ul-scene");
    var probe = document.createElement("canvas").getContext("2d");

    var o = Object.assign(
      {
        pitch: 14,
        angle: 23,
        gamma: 1.9,
      },
      opts || {},
    );

    var W = 0;
    var H = 0;
    var dpr = 1;

    var mx = 0;
    var my = 0;
    var tx = 0;
    var ty = 0;

    var lt = 0;
    var ltT = 0;

    var raf = 0;
    var destroyed = false;

    var api = {
      options: o,
      dirty: true,
      redraw: redraw,
      destroy: destroy,
    };

    function settings() {
      var pitch = Number(o.pitch);
      var angle = Number(o.angle);
      var gamma = Number(o.gamma);

      return {
        pitch: Number.isFinite(pitch) ? Math.max(2, pitch) : 14,
        angle: Number.isFinite(angle) ? angle : 23,
        gamma: Number.isFinite(gamma) ? Math.max(0.1, gamma) : 1.9,
      };
    }

    function redraw() {
      if (destroyed) return;
      api.dirty = true;
      schedule();
    }

    function schedule() {
      if (destroyed || raf) return;
      raf = requestAnimationFrame(frame);
    }

    function size() {
      if (destroyed) return;

      var width = canvas.clientWidth;
      var height = canvas.clientHeight;

      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

      if (!width || !height) {
        W = 0;
        H = 0;
        return;
      }

      var pixelWidth = Math.round(width * dpr);
      var pixelHeight = Math.round(height * dpr);

      var changed =
        W !== width ||
        H !== height ||
        canvas.width !== pixelWidth ||
        canvas.height !== pixelHeight;

      W = width;
      H = height;

      if (changed) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        api.dirty = true;
      }

      schedule();
    }

    function draw() {
      if (!W || !H || destroyed) return;

      var cs = getComputedStyle(root);
      var A = rgb(cs.getPropertyValue("--ul-duet-a"), probe);
      var B = rgb(cs.getPropertyValue("--ul-duet-b"), probe);

      var opt = settings();
      var P = opt.pitch;
      var th = (opt.angle * Math.PI) / 180;
      var c = Math.cos(th);
      var s = Math.sin(th);

      // Opposing light sources.
      var vAx = -0.55 * W;
      var vAy = 0.65 * H;
      var lA = vAx * vAx + vAy * vAy;

      var vBx = 0.5 * W;
      var vBy = -0.62 * H;
      var lB = vBx * vBx + vBy * vBy;

      var rMax = P * 0.62;
      var sig = Math.max(90, Math.min(W, H) * 0.14);

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // Find the bounds of the rotated lattice.
      var imin = Infinity;
      var imax = -Infinity;
      var jmin = Infinity;
      var jmax = -Infinity;

      [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ].forEach(function (q) {
        var dx = q[0] - W / 2;
        var dy = q[1] - H / 2;

        var i = (dx * c + dy * s) / P;
        var j = (-dx * s + dy * c) / P;

        imin = Math.min(imin, i);
        imax = Math.max(imax, i);
        jmin = Math.min(jmin, j);
        jmax = Math.max(jmax, j);
      });

      for (var i = Math.floor(imin) - 1; i <= Math.ceil(imax) + 1; i++) {
        for (var j = Math.floor(jmin) - 1; j <= Math.ceil(jmax) + 1; j++) {
          var x = W / 2 + (i * c - j * s) * P;
          var y = H / 2 + (i * s + j * c) * P;

          if (x < -P || x > W + P || y < -P || y > H + P) {
            continue;
          }

          var tA = ((x - W) * vAx + y * vAy) / lA;
          var tB = (x * vBx + (y - H) * vBy) / lB;

          var iA = Math.pow(Math.max(0, 1 - tA), opt.gamma);
          var iB = Math.pow(Math.max(0, 1 - tB), opt.gamma);

          var dx = x - mx;
          var dy = y - my;

          var iP = lt * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig)) * 0.85;

          var f = Math.min(1.15, iA + iB + iP) + 0.05;
          var r = rMax * Math.pow(f, 0.85);

          if (r < 0.4) continue;

          var m = iB / (iA + iB + 0.0001);
          var lift = Math.min(1, iP * 0.8) * 0.35;

          var R = A[0] * (1 - m) + B[0] * m;
          var G = A[1] * (1 - m) + B[1] * m;
          var Bl = A[2] * (1 - m) + B[2] * m;

          R += (255 - R) * lift;
          G += (255 - G) * lift;
          Bl += (255 - Bl) * lift;

          ctx.fillStyle =
            "rgba(" +
            (R | 0) +
            "," +
            (G | 0) +
            "," +
            (Bl | 0) +
            "," +
            (0.28 + 0.72 * Math.min(1, f)).toFixed(2) +
            ")";

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";
    }

    function frame() {
      raf = 0;

      if (destroyed || (scene && scene.inert)) return;

      var reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reducedMotion) {
        if (lt !== ltT || mx !== tx || my !== ty) {
          lt = ltT;
          mx = tx;
          my = ty;
          api.dirty = true;
        }
      } else {
        if (Math.abs(ltT - lt) > 0.001) {
          lt += (ltT - lt) * 0.18;

          if (Math.abs(ltT - lt) < 0.001) lt = ltT;

          api.dirty = true;
        }

        if (
          lt > 0.001 &&
          (Math.abs(tx - mx) > 0.4 || Math.abs(ty - my) > 0.4)
        ) {
          mx += (tx - mx) * 0.25;
          my += (ty - my) * 0.25;
          api.dirty = true;
        }
      }

      if (api.dirty) {
        api.dirty = false;
        draw();
      }

      // Continue only while the spotlight is moving or fading.
      var animating =
        Math.abs(ltT - lt) > 0.001 ||
        (lt > 0.001 && (Math.abs(tx - mx) > 0.4 || Math.abs(ty - my) > 0.4));

      if (animating) schedule();
    }

    function at(e) {
      var r = canvas.getBoundingClientRect();

      tx = e.clientX - r.left;
      ty = e.clientY - r.top;

      if (lt < 0.02) {
        mx = tx;
        my = ty;
      }

      ltT = 1;
      schedule();
    }

    function leave() {
      ltT = 0;
      schedule();
    }

    function onVisibility() {
      if (!document.hidden) {
        size();
        redraw();
      }
    }

    function onSceneChange() {
      if (!scene || !scene.inert) schedule();
    }

    function destroy() {
      if (destroyed) return;

      destroyed = true;

      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }

      canvas.removeEventListener("pointermove", at);
      canvas.removeEventListener("pointerdown", at);
      canvas.removeEventListener("pointerleave", leave);

      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVisibility);

      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      if (sceneObserver) sceneObserver.disconnect();
    }

    canvas.addEventListener("pointermove", at);
    canvas.addEventListener("pointerdown", at);
    canvas.addEventListener("pointerleave", leave);

    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", onVisibility);

    // Catch layout changes that don't trigger a window resize.
    var resizeObserver = null;

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(size);
      resizeObserver.observe(canvas);
    }

    // Re-render when duet colours or their defining classes change.
    var mutationObserver = new MutationObserver(function () {
      redraw();
    });

    mutationObserver.observe(root, {
      attributes: true,
      attributeFilter: ["data-duet", "style", "class"],
    });

    // Inactive scenes don't animate. Wake the effect when they become active.
    var sceneObserver = null;

    if (scene) {
      sceneObserver = new MutationObserver(onSceneChange);
      sceneObserver.observe(scene, {
        attributes: true,
        attributeFilter: ["inert"],
      });
    }

    size();
    redraw();

    return api;
  }

  window.ULHalftone = {
    init: init,
  };
})();
