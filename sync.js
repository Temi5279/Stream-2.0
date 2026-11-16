// Keeps profiles, My List and watch progress in the member's account, so they follow them to any device.
// The copy on the device is used first, so everything still works offline.
import { db, doc, getDoc, setDoc, updateDoc } from "./firebase.js";

var uid = null, timer = null, pushing = false;
function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

function readLocal(u) {
  var profiles = get("stream-profiles:" + u, []), meta = get("stream-sync:" + u, { pts: 0, lts: {} }), data = {};
  profiles.forEach(function (p) {
    data[p.id] = { list: get("stream-list:" + u + ":" + p.id, []), lts: (meta.lts || {})[p.id] || 0, progress: get("stream-progress:" + u + ":" + p.id, {}) };
  });
  return { pts: meta.pts || 0, profiles: profiles, data: data };
}
function writeLocal(u, s) {
  put("stream-profiles:" + u, s.profiles);
  var meta = { pts: s.pts, lts: {} };
  s.profiles.forEach(function (p) {
    var d = s.data[p.id] || {};
    put("stream-list:" + u + ":" + p.id, d.list || []); put("stream-progress:" + u + ":" + p.id, d.progress || {}); meta.lts[p.id] = d.lts || 0;
  });
  put("stream-sync:" + u, meta);
  var act = localStorage.getItem("stream-active:" + u);
  if (s.profiles[0] && !s.profiles.some(function (p) { return p.id === act; })) { try { localStorage.setItem("stream-active:" + u, s.profiles[0].id); } catch (e) {} }
}
function merge(l, r) {
  var useR = (r.pts || 0) > (l.pts || 0), profiles = (useR ? r.profiles : l.profiles) || [];
  var out = { pts: Math.max(l.pts || 0, r.pts || 0), profiles: profiles, data: {} };
  profiles.forEach(function (p) {
    var a = l.data[p.id], b = (r.data || {})[p.id], res = { list: [], lts: 0, progress: {} };
    if (a && b) {
      var newer = (b.lts || 0) > (a.lts || 0) ? b : a;
      res.list = newer.list || []; res.lts = Math.max(a.lts || 0, b.lts || 0);
      res.progress = Object.assign({}, a.progress || {});
      var bp = b.progress || {};
      for (var id in bp) if (!res.progress[id] || (bp[id].ts || 0) > (res.progress[id].ts || 0)) res.progress[id] = bp[id];
    } else {
      var one = a || b || {}; res.list = one.list || []; res.lts = one.lts || 0; res.progress = one.progress || {};
    }
    out.data[p.id] = res;
  });
  return out;
}
function sig(s) { return JSON.stringify([s.pts || 0, s.profiles || [], Object.keys(s.data || {}).sort().map(function (k) { return [k, s.data[k]]; })]); }
function timeout(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

async function push() {
  if (!uid || pushing) return;
  pushing = true;
  try {
    var s = readLocal(uid), payload = JSON.parse(JSON.stringify({ v: 1, ts: Date.now(), pts: s.pts, profiles: s.profiles, data: s.data }));
    var ref = doc(db, "users", uid);
    var write = updateDoc(ref, { app: payload }).catch(function () { return setDoc(ref, { app: payload }, { merge: true }); });
    await Promise.race([write, timeout(8000)]);
    try { localStorage.removeItem("stream-dirty:" + uid); } catch (e) {}
  } catch (e) {}
  pushing = false;
}

// Called once after sign-in. Returns true if this device's data changed.
export async function pull(u) {
  uid = u;
  try {
    if (localStorage.getItem("stream-dirty:" + u)) { await push(); return false; }
    var snap = await getDoc(doc(db, "users", u)), r = snap.exists() ? snap.data().app : null, l = readLocal(u);
    if (!r) { if (l.profiles.length) await push(); return false; }
    var m = merge(l, r);
    writeLocal(u, m);
    if (sig(m) !== sig(r)) push();
    return sig(m) !== sig(l);
  } catch (e) { return false; }
}

window.addEventListener("stream:dirty", function () {
  if (!uid) return;
  try { localStorage.setItem("stream-dirty:" + uid, "1"); } catch (e) {}
  clearTimeout(timer); timer = setTimeout(push, 15000);
});
window.addEventListener("stream:flush", function () { clearTimeout(timer); push(); });
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && uid) { clearTimeout(timer); push(); } });
window.addEventListener("pagehide", function () { if (uid) push(); });
