// =====================================================================
//  AI FUTURE · 交互脚本
//  粒子流 / 鼠标光晕 / 滚动浮现 / AI Stack 径向布点 / 项目 Modal / 移动端导航
// =====================================================================
(function () {
  "use strict";

  /* ---------------- 星空粒子（星光漂浮 + 邻近连线 + 忽明忽暗） ---------------- */
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
      var count = Math.min(1016, Math.floor((innerWidth * innerHeight) / 12000));
      pts = [];
      for (var i = 0; i < count; i++) {
        var size = Math.random();
        pts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.75 * dpr,
          vy: (Math.random() - 0.5) * 0.75 * dpr,
          r: (size < 0.2 ? 1.2 : size < 0.5 ? 1.6 : size < 0.8 ? 2.2 : 3.0) * dpr, // 大小分层
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.3 + Math.random() * 0.8,   // 闪烁速度
          twinklePhase: Math.random() * Math.PI * 2, // 闪烁相位
          // 颜色：大部分青白，少数偏紫
          hue: Math.random() < 0.15 ? 260 : 190,      // 紫 or 青
          sat: Math.random() < 0.7 ? 60 : 30,         // 饱和度微差
        });
      }
    }

    function step(t) {
      ctx.clearRect(0, 0, w, h);
      var sec = t * 0.001;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        // 缓慢漂移
        p.x += p.vx;
        p.y += p.vy;
        // 正弦摆动
        p.x += Math.sin(sec * 0.4 + p.phase) * 0.1 * dpr;
        p.y += Math.cos(sec * 0.6 + p.phase * 1.3) * 0.1 * dpr;
        // 边界反弹
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        if (p.x < 10) p.x = 10; if (p.x > w - 10) p.x = w - 10;
        if (p.y < 10) p.y = 10; if (p.y > h - 10) p.y = h - 10;

        // 忽明忽暗（闪烁）
        var twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(sec * p.twinkleSpeed + p.twinklePhase));
        var alpha = twinkle * 0.75;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + p.hue + "," + p.sat + "%,75%," + alpha + ")";
        ctx.fill();

        // 较大的星星加一点光晕
        if (p.r > 2.0 * dpr) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "hsla(" + p.hue + "," + p.sat + "%,75%,0.06)";
          ctx.fill();
        }
      }
      // 邻近连线 — 更淡的靛蓝，降低存在感
      var maxDist = 80 * dpr;
      for (var a = 0; a < pts.length; a++) {
        for (var b = a + 1; b < pts.length; b++) {
          var dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            var alpha = 0.5 * (1 - d / maxDist);
            alpha *= 0.7 + 0.3 * Math.sin(sec * 0.2 + a + b);
            ctx.beginPath();
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
            ctx.strokeStyle = "rgba(99,102,241," + alpha + ")";
            ctx.lineWidth = dpr * 0.5;
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

  /* ---------------- 角落人物拖动 ---------------- */
  (function mascotDrag() {
    var anchor = document.getElementById("mascot-anchor");
    if (!anchor) return;

    var dragging = false;
    var moved = 0;
    var startX = 0, startY = 0;
    var origLeft = 0, origTop = 0;
    var posKey = "mascot-pos-v1";

    // 还原上次保存的位置
    try {
      var saved = JSON.parse(localStorage.getItem(posKey) || "null");
      if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        anchor.style.left = saved.left + "px";
        anchor.style.top = saved.top + "px";
        anchor.style.bottom = "auto";
        anchor.style.right = "auto";
      }
    } catch (e) {}

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function onDown(cx, cy, e) {
      // 阻止点中输入/按钮内部时的拖动误触发（聊天面板打开时不冲突）
      dragging = true;
      moved = 0;
      var r = anchor.getBoundingClientRect();
      // 转成 left/top 坐标（覆盖 bottom）
      anchor.style.left = r.left + "px";
      anchor.style.top = r.top + "px";
      anchor.style.bottom = "auto";
      anchor.style.right = "auto";
      origLeft = r.left;
      origTop = r.top;
      startX = cx; startY = cy;
      anchor.classList.add("is-dragging");
      if (e && e.cancelable) e.preventDefault();
    }

    function onMove(cx, cy) {
      if (!dragging) return;
      var dx = cx - startX;
      var dy = cy - startY;
      moved += Math.abs(dx) + Math.abs(dy);
      var nx = clamp(origLeft + dx, 0, innerWidth  - anchor.offsetWidth);
      var ny = clamp(origTop  + dy, 0, innerHeight - anchor.offsetHeight);
      anchor.style.left = nx + "px";
      anchor.style.top  = ny + "px";
      origLeft = nx;
      origTop  = ny;
      startX = cx;
      startY = cy;
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      anchor.classList.remove("is-dragging");
      // 记忆位置
      try {
        var rect = anchor.getBoundingClientRect();
        localStorage.setItem(posKey, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (e) {}
    }

    // 鼠标
    anchor.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      onDown(e.clientX, e.clientY, e);
    });
    addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); });
    addEventListener("mouseup", onUp);

    // 触摸
    anchor.addEventListener("touchstart", function (e) {
      var t = e.touches[0]; if (!t) return;
      onDown(t.clientX, t.clientY, e);
    }, { passive: false });
    anchor.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      var t = e.touches[0]; if (!t) return;
      onMove(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    anchor.addEventListener("touchend", onUp);
    anchor.addEventListener("touchcancel", onUp);

    // 拖动结束后，如果移动距离很小，恢复为 click（不阻止聊天面板的 toggle）
    // 拦截 click：仅当真正移动过才阻止默认行为
    anchor.addEventListener("click", function (e) {
      if (moved > 4) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  })();

  /* ---------------- AI 助手聊天面板 ---------------- */
  (function chat() {
    var btn = document.getElementById("mascot-btn");
    var panel = document.getElementById("chat-panel");
    var closeBtn = document.getElementById("chat-close");
    var form = document.getElementById("chat-form");
    var textEl = document.getElementById("chat-text");
    var log = document.getElementById("chat-log");
    var sendBtn = document.getElementById("chat-send-btn");
    if (!btn || !panel || !form || !log) return;

    var history = [];     // [{role, content}, ...]
    var busy = false;

    var anchor = document.getElementById("mascot-anchor");

    function openPanel() {
      panel.hidden = false;
      if (anchor) anchor.classList.add("is-active");
      setTimeout(function () { textEl.focus(); }, 50);
    }
    function closePanel() {
      panel.hidden = true;
      if (anchor) anchor.classList.remove("is-active");
    }
    btn.addEventListener("click", function () {
      if (panel.hidden) openPanel(); else closePanel();
    });
    closeBtn.addEventListener("click", closePanel);
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) closePanel();
    });

    function appendMsg(role, content) {
      var wrap = document.createElement("div");
      wrap.className = "chat-msg " + role;
      var bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.textContent = content;
      wrap.appendChild(bubble);
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return wrap;
    }
    function appendTyping() {
      var wrap = document.createElement("div");
      wrap.className = "chat-msg bot";
      wrap.innerHTML =
        '<div class="chat-bubble"><div class="chat-typing">' +
        '<span></span><span></span><span></span></div></div>';
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return wrap;
    }

    // 自动撑高 textarea
    textEl.addEventListener("input", function () {
      textEl.style.height = "auto";
      textEl.style.height = Math.min(120, textEl.scrollHeight) + "px";
    });
    // Enter 发送，Shift+Enter 换行
    textEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      var msg = (textEl.value || "").trim();
      if (!msg) return;
      textEl.value = "";
      textEl.style.height = "auto";
      appendMsg("user", msg);
      history.push({ role: "user", content: msg });

      busy = true;
      sendBtn.disabled = true;
      sendBtn.textContent = "…";
      var typing = appendTyping();

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: history.slice(-16) }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          typing.remove();
          if (!res.ok) {
            appendMsg("bot", "⚠ " + ((res.body && res.body.error) || "请求失败"));
            return;
          }
          var reply = (res.body && res.body.reply) || "";
          history.push({ role: "assistant", content: reply });
          appendMsg("bot", reply);
        })
        .catch(function (err) {
          typing.remove();
          appendMsg("bot", "⚠ 网络异常：" + (err.message || err));
        })
        .then(function () {
          busy = false;
          sendBtn.disabled = false;
          sendBtn.textContent = "发送";
          textEl.focus();
        });
    });
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

  /* ---------------- AI Stack 椭圆布点 + 鼠标拖拽旋转（多椭圆独立） ---------------- */
  (function aiStack() {
    var stacks = Array.prototype.slice.call(document.querySelectorAll(".ai-stack-grid .ai-stack"));
    if (!stacks.length) return;
    if (innerWidth <= 720) return; // 移动端静态排版，不旋转

    var RX = 120, RY = 150;        // 每个椭圆轨道半径
    var autoSpeed = 0.00012;       // 自动旋转角速度（弧度/毫秒）

    stacks.forEach(function (stack) {
      var nodes = Array.prototype.slice.call(stack.querySelectorAll(".skill-node"));
      var rotation = 0;
      var dragging = false;
      var lastX = 0, lastY = 0, lastT = 0;
      var vx = 0;
      var interacted = false;
      var rafId = null;
      var moved = 0;

      function render() {
        var n = nodes.length;
        nodes.forEach(function (node, i) {
          var angle = (i / n) * Math.PI * 2 - Math.PI / 2 + rotation;
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
            rotation += vx * dt;
            vx *= 0.94;
            render();
          } else if (!interacted) {
            rotation += autoSpeed * dt;
            render();
          }
        }
        rafId = requestAnimationFrame(tick);
      }

      function onDown(x, y) {
        dragging = true;
        moved = 0;
        vx = 0;
        lastX = x; lastY = y; lastT = 0;
        stack.style.cursor = "grabbing";
      }
      function onMove(x, y) {
        if (!dragging) return;
        var dx = x - lastX;
        var dy = y - lastY;
        lastX = x; lastY = y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6 && !interacted) interacted = true;
        var delta = dx * 0.006 + dy * 0.0015;
        rotation += delta;
        vx = delta;
        render();
      }
      function onUp() {
        if (!dragging) return;
        dragging = false;
        stack.style.cursor = "grab";
      }

      stack.addEventListener("mousedown", function (e) {
        e.preventDefault();
        onDown(e.clientX, e.clientY);
      });
      addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); });
      addEventListener("mouseup", onUp);
      addEventListener("mouseleave", onUp);

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

      stack.style.cursor = "grab";
      stack.style.userSelect = "none";
      stack.style.touchAction = "none";
      nodes.forEach(function (n) { n.style.transition = "none"; });

      nodes.forEach(function (n) {
        n.addEventListener("click", function (e) {
          if (moved > 6) { e.preventDefault(); e.stopPropagation(); return; }
          var id = n.getAttribute("data-id");
          if (id && window.SkillModal) window.SkillModal.open(id, n);
        });
      });

      render();
      rafId = requestAnimationFrame(tick);
    });

    addEventListener("resize", function () {
      if (innerWidth > 720) {
        stacks.forEach(function (s) {
          var nodes = s.querySelectorAll(".skill-node");
          var n = nodes.length;
          if (!n) return;
          nodes.forEach(function (node, i) {
            var angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            var x = Math.cos(angle) * RX;
            var y = Math.sin(angle) * RY;
            node.style.transform =
              "translate(-50%,-50%) translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)";
          });
        });
      }
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

  /* ---------------- 项目多图画廊（AI实验项目板块） ---------------- */
  (function projectGallery() {
    document.querySelectorAll(".pg-gallery").forEach(function (g) {
      var total = parseInt(g.getAttribute("data-total")) || 1;
      var cur = 0;
      var slides = g.querySelectorAll(".pg-slide");
      var pageEl = g.querySelector(".pg-page");
      var prevBtn = g.querySelector(".pg-prev");
      var nextBtn = g.querySelector(".pg-next");

      function go(i) {
        cur = (i + total) % total;
        slides.forEach(function (s, idx) { s.classList.toggle("pg-hide", idx !== cur); });
        if (pageEl) pageEl.textContent = (cur + 1) + " / " + total;
        // 切换到新 slide 后，自动初始化新出现的视频播放器
        var curSlide = slides[cur];
        if (curSlide) {
          var newVp = curSlide.querySelector(".vp");
          if (newVp && window.initVp) setTimeout(function () { window.initVp(newVp); }, 50);
        }
      }

      if (prevBtn) prevBtn.addEventListener("click", function (e) { e.stopPropagation(); go(cur - 1); });
      if (nextBtn) nextBtn.addEventListener("click", function (e) { e.stopPropagation(); go(cur + 1); });

      // 初始化当前 slide 视频
      if (slides[0]) {
        var firstVp = slides[0].querySelector(".vp");
        if (firstVp && window.initVp) setTimeout(function () { window.initVp(firstVp); }, 50);
      }
    });
  })();

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
      } else if (m.type === "pdf") {
        mediaHtml = '<div class="vm-pdf"><a href="' + m.src + '" target="_blank" rel="noopener"><span>📄</span><p>打开 PDF 文档</p><small>' + m.src.split("/").pop() + '</small></a></div>';
      } else if (m.type === "ppt") {
        mediaHtml = '<div class="vm-pdf"><a href="' + m.src + '" target="_blank" rel="noopener"><span>📊</span><p>打开 PPT 文档</p><small>' + m.src.split("/").pop() + '</small></a></div>';
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
