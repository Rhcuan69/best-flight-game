// terrain.js — the Marrow Isles: seeded value-noise hills, a sea with a
// shoreline, parallax clouds and mountains, fields, forests, villages and
// runway strips. Everything is drawn from the seed, so the same world always
// grows the same way and screenshots are reproducible.

import { PALETTE, RUNWAY, WORLD } from './config.js';
import { clamp, fbm1, hash1, lerp, mulberry32, range } from './rng.js';

export class Terrain {
  constructor(seed, runwayCentres) {
    this.seed = seed;
    this.runwayCentres = runwayCentres.slice();
    this.rng = mulberry32(seed);
    this.clouds = [];
    for (let i = 0; i < 18; i += 1) {
      this.clouds.push({
        x: this.rng() * WORLD.worldLength,
        y: range(this.rng, 430, 690),
        scale: range(this.rng, 0.5, 1.3),
        speed: range(this.rng, 2, 6),
      });
    }
    this.birds = [];
    for (let i = 0; i < 9; i += 1) {
      this.birds.push({
        x: this.rng() * WORLD.worldLength,
        y: 180 + this.rng() * 220,
        phase: this.rng() * Math.PI * 2,
        speed: 6 + this.rng() * 8,
      });
    }
  }

  // Ground height (metres above the sea) at world x. Islands rise from the
  // sea as smooth bumps; runway strips are flattened to the base height.
  groundHeight(x) {
    if (x < 0 || x > WORLD.worldLength) return WORLD.groundBase;
    const coast = fbm1(x * 0.00045 + this.seed * 0.13, 3);
    const hills = fbm1(x * 0.0016 + 7.7 + this.seed * 0.07, 4);
    let h = WORLD.groundBase + coast * 90 + Math.max(0, hills - 0.55) * 190;
    // Carve the sea channels between islands.
    const channel = fbm1(x * 0.00021 + 3.1, 2);
    if (channel > 0.62) {
      const depth = (channel - 0.62) / 0.38;
      h = lerp(h, -6, clamp(depth * 1.4, 0, 1));
    }
    // Runway strips are bulldozed flat.
    for (const c of this.runwayCentres) {
      const d = Math.abs(x - c);
      if (d < RUNWAY.length / 2 + 60) {
        const t = clamp((d - RUNWAY.length / 2) / 60, 0, 1);
        h = lerp(WORLD.groundBase, h, t * t);
      }
    }
    return h;
  }

  isSea(x) {
    return this.groundHeight(x) < 2;
  }

  fieldColour(x) {
    // Patchwork fields: the hash of the field index picks one of two crops.
    const idx = Math.floor(x / 260);
    return hash1(idx * 7 + this.seed) > 0.5 ? PALETTE.fieldA : PALETTE.fieldB;
  }

  // --- drawing -------------------------------------------------------------
  // The camera looks sideways at the world: screenX = (worldX - camX) * scale
  // + planeScreenX, screenY = horizonScreenY - altitude * scale.

  drawSky(ctx, w, h, time) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Sun with a soft halo, fixed in the sky's east.
    const sunX = w * 0.78;
    const sunY = h * 0.16;
    const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
    halo.addColorStop(0, 'rgba(255, 214, 107, 0.9)');
    halo.addColorStop(0.35, 'rgba(255, 214, 107, 0.35)');
    halo.addColorStop(1, 'rgba(255, 214, 107, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  drawClouds(ctx, w, h, camX, scale, time) {
    // Clouds drift slowly and sit high, so the aeroplane reads against sky
    // rather than disappearing into a puff.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    for (const c of this.clouds) {
      const span = w + 400;
      const screenX = (((c.x - camX * 0.25 + time * c.speed) % span) + span) % span - 200;
      const screenY = h * 0.08 + (c.y / 900) * h * 0.26;
      this._puff(ctx, screenX, screenY, 26 * c.scale);
    }
  }

  _puff(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, y + r * 0.12, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x - r * 0.9, y + r * 0.15, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.45, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMountains(ctx, w, horizonY, camX, scale) {
    // Two distant ridges, drawn from the same noise as the ground so they
    // line up with the hills the pilot is actually flying over.
    for (const [parallax, colour, base, amp] of [
      [0.18, '#7fa8c9', 120, 130],
      [0.38, '#5d87a8', 70, 95],
    ]) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      const step = 14;
      for (let sx = 0; sx <= w + step; sx += step) {
        const wx = camX * parallax + (sx / scale) * 0.6;
        const ridge = base + fbm1(wx * 0.0009 + parallax * 31, 3) * amp;
        ctx.lineTo(sx, horizonY - ridge * 0.9);
      }
      ctx.lineTo(w, horizonY);
      ctx.closePath();
      ctx.fill();
      // Snow caps on the far ridge.
      if (parallax < 0.2) {
        ctx.fillStyle = 'rgba(244, 247, 247, 0.85)';
        for (let sx = 0; sx <= w; sx += 26) {
          const wx = camX * parallax + (sx / scale) * 0.6;
          const ridge = base + fbm1(wx * 0.0009 + parallax * 31, 3) * amp;
          if (ridge > base + amp * 0.62) {
            ctx.beginPath();
            ctx.arc(sx, horizonY - ridge * 0.9 + 6, 9, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  drawGround(ctx, w, h, camX, scale, horizonY, time) {
    // The sea first, then the land mass on top of it.
    const seaY = horizonY;
    const seaGrad = ctx.createLinearGradient(0, seaY, 0, h);
    seaGrad.addColorStop(0, PALETTE.seaShallow);
    seaGrad.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, seaY, w, h - seaY);
    // Sun glitter on the water.
    ctx.fillStyle = 'rgba(255, 240, 180, 0.35)';
    for (let i = 0; i < 14; i += 1) {
      const gx = ((i * 173.3 + time * 12) % (w + 120)) - 60;
      const gy = seaY + 8 + ((i * 47) % Math.max(10, h - seaY - 14));
      ctx.fillRect(gx, gy, 26 + (i % 3) * 10, 2);
    }

    // Land: sample the ground height across the screen and fill beneath it.
    const step = 6;
    ctx.beginPath();
    ctx.moveTo(-4, h + 4);
    const heights = [];
    for (let sx = -4; sx <= w + step; sx += step) {
      const wx = camX + (sx - w * 0.42) / scale;
      const gh = this.groundHeight(wx);
      heights.push({ sx, gh });
      ctx.lineTo(sx, horizonY - gh * scale);
    }
    ctx.lineTo(w + 4, h + 4);
    ctx.closePath();
    const landGrad = ctx.createLinearGradient(0, horizonY - 160 * scale, 0, h);
    landGrad.addColorStop(0, PALETTE.grass);
    landGrad.addColorStop(1, PALETTE.grassDark);
    ctx.fillStyle = landGrad;
    ctx.fill();

    // Patchwork fields and forest clumps on the land.
    for (let sx = -4; sx <= w; sx += 12) {
      const wx = camX + (sx - w * 0.42) / scale;
      const gh = this.groundHeight(wx);
      if (gh < 4) continue;
      const gy = horizonY - gh * scale;
      if (hash1(Math.floor(wx / 260) * 7 + this.seed) > 0.5) {
        ctx.fillStyle = this.fieldColour(wx);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(sx, gy, 12, Math.min(34, (h - gy) * 0.5));
        ctx.globalAlpha = 1;
      }
      // Trees: little triangles where the noise says forest.
      if (hash1(Math.floor(wx / 34) * 13 + 5) > 0.66 && gh > 8) {
        ctx.fillStyle = PALETTE.forest;
        ctx.beginPath();
        ctx.moveTo(sx, gy - 10);
        ctx.lineTo(sx - 5, gy + 1);
        ctx.lineTo(sx + 5, gy + 1);
        ctx.closePath();
        ctx.fill();
      }
    }

    // A dirt road follows the ground, linking the villages and strips.
    ctx.strokeStyle = 'rgba(122, 90, 58, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let sx = -4; sx <= w; sx += 8) {
      const wx = camX + (sx - w * 0.42) / scale;
      const gh = this.groundHeight(wx);
      const gy = horizonY - gh * scale + 7;
      if (gh < 4) continue;
      if (sx === -4) ctx.moveTo(sx, gy);
      else ctx.lineTo(sx, gy);
    }
    ctx.stroke();

    // Beaches where land meets the sea.
    ctx.fillStyle = PALETTE.sand;
    for (let sx = -4; sx <= w; sx += 6) {
      const wx = camX + (sx - w * 0.42) / scale;
      const gh = this.groundHeight(wx);
      if (gh >= 2 && gh < 12) {
        ctx.fillRect(sx, horizonY - gh * scale, 6, 4);
      }
    }

    this._drawRunways(ctx, w, camX, scale, horizonY);
    this._drawVillages(ctx, w, camX, scale, horizonY);
  }

  _drawRunways(ctx, w, camX, scale, horizonY) {
    for (const c of this.runwayCentres) {
      const cx = (c - camX) * scale + w * 0.42;
      const halfLen = (RUNWAY.length / 2) * scale;
      const y = horizonY - WORLD.groundBase * scale;
      if (cx + halfLen < -40 || cx - halfLen > w + 40) continue;
      ctx.fillStyle = PALETTE.runway;
      ctx.fillRect(cx - halfLen, y - 5, halfLen * 2, 10);
      ctx.fillStyle = PALETTE.runwayMark;
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(cx + i * (halfLen / 3.6) - 8, y - 1, 16, 2);
      }
      // Threshold chevrons at both ends.
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(cx - halfLen, y - 7, 4, 14);
      ctx.fillRect(cx + halfLen - 4, y - 7, 4, 14);
    }
  }

  _drawVillages(ctx, w, camX, scale, horizonY) {
    // Little harbour villages sit beside the drop zones: a cluster of roofs
    // and a jetty. They are drawn 170 m west of the runway centre so the
    // houses never sit on the strip itself.
    if (!this.villageXs) return;
    for (const vx of this.villageXs) {
      const cx = (vx - 170 - camX) * scale + w * 0.42;
      if (cx < -80 || cx > w + 80) continue;
      const gy = horizonY - this.groundHeight(vx - 170) * scale;
      ctx.fillStyle = '#b3543f';
      for (let i = 0; i < 4; i += 1) {
        const hx = cx - 34 + i * 20;
        ctx.fillRect(hx, gy - 14, 16, 14);
        ctx.beginPath();
        ctx.moveTo(hx - 2, gy - 14);
        ctx.lineTo(hx + 8, gy - 22);
        ctx.lineTo(hx + 18, gy - 14);
        ctx.closePath();
        ctx.fill();
      }
      // Jetty out into the water.
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(cx + 44, gy - 2, 30, 4);
    }
  }

  drawBirds(ctx, w, camX, scale, horizonY, time) {
    ctx.strokeStyle = 'rgba(30, 40, 50, 0.8)';
    ctx.lineWidth = 1.6;
    for (const b of this.birds) {
      const bx = ((b.x + time * b.speed - camX * 0.9) % (w + 200) + w + 200) % (w + 200) - 100;
      const by = horizonY - b.y * 0.55;
      const flap = Math.sin(time * 6 + b.phase) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by);
      ctx.quadraticCurveTo(bx - 2, by - 3 - flap, bx, by);
      ctx.quadraticCurveTo(bx + 2, by - 3 - flap, bx + 7, by);
      ctx.stroke();
    }
  }
}
