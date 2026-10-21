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
  apiKey: "AIzaSyCzjhLBiMMSolj51Afh2uaWibw0zKRRykk",
  authDomain: "dead-drop-24187.firebaseapp.com",
  projectId: "dead-drop-24187",
  storageBucket: "dead-drop-24187.firebasestorage.app",
  messagingSenderId: "13506524223",
  appId: "1:13506524223:web:4648b3065c36581dc0f48a",
};
export const FIREBASE_FOLDER = "notes";