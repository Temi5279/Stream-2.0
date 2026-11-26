// Load analytics (it stays off until a Measurement ID is set and the visitor accepts)
(function () {
  var s = document.createElement("script"); s.async = true;
  s.src = new URL("analytics.js", document.currentScript.src).href;
  document.head.appendChild(s);
})();

// TV mode: top navigation bar and larger controls. Open the site once with ?tv=1 to turn it on (?tv=0 turns it off).
(function () {
  var here = document.currentScript && document.currentScript.src;
  try {
    var q = new URLSearchParams(location.search).get("tv");
    if (q === "1") localStorage.setItem("stream-tv", "1");
    if (q === "0") localStorage.removeItem("stream-tv");
    var onTV = localStorage.getItem("stream-tv") === "1" ||
      /SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT[A-Z]|GoogleTV|Android.*TV|CrKey|HbbTV|Roku|VIDAA|Leanback/i.test(navigator.userAgent);
    if (onTV) {
      document.documentElement.classList.add("tv");
      Array.prototype.forEach.call(document.querySelectorAll('.nav a[href$="downloads/"]'), function (a) { var li = a.parentNode; if (li && li.parentNode) li.parentNode.removeChild(li); });
      if (here) {
        var s = document.createElement("script");
        s.src = new URL("tvnav.js", here).href; s.async = false; s.onload = function () { window.dispatchEvent(new Event("stream:tv-ready")); };
        document.head.appendChild(s);
      }
    }
  } catch (e) {}
})();

// Registers the service worker and shows an "Install app" button when the browser allows it.
(function () {
  var base = document.currentScript.src;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(new URL("sw.js", base)).catch(function () {});
    });
  }

  var saved = null;
  var btn = document.createElement("button");
  btn.className = "install-btn glass";
  btn.textContent = "Install app";
  btn.hidden = true;
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(btn); });

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    saved = e;
    btn.hidden = false;
  });
  btn.addEventListener("click", function () {
    if (!saved) return;
    saved.prompt();
    saved.userChoice.then(function () { saved = null; btn.hidden = true; });
  });
  window.addEventListener("appinstalled", function () {
    btn.hidden = true;
    try { if (window.gtag) window.gtag("event", "pwa_install"); } catch (e) {}
  });
})();
