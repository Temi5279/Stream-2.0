// Builds movies.json from the Internet Archive. Runs on GitHub Actions (the Archive has an open search API).
// Only films from 1930 or earlier are added automatically, because those are public domain in the United States.
import fs from "node:fs";

const WANT = 100;
const RIGHTS = "Public domain in the US (published in 1930 or earlier)";

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}
const one = (v) => (Array.isArray(v) ? v[0] : v);
const clean = (s) => String(one(s) || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();

function genreOf(text) {
  const t = text.toLowerCase();
  const rules = [
    ["Horror", /horror|vampire|monster|ghost|haunt|frankenstein|dracula|nosferatu|phantom|zombie|macabre/],
    ["Sci-Fi", /science fiction|sci-fi|moon|robot|futur|metropolis|space|fantasy/],
    ["Animation", /animat|cartoon|felix|betty boop|popeye|fleischer|mickey/],
    ["Comedy", /comedy|comedies|slapstick|chaplin|keaton|lloyd|laurel|hardy|funny|farce/],
    ["Western", /western|cowboy|outlaw|frontier/],
    ["Documentary", /documentary|newsreel|travel|expedition|nature|actuality/],
    ["Adventure", /adventure|pirate|jungle|swashbuckl|treasure/],
    ["Romance", /romance|romantic|love story/],
    ["War", /\bwar\b|soldier|battle|military/],
  ];
  for (const [g, re] of rules) if (re.test(t)) return g;
  return "Drama";
}
function runtimeOf(sec) {
  const s = Math.round(+sec);
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

const params = new URLSearchParams();
params.set("q", "mediatype:movies AND (collection:silent_films OR collection:feature_films) AND year:[1890 TO 1930]");
["identifier", "title", "year", "subject", "description", "downloads"].forEach((f) => params.append("fl[]", f));
params.append("sort[]", "downloads desc");
params.set("rows", "300");
params.set("page", "1");
params.set("output", "json");

const search = await getJSON("https://archive.org/advancedsearch.php?" + params);
if (!search || !search.response) { console.error("Search failed, movies.json left unchanged."); process.exit(1); }
const docs = search.response.docs;
console.log("Search found", docs.length, "candidates");

const found = [];
for (let i = 0; i < docs.length && found.length < WANT; i += 6) {
  const batch = docs.slice(i, i + 6);
  const results = await Promise.all(batch.map(async (d) => {
    const meta = await getJSON("https://archive.org/metadata/" + encodeURIComponent(d.identifier));
    if (!meta || !meta.files || (meta.metadata && (meta.metadata["access-restricted-item"] === "true" || meta.is_dark))) return null;
    const vids = meta.files
      .filter((f) => /\.mp4$/i.test(f.name) && +f.size > 3e6 && !/sample|trailer/i.test(f.name))
      .sort((a, b) => (/h\.264/i.test(b.format || "") ? 1 : 0) - (/h\.264/i.test(a.format || "") ? 1 : 0) || +a.size - +b.size);
    if (!vids.length) return null;
    const text = [d.title, d.subject, d.description].map(clean).join(" ");
    return {
      id: d.identifier,
      file: vids[0].name,
      title: clean(d.title) || d.identifier,
      year: +one(d.year) || "",
      genre: genreOf(text),
      runtime: runtimeOf(vids[0].length),
      description: clean(d.description).slice(0, 320),
      rights: RIGHTS,
      auto: true,
    };
  }));
  results.forEach((r) => { if (r && found.length < WANT) found.push(r); });
  console.log("Checked", Math.min(i + 6, docs.length), "found", found.length);
}

// Keep films you added by hand, add the new ones after them
let old = [];
try { old = JSON.parse(fs.readFileSync("movies.json", "utf8")); } catch (e) {}
const manual = old.filter((m) => !m.auto);
const have = new Set(manual.map((m) => m.id));
const merged = manual.concat(found.filter((m) => !have.has(m.id)));
fs.writeFileSync("movies.json", JSON.stringify(merged, null, 2));
console.log("movies.json now has", merged.length, "films");
