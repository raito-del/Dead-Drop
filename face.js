// ============================================
// Face check for admin (runs in the browser only)
// face-api.js is loaded from jsDelivr. The face data stays in this browser.
// ============================================
const LIB_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.esm.js";
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";
const STORE_KEY = "dd_face_descriptor";
const THRESHOLD = 0.5; // lower number = stricter match

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

export function hasEnrolledFace() {
 return !!localStorage.getItem(STORE_KEY);
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

// Takes 3 good samples and saves their average, so one bad frame does not matter
export async function enrollFace(video) {
 const samples = [];
 for (let tries = 0; tries < 40 && samples.length < 3; tries++) {
 const d = await readFace(video);
 if (d) samples.push(d);
 await new Promise((r) => setTimeout(r, 300));
 }
 if (samples.length < 3) throw new Error("No face found. Look at the camera in good light.");

 const avg = new Float32Array(128);
 samples.forEach((s) => s.forEach((v, i) => (avg[i] += v / 3)));
 localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(avg)));
}

// Checks a few frames against the saved face
export async function verifyFace(video) {
 const saved = localStorage.getItem(STORE_KEY);
 if (!saved) return false;
 const ref = new Float32Array(JSON.parse(saved));
 const f = await loadLib();

 for (let tries = 0; tries < 5; tries++) {
 const d = await readFace(video);
 if (d && f.euclideanDistance(ref, d) < THRESHOLD) return true;
 await new Promise((r) => setTimeout(r, 300));
 }
 return false;
}