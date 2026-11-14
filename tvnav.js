// TV remote navigation: arrow keys jump between cards and menu items, OK opens, Back goes back.
(function () {
  var SEL = "a[href], button:not([disabled]), input, [tabindex]:not([tabindex='-1'])";
  function visible(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none";
  }
  function dist(a, b, dir) {
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    if ((dir === "right" && dx <= 4) || (dir === "left" && dx >= -4) || (dir === "down" && dy <= 4) || (dir === "up" && dy >= -4)) return null;
    var horiz = dir === "left" || dir === "right";
    return (horiz ? Math.abs(dx) : Math.abs(dy)) + (horiz ? Math.abs(dy) : Math.abs(dx)) * 2.5;
  }
  function go(dir) {
    var cur = document.activeElement;
    if (!cur || cur === document.body) {
      var first = document.querySelector("main a, main button, .nav a");
      if (first) first.focus();
      return;
    }
    var a = cur.getBoundingClientRect(), best = null, bd = Infinity;
    Array.prototype.forEach.call(document.querySelectorAll(SEL), function (el) {
      if (el === cur || !visible(el)) return;
      var d = dist(a, el.getBoundingClientRect(), dir);
      if (d !== null && d < bd) { bd = d; best = el; }
    });
    if (best) {
      best.focus();
      try { best.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); } catch (e) { best.scrollIntoView(false); }
    }
  }
  var KEYS = { ArrowRight: "right", ArrowLeft: "left", ArrowDown: "down", ArrowUp: "up" };
  document.addEventListener("keydown", function (e) {
    var t = e.target, typing = t && t.tagName === "INPUT" && /text|search|email|password/.test(t.type);
    var dir = KEYS[e.key] || ({ 39: "right", 37: "left", 40: "down", 38: "up" })[e.keyCode];
    if (dir) {
      if (typing && (dir === "left" || dir === "right")) return;
      e.preventDefault(); go(dir); return;
    }
    // Back button on common TV remotes
    if (!typing && (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack" || e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 4)) {
      if (history.length > 1) { e.preventDefault(); history.back(); }
    }
  });
  setTimeout(function () {
    if (!document.activeElement || document.activeElement === document.body) {
      var f = document.querySelector(".hero .btn, main .card, main a, main button, .nav a");
      if (f) f.focus();
    }
  }, 700);
})();
