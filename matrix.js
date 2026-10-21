// ============================================
//  Matrix rain background
//  HTML-এ <canvas id="matrix"></canvas> থাকতে হবে
// ============================================

const canvas = document.getElementById("matrix");

if (canvas) {
  const ctx = canvas.getContext("2d");
  const chars = "01アイウエオカキクケコサシスセソABCDEFGHIJKLMNOPQRSTUVWXYZ<>/{}[]#$%&*+=";
  const size = 16;
  let drops = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const columns = Math.floor(canvas.width / size);
    drops = Array.from({ length: columns }, () => Math.random() * -50);
  }

  function draw() {
    // আগের ফ্রেম ধীরে ধীরে ঝাপসা হয়ে লেজ তৈরি করে
    ctx.fillStyle = "rgba(5, 8, 5, 0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#00ff66";
    ctx.font = size + "px monospace";

    for (let i = 0; i < drops.length; i++) {
      const text = chars.charAt(Math.floor(Math.random() * chars.length));
      ctx.fillText(text, i * size, drops[i] * size);

      if (drops[i] * size > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  resize();
  window.addEventListener("resize", resize);
  setInterval(draw, 50);
}