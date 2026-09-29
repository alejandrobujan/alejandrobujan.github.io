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


  /* ---------- node network (pointer-reactive) ---------- */
  (function () {
    var c = document.getElementById("net");
    if (!c || reduced) return;
    var ctx = c.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W, H, nodes = [], N, LINK, mouse = { x: -1e4, y: -1e4, active: false }, running = true;
    var lineRGB = "245, 245, 247", nodeColor = "rgba(245,245,247,.55)";
    function recolor() {
      var cs = getComputedStyle(c);
      lineRGB = cs.getPropertyValue("--net-line").trim() || lineRGB;
      nodeColor = cs.getPropertyValue("--net-node").trim() || nodeColor;
    }
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var area = W * H;
      N = Math.round(Math.min(90, Math.max(30, area / 16000)));
      LINK = W < 760 ? 110 : 150;
      while (nodes.length < N) nodes.push(spawn());
      nodes.length = N;
    }
    function spawn() {
      var a = Math.random() * Math.PI * 2, s = 0.12 + Math.random() * 0.18;
      return { x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.2 + Math.random() * 1.4 };
    }
    function step() {
      var R = 220, R2 = R * R;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (mouse.active) {
          var dx = mouse.x - n.x, dy = mouse.y - n.y, d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 1) {
            var d = Math.sqrt(d2), f = (1 - d / R) * 0.035;
            n.vx += dx / d * f; n.vy += dy / d * f;
          }
        }
        n.vx *= 0.985; n.vy *= 0.985;
        var sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.08) { n.vx *= 1.05 + 0.001; n.vy *= 1.05 + 0.001; }
        if (sp > 1.6) { n.vx *= 0.9; n.vy *= 0.9; }
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var L2 = LINK * LINK;
      ctx.lineWidth = 1;
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var k = i + 1; k < nodes.length; k++) {
          var b = nodes[k];
          var dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          var t = 1 - Math.sqrt(d2) / LINK;
          var boost = 0;
          if (mouse.active) {
            var mx = (a.x + b.x) / 2 - mouse.x, my = (a.y + b.y) / 2 - mouse.y;
            var md = Math.sqrt(mx * mx + my * my);
            if (md < 260) boost = (1 - md / 260) * 0.35;
          }
          ctx.strokeStyle = "rgba(" + lineRGB + "," + (t * 0.16 + boost).toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse.active) {
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j], ex = n.x - mouse.x, ey = n.y - mouse.y, ed = Math.sqrt(ex * ex + ey * ey);
          if (ed < 200) {
            ctx.strokeStyle = "rgba(" + lineRGB + "," + ((1 - ed / 200) * 0.45).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(n.x, n.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = nodeColor;
      for (var m = 0; m < nodes.length; m++) {
        var p = nodes[m], r = p.r;
        if (mouse.active) {
          var qx = p.x - mouse.x, qy = p.y - mouse.y, qd = Math.sqrt(qx * qx + qy * qy);
          if (qd < 200) r += (1 - qd / 200) * 1.6;
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    function loop() { if (!running) return; step(); draw(); requestAnimationFrame(loop); }
    recolor(); size(); requestAnimationFrame(loop);
    window.addEventListener("resize", size);
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    window.addEventListener("pointerleave", function () { mouse.active = false; });
    document.addEventListener("mouseleave", function () { mouse.active = false; });
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden; if (running) requestAnimationFrame(loop);
    });
    var tg = document.getElementById("theme-toggle");
    if (tg) tg.addEventListener("click", function () { setTimeout(recolor, 0); });
  })();


  /* ---------- hero: glass card at the top, opens up on scroll ---------- */
  var hero = document.querySelector(".hero");
  if (hero) {
    var heroTick = false;
    var heroCopy = hero.querySelector(".hero-copy"), heroVisual = hero.querySelector(".hero-visual");
    function heroUpdate() {
      heroTick = false;
      var range = window.innerWidth <= 760 ? 260 : 320;
      var p = Math.min(1, Math.max(0, window.scrollY / range));
      hero.style.setProperty("--p", p.toFixed(3));
      hero.classList.toggle("is-card", p < 0.98);
      if (window.innerWidth <= 760 && heroCopy && heroVisual) {
        // where the photo sits when stacked, so it can be pulled up beside the text
        var h1 = heroCopy.querySelector("h1");
        var dy = (h1 ? h1.offsetTop : heroCopy.offsetTop) - heroVisual.offsetTop;
        hero.style.setProperty("--dy", dy + "px");
        hero.style.setProperty("--vh", heroVisual.offsetHeight + "px");
      }
    }
    window.addEventListener("scroll", function () { if (!heroTick) { heroTick = true; requestAnimationFrame(heroUpdate); } }, { passive: true });
    window.addEventListener("resize", heroUpdate);
    heroUpdate();
  }

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
