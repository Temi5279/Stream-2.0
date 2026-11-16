// Shared helpers for stream: data, profiles, My List, posters and the movie sheet.
(function () {
  var ROOT = new URL(".", document.currentScript.src);
  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function put(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    // Tell the sync layer something changed (profiles, My List or progress)
    var p = k.split(":");
    if (p[0] === "stream-profiles" || p[0] === "stream-list" || p[0] === "stream-progress") {
      if (p[0] !== "stream-progress") {
        var mk = "stream-sync:" + p[1], m = get(mk, { pts: 0, lts: {} });
        if (p[0] === "stream-profiles") m.pts = Date.now(); else { m.lts = m.lts || {}; m.lts[p[2]] = Date.now(); }
        try { localStorage.setItem(mk, JSON.stringify(m)); } catch (e) {}
      }
      window.dispatchEvent(new Event("stream:dirty"));
    }
  }
  function flush() { window.dispatchEvent(new Event("stream:flush")); }
  function uid() { return (window.StreamUser && window.StreamUser.uid) || localStorage.getItem("stream-uid") || "guest"; }
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }

  var AV = ["🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🐯", "🐵", "🐧", "🦉", "🐲", "🐺", "🦋", "🐬", "🐢", "🦖"];
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
      flush();
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
    es.forEach(function (e) { if (e.isIntersecting) { var th = e.target.getAttribute("data-thumb"); if (th) e.target.style.setProperty("--thumb", th); io.unobserve(e.target); } });
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
        '<div class="m-wrap"><div class="m-poster-slot"></div>' +
        '<div class="m-info"><h1>' + esc(m.title) + '</h1>' +
        '<p class="m-meta"><span>' + esc(m.year) + '</span><span>' + esc(m.runtime) + '</span><span>' + esc(m.genre) + '</span>' +
        (m.rating ? '<span class="m-rate">★ ' + esc(m.rating) + ' IMDb</span>' : '') + '</p>' +
        '<div class="ms-actions"><a class="btn" href="' + Stream.watchUrl(id) + '">' + (resume ? "Resume" : "Play") + '</a>' +
        '<button class="btn ghost" type="button" data-list></button><button class="btn ghost" type="button" data-dl></button><button class="btn ghost" type="button" data-share>↗ Share</button></div>' +
        '<p class="m-desc">' + esc(m.description) + '</p>' +
        '<dl class="m-dl">' + (m.director ? '<dt>Director</dt><dd>' + esc(m.director) + '</dd>' : '') +
        (m.cast && m.cast.length ? '<dt>Cast</dt><dd>' + esc(m.cast.join(", ")) + '</dd>' : '') +
        (m.rights ? '<dt>Rights</dt><dd>' + esc(m.rights) + '</dd>' : '') + '</dl>' +
        '<a class="m-src" href="https://archive.org/details/' + encodeURIComponent(id) + '" target="_blank" rel="noopener">View on the Internet Archive</a>' +
        '</div></div>';
      var slot = el.querySelector(".m-poster-slot"); slot.parentNode.replaceChild(posterEl(m, "m-poster", "div", true), slot);
      el.querySelector("[data-share]").onclick = function () {
        var url = Stream.shareUrl(id), data = { title: m.title + " on stream", text: "Watch " + m.title + (m.year ? " (" + m.year + ")" : "") + " free on stream", url: url };
        if (navigator.share) navigator.share(data).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { prompt("Copy this link", url); });
        else prompt("Copy this link", url);
      };
      var lb = el.querySelector("[data-list]");
      function label() { lb.textContent = Stream.mylist.has(id) ? "✓ In My List" : "+ My List"; }
      label();
      lb.onclick = function () { var on = Stream.mylist.toggle(id); label(); toast(on ? "Added to My List" : "Removed from My List"); };
      var db = el.querySelector("[data-dl]");
      if (!Stream.dl.ok) db.hidden = true;
      function dlLabel() { Stream.dl.meta(id).then(function (mm) { db.textContent = !mm ? "⬇ Download" : mm.status === "done" ? "✓ Downloaded" : mm.status === "failed" ? "⬇ Retry download" : "Downloading…"; }); }
      dlLabel();
      db.onclick = function () {
        Stream.dl.meta(id).then(function (mm) {
          if (mm && mm.status === "done") { toast("Already downloaded. Find it in Downloads"); return; }
          if (mm && mm.status !== "failed") { toast("Already downloading. Check Downloads"); return; }
          Stream.dl.start(m).then(function (mode) {
            toast(mode === "background" ? "Download started. You can leave this page." : "Downloading. Keep stream open until it finishes.");
            dlLabel();
          }, function (err) { toast(err && err.message ? err.message : "Couldn't start the download"); });
        });
      };
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

  // First-time profile setup, shown right on top of whatever page the member is on (no redirects)
  function profileSetup() {
    if (document.getElementById("psetup")) return;
    var sel = Math.floor(Math.random() * AV.length);
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
    var wrap = el("div", "psetup"); wrap.id = "psetup";
    var box = el("div", "auth-card glass");
    box.appendChild(el("h1", "", "Create your profile"));
    box.appendChild(el("p", "sub", "Pick an avatar and a name to start watching."));
    var pick = el("div", "pf-pick");
    function draw() {
      pick.innerHTML = "";
      AV.forEach(function (e, i) {
        var b = el("button", "", e); b.type = "button"; b.setAttribute("aria-pressed", i === sel); b.setAttribute("aria-label", "Avatar " + (i + 1));
        b.onclick = function () { sel = i; draw(); }; pick.appendChild(b);
      });
    }
    draw(); box.appendChild(pick);
    var f = el("div", "field"); f.style.marginTop = "18px";
    var lab = el("label", "", "Profile name"); lab.setAttribute("for", "psname");
    var inp = el("input"); inp.id = "psname"; inp.type = "text"; inp.maxLength = 20; inp.autocomplete = "off";
    var dn = window.StreamUser && window.StreamUser.displayName; inp.value = dn ? dn.split(" ")[0] : "";
    f.appendChild(lab); f.appendChild(inp); box.appendChild(f);
    var kl = el("label", "kids-toggle"), kc = el("input"); kc.type = "checkbox";
    kl.appendChild(kc); kl.appendChild(document.createTextNode(" Kids profile (hides horror and 18+ films)")); box.appendChild(kl);
    var msg = el("p", "msg"); box.appendChild(msg);
    var save = el("button", "btn full", "Save and start watching"); save.type = "button";
    save.onclick = function () {
      var name = inp.value.trim();
      if (!name) { msg.textContent = "Please enter a name."; return; }
      Profiles.add({ name: name, a: sel, kids: kc.checked });
      location.reload();
    };
    box.appendChild(save); wrap.appendChild(box); document.body.appendChild(wrap);
    try { inp.focus(); } catch (e) {}
  }

  // ---------- Downloads: saved inside the app only (not as files on the device) ----------
  var DLC = "stream-downloads", inflight = {};
  function dlKey(id) { return new URL("__dl/" + encodeURIComponent(id), ROOT).href; }
  function metaKey(id) { return dlKey(id) + ".json"; }
  function jres(o) { return new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }); }
  function putMeta(c, meta) { return c.put(metaKey(meta.id), jres(meta)); }
  function archiveUrl(id, file) { return "https://archive.org/download/" + encodeURIComponent(id) + "/" + file.split("/").map(encodeURIComponent).join("/"); }
  // Finds the video file and its exact size (the size gives a real percent)
  function pickFile(m) {
    return fetch("https://archive.org/metadata/" + encodeURIComponent(m.id)).then(function (r) { return r.json(); }).then(function (meta) {
      var files = (meta.files || []).filter(function (f) { return /\.(mp4|m4v)$/i.test(f.name) && +f.size > 15e6 && !/sample|trailer/i.test(f.name); });
      var hit = m.file ? files.filter(function (f) { return f.name === m.file; })[0] : null;
      if (!hit) hit = files.sort(function (x, y) { return (x.source === "derivative" ? 0 : 1) - (y.source === "derivative" ? 0 : 1) || +x.size - +y.size; })[0];
      if (!hit) { if (m.file) return { name: m.file, size: 0 }; throw new Error("This film can't be downloaded yet."); }
      return { name: hit.name, size: +hit.size || 0 };
    }, function (err) { if (m.file) return { name: m.file, size: 0 }; throw err; });
  }
  var dl = {
    url: dlKey,
    meta: function (id) {
      return caches.open(DLC).then(function (c) { return c.match(metaKey(id)); }).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
    },
    update: function (meta) { return caches.open(DLC).then(function (c) { return putMeta(c, meta); }); },
    has: function (id) { return dl.meta(id).then(function (m) { return !!(m && m.status === "done"); }); },
    list: function () {
      return caches.open(DLC).then(function (c) {
        return c.keys().then(function (ks) {
          return Promise.all(ks.filter(function (k) { return /\.json$/.test(k.url); }).map(function (k) { return c.match(k).then(function (r) { return r.json(); }); }));
        });
      }).catch(function () { return []; });
    },
    progress: function (m) {
      if (inflight[m.id]) return Promise.resolve({ done: inflight[m.id].done, total: inflight[m.id].total || m.total || 0, state: "downloading" });
      if (!m.bg) return Promise.resolve(null);
      return navigator.serviceWorker.ready.then(function (reg) {
        if (!reg.backgroundFetch) return null;
        return reg.backgroundFetch.get(m.bg).then(function (bf) {
          if (!bf) return null;
          return { done: bf.downloaded, total: bf.downloadTotal || m.total || 0, state: bf.result === "failure" ? "failed" : bf.result === "success" ? "done" : "downloading" };
        });
      }).catch(function () { return null; });
    },
    // Works out why a download failed: "ok" (connection dropped), "blocked" (the Archive refuses apps), "network", "slow"
    diagnose: function (m) {
      if (!m.url) return Promise.resolve("");
      var c1 = new AbortController(), c2 = new AbortController();
      var test = fetch(m.url, { mode: "cors", signal: c1.signal }).then(function (r) { c1.abort(); return r.ok ? "ok" : "status " + r.status; }, function () {
        return fetch(m.url, { mode: "no-cors", signal: c2.signal }).then(function () { c2.abort(); return "blocked"; }, function () { return "network"; });
      });
      return Promise.race([test, new Promise(function (res) { setTimeout(function () { c1.abort(); c2.abort(); res("slow"); }, 15000); })]);
    },
    start: function (m) {
      if (!dl.ok) return Promise.reject(new Error("Downloads aren't available on this device."));
      if (localStorage.getItem("stream-wifi-only") && navigator.connection && navigator.connection.type === "cellular") return Promise.reject(new Error("Wi-Fi only is on. Connect to Wi-Fi to download."));
      var chain = Promise.resolve();
      if (navigator.storage && navigator.storage.estimate) chain = navigator.storage.estimate().then(function (e) {
        if (e.quota && e.quota - e.usage < 700 * 1048576) throw new Error("Not enough free space on this device.");
      });
      return chain.then(function () { return pickFile(m); }).then(function (f) {
        var url = archiveUrl(m.id, f.name), bg = m.id + "~" + Date.now().toString(36);
        var meta = { id: m.id, title: m.title, year: m.year, genre: m.genre, runtime: m.runtime, size: 0, total: f.size, url: url, bg: bg, status: "downloading", ts: Date.now() };
        return caches.open(DLC).then(function (c) {
          return c.delete(dlKey(m.id)).then(function () { return putMeta(c, meta); }).then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
            if (!reg.backgroundFetch) return page(c, m, url, meta);
            return reg.backgroundFetch.fetch(bg, [new Request(url, { mode: "cors" })], {
              title: m.title, icons: [{ src: new URL("icons/icon-192.png", ROOT).href, sizes: "192x192", type: "image/png" }], downloadTotal: f.size || 0
            }).then(function () { return "background"; }, function () { return page(c, m, url, meta); });
          });
        });
      });
    },
    remove: function (id) {
      return dl.meta(id).then(function (meta) {
        if (inflight[id]) { try { inflight[id].ctl.abort(); } catch (e) {} delete inflight[id]; }
        return caches.open(DLC).then(function (c) { return Promise.all([c.delete(dlKey(id)), c.delete(metaKey(id))]); }).then(function () {
          if (!meta || !meta.bg) return;
          return navigator.serviceWorker.ready.then(function (reg) {
            return reg.backgroundFetch ? reg.backgroundFetch.get(meta.bg).then(function (bf) { if (bf) return bf.abort(); }) : null;
          });
        }).catch(function () {});
      });
    }
  };
  // Downloads are not offered on TV browsers
  Object.defineProperty(dl, "ok", { get: function () {
    return "caches" in window && "serviceWorker" in navigator && !document.documentElement.classList.contains("tv");
  } });
  // Fallback for browsers without background downloads: works while stream stays open
  function page(c, m, url, meta) {
    var ctl = new AbortController(); inflight[m.id] = { done: 0, total: meta.total || 0, ctl: ctl };
    fetch(url, { mode: "cors", signal: ctl.signal }).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      inflight[m.id].total = +r.headers.get("content-length") || meta.total || 0;
      var counter = new TransformStream({ transform: function (ch, ctrl) { inflight[m.id].done += ch.byteLength; ctrl.enqueue(ch); } });
      return c.put(dlKey(m.id), new Response(r.body.pipeThrough(counter), { headers: { "Content-Type": r.headers.get("content-type") || "video/mp4" } }));
    }).then(function () {
      meta.status = "done"; meta.size = inflight[m.id].done; return putMeta(c, meta);
    }).catch(function (err) {
      return c.delete(dlKey(m.id)).then(function () {
        if (ctl.signal.aborted) return c.delete(metaKey(m.id));
        meta.status = "failed"; meta.reason = (err && err.message) || "network"; return putMeta(c, meta);
      });
    }).then(function () { delete inflight[m.id]; });
    return "page";
  }

  // ---------- Designed posters (colour by genre, with the film's own frame blended in) ----------
  var PAL = { Horror: ["#b3202a", "#14040a"], Comedy: ["#f5a524", "#a4400c"], "Sci-Fi": ["#14b8a6", "#3b1a8c"], Drama: ["#4a6bff", "#1b1464"], Western: ["#e0701f", "#3d1a05"], Animation: ["#f0489a", "#5b21b6"], Documentary: ["#22b45a", "#053f35"], War: ["#8a9a22", "#18200f"], Romance: ["#e11d74", "#3d0b2a"], Adventure: ["#fb8c1d", "#0b6b66"] };
  function posterEl(m, cls, tag, thumbNow) {
    var pal = PAL[m.genre] || ["#2f4cdd", "#0a1a5c"];
    var d = document.createElement(tag || "div"); d.className = "poster " + (cls || "");
    d.style.setProperty("--c1", pal[0]); d.style.setProperty("--c2", pal[1]);
    var t = "url(" + Stream.thumb(m.id) + ")";
    if (io && !thumbNow) { d.setAttribute("data-thumb", t); io.observe(d); } else d.style.setProperty("--thumb", t);
    if (m.genre) { var g = document.createElement("span"); g.className = "pg"; g.textContent = m.genre; d.appendChild(g); }
    var tt = document.createElement("span"); tt.className = "pt"; tt.textContent = m.title; d.appendChild(tt);
    if (m.year) { var y = document.createElement("small"); y.className = "py"; y.textContent = m.year; d.appendChild(y); }
    return d;
  }

  function reportDialog(what, detail) {
    var reasons = ["It won't play", "No sound or the wrong audio", "Wrong film or channel", "Bad picture or captions", "Something else"], sel = reasons[0];
    var wrap = document.createElement("div"); wrap.className = "dlg";
    var box = document.createElement("div"); box.className = "dlg-box glass"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Report a problem");
    var h = document.createElement("h2"); h.textContent = "Report a problem";
    var p = document.createElement("p"); p.textContent = "What's wrong with " + what + "?";
    var list = document.createElement("div"); list.className = "rs-list";
    function draw() {
      list.innerHTML = "";
      reasons.forEach(function (r) {
        var b = document.createElement("button"); b.type = "button"; b.className = "rsn"; b.textContent = r; b.setAttribute("aria-pressed", r === sel);
        b.onclick = function () { sel = r; draw(); }; list.appendChild(b);
      });
    }
    draw();
    var row = document.createElement("div"); row.className = "dlg-row";
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    var no = document.createElement("button"); no.type = "button"; no.className = "btn ghost"; no.textContent = "Cancel"; no.onclick = close;
    var yes = document.createElement("button"); yes.type = "button"; yes.className = "btn"; yes.textContent = "Send report";
    yes.onclick = function () {
      close();
      location.href = "mailto:support@watchstream.app?subject=" + encodeURIComponent("Problem: " + what) +
        "&body=" + encodeURIComponent("Problem: " + sel + "\n\n" + (detail || "") + "\n\nPage: " + location.href + "\nBrowser: " + navigator.userAgent + "\n\nAnything else you'd like to tell us:\n");
    };
    row.appendChild(no); row.appendChild(yes);
    box.appendChild(h); box.appendChild(p); box.appendChild(list); box.appendChild(row); wrap.appendChild(box); document.body.appendChild(wrap);
  }

  window.Stream = {
    root: ROOT,
    profiles: Profiles,
    toast: toast,
    dl: dl,
    poster: function (m, cls) { return posterEl(m, cls, "div", true); },
    reportDialog: reportDialog,
    shareUrl: function (id) { return new URL("f/" + encodeURIComponent(id) + "/", ROOT).href; },
    requestFilm: function (q) {
      location.href = "mailto:contact@watchstream.app?subject=" + encodeURIComponent("Film request") +
        "&body=" + encodeURIComponent("Film title and year: " + (q || "") + "\nArchive.org link (optional): \n\nThanks!");
    },
    profileSetup: profileSetup,
    openMovie: openMovie,
    movies: function () {
      return fetch(new URL("movies.json", ROOT)).then(function (r) { return r.json(); }).then(function (l) {
        var p = Profiles.active();
        return p && p.kids ? l.filter(function (m) { return m.genre !== "Horror" && !m.mature; }) : l;
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
    clearProgress: function () { put(pkey("progress"), {}); flush(); },
    clearList: function () { put(pkey("list"), []); flush(); },
    card: function (m, pct) {
      var a = posterEl(m, "card", "a");
      a.href = Stream.movieUrl(m.id);
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
