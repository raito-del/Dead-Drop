// Everything for creating folders and uploading PDFs to GitHub lives here.
import { GITHUB } from "./config.js";

const TOKEN_KEY = "dd_gh_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const saveToken = (t) => localStorage.setItem(TOKEN_KEY, t.trim());
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const API = `https://api.github.com/repos/${GITHUB.user}/${GITHUB.repo}/contents`;

const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

async function putFile(repoPath, base64Content, message) {
  const token = getToken();
  if (!token) throw new Error("Please save a GitHub token first");

  const res = await fetch(`${API}/${encPath(repoPath)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: GITHUB.branch,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Token is invalid or does not have permission");
  }
  if (res.status === 422 || res.status === 409) {
    throw new Error("A folder or file with this name already exists");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "HTTP " + res.status);
  }
}

// A folder is created by adding an empty .gitkeep file inside it (GitHub does not store empty folders)
export async function createFolder(rel) {
  await putFile(`${GITHUB.folder}/${rel}/.gitkeep`, "", `Create folder ${rel}`);
}

export async function uploadPdf(file, rel) {
  const base64 = await fileToBase64(file);
  await putFile(`${GITHUB.folder}/${rel}`, base64, `Upload ${rel}`);
}