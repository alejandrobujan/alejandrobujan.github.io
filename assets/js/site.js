(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var lowPower = window.matchMedia("(hover: none), (max-width: 760px)").matches;

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
      if (now - last > (lowPower ? 90 : 40)) { draw(now); last = now; }
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
      N = lowPower ? Math.round(Math.min(34, Math.max(20, area / 22000))) : Math.round(Math.min(90, Math.max(30, area / 16000)));
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
    var lastFrame = 0;
    function loop(now) {
      if (!running) return;
      if (!lowPower || now - lastFrame > 32) { step(); draw(); lastFrame = now; }
      requestAnimationFrame(loop);
    }
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



  /* ---------- intro sequence (home only) ---------- */
  (function () {
    var intro = document.getElementById("intro");
    var heroH1 = document.querySelector(".hero h1");
    if (!intro) return;
    var played = false;
    try { played = sessionStorage.getItem("introPlayed") === "1"; } catch (e) {}
    function skip() { root.classList.remove("intro-on", "landing"); if (intro.parentNode) intro.parentNode.removeChild(intro); }
    if (reduced || played || window.scrollY > 0 || !heroH1) { skip(); return; }
    root.classList.add("intro-on");
    var ih1 = intro.querySelector(".intro-h1");
    var timers = [], phase = 0, fast = false, landed = false;
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function clear() { timers.forEach(clearTimeout); timers = []; }
    function land() {
      if (landed) return; landed = true; clear();
      var k = fast ? 0.32 : 1;
      intro.style.setProperty("--k", k); root.style.setProperty("--k", k);
      intro.classList.add("p1", "p2", "p3");
      // FLIP: map the glyphs of "Alejandro" in the intro onto the same glyphs in the hero title
      function textRect(el) { var r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); }
      var A = textRect(ih1.querySelector(".first")), B = textRect(heroH1.querySelector(".first"));
      var O = ih1.getBoundingClientRect(); // transform origin: top-left of the intro title box
      var s = B.width / A.width;
      var dx = B.left - O.left - (A.left - O.left) * s;
      var dy = B.top - O.top - (A.top - O.top) * s;
      intro.classList.add("landing"); root.classList.add("landing");
      var anim = ih1.animate(
        [{ transform: "translate(0px, 0px) scale(1)" }, { transform: "translate(" + dx + "px, " + dy + "px) scale(" + s + ")" }],
        { duration: 1150 * k, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" });
      anim.onfinish = function () {
        // cross-fade: real title in, clone out, then remove the overlay
        root.classList.add("intro-done");
        root.classList.remove("intro-on", "landing"); root.style.removeProperty("--k");
        intro.classList.add("out");
        setTimeout(function () { if (intro.parentNode) intro.parentNode.removeChild(intro); root.classList.remove("intro-done"); }, 320);
        try { sessionStorage.setItem("introPlayed", "1"); } catch (e) {}
      };
    }
    function accelerate() {
      if (landed) return; fast = true; clear();
      intro.style.setProperty("--k", 0.32);
      intro.classList.add("p1", "p2", "p3");
      setTimeout(land, 260);
    }
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (ev) {
      window.addEventListener(ev, accelerate, { passive: true, once: true });
    });
    at(350, function () { phase = 1; intro.classList.add("p1"); });
    at(1250, function () { phase = 2; intro.classList.add("p2"); });
    at(2350, function () { phase = 3; intro.classList.add("p3"); });
    at(3450, land);
  })();

  /* ---------- hero: glass card at the top, opens up on scroll ---------- */
  var hero = document.querySelector(".hero");
  if (hero) {
    var heroTick = false, heroOpen = false, measureTimer = null, openingTimer = null;
    var heroCopy = hero.querySelector(".hero-copy"), heroVisual = hero.querySelector(".hero-visual");
    function isPhone() { return window.innerWidth <= 960; } // same breakpoint as the CSS: below it the hero is the phone card
    function measure() {
      if (!isPhone() || !heroCopy || !heroVisual) return;
      var h1 = heroCopy.querySelector("h1");
      hero.style.setProperty("--dy", ((h1 ? h1.offsetTop : heroCopy.offsetTop) - heroVisual.offsetTop) + "px");
      hero.style.setProperty("--vh", heroVisual.offsetHeight + "px");
      // closed-card photo: a fixed share of the card's inner width, so it grows with the viewport
      // (the open photo is capped at 520px, so a constant scale would stop growing there)
      var target = 0.32 * (hero.clientWidth - 2 * parseFloat(getComputedStyle(hero).paddingLeft));
      if (heroVisual.offsetWidth) hero.style.setProperty("--sc", Math.min(0.6, target / heroVisual.offsetWidth).toFixed(3));
      // centre the closed card vertically; keep the value fixed afterwards so opening never shifts layout
      if (!heroOpen && window.scrollY < 25) {
        var mt = Math.max(84, Math.round((window.innerHeight - hero.offsetHeight) / 2));
        hero.style.setProperty("--hero-mt", mt + "px");
      }
    }
    function heroUpdate() {
      heroTick = false;
      var p;
      if (isPhone()) {
        // hysteresis so it does not flap around the threshold
        if (!heroOpen && window.scrollY > 70) heroOpen = true;
        else if (heroOpen && window.scrollY < 25) heroOpen = false;
        p = heroOpen ? 1 : 0;
        if (!heroOpen) { clearTimeout(measureTimer); measureTimer = setTimeout(measure, 600); }
        if (heroOpen && root.classList.contains("hero-closed")) {
          root.classList.add("hero-opening");
          clearTimeout(openingTimer); openingTimer = setTimeout(function () { root.classList.remove("hero-opening"); }, 2200);
        }
        if (!heroOpen) { root.classList.remove("hero-opening"); clearTimeout(openingTimer); }
        root.classList.toggle("hero-closed", !heroOpen);
      } else {
        p = Math.min(1, Math.max(0, window.scrollY / 320));
        root.classList.remove("hero-closed");
      }
      hero.style.setProperty("--p", p.toFixed(3));
      hero.classList.toggle("is-card", p < 0.98);
      // floating "scroll" hint: fades out over the first quarter of the opening, then leaves the layer
      root.style.setProperty("--hero-p", p.toFixed(3));
      root.classList.toggle("hint-on", p < 0.25);
    }
    var hint = document.getElementById("scroll-hint");
    if (hint) hint.addEventListener("click", function () {
      var behavior = reduced ? "auto" : "smooth";
      var about = document.getElementById("about");
      // phones: just cross the opening threshold; desktop: land on the first section with the hero open
      if (isPhone() || !about) window.scrollTo({ top: 120, behavior: behavior });
      else about.scrollIntoView({ behavior: behavior, block: "start" });
    });
    window.addEventListener("scroll", function () { if (!heroTick) { heroTick = true; requestAnimationFrame(heroUpdate); } }, { passive: true });
    window.addEventListener("resize", function () { measure(); heroUpdate(); });
    measure(); heroUpdate();
    requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add("ready"); }); });
  }


  /* ---------- holographic word: foil follows the pointer over its card ---------- */
  if (finePointer) {
    document.querySelectorAll(".holo").forEach(function (word) {
      var card = word.closest(".glass, .hero") || word.parentElement;
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        word.style.setProperty("--hx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
        word.style.setProperty("--hy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
      }, { passive: true });
      card.addEventListener("pointerleave", function () { word.style.removeProperty("--hx"); word.style.removeProperty("--hy"); });
    });
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


  /* ---------- demo videos: play only while on screen ---------- */
  var vids = document.querySelectorAll("video[data-inview]");
  if (vids.length && !reduced) {
    if ("IntersectionObserver" in window) {
      var vo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { var pr = en.target.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else en.target.pause();
        });
      }, { threshold: 0.25 });
      vids.forEach(function (v) { vo.observe(v); });
    } else {
      vids.forEach(function (v) { v.autoplay = true; v.play(); });
    }
  }

  /* ---------- live GitHub stars / forks (public API, ETag so repeats don't count) ---------- */
  document.querySelectorAll("[data-gh-repo]").forEach(function (box) {
    var repo = box.getAttribute("data-gh-repo"), key = "gh:" + repo, etag = null;
    function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n); }
    function paint(d) {
      box.querySelectorAll("[data-gh]").forEach(function (el) {
        var n = d[el.getAttribute("data-gh")];
        if (typeof n === "number") el.textContent = fmt(n);
      });
      box.hidden = false;
    }
    try { var c = JSON.parse(sessionStorage.getItem(key)); if (c) { etag = c.etag; paint(c.data); } } catch (e) {}
    function load() {
      if (document.hidden || !window.fetch) return;
      fetch("https://api.github.com/repos/" + repo, { headers: etag ? { "If-None-Match": etag } : {} })
        .then(function (r) {
          if (r.status === 304 || !r.ok) return;
          var tag = r.headers.get("ETag");
          return r.json().then(function (d) {
            var data = { stargazers_count: d.stargazers_count, forks_count: d.forks_count };
            etag = tag; paint(data);
            try { sessionStorage.setItem(key, JSON.stringify({ etag: tag, data: data })); } catch (e) {}
          });
        })
        .catch(function () {});
    }
    load();
    setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
  });

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
  /* ---------- lightbox (award photos) ---------- */
  (function () {
    var photos = Array.prototype.slice.call(document.querySelectorAll(".entry-photo[role=button]"));
    if (!photos.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Photo");
    box.innerHTML =
      '<div class="lb-backdrop"></div>' +
      '<figure class="lb-figure"><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    document.body.appendChild(box);
    var img = box.querySelector("img"), cap = box.querySelector("figcaption");
    var closeBtn = box.querySelector(".lb-close");
    var lastFocus = null;

    function captionFor(fig) {
      var entry = fig.closest(".entry"); if (!entry) return;
      var h = entry.querySelector("h2"), y = entry.querySelector(".year"), o = entry.querySelector(".org");
      cap.textContent = "";
      var t = document.createElement("span"); t.className = "lb-title";
      t.textContent = (y ? y.textContent.trim() + " · " : "") + (h ? h.textContent.trim() : "");
      cap.appendChild(t);
      if (o && o.textContent.trim()) { var sub = document.createElement("span"); sub.className = "lb-sub"; sub.textContent = o.textContent.trim(); cap.appendChild(sub); }
    }
    function show(i) {
      var src = photos[i].querySelector("img");
      img.src = src.currentSrc || src.src; img.alt = src.alt || "";
      captionFor(photos[i]);
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add("open"); root.classList.add("lb-open");
      closeBtn.focus({ preventScroll: true });
    }
    function close() {
      box.classList.remove("open"); root.classList.remove("lb-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    photos.forEach(function (fig, i) {
      fig.addEventListener("click", function () { open(i); });
      fig.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
    });
    closeBtn.addEventListener("click", close);
    box.querySelector(".lb-backdrop").addEventListener("click", close);
    img.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (box.classList.contains("open") && e.key === "Escape") close();
    });
  })();
})();
