// Opening animation for signed-in members. Plays once per visit (session). Tap to skip.
(function () {
  try {
    if (sessionStorage.getItem("stream-intro")) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  } catch (e) {}

  var css = document.createElement("style");
  css.textContent =
    "#intro{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9999;display:grid;place-items:center;overflow:hidden;" +
    "background:radial-gradient(900px 600px at 50% 45%,#10299e,#040a22 70%);opacity:1;transition:opacity .6s}" +
    "#intro.out{opacity:0;pointer-events:none}" +
    ".in-logo{font:800 clamp(2.6rem,12vw,5.5rem)/1 'Segoe UI',Roboto,system-ui,sans-serif;color:#eaf0ff;letter-spacing:.02em;opacity:0;transform:scale(.8)}" +
    ".in-logo span{color:#5b7dff;display:inline-block}" +
    ".in-sweep{position:absolute;top:56%;left:-40%;width:40%;height:3px;opacity:0;background:linear-gradient(90deg,transparent,#8fa6ff,transparent)}" +
    "#intro.go .in-logo{animation:inLogo 2.4s cubic-bezier(.2,.7,.2,1) forwards}" +
    "#intro.go .in-logo span{animation:inPlay 2.4s ease-in-out forwards}" +
    "#intro.go .in-sweep{animation:inSweep 1.5s .5s ease-in forwards}" +
    "@keyframes inLogo{0%{opacity:0;transform:scale(.8)}30%{opacity:1;transform:scale(1)}75%{opacity:1;transform:scale(1.04)}100%{opacity:0;transform:scale(1.9)}}" +
    "@keyframes inPlay{0%,25%{transform:scale(1);text-shadow:none}45%{transform:scale(1.25);text-shadow:0 0 28px #5b7dff}70%{transform:scale(1);text-shadow:0 0 14px #5b7dff}100%{transform:scale(1.2)}}" +
    "@keyframes inSweep{0%{left:-40%;opacity:0}20%{opacity:1}100%{left:100%;opacity:0}}";
  document.head.appendChild(css);

  var o = document.createElement("div");
  o.id = "intro"; o.setAttribute("aria-hidden", "true");
  o.innerHTML = '<div class="in-logo">str<span>▶</span>eam</div><div class="in-sweep"></div>';
  document.documentElement.appendChild(o);

  var done = false;
  function end() {
    if (done) return; done = true;
    o.classList.add("out");
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); if (css.parentNode) css.parentNode.removeChild(css); }, 700);
  }
  o.addEventListener("click", end);
  setTimeout(end, 7000);

  // guard.js calls this once it knows whether the visitor is signed in
  window.StreamIntro = function (user) {
    if (!user) { end(); return; }
    try { sessionStorage.setItem("stream-intro", "1"); } catch (e) {}
    o.classList.add("go");
    setTimeout(end, 2600);
  };
})();
