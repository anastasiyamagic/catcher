const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const missedEl = document.getElementById("missed");
const leaderboardListEl = document.getElementById("leaderboard-list");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("start-btn");

const leftBtn = document.getElementById("left-btn");
const rightBtn = document.getElementById("right-btn");

const state = {
  running: false,
  score: 0,
  missed: 0,
  playerName: "Guest",
  best: Number(localStorage.getItem("mushroom-money-best") || 0),
  leaderboard: JSON.parse(localStorage.getItem("mushroom-money-leaderboard") || "[]"),
  player: {
    x: 450,
    y: 440,
    w: 80,
    h: 76,
    speed: 14,
  },
  items: [],
  keys: { left: false, right: false },
  spawnEvery: 750,
  lastSpawn: 0,
  speedBoost: 0,
  rafId: null,
  lastFrame: 0,
  cloudOffset: 0,
};

bestEl.textContent = String(state.best);

function renderLeaderboard() {
  leaderboardListEl.innerHTML = "";

  if (state.leaderboard.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No scores yet. Start playing.";
    leaderboardListEl.append(li);
    return;
  }

  state.leaderboard.forEach((entry, idx) => {
    const li = document.createElement("li");
    const scoreText = document.createTextNode(
      `#${idx + 1}  ${entry.name || "Guest"} - ${entry.score} pts`
    );
    const dateText = document.createElement("span");
    dateText.textContent = entry.date;
    li.append(scoreText, dateText);
    leaderboardListEl.append(li);
  });
}

function recordScore(score) {
  const now = new Date();
  const date = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  state.leaderboard.push({ name: state.playerName, score, date });
  state.leaderboard.sort((a, b) => b.score - a.score);
  state.leaderboard = state.leaderboard.slice(0, 8);
  localStorage.setItem("mushroom-money-leaderboard", JSON.stringify(state.leaderboard));
  renderLeaderboard();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  missedEl.textContent = String(state.missed);
}

function resetGame() {
  state.score = 0;
  state.missed = 0;
  state.items = [];
  state.spawnEvery = 750;
  state.speedBoost = 0;
  state.lastSpawn = 0;
  state.lastFrame = 0;
  state.player.x = (canvas.width - state.player.w) / 2;
  updateHud();
}

function drawCloud(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255, 241, 225, 0.78)";
  ctx.beginPath();
  ctx.arc(20, 25, 16, 0, Math.PI * 2);
  ctx.arc(38, 20, 18, 0, Math.PI * 2);
  ctx.arc(58, 26, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPalmTree(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.strokeStyle = "#1f1039";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -55, 12, -120);
  ctx.stroke();

  ctx.strokeStyle = "#2b1550";
  ctx.lineWidth = 5;
  const leaves = [
    [12, -120, 64, -148],
    [12, -120, 56, -112],
    [12, -120, 12, -170],
    [12, -120, -38, -156],
    [12, -120, -50, -118],
  ];
  leaves.forEach(([sx, sy, ex, ey]) => {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) / 2, sy - 10, ex, ey);
    ctx.stroke();
  });

  ctx.restore();
}

function drawBackground(dt) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBlockemon() {
  const { x, y, w, h } = state.player;
  const p = Math.max(2, Math.floor(w / 12));
  const ox = Math.round(x + (w - p * 12) / 2);
  const oy = Math.round(y + (h - p * 12) / 2);

  const palette = {
    hair: "#f51e5f",
    black: "#090909",
    skin: "#e39a63",
    shirt: "#ffd27c",
    bg: "#0f1016",
  };

  // Back plate keeps the sprite crisp against the sunset background.
  ctx.fillStyle = palette.bg;
  ctx.fillRect(ox - p, oy - p, p * 14, p * 14);

  const cells = [
    ["hair", [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1]],
    ["hair", [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10]],
    ["hair", [9, 2], [9, 3], [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9], [9, 10]],
    ["black", [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4]],
    ["skin", [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5]],
    ["skin", [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6]],
    ["black", [4, 6], [7, 6]],
    ["skin", [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7]],
    ["black", [5, 7], [6, 7], [7, 7]],
    ["shirt", [4, 8], [5, 8], [6, 8], [7, 8]],
    ["shirt", [4, 9], [5, 9], [6, 9], [7, 9]],
    ["hair", [1, 4], [10, 4], [1, 5], [10, 5]],
    ["shirt", [10, 6]],
  ];

  cells.forEach(([color, ...coords]) => {
    ctx.fillStyle = palette[color];
    coords.forEach(([cx, cy]) => {
      ctx.fillRect(ox + cx * p, oy + cy * p, p, p);
    });
  });
}

function drawDollarToken(token) {
  ctx.save();
  ctx.translate(token.x + token.w / 2, token.y + token.h / 2);
  ctx.rotate(token.tilt);

  const r = token.w * 0.22;
  ctx.fillStyle = "#00d54b";
  ctx.beginPath();
  ctx.roundRect(-token.w / 2, -token.h / 2, token.w, token.h, r);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-token.w / 2 + 1.2, -token.h / 2 + 1.2, token.w - 2.4, token.h - 2.4, r - 1);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.floor(token.w * 0.66)}px Space Grotesk`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, token.h * 0.05);
  ctx.restore();
}

function drawAnimalCard(item) {
  ctx.save();
  ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
  ctx.rotate(item.tilt);

  const cardW = item.w;
  const cardH = item.h;
  const radius = Math.max(8, cardW * 0.12);

  ctx.fillStyle = "#120906";
  ctx.beginPath();
  ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.beginPath();
  ctx.roundRect(-cardW / 2 + 2, -cardH / 2 + 2, cardW - 4, cardH - 4, radius - 2);
  ctx.fill();

  item.spots.forEach((spot) => {
    ctx.fillStyle = spot.color;
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y, spot.rx, spot.ry, spot.rot, 0, Math.PI * 2);
    ctx.fill();
  });

  const chipW = cardW * 0.22;
  const chipH = cardH * 0.22;
  const chipX = -cardW * 0.36;
  const chipY = -cardH * 0.05;
  const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
  chipGrad.addColorStop(0, "#e4d39a");
  chipGrad.addColorStop(1, "#b59d63");
  ctx.fillStyle = chipGrad;
  ctx.beginPath();
  ctx.roundRect(chipX, chipY, chipW, chipH, 3);
  ctx.fill();

  ctx.strokeStyle = "rgba(130, 108, 58, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chipX + chipW * 0.5, chipY);
  ctx.lineTo(chipX + chipW * 0.5, chipY + chipH);
  ctx.moveTo(chipX, chipY + chipH * 0.5);
  ctx.lineTo(chipX + chipW, chipY + chipH * 0.5);
  ctx.stroke();

  ctx.fillStyle = "#c8b269";
  ctx.font = `600 ${Math.max(10, Math.floor(cardH * 0.17))}px Space Grotesk`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("$ree", cardW * 0.4, -cardH * 0.36);

  ctx.fillStyle = "#f5e8bc";
  ctx.font = `700 ${Math.max(11, Math.floor(cardH * 0.2))}px Space Grotesk`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("10x", 0, cardH * 0.32);
  ctx.restore();
}

function spawnCollectible(now) {
  if (now - state.lastSpawn < state.spawnEvery) {
    return;
  }

  state.lastSpawn = now;
  const isCard = Math.random() < 0.18;

  if (isCard) {
    const w = 118 + Math.random() * 30;
    const h = w * 0.64;
    const x = Math.random() * (canvas.width - w);
    const spots = Array.from({ length: 12 }, () => ({
      x: -w * 0.35 + Math.random() * w * 0.7,
      y: -h * 0.33 + Math.random() * h * 0.66,
      rx: 10 + Math.random() * 16,
      ry: 8 + Math.random() * 14,
      rot: Math.random(),
      color: Math.random() > 0.5 ? "rgba(169, 76, 46, 0.86)" : "rgba(137, 52, 33, 0.82)",
    }));
    state.items.push({
      kind: "card",
      x,
      y: -h,
      w,
      h,
      speed: 2 + Math.random() * 1.4 + state.speedBoost * 0.9,
      tilt: (Math.random() - 0.5) * 0.18,
      points: 10,
      spots,
    });
  } else {
    const size = 30 + Math.random() * 14;
    const x = Math.random() * (canvas.width - size);
    state.items.push({
      kind: "dollar",
      x,
      y: -size,
      w: size,
      h: size,
      speed: 2.2 + Math.random() * 1.8 + state.speedBoost,
      tilt: (Math.random() - 0.5) * 0.22,
      points: 1,
    });
  }

  if (state.spawnEvery > 300) {
    state.spawnEvery -= 4;
  }
  state.speedBoost += 0.01;
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function endGame() {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  recordScore(state.score);
  overlayTitle.textContent = "Round Over";
  overlayMessage.textContent = `You scored ${state.score} points. Catch cards for 10x points.`;
  startBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

function update(now) {
  if (!state.running) {
    return;
  }

  if (!state.lastFrame) {
    state.lastFrame = now;
  }

  const dt = Math.min((now - state.lastFrame) / 16.67, 2);
  state.lastFrame = now;

  if (state.keys.left) {
    state.player.x -= state.player.speed * dt;
  }
  if (state.keys.right) {
    state.player.x += state.player.speed * dt;
  }

  state.player.x = Math.max(0, Math.min(canvas.width - state.player.w, state.player.x));

  spawnCollectible(now);

  state.items.forEach((item) => {
    item.y += item.speed * dt;

    if (intersects(state.player, item)) {
      item.caught = true;
      state.score += item.points;
    } else if (item.y > canvas.height + 4) {
      item.missed = true;
      state.missed += 1;
    }
  });

  state.items = state.items.filter((item) => !item.caught && !item.missed);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("mushroom-money-best", String(state.best));
  }

  drawBackground(dt);
  state.items.forEach((item) => {
    if (item.kind === "card") {
      drawAnimalCard(item);
    } else {
      drawDollarToken(item);
    }
  });
  drawBlockemon();
  updateHud();

  if (state.missed >= 10) {
    endGame();
    return;
  }

  state.rafId = requestAnimationFrame(update);
}

function startGame() {
  const askedName = window.prompt("Enter your username for the leaderboard:", state.playerName);
  const cleanedName = (askedName || "").trim();
  state.playerName = cleanedName || "Guest";
  resetGame();
  state.running = true;
  overlay.classList.add("hidden");
  state.rafId = requestAnimationFrame(update);
}

function setArrowState(code, value) {
  if (code === "ArrowLeft") {
    state.keys.left = value;
  }
  if (code === "ArrowRight") {
    state.keys.right = value;
  }
}

window.addEventListener("keydown", (event) => {
  setArrowState(event.code, true);
});

window.addEventListener("keyup", (event) => {
  setArrowState(event.code, false);
});

function bindTouchButton(button, side) {
  const down = () => {
    state.keys[side] = true;
  };
  const up = () => {
    state.keys[side] = false;
  };

  button.addEventListener("touchstart", down, { passive: true });
  button.addEventListener("touchend", up, { passive: true });
  button.addEventListener("touchcancel", up, { passive: true });
  button.addEventListener("mousedown", down);
  button.addEventListener("mouseup", up);
  button.addEventListener("mouseleave", up);
}

bindTouchButton(leftBtn, "left");
bindTouchButton(rightBtn, "right");
startBtn.addEventListener("click", startGame);

drawBackground(0);
drawBlockemon();
updateHud();
renderLeaderboard();
