// Shared helpers for stream: data, profiles, My List, posters and the movie sheet.
(function () {
  var ROOT = new URL(".", document.currentScript.src);
  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return (window.StreamUser && window.StreamUser.uid) || localStorage.getItem("stream-uid") || "guest"; }
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }

  var AV = ["🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🐯", "🐵"];
  var COL = ["#e5484d", "#30a46c", "#f76b15", "#3e63dd", "#12a594", "#7b2ff7", "#d6409f", "#1d3fd8"];

  // ---------- Profiles (saved on this device for now) ----------
  var Profiles = {
    avatars: AV,
    list: function () { return get("stream-profiles:" + uid(), []); },
    save: function (l) { put("stream-profiles:" + uid(), l); },
    active: function () {
      var l = Profiles.list(), id = localStorage.getItem("stream-active:" + uid());
      return l.filter(function (p) { return p.id === id; })[0] || l[0] || null;
    },
    setActive: function (id) { try { localStorage.setItem("stream-active:" + uid(), id); } catch (e) {} },
    add: function (p) {
      var l = Profiles.list();
      p.id = "p" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
      l.push(p); Profiles.save(l);
      if (l.length === 1) Profiles.setActive(p.id);
      return p;
    },
    update: function (id, ch) {
      var l = Profiles.list();
      l.forEach(function (p) { if (p.id === id) for (var k in ch) p[k] = ch[k]; });
      Profiles.save(l);
    },
    remove: function (id) {
      Profiles.save(Profiles.list().filter(function (p) { return p.id !== id; }));
      try { localStorage.removeItem("stream-progress:" + uid() + ":" + id); localStorage.removeItem("stream-list:" + uid() + ":" + id); } catch (e) {}
      var left = Profiles.list();
      if (left.length) Profiles.setActive(left[0].id);
    },
    avatar: function (p, cls) {
      var d = document.createElement("div");
      d.className = "av " + (cls || "");
      d.style.background = "linear-gradient(160deg," + COL[p.a % COL.length] + ",#040a22)";
      d.textContent = AV[p.a % AV.length];
      return d;
    }
  };
  function pkey(n) { var p = Profiles.active(); return "stream-" + n + ":" + uid() + ":" + (p ? p.id : "default"); }

  // ---------- Posters load as they scroll into view ----------
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.style.backgroundImage = e.target.getAttribute("data-bg"); io.unobserve(e.target); } });
  }, { rootMargin: "300px" }) : null;

  // ---------- Movie sheet: opens inside the app, so the menu stays put ----------
  var sheet = null;
  function closeSheet() {
    if (!sheet) return;
    if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
    sheet = null;
  }
  window.addEventListener("popstate", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheet) history.back(); });

  function toast(t) {
    var el = document.createElement("div"); el.className = "toast glass"; el.textContent = t;
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
  }

  function openMovie(id) {
    Stream.movies().then(function (all) {
      var m = all.filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      closeSheet();
      var s = Stream.progress()[id], resume = s && s.t > 5 && s.t < s.d - 30;
      var thumb = Stream.thumb(id);
      var el = document.createElement("div");
      el.className = "msheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", m.title);
      el.innerHTML =
        '<div class="m-bg" style="background-image:url(' + thumb + ')"></div>' +
        '<button class="ms-close glass" type="button" aria-label="Close">✕</button>' +
        '<div class="m-wrap"><img class="m-poster" src="' + thumb + '" alt="">' +
        '<div class="m-info"><h1>' + esc(m.title) + '</h1>' +
        '<p class="m-meta"><span>' + esc(m.year) + '</span><span>' + esc(m.runtime) + '</span><span>' + esc(m.genre) + '</span>' +
        (m.rating ? '<span class="m-rate">★ ' + esc(m.rating) + ' IMDb</span>' : '') + '</p>' +
        '<div class="ms-actions"><a class="btn" href="' + Stream.watchUrl(id) + '">' + (resume ? "Resume" : "Play") + '</a>' +
        '<button class="btn ghost" type="button" data-list></button></div>' +
        '<p class="m-desc">' + esc(m.description) + '</p>' +
        '<dl class="m-dl">' + (m.director ? '<dt>Director</dt><dd>' + esc(m.director) + '</dd>' : '') +
        (m.cast && m.cast.length ? '<dt>Cast</dt><dd>' + esc(m.cast.join(", ")) + '</dd>' : '') +
        (m.rights ? '<dt>Rights</dt><dd>' + esc(m.rights) + '</dd>' : '') + '</dl>' +
        '<a class="m-src" href="https://archive.org/details/' + encodeURIComponent(id) + '" target="_blank" rel="noopener">View on the Internet Archive</a>' +
        '</div></div>';
      var lb = el.querySelector("[data-list]");
      function label() { lb.textContent = Stream.mylist.has(id) ? "✓ In My List" : "+ My List"; }
      label();
      lb.onclick = function () { var on = Stream.mylist.toggle(id); label(); toast(on ? "Added to My List" : "Removed from My List"); };
      el.querySelector(".ms-close").onclick = function () { history.back(); };
      document.body.appendChild(el);
      sheet = el;
      try { history.pushState({ stream: "movie" }, ""); } catch (e) {}
      var c = el.querySelector(".btn"); if (c) c.focus();
    });
  }

  // Real internet check (the browser's own online flag can be wrong). Slow is not the same as offline.
  function probe() {
    return Promise.race([
      fetch("https://www.gstatic.com/generate_204", { mode: "no-cors", cache: "no-store" }).then(function () { return true; }, function () { return false; }),
      new Promise(function (res) { setTimeout(function () { res(true); }, 8000); })
    ]);
  }
  function offlineView() {
    var main = document.querySelector("main");
    if (!main) return;
    main.innerHTML = '<div class="offline"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M3 3l18 18"/><circle cx="12" cy="20" r="1"/></svg>' +
      '<h2>No internet connection</h2><p>Please try connecting to the internet.</p><button class="btn" type="button" id="retry">Retry</button></div>';
    document.getElementById("retry").onclick = function () { location.reload(); };
    var b = document.getElementById("retry"); if (b) b.focus();
  }

  window.Stream = {
    root: ROOT,
    profiles: Profiles,
    toast: toast,
    openMovie: openMovie,
    movies: function () {
      return fetch(new URL("movies.json", ROOT)).then(function (r) { return r.json(); }).then(function (l) {
        var p = Profiles.active();
        return p && p.kids ? l.filter(function (m) { return m.genre !== "Horror"; }) : l;
      });
    },
    channels: function () { return fetch(new URL("channels.json", ROOT)).then(function (r) { return r.json(); }); },
    epg: function () { return fetch(new URL("epg.json", ROOT)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); },
    movieUrl: function (id) { return new URL("movie/?id=" + encodeURIComponent(id), ROOT).href; },
    thumb: function (id) { return "https://archive.org/services/img/" + encodeURIComponent(id); },
    watchUrl: function (id) { return new URL("watch/?id=" + encodeURIComponent(id), ROOT).href; },
    whenUser: function (cb) {
      var done = false;
      function go() { if (done) return; done = true; cb(); }
      if (window.StreamUser !== undefined) return go();
      window.addEventListener("stream:user", go);
      setTimeout(go, 3000);
    },
    progress: function () {
      var k = pkey("progress"), d = get(k, null);
      if (d === null) {
        var legacy = get("stream-progress", null);
        if (legacy && Profiles.list().length <= 1) { put(k, legacy); return legacy; }
        return {};
      }
      return d;
    },
    save: function (id, t, d) {
      var p = Stream.progress(); p[id] = { t: t, d: d, ts: Date.now() };
      put(pkey("progress"), p);
    },
    mylist: {
      ids: function () { return get(pkey("list"), []); },
      has: function (id) { return Stream.mylist.ids().indexOf(id) > -1; },
      toggle: function (id) {
        var l = Stream.mylist.ids(), i = l.indexOf(id);
        if (i > -1) l.splice(i, 1); else l.unshift(id);
        put(pkey("list"), l); return i < 0;
      }
    },
    // Home, Live TV and Discover need the internet. Offline, they show a retry screen instead.
    guardOnline: function (init) {
      window.addEventListener("offline", offlineView);
      window.addEventListener("online", function () { if (document.querySelector(".offline")) location.reload(); });
      if (navigator.onLine === false) { offlineView(); return; }
      init();
      probe().then(function (ok) { if (!ok) offlineView(); });
    },
    offlineView: offlineView,
    clearProgress: function () { put(pkey("progress"), {}); },
    clearList: function () { put(pkey("list"), []); },
    card: function (m, pct) {
      var a = document.createElement("a");
      a.className = "card";
      a.href = Stream.movieUrl(m.id);
      var bg = "linear-gradient(to top, rgba(4,10,34,.92), rgba(4,10,34,0) 55%), url(" + Stream.thumb(m.id) + ")";
      if (io) { a.setAttribute("data-bg", bg); io.observe(a); } else a.style.backgroundImage = bg;
      a.style.backgroundSize = "cover";
      a.style.backgroundPosition = "center";
      var s = document.createElement("span"); s.textContent = m.title; a.appendChild(s);
      if (pct) {
        var bar = document.createElement("div"); bar.className = "prog";
        var fill = document.createElement("i"); fill.style.width = pct + "%";
        bar.appendChild(fill); a.appendChild(bar);
      }
      a.addEventListener("click", function (e) {
        if (a.getAttribute("data-nosheet") || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault(); openMovie(m.id);
      });
      return a;
    }
  };
})();
