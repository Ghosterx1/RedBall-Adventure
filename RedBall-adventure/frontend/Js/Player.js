function createPlayer(x, y) {
  return {
    x, y, w: 16, h: 16,
    vx: 0, vy: 0,
    onGround: false,
    alive: true,
    dashCooldown: 0,
    facing: 1,
    angle: 0,
    squash: 1,
    squashVel: 0,
    invuln: 0,
    die() { if (this.invuln <= 0) { this.alive = false; } },
    update(input, level) {
      if (!this.alive) return;
      if (this.invuln > 0) this.invuln--;
      if (input.left) { this.vx -= Physics.MOVE_ACCEL; this.facing = -1; }
      if (input.right) { this.vx += Physics.MOVE_ACCEL; this.facing = 1; }
      if (!input.left && !input.right) this.vx *= Physics.MOVE_FRICTION;
      this.vx = clamp(this.vx, -5, 5);

      if (input.jumpPressed && this.onGround) {
        this.vy = Physics.JUMP_VEL;
        this.onGround = false;
        this.squash = 1.25;
        input.jumpPressed = false;
      }
      if (input.dashPressed && this.dashCooldown <= 0) {
        this.vx = Physics.DASH_VEL * this.facing;
        this.dashCooldown = 30;
        input.dashPressed = false;
      }
      if (this.dashCooldown > 0) this.dashCooldown--;

      this.vy += Physics.GRAVITY;
      this.vy = clamp(this.vy, -12, Physics.MAX_FALL);

      Collision.resolve(this, level);

      this.angle += this.vx * 0.18;
      // squash & stretch recovery
      this.squash += (1 - this.squash) * 0.2;
      if (this.onGround && this.vy === 0) {
        // landing squash handled in collision? keep subtle
      }
    }
  };
}