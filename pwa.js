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
  window.addEventListener("appinstalled", function () { btn.hidden = true; });
})();
