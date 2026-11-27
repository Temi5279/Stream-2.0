// Ads for stream.
//  1) Video ads: one before a film and one in the middle (slots "pre" and "mid").
//  2) Poster-style "banner" ads: a card that sits inside the film rows on Home and Discover, labelled AD.
// Ads live in ads.json (an empty list means no ads). Examples:
//   Video:  { "id": "bakery-nov", "name": "Ada's Bakery", "src": "ads/bakery.mp4", "link": "https://example.com",
//             "start": "2026-11-25", "end": "2026-12-01", "slots": ["pre", "mid"], "skipAfter": 5 }
//   Banner: { "type": "banner", "id": "bakery-card", "name": "Ada's Bakery", "headline": "Fresh bread every morning", "cta": "Order now",
//             "color1": "#ff5d8f", "color2": "#ffb703", "image": "ads/bakery-card.jpg", "link": "https://example.com",
//             "start": "2026-11-25", "end": "2026-12-01", "where": ["home", "discover"] }
//   ("image" is optional. Without it the card is built from the name, headline and colours.)
// Test with no ad files: add &adtest=1 to a film's watch address, or to the Home or Discover address.
// Kids profiles never see ads. An ad that fails to load never blocks anything.
(function () {
  var ROOT = new URL(".", document.currentScript.src), active = 0, adsP = null;

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
    ".ad-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.25)}.ad-bar i{display:block;height:100%;width:0;background:#ffd166}" +
    /* poster-style ad card */
    ".adcard{text-decoration:none;color:#fff}.adcard::after{display:none}" +
    ".adcard .pg{background:#ffd166;color:#2a1250;border:0;font-weight:800}" +
    ".adcard .ad-head{position:absolute;z-index:1;left:15px;right:13px;top:46px;font-size:.8rem;line-height:1.3;font-weight:600;text-shadow:0 2px 8px rgba(0,0,0,.6)}" +
    ".adcard .py{opacity:1;font-weight:700;letter-spacing:.04em}" +
    ".adcard .sp{position:absolute;z-index:1;right:12px;bottom:11px;font-size:.55rem;letter-spacing:.12em;opacity:.85}" +
    ".adcard.img{background-image:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,0) 55%),var(--thumb);background-blend-mode:normal}";
  document.head.appendChild(css);

  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function track(name, ad, slot) { try { if (window.gtag) window.gtag("event", name, { ad_id: ad.id, ad_slot: slot }); } catch (e) {} }
  function isTest() { return /[?&]adtest=1/.test(location.search); }
  function kidsOn() { return !!(window.Stream && Stream.isKids && Stream.isKids()); }
  function getAds() {
    if (adsP) return adsP;
    if (isTest()) {
      adsP = Promise.resolve([
        { id: "test-ad", name: "Test ad", demo: true, slots: ["pre", "mid"], skipAfter: 5 },
        { type: "banner", id: "test-card-1", name: "Test Bakery", headline: "Fresh bread every morning", cta: "Order now", color1: "#ff5d8f", color2: "#ffb703", where: ["home", "discover"] },
        { type: "banner", id: "test-card-2", name: "Your business", headline: "This spot could be yours", cta: "Advertise ›", color1: "#1d3fd8", color2: "#7b2ff7", link: new URL("advertise/", ROOT).href, where: ["home", "discover"] }
      ]);
    } else adsP = fetch(new URL("ads.json", ROOT), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    return adsP;
  }
  function inWindow(a) { var t = today(); return (!a.start || t >= a.start) && (!a.end || t <= a.end); }
  function pickAd(list, slot) {
    var ok = (list || []).filter(function (a) { return a.type !== "banner" && (a.src || a.demo) && (!a.slots || a.slots.indexOf(slot) > -1) && inWindow(a); });
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }
  function recent() { try { return Date.now() - (+localStorage.getItem("stream-ad-last") || 0) < 600000; } catch (e) { return false; } }

  // ---------- poster-style card ----------
  function adCard(ad, where) {
    var a = document.createElement("a"); a.className = "card poster adcard" + (ad.image ? " img" : "");
    a.href = ad.link || "#"; a.target = "_blank"; a.rel = "noopener sponsored"; a.setAttribute("aria-label", "Ad: " + (ad.name || ""));
    a.style.setProperty("--c1", ad.color1 || "#ff5d8f"); a.style.setProperty("--c2", ad.color2 || "#7b2ff7");
    if (ad.image) a.style.setProperty("--thumb", "url(" + new URL(ad.image, ROOT).href + ")");
    function add(tag, cls, txt) { var e = document.createElement(tag); e.className = cls; e.textContent = txt; a.appendChild(e); }
    add("span", "pg", "AD");
    if (ad.headline) add("span", "ad-head", ad.headline);
    add("span", "pt", ad.name || "");
    add("small", "py", (ad.cta || "Learn more") + (/[›>]$/.test(ad.cta || "") ? "" : " ›"));
    add("span", "sp", "SPONSORED");
    a.addEventListener("click", function () { track("ad_click", ad, "card-" + where); });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { track("ad_impression", ad, "card-" + where); io.disconnect(); } }); }, { threshold: 0.6 });
      io.observe(a);
    }
    return a;
  }
  // spots: [{ c: container, i: position }]
  function placeNative(where, spots) {
    if (kidsOn()) return Promise.resolve();
    return getAds().then(function (list) {
      var cards = (list || []).filter(function (a) { return a.type === "banner" && inWindow(a) && (!a.where || a.where.indexOf(where) > -1); });
      if (!cards.length) return;
      cards.sort(function () { return Math.random() - 0.5; });
      var k = 0;
      spots.filter(function (s) { return s.c; }).map(function (s) { return { c: s.c, i: s.i, ad: cards[k++ % cards.length] }; })
        .sort(function (a, b) { return b.i - a.i; })   // insert the later spots first so earlier ones don't shift
        .forEach(function (s) {
          var kids = s.c.children; if (s.i > kids.length) return;
          s.c.insertBefore(adCard(s.ad, where), kids[s.i] || null);
        });
    });
  }

  // ---------- video ads ----------
  function playAd(root, ad, slot, done) {
    var layer = document.createElement("div"); layer.className = "adlayer";
    var skipAfter = ad.skipAfter == null ? 5 : +ad.skipAfter, video = null, t0 = Date.now(), finished = false, tick, guard;
    layer.innerHTML = '<div class="ad-top"><span class="ad-tag">Ad · Sponsored</span><span class="ad-name"></span></div>' +
      '<div class="ad-bot"><a class="ad-visit" target="_blank" rel="noopener">Visit site ↗</a><button type="button" class="ad-skip" disabled></button></div><div class="ad-bar"><i></i></div>';
    layer.querySelector(".ad-name").textContent = ad.name || "";
    var visit = layer.querySelector(".ad-visit"), skip = layer.querySelector(".ad-skip"), bar = layer.querySelector(".ad-bar i");
    var link = ad.link || (ad.demo ? new URL("advertise/", ROOT).href : "");
    if (link) { visit.href = link; visit.addEventListener("click", function () { track("ad_click", ad, slot); }); } else visit.style.display = "none";

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

    var demoLen = (ad.demoSeconds || 8) * 1000;
    if (ad.demo) {
      var d = document.createElement("div"); d.className = "ad-demo";
      d.innerHTML = "<b>Your business could be here</b><span>Advertise on stream from just 3 days</span>";
      layer.insertBefore(d, layer.firstChild); track("ad_impression", ad, slot);
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
      var el = video ? video.currentTime : (Date.now() - t0) / 1000, len = video ? (video.duration || 0) : demoLen / 1000;
      if (len) bar.style.width = Math.min(100, el / len * 100) + "%";
      if (!video && el * 1000 >= demoLen) { finish(); return; }
      if (el >= skipAfter) { skip.disabled = false; skip.textContent = "Skip ad ›"; }
      else skip.textContent = "Skip in " + Math.max(1, Math.ceil(skipAfter - el));
    }, 250);
  }

  window.StreamAds = {
    placeNative: placeNative,
    attach: function (pl, root, o) {
      o = o || {};
      if (o.kids || !pl || !root) return;
      var test = isTest(), v = pl.video, bypass = false, usedPre = false, shownMid = false;
      v.addEventListener("play", function () { if (active > 0) v.pause(); });   // nothing plays underneath an ad
      getAds().then(function (list) {
        var pre = pickAd(list, "pre"), mid = pickAd(list, "mid");
        if (pre && (test || !recent())) {
          // The first tap on Play runs the ad, then the film starts
          root.addEventListener("click", function (e) {
            if (bypass || usedPre) return;
            var s = e.target.closest && e.target.closest(".start");
            if (!s) return;
            e.stopPropagation(); e.preventDefault(); usedPre = true;
            if (root.requestFullscreen && !document.fullscreenElement) { try { root.requestFullscreen().catch(function () {}); } catch (x) {} }
            playAd(root, pre, "pre", function () { bypass = true; s.click(); bypass = false; });
          }, true);
        }
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
