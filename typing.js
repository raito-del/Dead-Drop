// ============================================
//  Terminal typing effect
//  index.html-এ id="typing-lines" আর id="gate" থাকতে হবে
// ============================================
import { SITE_NAME } from "./config.js";

const box = document.getElementById("typing-lines");
const gate = document.getElementById("gate");

// এখানে লাইন বদলে নিজের মতো করতে পারো
const lines = [
  "> booting " + SITE_NAME.toLowerCase() + " ...",
  "> establishing secure connection ...",
  "> encryption layer: OK",
  "> access restricted. authentication required.",
];

const SPEED = 35;   // প্রতি অক্ষরের মিলিসেকেন্ড
const PAUSE = 350;  // এক লাইন শেষে বিরতি

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  if (!box) return;

  for (const text of lines) {
    const line = document.createElement("div");
    line.className = "line prompt";
    box.appendChild(line);

    for (const ch of text) {
      line.textContent += ch;
      await sleep(SPEED);
    }
    await sleep(PAUSE);
  }

  const cursor = document.createElement("span");
  cursor.className = "cursor";
  box.lastChild.appendChild(cursor);

  if (gate) {
    gate.classList.remove("hidden");
    const input = gate.querySelector("input");
    if (input) input.focus();
  }
}

run();