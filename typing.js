// ============================================
//  Terminal typing effect
//  index.html must have id="typing-lines" and id="gate"
// ============================================
import { SITE_NAME } from "./config.js";

const box = document.getElementById("typing-lines");
const gate = document.getElementById("gate");

// Change these lines to whatever you like
const lines = [
  "> booting " + SITE_NAME.toLowerCase() + " ...",
  "> establishing secure connection ...",
  "> encryption layer: OK",
  "> access restricted. authentication required.",
];

const SPEED = 35;   // milliseconds per character
const PAUSE = 350;  // pause after each line

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