// ============================================
// Face check (runs in the browser only)
// Up to 5 people per browser. Only numbers are saved, never the photo.
// ============================================
const LIB_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.esm.js";
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";
const PROFILES_KEY = "dd_face_profiles";
const VERSION_KEY = "dd_face_version";
const FACE_VERSION = "3-pose"; // change this text to force a clean reset for everyone
const THRESHOLD = 0.55; // lower = stricter
const MAX_PEOPLE = 5;

// The three guided poses for enrollment
const POSES = [
 { key: "front", label: "Look straight at the camera" },
 { key: "left", label: "Slowly turn your head to the left" },
 { key: "right", label: "Slowly turn your head to the right" },
];

let fa = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadLib() {
 if (fa) return fa;
 fa = await import(LIB_URL);
 await Promise.all([
 fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
 fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
 fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
 ]);
 return fa;
}

// Clears old face data once when the version changes. Returns true if it cleared anything.
export function ensureFreshStart() {
 if (localStorage.getItem(VERSION_KEY) === FACE_VERSION) return false;
 localStorage.removeItem(PROFILES_KEY);
 localStorage.setItem(VERSION_KEY, FACE_VERSION);
 return true;
}

// Saved people: [{ name, vec }]
export function getProfiles() {
 try {
 return JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]");
 } catch {
 return [];
 }
}

function saveProfiles(list) {
 localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

export function hasEnrolledFace() {
 return getProfiles().length > 0;
}

export function canAddPerson() {
 return getProfiles().length < MAX_PEOPLE;
}

export function removePerson(name) {
 saveProfiles(getProfiles().filter((p) => p.name !== name));
}

export function clearAllFaces() {
 localStorage.removeItem(PROFILES_KEY);
}

export async function startCamera(video) {
 const stream = await navigator.mediaDevices.getUserMedia({
 video: { width: 320, height: 240 },
 audio: false,
 });
 video.srcObject = stream;
 await video.play();
 await loadLib();
 return stream;
}

export function stopCamera(stream) {
 if (stream) stream.getTracks().forEach((t) => t.stop());
}

// Detects one face and returns { descriptor, pose } or null.
// pose is "left", "right" or "front", based on where the nose sits between the eyes.
async function readFace(video) {
 const f = await loadLib();
 const det = await f
 .detectSingleFace(video, new f.TinyFaceDetectorOptions())
 .withFaceLandmarks()
 .withFaceDescriptor();
 if (!det) return null;

 const pts = det.landmarks.positions;
 const leftEye = averagePoint(pts.slice(36, 42));  // person's left eye (image right side)
 const rightEye = averagePoint(pts.slice(42, 48)); // person's right eye (image left side)
 const nose = pts[30];

 const eyeMid = (leftEye.x + rightEye.x) / 2;
 const eyeWidth = Math.abs(leftEye.x - rightEye.x) || 1;
 const offset = (nose.x - eyeMid) / eyeWidth;

 let pose = "front";
 if (offset > 0.12) pose = "left";
 else if (offset < -0.12) pose = "right";

 return { descriptor: det.descriptor, pose };
}

function averagePoint(points) {
 const sum = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
 return { x: sum.x / points.length, y: sum.y / points.length };
}

// Guided enrollment: front, left, right.
// onStep({ index, total, label, done, state, text }) reports progress for the page.
// state: "wait" | "ok" | "fail"
export async function enrollFace(video, rawName, onStep = () => {}) {
 const name = String(rawName || "").trim().slice(0, 40);
 if (!name) throw new Error("Enter a name first");

 const profiles = getProfiles();
 if (profiles.length >= MAX_PEOPLE) throw new Error("Maximum 5 people can be added");
 if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
 throw new Error("This name is already added");
 }

 const captured = [];

 for (let i = 0; i < POSES.length; i++) {
 const pose = POSES[i];
 let got = null;

 for (let tries = 0; tries < 60 && !got; tries++) {
 const r = await readFace(video);
 if (!r) {
 onStep({ index: i, total: POSES.length, label: pose.label, state: "wait", text: "No face in view" });
 } else if (r.pose !== pose.key) {
 const hint = pose.key === "front" ? "Face the camera straight" : pose.label;
 onStep({ index: i, total: POSES.length, label: pose.label, state: "wait", text: hint });
 } else {
 got = r.descriptor;
 }
 await sleep(250);
 }

 if (!got) {
 onStep({ index: i, total: POSES.length, label: pose.label, state: "fail", text: "Step failed. Try again." });
 throw new Error("Could not capture: " + pose.label);
 }

 captured.push(got);
 onStep({ index: i, total: POSES.length, label: pose.label, state: "ok", text: "Captured", done: i + 1 });
 await sleep(400);
 }

 // Average the three poses into one stored signature
 const avg = new Float32Array(128);
 captured.forEach((d) => d.forEach((v, i) => (avg[i] += v / captured.length)));

 profiles.push({ name, vec: Array.from(avg) });
 saveProfiles(profiles);
 return name;
}

// Returns the matched person's name, or null.
// onProgress({ percent, text }) reports the live match percentage.
export async function verifyFace(video, onlyName = null, onProgress = () => {}) {
 let list = getProfiles();
 if (onlyName) list = list.filter((p) => p.name === onlyName);
 if (!list.length) {
 onProgress({ percent: 0, text: "No saved face" });
 return null;
 }

 const f = await loadLib();
 const refs = list.map((p) => ({ name: p.name, vec: new Float32Array(p.vec) }));
 let bestPct = 0;

 for (let tries = 0; tries < 10; tries++) {
 const r = await readFace(video);

 if (!r) {
 onProgress({ percent: 0, text: "No face in view" });
 await sleep(300);
 continue;
 }

 let best = null;
 for (const ref of refs) {
 const dist = f.euclideanDistance(ref.vec, r.descriptor);
 if (!best || dist < best.dist) best = { name: ref.name, dist };
 }

 const pct = Math.max(0, Math.min(100, Math.round((1 - best.dist) * 100)));
 if (pct > bestPct) bestPct = pct;

 if (best.dist < THRESHOLD) {
 onProgress({ percent: 100, text: "Matched: " + best.name });
 return best.name;
 }

 onProgress({ percent: pct, text: "Matching... " + pct + "%" });
 await sleep(300);
 }

 onProgress({ percent: bestPct, text: "Not matched (" + bestPct + "%)" });
 return null;
}