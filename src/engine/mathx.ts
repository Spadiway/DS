/** Utilidades matemáticas: RNG con semilla, ruido de valor y fBm. */

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Interpolación exponencial estable con dt variable. */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function angleLerp(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Mulberry32: rápido, determinista, suficiente para generar niveles. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function rngRange(rng: Rng, a: number, b: number): number {
  return a + rng() * (b - a);
}

export function rngInt(rng: Rng, a: number, b: number): number {
  return Math.floor(a + rng() * (b - a + 1));
}

export function rngPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function hash2(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor 2D con interpolación suave. */
export function valueNoise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

export function fbm(x: number, y: number, seed: number, octaves: number, ridged = false): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise2(x * freq, y * freq, seed + i * 1013);
    if (ridged) n = 1 - Math.abs(n) * 2;
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Distribución tipo Poisson barata: rechaza puntos demasiado cercanos. */
export function scatterPoints(
  rng: Rng,
  count: number,
  radius: number,
  minDist: number,
  tries = 12,
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < tries; t++) {
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const p = { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
      let ok = true;
      for (const q of pts) {
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        if (dx * dx + dz * dz < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        pts.push(p);
        break;
      }
    }
  }
  return pts;
}
