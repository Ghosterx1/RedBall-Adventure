(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width;   // 480
  const H = canvas.height;  // 270

  const input = { left: false, right: false, jumpPressed: false, dashPressed: false };

  function setKey(k, v) {
    if (k === 'ArrowLeft' || k === 'KeyA') input.left = v;
    if (k === 'ArrowRight' || k === 'KeyD') input.right = v;
    if (k === 'Space' && v) input.jumpPressed = true;
    if (k === 'KeyX' && v) input.dashPressed = true;
  }
  window.addEventListener('keydown', e => {
    setKey(e.code, true);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { setKey(e.code, false); });

  document.querySelectorAll('.tbtn[data-key]').forEach(b => {
    const key = b.dataset.key;
    const press = (v) => {
      if (key === 'Space') { if (v) input.jumpPressed = true; }
      else if (key === 'KeyX') { if (v) input.dashPressed = true; }
      else setKey(key, v);
    };
    b.addEventListener('mousedown', () => press(true));
    b.addEventListener('mouseup', () => press(false));
    b.addEventListener('mouseleave', () => press(false));
    b.addEventListener('touchstart', e => { e.preventDefault(); press(true); });
    b.addEventListener('touchend', e => { e.preventDefault(); press(false); });
  });

  // ======= ESTADO =======
  let state = 'title';
  let levelIndex = 0;
  let level = null;
  let player = null;
  let camera = null;
  let lives = 3;
  let totalScore = 0;
  let t = 0;               // frames globales
  let gameOverTimer = 0;
  let wonLevel = false;

  function startLevel(idx) {
    levelIndex = idx;
    level = createLevel(idx);
    player = createPlayer(level.spawn.x, level.spawn.y);
    camera = createCamera(W, H, level.width, level.height);
    state = 'play';
    wonLevel = false;
  }
  function startGame() {
    lives = 3;
    totalScore = 0;
    startLevel(0);
  }
  function killPlayer() {
    lives--;
    if (lives <= 0) {
      state = 'over';
      wonLevel = false;
      gameOverTimer = 0;
    } else {
      player = createPlayer(level.spawn.x, level.spawn.y);
      player.invuln = 60;
    }
  }

  function updateEnemies() {
    for (const e of level.enemies) {
      if (!e.alive) continue;
      e.x += e.vx;
      if (e.x < e.startX - e.range || e.x > e.startX + e.range) {
        e.vx *= -1;
        e.x = clamp(e.x, e.startX - e.range, e.startX + e.range);
      }
      for (const s of level.solids) {
        if (aabb(e, s)) {
          e.vx *= -1;
          if (e.vx > 0) e.x = s.x - e.w; else e.x = s.x + s.w;
        }
      }
    }
  }

  function update() {
    t++;
    if (state === 'title') {
      if (input.jumpPressed) { input.jumpPressed = false; startGame(); }
      return;
    }
    if (state === 'over' || state === 'victory') {
      gameOverTimer++;
      if (input.jumpPressed && gameOverTimer > 30) {
        input.jumpPressed = false;
        state = 'title';
      }
      return;
    }
    // ===== PLAY =====
    player.update(input, level);
    if (!player.alive) {
      killPlayer();
      if (state !== 'play') return;
    }
    updateEnemies();
    camera.follow(player);

    if (level.complete) {
      totalScore += level.score;
      if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
      else { state = 'victory'; gameOverTimer = 0; }
      input.jumpPressed = false;
      input.dashPressed = false;
      return;
    }
    input.jumpPressed = false;
    input.dashPressed = false;
  }

  // ======= DIBUJO DE ESCENARIO (estilo Bounce Tales) =======

  // Isla redondita: pasto con lomos redondeados, tierra verde oscura con bultos
  function drawIsland(sx, sy, w, h) {
    const GH = 12; // altura del pasto
    // tierra (base redondeada)
    ctx.fillStyle = BT.DIRT;
    roundRectPath(ctx, sx, sy + GH - 5, w, h - GH + 5, {
      tl: 0, tr: 0,
      bl: Math.min(12, Math.floor(w / 4), Math.floor((h - GH + 5) / 2)),
      br: Math.min(12, Math.floor(w / 4))
    });
    ctx.fill();
    // bultos internos
    ctx.fillStyle = BT.DIRT_LUMP;
    const lumps = Math.max(1, Math.floor(w / 44));
    for (let i = 0; i < lumps; i++) {
      const lx = sx + 12 + i * Math.max(1, (w - 24) / Math.max(1, lumps - 1));
      ctx.beginPath();
      ctx.ellipse(lx, sy + h - 9 + ((i % 2) ? 3 : 0), Math.min(12, w / 5), 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // pasto redondeado
    ctx.fillStyle = BT.GRASS;
    roundRectPath(ctx, sx, sy, w, GH, Math.min(7, h / 2));
    ctx.fill();
    // lomos redondeados sobre el borde superior
    for (let i = 0; i <= w - 14; i += 14) {
      ctx.beginPath();
      ctx.ellipse(sx + i + 7, sy + 2, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // franja clara sobre los lomos
    ctx.fillStyle = BT.GRASS_TOP;
    for (let i = 0; i <= w - 14; i += 14) {
      ctx.beginPath();
      ctx.ellipse(sx + i + 7, sy + 1, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // cactus y piedras decorativas
  function drawProps() {
    for (const p of (level.props || [])) {
      const sx = p.x - camera.x, sy = p.y - camera.y;
      if (sx < -70 || sx > W + 70) continue;
      if (p.type === 'cactus') drawCactus(ctx, sx, sy);
      else drawStone(ctx, sx, sy);
    }
  }

  function drawSpikes() {
    for (const s of level.spikes) {
      const sx = s.x - camera.x, sy = s.y - camera.y;
      if (sx + s.w < 0 || sx > W) continue;
      ctx.fillStyle = '#14161c';
      ctx.beginPath();
      ctx.moveTo(sx, sy + s.h);
      ctx.lineTo(sx + s.w / 2, sy - 1);
      ctx.lineTo(sx + s.w, sy + s.h);
      ctx.closePath();
      ctx.fill();
      // brillo
      ctx.strokeStyle = '#c7cdd4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + s.w * 0.38, sy + s.h * 0.4);
      ctx.lineTo(sx + s.w / 2, sy + 1);
      ctx.stroke();
    }
  }

  function drawWater() {
    for (const w of (level.water || [])) {
      const sx = w.x - camera.x, sy = w.y - camera.y;
      if (sx + w.w < 0 || sx > W) continue;
      ctx.fillStyle = BT.WATER;
      roundRectPath(ctx, sx, sy + 3, w.w, w.h - 3, Math.min(10, Math.floor(w.w / 2)));
      ctx.fill();
      ctx.fillStyle = BT.WATER_DARK;
      ctx.fillRect(sx + 2, sy + w.h - 6, w.w - 4, 6);
      // olas
      ctx.fillStyle = BT.WATER_LIGHT;
      for (let i = 0; i < w.w; i += 8) {
        const off = Math.sin(t * 0.07 + (w.x + i) * 0.08) * 2;
        ctx.fillRect(sx + i, sy + 3 + off, 6, 3);
      }
      // brillos
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < w.w; i += 26) {
        const hash = (w.x + i * 131) % 7;
        ctx.fillRect(sx + i + hash, sy + 9 + (hash % 3) * 5, 3, 1);
      }
    }
  }

  function drawEnemies() {
    for (const e of level.enemies) {
      if (!e.alive) continue;
      const cx = e.x - camera.x + e.w / 2;
      const cy = e.y - camera.y + e.h / 2 + 1;
      if (cx + e.w < 0 || cx - e.w > W) continue;
      const r = 7;
      // cuerpo
      ctx.fillStyle = BT.ENEMY;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // púas (triángulos alrededor)
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8 + t * 0.02 * (e.vx > 0 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.28) * (r - 1), cy + Math.sin(a - 0.28) * (r - 1));
        ctx.lineTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5));
        ctx.lineTo(cx + Math.cos(a + 0.28) * (r - 1), cy + Math.sin(a + 0.28) * (r - 1));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // cara: ojos enojados mirando la direccion
      const f = (e.vx < 0) ? -1 : 1;
      const ey = cy - 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 3, ey, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 3, ey, 2.2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx - 3 + f, ey + 1, 1.1, 0, Math.PI * 2);
      ctx.arc(cx + 3 + f, ey + 1, 1.1, 0, Math.PI * 2);
      ctx.fill();
      // cejas
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, ey - 4);
      ctx.lineTo(cx - 1, ey - 2.5);
      ctx.moveTo(cx + 5, ey - 4);
      ctx.lineTo(cx + 1, ey - 2.5);
      ctx.stroke();
    }
  }

  function drawRings() {
    for (const r of level.rings) {
      if (r.taken) continue;
      const rx = r.x - camera.x, ry = r.y - camera.y;
      if (rx + r.w < 0 || rx > W) continue;
      const bob = Math.sin(t * 0.1 + r.x) * 2;
      drawRingHole(ctx, rx + 6, ry + 6 + bob, 6, BT.SKY);
    }
  }

  function drawCheckpoints() {
    for (const c of (level.checkpoints || [])) {
      const sx = c.x - camera.x, sy = c.y - camera.y;
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(sx + 6, sy, 3, 30);
      const fl = c.active ? BT.GOLD : '#b0bec5';
      ctx.fillStyle = fl;
      ctx.beginPath();
      ctx.moveTo(sx + 9, sy + 2);
      ctx.lineTo(sx + 26, sy + 8);
      ctx.lineTo(sx + 9, sy + 14);
      ctx.closePath();
      ctx.fill();
      if (c.active) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 14, sy + 6, 4, 4);
      }
    }
  }

  function drawGoal() {
    if (!level.goal) return;
    const gx = level.goal.x - camera.x, gy = level.goal.y - camera.y;
    // asta
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(gx + 1, gy, 4, level.goal.h);
    ctx.fillStyle = BT.GOLD;
    ctx.beginPath();
    ctx.arc(gx + 3, gy, 4, 0, Math.PI * 2);
    ctx.fill();
    // bandera roja ondeando
    const wav = Math.sin(t * 0.1) * 2;
    ctx.fillStyle = BT.RED;
    ctx.beginPath();
    ctx.moveTo(gx + 5, gy + 4);
    ctx.lineTo(gx + 30, gy + 8 + wav);
    ctx.lineTo(gx + 30, gy + 22 + wav);
    ctx.lineTo(gx + 5, gy + 26);
    ctx.closePath();
    ctx.fill();
    // estrella
    ctx.fillStyle = BT.WHITE;
    star(ctx, gx + 17, gy + 15 + wav, 5);
  }
  function star(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawFlowers() {
    for (const f of (level.flowers || [])) {
      const sx = f.x - camera.x, sy = f.y - camera.y;
      if (sx + 40 < 0 || sx - 40 > W) continue;
      drawFlower(ctx, sx, sy, f.type);
    }
  }

  function drawPlayer() {
    if (!player || !player.alive) return;
    if (player.invuln > 0 && (player.invuln % 6) < 3) return; // parpadeo invulnerable
    const px = player.x - camera.x + player.w / 2;
    const py = player.y - camera.y + player.h / 2;
    const r = player.w / 2;
    const sq = player.squash;
    const closed = (t % 210) > 197;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1 / sq, sq);
    drawBall(ctx, 0, 0, r, player.angle, player.facing, closed);
    ctx.restore();
  }

  function render() {
    if (state === 'title') {
      UI.drawTitle(ctx, Math.floor(t / 30) % 2 === 0, t);
      return;
    }
    if (state === 'victory') {
      UI.drawVictory(ctx, totalScore, t);
      return;
    }

    drawSky(ctx, camera.x, t);

    // islas
    for (const s of level.solids) {
      const sx = s.x - camera.x, sy = s.y - camera.y;
      if (sx + s.w < 0 || sx > W || sy + s.h < 0 || sy > H) continue;
      drawIsland(sx, sy, s.w, s.h);
    }

    drawFlowers();
    drawProps();
    drawSpikes();
    drawWater();
    drawCheckpoints();
    drawGoal();
    drawRings();
    drawEnemies();
    drawPlayer();

    UI.drawHUD(ctx, level, lives, levelIndex, t);

    if (state === 'over') UI.drawGameOver(ctx, false, totalScore + level.score);
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => loop());
  } else {
    setTimeout(loop, 100);
  }
})();