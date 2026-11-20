// ======= ESTETICA BOUNCE TOUCH (redondita) =======

const BT = {
  SKY: '#1b9ce6',
  SKY_LIGHT: '#7ec6f3',
  SUN_A: '#ffe066',
  SUN_B: '#ffb62e',
  HILL_FAR: '#4cbd45',
  HILL_NEAR: '#2f9e2f',
  GRASS_TOP: '#8ee04a',
  GRASS: '#3ecb3e',
  DIRT: '#2f6b35',
  DIRT_LUMP: '#256b2c',
  BALL: '#d8281f',
  BALL_LIGHT: '#ff7a6b',
  BALL_DARK: '#931b14',
  BALL_OUTLINE: '#200c0c',
  WHITE: '#ffffff',
  BLACK: '#1a1a1a',
  GOLD: '#f6b40b',
  GOLD_LIGHT: '#ffe082',
  RED: '#e02a20',
  WATER: '#2f9df2',
  WATER_LIGHT: '#8fd6fb',
  WATER_DARK: '#1f7fc4',
  ENEMY: '#2b3038',
  DEAD_GRAY: '#9e9e9e',
  FLOWER_PINK: '#e64a5a',
  FLOWER_PINK_DARK: '#c22f42',
  FLOWER_CORE: '#ffd83d',
  STEMS: '#43d43f',
  CACTUS: '#2fa33b',
  CACTUS_LIGHT: '#6ee668',
  STONE: '#9e9e9e',
  STONE_LIGHT: '#c4c4c4',
  PILL: 'rgba(255,255,255,0.88)',
  TEXT_DARK: '#205c2a'
};

// ---------- rect redondeado ----------
function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl: r, tr: r, bl: r, br: r };
  const tl = r.tl || 0, tr = r.tr || 0, bl = r.bl || 0, br = r.br || 0;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

// ---------- PELORA (Bounce) ----------
function drawBall(ctx, cx, cy, r, angle, facing, closed) {
  facing = facing || 1;
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 3, r * 0.85, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // cuerpo
  ctx.fillStyle = BT.BALL;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // sombreado inferior + brillo (recortado dentro del cuerpo)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = BT.BALL_DARK;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.55, r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BT.BALL_LIGHT;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.34, cy - r * 0.5, r * 0.4, r * 0.3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // contorno
  ctx.strokeStyle = BT.BALL_OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.stroke();

  // ojos grandes que se tocan en el centro (estilo Bounce Touch)
  const eY = cy - r * 0.08;
  const eSp = r * 0.34;
  const eRx = r * 0.33;
  const eRy = r * 0.52;
  for (const s of [-1, 1]) {
    const ex = cx + s * eSp;
    // blanca
    ctx.fillStyle = BT.WHITE;
    ctx.beginPath();
    ctx.ellipse(ex, eY, eRx, eRy, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!closed) {
      const px = ex + facing * r * 0.08;
      const py = eY + r * 0.06;
      ctx.fillStyle = BT.BLACK;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.15, r * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // párpado rojo suave (recortado en la forma del ojo)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, eY, eRx, eRy, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = BT.BALL;
    const lidTop = eY - eRy - 1;
    const lidBottom = closed ? eY + eRy + 1 : eY - eRy * 0.18;
    ctx.fillRect(ex - eRx - 1, lidTop, eRx * 2 + 2, lidBottom - lidTop);
    ctx.fillStyle = BT.BALL_DARK;
    ctx.fillRect(ex - eRx - 1, lidBottom - 1, eRx * 2 + 2, 1.6);
    ctx.restore();
  }
  // boca pequeña
  ctx.strokeStyle = BT.BALL_OUTLINE;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.38, r * 0.26, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

// ---------- CORAZON ----------
function drawHeart(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.bezierCurveTo(cx - r * 1.4, cy - r * 0.4, cx - r * 0.55, cy - r * 1.25, cx, cy - r * 0.35);
  ctx.bezierCurveTo(cx + r * 0.55, cy - r * 1.25, cx + r * 1.4, cy - r * 0.4, cx, cy + r);
  ctx.fill();
}

// ---------- ANILLO ----------
function drawRingHole(ctx, cx, cy, r, bg) {
  ctx.fillStyle = BT.GOLD;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bg;
  const rr = r * 0.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rr, rr * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BT.GOLD_LIGHT;
  ctx.fillRect(cx - r * 0.75, cy - r * 0.5, r * 0.5, 2);
}

// ---------- FLOR ----------
function drawFlower(ctx, x, base, type) {
  ctx.strokeStyle = BT.STEMS;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 4, base);
  ctx.quadraticCurveTo(x + 10, base - 16, x + 4, base - 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 4, base - 12);
  ctx.lineTo(x + 14, base - 18);
  ctx.lineTo(x + 6, base - 8);
  ctx.closePath();
  ctx.fillStyle = BT.STEMS;
  ctx.fill();
  const hy = base - 42;
  const hx = x + 4;
  const pr = type === 1 ? 11 : 12;
  const col = type === 1 ? BT.WHITE : BT.FLOWER_PINK;
  const colD = type === 1 ? '#c9d7e2' : BT.FLOWER_PINK_DARK;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(hx + Math.cos(a) * pr, hy + Math.sin(a) * pr, 8, 6, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colD;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = BT.FLOWER_CORE;
  ctx.beginPath();
  ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c99a00';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------- CACTUS ----------
function drawCactus(ctx, x, base) {
  const h = 30;
  ctx.fillStyle = BT.CACTUS;
  // tronco
  roundRectPath(ctx, x, base - h, 10, h, 5);
  ctx.fill();
  // brazo izquierdo
  roundRectPath(ctx, x - 7, base - h * 0.62, 5, h * 0.42, 3);
  ctx.fill();
  roundRectPath(ctx, x - 7, base - h * 0.62, 8, 5, 3);
  ctx.fill();
  // brazo derecho
  roundRectPath(ctx, x + 12, base - h * 0.78, 5, h * 0.55, 3);
  ctx.fill();
  roundRectPath(ctx, x + 8, base - h * 0.78, 6, 5, 3);
  ctx.fill();
  // brillo
  ctx.fillStyle = BT.CACTUS_LIGHT;
  roundRectPath(ctx, x + 2, base - h + 4, 3, h - 10, 2);
  ctx.fill();
}

// ---------- PIEDRA ----------
function drawStone(ctx, x, base) {
  ctx.fillStyle = BT.STONE;
  ctx.beginPath();
  ctx.ellipse(x, base - 3, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BT.STONE_LIGHT;
  ctx.beginPath();
  ctx.ellipse(x - 3, base - 5, 5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- NUBE redonda ----------
function drawCloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 9 * s, 0, Math.PI * 2);
  ctx.arc(x + 11 * s, y - 3 * s, 11 * s, 0, Math.PI * 2);
  ctx.arc(x + 24 * s, y, 8 * s, 0, Math.PI * 2);
  ctx.arc(x + 12 * s, y + 5 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- CIELO con sol, colinas y nubes ----------
function drawSky(ctx, camX, t) {
  ctx.fillStyle = BT.SKY;
  ctx.fillRect(0, 0, 480, 270);
  // sol gigante
  const sunX = 352 - ((camX * 0.05) % 80);
  ctx.fillStyle = BT.SUN_B;
  ctx.beginPath();
  ctx.arc(sunX, 210, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BT.SUN_A;
  ctx.beginPath();
  ctx.arc(sunX, 210, 46, 0, Math.PI * 2);
  ctx.fill();
  // colinas lejanas
  ctx.fillStyle = BT.HILL_FAR;
  for (let i = -1; i < 4; i++) {
    const hx = ((i * 220 - camX * 0.3) % 880 + 880) % 880 - 160;
    ctx.beginPath();
    ctx.ellipse(hx, 312, 150, 92, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  // colinas cercanas
  ctx.fillStyle = BT.HILL_NEAR;
  for (let i = -1; i < 4; i++) {
    const hx = ((i * 260 - camX * 0.5 + 60) % 1040 + 1040) % 1040 - 200;
    ctx.beginPath();
    ctx.ellipse(hx, 342, 132, 96, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  // nubes redondas
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  for (let i = 0; i < 5; i++) {
    const seed = (i * 137 + 40) % 640;
    let x = ((seed - camX * 0.22 + t * 0.1) % 640 + 640) % 640 - 80;
    const y = 22 + (i % 3) * 34;
    drawCloud(ctx, x, y, 1 + (i % 2) * 0.3);
  }
}

// ---------- UI ----------
const UI = {
  drawText(ctx, text, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = size + "px 'Press Start 2P', monospace";
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  },
  drawTextOutlined(ctx, text, x, y, size, fill, stroke, align, strokeW) {
    ctx.font = size + "px 'Press Start 2P', monospace";
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeW || Math.max(2, Math.floor(size / 4));
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  },
  pill(ctx, x, y, w, h, r) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = BT.PILL;
    ctx.fill();
  },
  drawHUD(ctx, level, lives, levelIndex, t) {
    const collected = level.rings.filter(r => r.taken).length;
    const total = level.rings.length;
    // vidas
    UI.pill(ctx, 8, 6, 66, 22, 11);
    for (let i = 0; i < 3; i++) {
      drawHeart(ctx, 24 + i * 17, 17, 6, i < lives ? '#ff3232' : BT.DEAD_GRAY);
    }
    // anillos
    UI.pill(ctx, 82, 6, 84, 22, 11);
    drawRingHole(ctx, 97, 17, 6.5, BT.PILL);
    UI.drawText(ctx, collected + '/' + total, 110, 12, 8, BT.TEXT_DARK);
    // score
    UI.pill(ctx, 176, 6, 132, 22, 11);
    UI.drawText(ctx, 'SCORE ' + String(level.score).padStart(5, '0'), 188, 12, 8, BT.TEXT_DARK);
    // nivel
    UI.pill(ctx, 418, 6, 54, 22, 11);
    UI.drawText(ctx, 'LV ' + (levelIndex + 1), 430, 12, 8, BT.TEXT_DARK);
    // brillo del anillo
    const sp = 96 - 3 - Math.sin(t * 0.08) * 2;
    ctx.fillStyle = BT.WHITE;
    ctx.fillRect(sp, 9, 2, 2);
  },
  drawTitle(ctx, blink, t) {
    drawSky(ctx, 0, t);
    // suelo redondeado
    ctx.fillStyle = BT.DIRT;
    roundRectPath(ctx, -10, 226, 500, 54, { tl: 16, tr: 16, bl: 0, br: 0 });
    ctx.fill();
    ctx.fillStyle = BT.GRASS;
    roundRectPath(ctx, -10, 216, 500, 16, { tl: 8, tr: 8, bl: 0, br: 0 });
    ctx.fill();
    ctx.fillStyle = BT.GRASS_TOP;
    for (let i = 0; i < 34; i++) {
      ctx.beginPath();
      ctx.ellipse(6 + i * 14, 218, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // decoración: cactus, piedras, flores
    drawCactus(ctx, 38, 232);
    drawStone(ctx, 120, 234);
    drawStone(ctx, 445, 236);
    drawCactus(ctx, 452, 234);
    drawFlower(ctx, 92, 226, 0);
    drawFlower(ctx, 366, 226, 1);
    // logo
    UI.drawTextOutlined(ctx, 'RED BALL', 240, 44, 30, BT.RED, BT.WHITE, 'center', 7);
    UI.drawTextOutlined(ctx, 'ADVENTURE', 240, 88, 12, '#1461c0', BT.WHITE, 'center', 4);
    UI.drawText(ctx, 'BOUNCE TOUCH STYLE', 240, 116, 8, '#1461c0', 'center');
    // mascota
    drawBall(ctx, 240, 158, 22, 0, 1, false);
    if (blink) UI.drawText(ctx, 'PRESS SPACE TO START', 240, 196, 9, '#083b66', 'center');
    UI.drawText(ctx, 'ARROWS MOVE  SPACE JUMP  X DASH', 240, 252, 7, BT.WHITE, 'center');
  },
  drawGameOver(ctx, won, score) {
    drawSky(ctx, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, 480, 270);
    if (won) UI.drawTextOutlined(ctx, 'LEVEL CLEAR!', 240, 92, 16, BT.GOLD, '#143d18', 'center', 5);
    else UI.drawTextOutlined(ctx, 'GAME OVER', 240, 92, 16, BT.RED, BT.WHITE, 'center', 5);
    UI.pill(ctx, 170, 126, 140, 24, 12);
    UI.drawText(ctx, 'SCORE ' + score, 186, 133, 8, BT.TEXT_DARK);
    UI.pill(ctx, 130, 162, 220, 22, 11);
    UI.drawText(ctx, 'PRESS SPACE TO CONTINUE', 142, 167, 8, BT.TEXT_DARK);
  },
  drawVictory(ctx, score, t) {
    drawSky(ctx, 0, t);
    ctx.fillStyle = BT.DIRT;
    roundRectPath(ctx, -10, 236, 500, 44, { tl: 14, tr: 14, bl: 0, br: 0 });
    ctx.fill();
    ctx.fillStyle = BT.GRASS;
    roundRectPath(ctx, -10, 228, 500, 14, { tl: 7, tr: 7, bl: 0, br: 0 });
    ctx.fill();
    drawBall(ctx, 240, 166, 22, 0, 1, false);
    drawCactus(ctx, 60, 240);
    drawStone(ctx, 420, 242);
    UI.drawTextOutlined(ctx, 'YOU WIN!', 240, 52, 22, BT.RED, BT.WHITE, 'center', 6);
    UI.drawTextOutlined(ctx, 'ALL LEVELS CLEARED', 240, 92, 10, '#1461c0', BT.WHITE, 'center', 3);
    UI.pill(ctx, 160, 122, 160, 24, 12);
    UI.drawText(ctx, 'FINAL SCORE ' + score, 174, 129, 8, BT.TEXT_DARK);
    UI.pill(ctx, 128, 160, 224, 22, 11);
    UI.drawText(ctx, 'PRESS SPACE TO REPLAY', 140, 165, 8, BT.TEXT_DARK);
  }
};