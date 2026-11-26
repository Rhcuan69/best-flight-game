// rng.js — a tiny deterministic random-number generator and the value-noise
// helpers the terrain and clouds are built from. Every island, cloud and
// field is placed from a seed, so the same seed always grows the same isles
// and a screenshot can be reproduced exactly.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash1(n) {
  // A stable 0..1 hash of an integer, for value noise without a table.
  let h = (n | 0) * 374761393 + 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise1(x) {
  // 1-D value noise: smooth interpolation between hashed lattice points.
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i);
  const b = hash1(i + 1);
  return a + (b - a) * smoothstep(f);
}

export function fbm1(x, octaves) {
  // Fractal sum of value noise; used for hills and coastline wobble.
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * valueNoise1(x * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function range(rng, lo, hi) {
  // A uniform draw in [lo, hi) from a seeded generator.
  return lo + rng() * (hi - lo);
}

export function pick(rng, items) {
  // One item from a list, chosen by a seeded generator.
  return items[Math.floor(rng() * items.length) % items.length];
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}

export function wrapAngle(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export function angleDelta(from, to) {
  // Shortest signed difference from -> to, in degrees, in (-180, 180].
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
