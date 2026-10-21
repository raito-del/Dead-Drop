// ============================================
//  Notes page: লগইন চেক, ফোল্ডার ভিউ, সার্চ, অ্যাডমিন (ফোল্ডার + আপলোড)
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
let currentPath = [];  // এখন কোন ফোল্ডারে আছি
let isAdminUser = false;
let adminMsg = null;

// ---------- helper ----------
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
};

// ফোল্ডার/ফাইলের নাম থেকে GitHub-এ সমস্যা করে এমন চিহ্ন বাদ
function cleanName(s) {
  return s
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
}

// segs কি path-এর ভেতরে (বা ঠিক সেখানে) আছে?
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
  showMsg("কাজ চলছে...", true);
  try {
    await fn();
  } catch (err) {
    showMsg("ত্রুটি: " + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ---------- লগইন গার্ড ----------
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

// ---------- GitHub থেকে সব ফাইল ও ফোল্ডার ----------
async function loadFiles() {
  statusEl.textContent = "লোড হচ্ছে...";
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
    statusEl.textContent = "লিস্ট আনা যায়নি: " + err.message;
  }
}

// ---------- রেন্ডার ----------
function render() {
  const q = searchEl.value.trim().toLowerCase();
  listEl.innerHTML = "";

  if (q) {
    crumbsEl.textContent = "সার্চ ফলাফল (সব ফোল্ডার থেকে)";
    const matches = allFiles.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
    statusEl.textContent = matches.length ? "" : "কিছু পাওয়া যায়নি।";
    matches.forEach((f) => listEl.append(fileRow(f, f.folders.join(" / "))));
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

  subfolders.forEach((name) => {
    const count = allFiles.filter(
      (f) => f.folders.length > depth && under(f.folders, currentPath) && f.folders[depth] === name
    ).length;
    listEl.append(folderRow(name, count));
  });
  files.forEach((f) => listEl.append(fileRow(f, "")));

  if (!allFiles.length && !subfolders.length) statusEl.textContent = "notes ফোল্ডারে এখনো কিছু নেই।";
  else if (!subfolders.length && !files.length) statusEl.textContent = "এই ফোল্ডারে এখনো কিছু নেই।";
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
    el("div", { className: "file-meta", textContent: "ফোল্ডার · " + count + " টি PDF" })
  );
  return el("div", { className: "file" }, info, open);
}

function fileRow(f, label) {
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
  return el("div", { className: "file" }, info, dl);
}

// ---------- অ্যাডমিন প্যানেল ----------
function renderAdmin() {
  if (!isAdminUser) return;
  adminPanel.classList.remove("hidden");
  adminPanel.replaceChildren();

  const where = "notes" + (currentPath.length ? " / " + currentPath.join(" / ") : "");
  adminPanel.append(
    el("h2", { textContent: "admin: ফোল্ডার ও PDF" }),
    el("div", { className: "hint", textContent: "এখন আছো: " + where })
  );

  if (!getToken()) {
    const tok = el("input", { type: "password", placeholder: "GitHub টোকেন (একবার বসাও)", autocomplete: "off" });
    const save = el("button", { className: "btn", textContent: "সেভ", type: "button" });
    save.onclick = () => {
      if (!tok.value.trim()) return showMsg("টোকেন খালি");
      saveToken(tok.value);
      renderAdmin();
    };
    adminPanel.append(el("div", { className: "row" }, tok, save));
  } else {
    const clearBtn = el("button", { className: "btn ghost", textContent: "টোকেন মুছো", type: "button" });
    clearBtn.onclick = () => { clearToken(); renderAdmin(); };
    adminPanel.append(
      el("div", { className: "hint", textContent: "GitHub টোকেন এই ব্রাউজারে সেভ আছে।" }),
      clearBtn
    );

    // নতুন ফোল্ডার
    const folderIn = el("input", { type: "text", placeholder: "নতুন ফোল্ডারের নাম" });
    const folderBtn = el("button", { className: "btn", textContent: "ফোল্ডার বানাও", type: "button" });
    folderBtn.onclick = () => run(folderBtn, async () => {
      const name = cleanName(folderIn.value);
      if (!name) throw new Error("ফোল্ডারের নাম লেখো");
      await createFolder([...currentPath, name].join("/"));
      currentPath = [...currentPath, name];
      await loadFiles();
      showMsg("ফোল্ডার তৈরি হয়েছে: " + name, true);
    });
    adminPanel.append(
      el("h2", { textContent: "নতুন ফোল্ডার" }),
      el("div", { className: "row" }, folderIn, folderBtn)
    );

    // PDF আপলোড
    const pdfIn = el("input", { type: "file", accept: "application/pdf" });
    const pdfName = el("input", { type: "text", placeholder: "PDF-এর নাম (ঐচ্ছিক)" });
    const upBtn = el("button", { className: "btn", textContent: "PDF আপলোড", type: "button" });
    upBtn.onclick = () => run(upBtn, async () => {
      const file = pdfIn.files[0];
      if (!file) throw new Error("আগে PDF সিলেক্ট করো");
      if (file.size > 95 * 1024 * 1024) throw new Error("ফাইল অনেক বড় (সর্বোচ্চ ~95MB)");

      const base = cleanName(pdfName.value || file.name).replace(/\.pdf$/i, "").trim();
      if (!base) throw new Error("PDF-এর নাম লেখো");
      const name = base + ".pdf";

      await uploadPdf(file, [...currentPath, name].join("/"));
      pdfIn.value = "";
      pdfName.value = "";
      await loadFiles();
      showMsg("আপলোড হয়েছে: " + name, true);
    });
    adminPanel.append(
      el("h2", { textContent: "এই ফোল্ডারে PDF আপলোড" }),
      el("div", { className: "row" }, pdfIn),
      el("div", { className: "row" }, pdfName, upBtn)
    );
  }

  adminMsg = el("div", { className: "hint" });
  adminPanel.append(adminMsg);
}

searchEl.addEventListener("input", render);