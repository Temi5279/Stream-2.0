// stream video player. Used by the watch page and the Live TV page.
(function () {
  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>"; }
  var I = {
    play: svg('<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>'),
    pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>'),
    back10: svg('<path d="M12 5V2L7.5 6 12 10V7a6 6 0 1 1-6 6"/><text x="12" y="17.3" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">10</text>'),
    fwd10: svg('<path d="M12 5V2l4.5 4L12 10V7a6 6 0 1 0 6 6"/><text x="12" y="17.3" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">10</text>'),
    vol: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    mute: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
    fs: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    exit: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>')
  };
  function fmt(s) {
    if (!isFinite(s)) return "0:00"; s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x;
  }

  window.Player = {
    fmt: fmt,
    mount: function (el, o) {
      o = o || {};
      el.classList.add("player");
      if (o.full) el.classList.add("full");
      if (o.live) el.classList.add("live");
      el.innerHTML =
        '<video playsinline preload="metadata"></video>' +
        '<div class="start"><button class="start-btn" aria-label="Play">' + I.play + '</button><p class="start-ttl"></p><p class="start-sub"></p></div>' +
        '<div class="ui">' +
          '<div class="p-top">' + (o.back ? '<a class="p-btn" href="' + o.back + '" aria-label="Back">' + I.back + "</a>" : "") + '<span class="p-title"></span></div>' +
          '<div class="p-mid"><button class="p-btn skip b10" aria-label="Back 10 seconds">' + I.back10 + '</button><button class="p-btn big pp" aria-label="Play">' + I.play + '</button><button class="p-btn skip f10" aria-label="Forward 10 seconds">' + I.fwd10 + "</button></div>" +
          '<div class="p-bot"><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Seek">' +
            '<div class="p-row"><span class="tm">' + (o.live ? '<span class="live-badge">● LIVE</span>' : "0:00 / 0:00") + "</span>" +
            '<span><button class="p-btn sm mute" aria-label="Mute">' + I.vol + '</button><button class="p-btn sm fs" aria-label="Fullscreen">' + I.fs + "</button></span></div></div>" +
        "</div>" +
        '<div class="p-msg" hidden></div>';

      var q = function (s) { return el.querySelector(s); };
      var v = q("video"), ui = q(".ui"), pp = q(".pp"), seek = q(".seek"), tm = q(".tm"), msg = q(".p-msg"),
          start = q(".start"), ttl = q(".p-title"), fsb = q(".fs"), mb = q(".mute");
      var hls = null, hideT, started = false, startAt = 0, dragging = false, lastSave = 0;

      function say(t) { msg.textContent = t || ""; msg.hidden = !t; }
      function show() { ui.classList.add("on"); clearTimeout(hideT); if (!v.paused) hideT = setTimeout(function () { ui.classList.remove("on"); }, 3000); }
      function jump(n) { if (o.live) return; v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + n)); show(); }
      function toggle() { v.paused ? v.play().catch(function () {}) : v.pause(); }
      function save() { if (o.onProgress && v.duration && !o.live) o.onProgress(v.currentTime, v.duration); }
      function enterFull() {
        if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
        else if (v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch (e) {} }
      }
      function begin() { started = true; start.hidden = true; v.play().catch(function () {}); }

      // Fullscreen turns the phone sideways (Android). iPhones do not allow this.
      document.addEventListener("fullscreenchange", function () {
        var on = document.fullscreenElement === el;
        fsb.innerHTML = on ? I.exit : I.fs;
        if (on) { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {}); }
        else if (screen.orientation && screen.orientation.unlock) { try { screen.orientation.unlock(); } catch (e) {} }
      });

      start.addEventListener("click", function () { if (o.fullscreenOnPlay) enterFull(); begin(); });
      pp.addEventListener("click", toggle);
      q(".b10").addEventListener("click", function () { jump(-10); });
      q(".f10").addEventListener("click", function () { jump(10); });
      mb.addEventListener("click", function () { v.muted = !v.muted; mb.innerHTML = v.muted ? I.mute : I.vol; });
      fsb.addEventListener("click", function () { document.fullscreenElement ? document.exitFullscreen() : enterFull(); });

      v.addEventListener("loadedmetadata", function () {
        say("");
        if (startAt > 0 && v.duration && startAt < v.duration - 30) v.currentTime = startAt;
        show();
      });
      v.addEventListener("play", function () { pp.innerHTML = I.pause; pp.setAttribute("aria-label", "Pause"); say(""); show(); });
      v.addEventListener("pause", function () { pp.innerHTML = I.play; pp.setAttribute("aria-label", "Play"); ui.classList.add("on"); save(); });
      v.addEventListener("waiting", function () { say("Buffering…"); });
      v.addEventListener("playing", function () { say(""); });
      v.addEventListener("error", function () { if (!hls) say(o.live ? "This channel isn't available right now." : "This video could not be played."); });
      v.addEventListener("timeupdate", function () {
        if (o.live) return;
        if (!dragging && v.duration) { seek.value = v.currentTime / v.duration * 1000; seek.style.setProperty("--pct", seek.value / 10 + "%"); }
        tm.textContent = fmt(v.currentTime) + " / " + fmt(v.duration);
        if (Date.now() - lastSave > 5000) { lastSave = Date.now(); save(); }
      });
      window.addEventListener("pagehide", save);
      seek.addEventListener("input", function () { dragging = true; seek.style.setProperty("--pct", seek.value / 10 + "%"); tm.textContent = fmt(seek.value / 1000 * v.duration) + " / " + fmt(v.duration); show(); });
      seek.addEventListener("change", function () { v.currentTime = seek.value / 1000 * v.duration; dragging = false; });

      // Tap shows or hides controls. Double tap the left or right side to skip 10 seconds.
      var lastTap = 0, tapT;
      el.addEventListener("click", function (e) {
        if (e.target.closest("button, a, input, .start")) return;
        var now = Date.now();
        if (now - lastTap < 300 && !o.live) { clearTimeout(tapT); var r = el.getBoundingClientRect(); jump(e.clientX - r.left < r.width / 2 ? -10 : 10); }
        else tapT = setTimeout(function () { ui.classList.contains("on") ? ui.classList.remove("on") : show(); }, 300);
        lastTap = now;
      });
      el.addEventListener("mousemove", show);
      if (o.keys) document.addEventListener("keydown", function (e) {
        if (e.code === "Space") { e.preventDefault(); toggle(); }
        else if (e.key === "ArrowLeft") jump(-10);
        else if (e.key === "ArrowRight") jump(10);
        else if (e.key === "f") fsb.click();
        else if (e.key === "m") mb.click();
      });

      return {
        video: v,
        say: say,
        setTitle: function (t) { ttl.textContent = t; q(".start-ttl").textContent = t; },
        setStart: function (t) { q(".start-sub").textContent = t || ""; },
        poster: function (url) { if (url) start.style.backgroundImage = "linear-gradient(rgba(4,10,34,.55), rgba(4,10,34,.85)), url(" + url + ")"; },
        load: function (src, at) {
          startAt = at || 0; say("");
          if (hls) { hls.destroy(); hls = null; }
          if (/\.m3u8(\?|$)/i.test(src) && !v.canPlayType("application/vnd.apple.mpegurl")) {
            if (window.Hls && Hls.isSupported()) {
              hls = new Hls();
              hls.on(Hls.Events.ERROR, function (ev, d) { if (d.fatal) say("This channel couldn't be loaded. It may be offline, or it may not allow other websites to play it."); });
              hls.loadSource(src); hls.attachMedia(v);
            } else { say("This browser can't play live channels."); return; }
          } else { v.src = src; }
          if (started) v.play().catch(function () {});
        }
      };
    }
  };
})();
