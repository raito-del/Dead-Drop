// ============================================
//  Notes page: login check, folder view, search, admin (folders + upload)
// ============================================
import { GITHUB } from "./config.js";
import { watchAuth, logout, isAdmin } from "./auth.js";
import { getToken, saveToken, clearToken, createFolder, uploadPdf } from "./github.js";

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const searchEl = $("search");
const statusEl = $("status");
const content = $("content");
const adminPanel = $("admin-panel");
const logoutBtn = $("logout");

const crumbsEl = document.createElement("div");
crumbsEl.className = "crumbs";
listEl.before(crumbsEl);

let allFiles = [];     // { name, path, folders[], size }
let allFolders = [];   // [["first-year"], ["first-year", "cp-2"]]
let currentPath = [];  // the folder the user is currently in
let isAdminUser = false;
let adminMsg = null;

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

// ---------- login guard ----------
watchAuth((user) => {
  if (!user) { location.replace("index.html"); return; }
  content.classList.remove("hidden");
  isAdminUser = isAdmin(user);
  renderAdmin();
  loadFiles();
});

logoutBtn.addEventListener("click", async () => {
  await logout();
  location.replace("index.html");
});

// ---------- load all files and folders from GitHub ----------
async function loadFiles() {
  statusEl.textContent = "Loading...";
  const api = `https://api.github.com/repos/${GITHUB.user}/${GITHUB.repo}/git/trees/${GITHUB.branch}?recursive=1`;
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

  if (q) {
    crumbsEl.textContent = "Search results (from all folders)";
    const matches = allFiles.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
    statusEl.textContent = matches.length ? "" : "Nothing found.";
    matches.forEach((f) => listEl.append(fileRow(f, f.folders.join(" / "))));
    return;
  }

  renderCrumbs();
  const depth = currentPath.length;

  const subfolders = [
    ...new Set(
      allFolders