const Physics = {
  GRAVITY: 0.32,
  MAX_FALL: 7,
  MOVE_ACCEL: 0.5,
  MOVE_FRICTION: 0.8,
  JUMP_VEL: -7.5,
  DASH_VEL: 10,
  TILE: 16,
  VIEW_W: 480,
  VIEW_H: 270
};
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}