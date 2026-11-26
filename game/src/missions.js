// missions.js — the three sorties: what the pilot has to do, what counts as
// done, and what it is worth. The mission owns the rings, the parcels in the
// air, the drop zones and the runway landings; the game owns the aeroplane.

import { RING, RUNWAY, SCORE, WORLD } from './config.js';
import { clamp } from './rng.js';

export class Mission {
  constructor(def) {
    this.def = def;
    this.reset();
  }

  reset() {
    this.ringIndex = 0;
    this.ringsDone = 0;
    this.dropsDone = 0;
    this.landingsDone = 0;
    this.parcelsLeft = this.def.parcels;
    this.parcels = []; // parcels falling right now: {x, y, vy, zone}
    this.timeLeft = this.def.timeLimit;
    this.score = 0;
    this.complete = false;
    this.failed = false;
    this.landedRunway = new Set(); // runway indices already credited
    this.message = '';
    this.messageUntil = 0;
  }

  get name() {
    return this.def.name;
  }

  get nextRing() {
    return this.def.rings[this.ringIndex] ?? null;
  }

  get nextDropZone() {
    return this.def.dropZones[this.dropsDone] ?? null;
  }

  get nextRunway() {
    return this.def.runways[this.landingsDone] ?? null;
  }

  get objectiveText() {
    if (this.def.id === 'ring-run') {
      return `Ring ${Math.min(this.ringIndex + 1, this.def.rings.length)} of ${this.def.rings.length} — fly through the gold ring`;
    }
    if (this.def.id === 'parcel-drop') {
      const z = this.nextDropZone;
      return z
        ? `Drop a parcel on ${z.name} — ${this.parcelsLeft} parcel${this.parcelsLeft === 1 ? '' : 's'} left`
        : 'All villages supplied — fly home';
    }
    const r = this.nextRunway;
    return r ? `Land on ${r.name} — ${this.landingsDone} of ${this.def.runways.length} strips` : 'All strips visited — sortie complete';
  }

  get progressText() {
    if (this.def.id === 'ring-run') return `${this.ringsDone}/${this.def.rings.length} rings`;
    if (this.def.id === 'parcel-drop') return `${this.dropsDone}/${this.def.dropZones.length} villages`;
    return `${this.landingsDone}/${this.def.runways.length} landings`;
  }

  announce(text, now, seconds = 3) {
    this.message = text;
    this.messageUntil = now + seconds;
  }

  // Called every frame. `plane` is the FlightState, `now` is game time in
  // seconds. Returns event strings for sounds and toasts.
  update(dt, plane, now, terrain) {
    const events = [];
    if (this.complete || this.failed) return events;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.failed = true;
      events.push('time-up');
      return events;
    }

    // Ring Run: fly through the next gold ring, in order.
    const ring = this.nextRing;
    if (ring) {
      const dx = plane.x - ring.x;
      const dy = plane.altitude - ring.y;
      if (Math.hypot(dx, dy) < RING.radius + RING.tolerance) {
        this.ringIndex += 1;
        this.ringsDone += 1;
        const bonus = Math.round(this.timeLeft * 0.4);
        this.score += SCORE.ring + bonus;
        events.push('ring');
        this.announce(`Ring ${this.ringsDone} — +${SCORE.ring + bonus} pts`, now, 2.2);
        if (this.ringIndex >= this.def.rings.length) {
          this._finish(events, now);
        }
      }
    }

    // Green fuel rings top the tanks back up.
    for (const fr of this.def.fuelRings) {
      if (fr.taken) continue;
      if (Math.hypot(plane.x - fr.x, plane.altitude - fr.y) < RING.radius + 10) {
        fr.taken = true;
        plane.refuel();
        events.push('fuel');
        this.announce('Fuel topped up — tanks full', now, 2.2);
      }
    }

    // Parcels fall with a little drag and drift; the ground decides the score.
    for (let i = this.parcels.length - 1; i >= 0; i -= 1) {
      const p = this.parcels[i];
      p.vy = Math.min(p.vy + 30 * dt, 55);
      p.y -= p.vy * dt;
      p.x += p.vx * dt;
      p.vx *= 1 - 0.4 * dt;
      const ground = terrain.groundHeight(p.x);
      if (p.y <= ground) {
        this.parcels.splice(i, 1);
        const zone = this.nextDropZone;
        if (zone) {
          const d = Math.abs(p.x - zone.x);
          if (d < zone.radius * 0.45) {
            this.score += SCORE.dropBullseye;
            this.dropsDone += 1;
            events.push('drop-hit');
            this.announce(`${zone.name} supplied — bullseye! +${SCORE.dropBullseye}`, now, 2.6);
          } else if (d < zone.radius) {
            this.score += SCORE.dropNear;
            this.dropsDone += 1;
            events.push('drop-hit');
            this.announce(`${zone.name} supplied — close! +${SCORE.dropNear}`, now, 2.6);
          } else if (d < zone.radius * 2.2) {
            this.score += SCORE.dropFar;
            this.dropsDone += 1;
            events.push('drop-hit');
            this.announce(`${zone.name} supplied — wide, but it counts +${SCORE.dropFar}`, now, 2.6);
          } else {
            events.push('drop-miss');
            this.announce('Parcel missed the village — it is lost in the scrub', now, 2.6);
          }
          if (this.dropsDone >= this.def.dropZones.length) this._finish(events, now);
        }
      }
    }

    // Island Hop: a gentle touchdown on the next strip, in order.
    const runway = this.nextRunway;
    if (runway && plane.grounded && plane.onRunway) {
      const idx = this.def.runways.indexOf(runway);
      if (!this.landedRunway.has(idx) && Math.abs(plane.x - runway.x) < RUNWAY.length / 2) {
        this.landedRunway.add(idx);
        this.landingsDone += 1;
        const smooth = plane.speed < 55;
        const pts = SCORE.landing + (smooth ? SCORE.landingSmoothBonus : 0);
        this.score += pts;
        plane.refuel();
        events.push('landed');
        this.announce(
          `${runway.name} — ${smooth ? 'smooth touchdown' : 'down'} +${pts} pts, tanks refuelled`,
          now,
          3,
        );
        if (this.landingsDone >= this.def.runways.length) this._finish(events, now);
      }
    }
    return events;
  }

  dropParcel(plane) {
    if (this.def.id !== 'parcel-drop') return false;
    if (this.parcelsLeft <= 0) return false;
    if (!plane || plane.grounded) return false;
    this.parcelsLeft -= 1;
    this.parcels.push({
      x: plane.x,
      y: plane.altitude - 6,
      vx: Math.cos((plane.heading * Math.PI) / 180) * plane.speed * 0.514444 * 0.6,
      vy: 4,
    });
    return true;
  }

  _finish(events, now) {
    this.complete = true;
    const bonus = Math.round(this.timeLeft) * 10;
    this.score += SCORE.missionComplete + bonus;
    events.push('mission-complete');
    this.announce(
      `Sortie complete! +${SCORE.missionComplete + bonus} pts time bonus`,
      now,
      5,
    );
  }

  // Draw the mission's world objects: rings, drop zones, parcels, beacons.
  draw(ctx, toScreen, time) {
    const pulse = 0.75 + Math.sin(time * 3.2) * 0.25;
    // Next ring glows gold; later rings are dimmer so the pilot reads the order.
    this.def.rings.forEach((ring, i) => {
      const s = toScreen(ring.x, ring.y);
      if (s.x < -120 || s.x > ctx.canvas.width + 120) return;
      const isNext = i === this.ringIndex;
      const done = i < this.ringIndex;
      if (done) return;
      const r = RING.radius * s.scale;
      ctx.save();
      ctx.globalAlpha = isNext ? 0.95 : 0.4;
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = isNext ? 7 : 4;
      ctx.shadowColor = 'rgba(255, 210, 62, 0.8)';
      ctx.shadowBlur = isNext ? 22 * pulse : 6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Chevrons point the way through.
      ctx.fillStyle = '#ffd23e';
      ctx.font = `bold ${Math.round(15 * s.scale + 8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), s.x, s.y - r - 10);
      ctx.restore();
    });
    // Fuel rings: green, with a droplet.
    for (const fr of this.def.fuelRings) {
      if (fr.taken) continue;
      const s = toScreen(fr.x, fr.y);
      if (s.x < -120 || s.x > ctx.canvas.width + 120) continue;
      const r = (RING.radius - 6) * s.scale;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#3ee68a';
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(62, 230, 138, 0.8)';
      ctx.shadowBlur = 16 * pulse;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#3ee68a';
      ctx.font = `bold ${Math.round(13 * s.scale + 8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('FUEL', s.x, s.y + 5);
      ctx.restore();
    }
    // Drop zones: a marked circle on the ground with the village name.
    this.def.dropZones.forEach((zone, i) => {
      const done = i < this.dropsDone;
      const s = toScreen(zone.x, 0);
      const gy = s.y;
      if (s.x < -160 || s.x > ctx.canvas.width + 160) return;
      ctx.save();
      ctx.globalAlpha = done ? 0.35 : 0.9;
      ctx.strokeStyle = done ? '#3ee68a' : '#ff7a59';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.ellipse(s.x, gy - 4, zone.radius * s.scale, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!done) {
        ctx.fillStyle = 'rgba(255, 122, 89, 0.9)';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`▼ ${zone.name}`, s.x, gy - 66);
      }
      ctx.restore();
    });
    // Parcels in the air, with a little parachute.
    for (const p of this.parcels) {
      const s = toScreen(p.x, p.y);
      ctx.save();
      ctx.fillStyle = '#ff7a59';
      ctx.beginPath();
      ctx.arc(s.x, s.y - 16, 12, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#ff7a59';
      ctx.beginPath();
      ctx.moveTo(s.x - 11, s.y - 16);
      ctx.lineTo(s.x - 5, s.y - 4);
      ctx.moveTo(s.x + 11, s.y - 16);
      ctx.lineTo(s.x + 5, s.y - 4);
      ctx.stroke();
      ctx.fillStyle = '#c9a44e';
      ctx.fillRect(s.x - 6, s.y - 5, 12, 10);
      ctx.restore();
    }
    // Runway beacons: a column of light over the next strip.
    const runway = this.nextRunway;
    if (runway) {
      const s = toScreen(runway.x, 60);
      if (s.x > -80 && s.x < ctx.canvas.width + 80) {
        const beam = ctx.createLinearGradient(0, s.y - 260, 0, s.y);
        beam.addColorStop(0, 'rgba(255, 210, 62, 0)');
        beam.addColorStop(1, 'rgba(255, 210, 62, 0.35)');
        ctx.fillStyle = beam;
        ctx.fillRect(s.x - 14, s.y - 260, 28, 260);
        ctx.fillStyle = '#ffd23e';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`▸ ${runway.name}`, s.x, s.y - 268);
      }
    }
  }
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function clampScore(v) {
  return clamp(Math.round(v), 0, 999999);
}
