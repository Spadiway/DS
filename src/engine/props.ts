/**
 * Biblioteca de decorado. Cada tipo de prop se construye una vez como geometría
 * fusionada y se dibuja con InstancedMesh: un solo draw call por tipo, lo que
 * permite poblar los mundos con cientos de elementos sin perder los 60 FPS.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCelMaterialInstanced } from './celMaterial';
import type { PropKind } from '../content/worlds';
import { type Rng, rngRange } from './mathx';

type Piece = { geo: THREE.BufferGeometry; pos: [number, number, number]; scale: [number, number, number]; rot?: [number, number, number] };

function build(pieces: Piece[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const p of pieces) {
    const g = p.geo.clone();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (p.rot) q.setFromEuler(new THREE.Euler(...p.rot));
    m.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(...p.scale));
    g.applyMatrix4(m);
    parts.push(g);
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

const S = new THREE.SphereGeometry(1, 8, 6);
const C = new THREE.ConeGeometry(1, 1, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 7);
const B = new THREE.BoxGeometry(1, 1, 1);
const ICO = new THREE.IcosahedronGeometry(1, 0);

/** Geometrías por tipo de prop. Todas parten del origen apoyadas en Y=0. */
const BUILDERS: Record<PropKind, () => THREE.BufferGeometry> = {
  palm: () =>
    build([
      { geo: CYL, pos: [0, 1.6, 0], scale: [0.16, 1.6, 0.16], rot: [0.08, 0, 0.06] },
      ...Array.from({ length: 6 }, (_, i): Piece => {
        const a = (i / 6) * Math.PI * 2;
        return {
          geo: C,
          pos: [Math.cos(a) * 0.85, 3.2, Math.sin(a) * 0.85],
          scale: [0.34, 0.9, 0.2],
          rot: [Math.PI / 2 - 0.5, -a, 0],
        };
      }),
      { geo: S, pos: [0, 3.15, 0], scale: [0.34, 0.28, 0.34] },
      { geo: S, pos: [0.22, 2.95, 0.1], scale: [0.14, 0.14, 0.14] },
    ]),
  fern: () =>
    build([
      ...Array.from({ length: 7 }, (_, i): Piece => {
        const a = (i / 7) * Math.PI * 2;
        return { geo: C, pos: [Math.cos(a) * 0.4, 0.55, Math.sin(a) * 0.4], scale: [0.26, 1.1, 0.14], rot: [0.6, -a, 0] };
      }),
    ]),
  pine: () =>
    build([
      { geo: CYL, pos: [0, 0.7, 0], scale: [0.14, 0.7, 0.14] },
      { geo: C, pos: [0, 1.7, 0], scale: [0.95, 1.3, 0.95] },
      { geo: C, pos: [0, 2.5, 0], scale: [0.72, 1.1, 0.72] },
      { geo: C, pos: [0, 3.2, 0], scale: [0.48, 0.9, 0.48] },
    ]),
  deadTree: () =>
    build([
      { geo: CYL, pos: [0, 1.3, 0], scale: [0.19, 1.3, 0.19], rot: [0.06, 0, 0.1] },
      { geo: CYL, pos: [0.5, 2.2, 0.1], scale: [0.09, 0.7, 0.09], rot: [0, 0, -0.9] },
      { geo: CYL, pos: [-0.45, 2.5, -0.1], scale: [0.08, 0.6, 0.08], rot: [0.2, 0, 0.8] },
      { geo: CYL, pos: [0.1, 2.9, 0.3], scale: [0.06, 0.5, 0.06], rot: [-0.7, 0, 0.2] },
    ]),
  rock: () =>
    build([
      { geo: ICO, pos: [0, 0.5, 0], scale: [0.8, 0.62, 0.72], rot: [0.3, 0.7, 0.2] },
      { geo: ICO, pos: [0.42, 0.28, 0.2], scale: [0.36, 0.3, 0.34], rot: [0.9, 0.2, 0.5] },
      { geo: ICO, pos: [-0.3, 0.22, -0.28], scale: [0.28, 0.24, 0.26], rot: [0.4, 1.2, 0.1] },
    ]),
  crystal: () =>
    build([
      { geo: C, pos: [0, 0.95, 0], scale: [0.32, 1.9, 0.32], rot: [0.06, 0.4, 0.08] },
      { geo: C, pos: [0.34, 0.55, 0.18], scale: [0.18, 1.1, 0.18], rot: [0.1, 0, -0.35] },
      { geo: C, pos: [-0.3, 0.42, -0.16], scale: [0.15, 0.85, 0.15], rot: [-0.15, 0, 0.4] },
    ]),
  mushroom: () =>
    build([
      { geo: CYL, pos: [0, 0.42, 0], scale: [0.16, 0.42, 0.16] },
      { geo: S, pos: [0, 0.86, 0], scale: [0.62, 0.42, 0.62] },
      { geo: S, pos: [0.2, 1.02, 0.16], scale: [0.12, 0.06, 0.12] },
      { geo: S, pos: [-0.24, 0.96, -0.1], scale: [0.1, 0.05, 0.1] },
    ]),
  bone: () =>
    build([
      { geo: CYL, pos: [0, 0.42, 0], scale: [0.1, 0.85, 0.1], rot: [0, 0, 0.28] },
      { geo: S, pos: [0.24, 0.86, 0], scale: [0.19, 0.19, 0.19] },
      { geo: S, pos: [-0.24, -0.02, 0], scale: [0.19, 0.19, 0.19] },
      { geo: CYL, pos: [0.5, 0.5, 0], scale: [0.07, 0.55, 0.07], rot: [0, 0, -0.5] },
    ]),
  coral: () =>
    build([
      { geo: CYL, pos: [0, 0.42, 0], scale: [0.16, 0.42, 0.16] },
      { geo: CYL, pos: [0.28, 0.9, 0], scale: [0.11, 0.6, 0.11], rot: [0, 0, -0.6] },
      { geo: CYL, pos: [-0.26, 1.0, 0.12], scale: [0.1, 0.7, 0.1], rot: [-0.2, 0, 0.5] },
      { geo: S, pos: [0.5, 1.28, 0], scale: [0.2, 0.2, 0.2] },
      { geo: S, pos: [-0.46, 1.42, 0.2], scale: [0.18, 0.18, 0.18] },
      { geo: S, pos: [0.05, 1.1, -0.3], scale: [0.15, 0.15, 0.15] },
    ]),
  iceSpike: () =>
    build([
      { geo: C, pos: [0, 1.1, 0], scale: [0.36, 2.2, 0.36] },
      { geo: C, pos: [0.36, 0.6, 0.1], scale: [0.2, 1.2, 0.2], rot: [0, 0, -0.25] },
      { geo: C, pos: [-0.32, 0.45, -0.12], scale: [0.16, 0.9, 0.16], rot: [0, 0, 0.28] },
    ]),
  pillar: () =>
    build([
      { geo: B, pos: [0, 0.18, 0], scale: [1.1, 0.36, 1.1] },
      { geo: CYL, pos: [0, 1.7, 0], scale: [0.38, 1.5, 0.38] },
      { geo: B, pos: [0, 3.3, 0], scale: [1.0, 0.32, 1.0] },
    ]),
  lantern: () =>
    build([
      { geo: CYL, pos: [0, 0.6, 0], scale: [0.07, 0.6, 0.07] },
      { geo: B, pos: [0, 1.35, 0], scale: [0.42, 0.5, 0.42] },
      { geo: C, pos: [0, 1.72, 0], scale: [0.4, 0.28, 0.4] },
    ]),
  neonSign: () =>
    build([
      { geo: CYL, pos: [0, 1.1, 0], scale: [0.09, 1.1, 0.09] },
      { geo: B, pos: [0, 2.3, 0], scale: [1.5, 0.9, 0.12] },
      { geo: B, pos: [0, 2.55, 0.1], scale: [1.1, 0.14, 0.05] },
      { geo: B, pos: [-0.2, 2.15, 0.1], scale: [0.6, 0.14, 0.05] },
    ]),
  pipe: () =>
    build([
      { geo: CYL, pos: [0, 1.0, 0], scale: [0.28, 1.0, 0.28] },
      { geo: CYL, pos: [0, 0.2, 0], scale: [0.36, 0.14, 0.36] },
      { geo: CYL, pos: [0, 1.9, 0], scale: [0.36, 0.14, 0.36] },
      { geo: CYL, pos: [0.6, 1.6, 0], scale: [0.15, 0.6, 0.15], rot: [0, 0, Math.PI / 2] },
    ]),
  flesh: () =>
    build([
      { geo: S, pos: [0, 0.5, 0], scale: [0.7, 0.5, 0.7] },
      { geo: S, pos: [0.2, 0.95, 0.1], scale: [0.34, 0.42, 0.34] },
      { geo: S, pos: [-0.25, 0.8, -0.15], scale: [0.28, 0.34, 0.28] },
      { geo: CYL, pos: [0, 1.3, 0], scale: [0.08, 0.5, 0.08], rot: [0.2, 0, 0.3] },
    ]),
  monolith: () =>
    build([
      { geo: B, pos: [0, 1.6, 0], scale: [0.9, 3.2, 0.5], rot: [0, 0.3, 0.04] },
      { geo: B, pos: [0, 0.16, 0], scale: [1.3, 0.32, 0.9], rot: [0, 0.3, 0] },
      { geo: B, pos: [0, 2.4, 0.28], scale: [0.44, 0.44, 0.06], rot: [0, 0.3, 0.79] },
    ]),
  banner: () =>
    build([
      { geo: CYL, pos: [0, 1.5, 0], scale: [0.07, 1.5, 0.07] },
      { geo: B, pos: [0.35, 2.2, 0], scale: [0.7, 1.5, 0.05] },
      { geo: C, pos: [0, 3.1, 0], scale: [0.11, 0.32, 0.11] },
    ]),
  grass: () =>
    build([
      { geo: C, pos: [0, 0.22, 0], scale: [0.09, 0.45, 0.09], rot: [0.15, 0, 0.1] },
      { geo: C, pos: [0.12, 0.19, 0.06], scale: [0.07, 0.38, 0.07], rot: [0, 0, -0.3] },
      { geo: C, pos: [-0.1, 0.16, -0.05], scale: [0.06, 0.32, 0.06], rot: [0.2, 0, 0.35] },
    ]),
};

const cache = new Map<PropKind, THREE.BufferGeometry>();

export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  let geo = cache.get(kind);
  if (!geo) {
    geo = BUILDERS[kind]();
    cache.set(kind, geo);
  }
  return geo;
}

export type PropInstance = { x: number; y: number; z: number; scale: number; rotY: number; tint: number };

/**
 * Crea el InstancedMesh de un tipo de prop. `emissiveKinds` reciben brillo propio
 * (cristales, neones, faroles) para que iluminen la escena visualmente.
 */
export function createPropMesh(
  kind: PropKind,
  instances: PropInstance[],
  color: number,
  colorAlt: number,
  blendScale = 0,
): THREE.InstancedMesh {
  // Se clona: el atributo instanceColor es por malla y no debe contaminar la caché.
  const geo = propGeometry(kind).clone();
  const emissive = kind === 'crystal' || kind === 'neonSign' || kind === 'lantern' ? 0.35 : 0;
  const mat = createCelMaterialInstanced({
    color,
    colorAlt,
    bands: 3,
    emissive,
    blendScale,
    rimPower: 3,
  });
  // Los props que quedan pegados a la cámara se disuelven para no tapar a Benito
  mat.uniforms.uFadeNear.value = kind === 'grass' ? 0 : 7.5;
  mat.transparent = false;
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, instances.length));
  im.castShadow = kind !== 'grass';
  im.receiveShadow = false;
  const dummy = new THREE.Object3D();
  const colors = new Float32Array(Math.max(1, instances.length) * 3);
  const c = new THREE.Color();
  instances.forEach((inst, i) => {
    dummy.position.set(inst.x, inst.y, inst.z);
    dummy.rotation.set(0, inst.rotY, 0);
    dummy.scale.setScalar(inst.scale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    c.setScalar(1).multiplyScalar(inst.tint);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  });
  im.instanceMatrix.needsUpdate = true;
  im.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
  im.count = instances.length;
  im.frustumCulled = false;
  return im;
}

export function randomTint(rng: Rng): number {
  return rngRange(rng, 0.78, 1.18);
}
