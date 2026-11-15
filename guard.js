// Put on every page that needs an account. Sends visitors who aren't signed in to the welcome page,
// and sends new members to create their first profile.
import { auth, onAuthStateChanged, signOut, REQUIRE_LOGIN } from "./firebase.js";

var root = new URL("./", import.meta.url);
var welcome = new URL("welcome/", root).href;
function reveal() { document.documentElement.classList.remove("auth-wait"); }
function hasProfile(uid) {
  try { return JSON.parse(localStorage.getItem("stream-profiles:" + uid) || "[]").length > 0; } catch (e) { return true; }
}
function onProfilesPage() { return /\/profiles\/?$/.test(location.pathname); }

onAuthStateChanged(auth, function (user) {
  if (!user && REQUIRE_LOGIN) { location.replace(welcome); return; }
  if (user) { try { localStorage.setItem("stream-uid", user.uid); } catch (e) {} }
  window.StreamUser = user;
  var name = user ? (user.displayName || (user.email || "").split("@")[0] || "Member") : "Guest";
  document.querySelectorAll("[data-user-name]").forEach(function (el) { el.textContent = name; });
  document.querySelectorAll("[data-user-email]").forEach(function (el) { el.textContent = user ? user.email || "" : "Not signed in"; });
  document.querySelectorAll("[data-user-initial]").forEach(function (el) { el.textContent = name.charAt(0).toUpperCase(); });
  if (user && !hasProfile(user.uid) && !onProfilesPage()) { location.replace(new URL("profiles/?new=1", root).href); return; }
  reveal();
  window.dispatchEvent(new Event("stream:user"));
  if (typeof window.StreamIntro === "function") window.StreamIntro(user);
});

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-signout]")) signOut(auth).then(function () { location.replace(welcome); });
});
