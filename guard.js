// Put on every page that needs an account. Sends visitors who aren't signed in to the welcome page,
// loads the member's saved profiles, My List and progress, and shows first-time profile setup.
import { auth, onAuthStateChanged, signOut, REQUIRE_LOGIN } from "./firebase.js";
import { pull } from "./sync.js";

var root = new URL("./", import.meta.url);
var welcome = new URL("welcome/", root).href;
function reveal() { document.documentElement.classList.remove("auth-wait"); }
function hasProfile(uid) {
  try { return JSON.parse(localStorage.getItem("stream-profiles:" + uid) || "[]").length > 0; } catch (e) { return true; }
}
function onProfilesPage() { return /\/profiles\/?$/.test(location.pathname); }

onAuthStateChanged(auth, async function (user) {
  if (!user && REQUIRE_LOGIN) { location.replace(welcome); return; }
  if (user) { try { localStorage.setItem("stream-uid", user.uid); } catch (e) {} }
  window.StreamUser = user;
  var name = user ? (user.displayName || (user.email || "").split("@")[0] || "Member") : "Guest";
  document.querySelectorAll("[data-user-name]").forEach(function (el) { el.textContent = name; });
  document.querySelectorAll("[data-user-email]").forEach(function (el) { el.textContent = user ? user.email || "" : "Not signed in"; });
  document.querySelectorAll("[data-user-initial]").forEach(function (el) { el.textContent = name.charAt(0).toUpperCase(); });

  if (user) {
    // Bring this account's data onto the device (waits up to 3.5 seconds on slow data)
    var p = pull(user.uid);
    var changed = await Promise.race([p, new Promise(function (r) { setTimeout(function () { r(null); }, 3500); })]);
    if (changed === null) p.then(function (c) {
      var done = false; try { done = sessionStorage.getItem("stream-resync"); } catch (e) {}
      if (c && !done) { try { sessionStorage.setItem("stream-resync", "1"); } catch (e) {} location.reload(); }
    });
  }

  reveal();
  window.dispatchEvent(new Event("stream:user"));
  if (user && !hasProfile(user.uid) && !onProfilesPage() && window.Stream && Stream.profileSetup) Stream.profileSetup();
  if (typeof window.StreamIntro === "function") window.StreamIntro(user);
});

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-signout]")) signOut(auth).then(function () { location.replace(welcome); });
});
