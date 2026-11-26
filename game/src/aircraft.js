// aircraft.js — draws the Kestrel, a little high-wing courier aeroplane, from
// canvas paths: no image files, so the plane is crisp at any size and the
// whole aircraft is the game's own drawing. The propeller spins, the nav
// lights blink, and the wings bank with the turn.

import { clamp, degToRad } from './rng.js';

export class AircraftView {
  constructor() {
    this.propAngle = 0;
    this.navBlink = 0;
  }

  update(dt, throttle) {
    this.propAngle += dt * (6 + throttle * 46);
    this.navBlink += dt;
  }

  // Draw the plane centred on (x, y), pitched by `pitchDeg` and banked by
  // `bankDeg`. `facingEast` flips the drawing when the plane flies west.
  // `scale` is pixels per metre of aeroplane length (about 1.6 at 1280 wide).
  // `altitude` is metres above the sea, used only for the ground shadow.
  draw(ctx, x, y, pitchDeg, bankDeg, facingEast, scale, throttle, altitude) {
    ctx.save();
    ctx.translate(x, y);
    // Banking reads as a roll: rotate slightly with the bank as well as pitch.
    ctx.rotate(degToRad(facingEast ? pitchDeg : -pitchDeg));
    if (!facingEast) ctx.scale(-1, 1);
    const s = scale;
    // Soft shadow blob under the plane, for depth over the ground. It only
    // reads near the ground: high up, a shadow in the sky would be a lie.
    const groundProximity = clamp(1 - altitude / 90, 0, 1);
    if (groundProximity > 0) {
      ctx.fillStyle = `rgba(10, 25, 40, ${0.18 * groundProximity})`;
      ctx.beginPath();
      ctx.ellipse(0, 26 * s, 30 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tail fin and stabiliser.
    ctx.fillStyle = '#c8442e';
    ctx.beginPath();
    ctx.moveTo(-26 * s, -2 * s);
    ctx.lineTo(-36 * s, -20 * s);
    ctx.lineTo(-28 * s, -20 * s);
    ctx.lineTo(-20 * s, -4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath();
    ctx.moveTo(-24 * s, 2 * s);
    ctx.lineTo(-38 * s, 6 * s);
    ctx.lineTo(-36 * s, 10 * s);
    ctx.lineTo(-20 * s, 6 * s);
    ctx.closePath();
    ctx.fill();

    // Fuselage: a warm cream body with a red cheatline.
    ctx.fillStyle = '#f2e9d4';
    ctx.beginPath();
    ctx.moveTo(30 * s, 0);
    ctx.quadraticCurveTo(18 * s, -9 * s, -6 * s, -8 * s);
    ctx.quadraticCurveTo(-26 * s, -7 * s, -30 * s, -1 * s);
    ctx.quadraticCurveTo(-26 * s, 7 * s, -6 * s, 8 * s);
    ctx.quadraticCurveTo(18 * s, 9 * s, 30 * s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c8442e';
    ctx.beginPath();
    ctx.moveTo(28 * s, 2 * s);
    ctx.quadraticCurveTo(0, 5 * s, -28 * s, 2 * s);
    ctx.lineTo(-28 * s, 5 * s);
    ctx.quadraticCurveTo(0, 8 * s, 28 * s, 4 * s);
    ctx.closePath();
    ctx.fill();

    // Cockpit windows, lit amber from inside.
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.moveTo(16 * s, -6 * s);
    ctx.lineTo(6 * s, -7 * s);
    ctx.lineTo(4 * s, -2 * s);
    ctx.lineTo(14 * s, -1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 60, 90, 0.55)';
    ctx.beginPath();
    ctx.moveTo(15 * s, -5.5 * s);
    ctx.lineTo(7 * s, -6.5 * s);
    ctx.lineTo(5 * s, -2.5 * s);
    ctx.lineTo(13 * s, -1.5 * s);
    ctx.closePath();
    ctx.fill();

    // High wing, banked with the turn.
    ctx.save();
    ctx.rotate(degToRad(-bankDeg * 0.35));
    ctx.fillStyle = '#d8b13c';
    ctx.beginPath();
    ctx.moveTo(6 * s, -8 * s);
    ctx.lineTo(-4 * s, -8 * s);
    ctx.lineTo(-8 * s, -26 * s);
    ctx.lineTo(-2 * s, -27 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Registration on the tail.
    ctx.fillStyle = '#2c2c2c';
    ctx.font = `bold ${Math.max(7, 7 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('KESTREL', -24 * s, -9 * s);

    // Propeller: two blurred blades spinning at the nose, plus a faint disc
    // when the engine is working hard.
    if (throttle > 0.6) {
      ctx.fillStyle = 'rgba(40, 40, 40, 0.12)';
      ctx.beginPath();
      ctx.arc(31 * s, 0, 14 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(31 * s, 0);
    ctx.rotate(this.propAngle);
    ctx.fillStyle = 'rgba(40, 40, 40, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, -11 * s, 2.2 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 11 * s, 2.2 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(31 * s, 0, 3.2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Navigation lights: red on the left wingtip, green on the right,
    // blinking white strobe on the tail.
    const blink = Math.sin(this.navBlink * 5) > 0.4;
    ctx.fillStyle = blink ? '#ff4444' : '#881111';
    ctx.beginPath();
    ctx.arc(-6 * s, -26 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#44ff88' : '#116622';
    ctx.beginPath();
    ctx.arc(2 * s, -26 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-36 * s, -18 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
