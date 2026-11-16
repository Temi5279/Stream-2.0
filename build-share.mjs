// Makes a small share page for every film (f/<id>/index.html) so links pasted into WhatsApp, X and others show the film's title and picture.
import fs from "node:fs";

const SITE = "https://watchstream.app";
const movies = JSON.parse(fs.readFileSync("movies.json", "utf8"));
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

fs.rmSync("f", { recursive: true, force: true });
for (const m of movies) {
  const id = encodeURIComponent(m.id);
  const title = m.title + (m.year ? " (" + m.year + ")" : "");
  const desc = (m.description || "Watch " + m.title + " free on stream.").slice(0, 200);
  const img = "https://archive.org/services/img/" + id;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · stream</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="video.movie">
<meta property="og:site_name" content="stream">
<meta property="og:title" content="${esc(title)} · watch free on stream">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${SITE}/f/${id}/">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#040a22">
<script>location.replace("../../movie/?id=${id}");</script>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#040a22;color:#eaf0ff;font-family:system-ui,sans-serif;text-align:center">
<p>Opening <strong>${esc(m.title)}</strong> on stream…<br><a style="color:#5b7dff" href="../../movie/?id=${id}">Tap here if nothing happens</a></p>
</body>
</html>
`;
  fs.mkdirSync("f/" + m.id, { recursive: true });
  fs.writeFileSync("f/" + m.id + "/index.html", html);
}
console.log("Share pages made:", movies.length);
