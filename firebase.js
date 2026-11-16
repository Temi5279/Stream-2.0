// Firebase setup for stream. Loaded as an ES module (no npm needed).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, onAuthStateChanged, signOut,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Switch to false to let anyone use the app without signing in (handy for testing).
export const REQUIRE_LOGIN = true;

const firebaseConfig = {
  apiKey: "AIzaSyBfkqkhk0z8xuritMgzf4Bhf_N2Na-Co-Y",
  authDomain: "stream-2o.firebaseapp.com",
  projectId: "stream-2o",
  storageBucket: "stream-2o.firebasestorage.app",
  messagingSenderId: "6845983758",
  appId: "1:6845983758:web:f0016e044e8aadb192e05f",
  measurementId: "G-EZSCM2ZX7W"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider, GoogleAuthProvider, doc, setDoc, getDoc, updateDoc, deleteDoc };

// Saves name, email and date of birth in Firestore. Sign-in still works if this fails.
export async function saveProfile(user, extra) {
  // Never let a slow or missing database hold up sign-in: give it 3 seconds, then move on.
  var write = setDoc(doc(db, "users", user.uid),
    Object.assign({ name: user.displayName || "", email: user.email || "", updatedAt: serverTimestamp() }, extra || {}),
    { merge: true }).catch(function (e) { console.warn("Profile not saved:", e.code || e); });
  await Promise.race([write, new Promise(function (res) { setTimeout(res, 3000); })]);
}

export async function googleSignIn() {
  const r = await signInWithPopup(auth, new GoogleAuthProvider());
  await saveProfile(r.user, {});
  return r.user;
}

export function friendlyError(e) {
  var m = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the Google pop-up. Allow pop-ups and try again.",
    "auth/network-request-failed": "No connection. Check your data and try again.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
    "auth/unauthorized-domain": "This website isn't approved in Firebase yet (Authentication, Settings, Authorized domains).",
    "auth/operation-not-allowed": "This sign-in method isn't turned on in Firebase yet."
  };
  return m[e && e.code] || "Something went wrong. Please try again.";
}
