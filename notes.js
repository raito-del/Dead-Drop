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

// Sort the file list according to the dropdown (name A-Z if there is no dropdown)
function sortFiles(list) {
 const mode = sortEl ? sortEl.value : "name";
 return [...list].sort((a, b) => {
 if (mode === "size") return b.size - a.size;
 if (mode === "name-desc") return b.name.localeCompare(a.name);
 return a.name.localeCompare(b.name);
 });
}

// ---------- guard ----------
// The notes page opens only after the face check (or password) on index.html.
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
async function loadFiles() {
 statusEl.textContent = "Loading...";
 const api =
 `https://api.github.com/repos/${GITHUB.user}/${GITHUB.repo}/git/trees/${GITHUB.branch}?recursive=1`;
 try {
 const res = await fetch(api, { cache: "no-store" });
 if (!res.ok) throw new Error("HTTP " + res.status);
 const data = await res.json();

 const prefix = GITHUB.folder + "/";
 allFiles = [];
 const folderSet = new Map();

 for (const item of data.tree) {
 if (!item.path.startsWith(prefix)) continue;
 const rel = item.path.slice(prefix.length);
 const parts = rel.split("/");

 if (item.type === "tree") {
 folderSet.set(rel, parts);
 continue;
 }
 if (item.type !== "blob") continue;

 for (let i = 1; i < parts.length; i++) {
 const p = parts.slice(0, i);
 folderSet.set(p.join("/"), p);
 }

 if (/\.pdf$/i.test(rel)) {
 allFiles.push({
 name: parts[parts.length - 1],
 path: rel,
 folders: parts.slice(0, -1),
 size: item.size,
 });
 }
 }

 allFolders = [...folderSet.values()];
 allFiles.sort((a, b) => a.path.localeCompare(b.path));
 render();
 renderAdmin();
 } catch (err) {
 statusEl.textContent = "Could not load the list: " + err.message;
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

 const meta = [label, sizeText(f.size)].filter(Boolean).join(" ·