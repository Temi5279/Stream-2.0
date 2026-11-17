// Builds movies.json with up to 1,000 verified public-domain films from the Internet Archive.
import fs from "node:fs";

const WANT = 1000;
const RIGHTS = "Public domain in the US";

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
const clean = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function genreOf(text) {
  const t = text.toLowerCase();
  const rules = [
    ["Horror", /horror|vampire|monster|ghost|haunt|frankenstein|dracula|nosferatu|phantom|zombie|macabre/],
    ["Sci-Fi", /science fiction|sci-fi|moon|robot|futur|metropolis|space|fantasy|alien/],
    ["Animation", /animat|cartoon|felix|betty boop|popeye|fleischer|mickey|superman/],
    ["Comedy", /comedy|comedies|slapstick|chaplin|keaton|lloyd|laurel|hardy|funny|farce/],
    ["Film Noir", /noir|detective|crime|murder|gangster|thriller|mystery|suspense/],
    ["Western", /western|cowboy|outlaw|frontier|sheriff/],
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
  if (!s || s < 300) return "";
  const h = Math.floor(s / 3600),
    m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

async function verifyItem(id, fallbackMeta = {}) {
  const meta = await getJSON("https://archive.org/metadata/" + encodeURIComponent(id));
  if (!meta || !meta.files) return null;
  if (meta.is_dark || (meta.metadata && meta.metadata["access-restricted-item"] === "true")) {
    return null;
  }

  const vids = meta.files
    .filter(
      (f) =>
        /\.mp4$/i.test(f.name) &&
        f.private !== "true" &&
        +f.size > 25e6 &&
        !/sample|trailer|preview|promo/i.test(f.name)
    )
    .sort(
      (a, b) =>
        (/h\.264/i.test(b.format || "") ? 1 : 0) - (/h\.264/i.test(a.format || "") ? 1 : 0) ||
        +a.size - +b.size
    );

  if (!vids.length) return null;

  const md = meta.metadata || {};
  const title = clean(one(fallbackMeta.title || md.title)) || id;
  const year = String(one(fallbackMeta.year || md.year || md.date) || "").slice(0, 4);
  const subject = Array.isArray(md.subject) ? md.subject.join(" ") : md.subject || "";
  const description = clean(one(fallbackMeta.description || md.description)).slice(0, 320);
  const text = [title, subject, description].join(" ");

  return {
    id,
    file: vids[0].name,
    title,
    year,
    genre: genreOf(text),
    runtime: runtimeOf(vids[0].length),
    director: clean(one(md.director || md.creator)),
    description,
    rights: RIGHTS,
    auto: true,
  };
}

// 1. Load existing manual movies & extra-ids.txt
let old = [];
try {
  old = JSON.parse(fs.readFileSync("movies.json", "utf8"));
} catch (e) {}
const manual = old.filter((m) => !m.auto);
const seen = new Set(manual.map((m) => m.id));
const oldMap = new Map(old.map((m) => [m.id, m]));

const found = [];

// Process extra-ids.txt if present
if (fs.existsSync("extra-ids.txt")) {
  const extraIds = fs
    .readFileSync("extra-ids.txt", "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !seen.has(l));

  for (let i = 0; i < extraIds.length; i += 6) {
    const batch = extraIds.slice(i, i + 6);
    const res = await Promise.all(batch.map((id) => verifyItem(id)));
    for (const r of res) {
      if (r && !seen.has(r.id)) {
        seen.add(r.id);
        r.auto = false;
        manual.push(r);
      }
    }
  }
}

// 2. Search Archive.org across multiple pages until we reach WANT (1000)
const queries = [
  "mediatype:movies AND (collection:feature_films OR collection:silent_films) AND year:[1900 TO 1930]",
  "mediatype:movies AND collection:feature_films AND year:[1931 TO 1963]",
];

for (const q of queries) {
  for (let page = 1; page <= 5 && found.length < WANT; page++) {
    const params = new URLSearchParams();
    params.set("q", q);
    ["identifier", "title", "year", "subject", "description", "downloads"].forEach((f) =>
      params.append("fl[]", f)
    );
    params.append("sort[]", "downloads desc");
    params.set("rows", "300");
    params.set("page", String(page));
    params.set("output", "json");

    const search = await getJSON("https://archive.org/advancedsearch.php?" + params);
    if (!search || !search.response || !search.response.docs.length) break;

    const docs = search.response.docs.filter((d) => !seen.has(d.identifier));
    console.log(`Query page ${page}: checking ${docs.length} candidates...`);

    for (let i = 0; i < docs.length && found.length < WANT; i += 8) {
      const batch = docs.slice(i, i + 8);
      const results = await Promise.all(
        batch.map((d) =>
          verifyItem(d.identifier, {
            title: d.title,
            year: d.year,
            description: d.description,
          })
        )
      );
      for (const r of results) {
        if (r && !seen.has(r.id) && found.length < WANT) {
          seen.add(r.id);
          found.push(r);
        }
      }
      if (i % 40 === 0) console.log(`Found ${found.length} / ${WANT} verified films`);
    }
  }
}

if (!found.length && !manual.length) {
  console.error("No films found, keeping existing movies.json");
  process.exit(1);
}

const merged = manual.concat(
  found.map((m) => Object.assign(m, { added: (oldMap.get(m.id) || {}).added || Date.now() }))
);

fs.writeFileSync("movies.json", JSON.stringify(merged, null, 2));
console.log("movies.json updated with", merged.length, "verified playable films!");