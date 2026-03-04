const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const BEST_KEY = "mushroom-money-best";
const LEADERBOARD_KEY = "mushroom-money-leaderboard";
const LEADERBOARD_RESET_KEY = "mushroom-money-leaderboard-reset-v1";

if (!localStorage.getItem(LEADERBOARD_RESET_KEY)) {
  localStorage.removeItem(LEADERBOARD_KEY);
  localStorage.setItem(LEADERBOARD_RESET_KEY, "1");
}

const THEME = {
  bgTop: "#0a0d12",
  bgMid: "#121922",
  bgBot: "#0e141d",
  cloud: "rgba(176, 186, 201, 0.12)",
  palmTrunk: "#0d1118",
  palmLeaf: "#131a23",
  starRgb: "217, 225, 236",
  glowRgb: "0, 213, 75",
  skyline: "#18202b",
  ground: "#0a0f16",
  gridNear: "rgba(197, 209, 225, 0.12)",
  gridFar: "rgba(197, 209, 225, 0.07)",
  catchRgb: "166, 255, 231",
  blockemon: {
    hair: "#151922",
    black: "#090909",
    skin: "#c99673",
    shirt: "#2f3747",
    beard: "#0f131b",
    nose: "#b88261",
    bg: "#10172a",
  },
  dollar: {
    fill: "#00c95a",
    stroke: "rgba(255, 255, 255, 0.26)",
    glyph: "#f6fff9",
  },
  square: {
    outer: "#f2f8ff",
    inner: "#05070a",
  },
  card: {
    aura: "rgba(255, 205, 118, 0.78)",
    auraStroke: "rgba(255, 205, 118, 0.82)",
    body: "#120906",
    overlay: "rgba(255, 255, 255, 0.05)",
    chipA: "#e3cf92",
    chipB: "#b59a60",
    chipStroke: "rgba(130, 108, 58, 0.68)",
    textTop: "#c6b066",
    textBottom: "#f3e4b9",
    spotA: "rgba(172, 86, 56, 0.86)",
    spotB: "rgba(137, 56, 35, 0.82)",
  },
  particles: {
    dollar: "142, 255, 188",
    square: "225, 239, 255",
    card: "255, 220, 140",
    miss: "255, 138, 138",
    step: "184, 198, 216",
  },
};

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
  lastEntryId: null,
  playerName: "Guest",
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  leaderboard: JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]"),
  player: {
    x: 450,
    y: 440,
    groundY: 440,
    w: 80,
    h: 76,
    speed: 14,
    vx: 0,
    vy: 0,
    gravity: 0.9,
    jumpPower: 13.8,
    accel: 1.1,
    drag: 0.84,
    maxSpeed: 17,
    catchPadX: 10,
    catchPadTop: 18,
    catchPadBottom: 4,
  },
  items: [],
  particles: [],
  keys: { left: false, right: false, up: false },
  spawnEvery: 760,
  spawnCurrent: 760,
  lastSpawn: 0,
  speedBoost: 0,
  gameTime: 0,
  shake: 0,
  hitStop: 0,
  rafId: null,
  lastFrame: 0,
  cloudOffset: 0,
  animTime: 0,
  catchFlash: 0,
  stars: Array.from({ length: 56 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * (canvas.height * 0.55),
    r: 0.6 + Math.random() * 1.8,
    p: Math.random() * Math.PI * 2,
  })),
};

bestEl.textContent = String(state.best);

function normalizeLeaderboard(entries) {
  return entries
    .map((entry) => {
      const rawName = String(entry.name || "Guest").trim();
      const name = rawName.length > 16 ? `${rawName.slice(0, 15)}…` : rawName || "Guest";
      const score = Number(entry.score);
      const date = entry.date ? String(entry.date) : "--:--";
      return { id: entry.id || null, name, score, date };
    })
    .filter((entry) => Number.isFinite(entry.score) && entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function renderLeaderboard() {
  state.leaderboard = normalizeLeaderboard(state.leaderboard);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(state.leaderboard));
  leaderboardListEl.innerHTML = "";

  if (state.leaderboard.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-row";
    li.textContent = "Play a round to set your first record.";
    leaderboardListEl.append(li);
    return;
  }

  state.leaderboard.forEach((entry, idx) => {
    const li = document.createElement("li");
    if (entry.id && entry.id === state.lastEntryId) {
      li.classList.add("is-new");
    }

    const main = document.createElement("div");
    main.className = "leader-main";

    const rank = document.createElement("span");
    rank.className = `rank-badge rank-${Math.min(idx + 1, 3)}`;
    rank.textContent = String(idx + 1);

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = entry.name;

    main.append(rank, name);

    const score = document.createElement("span");
    score.className = "score-pill";
    score.textContent = `${entry.score} pts`;

    const time = document.createElement("span");
    time.className = "run-time";
    time.textContent = entry.date || "--:--";

    li.append(main, score, time);
    leaderboardListEl.append(li);
  });
}

function recordScore(score) {
  const now = new Date();
  const date = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const entryId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const rawName = String(state.playerName || "Guest").trim();
  const name = rawName.length > 16 ? `${rawName.slice(0, 15)}…` : rawName || "Guest";
  state.leaderboard.push({ id: entryId, name, score, date });
  state.leaderboard = normalizeLeaderboard(state.leaderboard);
  state.lastEntryId = entryId;
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(state.leaderboard));
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
  state.particles = [];
  state.spawnEvery = 760;
  state.spawnCurrent = 760;
  state.speedBoost = 0;
  state.gameTime = 0;
  state.shake = 0;
  state.hitStop = 0;
  state.lastSpawn = 0;
  state.lastFrame = 0;
  state.catchFlash = 0;
  state.player.x = (canvas.width - state.player.w) / 2;
  state.player.y = state.player.groundY;
  state.player.vx = 0;
  state.player.vy = 0;
  updateHud();
}

function drawCloud(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = THEME.cloud;
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

  ctx.strokeStyle = THEME.palmTrunk;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -55, 12, -120);
  ctx.stroke();

  ctx.strokeStyle = THEME.palmLeaf;
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
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, THEME.bgTop);
  grad.addColorStop(0.58, THEME.bgMid);
  grad.addColorStop(1, THEME.bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.stars.forEach((star, idx) => {
    const flicker = 0.45 + 0.55 * Math.sin(state.animTime * 0.0015 + star.p);
    const drift = Math.sin(state.animTime * 0.0007 + idx) * 1.6;
    ctx.fillStyle = `rgba(${THEME.starRgb}, ${0.07 + flicker * 0.12})`;
    ctx.beginPath();
    ctx.arc(star.x + drift, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const glow = ctx.createRadialGradient(
    canvas.width * 0.78,
    canvas.height * 0.24,
    10,
    canvas.width * 0.78,
    canvas.height * 0.24,
    canvas.width * 0.34
  );
  glow.addColorStop(0, `rgba(${THEME.glowRgb}, 0.22)`);
  glow.addColorStop(1, `rgba(${THEME.glowRgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.cloudOffset += 0.21 * dt;
  const shift = state.cloudOffset % 240;
  const layerA = [58, 162, 286, 430, 598, 738];
  const layerB = [24, 138, 254, 400, 552, 700, 832];

  ctx.strokeStyle = "rgba(210, 219, 232, 0.08)";
  ctx.lineWidth = 1.1;
  layerA.forEach((baseX, idx) => {
    const x = (baseX + shift * (idx % 2 === 0 ? 0.2 : 0.28)) % (canvas.width + 120) - 60;
    const y = 72 + (idx % 3) * 18;
    ctx.beginPath();
    ctx.roundRect(x, y, 58, 58, 14);
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(210, 219, 232, 0.06)";
  layerB.forEach((baseX, idx) => {
    const x = (baseX - shift * (idx % 2 === 0 ? 0.14 : 0.2)) % (canvas.width + 120) - 60;
    const y = 148 + (idx % 3) * 22;
    ctx.beginPath();
    ctx.roundRect(x, y, 46, 46, 11);
    ctx.stroke();
  });

  const tileBands = [0.42, 0.57, 0.72];
  tileBands.forEach((ratio, bandIdx) => {
    const y = canvas.height * ratio;
    const tileW = 84 - bandIdx * 10;
    const gap = 22 - bandIdx * 3;
    const offset = (state.cloudOffset * (bandIdx + 1) * 0.9) % (tileW + gap);
    ctx.fillStyle = bandIdx === 0 ? "rgba(34, 45, 60, 0.65)" : "rgba(26, 35, 48, 0.68)";
    for (let x = -tileW; x < canvas.width + tileW; x += tileW + gap) {
      ctx.beginPath();
      ctx.roundRect(x + offset, y, tileW, 44, 10);
      ctx.fill();
    }
  });

  ctx.strokeStyle = THEME.gridFar;
  ctx.lineWidth = 1;
  for (let y = canvas.height * 0.42; y < canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = THEME.gridNear;
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height * 0.4);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawBlockemon() {
  const { x, y, w, h } = state.player;
  const moving = state.keys.left || state.keys.right;
  const bob = moving
    ? Math.sin(state.animTime * 0.028) * 1.6
    : Math.sin(state.animTime * 0.014) * 2.4;
  const runFrame = moving && Math.floor(state.animTime / 90) % 2 === 1;
  const p = Math.max(2, Math.floor(w / 12));
  const ox = Math.round(x + (w - p * 12) / 2);
  const oy = Math.round(y + (h - p * 12) / 2 + bob);
  const legTop = oy + p * 10;

  const palette = THEME.blockemon;

  const cells = [
    ["hair", [4, 1], [5, 1], [6, 1], [7, 1]],
    ["hair", [3, 2], [4, 2], [7, 2], [8, 2]],
    ["skin", [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3]],
    ["skin", [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4]],
    ["black", [4, 4], [7, 4]],
    ["skin", [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5]],
    ["nose", [5, 5], [6, 5]],
    ["beard", [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6]],
    ["beard", [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7]],
    ["beard", [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8]],
    ["beard", [4, 9], [5, 9], [6, 9], [7, 9]],
    ["shirt", [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10]],
    ["shirt", [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11]],
    ["hair", [1, 4], [10, 4], [1, 5], [10, 5], [1, 6], [10, 6], [1, 7], [10, 7]],
  ];

  cells.forEach(([color, ...coords]) => {
    ctx.fillStyle = palette[color];
    coords.forEach(([cx, cy]) => {
      ctx.fillRect(ox + cx * p, oy + cy * p, p, p);
    });
  });

  const leftLegX = ox + p * 4.3;
  const rightLegX = ox + p * 6.8;
  const leftLegY = legTop + (runFrame ? p * 0.7 : 0);
  const rightLegY = legTop + (runFrame ? 0 : p * 0.7);

  ctx.fillStyle = palette.black;
  ctx.fillRect(leftLegX, leftLegY, p * 1.05, p * 1.8);
  ctx.fillRect(rightLegX, rightLegY, p * 1.05, p * 1.8);

  ctx.fillStyle = palette.shirt;
  ctx.beginPath();
  ctx.ellipse(leftLegX + p * 0.5, leftLegY + p * 2, p * 0.95, p * 0.52, 0, 0, Math.PI * 2);
  ctx.ellipse(rightLegX + p * 0.5, rightLegY + p * 2, p * 0.95, p * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  if (moving) {
    ctx.fillStyle = `rgba(${THEME.particles.step}, 0.2)`;
    ctx.beginPath();
    ctx.ellipse(leftLegX + p * 0.4, leftLegY + p * 2.5, p * 0.8, p * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(rightLegX + p * 0.4, rightLegY + p * 2.5, p * 0.8, p * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polished catcher tray with depth, side guards, and subtle shimmer.
  const trayX = ox + p * 1.65;
  const trayY = oy + p * 9.75;
  const trayW = p * 8.95;
  const trayH = p * 1.55;
  const trayLipH = p * 0.42;

  // Drop shadow under tray.
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.beginPath();
  ctx.ellipse(trayX + trayW * 0.5, trayY + trayH + p * 0.44, trayW * 0.5, p * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main body.
  const trayGrad = ctx.createLinearGradient(trayX, trayY, trayX, trayY + trayH);
  trayGrad.addColorStop(0, "rgba(251, 253, 255, 0.96)");
  trayGrad.addColorStop(0.5, "rgba(214, 224, 237, 0.98)");
  trayGrad.addColorStop(1, "rgba(160, 173, 192, 0.98)");
  ctx.fillStyle = trayGrad;
  ctx.beginPath();
  ctx.roundRect(trayX, trayY, trayW, trayH, p * 0.56);
  ctx.fill();

  // Front lip to make it feel like a scoop.
  const lipGrad = ctx.createLinearGradient(trayX, trayY + trayH - trayLipH, trayX, trayY + trayH);
  lipGrad.addColorStop(0, "rgba(130, 146, 168, 0.86)");
  lipGrad.addColorStop(1, "rgba(92, 105, 123, 0.95)");
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.roundRect(trayX + p * 0.12, trayY + trayH - trayLipH, trayW - p * 0.24, trayLipH, p * 0.28);
  ctx.fill();

  // Side guards.
  const guardW = p * 0.58;
  const guardH = p * 1.1;
  ctx.fillStyle = "rgba(202, 214, 229, 0.9)";
  ctx.beginPath();
  ctx.roundRect(trayX - guardW * 0.45, trayY + p * 0.1, guardW, guardH, p * 0.2);
  ctx.roundRect(trayX + trayW - guardW * 0.55, trayY + p * 0.1, guardW, guardH, p * 0.2);
  ctx.fill();

  // Inner glow stripe and animated shimmer.
  const shimmerX = ((state.animTime * 0.06) % (trayW + p * 3)) - p * 1.5;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(trayX + p * 0.15, trayY + p * 0.16, trayW - p * 0.3, trayH - p * 0.35, p * 0.42);
  ctx.clip();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.fillRect(trayX + p * 0.3, trayY + p * 0.26, trayW - p * 0.6, p * 0.2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(trayX + shimmerX, trayY - p * 0.2, p * 0.9, trayH + p * 0.55);
  ctx.restore();

  // Crisp outer stroke.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.66)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(trayX + 0.5, trayY + 0.5, trayW - 1, trayH - 1, p * 0.5);
  ctx.stroke();
}

function drawCatchFlash() {
  if (state.catchFlash <= 0) {
    return;
  }

  const { x, y, w, h } = state.player;
  const cx = x + w * 0.5;
  const cy = y + h * 0.48;
  const radius = 24 + (1 - state.catchFlash) * 26;
  const alpha = state.catchFlash * 0.4;
  const burst = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
  burst.addColorStop(0, `rgba(${THEME.catchRgb}, ${alpha})`);
  burst.addColorStop(1, `rgba(${THEME.catchRgb}, 0)`);
  ctx.fillStyle = burst;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function spawnCatchParticles(item) {
  const count = item.kind === "card" ? 18 : item.kind === "square" ? 12 : 9;
  const rgb = THEME.particles[item.kind] || THEME.particles.dollar;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3.2;
    state.particles.push({
      x: item.x + item.w * 0.5,
      y: item.y + item.h * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.6,
      life: 1,
      maxLife: 1,
      size: 1.6 + Math.random() * 2.7,
      rgb,
    });
  }
}

function spawnMissBurst(item) {
  for (let i = 0; i < 5; i += 1) {
    const angle = Math.PI + (Math.random() - 0.5) * 0.9;
    const speed = 0.8 + Math.random() * 1.6;
    state.particles.push({
      x: item.x + item.w * 0.5,
      y: Math.min(canvas.height - 12, item.y + item.h),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.2,
      life: 0.55,
      maxLife: 0.55,
      size: 1.4 + Math.random() * 2.3,
      rgb: THEME.particles.miss,
    });
  }
}

function updateParticles(dt) {
  state.particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.05 * dt;
    p.vx *= 0.986;
    p.life -= 0.035 * dt;
  });
  state.particles = state.particles.filter((p) => p.life > 0);
}

function drawParticles() {
  state.particles.forEach((p) => {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = `rgba(${p.rgb}, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawDollarToken(token) {
  ctx.save();
  ctx.translate(token.x + token.w / 2, token.y + token.h / 2);
  ctx.rotate(token.tilt);

  const r = token.w * 0.22;
  ctx.fillStyle = THEME.dollar.fill;
  ctx.beginPath();
  ctx.roundRect(-token.w / 2, -token.h / 2, token.w, token.h, r);
  ctx.fill();

  ctx.strokeStyle = THEME.dollar.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-token.w / 2 + 1.2, -token.h / 2 + 1.2, token.w - 2.4, token.h - 2.4, r - 1);
  ctx.stroke();

  ctx.fillStyle = THEME.dollar.glyph;
  ctx.font = `700 ${Math.floor(token.w * 0.66)}px Space Grotesk`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, token.h * 0.05);
  ctx.restore();
}

function drawSquareLogoToken(item) {
  ctx.save();
  ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
  ctx.rotate(item.tilt);

  const size = item.w;
  const outerR = size * 0.22;
  const innerR = size * 0.14;

  ctx.fillStyle = THEME.square.outer;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, outerR);
  ctx.fill();

  ctx.fillStyle = THEME.square.inner;
  const inner = size * 0.54;
  ctx.beginPath();
  ctx.roundRect(-inner / 2, -inner / 2, inner, inner, innerR);
  ctx.fill();

  ctx.restore();
}

function drawAnimalCard(item) {
  ctx.save();
  ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
  ctx.rotate(item.tilt);

  const cardW = item.w;
  const cardH = item.h;
  const radius = Math.max(8, cardW * 0.12);

  ctx.shadowColor = THEME.card.aura;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = THEME.card.auraStroke;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-cardW / 2 - 7, -cardH / 2 - 7, cardW + 14, cardH + 14, radius + 6);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = THEME.card.body;
  ctx.beginPath();
  ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius);
  ctx.fill();

  ctx.fillStyle = THEME.card.overlay;
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
  chipGrad.addColorStop(0, THEME.card.chipA);
  chipGrad.addColorStop(1, THEME.card.chipB);
  ctx.fillStyle = chipGrad;
  ctx.beginPath();
  ctx.roundRect(chipX, chipY, chipW, chipH, 3);
  ctx.fill();

  ctx.strokeStyle = THEME.card.chipStroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chipX + chipW * 0.5, chipY);
  ctx.lineTo(chipX + chipW * 0.5, chipY + chipH);
  ctx.moveTo(chipX, chipY + chipH * 0.5);
  ctx.lineTo(chipX + chipW, chipY + chipH * 0.5);
  ctx.stroke();

  ctx.fillStyle = THEME.card.textTop;
  ctx.font = `600 ${Math.max(10, Math.floor(cardH * 0.17))}px Space Grotesk`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("$ree", cardW * 0.4, -cardH * 0.36);

  ctx.fillStyle = THEME.card.textBottom;
  ctx.font = `700 ${Math.max(11, Math.floor(cardH * 0.2))}px Space Grotesk`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("10x", 0, cardH * 0.32);
  ctx.restore();
}

function updateDifficulty(dt) {
  state.gameTime += dt * 16.67;
  const progress = Math.min(state.gameTime / 90000, 1);
  const wave = Math.sin(state.gameTime * 0.0012) * 22;
  state.spawnEvery = 760 - 340 * progress + wave;
  state.spawnCurrent += (state.spawnEvery - state.spawnCurrent) * Math.min(0.25, 0.045 * dt);
  state.speedBoost = 0.35 + 1.25 * progress;
}

function spawnCollectible(now) {
  if (now - state.lastSpawn < state.spawnCurrent) {
    return;
  }

  state.lastSpawn = now;
  const roll = Math.random();
  const isCard = roll < 0.18;
  const isSquare = roll >= 0.18 && roll < 0.33;

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
      color: Math.random() > 0.5 ? THEME.card.spotA : THEME.card.spotB,
    }));

    state.items.push({
      kind: "card",
      x,
      y: -h,
      w,
      h,
      speed: 1.8 + Math.random() * 1 + state.speedBoost * 0.78,
      tilt: (Math.random() - 0.5) * 0.18,
      points: 10,
      spots,
    });
    return;
  }

  if (isSquare) {
    const size = 34 + Math.random() * 12;
    const x = Math.random() * (canvas.width - size);
    state.items.push({
      kind: "square",
      x,
      y: -size,
      w: size,
      h: size,
      speed: 2 + Math.random() * 0.9 + state.speedBoost * 0.9,
      tilt: (Math.random() - 0.5) * 0.25,
      points: 3,
    });
    return;
  }

  const size = 30 + Math.random() * 14;
  const x = Math.random() * (canvas.width - size);
  state.items.push({
    kind: "dollar",
    x,
    y: -size,
    w: size,
    h: size,
    speed: 1.9 + Math.random() * 0.95 + state.speedBoost,
    tilt: (Math.random() - 0.5) * 0.22,
    points: 1,
  });
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getCatcherBounds() {
  const p = state.player;
  return {
    x: p.x + p.catchPadX,
    y: p.y + p.catchPadTop,
    w: p.w - p.catchPadX * 2,
    h: p.h - p.catchPadTop - p.catchPadBottom,
  };
}

function renderWorld(dt) {
  ctx.save();
  if (state.shake > 0) {
    const strength = state.shake * 8;
    const sx = (Math.random() - 0.5) * strength;
    const sy = (Math.random() - 0.5) * strength;
    ctx.translate(sx, sy);
  }

  drawBackground(dt);
  state.items.forEach((item) => {
    if (item.kind === "card") {
      drawAnimalCard(item);
    } else if (item.kind === "square") {
      drawSquareLogoToken(item);
    } else {
      drawDollarToken(item);
    }
  });
  drawParticles();
  drawCatchFlash();
  drawBlockemon();

  ctx.restore();
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

  state.animTime += dt * 16.67;
  state.catchFlash = Math.max(0, state.catchFlash - 0.055 * dt);
  state.shake = Math.max(0, state.shake - 0.045 * dt);
  updateParticles(dt);

  if (state.hitStop > 0) {
    state.hitStop -= dt;
    renderWorld(0);
    updateHud();
    state.rafId = requestAnimationFrame(update);
    return;
  }

  updateDifficulty(dt);

  if (state.keys.left && !state.keys.right) {
    state.player.vx -= state.player.accel * dt;
  } else if (state.keys.right && !state.keys.left) {
    state.player.vx += state.player.accel * dt;
  } else {
    state.player.vx *= Math.pow(state.player.drag, dt);
  }

  state.player.vx = Math.max(-state.player.maxSpeed, Math.min(state.player.maxSpeed, state.player.vx));
  state.player.x += state.player.vx * dt;
  state.player.vy += state.player.gravity * dt;
  state.player.y += state.player.vy * dt;

  if (state.player.x < 0) {
    state.player.x = 0;
    state.player.vx = 0;
  }
  if (state.player.x > canvas.width - state.player.w) {
    state.player.x = canvas.width - state.player.w;
    state.player.vx = 0;
  }

  if (state.player.y >= state.player.groundY) {
    state.player.y = state.player.groundY;
    state.player.vy = 0;
  }

  spawnCollectible(now);

  state.items.forEach((item) => {
    item.y += item.speed * dt;

    if (intersects(getCatcherBounds(), item)) {
      item.caught = true;
      state.score += item.points;
      state.catchFlash = 1;
      spawnCatchParticles(item);
      state.hitStop = Math.max(state.hitStop, item.kind === "card" ? 5.2 : 3.2);
    } else if (item.y > canvas.height + 4) {
      item.missed = true;
      state.missed += 1;
      spawnMissBurst(item);
      state.shake = Math.min(1, state.shake + 0.5);
    }
  });

  state.items = state.items.filter((item) => !item.caught && !item.missed);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(state.best));
  }

  renderWorld(dt);
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
  if (code === "ArrowUp") {
    state.keys.up = value;
  }
}

window.addEventListener("keydown", (event) => {
  if (
    event.code === "ArrowUp" &&
    state.running &&
    state.player.y >= state.player.groundY &&
    state.player.vy === 0
  ) {
    state.player.vy = -state.player.jumpPower;
  }
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
