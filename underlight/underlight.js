/* Underlight 0.5 runtime. No dependencies.
   Everything on the page is a pure function of one number: idx, the position along the scenes.
   Scroll is the default input. A timeline (for example Alolyte) can drive Underlight.render(idx) instead. */
(function () {
  "use strict";
  var root = document.documentElement,
    body = document.body,
    stage = document.querySelector(".ul-stage"),
    rail = document.querySelector(".ul-rail"),
    crown = document.querySelector(".ul-crown"),
    S = [].slice.call(document.querySelectorAll(".ul-scene")),
    N = S.length,
    links = [].slice.call(document.querySelectorAll(".ul-nav a")),
    step =
      parseFloat(getComputedStyle(root).getPropertyValue("--ul-step")) || 0.75,
    th = null,
    ax = false,
    navY = 0,
    tick = 0,
    act = -1,
    railH = 0,
    thH = 0,
    first = true,
    pkT = 0,
    dragging = false,
    settleT = 0,
    lastIn = 0,
    hud = null,
    modes = {},
    byId = {};
  var DEF = {
    prelude: "thin",
    plate: "cut",
    screen: "screen",
    endcap: "sealed",
  };
  function cl(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  root.style.setProperty("--ul-n", Math.max(1, S.length - 1));
  function kind(el) {
    return el.dataset.kind || "plate";
  }
  function state(el) {
    return el.dataset.state || DEF[kind(el)] || "cut";
  }
  function showRail(el) {
    return kind(el) === "plate" ? 1 : 0;
  }
  function showNav(el) {
    var k = kind(el);
    return k === "plate" || k === "endcap" ? 1 : 0;
  }
  function set(n, v) {
    root.style.setProperty(n, v.toFixed(3));
  }
  function at(i) {
    return i * innerHeight * step;
  }
  function cur() {
    return Math.min(
      N - 1,
      Math.max(0, Math.round(scrollY / (innerHeight * step))),
    );
  }
  function go(i) {
    scrollTo({ top: at(i), behavior: "smooth" });
  }

  /* dev tools: layers view and a live readout. Off unless asked for */
  var dev =
    root.hasAttribute("data-ul-dev") || /[?&]ul=dev\b/.test(location.search);
  try {
    dev = dev || localStorage.getItem("ulDev") === "1";
  } catch (e) {}
  if (dev) {
    body.setAttribute("data-ul-dev", "");
    hud = document.createElement("div");
    hud.className = "ul-hud";
    body.appendChild(hud);
    [].forEach.call(document.querySelectorAll("[data-layer]"), function (el) {
      var s = document.createElement("span");
      s.className = "ul-lbl";
      s.setAttribute("aria-hidden", "true");
      s.textContent = el.dataset.layer;
      el.appendChild(s);
    });
    addEventListener("keydown", function (e) {
      if (
        (e.key === "l" || e.key === "L") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
      )
        body.toggleAttribute("data-layers");
    });
  }

  try {
    modes = JSON.parse((crown && crown.dataset.ulModes) || "{}");
  } catch (e) {}
  S.forEach(function (s, i) {
    if (s.id) byId[s.id] = i;
  });
  links.forEach(function (a) {
    a._i = byId[(a.getAttribute("href") || "").slice(1)];
  });
  [].forEach.call(
    document.querySelectorAll("[data-ul-home],.ul-crown a.nm"),
    function (a) {
      var id = (a.getAttribute("href") || "").slice(1);
      a._i = byId[id] != null ? byId[id] : 0;
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        go(a._i);
      });
    },
  );

  [].forEach.call(document.querySelectorAll("[data-ul-letters]"), function (h) {
    var s = h.textContent;
    h.textContent = "";
    h.setAttribute("role", "img");
    s.split(" ").forEach(function (word, wi) {
      if (wi) h.appendChild(document.createTextNode(" "));
      var w = document.createElement("span");
      w.className = "ul-w";
      w.setAttribute("aria-hidden", "true");
      word.split("").forEach(function (c) {
        var e = document.createElement("span");
        e.className = "ul-l";
        e.textContent = c;
        e.style.setProperty("--r", Math.random().toFixed(2));
        e.style.setProperty("--q", Math.random().toFixed(2));
        e.style.setProperty("--d", Math.round(Math.random() * 90));
        w.appendChild(e);
      });
      h.appendChild(w);
    });
  });

  if (rail) {
    ax = rail.dataset.axis === "x";
    th = document.createElement("i");
    rail.appendChild(th);
    S.forEach(function (s, i) {
      if (!showRail(s)) return;
      var u = document.createElement("u");
      u.style[ax ? "left" : "top"] = (i / Math.max(1, N - 1)) * 100 + "%";
      rail.appendChild(u);
    });
  }
  function size() {
    if (rail) {
      railH = ax ? rail.clientWidth : rail.clientHeight;
      thH = ax ? th.offsetWidth : th.offsetHeight;
    }
  }
  function nmw() {
    var n = crown && crown.querySelector(".nm");
    if (n) root.style.setProperty("--ul-nmw", n.offsetWidth + "px");
  }
  function peek(ms) {
    if (!crown || crown.hasAttribute("data-notch")) return;
    crown.classList.add("open");
    clearTimeout(pkT);
    pkT = setTimeout(function () {
      crown.classList.remove("open");
    }, ms || 1700);
  }
  function setT(sel, v) {
    [].forEach.call(document.querySelectorAll(sel), function (n) {
      if (n.textContent === v) return;
      n.textContent = v;
      n.classList.remove("roll");
      void n.offsetWidth;
      n.classList.add("roll");
    });
  }

  /* the one function that draws the page. idx 0 is the first scene, 1 the second, and so on */
  function render(idx, p) {
    var i0 = Math.min(N - 1, Math.max(0, Math.floor(idx))),
      i1 = Math.min(N - 1, i0 + 1),
      g = cl((idx - i0 - 0.25) / 0.5);
    g = g * g * (3 - 2 * g);
    var a = S[i0],
      b = S[i1],
      sa = state(a),
      sb = state(b);
    function mix(x, y) {
      return x * (1 - g) + y * g;
    }
    set("--ul-p", p);
    set("--ul-open", mix(sa === "cut" ? 1 : 0, sb === "cut" ? 1 : 0));
    set(
      "--ul-lit",
      mix(
        sa === "sealed" || sa === "screen" ? 0 : 1,
        sb === "sealed" || sb === "screen" ? 0 : 1,
      ),
    );
    set("--ul-screen", mix(sa === "screen" ? 1 : 0, sb === "screen" ? 1 : 0));
    set("--ul-rail", mix(showRail(a), showRail(b)));
    set("--ul-navv", mix(showNav(a), showNav(b)));
    S.forEach(function (el, i) {
      var d = idx - i,
        ad = Math.abs(d),
        side = el.dataset.enter,
        v,
        c = 1,
        x = 0;
      if (side === "left" || side === "right") {
        v = cl(1.8 - 2 * ad);
        c = cl(1.5 - 2.7 * ad);
        x = (d < 0 ? -1 : 1) * (1 - v) * 60 * (side === "right" ? -1 : 1);
      } else v = cl(1.7 - 2.4 * ad);
      el.style.setProperty("--ul-a", v.toFixed(3));
      el.style.setProperty("--ul-c", c.toFixed(3));
      el.style.setProperty("--ul-x", x.toFixed(1) + "px");
      el.inert = ad >= 0.5;
    });
    var k = Math.min(N - 1, Math.max(0, Math.round(idx)));
    if (k !== act) {
      act = k;
      var e = S[k],
        kd = kind(e),
        st = state(e);
      body.dataset.ulState = st;
      body.dataset.ulKind = kd;
      if (crown) {
        if (kd === "screen") crown.setAttribute("data-notch", "");
        else crown.removeAttribute("data-notch");
      }
      var ex = e.dataset.exhibit;
      if (stage && ex)
        [].forEach.call(stage.querySelectorAll(".ul-exhibit"), function (s) {
          s.classList.toggle("on", s.dataset.exhibit === ex);
        });
      var own = e.hasAttribute("data-title"),
        title = own ? e.getAttribute("data-title") : "";
      links.forEach(function (l) {
        var on = l._i === k;
        if (on) {
          l.setAttribute("aria-current", "true");
          if (!own) title = l.textContent.toLowerCase();
        } else l.removeAttribute("aria-current");
      });
      setT("[data-ul-title]", title);
      setT("[data-ul-label]", modes[st] || st);
      [].forEach.call(
        document.querySelectorAll("[data-ul-title]"),
        function (n) {
          n.parentElement.hidden = !title;
        },
      );
      if (first) first = false;
      else peek();
    }
    if (hud)
      hud.textContent =
        body.dataset.ulKind +
        " / " +
        body.dataset.ulState +
        "\nopen " +
        root.style.getPropertyValue("--ul-open") +
        "  lit " +
        root.style.getPropertyValue("--ul-lit") +
        "\nscreen " +
        root.style.getPropertyValue("--ul-screen") +
        "  p " +
        root.style.getPropertyValue("--ul-p");
  }
  function upd() {
    tick = 0;
    var max = root.scrollHeight - innerHeight,
      p = max > 0 ? cl(scrollY / max) : 0;
    render(scrollY / (innerHeight * step), p);
    if (body.hasAttribute("data-nav-open") && Math.abs(scrollY - navY) > 16)
      body.removeAttribute("data-nav-open");
    if (th)
      th.style.transform =
        "translate" +
        (ax ? "X" : "Y") +
        "(" +
        (p * (railH - thH)).toFixed(1) +
        "px)";
  }
  function req() {
    if (!tick) {
      tick = 1;
      requestAnimationFrame(upd);
    }
  }

  /* a gentle settle: only after scrolling has been idle, and only when close to a scene */
  function settle() {
    if (
      Date.now() - lastIn < 320 ||
      dragging ||
      matchMedia("(prefers-reduced-motion:reduce)").matches
    )
      return;
    var idx = scrollY / (innerHeight * step),
      k = Math.round(idx),
      d = Math.abs(idx - k);
    if (d > 0.03 && d < 0.22) go(k);
  }
  ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"].forEach(
    function (t) {
      addEventListener(
        t,
        function () {
          lastIn = Date.now();
        },
        { passive: true },
      );
    },
  );
  addEventListener(
    "scroll",
    function () {
      req();
      clearTimeout(settleT);
      settleT = setTimeout(settle, 360);
    },
    { passive: true },
  );
  addEventListener("resize", function () {
    size();
    nmw();
    req();
  });

  /* dive and surface: sideways scroll enters the next screen scene, and leaves one */
  var dx = 0,
    dxT = 0;
  function dive(dir) {
    var c = cur();
    if (dir > 0) {
      for (var i = c + 1; i < N; i++)
        if (kind(S[i]) === "screen") {
          go(i);
          return;
        }
    } else if (kind(S[c]) === "screen") go(Math.max(0, c - 1));
  }
  addEventListener(
    "wheel",
    function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.5) return;
      dx += e.deltaX;
      clearTimeout(dxT);
      dxT = setTimeout(function () {
        dx = 0;
      }, 180);
      if (dx > 140) {
        dx = 0;
        dive(1);
      } else if (dx < -140) {
        dx = 0;
        dive(-1);
      }
    },
    { passive: true },
  );
  addEventListener("keydown", function (e) {
    if (e.key === "Escape") dive(-1);
  });

  links.forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (a._i != null) go(a._i);
    });
  });
  function seek(ev) {
    var r = rail.getBoundingClientRect(),
      f = cl(
        ax ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height,
      );
    scrollTo({
      top: f * (root.scrollHeight - innerHeight),
      behavior: "instant",
    });
  }
  if (rail) {
    rail.addEventListener("pointerdown", function (ev) {
      dragging = true;
      rail.setPointerCapture(ev.pointerId);
      seek(ev);
      rail.onpointermove = seek;
    });
    function drop() {
      rail.onpointermove = null;
      dragging = false;
    }
    rail.addEventListener("pointerup", drop);
    rail.addEventListener("pointercancel", drop);
  }

  /* the crown opens when the pointer comes near the space it would take */
  addEventListener(
    "pointermove",
    function (e) {
      if (!crown || e.pointerType === "touch") return;
      var lim = crown.classList.contains("near") ? 104 : 78;
      crown.classList.toggle(
        "near",
        e.clientY < lim && e.clientX > 52 && e.clientX < innerWidth - 18,
      );
    },
    { passive: true },
  );
  document.addEventListener("mouseleave", function () {
    if (crown) crown.classList.remove("near");
  });
  /* touch: drag right to draw the nav in (or surface from a screen), drag left to put it away (or dive) */
  var tx = 0,
    ty = 0,
    tm = false;
  addEventListener(
    "touchstart",
    function (e) {
      var t = e.touches[0];
      tx = t.clientX;
      ty = t.clientY;
      tm = false;
    },
    { passive: true },
  );
  addEventListener(
    "touchmove",
    function (e) {
      if (tm) return;
      var t = e.touches[0],
        dx = t.clientX - tx,
        dy = t.clientY - ty;
      if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        tm = true;
        if (dx > 0) {
          if (kind(S[cur()]) === "screen") dive(-1);
          else {
            body.setAttribute("data-nav-open", "");
            navY = scrollY;
          }
        } else if (body.hasAttribute("data-nav-open"))
          body.removeAttribute("data-nav-open");
        else dive(1);
      }
    },
    { passive: true },
  );
  /* the current duet's name, wherever a page wants to show it */
  function duet() {
    [].forEach.call(document.querySelectorAll("[data-ul-duet]"), function (n) {
      n.textContent = root.dataset.duet || "paragon";
    });
  }
  new MutationObserver(duet).observe(root, {
    attributes: true,
    attributeFilter: ["data-duet"],
  });
  duet();

  window.Underlight = {
    render: render,
    go: go,
    scenes: S,
    get dev() {
      return dev;
    },
  };
  size();
  upd();
  nmw();
  setTimeout(function () {
    peek(2800);
  }, 350);
  if (document.fonts) document.fonts.ready.then(nmw);
})();
