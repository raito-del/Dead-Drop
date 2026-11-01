// ============================================
// Face check (runs in the browser only)
// Up to 5 people per browser. Only numbers are saved, never the photo.
// ============================================
const LIB_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.esm.js";
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";
const PROFILES_KEY = "dd_face_profiles";
const THRESHOLD = 0.55; // lower = stricter
const MAX_PEOPLE = 5;

let fa = null;

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

// Returns the face descriptor of the first face in view, or null
async function readFace(video) {
 const f = await loadLib();
 const det = await f
 .detectSingleFace(video, new f.TinyFaceDetectorOptions())
 .withFaceLandmarks()
 .withFaceDescriptor();
 return det ? det.descriptor : null;
}

// Takes 3 good samples for this name and saves their average
export async function enrollFace(video, rawName) {
 const name = String(rawName || "").trim().slice(0, 40);
 if (!name) throw new Error("Enter a name first");

 const profiles = getProfiles();
 if (profiles.length >= MAX_PEOPLE) throw new Error("Maximum 5 people can be added");
 if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
 throw new Error("This name is already added");
 }

 const samples = [];
 for (let tries = 0; tries < 40 && samples.length < 3; tries++) {
 const d = await readFace(video);
 if (d) samples.push(d);
 await new Promise((r) => setTimeout(r, 300));
 }
 if (samples.length < 3) throw new Error("No face found. Look at the camera in good light.");

 const avg = new Float32Array(128);
 samples.forEach((s) => s.forEach((v, i) => (avg[i] += v / 3)));

 profiles.push({ name, vec: Array.from(avg) });
 saveProfiles(profiles);
 return name;
}

// Returns the matched person's name, or null.
// If onlyName is given, only that one saved person is checked.
export async function verifyFace(video, onlyName = null) {
 let list = getProfiles();
 if (onlyName) list = list.filter((p) => p.name === onlyName);
 if (!list.length) return null;

 const f = await loadLib();
 const refs = list.map((p) => ({ name: p.name, vec: new Float32Array(p.vec) }));

 for (let tries = 0; tries < 5; tries++) {
 const d = await readFace(video);
 if (d) {
 let best = null;
 for (const r of refs) {
 const dist = f.euclideanDistance(r.vec, d);
 if (dist < THRESHOLD && (!best || dist < best.dist)) best = { name: r.name, dist };
 }
 if (best) return best.name;
 }
 await new Promise((r) => setTimeout(r, 300));
 }
 return null;
}