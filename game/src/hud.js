// hud.js — everything the pilot reads: the top bar (altitude, speed, heading,
// clock, score, fuel, damage, throttle), the compass strip, and the lit
// instrument panel along the bottom: airspeed, altimeter and compass dials
// with needles, plus a fuel gauge and a throttle lever. All drawn on the
// canvas so the instruments are in every screenshot.

import { PALETTE } from './config.js';
import { clamp, degToRad, wrapAngle } from './rng.js';
import { formatClock } from './missions.js';
import { headingLabel } from './physics.js';

export class Hud {
  draw(ctx, w, h, state) {
    const { plane, mission, time, paused } = state;
    this._topBar(ctx, w, plane, mission, time);
    this._compassStrip(ctx, w, plane.heading);
    this._instrumentPanel(ctx, w, h, plane);
    this._warnings(ctx, w, h, plane, mission, time);
    if (paused) this._paused(ctx, w, h);
  }

  _panel(ctx, x, y, pw, ph) {
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 10);
    ctx.fill();
    ctx.stroke();
  }

  _topBar(ctx, w, plane, mission, time) {
    const pad = 12;
    // Left: mission + score + objective, three lines with room to breathe.
    this._panel(ctx, pad, pad, 288, 78);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(mission.name.toUpperCase(), pad + 12, pad + 24);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#bcd8ea';
    ctx.fillText(`${mission.progressText}   •   Score ${mission.score.toLocaleString()}`, pad + 12, pad + 46);
    ctx.fillStyle = '#8fb6cf';
    ctx.font = '12px sans-serif';
    ctx.fillText(mission.objectiveText, pad + 12, pad + 66);
    // Centre: the clock.
    const clockW = 110;
    this._panel(ctx, w / 2 - clockW / 2, pad, clockW, 44);
    const low = mission.timeLeft < 30;
    ctx.fillStyle = low && Math.sin(time * 6) > 0 ? PALETTE.hudRed : PALETTE.hudText;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatClock(mission.timeLeft), w / 2, pad + 31);
    // Right: fuel, damage, throttle bars.
    const rw = 250;
    this._panel(ctx, w - rw - pad, pad, rw, 64);
    this._bar(ctx, w - rw - pad + 12, pad + 14, rw - 24, 10, plane.fuel / 100, plane.fuel < 25 ? PALETTE.hudRed : PALETTE.hudGreen, 'FUEL');
    this._bar(ctx, w - rw - pad + 12, pad + 34, rw - 24, 10, 1 - plane.damage / 100, plane.damage > 60 ? PALETTE.hudRed : PALETTE.hudAmber, 'HULL');
    this._bar(ctx, w - rw - pad + 12, pad + 54, rw - 24, 10, plane.throttle, '#7ec8ff', 'THR');
  }

  _bar(ctx, x, y, bw, bh, frac, colour, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 34, y, bw - 34, bh);
    ctx.fillStyle = colour;
    ctx.fillRect(x + 34, y, Math.max(0, (bw - 34) * clamp(frac, 0, 1)), bh);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + bh - 1);
  }

  _compassStrip(ctx, w, heading) {
    const y = 88;
    const cw = 340;
    const x0 = w / 2 - cw / 2;
    this._panel(ctx, x0, y, cw, 34);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y, cw, 34);
    ctx.clip();
    const pxPerDeg = cw / 120; // show 120 degrees across the strip
    for (let d = -60; d <= 60; d += 5) {
      const hdg = wrapAngle(heading + d);
      const sx = x0 + cw / 2 + d * pxPerDeg;
      const major = hdg % 45 === 0;
      ctx.strokeStyle = major ? 'rgba(234,246,255,0.9)' : 'rgba(234,246,255,0.35)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, y + 8);
      ctx.lineTo(sx, y + (major ? 22 : 16));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = PALETTE.hudText;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(headingLabel(hdg), sx, y + 32);
      }
    }
    ctx.restore();
    // Centre caret and the numeric heading.
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 7, y + 2);
    ctx.lineTo(w / 2 + 7, y + 2);
    ctx.lineTo(w / 2, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(wrapAngle(heading))).padStart(3, '0')}°`, w / 2, y + 48);
  }

  _instrumentPanel(ctx, w, h, plane) {
    const ph = 122;
    const y = h - ph - 10;
    const pw = 430;
    const x = (w - pw) / 2;
    this._panel(ctx, x, y, pw, ph);
    const cy = y + 52;
    const r = 40;
    this._gauge(ctx, x + 62, cy, r, plane.speed, 0, 220, 'KT', 'AIRSPEED', '#7ec8ff');
    this._gauge(ctx, x + 168, cy, r, plane.altitude, 0, 900, 'M', 'ALTITUDE', '#7dff9a');
    this._compassDial(ctx, x + 274, cy, r, plane.heading);
    // Fuel and throttle on the right of the panel.
    const fx = x + 340;
    ctx.fillStyle = '#bcd8ea';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', fx, y + 30);
    this._bar(ctx, fx, y + 36, 76, 12, plane.fuel / 100, plane.fuel < 25 ? PALETTE.hudRed : PALETTE.hudGreen, '');
    ctx.fillStyle = '#bcd8ea';
    ctx.fillText('THROTTLE', fx, y + 70);
    this._bar(ctx, fx, y + 76, 76, 12, plane.throttle, '#7ec8ff', '');
    // Digital readouts under the dials, clear of the dial faces.
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(plane.speed)} kt`, x + 62, y + ph - 8);
    ctx.fillText(`${Math.round(plane.altitude)} m`, x + 168, y + ph - 8);
    ctx.fillText(`${String(Math.round(wrapAngle(plane.heading))).padStart(3, '0')}°`, x + 274, y + ph - 8);
  }

  _gauge(ctx, cx, cy, r, value, min, max, unit, label, needleColour) {
    ctx.fillStyle = PALETTE.panelFace;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Lit tick ring.
    for (let i = 0; i <= 10; i += 1) {
      const a = degToRad(-210 + (i / 10) * 240);
      const major = i % 5 === 0;
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.85)';
      ctx.lineWidth = major ? 2.4 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - (major ? 10 : 6)), cy + Math.sin(a) * (r - (major ? 10 : 6)));
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    const frac = clamp((value - min) / (max - min), 0, 1);
    const na = degToRad(-210 + frac * 240);
    ctx.strokeStyle = needleColour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (r - 12), cy + Math.sin(na) * (r - 12));
    ctx.stroke();
    ctx.fillStyle = PALETTE.gaugeGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bcd8ea';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy - r - 6);
  }

  _compassDial(ctx, cx, cy, r, heading) {
    ctx.fillStyle = PALETTE.panelFace;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const points = ['N', 'E', 'S', 'W'];
    for (let i = 0; i < 4; i += 1) {
      const a = degToRad(i * 90 - heading);
      ctx.fillStyle = PALETTE.gaugeGlow;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(points[i], cx + Math.sin(a) * (r - 12), cy - Math.cos(a) * (r - 12) + 4);
    }
    // The aeroplane symbol stays put; the card turns under it.
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 5, cy + 6);
    ctx.lineTo(cx - 5, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#bcd8ea';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HEADING', cx, cy - r - 6);
  }

  _warnings(ctx, w, h, plane, mission, time) {
    const cx = w / 2;
    let y = 140;
    const warn = [];
    if (plane.stalled && !plane.grounded) warn.push(['STALL — NOSE DOWN, ADD POWER', PALETTE.hudRed]);
    if (plane.fuel < 25 && plane.fuel > 0) warn.push(['LOW FUEL', PALETTE.hudRed]);
    if (plane.fuel <= 0) warn.push(['FUEL EMPTY — GLIDING', PALETTE.hudRed]);
    if (plane.damage > 60) warn.push(['HULL CRITICAL', PALETTE.hudRed]);
    if (mission.timeLeft < 30 && !mission.complete) warn.push(['CLOCK RUNNING OUT', PALETTE.hudAmber]);
    const blink = Math.sin(time * 6) > -0.2;
    for (const [text, colour] of warn) {
      if (!blink) continue;
      ctx.font = 'bold 18px sans-serif';
      const tw = ctx.measureText(text).width;
      this._panel(ctx, cx - tw / 2 - 12, y, tw + 24, 30);
      ctx.fillStyle = colour;
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, y + 21);
      y += 38;
    }
    // The mission's own announcement, centre screen.
    if (mission.message && time < mission.messageUntil) {
      ctx.font = 'bold 20px sans-serif';
      const tw = ctx.measureText(mission.message).width;
      this._panel(ctx, cx - tw / 2 - 14, h * 0.3, tw + 28, 36);
      ctx.fillStyle = PALETTE.hudText;
      ctx.textAlign = 'center';
      ctx.fillText(mission.message, cx, h * 0.3 + 24);
    }
  }

  _paused(ctx, w, h) {
    ctx.fillStyle = 'rgba(4, 12, 20, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h / 2 - 8);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#bcd8ea';
    ctx.fillText('P to resume  •  R to restart the sortie  •  M to mute', w / 2, h / 2 + 22);
  }
}
