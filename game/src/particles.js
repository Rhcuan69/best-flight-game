// particles.js — exhaust puffs, smoke, splash and celebration confetti.
// Small, short-lived and cheap: each particle is a circle with a life.

export class Particles {
  constructor() {
    this.list = [];
  }

  spawn(x, y, vx, vy, life, size, colour) {
    if (this.list.length > 320) return;
    this.list.push({ x, y, vx, vy, life, maxLife: life, size, colour });
  }

  exhaust(x, y, facingEast, throttle) {
    if (throttle < 0.15) return;
    const dir = facingEast ? -1 : 1;
    this.spawn(
      x + dir * 34,
      y + 2,
      dir * (30 + Math.random() * 40),
      (Math.random() - 0.5) * 12,
      0.5 + Math.random() * 0.3,
      3 + Math.random() * 3,
      'rgba(200, 205, 210, 0.5)',
    );
  }

  smoke(x, y, big) {
    for (let i = 0; i < (big ? 5 : 2); i += 1) {
      this.spawn(
        x + (Math.random() - 0.5) * 20,
        y + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 24,
        -18 - Math.random() * 22,
        0.9 + Math.random() * 0.7,
        (big ? 9 : 5) + Math.random() * 6,
        'rgba(60, 60, 66, 0.45)',
      );
    }
  }

  splash(x, y) {
    for (let i = 0; i < 22; i += 1) {
      this.spawn(
        x + (Math.random() - 0.5) * 30,
        y,
        (Math.random() - 0.5) * 90,
        -40 - Math.random() * 90,
        0.6 + Math.random() * 0.5,
        2 + Math.random() * 4,
        'rgba(190, 230, 240, 0.85)',
      );
    }
  }

  confetti(x, y) {
    const colours = ['#ffd23e', '#ff7a59', '#3ee68a', '#5ea3d6', '#ff9ad5'];
    for (let i = 0; i < 60; i += 1) {
      this.spawn(
        x + (Math.random() - 0.5) * 60,
        y + (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 160,
        -30 - Math.random() * 120,
        1.4 + Math.random() * 1.2,
        3 + Math.random() * 4,
        colours[i % colours.length],
      );
    }
  }

  ringBurst(x, y) {
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2;
      this.spawn(
        x,
        y,
        Math.cos(a) * 90,
        Math.sin(a) * 90,
        0.55,
        3.5,
        'rgba(255, 210, 62, 0.9)',
      );
    }
  }

  dust(x, y) {
    // Runway dust kicked up by a touchdown: pale, slow, and quick to fade.
    for (let i = 0; i < 14; i += 1) {
      this.spawn(
        x + (Math.random() - 0.5) * 40,
        y - 2,
        (Math.random() - 0.5) * 50,
        -8 - Math.random() * 18,
        0.7 + Math.random() * 0.5,
        4 + Math.random() * 5,
        'rgba(210, 195, 160, 0.5)',
      );
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 26 * dt; // confetti and smoke drift; exhaust barely falls
      p.size *= 1 + dt * 0.4;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
  }
}
