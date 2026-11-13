// Shared helpers for stream. Load this on every page that shows movies.
(function () {
  var ROOT = new URL(".", document.currentScript.src);
  var KEY = "stream-progress";

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }

  window.Stream = {
    movies: function () { return fetch(new URL("movies.json", ROOT)).then(function (r) { return r.json(); }); },
    channels: function () { return fetch(new URL("channels.json", ROOT)).then(function (r) { return r.json(); }); },
    movieUrl: function (id) { return new URL("movie/?id=" + encodeURIComponent(id), ROOT).href; },
    thumb: function (id) { return "https://archive.org/services/img/" + encodeURIComponent(id); },
    watchUrl: function (id) { return new URL("watch/?id=" + encodeURIComponent(id), ROOT).href; },
    progress: read,
    save: function (id, t, d) {
      var p = read(); p[id] = { t: t, d: d, ts: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
    },
    card: function (m, pct) {
      var a = document.createElement("a");
      a.className = "card";
      a.href = Stream.movieUrl(m.id);
      a.style.backgroundImage = "linear-gradient(to top, rgba(4,10,34,.92), rgba(4,10,34,0) 55%), url(" + Stream.thumb(m.id) + ")";
      a.style.backgroundSize = "cover";
      a.style.backgroundPosition = "center";
      var s = document.createElement("span"); s.textContent = m.title; a.appendChild(s);
      if (pct) {
        var bar = document.createElement("div"); bar.className = "prog";
        var fill = document.createElement("i"); fill.style.width = pct + "%";
        bar.appendChild(fill); a.appendChild(bar);
      }
      return a;
    }
  };
})();
