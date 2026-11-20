const LEVELS = [
  // Level 1
  function () {
    const T = 16;
    const solids = [], spikes = [], rings = [], water = [], enemies = [], checkpoints = [], flowers = [], props = [];
    const A = (arr, x, y, w, h) => arr.push({ x, y, w, h });
    const solid = (x, y, w, h) => A(solids, x, y, w, h);
    const spike = (x, y) => spikes.push({ x, y, w: T, h: T });
    const ring = (x, y) => rings.push({ x, y, w: 12, h: 12, taken: false });
    const wtr = (x, y, w, h) => A(water, x, y, w, h);
    const enemy = (x, y) => enemies.push({ x, y, w: 16, h: 16, vx: -1, alive: true, t: 0 });
    const cp = (x, y) => checkpoints.push({ x, y, w: 16, h: 32, active: false });
    const flower = (x, y, type) => flowers.push({ x, y, type });
    const cactus = (x, y) => props.push({ x, y, type: 'cactus' });
    const stone = (x, y) => props.push({ x, y, type: 'stone' });

    const G = 464; // ground y
    // Ground
    solid(0, G, 480, 64);
    solid(560, G, 320, 64);
    solid(960, G, 400, 64);
    solid(1440, G, 480, 64);
    solid(2000, G, 400, 64);

    // Platforms (grass blocks)
    solid(240, 384, 96, 16);
    solid(400, 320, 80, 16);
    solid(640, 352, 112, 16);
    solid(832, 288, 96, 16);
    solid(1040, 352, 128, 16);
    solid(1248, 304, 80, 16);
    solid(1408, 240, 96, 16);
    solid(1600, 352, 128, 16);
    solid(1824, 304, 96, 16);

    // Stairs
    solid(320, 432, 32, 16);
    solid(352, 416, 32, 16);

    // Water pits
    wtr(480, G, 80, 64);
    wtr(1360, G, 80, 64);

    // Spikes
    spike(544, G - 16);
    spike(944, G - 16);
    spike(1984, G - 16);
    spike(720, 336);
    spike(1280, 288);

    // Enemies
    enemy(680, G - 16);
    enemy(1080, G - 16);
    enemy(1680, G - 16);

    // Rings
    ring(272, 360);
    ring(424, 296);
    ring(672, 328);
    ring(864, 264);
    ring(1088, 328);
    ring(1272, 280);
    ring(1440, 216);
    ring(1632, 328);
    ring(1856, 280);

    // Checkpoint
    cp(1000, G - 32);

    // Flores decorativas
    flower(150, G, 0);
    flower(412, 320, 1);
    flower(1836, 304, 0);
    flower(688, 352, 1);

    // Decoración: cactus y piedras
    cactus(280, G);
    cactus(1120, G);
    cactus(1840, G);
    stone(200, G);
    stone(700, G);
    stone(1200, G);
    stone(2080, G);

    const goal = { x: 2320, y: G - 48, w: 32, h: 48 };

    return {
      index: 0, name: 'GREEN HILLS',
      width: 2400, height: 540,
      solids, spikes, rings, water, enemies, checkpoints, flowers, props, goal,
      score: 0, complete: false, deathY: 600,
      spawn: { x: 48, y: G - 24 }
    };
  },
  // Level 2
  function () {
    const T = 16;
    const solids = [], spikes = [], rings = [], water = [], enemies = [], checkpoints = [], flowers = [], props = [];
    const solid = (x, y, w, h) => solids.push({ x, y, w, h });
    const spike = (x, y) => spikes.push({ x, y, w: T, h: T });
    const ring = (x, y) => rings.push({ x, y, w: 12, h: 12, taken: false });
    const wtr = (x, y, w, h) => water.push({ x, y, w, h });
    const enemy = (x, y) => enemies.push({ x, y, w: 16, h: 16, vx: -1.2, alive: true, t: 0 });
    const cp = (x, y) => checkpoints.push({ x, y, w: 16, h: 32, active: false });
    const flower = (x, y, type) => flowers.push({ x, y, type });
    const cactus = (x, y) => props.push({ x, y, type: 'cactus' });
    const stone = (x, y) => props.push({ x, y, type: 'stone' });

    const G = 464;
    solid(0, G, 320, 64);
    solid(400, G, 240, 64);
    solid(720, G, 320, 64);
    solid(1120, G, 400, 64);
    solid(1600, G, 320, 64);
    solid(2000, G, 400, 64);

    // Higher platforms
    solid(160, 368, 80, 16);
    solid(320, 304, 96, 16);
    solid(520, 368, 80, 16);
    solid(720, 288, 112, 16);
    solid(920, 352, 96, 16);
    solid(1120, 272, 128, 16);
    solid(1360, 336, 96, 16);
    solid(1560, 256, 112, 16);
    solid(1760, 320, 96, 16);
    solid(1960, 272, 128, 16);

    // Water
    wtr(320, G, 80, 64);
    wtr(1040, G, 80, 64);
    wtr(1520, G, 80, 64);

    // Spikes
    spike(384, G - 16);
    spike(688, G - 16);
    spike(1104, G - 16);
    spike(400, 352);
    spike(960, 336);
    spike(1408, 320);

    // Enemies
    enemy(440, G - 16);
    enemy(800, G - 16);
    enemy(1200, G - 16);
    enemy(1680, G - 16);
    enemy(760, 272);

    // Rings
    for (let i = 0; i < 12; i++) ring(200 + i * 160, 240 + (i % 3) * 32);

    cp(1100, G - 32);

    // Flores
    flower(128, G, 0);
    flower(1772, 320, 1);
    flower(744, 288, 1);

    // Decoración
    cactus(240, G);
    cactus(1360, G);
    stone(560, G);
    stone(980, G);
    stone(1480, G);
    stone(2120, G);

    const goal = { x: 2320, y: G - 48, w: 32, h: 48 };

    return {
      index: 1, name: 'SKY PEAKS',
      width: 2400, height: 540,
      solids, spikes, rings, water, enemies, checkpoints, flowers, props, goal,
      score: 0, complete: false, deathY: 600,
      spawn: { x: 48, y: G - 24 }
    };
  },
  // Level 3
  function () {
    const T = 16;
    const solids = [], spikes = [], rings = [], water = [], enemies = [], checkpoints = [], flowers = [], props = [];
    const solid = (x, y, w, h) => solids.push({ x, y, w, h });
    const spike = (x, y) => spikes.push({ x, y, w: T, h: T });
    const ring = (x, y) => rings.push({ x, y, w: 12, h: 12, taken: false });
    const wtr = (x, y, w, h) => water.push({ x, y, w, h });
    const enemy = (x, y) => enemies.push({ x, y, w: 16, h: 16, vx: -1.5, alive: true, t: 0 });
    const cp = (x, y) => checkpoints.push({ x, y, w: 16, h: 32, active: false });
    const flower = (x, y, type) => flowers.push({ x, y, type });
    const cactus = (x, y) => props.push({ x, y, type: 'cactus' });
    const stone = (x, y) => props.push({ x, y, type: 'stone' });

    const G = 464;
    solid(0, G, 280, 64);
    solid(360, G, 200, 64);
    solid(640, G, 280, 64);
    solid(1000, G, 320, 64);
    solid(1400, G, 240, 64);
    solid(1720, G, 280, 64);
    solid(2080, G, 320, 64);

    // Moving-ish platforms (static but varied)
    solid(120, 352, 80, 16);
    solid(260, 288, 96, 16);
    solid(440, 336, 80, 16);
    solid(600, 272, 112, 16);
    solid(800, 320, 96, 16);
    solid(980, 256, 128, 16);
    solid(1200, 304, 96, 16);
    solid(1400, 240, 112, 16);
    solid(1620, 304, 96, 16);
    solid(1840, 256, 128, 16);
    solid(2080, 320, 96, 16);

    // Water
    wtr(280, G, 80, 64);
    wtr(560, G, 80, 64);
    wtr(920, G, 80, 64);
    wtr(1320, G, 80, 64);
    wtr(1640, G, 80, 64);
    wtr(2000, G, 80, 64);

    // Spikes (many)
    for (let i = 0; i < 14; i++) spike(300 + i * 150, G - 16);
    spike(280, 336);
    spike(620, 256);
    spike(1000, 240);
    spike(1420, 224);
    spike(1860, 240);

    // Enemies
    for (let i = 0; i < 8; i++) enemy(400 + i * 260, G - 16);
    enemy(640, 256);
    enemy(1020, 240);
    enemy(1460, 224);

    // Rings
    for (let i = 0; i < 18; i++) ring(180 + i * 120, 200 + (i % 4) * 24);

    cp(1000, G - 32);
    cp(1700, G - 32);

    // Flores
    flower(140, G, 0);
    flower(2088, 320, 1);

    // Decoración
    cactus(1240, G);
    stone(90, G);
    stone(820, G);
    stone(1560, G);
    stone(2140, G);

    const goal = { x: 2320, y: G - 48, w: 32, h: 48 };

    return {
      index: 2, name: 'DANGER ZONE',
      width: 2400, height: 540,
      solids, spikes, rings, water, enemies, checkpoints, flowers, props, goal,
      score: 0, complete: false, deathY: 600,
      spawn: { x: 48, y: G - 24 }
    };
  }
];

function createLevel(index) {
  const i = (index == null) ? 0 : (index % LEVELS.length);
  const lvl = LEVELS[i]();
  // normalize enemies
  for (const e of lvl.enemies) { e.startX = e.x; e.range = 80; e.dir = -1; }
  return lvl;
}
