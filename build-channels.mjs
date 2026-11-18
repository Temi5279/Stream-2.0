// Builds channels.json from the playlists in scripts/channel-sources.txt.
// It keeps only streams that work in a web browser, and leaves out streams from aggregators and free-TV services.
import fs from "node:fs";

const ORIGIN = "https://watchstream.app";
const COUNTRIES = ["USA", "UK", "Canada", "Australia", "Ireland", "Germany", "France", "Spain"];
const MAX_PER_CAT = 15, MAX_TOTAL = 150;
// Hosts that resell, restream or require a login. We do not use them.
const BLOCK = ["pluto.tv", "wurl.com", "samsung", "amagi", "warnermediacdn", "tntendirect", "bozztv", "mjh.nz", "iptvcat", "data-stream", "dai.google", "youtube", "youtu.be", "twitch.tv", "akamaized.net/hls/live/2015525-b"];
const SYMBOLS = /[ⓎⒼⓈⒹ]/g;

const sources = fs.readFileSync("scripts/channel-sources.txt", "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
const log = [];
const say = (s) => { console.log(s); log.push(s); };

function parse(text) {
  const lines = text.split("\n").map((l) => l.trim()), out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXTINF")) continue;
    const attrs = {}; for (const m of lines[i].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
    let j = i + 1; while (j < lines.length && lines[j].startsWith("#")) j++;
    out.push({ rawName: lines[i].split(",").pop().trim(), group: attrs["group-title"] || "", logo: attrs["tvg-logo"] || "", tvg: attrs["tvg-id"] || "", url: lines[j] || "" });
  }
  return out;
}
function category(c) {
  const t = (c.name + " " + c.group).toLowerCase();
  if (/news|info|journal|tagesschau|welt\b|cnn|bbc world|euronews|france 24|dw\b/.test(t)) return "News";
  if (/sport|racing|football|soccer|motor|stadium|tennis|golf|cricket/.test(t)) return "Sports";
  if (/music|mtv|deluxe|hits|vh1|radio|schlager|lounge/.test(t)) return "Music";
  if (/kids|junior|cartoon|clan|super3|disney|boomerang|nick/.test(t)) return "Kids";
  if (/doc|nature|science|nasa|discovery|history|geo|planet|space/.test(t)) return "Docs & Science";
  return COUNTRIES.includes(c.group) ? c.group : null;
}

const get = (url, headers = {}) => fetch(url, { headers: Object.assign({ Origin: ORIGIN, "User-Agent": "Mozilla/5.0 (stream channel check)" }, headers), redirect: "follow", signal: AbortSignal.timeout(12000) });
const corsOk = (r) => { const h = r.headers.get("access-control-allow-origin"); return h === "*" || h === ORIGIN; };

async function testStream(url) {
  try {
    let r = await get(url);
    if (!r.ok) return "status " + r.status;
    if (!corsOk(r)) return "blocked for websites (no CORS)";
    let text = await r.text(), base = r.url;
    if (!text.startsWith("#EXTM3U")) return "not an HLS playlist";
    if (/#EXT-X-STREAM-INF/.test(text)) {
      const ls = text.split("\n"), i = ls.findIndex((l) => l.startsWith("#EXT-X-STREAM-INF")), v = ls.slice(i + 1).find((l) => l.trim() && !l.startsWith("#"));
      if (!v) return "empty playlist";
      r = await get(new URL(v.trim(), base).href);
      if (!r.ok) return "variant status " + r.status;
      if (!corsOk(r)) return "variant blocked (no CORS)";
      text = await r.text(); base = r.url;
    }
    if (/#EXT-X-KEY:METHOD=(?!NONE)/.test(text)) return "encrypted";
    const seg = text.split("\n").find((l) => l.trim() && !l.startsWith("#"));
    if (!seg) return "no segments";
    const sr = await get(new URL(seg.trim(), base).href, { Range: "bytes=0-1023" });
    if (sr.status !== 200 && sr.status !== 206) return "segment status " + sr.status;
    if (!corsOk(sr)) return "segments blocked (no CORS)";
    try { await sr.body.cancel(); } catch (e) {}
    return "ok";
  } catch (e) { return "unreachable"; }
}

// ---------- read the playlists ----------
let all = [];
for (const s of sources) {
  try { const r = await fetch(s, { signal: AbortSignal.timeout(30000) }); if (r.ok) all = all.concat(parse(await r.text())); else say("Could not read " + s + " (status " + r.status + ")"); }
  catch (e) { say("Could not read " + s); }
}
if (!all.length) { console.error("No channels found. channels.json left unchanged."); process.exit(1); }
say("Playlist entries: " + all.length);

// ---------- filter ----------
const seen = new Set(), cands = [];
for (const c of all) {
  c.name = c.rawName.replace(SYMBOLS, "").replace(/\s+/g, " ").trim();
  if (SYMBOLS.test(c.rawName) || !c.name || !c.url.startsWith("https://")) continue;
  if (BLOCK.some((b) => c.url.toLowerCase().includes(b))) continue;
  const cat = category(c); if (!cat) continue;
  const key = c.name.toLowerCase() + "|" + c.url; if (seen.has(key)) continue; seen.add(key);
  cands.push(Object.assign(c, { cat }));
}
say("Candidates after filtering: " + cands.length);

// ---------- test every stream the way a browser would ----------
const results = new Array(cands.length), reasons = {};
let next = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (next < cands.length) { const i = next++; results[i] = await testStream(cands[i].url); reasons[results[i]] = (reasons[results[i]] || 0) + 1; }
}));
say("Test results: " + JSON.stringify(reasons));

// ---------- keep the best, with limits per row ----------
const count = {}, out = [], ids = new Set();
for (let i = 0; i < cands.length && out.length < MAX_TOTAL; i++) {
  if (results[i] !== "ok") continue;
  const c = cands[i]; count[c.cat] = (count[c.cat] || 0) + 1; if (count[c.cat] > MAX_PER_CAT) continue;
  let id = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "channel"; while (ids.has(id)) id += "-2"; ids.add(id);
  const e = { id, name: c.name, category: c.cat, src: c.url };
  if (c.logo) e.logo = c.logo; if (c.tvg) e.epg = c.tvg.split("@")[0];
  out.push(e);
}
const order = ["News", "Sports", "Music", "Kids", "Docs & Science"].concat(COUNTRIES);
out.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
say("Working channels kept: " + out.length + " " + JSON.stringify(count));
if (out.length < 5) { console.error("Too few working channels. channels.json left unchanged."); fs.writeFileSync("scripts/last-channels.txt", "Last run: " + new Date().toISOString() + "\n\n" + log.join("\n") + "\n"); process.exit(1); }
fs.writeFileSync("channels.json", JSON.stringify(out, null, 1));
fs.writeFileSync("scripts/last-channels.txt", "Last run: " + new Date().toISOString() + "\n\n" + log.join("\n") + "\n");
