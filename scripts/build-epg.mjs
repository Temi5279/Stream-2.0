// Builds epg.json (what's on now and next) for the channels in channels.json.
// Runs on GitHub Actions. Guides come from the open iptv-org EPG project.
import fs from "node:fs";
import zlib from "node:zlib";
import { promisify } from "node:util";
const gunzip = promisify(zlib.gunzip);

const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
const want = new Set(channels.map((c) => c.epg).filter(Boolean));
const guides = fs.readFileSync("scripts/guides.txt", "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
const now = Date.now(), from = now - 6 * 3600e3, to = now + 36 * 3600e3;

function parseTime(s) {
  const m = (s || "").match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return NaN;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (m[7]) t -= (m[7][0] === "-" ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(3, 5)) * 60000;
  return t;
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

const out = {};
for (const url of guides) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!res.ok) { console.log("skip", res.status, url); continue; }
    const xml = (await gunzip(Buffer.from(await res.arrayBuffer()))).toString("utf8");
    const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
    let m;
    while ((m = re.exec(xml))) {
      const ch = (m[1].match(/channel="([^"]*)"/) || [])[1];
      if (!want.has(ch)) continue;
      const st = parseTime((m[1].match(/start="([^"]*)"/) || [])[1]);
      const en = parseTime((m[1].match(/stop="([^"]*)"/) || [])[1]);
      if (!(en > from && st < to)) continue;
      const title = decode(((m[2].match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "").trim());
      (out[ch] = out[ch] || []).push([Math.floor(st / 1000), Math.floor(en / 1000), title]);
    }
    console.log("ok", url);
  } catch (e) { console.log("skip", url, e.message); }
}
for (const k of Object.keys(out)) {
  const seen = new Set();
  out[k] = out[k].filter((p) => !seen.has(p[0]) && seen.add(p[0])).sort((a, b) => a[0] - b[0]);
}
fs.writeFileSync("epg.json", JSON.stringify({ generated: new Date().toISOString(), programmes: out }));
console.log("channels with schedules:", Object.keys(out).length);
