const Collision = {
  resolve(entity, level) {
    // Horizontal
    entity.x += entity.vx;
    for (const t of level.solids) {
      if (aabb(entity, t)) {
        if (entity.vx > 0) entity.x = t.x - entity.w;
        else if (entity.vx < 0) entity.x = t.x + t.w;
        entity.vx = 0;
      }
    }
    // Vertical
    entity.y += entity.vy;
    entity.onGround = false;
    for (const t of level.solids) {
      if (aabb(entity, t)) {
        if (entity.vy > 0) { entity.y = t.y - entity.h; entity.onGround = true; entity.squash = 0.75; }
        else if (entity.vy < 0) { entity.y = t.y + t.h; }
        entity.vy = 0;
      }
    }
    // Spikes
    for (const s of level.spikes) {
      if (aabb(entity, s)) entity.die();
    }
    // Water
    for (const w of (level.water || [])) {
      if (aabb(entity, w)) entity.die();
    }
    // Enemies
    for (const e of (level.enemies || [])) {
      if (!e.alive) continue;
      if (aabb(entity, e)) {
        if (entity.vy > 0 && (entity.y + entity.h - e.y) < 10) {
          e.alive = false;
          entity.vy = Physics.JUMP_VEL * 0.7;
          entity.squash = 0.7;
          level.score += 5;
        } else {
          entity.die();
        }
      }
    }
    // Checkpoints
    for (const c of (level.checkpoints || [])) {
      if (!c.active && aabb(entity, c)) { c.active = true; level.spawn = { x: c.x, y: c.y }; }
    }
    // Rings
    for (const r of level.rings) {
      if (!r.taken && aabb(entity, r)) { r.taken = true; level.score += 10; }
    }
    // Goal
    if (level.goal && aabb(entity, level.goal)) level.complete = true;
    // Death pit
    if (entity.y > level.deathY) entity.die();
  }
};