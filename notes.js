// ============================================
//  Notes page: লগইন চেক, PDF লিস্ট, সার্চ
// ============================================
import { GITHUB } from "./config.js";
import { watchAuth, logout, isAdmin } from "./auth.js";

const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logout");
const adminPanel = document.getElementById("admin-panel");
const uploadBtn = document.getElementById("upload-btn");
const content = document.getElementById("content");

let files = [];

// ---------- লগইন গার্ড ----------
watchAuth((user) => {
  if (!user) {
    // লগইন নেই: কিছু না দেখিয়ে হোম পেজে পাঠাও
    location.replace("index.html");
    return;
  }
  content.classList.remove("hidden");
  if (isAdmin(user)) adminPanel.classList.remove("hidden");
  loadFiles();
});

logoutBtn.addEventListener("click", async () => {
  await logout();
  location.replace("index.html");
});

// ---------- Admin: GitHub আপলোড পেজ খোলে ----------
uploadBtn.addEventListener("click", () => {
  const url =
    "https://github.com/" + GITHUB.user + "/" + GITHUB.repo +
    "/upload/" + GITHUB.branch + "/" + GITHUB.folder;
  window.open(url, "_blank");
});

// ---------- GitHub থেকে ফাইলের লিস্ট ----------
async function loadFiles() {
  statusEl.textContent = "লোড হচ্ছে...";
  const api =
    "https://api.github.com/repos/" + GITHUB.user + "/" + GITHUB.repo +
    "/contents/" + GITHUB.folder + "?ref=" + GITHUB.branch;
  try {
    const res = await fetch(api);
    if (res.status === 404) {
      statusEl.textContent = "notes ফোল্ডারে এখনো কোনো ফাইল নেই।";
      return;
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    files = data
      .filter((f) => f.type === "file" && f.name.toLowerCase().endsWith(".pdf"))
      .map((f) => ({
        name: f.name,
        size: f.size,
        url: f.download_url,
      }));
    statusEl.textContent = files.length ? "" : "notes ফোল্ডারে এখনো কোনো PDF নেই।";
    render();
  } catch (err) {
    statusEl.textContent = "লিস্ট আনা যায়নি: " + err.message;
  }
}

// ---------- লিস্ট দেখানো ----------
function sizeText(bytes) {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  listEl.innerHTML = "";

  files
    .filter((f) => f.name.toLowerCase().includes(q))
    .forEach((f) => {
      const row = document.createElement("div");
      row.className = "file";

      const info = document.createElement("div");
      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = f.name.replace(/\.pdf$/i, "");
      const meta = document.createElement("div");
      meta.className = "file-meta";
      meta.textContent = sizeText(f.size);
      info.append(name, meta);

      const dl = document.createElement("a");
      dl.className = "btn";
      dl.textContent = "Download";
      dl.href = f.url;
      dl.target = "_blank";
      dl.rel = "noopener";
      dl.setAttribute("download", f.name);

      row.append(info, dl);
      listEl.appendChild(row);
    });
}

searchEl.addEventListener("input", render);