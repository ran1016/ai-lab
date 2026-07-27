// =====================================================================
//  AI FUTURE · 交互脚本
//  粒子流 / 鼠标光晕 / 滚动浮现 / AI Stack 径向布点 / 项目 Modal / 移动端导航
// =====================================================================
(function () {
  "use strict";

  /* ---------------- 粒子流（AI 数据传输感，节点缓慢移动+邻近连线） ---------------- */
  (function particles() {
    var canvas = document.getElementById("particles");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h, pts;

    function resize() {
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
      var count = Math.min(120, Math.floor((innerWidth * innerHeight) / 15000));
      pts = [];
      for (var i = 0; i < count; i++) {
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4 * dpr,
          vy: (Math.random() - 0.5) * 0.4 * dpr,
          r: (Math.random() * 2.0 + 0.8) * dpr,
          // 随机初始相位，用于正弦摆动
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function step(t) {
      ctx.clearRect(0, 0, w, h);
      var sec = t * 0.001; // seconds
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        // 基础直线运动
        p.x += p.vx;
        p.y += p.vy;
        // 叠加正弦摆动，让路径更自然
        p.x += Math.sin(sec * 0.5 + p.phase) * 0.15 * dpr;
        p.y += Math.cos(sec * 0.7 + p.phase * 1.3) * 0.15 * dpr;
        // 边界反弹
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        // 靠边后略微弹回画布内
        if (p.x < 10) p.x = 10; if (p.x > w - 10) p.x = w - 10;
        if (p.y < 10) p.y = 10; if (p.y > h - 10) p.y = h - 10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,211,238,0.6)";
        ctx.fill();
      }
      // 邻近连线 — 降低连线阈值使动态更密集
      var maxDist = 100 * dpr;
      for (var a = 0; a < pts.length; a++) {
        for (var b = a + 1; b < pts.length; b++) {
          var dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            var alpha = 0.18 * (1 - d / maxDist);
            // 连线透明度微微呼吸
            alpha *= 0.8 + 0.2 * Math.sin(sec * 0.3 + a + b);
            ctx.beginPath();
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
            ctx.strokeStyle = "rgba(99,102,241," + alpha + ")";
            ctx.lineWidth = dpr * 0.7;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(step);
    }

    resize();
    addEventListener("resize", resize);
    requestAnimationFrame(step);
  })();

  /* ---------------- 鼠标光晕跟随 ---------------- */
  (function cursorGlow() {
    var glow = document.getElementById("cursor-glow");
    if (!glow) return;
    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY; glow.style.opacity = "1";
    });
    addEventListener("mouseleave", function () { glow.style.opacity = "0"; });
    (function loop() {
      x += (tx - x) * 0.12; y += (ty - y) * 0.12;
      glow.style.transform = "translate(" + x + "px," + y + "px)";
      requestAnimationFrame(loop);
    })();
  })();

  /* ---------------- 滚动浮现 ---------------- */
  (function reveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------------- AI Stack 椭圆布点 + 鼠标拖拽旋转 ---------------- */
  (function aiStack() {
    var stack = document.querySelector(".ai-stack");
    if (!stack) return;
    var nodes = Array.from(stack.querySelectorAll(".skill-node"));
    if (!nodes.length) return;

    // 椭圆轨道：水平半径 RX，垂直半径 RY（XY 比例决定扁圆程度）
    var RX = 400, RY = 165;
    var rotation = 0;          // 当前旋转角（弧度，+ 为顺时针）
    var dragging = false;
    var lastX = 0, lastY = 0, lastT = 0;
    var vx = 0;                // 角速度（弧度/毫秒），用于惯性
    var autoRotate = true;     // 空闲时自动慢速旋转
    var autoSpeed = 0.00012;   // 自动旋转角速度（弧度/毫秒） ≈ 6.9°/s
    var interacted = false;    // 用户一旦交互过，就不再自动旋转
    var rafId = null;
    var moved = 0;             // 本次按下累计移动距离，用于区分 click 与 drag

    function render() {
      var n = nodes.length;
      nodes.forEach(function (node, i) {
        var angle = (i / n) * Math.PI * 2 - Math.PI / 2 + rotation;
        // 椭圆参数方程：x = RX·cosθ, y = RY·sinθ
        var x = Math.cos(angle) * RX;
        var y = Math.sin(angle) * RY;
        node.style.transform =
          "translate(-50%,-50%) translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)";
      });
    }

    function tick(now) {
      var dt = lastT ? now - lastT : 16;
      lastT = now;
      if (!dragging) {
        if (Math.abs(vx) > 0.00005) {
          // 惯性：每帧按 vx 推进，vx 指数衰减
          rotation += vx * dt;
          vx *= 0.94;
          render();
        } else if (autoRotate && !interacted) {
          rotation += autoSpeed * dt;
          render();
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function onDown(x, y) {
      if (innerWidth <= 720) return;
      dragging = true;
      moved = 0;
      vx = 0;
      lastX = x; lastY = y; lastT = 0;
      stack.style.cursor = "grabbing";
      stack.setPointerCapture && /* no-op */ 0;
    }
    function onMove(x, y) {
      if (!dragging) return;
      var dx = x - lastX;
      var dy = y - lastY;
      lastX = x; lastY = y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6 && !interacted) interacted = true; // 有实际拖动才标记
      // 水平拖动距离 → 旋转角（系数可调，越大越灵敏）
      var delta = dx * 0.006;
      // 加一点垂直分量，让斜向拖动也有自然反馈
      delta += dy * 0.0015;
      rotation += delta;
      vx = delta; // 记录用于松手后的惯性
      render();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      stack.style.cursor = "grab";
    }

    // 鼠标
    stack.addEventListener("mousedown", function (e) {
      e.preventDefault();
      onDown(e.clientX, e.clientY);
    });
    addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); });
    addEventListener("mouseup", onUp);
    addEventListener("mouseleave", onUp);

    // 触摸
    stack.addEventListener("touchstart", function (e) {
      var t = e.touches[0]; if (!t) return;
      onDown(t.clientX, t.clientY);
    }, { passive: true });
    stack.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      var t = e.touches[0]; if (!t) return;
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    stack.addEventListener("touchend", onUp);
    stack.addEventListener("touchcancel", onUp);

    // 视觉与交互样式
    stack.style.cursor = "grab";
    stack.style.userSelect = "none";
    stack.style.touchAction = "none";
    nodes.forEach(function (n) { n.style.transition = "none"; });

    // 节点 click 与 drag 区分：拖动时阻止 click；非拖动时打开能力详情 Modal
    nodes.forEach(function (n) {
      n.addEventListener("click", function (e) {
        if (moved > 6) { e.preventDefault(); e.stopPropagation(); return; }
        var id = n.getAttribute("data-id");
        if (id && window.SkillModal) window.SkillModal.open(id, n);
      });
    });

    render();
    rafId = requestAnimationFrame(tick);

    addEventListener("resize", function () {
      if (innerWidth > 720) render();
    });
  })();

  /* ---------------- 项目体验 Modal ---------------- */
  (function projectModal() {
    var modal = document.getElementById("project-modal");
    if (!modal) return;
    var titleEl = document.getElementById("modal-title");
    var extEl = document.getElementById("modal-external");
    var frameWrap = document.getElementById("modal-frame-wrap");

    function open(card) {
      var title = card.getAttribute("data-title") || "";
      var iframe = card.getAttribute("data-iframe") || "";
      var external = card.getAttribute("data-external") || "";
      titleEl.textContent = title;
      if (external) { extEl.href = external; extEl.style.display = ""; }
      else { extEl.style.display = "none"; }
      if (iframe) {
        frameWrap.innerHTML = '<iframe src="' + iframe + '" title="' + title + '"></iframe>';
      } else {
        frameWrap.innerHTML = '<p class="modal-note">该项目未配置内嵌演示，请点击上方「打开外部链接」体验。</p>';
      }
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() {
      modal.hidden = true; frameWrap.innerHTML = ""; document.body.style.overflow = "";
    }

    document.querySelectorAll(".open-project").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        open(btn.closest(".project-row") || btn);
      });
    });
    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  })();

  /* ---------------- 自定义视频播放器 ---------------- */
  var SVG_PLAY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';
  var SVG_PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  var SVG_MUTE = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="3,9 9,9 13,5 13,19 9,15 3,15"/></svg>';
  var SVG_UNMUTE = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="3,9 9,9 13,5 13,19 9,15 3,15"/><path d="M16 8 c2 1.5 2 6.5 0 8" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  // 初始化单个视频播放器
  window.initVp = function (vp) {
    var video = vp.querySelector(".vp-video");
    var playBtn = vp.querySelector(".vp-play");
    var progress = vp.querySelector(".vp-progress");
    var progressFill = vp.querySelector(".vp-progress-fill");
    var timeEl = vp.querySelector(".vp-time");
    var muteBtn = vp.querySelector(".vp-mute");
    if (!video || !playBtn) return;

    var src = vp.getAttribute("data-src");
    if (src) video.src = src;

    function setPlayIcon() {
      playBtn.innerHTML = video.paused ? SVG_PLAY : SVG_PAUSE;
      vp.classList.toggle("is-playing", !video.paused);
    }
    function updateTime() {
      timeEl.textContent = fmt(video.currentTime) + " / " + fmt(video.duration);
      if (video.duration) {
        progressFill.style.width = (video.currentTime / video.duration * 100) + "%";
      }
    }

    video.addEventListener("loadedmetadata", updateTime);
    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("play", setPlayIcon);
    video.addEventListener("pause", setPlayIcon);
    video.addEventListener("error", function () { console.warn("视频无法播放:", src); });

    function toggle(e) {
      if (e) e.stopPropagation();
      if (video.paused) {
        video.play().catch(function (err) { console.warn("播放失败:", err); });
      } else { video.pause(); }
    }
    playBtn.addEventListener("click", toggle);
    video.addEventListener("click", toggle);

    progress.addEventListener("click", function (e) {
      e.stopPropagation();
      var rect = progress.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      if (video.duration) video.currentTime = pct * video.duration;
    });

    muteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted ? SVG_MUTE : SVG_UNMUTE;
    });
    muteBtn.innerHTML = video.muted ? SVG_MUTE : SVG_UNMUTE;

    setPlayIcon();
    video.play().catch(function () {});
  };

  // 初始化页面上已有的播放器
  document.querySelectorAll(".vp").forEach(window.initVp);

  /* ---------------- 自定义平滑滚动（丝滑滑入） ---------------- */
  (function smoothScrollNav() {
    var links = document.querySelectorAll('.nav-links a[href^="#"]');
    var duration = 1000; // ms, 比默认 ~300ms 长 3 倍
    var offset = 78;     // 导航栏高度 + 间距余量

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        var href = link.getAttribute("href");
        if (!href || href === "#") return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();

        var startY = window.pageYOffset || document.documentElement.scrollTop;
        var rect = target.getBoundingClientRect();
        var targetY = rect.top + startY - offset;
        var startTime = null;

        // easeInOutQuart: 起止极缓，中间加速，实现"丝滑滑入"感
        function ease(t) {
          return t < 0.5
            ? 8 * t * t * t * t
            : 1 - Math.pow(-2 * t + 2, 4) / 2;
        }

        function step(now) {
          if (startTime === null) startTime = now;
          var elapsed = now - startTime;
          var progress = Math.min(elapsed / duration, 1);
          var p = ease(progress);
          window.scrollTo(0, startY + (targetY - startY) * p);
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    });
  })();

  /* ---------------- 移动端导航 ---------------- */
  (function navToggle() {
    var btn = document.getElementById("nav-toggle");
    var links = document.getElementById("nav-links");
    if (!btn || !links) return;
    btn.addEventListener("click", function () { links.classList.toggle("open"); });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); });
    });
  })();

  /* ---------------- 能力详情 Modal ---------------- */
  window.SkillModal = (function () {
    var modal = document.getElementById("skill-modal");
    if (!modal) return { open: function () {} };
    var empty = modal.querySelector(".sm-empty");
    var contents = Array.prototype.slice.call(modal.querySelectorAll(".sm-content"));

    function open(id, srcNode) {
      // 高亮被点击的节点（短暂抬起）
      if (srcNode) {
        srcNode.classList.add("lifted");
        setTimeout(function () { srcNode.classList.remove("lifted"); }, 700);
      }
      // 隐藏所有内容，显示匹配项
      var hit = null;
      contents.forEach(function (c) {
        if (c.getAttribute("data-id") === String(id)) { c.hidden = false; hit = c; }
        else { c.hidden = true; }
      });
      empty.hidden = !!hit;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() {
      modal.hidden = true;
      document.body.style.overflow = "";
    }

    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });

    return { open: open, close: close };
  })();

  /* ---------------- Evolution / Research 详情 Modal（支持画廊翻页） ---------------- */
  window.ViewModal = (function () {
    var modal = document.getElementById("view-modal");
    if (!modal) return { open: function () {} };
    var titleEl = document.getElementById("vm-title");
    var subtitleEl = document.getElementById("vm-subtitle");
    var mediaEl = document.getElementById("vm-media");
    var descEl = document.getElementById("vm-desc");

    var curMedia = [];
    var curIdx = 0;

    function renderMedia(i) {
      if (!curMedia.length || i < 0 || i >= curMedia.length) {
        mediaEl.innerHTML = "";
        return;
      }
      var m = curMedia[i];
      mediaEl.innerHTML = "";
      var wraper = document.createElement("div");
      wraper.className = "vm-wrap";
      wraper.style.cssText = "position:relative;width:100%;text-align:center;";

      var mediaHtml = '';
      if (m.type === "video") {
        mediaHtml =
          '<div class="vp vp-inline" data-src="' + m.src + '">' +
            '<video class="vp-video" loop muted playsinline preload="metadata"></video>' +
            '<button class="vp-play" type="button" aria-label="play/pause">' + SVG_PLAY + '</button>' +
            '<div class="vp-controls">' +
              '<div class="vp-progress"><div class="vp-progress-fill"></div></div>' +
              '<span class="vp-time">0:00 / 0:00</span>' +
              '<button class="vp-mute" type="button" aria-label="mute/unmute">' + SVG_MUTE + '</button>' +
            '</div>' +
          '</div>';
      } else {
        mediaHtml = '<img src="' + m.src + '" alt="" class="vm-media-el">';
      }

      var navHtml = '';
      if (curMedia.length > 1) {
        navHtml =
          '<button class="vm-arrow vm-prev" type="button" aria-label="上一张">‹</button>' +
          '<button class="vm-arrow vm-next" type="button" aria-label="下一张">›</button>' +
          '<div class="vm-page">' + (i + 1) + ' / ' + curMedia.length + '</div>';
      }

      wraper.innerHTML = mediaHtml + navHtml;
      mediaEl.appendChild(wraper);

      // 初始化视频播放器
      if (m.type === "video") {
        var newVp = wraper.querySelector(".vp");
        if (newVp && window.initVp) setTimeout(function () { window.initVp(newVp); }, 50);
      }
    }

    function renderDesc(raw) {
      if (raw) {
        var html = raw
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br>");
        descEl.innerHTML = html;
        descEl.style.display = "";
      } else {
        descEl.innerHTML = "";
        descEl.style.display = "none";
      }
    }

    // 翻页事件代理
    function onMediaClick(e) {
      var t = e.target;
      if (t.classList.contains("vm-prev") || t.classList.contains("vm-next")) {
        e.stopPropagation();
        if (curMedia.length < 2) return;
        if (t.classList.contains("vm-prev")) curIdx = (curIdx - 1 + curMedia.length) % curMedia.length;
        else curIdx = (curIdx + 1) % curMedia.length;
        renderMedia(curIdx);
      }
    }
    mediaEl.addEventListener("click", onMediaClick);

    // 键盘左右键翻页
    addEventListener("keydown", function (e) {
      if (modal.hidden || curMedia.length < 2) return;
      if (e.key === "ArrowLeft") { curIdx = (curIdx - 1 + curMedia.length) % curMedia.length; renderMedia(curIdx); }
      else if (e.key === "ArrowRight") { curIdx = (curIdx + 1) % curMedia.length; renderMedia(curIdx); }
    });

    function open(btn) {
      var title = btn.getAttribute("data-title") || "";
      var subtitle = btn.getAttribute("data-subtitle") || "";
      var desc = btn.getAttribute("data-desc") || "";

      titleEl.textContent = title;
      subtitleEl.textContent = subtitle;
      subtitleEl.style.display = subtitle ? "" : "none";

      // 解析画廊 data-gallery
      var raw = btn.getAttribute("data-gallery");
      try { curMedia = JSON.parse(raw) || []; } catch (e) { curMedia = []; }
      if (!curMedia.length) {
        var fb = btn.getAttribute("data-media");
        if (fb) curMedia.push({ src: fb, type: btn.getAttribute("data-media-type") || "image" });
      }
      curIdx = 0;
      renderMedia(curIdx);
      renderDesc(desc);

      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() {
      modal.hidden = true;
      var v = mediaEl.querySelector("video");
      if (v) v.pause();
      document.body.style.overflow = "";
    }

    document.querySelectorAll(".open-view").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        open(btn);
      });
    });

    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });

    return { open: open, close: close };
  })();

  /* ---------------- 导航高亮（滚动监听） ---------------- */
  (function navSpy() {
    var sections = ["about", "hobby", "experience", "skill", "project", "note"]
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    var links = document.querySelectorAll(".nav-links a");
    if (!sections.length) return;
    function onScroll() {
      var pos = innerHeight * 0.35, current = "";
      sections.forEach(function (s) {
        if (s.getBoundingClientRect().top <= pos) current = s.id;
      });
      links.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + current);
      });
    }
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  })();
})();
