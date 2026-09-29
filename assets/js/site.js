(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- theme ---------- */
  function savedTheme() { try { return localStorage.getItem("theme"); } catch (e) { return null; } }
  var t = savedTheme();
  if (t === "dark" || t === "light") root.setAttribute("data-theme", t);
  function isDark() { return root.getAttribute("data-theme") !== "light"; }
  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      aurora.recolor();
    });
  }

  /* ---------- aurora background ---------- */
  var aurora = (function () {
    var c = document.getElementById("aurora");
    if (!c) return { recolor: function () {} };
    var ctx = c.getContext("2d");
    var SCALE = 10; // render small, let CSS upscale into soft light
    var W, H, colors = [], alpha = 0.5, bg = "#fff", dark = false;
    var blobs = [
      { x: 0.18, y: 0.22, r: 0.55, sx: 0.00011, sy: 0.00009, ph: 0 },
      { x: 0.82, y: 0.18, r: 0.5, sx: 0.00008, sy: 0.00013, ph: 2 },
      { x: 0.55, y: 0.85, r: 0.6, sx: 0.0001, sy: 0.00007, ph: 4 },
      { x: 0.9, y: 0.7, r: 0.45, sx: 0.00012, sy: 0.0001, ph: 1 }
    ];
    function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
    function recolor() {
      colors = ["--aurora-1", "--aurora-2", "--aurora-3", "--aurora-4"].map(css);
      alpha = parseFloat(css("--aurora-alpha")) || 0.5;
      bg = css("--bg");
      dark = isDark();
    }
    function size() {
      // keep the short side at >= 140 px so gradients stay smooth on phones
      var shortSide = Math.min(window.innerWidth, window.innerHeight);
      var scale = Math.min(SCALE, Math.max(2, shortSide / 140));
      W = c.width = Math.max(48, Math.round(window.innerWidth / scale));
      H = c.height = Math.max(48, Math.round(window.innerHeight / scale));
    }
    function hexToRgb(h) {
      h = h.replace("#", "");
      if (h.length === 3) h = h.split("").map(function (ch) { return ch + ch; }).join("");
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function draw(time) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var x = (b.x + 0.12 * Math.sin(time * b.sx + b.ph)) * W;
        var y = (b.y + 0.12 * Math.cos(time * b.sy + b.ph)) * H;
        var r = b.r * Math.sqrt(W * H) * 1.15;
        var rgb = hexToRgb(colors[i] || "#888");
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(" + rgb.join(",") + "," + alpha + ")");
        g.addColorStop(1, "rgba(" + rgb.join(",") + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    var last = 0;
    function loop(now) {
      if (now - last > 40) { draw(now); last = now; }
      if (!reduced) requestAnimationFrame(loop);
    }
    recolor(); size(); draw(0);
    if (!reduced) requestAnimationFrame(loop);
    window.addEventListener("resize", function () { size(); draw(last); });
    return { recolor: function () { recolor(); draw(last); } };
  })();

  /* ---------- pointer specular on glass ---------- */
  if (finePointer) {
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest(".glass");
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      el.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    }, { passive: true });
  }

  /* ---------- portrait tilt ---------- */
  var visual = document.querySelector(".hero-visual");
  var portrait = document.querySelector(".portrait");
  if (visual && portrait && finePointer && !reduced) {
    visual.addEventListener("pointermove", function (e) {
      var r = visual.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      portrait.style.transform = "rotateY(" + (px * 10).toFixed(2) + "deg) rotateX(" + (-py * 10).toFixed(2) + "deg)";
    });
    visual.addEventListener("pointerleave", function () { portrait.style.transform = ""; });
  }

  /* ---------- dock: active section + sliding indicator ---------- */
  var nav = document.querySelector(".dock-nav");
  var ind = document.querySelector(".dock-ind");
  var links = nav ? Array.prototype.slice.call(nav.querySelectorAll("a[href^='#']")) : [];
  function moveInd(a) {
    if (!ind || !a) return;
    ind.style.left = a.offsetLeft + "px";
    ind.style.width = a.offsetWidth + "px";
    ind.style.opacity = "1";
  }
  if (links.length) {
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var lock = null, ticking = false;
    function setActive(a) {
      links.forEach(function (l) { l.classList.toggle("active", l === a); });
      moveInd(a);
    }
    function pick() {
      ticking = false;
      if (lock) return;
      var ref = window.scrollY + Math.min(window.innerHeight * 0.35, 220);
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      var best = null, bestTop = -Infinity;
      sections.forEach(function (s, i) {
        if (!s) return;
        var top = s.getBoundingClientRect().top + window.scrollY;
        if (top <= ref && top > bestTop) { bestTop = top; best = links[i]; }
      });
      if (atBottom) best = links[links.length - 1];
      if (best) setActive(best);
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(pick); } }
    links.forEach(function (a) {
      a.addEventListener("click", function () { lock = a; setActive(a); });
    });
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (ev) {
      window.addEventListener(ev, function (e) {
        if (ev === "pointerdown" && nav.contains(e.target)) return;
        if (lock) { lock = null; onScroll(); }
      }, { passive: true });
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { var a = nav.querySelector("a.active"); if (a) moveInd(a); });
    if (location.hash) { var h = links.filter(function (a) { return a.getAttribute("href") === location.hash; })[0]; if (h) { lock = h; setActive(h); } }
    else pick();
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reveals.length && "IntersectionObserver" in window && !reduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); ro.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
    reveals.forEach(function (el) {
      el.querySelectorAll("[data-stagger]").forEach(function (g) {
        Array.prototype.forEach.call(g.children, function (ch, i) { ch.style.setProperty("--i", i); });
      });
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.6) el.classList.add("in"); else ro.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }


  /* ---------- expandable timeline rows ---------- */
  document.querySelectorAll(".tl-row.expandable").forEach(function (row) {
    function toggle() {
      var open = !row.classList.contains("open");
      row.classList.toggle("open", open);
      row.setAttribute("aria-expanded", open ? "true" : "false");
    }
    row.addEventListener("click", function (e) { if (e.target.closest("a")) return; toggle(); });
    row.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  /* ---------- San Francisco clock ---------- */
  var clock = document.getElementById("sf-time");
  if (clock) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }); } catch (e) {}
    function tick() { if (fmt) clock.textContent = fmt.format(new Date()) + " PT"; }
    tick(); setInterval(tick, 15000);
  }

  /* ---------- copy email ---------- */
  var toast = document.getElementById("toast");
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(showToast.t); showToast.t = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      function fallback() {
        var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); showToast("Copied " + text); } catch (e) { showToast(text); }
        document.body.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { showToast("Copied " + text); }, fallback);
      } else fallback();
    });
  });
})();
