// ============================================================
// THE SWITCH — change this one word to move between storages.
//   "firebase" : PDFs live in Firebase Storage (upload from the site)
//   "github"   : PDFs live in the repo's notes/ folder (upload on github.com)
// ============================================================
export const MODE = "firebase";

// ---- GitHub mode ----
export const GITHUB = {
  user: "raito-del",
  repo: "Dead-Drop",
  branch: "main",
  folder: "notes",
};

// ---- Firebase mode (paste from Firebase console > Project settings > Your apps) ----
export const FIREBASE = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};
export const FIREBASE_FOLDER = "notes";