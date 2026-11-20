function createCamera(viewW, viewH, worldW, worldH) {
  return {
    x: 0, y: 0, viewW, viewH, worldW, worldH,
    follow(target) {
      const dx = target.x + target.w / 2 - this.viewW / 2;
      const dy = target.y + target.h / 2 - this.viewH / 2;
      this.x += (dx - this.x) * 0.12;
      this.y += (dy - this.y) * 0.12;
      this.x = clamp(this.x, 0, Math.max(0, this.worldW - this.viewW));
      this.y = clamp(this.y, 0, Math.max(0, this.worldH - this.viewH));
    }
  };
}