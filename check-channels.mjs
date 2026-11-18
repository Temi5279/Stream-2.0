// Confirms every YouTube channel id in channels.json is real (using YouTube's public RSS feed) and removes the ones that are not.
import fs from "node:fs";
const list = JSON.parse(fs.readFileSync("channels.json", "utf8")), keep = [], log = [];
for (const c of list) {
  if (!c.yt) { keep.push(c); continue; }
  let ok = false, title = "";
  try {
    const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + encodeURIComponent(c.yt), { signal: AbortSignal.timeout(20000) });
    if (r.ok) { const t = await r.text(); ok = true; title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || ""; }
  } catch (e) {}
  log.push((ok ? "OK      " : "REMOVED ") + c.name + (ok ? "  (YouTube channel: " + title + ")" : "  (channel id not found)"));
  if (ok) keep.push(c);
}
fs.writeFileSync("channels.json", JSON.stringify(keep, null, 1));
fs.writeFileSync("scripts/last-channels.txt", "Last run: " + new Date().toISOString() + "\n\n" + log.join("\n") + "\n");
console.log(log.join("\n"));
