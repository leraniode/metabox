/* Underlight halftone 0.2. A positive halftone field: the dots are the colour.
   Two sources in opposite corners, a rotated lattice, dot size follows the light. The pointer is a spotlight.
   Still when untouched. It reads --ul-duet-a and --ul-duet-b */
(function () {
  function rgb(s) {
    s = (s || "").trim();
    var m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = /(\d+)\D+(\d+)\D+(\d+)/.exec(s);
    return m ? [+m[1], +m[2], +m[3]] : [200, 60, 180];
  }
  function init(canvas, opts) {
    var ctx = canvas.getContext("2d"),
      dpr = Math.min(2, devicePixelRatio || 1),
      W = 0,
      H = 0,
      mx = 0,
      my = 0,
      tx = 0,
      ty = 0,
      lt = 0,
      ltT = 0,
      o = Object.assign({ pitch: 14, angle: 23, gamma: 1.9 }, opts || {}),
      scene = canvas.closest(".ul-scene"),
      api = { options: o, dirty: true };
    function size() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (!W) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.dirty = true;
    }
    function draw() {
      if (!W) return;
      var cs = getComputedStyle(document.documentElement),
        A = rgb(cs.getPropertyValue("--ul-duet-a")),
        B = rgb(cs.getPropertyValue("--ul-duet-b")),
        P = o.pitch,
        th = (o.angle * Math.PI) / 180,
        c = Math.cos(th),
        s = Math.sin(th),
        vAx = -0.55 * W,
        vAy = 0.65 * H,
        lA = vAx * vAx + vAy * vAy,
        vBx = 0.5 * W,
        vBy = -0.62 * H,
        lB = vBx * vBx + vBy * vBy,
        rMax = P * 0.62,
        sig = Math.max(90, Math.min(W, H) * 0.14);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      var imin = 1e9,
        imax = -1e9,
        jmin = 1e9,
        jmax = -1e9;
      [
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ].forEach(function (q) {
        var dx = q[0] - W / 2,
          dy = q[1] - H / 2,
          i = (dx * c + dy * s) / P,
          j = (-dx * s + dy * c) / P;
        imin = Math.min(imin, i);
        imax = Math.max(imax, i);
        jmin = Math.min(jmin, j);
        jmax = Math.max(jmax, j);
      });
      for (var i = Math.floor(imin) - 1; i <= Math.ceil(imax) + 1; i++)
        for (var j = Math.floor(jmin) - 1; j <= Math.ceil(jmax) + 1; j++) {
          var x = W / 2 + (i * c - j * s) * P,
            y = H / 2 + (i * s + j * c) * P;
          if (x < -P || x > W + P || y < -P || y > H + P) continue;
          var tA = ((x - W) * vAx + y * vAy) / lA,
            tB = (x * vBx + (y - H) * vBy) / lB,
            iA = Math.pow(Math.max(0, 1 - tA), o.gamma),
            iB = Math.pow(Math.max(0, 1 - tB), o.gamma),
            iP =
              lt *
              Math.exp(
                -((x - mx) * (x - mx) + (y - my) * (y - my)) / (2 * sig * sig),
              ) *
              0.85,
            f = Math.min(1.15, iA + iB + iP) + 0.05,
            r = rMax * Math.pow(f, 0.85);
          if (r < 0.4) continue;
          var m = iB / (iA + iB + 0.0001),
            lift = Math.min(1, iP * 0.8) * 0.35,
            R = A[0] * (1 - m) + B[0] * m,
            G = A[1] * (1 - m) + B[1] * m,
            Bl = A[2] * (1 - m) + B[2] * m;
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
          ctx.arc(x, y, r, 0, 6.2832);
          ctx.fill();
        }
    }
    function loop() {
      requestAnimationFrame(loop);
      if (scene && scene.inert) return;
      if (Math.abs(ltT - lt) > 0.01) {
        lt += (ltT - lt) * 0.18;
        api.dirty = true;
      }
      if (lt > 0.01 && (Math.abs(tx - mx) > 0.4 || Math.abs(ty - my) > 0.4)) {
        mx += (tx - mx) * 0.25;
        my += (ty - my) * 0.25;
        api.dirty = true;
      }
      if (!api.dirty) return;
      api.dirty = false;
      draw();
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
    }
    canvas.addEventListener("pointermove", at);
    canvas.addEventListener("pointerdown", at);
    canvas.addEventListener("pointerleave", function () {
      ltT = 0;
    });
    addEventListener("resize", size);
    new MutationObserver(function () {
      api.dirty = true;
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-duet"],
    });
    api.redraw = function () {
      api.dirty = true;
    };
    size();
    requestAnimationFrame(loop);
    return api;
  }
  window.ULHalftone = { init: init };
})();
