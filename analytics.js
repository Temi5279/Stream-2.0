// Google Analytics for stream. It only loads after the visitor taps Accept.
// 1) Create a Google Analytics web data stream for watchstream.app
// 2) Paste its Measurement ID (it looks like G-XXXXXXXXXX) between the quotes below
(function () {
  // Optional: Cloudflare Web Analytics. It counts visits and countries without cookies.
  // Paste the token from Cloudflare (Analytics & Logs, Web analytics) between the quotes.
  var CF_TOKEN = "";
  if (CF_TOKEN) {
    var cf = document.createElement("script"); cf.defer = true;
    cf.src = "https://static.cloudflareinsights.com/beacon.min.js";
    cf.setAttribute("data-cf-beacon", JSON.stringify({ token: CF_TOKEN }));
    document.head.appendChild(cf);
  }

  // Google Tag Manager container (it loads only after the visitor taps Accept)
  var GTM_ID = "GTM-NQ62KTC5";
  var GA_ID = "";
  if (!GA_ID && !GTM_ID) return;

  var KEY = "stream-consent", here = document.currentScript && document.currentScript.src, loaded = false;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });

  function load() {
    if (loaded) return; loaded = true;
    if (GTM_ID) {
      gtag("consent", "update", { analytics_storage: "granted" });
      window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      var g = document.createElement("script"); g.async = true;
      g.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(GTM_ID);
      document.head.appendChild(g);
      // Count visits that come from the installed app (works on Android, iPhone and laptops)
      try {
        var installed = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
        if (installed && !sessionStorage.getItem("stream-pwa-open")) { sessionStorage.setItem("stream-pwa-open", "1"); gtag("event", "pwa_open"); }
      } catch (e) {}
      return;
    }
    gtag("consent", "update", { analytics_storage: "granted" });
    var s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag("js", new Date()); gtag("config", GA_ID);
  }
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (v === "yes") load(); else if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
  }
  window.StreamAnalytics = { get: get, set: set };

  var c = get();
  if (c === "yes") { load(); return; }
  if (c === "no") return;

  function banner() {
    var b = document.createElement("div");
    b.className = "consent glass"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Cookie choices");
    var p = document.createElement("p");
    p.appendChild(document.createTextNode("We use cookies for anonymous analytics to improve stream. "));
    var a = document.createElement("a"); a.textContent = "Cookie Policy"; a.href = here ? new URL("cookies/", here).href : "/cookies/";
    p.appendChild(a);
    var row = document.createElement("div"); row.className = "consent-row";
    function btn(label, cls, val) {
      var x = document.createElement("button"); x.type = "button"; x.className = "btn sm " + cls; x.textContent = label;
      x.onclick = function () { set(val); if (b.parentNode) b.parentNode.removeChild(b); };
      return x;
    }
    row.appendChild(btn("Decline", "ghost", "no")); row.appendChild(btn("Accept", "", "yes"));
    b.appendChild(p); b.appendChild(row); document.body.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();
})();
