// ============================================
//  Firebase Authentication (login only)
//  Firebase loads directly from the CDN, no npm required
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { FIREBASE, VIEWER_EMAIL, ADMIN_EMAIL } from "./config.js";

const app = initializeApp(FIREBASE);
const auth = getAuth(app);

// Viewer login: only a password is needed, the email is stored in code
export function loginViewer(password) {
  return signInWithEmailAndPassword(auth, VIEWER_EMAIL, password);
}

// Admin login: the admin email is stored in code, only the password is typed
export function loginAdmin(password) {
  return signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
}

export function logout() {
  return signOut(auth);
}

// Calls callback(user) whenever the login state changes (user is null if logged out)
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL;
}

// Converts Firebase error codes into simple, user-friendly messages
export function errorText(err) {
  switch (err && err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "ACCESS DENIED: Wrong password";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Please check your internet connection.";
    case "auth/invalid-api-key":
      return "The apiKey in config.js is invalid.";
    case "auth/unauthorized-domain":
      return "Add raito-del.github.io to Firebase Authorized domains.";
    default:
      return "Error: " + (err && err.code ? err.code : "Unknown error");
  }
}