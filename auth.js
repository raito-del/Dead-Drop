// ============================================
//  Firebase Authentication (শুধু লগইনের জন্য)
//  Firebase সরাসরি CDN থেকে লোড হয়, npm লাগে না
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

// বন্ধুদের লগইন: শুধু পাসওয়ার্ড লাগে, ইমেইল কোড থেকে যায়
export function loginViewer(password) {
  return signInWithEmailAndPassword(auth, VIEWER_EMAIL, password);
}

// Admin লগইন: তোমার ইমেইল কোড থেকে যায়, শুধু পাসওয়ার্ড টাইপ করবে
export function loginAdmin(password) {
  return signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
}

export function logout() {
  return signOut(auth);
}

// লগইন অবস্থা বদলালে callback(user) চলবে (user না থাকলে null)
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL;
}

// Firebase এররকে সহজ বাংলা মেসেজে বদলায়
export function errorText(err) {
  switch (err && err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "ACCESS DENIED: ভুল পাসওয়ার্ড";
    case "auth/too-many-requests":
      return "অনেকবার ভুল হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করো";
    case "auth/network-request-failed":
      return "ইন্টারনেট সংযোগ চেক করো";
    case "auth/invalid-api-key":
      return "config.js-এর apiKey ভুল আছে";
    case "auth/unauthorized-domain":
      return "Firebase-এর Authorized domains-এ raito-del.github.io যোগ করো";
    default:
      return "এরর: " + (err && err.code ? err.code : "অজানা সমস্যা");
  }
}