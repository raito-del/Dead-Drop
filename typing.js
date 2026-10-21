// Types the terminal lines on the home page, then reveals the button.
const lines = [
  "> dead-drop --open",
  "",
  "> whoami",
  "cse student. notes inside.",
  "",
  "> ls notes/",
  "lecture slides, lab sheets, exam prep",
  "",
  "> sudo open notes",
];
const out = document.getElementById("typed");
const enter = document.getElementById("enter");
const text = lines.join("\n");

if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  out.textContent = text;
  enter.hidden = false;
} else {
  let i = 0;
  const timer = setInterval(() => {
    out.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(timer);
      enter.hidden = false;
    }
  }, 40);
}