// Sponsored cards and in-video ads for stream are configured in ads.json.
// Test without any ad file: open a film's watch page with &adtest=1 on the end of the address.
// Kids profiles never see ads, and an ad that fails to load never blocks the film.
(function () {
  var ROOT = new URL(".", document.currentScript.src), active = 0;

  var css = document.createElement("style");
  css.textContent =
    ".adlayer{position:absolute;top:0;right:0;bottom:0;left:0;z-index:9;background:#000;color:#fff;display:grid;place-items:center}" +
    ".adlayer video{width:100%;height:100%;object-fit:contain;background:#000}" +
    ".ad-demo{width:100%;height:100%;display:grid;place-content:center;justify-items:center;text-align:center;gap:10px;padding:24px;background:linear-gradient(120deg,#1d3fd8,#7b2ff7,#ff5d8f,#1d3fd8);background-size:300% 300%;animation:adbg 6s linear infinite}" +
    ".ad-demo b{font-size:clamp(1.4rem,5vw,2.4rem)}.ad-demo span{opacity:.9}" +
    "@keyframes adbg{to{background-position:300% 50%}}" +
    ".ad-top{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:14px;right:14px;display:flex;gap:10px;align-items:center}" +
    ".ad-tag{font-size:.75rem;font-weight:800;padding:3px 9px;border-radius:6px;background:#ffd166;color:#2a1250}.ad-name{font-size:.85rem;opacity:.9}" +
    ".ad-bot{position:absolute;left:14px;right:14px;bottom:calc(22px + env(safe-area-inset-bottom,0px));display:flex;justify-content:space-between;gap:10px;align-items:center}" +
    ".ad-visit{padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.5);color:#fff;text-decoration:none;font-weight:700;font-size:.9rem}" +
    ".ad-skip{padding:10px 18px;border-radius:999px;font:inherit;font-weight:700;color:#fff;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.6);cursor:pointer}.ad-skip:disabled{opacity:.7;cursor:default}" +
    ".ad-image{position:absolute;inset:0;display:grid;place-items:center;background:#040a22}.ad-image img{width:100%;height:100%;object-fit:contain}" +
    ".ad-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.25)}.ad-bar i{display:block;height:100%;width:0;background:#ffd166}" +
    ".stream-ad-card{position:relative;overflow:hidden;padding:0!important;align-items:flex-end;text-decoration:none;background:#07112a!important}" +
    ".stream-ad-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#07112a}" +
    ".stream-ad-card:after{content:'';position:absolute;inset:35% 0 0;background:linear-gradient(transparent,rgba(4,10,34,.96));pointer-events:none}" +
    ".stream-ad-card .stream-ad-badge{position:absolute;z-index:1;top:10px;left:10px;padding:4px 8px;border-radius:7px;background:#ffd166;color:#241900;font-size:.7rem;font-weight:800;text-shadow:none}" +
    ".stream-ad-card .stream-ad-info{position:relative;z-index:1;display:grid;gap:4px;padding:12px;width:100%;text-shadow:0 1px 6px rgba(0,0,0,.9)}" +
    ".stream-ad-card .stream-ad-info small{font-size:.72rem;opacity:.9}.stream-ad-card:focus-visible{outline:3px solid #fff;outline-offset:3px}";
  document.head.appendChild(css);

  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function track(name, ad, slot) { try { if (window.gtag) window.gtag("event", name, { ad_id: ad.id, ad_slot: slot }); } catch (e) {} }
  function kidsMode(explicit) {
    if (explicit || document.documentElement.classList.contains("kids")) return true;
    try { return localStorage.getItem("stream-kids") === "1"; } catch (e) { return false; }
  }
  function getAds(test) {
    if (test) return Promise.resolve([{ id: "test-ad", name: "Test ad", demo: true, slots: ["pre", "mid"], skipAfter: 5 }]);
    var request = fetch(new URL("ads.json", ROOT), { cache: "no-store" }).then(function (r) {
      return r.ok ? r.json().then(function (ads) { return Array.isArray(ads) ? ads : []; }) : [];
    }).catch(function () { return []; });
    return Promise.race([request, new Promise(function (resolve) { setTimeout(function () { resolve([]); }, 2000); })]);
  }
  function pickAd(list, slot) {
    var t = today();
    var ok = (list || []).filter(function (a) {
      return (a.src || a.image || a.demo) && (!a.slots || a.slots.indexOf(slot) > -1) && (!a.start || t >= a.start) && (!a.end || t <= a.end);
    });
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }
  function recent() { try { return Date.now() - (+localStorage.getItem("stream-ad-last") || 0) < 600000; } catch (e) { return false; } }

  function playAd(root, ad, slot, done) {
    var layer = document.createElement("div"); layer.className = "adlayer";
    var skipAfter = ad.skipAfter == null ? 5 : +ad.skipAfter, video = null, t0 = Date.now(), finished = false, tick, guard;
    layer.innerHTML = '<div class="ad-top"><span class="ad-tag">Ad · Sponsored</span><span class="ad-name"></span></div>' +
      '<div class="ad-bot"><a class="ad-visit" target="_blank" rel="noopener">Visit site ↗</a><button type="button" class="ad-skip" disabled></button></div><div class="ad-bar"><i></i></div>';
    layer.querySelector(".ad-name").textContent = ad.name || "";
    var visit = layer.querySelector(".ad-visit"), skip = layer.querySelector(".ad-skip"), bar = layer.querySelector(".ad-bar i");
    var link = ad.link || (ad.demo ? new URL("advertise/", ROOT).href : "");
    if (link) {
      visit.href = link; visit.textContent = ad.cta || "Visit site ↗";
      visit.addEventListener("click", function () { track("ad_click", ad, slot); });
    } else visit.style.display = "none";

    function finish() {
      if (finished) return; finished = true; clearInterval(tick); clearTimeout(guard); active--;
      if (video) { try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {} }
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      try { localStorage.setItem("stream-ad-last", String(Date.now())); } catch (e) {}
      done();
    }
    active++;
    layer.addEventListener("click", function (e) { e.stopPropagation(); });
    skip.addEventListener("click", finish);

    var demoLen = (ad.demoSeconds || 8) * 1000, imageLen = (ad.duration || 15) * 1000;
    if (ad.demo) {
      var d = document.createElement("div"); d.className = "ad-demo";
      d.innerHTML = "<b>Your business could be here</b><span>Advertise on stream from just 3 days</span>";
      layer.insertBefore(d, layer.firstChild); track("ad_impression", ad, slot);
    } else if (ad.image) {
      var wrap = document.createElement("div"); wrap.className = "ad-image";
      var img = document.createElement("img"); img.alt = ad.name || "Sponsored ad";
      img.addEventListener("load", function () { clearTimeout(guard); track("ad_impression", ad, slot); }, { once: true });
      img.addEventListener("error", finish, { once: true });
      guard = setTimeout(finish, 9000);
      img.src = new URL(ad.image, ROOT).href;
      wrap.appendChild(img); layer.insertBefore(wrap, layer.firstChild);
    } else {
      video = document.createElement("video"); video.playsInline = true; video.autoplay = true;
      video.src = new URL(ad.src, ROOT).href;
      video.addEventListener("playing", function () { clearTimeout(guard); }, { once: true });
      video.addEventListener("playing", function () { track("ad_impression", ad, slot); }, { once: true });
      video.addEventListener("ended", finish); video.addEventListener("error", finish);
      layer.insertBefore(video, layer.firstChild);
      guard = setTimeout(finish, 9000);   // never leave a viewer stuck on a broken ad
    }
    root.appendChild(layer);
    if (video) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }

    tick = setInterval(function () {
      var el = video ? video.currentTime : (Date.now() - t0) / 1000, len = video ? (video.duration || 0) : (ad.image ? imageLen : demoLen) / 1000;
      if (len) bar.style.width = Math.min(100, el / len * 100) + "%";
      if (!video && el * 1000 >= (ad.image ? imageLen : demoLen)) { finish(); return; }
      if (el >= skipAfter) { skip.disabled = false; skip.textContent = "Skip ad ›"; }
      else skip.textContent = "Skip in " + Math.max(1, Math.ceil(skipAfter - el));
    }, 250);
  }

  function addBanner(container, kids) {
    if (!container || kids) return Promise.resolve();
    return getAds(false).then(function (list) {
      var ad = pickAd(list, "banner");
      if (!ad || !ad.image) return;
      var section = document.createElement("section"); section.className = "row sponsored-row";
      var heading = document.createElement("h2"); heading.textContent = "Sponsored"; section.appendChild(heading);
      var cards = document.createElement("div"); cards.className = "cards";
      var card = document.createElement("a"); card.className = "card stream-ad-card";
      card.href = ad.link || "#"; card.target = "_blank"; card.rel = "noopener noreferrer";
      card.setAttribute("aria-label", "Ad: " + (ad.name || "Sponsored") + (ad.cta ? " — " + ad.cta : ""));
      card.addEventListener("click", function () { track("ad_click", ad, "banner"); });
      var image = document.createElement("img"); image.alt = ""; image.src = new URL(ad.image, ROOT).href;
      image.addEventListener("error", function () { if (section.parentNode) section.parentNode.removeChild(section); }, { once: true });
      var badge = document.createElement("span"); badge.className = "stream-ad-badge"; badge.textContent = "Ad";
      var info = document.createElement("span"); info.className = "stream-ad-info";
      var name = document.createElement("strong"); name.textContent = ad.name || "Sponsored";
      var cta = document.createElement("small"); cta.textContent = ad.cta || "Learn more";
      info.appendChild(name); info.appendChild(cta); card.appendChild(image); card.appendChild(badge); card.appendChild(info); cards.appendChild(card); section.appendChild(cards);
      if (container.firstElementChild && container.firstElementChild.nextSibling) container.insertBefore(section, container.firstElementChild.nextSibling);
      else container.appendChild(section);
      track("ad_impression", ad, "banner");
    }).catch(function () {});
  }

  window.StreamAds = {
    addBanner: addBanner,
    attach: function (pl, root, o) {
      o = o || {};
      if (kidsMode(o.kids) || !pl || !root) return;
      var test = /[?&]adtest=1/.test(location.search), v = pl.video, bypass = false, usedPre = false, shownMid = false;
      var configReady = false, pre = null, mid = null, pendingStart = null;
      var ads = getAds(test);
      // Nothing plays underneath an ad
      v.addEventListener("play", function () { if (active > 0) v.pause(); });
      function start(s) {
        if (pre && (test || !recent())) {
          if (root.requestFullscreen && !document.fullscreenElement) { try { root.requestFullscreen().catch(function () {}); } catch (x) {} }
          playAd(root, pre, "pre", function () { bypass = true; s.click(); bypass = false; });
        } else {
          bypass = true; s.click(); bypass = false;
        }
      }
      // Register immediately so an early tap cannot skip the ad while ads.json is loading.
      root.addEventListener("click", function (e) {
        if (bypass) return;
        var s = e.target.closest && e.target.closest(".start");
        if (!s) return;
        if (usedPre) { e.stopPropagation(); e.preventDefault(); return; }
        e.stopPropagation(); e.preventDefault(); usedPre = true;
        if (!configReady) { pendingStart = s; return; }
        start(s);
      }, true);
      ads.then(function (list) {
        pre = pickAd(list, "pre"); mid = pickAd(list, "mid"); configReady = true;
        if (pendingStart) { var s = pendingStart; pendingStart = null; start(s); }
        if (mid) v.addEventListener("timeupdate", function () {
          if (shownMid || !v.duration || active > 0) return;
          var at = test ? 20 : v.duration * 0.5;
          if (!test && v.duration < 900) return;                 // no mid-roll on films under 15 minutes
          if (v.currentTime >= at && v.currentTime < at + 30 && (o.startAt || 0) < at) {
            shownMid = true; v.pause();
            playAd(root, mid, "mid", function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
          }
        });
      });
    }
  };
})();
