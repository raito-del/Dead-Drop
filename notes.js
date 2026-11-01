// ============================================
// Notes page: face guard, folder view, search, sort, admin
// ============================================
import { GITHUB } from "./config.js";
import { watchAuth, logout, isAdmin } from "./auth.js";
import { getToken, saveToken, clearToken, createFolder, uploadPdf } from "./github.js";

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const searchEl = $("search");
const sortEl = $("sort");
const statusEl = $("status");
const content = $("content");
const adminPanel = $("admin-panel");
const logoutBtn = $("logout");

const crumbsEl = document.createElement("div");
crumbsEl.className = "crumbs";
listEl.before(crumbsEl);

let allFiles = [];    // { name, path, folders[], size }
let allFolders = [];  // [["first-year"], ["first-year", "cp-2"]]
let currentPath = []; // the folder the user is currently in
let isAdminUser = false;
let adminMsg = null;
let filesLoaded = false;

// ---------- helper ----------
const el = (tag, props = {}, ...kids) => {
 const n = document.createElement(tag);
 Object.assign(n, props);
 n.append(...kids);
 return n;
};

// Remove characters from folder/file names that GitHub does not allow
function cleanName(s) {
 return s
 .replace(/[\/\\:*?"<>|]/g, "")
 .replace(/\s+/g, " ")
 .replace(/^\.+/, "")
 .trim()
 .slice(0, 120);
}

// Is segs inside path (or exactly at it)?
const under = (segs, path) => path.every((p, i) => segs[i] === p);

function sizeText(bytes) {
 if (!bytes) return "";
 return bytes > 1048576
 ? (bytes / 1048576).toFixed(1) + " MB"
 : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function rawUrl(relPath) {
 const encoded = [GITHUB.folder, ...relPath.split("/")].map(encodeURIComponent).join("/");
 return `https://raw.githubusercontent.com/${GITHUB.user}/${GITHUB.repo}/${GITHUB.branch}/${encoded}`;
}

function showMsg(text, ok = false) {
 if (!adminMsg) return;
 adminMsg.textContent = text;
 adminMsg.className = ok ? "hint" : "error";
}

async function run(btn, fn) {
 btn.disabled = true;
 showMsg("Working...", true);
 try {
 await fn();
 } catch (err) {
 showMsg("Error: " + err.message);
 } finally {
 btn.disabled = false;
 }
}

// Sort the file list according to the dropdown
function sortFiles(list) {
 const mode = sortEl ? sortEl.value : "name";
 return [...list].sort((a, b) => {
 if (mode === "size") return b.size - a.size;
 if (mode === "name-desc") return b.name.localeCompare(a.name);
 return a.name.localeCompare(b.name);
 });
}

// ---------- guard ----------
watchAuth((user) => {
 if (sessionStorage.getItem("dd_face_ok") !== "1") {
 location.replace("index.html");
 return;
 }
 content.classList.remove("hidden");
 isAdminUser = isAdmin(user);
 renderAdmin();
 if (!filesLoaded) {
 filesLoaded = true;
 loadFiles();
 }
});

logoutBtn.addEventListener("click", async () => {
 sessionStorage.removeItem("dd_face_ok");
 await logout();
 location.replace("index.html");
});

// ---------- load all files and folders from GitHub ----------
// Method 1: git tree (one request for everything)
// Method 2 (fallback): contents API, walking folder by folder
async function fetchAllEntries() {
 const treeUrl =
 `https://api.github.com/repos/${GITHUB.user}/${GITHUB.repo}/git/trees/${GITHUB.branch}?recursive=1`;

 const res = await fetch(treeUrl, { cache: "no-store" });
 if (res.ok) {
 const data = await res.json();
 if (data.truncated) console.warn("GitHub tree was truncated; falling back to contents API");
 if (!data.truncated) {
 return (data.tree || [])
 .filter((item) => item.path.startsWith(GITHUB.folder + "/"))
 .map((item) => ({
 path: item.path.slice(GITHUB.folder.length + 1),
 type: item.type === "tree" ? "dir" : "file",
 size: item.size || 0,
 }));
 }
 } else if (res.status === 404) {
 throw new Error("Repository or branch not found. Check config.js (user, repo, branch).");
 }

 // Fallback: walk the folders with the contents API
 return await walkContents(GITHUB.folder);
}

async function walkContents(relDir) {
 const url =
 `https://api.github.com/repos/${GITHUB.user}/${GITHUB.repo}/contents/${encodeGitPath(GITHUB.folder)}` +
 (relDir === GITHUB.folder ? "" : "/" + encodeGitPath(relDir.slice(GITHUB.folder.length + 1)));

 const res = await fetch(url + `?ref=${GITHUB.branch}`, { cache: "no-store" });
 if (!res.ok) {
 if (res.status === 404) return [];
 throw new Error("GitHub contents HTTP " + res.status);
 }
 const items = await res.json();
 let out = [];
 for (const it of items) {
 const rel = it.path.slice(GITHUB.folder.length + 1);
 if (it.type === "dir") {
 out.push({ path: rel, type: "dir", size: 0 });
 out = out.concat(await walkContents(it.path));
 } else if (it.type === "file") {
 out.push({ path: rel, type: "file", size: it.size || 0 });
 }
 }
 return out;
}

function encodeGitPath(p) {
 return p.split("/").map(encodeURIComponent).join("/");
}

async function loadFiles() {
 statusEl.textContent = "Loading...";
 try {
 const entries = await fetchAllEntries();

 allFiles = [];
 const folderSet = new Map();

 for (const e of entries) {
 const parts = e.path.split("/");

 if (e.type === "dir") {
 folderSet.set(e.path, parts);
 continue;
 }

 // Every parent folder of a file also counts as a folder
 for (let i = 1; i < parts.length; i++) {
 const p = parts.slice(0, i);
 folderSet.set(p.join("/"), p);
 }

 if (/\.pdf$/i.test(e.path)) {
 allFiles.push({
 name: parts[parts.length - 1],
 path: e.path,
 folders: parts.slice(0, -1),
 size: e.size,
 });
 }
 }

 allFolders = [...folderSet.values()];
 allFiles.sort((a, b) => a.path.localeCompare(b.path));
 render();
 renderAdmin();
 } catch (err) {
 statusEl.textContent = "Could not load the list: " + err.message;
 console.error("loadFiles failed:", err);
 }
}

// ---------- render ----------
function render() {
 const q = searchEl.value.trim().toLowerCase();
 listEl.innerHTML = "";
 closeViewer();

 // Each row gets an index so CSS can stagger the fade-in animation
 let index = 0;
 const add = (node) => {
 node.style.setProperty("--i", index++);
 listEl.append(node);
 };

 // Search mode: no animation, so results do not jump on each keystroke
 listEl.classList.toggle("no-anim", !!q);

 if (q) {
 crumbsEl.textContent = "Search results (from all folders)";
 const matches = sortFiles(
 allFiles.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
 );
 statusEl.textContent = matches.length ? "" : "Nothing found.";
 matches.forEach((f) => add(fileRow(f, f.folders.join(" / "))));
 return;
 }

 renderCrumbs();

 const depth = currentPath.length;
 const subfolders = [
 ...new Set(
 allFolders
 .filter((s) => s.length > depth && under(s, currentPath))
 .map((s) => s[depth])
 ),
 ].sort((a, b) => a.localeCompare(b));

 const files = allFiles.filter(
 (f) => f.folders.length === depth && under(f.folders, currentPath)
 );

 // Folders always sorted by name; files follow the sort dropdown
 subfolders.forEach((name) => {
 const count = allFiles.filter(
 (f) => f.folders.length > depth && under(f.folders, currentPath) && f.folders[depth] === name
 ).length;
 add(folderRow(name, count));
 });
 sortFiles(files).forEach((f) => add(fileRow(f, "")));

 if (!allFiles.length && !subfolders.length) statusEl.textContent = "Nothing in notes yet.";
 else if (!subfolders.length && !files.length) statusEl.textContent = "This folder is empty for now.";
 else statusEl.textContent = "";
}

function renderCrumbs() {
 crumbsEl.replaceChildren();

 const make = (label, path) => {
 const b = el("button", { className: "btn ghost", textContent: label });
 b.addEventListener("click", () => {
 currentPath = path;
 searchEl.value = "";
 render();
 renderAdmin();
 });
 return b;
 };

 crumbsEl.append(make("notes", []));
 currentPath.forEach((seg, i) => {
 crumbsEl.append(" / ", make(seg, currentPath.slice(0, i + 1)));
 });
}

function folderRow(name, count) {
 const open = el("button", { className: "btn", textContent: "Open" });
 open.addEventListener("click", () => {
 currentPath = [...currentPath, name];
 searchEl.value = "";
 render();
 renderAdmin();
 });

 const info = el("div", {},
 el("div", { className: "file-name", textContent: name }),
 el("div", { className: "file-meta", textContent: "Folder · " + count + " PDF(s)" })
 );
 return el("div", { className: "file" }, info, open);
}

function fileRow(f, label) {
 const read = el("button", { className: "btn", textContent: "Read", type: "button" });
 read.addEventListener("click", () => openViewer(f));

 const dl = el("a", { className: "btn", textContent: "Download" });
 dl.href = rawUrl(f.path);
 dl.target = "_blank";
 dl.rel = "noopener";
 dl.setAttribute("download", f.name);

 const meta = [label, sizeText(f.size)].filter(Boolean).join(" · ");
 const info = el("div", {},
 el("div", { className: "file-name", textContent: f.name.replace(/\.pdf$/i, "") }),
 el("div", { className: "file-meta", textContent: meta })
 );

 const actions = el("div", { style: "display:flex; gap:8px; flex-wrap:wrap;" }, read, dl);
 return el("div", { className: "file" }, info, actions);
}

// ---------- PDF viewer (shows the PDF inside the site) ----------
function closeViewer() {
 const old = document.getElementById("pdf-viewer");
 if (old) old.remove();
}

function openViewer(f) {
 closeViewer();

 const box = el("div", { id: "pdf-viewer", className: "admin-panel" });
 const close = el("button", { className: "btn ghost", textContent: "Close", type: "button" });
 close.addEventListener("click", closeViewer);

 // pdf.js viewer: it can display PDFs from GitHub raw links
 const viewerUrl =
 "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + encodeURIComponent(rawUrl(f.path));
 const frame = el("iframe", { src: viewerUrl });
 frame.style.cssText = "width:100%; height:70vh; border:0; background:#000; margin-top:12px;";

 box.append(
 el("div", { style: "display:flex; justify-content:space-between; align-items:center; gap:10px;" },
 el("h2", { textContent: f.name.replace(/\.pdf$/i, ""), style: "margin:0;" }),
 close
 ),
 frame
 );

 listEl.after(box);
 box.scrollIntoView({ behavior: "smooth" });
}

// ---------- admin panel (shown only after password AND face check) ----------
function renderAdmin() {
 if (!isAdminUser || sessionStorage.getItem("dd_face_ok") !== "1") return;
 adminPanel.classList.remove("hidden");
 adminPanel.replaceChildren();

 const where = "notes" + (currentPath.length ? " / " + currentPath.join(" / ") : "");
 adminPanel.append(
 el("h2", { textContent: "admin: folders & PDFs" }),
 el("div", { className: "hint", textContent: "You are in: " + where })
 );

 if (!getToken()) {
 const tok = el("input", { type: "password", placeholder: "GitHub token (enter once)", autocomplete: "off" });
 const save = el("button", { className: "btn", textContent: "Save", type: "button" });
 save.onclick = () => {
 if (!tok.value.trim()) return showMsg("Token is empty");
 saveToken(tok.value);
 renderAdmin();
 };
 adminPanel.append(el("div", { className: "row" }, tok, save));
 } else {
 const clearBtn = el("button", { className: "btn ghost", textContent: "Delete token", type: "button" });
 clearBtn.onclick = () => { clearToken(); renderAdmin(); };
 adminPanel.append(
 el("div", { className: "hint", textContent: "GitHub token is saved in this browser." }),
 clearBtn
 );

 // New folder
 const folderIn = el("input", { type: "text", placeholder: "New folder name" });
 const folderBtn = el("button", { className: "btn", textContent: "Create folder", type: "button" });
 folderBtn.onclick = () => run(folderBtn, async () => {
 const name = cleanName(folderIn.value);
 if (!name) throw new Error("Enter a folder name");
 await createFolder([...currentPath, name].join("/"));
 currentPath = [...currentPath, name];
 await loadFiles();
 showMsg("Folder created: " + name, true);
 });

 adminPanel.append(
 el("h2", { textContent: "New folder" }),
 el("div", { className: "row" }, folderIn, folderBtn)
 );

 // PDF upload
 const pdfIn = el("input", { type: "file", accept: "application/pdf" });
 const pdfName = el("input", { type: "text", placeholder: "PDF name (optional)" });
 const upBtn = el("button", { className: "btn", textContent: "Upload PDF", type: "button" });
 upBtn.onclick = () => run(upBtn, async () => {
 const file = pdfIn.files[0];
 if (!file) throw new Error("Select a PDF first");
 if (file.size > 95 * 1024 * 1024) throw new Error("File is too large (max ~95MB)");

 const base = cleanName(pdfName.value || file.name).replace(/\.pdf$/i, "").trim();
 if (!base) throw new Error("Enter a PDF name");

 const name = base + ".pdf";
 await uploadPdf(file, [...currentPath, name].join("/"));
 pdfIn.value = "";
 pdfName.value = "";
 await loadFiles();
 showMsg("Uploaded: " + name, true);
 });

 adminPanel.append(
 el("h2", { textContent: "Upload PDF to this folder" }),
 el("div", { className: "row" }, pdfIn),
 el("div", { className: "row" }, pdfName, upBtn)
 );
 }

 adminMsg = el("div", { className: "hint" });
 adminPanel.append(adminMsg);
}

// Admin face check finished: show the admin panel now
window.addEventListener("face-ok", renderAdmin);

// ---------- events ----------
searchEl.addEventListener("input", render);
if (sortEl) sortEl.addEventListener("change", render);