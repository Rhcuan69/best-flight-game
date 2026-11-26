// config.js — every tuning number, colour and mission definition for Kestrel Run.
// One place to balance the game: change a value here and the whole game follows it.

export const GAME_TITLE = 'Kestrel Run';
export const GAME_SUBTITLE = 'A courier pilot over the Marrow Isles';

// The seed every staged screenshot and the default world grow from, so a
// screenshot taken today is the same world taken tomorrow.
export const DEFAULT_SEED = 20261126;

// World units: metres. Screen scale is chosen at render time.
export const WORLD = {
  seaLevel: 0, // y = 0 is the sea surface; altitude is measured above it
  groundBase: 26, // flat ground sits this high above the sea
  maxAltitude: 900, // soft ceiling; above this the air thins and lift fades
  worldLength: 14000, // the archipelago is 14 km end to end
  stallSpeed: 42, // knots: below this the wing stops flying and the plane sinks
  maxSpeed: 210, // knots at full throttle in level flight
  cruiseSpeed: 120,
};

export const PLANE = {
  mass: 1.0,
  thrust: 58, // knots per second gained at full throttle
  drag: 0.16, // speed lost per second, proportional to speed
  climbRate: 0.62, // how much of the speed becomes climb at full pitch
  sinkRate: 26, // metres per second lost when stalled
  turnRate: 55, // degrees per second of heading change at full bank
  pitchRate: 46, // degrees per second of pitch change
  maxPitchUp: 32,
  maxPitchDown: -26,
  fuelCapacity: 100,
  fuelBurn: 2.6, // units per second at full throttle
  fuelBurnIdle: 0.5,
  damagePerHardLanding: 34,
  damagePerScrape: 18,
  damagePerSecondInSea: 100,
};

export const SCORE = {
  ring: 500,
  ringTimeBonus: 120, // per second left on the clock when a ring is flown
  dropBullseye: 900,
  dropNear: 450,
  dropFar: 150,
  landing: 1000,
  landingSmoothBonus: 400, // touchdown slower than the smooth limit
  smoothTouchdownSpeed: 55, // knots
  missionComplete: 1500,
  crashPenalty: 0,
};

export const PALETTE = {
  skyTop: '#1d4e89',
  skyMid: '#5ea3d6',
  skyLow: '#bfe3f2',
  sunCore: '#fff3b0',
  sunGlow: '#ffd66b',
  seaDeep: '#14506e',
  seaShallow: '#2f8fb4',
  seaFoam: '#bfe8ef',
  sand: '#e8d29a',
  grass: '#5d9b4a',
  grassDark: '#3f7a35',
  fieldA: '#8fae4e',
  fieldB: '#c9a44e',
  forest: '#2e6b2f',
  rock: '#8d8578',
  snow: '#f4f7f7',
  runway: '#3a3f46',
  runwayMark: '#f5f0dc',
  ring: '#ffd23e',
  ringGlow: 'rgba(255,210,62,0.55)',
  fuelRing: '#3ee68a',
  dropZone: '#ff7a59',
  hudAmber: '#ffb347',
  hudGreen: '#7dff9a',
  hudRed: '#ff5d5d',
  hudPanel: 'rgba(8, 20, 34, 0.72)',
  hudText: '#eaf6ff',
  panelFace: '#101c26',
  gaugeGlow: '#ffe9a8',
};

// The three sorties. Each one is a different kind of flying, so the same
// aeroplane has to be flown three different ways.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Thread every ring before the clock runs out.',
    briefing:
      'Eight beacon rings hang over the isles. Fly through each one in order. ' +
      'Full throttle is fast but thirsty — watch the fuel gauge.',
    timeLimit: 150,
    startX: 320,
    startAltitude: 190,
    startHeading: 90,
    rings: [
      { x: 900, y: 210 }, { x: 1500, y: 300 }, { x: 2150, y: 180 },
      { x: 2900, y: 330 }, { x: 3650, y: 230 }, { x: 4400, y: 360 },
      { x: 5200, y: 200 }, { x: 6000, y: 300 },
    ],
    fuelRings: [{ x: 2550, y: 260 }, { x: 4800, y: 280 }],
    dropZones: [],
    runways: [],
    parcels: 0,
  },
  {
    id: 'parcel-drop',
    name: 'Parcel Drop',
    tagline: 'Three villages, three parcels, one low pass each.',
    briefing:
      'Drop a parcel on each marked village. Release low and slow — ' +
      'a parcel dropped high drifts wide. Space or click drops the parcel.',
    timeLimit: 210,
    startX: 320,
    startAltitude: 240,
    startHeading: 90,
    rings: [],
    fuelRings: [{ x: 3300, y: 300 }],
    dropZones: [
      { x: 1400, radius: 90, name: 'Tidewater' },
      { x: 3400, radius: 90, name: 'Gullrock' },
      { x: 5400, radius: 90, name: 'Lantern Bay' },
    ],
    runways: [],
    parcels: 3,
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    tagline: 'Land on three island strips, then fly on.',
    briefing:
      'Touch down on each island runway and take off again. ' +
      'Land slow and level — a hard touchdown bends the airframe. ' +
      'Every landing refuels the Kestrel.',
    timeLimit: 300,
    startX: 320,
    startAltitude: 200,
    startHeading: 90,
    rings: [],
    fuelRings: [],
    dropZones: [],
    runways: [
      { x: 1500, name: 'Tidewater Strip' },
      { x: 3600, name: 'Gullrock Strip' },
      { x: 5800, name: 'Lantern Bay Strip' },
    ],
    parcels: 0,
  },
];

export const RUNWAY = {
  length: 420, // metres of flat strip
  width: 26,
};

export const RING = {
  radius: 46, // metres; the ring you must fly through
  tolerance: 14, // extra slack on the plane's distance from the ring centre
};

export const KEYS = {
  pitchUp: ['ArrowUp', 'KeyI'],
  pitchDown: ['ArrowDown', 'KeyK'],
  bankLeft: ['ArrowLeft', 'KeyJ'],
  bankRight: ['ArrowRight', 'KeyL'],
  throttleUp: ['KeyW', 'ShiftLeft', 'ShiftRight'],
  throttleDown: ['KeyS', 'ControlLeft', 'ControlRight'],
  drop: ['Space'],
  pause: ['KeyP', 'Escape'],
  restart: ['KeyR'],
  mute: ['KeyM'],
  mission1: ['Digit1'],
  mission2: ['Digit2'],
  mission3: ['Digit3'],
  confirm: ['Enter'],
};
