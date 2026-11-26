(function () {
  var SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var focused = null;

  function visible(el) {
    var rect = el.getBoundingClientRect(), style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" &&
      !el.closest("[hidden], [aria-hidden='true']");
  }

  function focusable() {
    return Array.prototype.filter.call(document.querySelectorAll(SELECTOR), visible);
  }

  function focus(el) {
    if (!el) return;
    if (focused) focused.classList.remove("tv-focused");
    focused = el;
    focused.classList.add("tv-focused");
    try { focused.focus({ preventScroll: true }); } catch (e) { focused.focus(); }
    if (focused.scrollIntoView) {
      try { focused.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); }
      catch (e) { focused.scrollIntoView(); }
    }
  }

  function direction(key, code) {
    if (key === "ArrowLeft" || key === "Left" || code === 37 || code === 21) return "left";
    if (key === "ArrowRight" || key === "Right" || code === 39 || code === 22) return "right";
    if (key === "ArrowUp" || key === "Up" || code === 38 || code === 19) return "up";
    if (key === "ArrowDown" || key === "Down" || code === 40 || code === 20) return "down";
    return "";
  }

  function nextElement(dir, elements) {
    if (!elements.length) return null;
    var current = focused && elements.indexOf(focused) > -1 ? focused :
      (elements.indexOf(document.activeElement) > -1 ? document.activeElement :
        document.querySelector('.nav a[aria-current="page"]'));
    if (!current || elements.indexOf(current) < 0) current = elements[0];
    if (!focused) { focused = current; focused.classList.add("tv-focused"); }

    var a = current.getBoundingClientRect();
    var ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, score = Infinity;
    elements.forEach(function (el) {
      if (el === current) return;
      var r = el.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      if ((dir === "right" && dx <= 10) || (dir === "left" && dx >= -10) ||
          (dir === "down" && dy <= 10) || (dir === "up" && dy >= -10)) return;
      var candidate = (dir === "left" || dir === "right")
        ? Math.abs(dx) + Math.abs(dy) * 3.5
        : Math.abs(dy) + Math.abs(dx) * 2.5;
      if (candidate < score) { score = candidate; best = el; }
    });
    return best || current;
  }

  document.addEventListener("keydown", function (e) {
    var dir = direction(e.key, e.keyCode || e.which);
    if (dir) {
      if (document.activeElement && document.activeElement.tagName === "INPUT" &&
          (dir === "left" || dir === "right")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      focus(nextElement(dir, focusable()));
      return;
    }

    if ((e.key === "Enter" || e.keyCode === 23) && e.keyCode === 23) {
      if (focused) { e.preventDefault(); e.stopImmediatePropagation(); focused.click(); }
      return;
    }
    if ((e.key === "Escape" || e.key === "Back" || e.keyCode === 461 || e.keyCode === 10009) &&
        !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))) {
      e.preventDefault();
      if (window.history.length > 1) window.history.back();
    }
  }, true);

  document.addEventListener("focusin", function (e) {
    if (e.target.matches && e.target.matches(SELECTOR)) {
      if (focused && focused !== e.target) focused.classList.remove("tv-focused");
      focused = e.target; focused.classList.add("tv-focused");
    }
  });

  document.addEventListener("pointerdown", function () {
    if (focused) focused.classList.remove("tv-focused");
    focused = null;
  });
})();
