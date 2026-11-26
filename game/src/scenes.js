// scenes.js — staged moments for the screenshots, and a small autopilot that
// flies them. A `?shot=` URL picks a scene: the game sets the aeroplane and
// the mission to a moment worth photographing, then the autopilot keeps the
// plane flying so the frame is alive. These are real states of the real game,
// not pictures pasted in.

import { MISSIONS, DEFAULT_SEED } from './config.js';
import { clamp } from './rng.js';

// The four shots the entry ships: cover first, then the others.
export const SHOTS = {
  cover: {
    mission: 0,
    x: 700,
    altitude: 215,
    speed: 132,
    heading: 90,
    throttle: 0.72,
    fuel: 82,
    blurb: 'Ring Run, two rings in — the next beacon dead ahead.',
  },
  rings: {
    mission: 0,
    x: 2050,
    altitude: 190,
    speed: 148,
    heading: 90,
    throttle: 0.85,
    fuel: 64,
    blurb: 'Threading ring three at full throttle.',
  },
  landing: {
    mission: 2,
    x: 1180,
    altitude: 96,
    speed: 74,
    heading: 90,
    throttle: 0.3,
    fuel: 58,
    blurb: 'Final approach to Tidewater Strip, low and slow.',
  },
  menu: {
    mission: 1,
    x: 320,
    altitude: 240,
    speed: 110,
    heading: 90,
    throttle: 0.55,
    fuel: 100,
    blurb: 'The title screen over the isles.',
  },
};

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name || !SHOTS[name]) return null;
  const seed = Number(params.get('seed') ?? DEFAULT_SEED);
  return { name, ...SHOTS[name], seed: Number.isFinite(seed) ? seed : DEFAULT_SEED };
}

// A gentle pilot for the staged scenes: steer toward the next ring, the
// next runway, or just hold level flight. It only writes the same control
// booleans the keyboard writes, so the autopilot flies through the physics.
export function autopilotControls(plane, mission, dt) {
  const ctl = {
    pitchUp: false,
    pitchDown: false,
    bankLeft: false,
    bankRight: false,
    throttleUp: false,
    throttleDown: false,
  };
  let targetAlt = 240;
  let targetX = plane.x + 800;
  const ring = mission.nextRing;
  const runway = mission.nextRunway;
  const zone = mission.nextDropZone;
  if (ring) {
    targetAlt = ring.y;
    targetX = ring.x;
  } else if (runway) {
    targetAlt = 90;
    targetX = runway.x;
  } else if (zone) {
    targetAlt = 200;
    targetX = zone.x;
  }
  const altErr = targetAlt - plane.altitude;
  if (altErr > 12) ctl.pitchUp = true;
  if (altErr < -12) ctl.pitchDown = true;
  // Turn toward the target's side of the sky; keep flying east in the shots.
  const wantHeading = targetX >= plane.x ? 90 : 270;
  const err = ((wantHeading - plane.heading + 540) % 360) - 180;
  if (err > 4) ctl.bankRight = true;
  if (err < -4) ctl.bankLeft = true;
  // Ease the throttle toward a sensible cruise for the shot.
  const wantSpeed = runway ? 78 : 132;
  if (plane.speed < wantSpeed - 6) ctl.throttleUp = true;
  if (plane.speed > wantSpeed + 6) ctl.throttleDown = true;
  return ctl;
}

export function missionDef(index) {
  return MISSIONS[clamp(index, 0, MISSIONS.length - 1)];
}
