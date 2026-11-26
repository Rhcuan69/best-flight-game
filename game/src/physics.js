// physics.js — the Kestrel's flight model. An arcade model with real trade-offs:
// throttle buys speed, pitch trades speed for altitude, banking turns the
// aeroplane around, and below stall speed the wing gives up and the plane sinks.
// Fuel and damage are resources the pilot has to manage, not decoration.

import { PLANE, WORLD, RUNWAY } from './config.js';
import { clamp, degToRad, wrapAngle, angleDelta } from './rng.js';

export class FlightState {
  constructor() {
    this.reset(320, 190, 90);
  }

  reset(x, altitude, heading) {
    this.x = x; // metres along the archipelago
    this.altitude = altitude; // metres above the sea
    this.heading = heading; // degrees, 90 = east, 270 = west
    this.pitch = 0; // degrees, positive = nose up
    this.bank = 0; // degrees, positive = banking right
    this.speed = 95; // knots
    this.throttle = 0.55;
    this.fuel = PLANE.fuelCapacity;
    this.damage = 0;
    this.verticalSpeed = 0; // metres per second, for the HUD and landing checks
    this.grounded = false;
    this.stalled = false;
    this.onRunway = false;
  }

  get knots() {
    return this.speed;
  }

  // One fixed step of flight. `ctl` is {pitchUp, pitchDown, bankLeft,
  // bankRight, throttleUp, throttleDown} booleans from the input layer.
  // Returns a list of event strings the game reacts to (e.g. 'stall').
  step(dt, ctl, groundHeightAt) {
    const events = [];
    const wasStalled = this.stalled;

    // Throttle: a lever the pilot works, not a switch.
    if (ctl.throttleUp) this.throttle = clamp(this.throttle + dt * 0.7, 0, 1);
    if (ctl.throttleDown) this.throttle = clamp(this.throttle - dt * 0.9, 0, 1);
    if (this.fuel <= 0) this.throttle = Math.min(this.throttle, 0.12);

    // Pitch and bank ease toward what the pilot asks for.
    const pitchTarget = ctl.pitchUp
      ? PLANE.maxPitchUp
      : ctl.pitchDown
        ? PLANE.maxPitchDown
        : 0;
    const bankTarget = ctl.bankLeft ? -38 : ctl.bankRight ? 38 : 0;
    this.pitch += clamp(pitchTarget - this.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
    this.bank += clamp(bankTarget - this.bank, -70 * dt, 70 * dt);

    // Banking turns the aeroplane: heading follows the bank.
    this.heading = wrapAngle(this.heading + this.bank * 0.62 * dt);

    // Speed: thrust minus drag, minus the cost of climbing. Drag grows with
    // the square of speed, plus a small base drag so cutting the throttle
    // actually slows the aeroplane down for a landing.
    const thrust = this.throttle * PLANE.thrust;
    const drag = PLANE.drag * this.speed * (this.speed / 100) + 2.5;
    const climbCost = Math.max(0, this.pitch) * 0.55;
    this.speed += (thrust - drag - climbCost) * dt;
    this.speed = clamp(this.speed, 0, WORLD.maxSpeed + 30);

    // Lift: climbing converts speed into altitude; stalling sinks the plane.
    // A dive bites harder than a climb of the same angle, so a landing
    // approach can be flown instead of waited for.
    this.stalled = this.speed < WORLD.stallSpeed && !this.grounded;
    if (this.stalled && !wasStalled) events.push('stall');
    const msPerKnot = 0.514444; // 1 knot in metres per second
    const speedMs = this.speed * msPerKnot;
    const pitchFactor = this.pitch >= 0 ? PLANE.climbRate : 0.9;
    let vs = speedMs * Math.sin(degToRad(this.pitch)) * pitchFactor;
    if (this.stalled) vs -= PLANE.sinkRate * (1 - this.speed / WORLD.stallSpeed);
    if (this.altitude > WORLD.maxAltitude) vs -= (this.altitude - WORLD.maxAltitude) * 0.06;
    this.verticalSpeed = vs;
    this.altitude += vs * dt;

    // Horizontal travel follows the heading; the pilot sees it as ground speed.
    const headingRad = degToRad(this.heading);
    const groundSpeed = speedMs * Math.cos(degToRad(this.pitch));
    this.x += Math.cos(headingRad) * groundSpeed * dt;
    this.x = clamp(this.x, 40, WORLD.worldLength - 40);

    // Fuel burns with throttle; gliding sips it.
    const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * this.throttle;
    this.fuel = Math.max(0, this.fuel - burn * dt);

    // Terrain contact: the ground height function decides what happens.
    const ground = groundHeightAt(this.x);
    this.onRunway = this._onRunwayStrip(this.x, ground);
    if (this.altitude <= ground) {
      this.altitude = ground;
      this._touchdown(events, ground, dt);
    } else {
      this.grounded = false;
    }
    return events;
  }

  _onRunwayStrip(x, ground) {
    // Runway strips are recorded on the terrain module; this is filled in
    // by the game when it creates the flight state (see main.js).
    if (!this.runwayCentres) return false;
    return this.runwayCentres.some((c) => Math.abs(x - c) < RUNWAY.length / 2);
  }

  _touchdown(events, ground, dt) {
    const impact = Math.abs(this.verticalSpeed);
    const level = Math.abs(this.pitch) < 12 && Math.abs(this.bank) < 20;
    if (!this.grounded) {
      if (impact > 9 || !level) {
        // A hard or crooked touchdown bends the airframe.
        const hard = impact > 9;
        this.damage = clamp(
          this.damage + (hard ? PLANE.damagePerHardLanding : PLANE.damagePerScrape),
          0,
          100,
        );
        events.push(hard ? 'hard-landing' : 'scrape');
        if (this.damage >= 100) events.push('crash');
      } else if (this.speed > 8) {
        events.push(this.onRunway ? 'landed-runway' : 'landed-field');
      }
    }
    this.grounded = true;
    // Rolling on the ground scrubs speed through friction, about 22 knots
    // per second, unless the pilot is holding the throttle open to taxi.
    const rollingDrag = 22 * dt * (this.throttle > 0.5 ? 0.3 : 1);
    this.speed = Math.max(0, this.speed - rollingDrag);
    this.verticalSpeed = 0;
    if (this.speed < 12) this.pitch = 0;
    // Taking off again: enough speed and a pulled nose lifts off the ground.
    if (this.speed > WORLD.stallSpeed + 8 && this.pitch > 6) {
      this.grounded = false;
      this.altitude = ground + 0.5;
      events.push('takeoff');
    }
  }

  refuel() {
    this.fuel = PLANE.fuelCapacity;
  }

  repair(amount) {
    this.damage = clamp(this.damage - amount, 0, 100);
  }
}

// Heading shown on the compass: 0 = north, 90 = east, 180 = south, 270 = west.
// In side view the aeroplane flies east or west, so the strip swings between
// 090 and 270 with the bank — turning discipline is visible at a glance.
export function headingLabel(heading) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(wrapAngle(heading) / 22.5) % 16];
}

export function headingError(from, to) {
  return angleDelta(from, to);
}
