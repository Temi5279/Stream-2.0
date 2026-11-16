// stream help assistant. It answers common questions on the device itself:
// nothing typed here is sent anywhere or saved.
(function () {
  var ROOT = new URL(".", document.currentScript.src);
  var data = { movies: [], channels: [] };
  fetch(new URL("movies.json", ROOT)).then(function (r) { return r.json(); }).then(function (m) { data.movies = m; }).catch(function () {});
  fetch(new URL("channels.json", ROOT)).then(function (r) { return r.json(); }).then(function (c) { data.channels = c; }).catch(function () {});

  function norm(s) { return " " + String(s).toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " "; }
  function stem(w) { return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w; }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var CHIPS = ["How does stream work?", "Video won't play", "Live TV channels", "Forgot password"];

  var KB = [
    { k: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "howdy", "sup"], a: "Hi! 👋 What can I help you with?" },
    { k: ["thanks", "thank you", "thx", "appreciate", "cheers"], a: "You're welcome! 😊 Anything else?" },
    { k: ["bye", "goodbye", "see you", "good night", "goodnight"], a: "Bye! Enjoy watching. 🍿" },
    { k: ["who are you", "what are you", "are you a bot", "are you human", "are you real", "who made you", "your name", "are you ai"], a: "I'm Astra, stream's automated help assistant, not a person. I answer questions about stream. For anything else, check the [Help page](help/)." },
    { k: ["help", "need help", "assist", "question"], a: "Sure! What do you need help with? Pick one below or type your question.", chips: CHIPS },
    { k: ["what is stream", "how does it work", "how do i use", "how to use", "dont understand", "confused", "lost", "where do i start", "explain", "get started", "new here", "first time", "what can i do", "what does this do"],
      a: "stream is a free app for classic films and live TV. Use Home to continue watching, [Discover](discover/) to find films, and [Live TV](live/) for channels. Tap a film, press Play, and you're watching." },
    { k: ["free", "cost", "price", "how much", "pay", "paid", "subscription", "subscribe", "charge", "money", "premium", "plan", "plans"], a: "stream is free. You don't pay anything to watch. We may add ads in the future to cover running costs." },
    { k: ["install", "add to home screen", "download app", "apk", "app store", "play store", "get the app", "home screen"], a: "stream is a web app, so there's no app store. On Android: browser menu, then Install app or Add to Home screen. On iPhone: Share, then Add to Home Screen. On a laptop: use the install icon in the address bar." },
    { k: ["sign up", "signup", "create account", "register", "new account", "join", "make an account"], a: "Tap [Get started](signup/), enter your name, date of birth, email and a password, or choose Continue with Google. It takes about a minute." },
    { k: ["forgot password", "forgot my password", "reset password", "lost password", "change password", "password reset", "forgot"], a: "Go to [Sign in](signin/), type your email, and tap Forgot password. We'll email you a reset link (check your spam folder)." },
    { k: ["sign in", "signin", "log in", "login", "cant log in", "cant sign in", "wrong password", "cant login", "password wrong", "invalid"], a: "Check your email and password for typos (tap Show to see the password). If you signed up with Google, use Continue with Google instead. Still stuck? Use Forgot password on the [sign-in page](signin/)." },
    { k: ["google sign in", "continue with google", "gmail", "popup", "pop up"], a: "If the Google window doesn't open, allow pop-ups for this site and try again. Open stream in Chrome or Safari, not inside another app like Instagram." },
    { k: ["delete account", "delete my account", "remove account", "change name", "change email", "change my name", "update profile", "close account", "deactivate"], a: "That isn't available inside the app yet. For now it's handled by request, and contact options are coming soon on the [Help page](help/). Your rights are explained in the [Privacy Policy](privacy/)." },
    { k: ["error", "something went wrong", "failed", "crash", "crashes", "broken", "not loading", "wont load", "white screen"], a: "Sorry about that! Refresh the page. If it keeps happening, close all stream tabs, reopen it and refresh twice. Tell me what you were doing and what you saw.", chips: ["A film won't play", "A channel won't play"] },
    { k: ["channel not working", "channel wont play", "channel offline", "live tv not working", "channel wont load", "channel not playing", "isnt available right now", "channel is blank", "channel blank", "channel doesnt work", "a channel wont play"],
      a: "Live channels come from third parties, so some only work in their own country and some go offline or change address. Try another channel, or come back later. We update the list when we can." },
    { k: ["not playing", "wont play", "cant play", "video", "buffering", "buffer", "loading", "stuck", "freezing", "freeze", "black screen", "blank", "lag", "laggy", "slow", "keeps stopping", "no sound", "no picture", "playback", "film wont play", "a film wont play"],
      a: "Try this: refresh the page, check your connection (Wi-Fi works better than weak data), close other tabs and apps, then try again in a few minutes. Films stream from the Internet Archive and can be slow at busy times. Is it a film or a live channel?", chips: ["A film", "A live channel"] },
    { k: ["a film", "film problem"], a: "For a film: wait a few seconds for it to buffer, then press play again. If it's still stuck, refresh and try again later. Films are large, so a slow connection can take a while." },
    { k: ["a live channel", "live channel problem"], a: "For a live channel: try another channel first. If only one fails, it's probably offline or blocked in your country. Check again later." },
    { k: ["tv", "smart tv", "television", "samsung", "lg", "android tv", "fire tv", "firestick", "roku", "chromecast", "cast"], a: "You can open stream in your TV's web browser. If the menu isn't across the top, add ?tv=1 to the end of the address once and it will remember. Casting from a phone isn't supported yet. If the video stays blank, the TV's browser may be too old." },
    { k: ["captions", "subtitles", "cc", "closed caption", "closed captions", "subtitle", "translate", "translation"], a: "Tap the CC button in the player. It only appears when a channel provides captions. Most films don't have captions yet." },
    { k: ["schedule", "tv guide", "whats on", "program", "programme", "epg", "now playing", "what is on", "on now"], a: "Under the player on [Live TV](live/) you'll see what's on now and next, for channels that have schedule data. Not every channel has one yet." },
    { k: ["continue watching", "resume", "where i stopped", "progress", "history", "pick up", "remember", "watch history"], a: "stream saves your place in each film on the device you're using and shows it under Continue watching on Home. Each profile has its own. It doesn't sync between devices yet, and clearing your browser data removes it." },
    { k: ["movies", "films", "movie", "film", "what can i watch", "whats available", "library", "catalog", "catalogue", "titles", "how many movies", "how many films", "new movies", "new films", "latest", "more movies", "more films", "request", "add movie", "suggest a movie", "do you have"], a: function () {
        var t = data.movies.map(function (m) { return m.title + " (" + m.year + ")"; }).join(", ");
        return "We have " + data.movies.length + " classic films right now: " + (t || "loading…") + ". More are added over time. Film requests are coming soon. Browse them on [Discover](discover/)."; } },
    { k: ["channels", "channel list", "what channels", "which channels", "live tv", "tv channels", "categories", "news channel", "kids channel", "music channel"], a: function () {
        var cats = []; data.channels.forEach(function (c) { if (cats.indexOf(c.category) < 0) cats.push(c.category); });
        return "We have " + data.channels.length + " live channels in these sections: " + (cats.join(", ") || "loading…") + ". Open [Live TV](live/) and use the search box to find one."; } },
    { k: ["sports", "football", "soccer", "fifa", "world cup", "match", "basketball", "racing", "live match", "score"], a: "Open [Live TV](live/) and look in the Sports section (FIFA+, Stadium, Racing.com and Teledeporte). What's showing depends on each channel." },
    { k: ["where do films come from", "where from", "source", "legal", "is it legal", "copyright", "public domain", "internet archive", "pirated", "piracy", "illegal", "dmca", "takedown", "licence", "license", "rights"], a: "Films come from the Internet Archive's public-domain collection, and live channels come from their owners or distributors. We don't host the videos. Read the [Legal notice](legal/), including how to report a copyright issue." },
    { k: ["privacy", "my data", "personal information", "cookies", "cookie", "analytics", "tracking", "safe", "secure", "security", "gdpr", "information"], a: "We use your name, email and date of birth to run your account, and we don't sell your information. Read the [Privacy Policy](privacy/) and [Cookie Policy](cookies/) for details." },
    { k: ["terms", "terms of service", "conditions", "rules", "agreement"], a: "Our [Terms of Service](terms/) explain the rules for using stream." },
    { k: ["contact", "support", "email", "report", "complain", "feedback", "talk to someone", "human", "real person", "admin", "owner", "developer"], a: "Contact options are coming soon on the [Help page](help/). Until then, check the questions there. Most problems are answered." },
    { k: ["ads", "ad", "advert", "advertising", "adverts", "commercials", "sponsor"], a: "stream doesn't show ads right now. We may add some in the future to cover running costs, and we'll update our policies first." },
    { k: ["rotate", "landscape", "sideways", "fullscreen", "full screen", "portrait", "auto rotate"], a: "On Android, fullscreen turns the screen sideways automatically. iPhones don't allow that, so rotate the phone yourself (make sure rotation lock is off)." },
    { k: ["search", "find", "looking for", "where is"], a: "Use the search box on [Discover](discover/) for films and on [Live TV](live/) for channels." },
    { k: ["quality", "hd", "resolution", "720p", "1080p", "4k", "blurry", "pixelated", "low quality"], a: "Quality depends on the source. Films play at the quality the Internet Archive provides, and channels use their own. There's no quality picker yet." },
    { k: ["devices", "device", "phone", "tablet", "laptop", "computer", "ipad", "iphone", "android", "windows", "mac", "browser", "chrome", "safari", "firefox", "which browser"], a: "stream works on phones, tablets, laptops and TV browsers. Chrome gives the best results. Safari on iPhone works too, but can't auto-rotate." },
    { k: ["kids", "children", "child", "age", "how old", "minimum age", "parental", "parent", "family"], a: "You must be 13+ to create an account, and under 18 need a parent's permission. Some classics contain violence or old-fashioned attitudes, so parents should choose what's suitable. Live TV has a Kids section (Spanish and Catalan channels)." },
    { k: ["offline", "works offline", "offline mode", "no internet", "without internet", "no network", "airplane mode", "data usage", "how much data", "use data", "mobile data", "save data"], a: "Your downloaded films play offline, and so do Profile, Settings and Downloads. Home, Live TV and Discover need the internet. A feature film can use several hundred MB, so Wi-Fi is best." },
    { k: ["why sign in", "why account", "need an account", "without account", "without signing in", "skip sign in", "guest"], a: "An account lets us save your details and, soon, sync your progress. It's free and takes about a minute." },
    { k: ["profile", "profiles", "switch profile", "settings", "avatar", "picture", "photo"], a: "Open the [Profile](profile/) tab to switch profiles, add one, manage them or see your My List. App settings are coming soon." },
    { k: ["language", "languages", "german", "french", "spanish", "arabic", "english", "dubbed", "dub"], a: "Channels come in several languages including English, German, French and Spanish. Search for a channel in Live TV, and use CC when captions are available. Most films are in English." }
  ];
  KB.push(
    { k: ["my list", "add to my list", "watchlist", "save film", "save for later", "favorites", "favourites", "bookmark"], a: "Open a film and tap + My List to save it. Your list shows on Home and on your [Profile](profile/). Each profile has its own list." },
    { k: ["switch profile", "change profile", "add profile", "create profile", "new profile", "who is watching", "manage profiles", "another profile", "second profile"], a: "Open [Profile](profile/) to switch profiles, add one (up to 5) or manage them. Each profile keeps its own My List and Continue watching." },
    { k: ["kids mode", "kids profile", "child profile", "kid profile", "parental controls", "parental"], a: "When you create a profile you can mark it as a kids profile. For now it hides horror films, and a full kids design is coming." },
    { k: ["downloads", "download film", "download films", "download a film", "download a movie", "download movies", "can i download", "downloading", "download to watch offline", "save film offline", "offline films", "download"], a: "Open a film and tap Download. Find it under [Downloads](downloads/), and it plays without internet. Downloads are free, stay inside stream, and can't be saved as files. They aren't available in TV browsers. They need free space on your phone, and a film can be several hundred MB." },
    { k: ["sign out", "log out", "logout", "switch account", "different account"], a: "Open [Profile](profile/) and tap Sign out at the bottom." },
    { k: ["what is public domain", "public domain mean", "what does public domain mean"], a: "Public domain means the copyright has ended or never applied, so anyone can share and watch the film freely. In the US, films published in 1930 or earlier are in the public domain. See the [Legal notice](legal/)." },
    { k: ["dark mode", "light mode", "theme", "colour", "color"], a: "stream uses a dark royal-blue look for now. Other themes may come later." },
    { k: ["notification", "notifications", "alerts", "email updates"], a: "stream doesn't send notifications yet." },
    { k: ["data saver", "low data", "weak network", "poor network", "slow internet"], a: "On slow data, films take longer to start. Try Wi-Fi, or press play and let it buffer for a minute." },
    { k: ["astra", "what is astra", "who is astra"], a: "That's me! I'm Astra, stream's automated help assistant. Ask me about accounts, films, live TV, profiles or playback problems." }
  );
  KB.forEach(function (e) { e.nk = e.k.map(norm); });

  function score(e, text, toks) {
    var s = 0;
    e.nk.forEach(function (k) {
      var kt = k.trim();
      if (text.indexOf(k) > -1) { s += 2 + kt.split(" ").length; return; }
      if (kt.indexOf(" ") < 0) {
        var ks = stem(kt);
        for (var i = 0; i < toks.length; i++) {
          if (stem(toks[i]) === ks) { s += 2; return; }
          if (kt.length >= 5 && Math.abs(toks[i].length - kt.length) <= 1 && lev(toks[i], kt) <= 1) { s += 1.5; return; }
        }
      }
    });
    return s;
  }

  var OFF = {
    math: ["Ha, I'm not much of a calculator! 😄 I'm here for stream. Want to find a film or a live channel?"],
    rival: ["I can't speak for other services, so I'll stick to stream: free classic films and live TV. Want to see what's on?"],
    other: ["That's outside what I can help with. I'm just stream's help assistant, so I stick to stream questions. Try asking about films, live channels, your account or playback."]
  };

  function reply(raw) {
    var low = raw.toLowerCase();
    if (/(kill myself|suicide|end my life|want to die|hurt myself|self.?harm)/.test(low))
      return { t: "I'm really sorry you're feeling this way. I'm only a simple help assistant, but you deserve real support. Please talk to someone you trust, or contact your local emergency number or a crisis line in your country. You don't have to go through this alone." };
    if (/(stupid bot|idiot|useless|trash|dumb bot|fuck|shit|bitch|hate you|you suck)/.test(low))
      return { t: "I'm sorry this is frustrating. Tell me what isn't working and I'll do my best to help." , chips: CHIPS };
    var text = norm(raw), toks = text.trim().split(" ").filter(Boolean);
    // Is a film from our list mentioned?
    for (var i = 0; i < data.movies.length; i++) {
      var tt = norm(data.movies[i].title);
      if (tt.trim().length > 3 && text.indexOf(tt) > -1)
        return { t: "Yes! " + data.movies[i].title + " (" + data.movies[i].year + ") is on stream. [Open it](movie/?id=" + encodeURIComponent(data.movies[i].id) + ")" };
    }
    if (/\d+\s*[+\-x×*\/÷]\s*\d+/.test(low) || /(calculate|square root|plus|minus|times)/.test(low)) return { t: pick(OFF.math), chips: CHIPS };
    if (/(netflix|disney|hulu|prime video|amazon prime|hbo|apple tv|peacock|paramount|showmax|dstv|youtube tv|spotify|tiktok|instagram|whatsapp|facebook)/.test(low)) return { t: pick(OFF.rival), chips: CHIPS };
    if (/(joke|weather|president|capital of|recipe|homework|bitcoin|crypto|stock|lottery|girlfriend|boyfriend|marry|meaning of life|favorite|favourite|write (me )?(a|an|some)|poem|sing |sports? score|news today)/.test(low)) return { t: pick(OFF.other), chips: CHIPS };

    var best = null, bs = 0;
    KB.forEach(function (e) { var s = score(e, text, toks); if (s > bs) { bs = s; best = e; } });
    if (best && bs >= 2) return { t: typeof best.a === "function" ? best.a() : best.a, chips: best.chips };
    return { t: "Hmm, I'm not sure I understood that. 🤔 I can help with accounts, films, live TV, playback problems and installing the app. Try one of these, or ask in other words.", chips: CHIPS };
  }

  // ---------- Interface ----------
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function richText(box, s) {
    var re = /\[([^\]]+)\]\(([^)]+)\)/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) box.appendChild(document.createTextNode(s.slice(last, m.index)));
      var a = h("a", "", m[1]); a.href = new URL(m[2], ROOT).href; box.appendChild(a);
      last = re.lastIndex;
    }
    if (last < s.length) box.appendChild(document.createTextNode(s.slice(last)));
  }

  var fab = h("button", "helper-fab glass"); fab.type = "button"; fab.setAttribute("aria-label", "Open help assistant"); fab.textContent = "💬 Help";
  var panel = h("div", "hp glass"); panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Astra, help assistant");
  var head = h("div", "hp-head"), ttl = h("div", ""), close = h("button", "hp-x", "✕");
  ttl.appendChild(h("strong", "", "Astra")); ttl.appendChild(h("small", "", "stream's help assistant. Automated, and nothing you type is sent anywhere."));
  close.type = "button"; close.setAttribute("aria-label", "Close");
  head.appendChild(ttl); head.appendChild(close);
  var msgs = h("div", "hp-msgs"); msgs.setAttribute("aria-live", "polite");
  var chips = h("div", "hp-chips");
  var form = h("form", "hp-form"), input = h("input"), send = h("button", "", "Send");
  input.type = "text"; input.placeholder = "Ask a question…"; input.setAttribute("aria-label", "Your question"); input.autocomplete = "off"; input.maxLength = 200;
  send.type = "submit"; form.appendChild(input); form.appendChild(send);
  panel.appendChild(head); panel.appendChild(msgs); panel.appendChild(chips); panel.appendChild(form);

  function addMsg(text, who) {
    var b = h("div", "hp-m " + who); if (who === "bot") richText(b, text); else b.textContent = text;
    msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight; return b;
  }
  function setChips(list) {
    chips.innerHTML = "";
    (list || []).forEach(function (c) { var b = h("button", "", c); b.type = "button"; b.onclick = function () { ask(c); }; chips.appendChild(b); });
  }
  function ask(text) {
    text = text.trim(); if (!text) return;
    addMsg(text, "user"); setChips([]);
    var typing = addMsg("…", "bot");
    setTimeout(function () {
      var r = reply(text);
      msgs.removeChild(typing); addMsg(r.t, "bot"); setChips(r.chips || CHIPS);
    }, 350);
  }
  var started = false;
  function open() {
    panel.hidden = false; fab.hidden = true;
    if (!started) { started = true; addMsg("Hi! I'm Astra, stream's help assistant 👋 Ask me anything about stream. I'm automated, so I can't help with other topics.", "bot"); setChips(CHIPS); }
    setTimeout(function () { input.focus(); }, 50);
  }
  function shut() { panel.hidden = true; fab.hidden = false; }
  fab.onclick = open; close.onclick = shut;
  form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; ask(v); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) shut(); });
  // No floating button: Astra opens from the Profile page and the Help page.
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(panel); });
  if (document.body) document.body.appendChild(panel);
  window.StreamHelper = { open: open, reply: reply };
})();
