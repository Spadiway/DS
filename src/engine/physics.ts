/**
 * Mundo de colisión: terreno de altura muestreable + cajas (plataformas, muros,
 * cajas rompibles). Los actores son cápsulas verticales, lo que basta para un
 * plataformas 3D y es mucho más barato que una malla de colisión completa.
 */
import * as THREE from 'three';
import { clamp } from './mathx';

export type Heightfield = {
  size: number;
  res: number;
  cell: number;
  data: Float32Array;
  /** Altura del líquido; por debajo se nada o se recibe daño. */
  liquidLevel: number;
};

export type BoxCollider = {
  id: number;
  center: THREE.Vector3;
  half: THREE.Vector3;
  /** Plataformas móviles: desplazamiento aplicado el último frame. */
  delta: THREE.Vector3;
  kind: 'platform' | 'wall' | 'crate' | 'gate';
  solid: boolean;
  userData?: Record<string, unknown>;
};

export class CollisionWorld {
  heightfield: Heightfield;
  boxes: BoxCollider[] = [];
  /** Cajas que se mueven: fuera del índice espacial, se consultan siempre. */
  dynamic: BoxCollider[] = [];
  private grid = new Map<string, BoxCollider[]>();
  private gridCell = 12;
  private nextId = 1;

  constructor(hf: Heightfield) {
    this.heightfield = hf;
  }

  addBox(
    center: THREE.Vector3,
    half: THREE.Vector3,
    kind: BoxCollider['kind'] = 'platform',
    userData?: Record<string, unknown>,
    isDynamic = false,
  ): BoxCollider {
    const b: BoxCollider = { id: this.nextId++, center, half, delta: new THREE.Vector3(), kind, solid: true, userData };
    this.boxes.push(b);
    if (isDynamic) this.dynamic.push(b);
    return b;
  }

  /** Reconstruye el índice espacial. Llamar tras crear el nivel. */
  rebuildIndex(): void {
    this.grid.clear();
    for (const b of this.boxes) {
      if (!this.dynamic.includes(b)) this.indexBox(b);
    }
  }

  private key(cx: number, cz: number): string {
    return `${cx}|${cz}`;
  }

  private indexBox(b: BoxCollider): void {
    const c = this.gridCell;
    const x0 = Math.floor((b.center.x - b.half.x) / c);
    const x1 = Math.floor((b.center.x + b.half.x) / c);
    const z0 = Math.floor((b.center.z - b.half.z) / c);
    const z1 = Math.floor((b.center.z + b.half.z) / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = this.key(x, z);
        let arr = this.grid.get(k);
        if (!arr) {
          arr = [];
          this.grid.set(k, arr);
        }
        arr.push(b);
      }
    }
  }

  /** Cajas potencialmente cercanas a un punto (para plataformas móviles usa un margen). */
  nearby(x: number, z: number, radius = 3): BoxCollider[] {
    const c = this.gridCell;
    const out: BoxCollider[] = [];
    const seen = new Set<number>();
    const x0 = Math.floor((x - radius) / c);
    const x1 = Math.floor((x + radius) / c);
    const z0 = Math.floor((z - radius) / c);
    const z1 = Math.floor((z + radius) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const arr = this.grid.get(this.key(cx, cz));
        if (!arr) continue;
        for (const b of arr) {
          if (!seen.has(b.id)) {
            seen.add(b.id);
            out.push(b);
          }
        }
      }
    }
    // Las cajas dinámicas son pocas: prueba directa de distancia
    for (const b of this.dynamic) {
      if (
        Math.abs(b.center.x - x) < b.half.x + radius &&
        Math.abs(b.center.z - z) < b.half.z + radius &&
        !seen.has(b.id)
      ) {
        seen.add(b.id);
        out.push(b);
      }
    }
    return out;
  }

  /** Altura del terreno con interpolación bilineal. */
  terrainHeight(x: number, z: number): number {
    const hf = this.heightfield;
    const half = hf.size / 2;
    const fx = ((x + half) / hf.size) * (hf.res - 1);
    const fz = ((z + half) / hf.size) * (hf.res - 1);
    const ix = clamp(Math.floor(fx), 0, hf.res - 2);
    const iz = clamp(Math.floor(fz), 0, hf.res - 2);
    const tx = clamp(fx - ix, 0, 1);
    const tz = clamp(fz - iz, 0, 1);
    const i = (r: number, c: number) => hf.data[r * hf.res + c];
    const h00 = i(iz, ix);
    const h10 = i(iz, ix + 1);
    const h01 = i(iz + 1, ix);
    const h11 = i(iz + 1, ix + 1);
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  terrainNormal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = 1.2;
    const hl = this.terrainHeight(x - e, z);
    const hr = this.terrainHeight(x + e, z);
    const hd = this.terrainHeight(x, z - e);
    const hu = this.terrainHeight(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  /** ¿Está el punto dentro de los límites jugables? */
  inBounds(x: number, z: number): boolean {
    const h = this.heightfield.size / 2 - 2;
    return x > -h && x < h && z > -h && z < h;
  }
}

export type Actor = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  height: number;
  onGround: boolean;
  groundNormal: THREE.Vector3;
  /** Plataforma sobre la que se apoya (para arrastrar al actor). */
  standingOn: BoxCollider | null;
  inLiquid: boolean;
  liquidDepth: number;
};

export function createActor(radius: number, height: number): Actor {
  return {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    radius,
    height,
    onGround: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    standingOn: null,
    inLiquid: false,
    liquidDepth: 0,
  };
}

const tmp = new THREE.Vector3();

/**
 * Integra el actor y resuelve colisiones contra terreno y cajas.
 * `position` es el punto de los pies del actor.
 */
export function moveActor(world: CollisionWorld, a: Actor, dt: number, gravity: number, stepHeight = 0.55): void {
  // Arrastre por plataforma móvil
  if (a.standingOn) {
    a.position.add(a.standingOn.delta);
  }

  a.velocity.y -= gravity * dt;

  const dx = a.velocity.x * dt;
  const dy = a.velocity.y * dt;
  const dz = a.velocity.z * dt;

  a.onGround = false;
  a.standingOn = null;

  // ── Eje horizontal ──
  a.position.x += dx;
  a.position.z += dz;

  const boxes = world.nearby(a.position.x, a.position.z, a.radius + 4);
  const feet = a.position.y;
  const headY = a.position.y + a.height;

  for (const b of boxes) {
    if (!b.solid) continue;
    const top = b.center.y + b.half.y;
    const bottom = b.center.y - b.half.y;
    if (headY < bottom || feet > top - 0.05) continue;

    const minX = b.center.x - b.half.x - a.radius;
    const maxX = b.center.x + b.half.x + a.radius;
    const minZ = b.center.z - b.half.z - a.radius;
    const maxZ = b.center.z + b.half.z + a.radius;
    if (a.position.x <= minX || a.position.x >= maxX || a.position.z <= minZ || a.position.z >= maxZ) continue;

    // Escalón: si la parte alta está al alcance, subir en vez de bloquear
    if (top - feet > 0 && top - feet <= stepHeight) {
      a.position.y = top;
      a.velocity.y = Math.max(0, a.velocity.y);
      a.onGround = true;
      a.standingOn = b;
      continue;
    }

    // Empuje por el eje de menor penetración
    const penX = Math.min(a.position.x - minX, maxX - a.position.x);
    const penZ = Math.min(a.position.z - minZ, maxZ - a.position.z);
    if (penX < penZ) {
      a.position.x += a.position.x - b.center.x > 0 ? penX : -penX;
      a.velocity.x = 0;
    } else {
      a.position.z += a.position.z - b.center.z > 0 ? penZ : -penZ;
      a.velocity.z = 0;
    }
  }

  // ── Eje vertical ──
  a.position.y += dy;

  for (const b of boxes) {
    if (!b.solid) continue;
    const minX = b.center.x - b.half.x - a.radius * 0.85;
    const maxX = b.center.x + b.half.x + a.radius * 0.85;
    const minZ = b.center.z - b.half.z - a.radius * 0.85;
    const maxZ = b.center.z + b.half.z + a.radius * 0.85;
    if (a.position.x <= minX || a.position.x >= maxX || a.position.z <= minZ || a.position.z >= maxZ) continue;

    const top = b.center.y + b.half.y;
    const bottom = b.center.y - b.half.y;

    // Aterrizar encima
    if (a.velocity.y <= 0 && a.position.y <= top && a.position.y > top - Math.max(0.6, Math.abs(dy) + 0.25)) {
      a.position.y = top;
      a.velocity.y = 0;
      a.onGround = true;
      a.standingOn = b;
      a.groundNormal.set(0, 1, 0);
    }
    // Golpear con la cabeza
    else if (a.velocity.y > 0 && a.position.y + a.height >= bottom && a.position.y < bottom) {
      a.position.y = bottom - a.height;
      a.velocity.y = 0;
    }
  }

  // ── Terreno ──
  const th = world.terrainHeight(a.position.x, a.position.z);
  if (a.position.y <= th) {
    a.position.y = th;
    if (a.velocity.y < 0) a.velocity.y = 0;
    a.onGround = true;
    a.standingOn = null;
    world.terrainNormal(a.position.x, a.position.z, a.groundNormal);
  }

  // ── Límites del nivel ──
  const lim = world.heightfield.size / 2 - 3;
  if (a.position.x < -lim) {
    a.position.x = -lim;
    a.velocity.x = 0;
  }
  if (a.position.x > lim) {
    a.position.x = lim;
    a.velocity.x = 0;
  }
  if (a.position.z < -lim) {
    a.position.z = -lim;
    a.velocity.z = 0;
  }
  if (a.position.z > lim) {
    a.position.z = lim;
    a.velocity.z = 0;
  }

  // ── Líquido ──
  const lvl = world.heightfield.liquidLevel;
  a.liquidDepth = lvl - a.position.y;
  a.inLiquid = a.liquidDepth > 0.15;

  tmp.set(0, 0, 0);
}

/** Lanza un rayo vertical hacia abajo: devuelve la superficie más alta bajo `y`. */
export function surfaceBelow(world: CollisionWorld, x: number, z: number, y: number): number {
  let best = world.terrainHeight(x, z);
  for (const b of world.nearby(x, z, 2)) {
    if (!b.solid) continue;
    const top = b.center.y + b.half.y;
    if (
      top <= y + 0.1 &&
      top > best &&
      x > b.center.x - b.half.x &&
      x < b.center.x + b.half.x &&
      z > b.center.z - b.half.z &&
      z < b.center.z + b.half.z
    ) {
      best = top;
    }
  }
  return best;
}

/** Comprobación de línea de visión: bloquea si una caja sólida corta el segmento. */
export function hasLineOfSight(world: CollisionWorld, from: THREE.Vector3, to: THREE.Vector3): boolean {
  const dir = tmp.copy(to).sub(from);
  const dist = dir.length();
  if (dist < 0.001) return true;
  dir.divideScalar(dist);
  const steps = Math.min(24, Math.ceil(dist / 1.6));
  for (let i = 1; i < steps; i++) {
    const t = (i / steps) * dist;
    const px = from.x + dir.x * t;
    const py = from.y + dir.y * t;
    const pz = from.z + dir.z * t;
    if (world.terrainHeight(px, pz) > py + 0.3) return false;
    for (const b of world.nearby(px, pz, 1)) {
      if (!b.solid || b.kind === 'crate') continue;
      if (
        px > b.center.x - b.half.x &&
        px < b.center.x + b.half.x &&
        pz > b.center.z - b.half.z &&
        pz < b.center.z + b.half.z &&
        py > b.center.y - b.half.y &&
        py < b.center.y + b.half.y
      ) {
        return false;
      }
    }
  }
  return true;
}
