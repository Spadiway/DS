/**
 * Biblioteca de decorado.
 *
 * Cada tipo se describe como una lista de piezas con un "rol" (tronco, hoja,
 * piedra, acento, brillo). Al generar el nivel esos roles se resuelven contra
 * la paleta del mundo y el color se hornea en los vértices, así que un árbol
 * tiene tronco marrón y copa verde con una sola malla y un solo material.
 *
 * Todo se dibuja con InstancedMesh: un draw call por tipo de objeto.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCelMaterialInstanced } from './celMaterial';
import { groundDetailTexture } from './textures';
import type { PropKind } from '../content/worlds';
import { type Rng, rngRange } from './mathx';

export type PropRole =
  | 'trunk'
  | 'foliage'
  | 'foliageDark'
  | 'stone'
  | 'stoneDark'
  | 'accent'
  | 'glow'
  | 'bone'
  /** Madera o muro pintado: vallas, casetas, carteles. */
  | 'painted'
  | 'roof';

export type RoleColors = Record<PropRole, number>;

type Piece = {
  geo: THREE.BufferGeometry;
  role: PropRole;
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
};

const S = new THREE.SphereGeometry(1, 9, 7);
const C = new THREE.ConeGeometry(1, 1, 7);
const C5 = new THREE.ConeGeometry(1, 1, 5);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const CYL_TAPER = new THREE.CylinderGeometry(0.7, 1, 1, 8);
const B = new THREE.BoxGeometry(1, 1, 1);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const ICO1 = new THREE.IcosahedronGeometry(1, 1);
const OCT = new THREE.OctahedronGeometry(1, 0);

const p = (
  geo: THREE.BufferGeometry,
  role: PropRole,
  pos: [number, number, number],
  scale: [number, number, number],
  rot?: [number, number, number],
): Piece => ({ geo, role, pos, scale, rot });

/**
 * Definición de cada prop. Se busca silueta legible con pocos polígonos:
 * formas grandes y claras, no detalle fino que el cel shading no puede mostrar.
 */
const BUILDERS: Record<PropKind, () => Piece[]> = {
  palm: () => [
    p(CYL_TAPER, 'trunk', [0, 1.25, 0], [0.15, 1.25, 0.15], [0.1, 0, 0.08]),
    // Anillos del tronco
    ...Array.from({ length: 4 }, (_, i) =>
      p(CYL, 'trunk', [i * 0.05, 0.42 + i * 0.5, 0], [0.18 - i * 0.013, 0.05, 0.18 - i * 0.013]),
    ),
    ...Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2;
      return p(
        C5,
        i % 2 ? 'foliageDark' : 'foliage',
        [Math.cos(a) * 0.62 + 0.22, 2.5 - (i % 2) * 0.1, Math.sin(a) * 0.62],
        [0.26, 0.72, 0.12],
        [Math.PI / 2 - 0.42, -a, 0],
      );
    }),
    p(S, 'foliageDark', [0.22, 2.5, 0], [0.22, 0.18, 0.22]),
    p(S, 'accent', [0.34, 2.34, 0.1], [0.11, 0.11, 0.11]),
    p(S, 'accent', [0.14, 2.32, -0.12], [0.09, 0.09, 0.09]),
  ],

  fern: () => [
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return p(
        C5,
        i % 2 ? 'foliageDark' : 'foliage',
        [Math.cos(a) * 0.36, 0.5, Math.sin(a) * 0.36],
        [0.24, 1.0, 0.11],
        [0.72, -a, 0],
      );
    }),
    p(S, 'foliageDark', [0, 0.12, 0], [0.18, 0.12, 0.18]),
  ],

  pine: () => [
    p(CYL_TAPER, 'trunk', [0, 0.6, 0], [0.16, 0.6, 0.16]),
    p(C, 'foliageDark', [0, 1.55, 0], [1.0, 1.25, 1.0]),
    p(C, 'foliage', [0, 2.3, 0], [0.78, 1.1, 0.78]),
    p(C, 'foliage', [0, 2.95, 0], [0.55, 0.95, 0.55]),
    p(C, 'foliage', [0, 3.5, 0], [0.3, 0.7, 0.3]),
  ],

  deadTree: () => [
    p(CYL_TAPER, 'trunk', [0, 1.25, 0], [0.22, 1.25, 0.22], [0.06, 0, 0.09]),
    p(CYL_TAPER, 'trunk', [0.52, 2.15, 0.1], [0.1, 0.7, 0.1], [0, 0, -0.95]),
    p(CYL_TAPER, 'trunk', [-0.48, 2.45, -0.1], [0.09, 0.62, 0.09], [0.2, 0, 0.85]),
    p(CYL_TAPER, 'trunk', [0.1, 2.85, 0.32], [0.07, 0.5, 0.07], [-0.75, 0, 0.2]),
    p(CYL_TAPER, 'trunk', [0.86, 2.62, 0.16], [0.05, 0.35, 0.05], [0, 0, -1.25]),
    p(S, 'stoneDark', [0, 0.12, 0], [0.42, 0.14, 0.42]),
  ],

  rock: () => [
    p(ICO, 'stone', [0, 0.5, 0], [0.85, 0.66, 0.76], [0.3, 0.7, 0.2]),
    p(ICO, 'stone', [0.44, 0.3, 0.22], [0.38, 0.32, 0.36], [0.9, 0.2, 0.5]),
    p(ICO, 'stoneDark', [-0.32, 0.24, -0.3], [0.3, 0.26, 0.28], [0.4, 1.2, 0.1]),
    p(ICO, 'stoneDark', [0.1, 0.86, -0.12], [0.26, 0.2, 0.24], [1.1, 0.4, 0.8]),
  ],

  crystal: () => [
    p(OCT, 'glow', [0, 1.0, 0], [0.34, 1.05, 0.34], [0.06, 0.4, 0.08]),
    p(OCT, 'glow', [0.36, 0.6, 0.2], [0.2, 0.62, 0.2], [0.1, 0, -0.35]),
    p(OCT, 'accent', [-0.32, 0.46, -0.18], [0.16, 0.5, 0.16], [-0.15, 0, 0.4]),
    p(ICO, 'stoneDark', [0, 0.12, 0], [0.44, 0.14, 0.44], [0, 0.5, 0]),
  ],

  mushroom: () => [
    p(CYL_TAPER, 'trunk', [0, 0.4, 0], [0.17, 0.4, 0.17]),
    p(S, 'accent', [0, 0.84, 0], [0.66, 0.46, 0.66]),
    p(S, 'foliageDark', [0, 0.72, 0], [0.6, 0.16, 0.6]),
    p(S, 'glow', [0.22, 1.04, 0.16], [0.11, 0.06, 0.11]),
    p(S, 'glow', [-0.26, 0.98, -0.1], [0.09, 0.05, 0.09]),
    p(S, 'glow', [0.04, 1.08, -0.24], [0.08, 0.05, 0.08]),
  ],

  bone: () => [
    p(CYL, 'bone', [0, 0.45, 0], [0.11, 0.9, 0.11], [0, 0, 0.28]),
    p(S, 'bone', [0.26, 0.92, 0], [0.2, 0.2, 0.2]),
    p(S, 'bone', [0.34, 0.86, 0.12], [0.14, 0.14, 0.14]),
    p(S, 'bone', [-0.26, -0.02, 0], [0.2, 0.2, 0.2]),
    p(CYL, 'bone', [0.54, 0.52, 0], [0.07, 0.6, 0.07], [0, 0, -0.5]),
    p(S, 'stoneDark', [0, 0.06, 0], [0.34, 0.08, 0.34]),
  ],

  coral: () => [
    p(CYL_TAPER, 'accent', [0, 0.4, 0], [0.18, 0.4, 0.18]),
    p(CYL_TAPER, 'accent', [0.3, 0.9, 0], [0.11, 0.62, 0.11], [0, 0, -0.62]),
    p(CYL_TAPER, 'foliage', [-0.28, 1.02, 0.12], [0.1, 0.7, 0.1], [-0.2, 0, 0.5]),
    p(S, 'accent', [0.54, 1.3, 0], [0.22, 0.22, 0.22]),
    p(S, 'foliage', [-0.5, 1.46, 0.2], [0.2, 0.2, 0.2]),
    p(S, 'glow', [0.06, 1.16, -0.32], [0.16, 0.16, 0.16]),
    p(S, 'accent', [0.2, 1.6, 0.1], [0.13, 0.13, 0.13]),
  ],

  iceSpike: () => [
    p(OCT, 'glow', [0, 1.15, 0], [0.38, 1.2, 0.38]),
    p(OCT, 'accent', [0.38, 0.62, 0.12], [0.22, 0.66, 0.22], [0, 0, -0.25]),
    p(OCT, 'glow', [-0.34, 0.48, -0.14], [0.17, 0.5, 0.17], [0, 0, 0.28]),
    p(ICO, 'accent', [0, 0.1, 0], [0.5, 0.12, 0.5]),
  ],

  pillar: () => [
    p(B, 'stone', [0, 0.2, 0], [1.15, 0.4, 1.15]),
    p(CYL, 'stone', [0, 1.75, 0], [0.4, 1.45, 0.4]),
    // Estrías: dan lectura de columna en vez de tubo
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return p(B, 'stoneDark', [Math.cos(a) * 0.38, 1.75, Math.sin(a) * 0.38], [0.07, 1.4, 0.07], [0, -a, 0]);
    }),
    p(B, 'stone', [0, 3.35, 0], [1.05, 0.34, 1.05]),
    p(B, 'stoneDark', [0, 3.6, 0], [0.85, 0.18, 0.85]),
  ],

  lantern: () => [
    p(CYL, 'trunk', [0, 0.55, 0], [0.08, 0.55, 0.08]),
    p(B, 'stoneDark', [0, 1.1, 0], [0.46, 0.08, 0.46]),
    p(B, 'glow', [0, 1.38, 0], [0.38, 0.46, 0.38]),
    p(C, 'stoneDark', [0, 1.76, 0], [0.42, 0.3, 0.42]),
    p(S, 'accent', [0, 1.94, 0], [0.07, 0.09, 0.07]),
  ],

  neonSign: () => [
    p(CYL, 'stoneDark', [0, 1.05, 0], [0.1, 1.05, 0.1]),
    p(B, 'stoneDark', [0, 2.3, 0], [1.5, 0.95, 0.14]),
    p(B, 'glow', [0, 2.56, 0.11], [1.15, 0.16, 0.05]),
    p(B, 'glow', [-0.22, 2.16, 0.11], [0.62, 0.16, 0.05]),
    p(B, 'accent', [0.42, 2.16, 0.11], [0.22, 0.16, 0.05]),
    p(B, 'glow', [0, 2.82, 0], [0.28, 0.28, 0.16], [0, 0, 0.78]),
  ],

  pipe: () => [
    p(CYL, 'stone', [0, 1.0, 0], [0.3, 1.0, 0.3]),
    p(CYL, 'stoneDark', [0, 0.16, 0], [0.4, 0.16, 0.4]),
    p(CYL, 'stoneDark', [0, 1.9, 0], [0.4, 0.16, 0.4]),
    p(CYL, 'stoneDark', [0, 1.0, 0], [0.34, 0.12, 0.34]),
    p(CYL, 'stone', [0.62, 1.6, 0], [0.16, 0.62, 0.16], [0, 0, Math.PI / 2]),
    p(S, 'glow', [0, 2.1, 0], [0.16, 0.16, 0.16]),
  ],

  flesh: () => [
    p(ICO1, 'accent', [0, 0.5, 0], [0.74, 0.54, 0.74]),
    p(S, 'foliageDark', [0.22, 0.94, 0.12], [0.34, 0.42, 0.34]),
    p(S, 'accent', [-0.26, 0.8, -0.16], [0.28, 0.34, 0.28]),
    p(CYL_TAPER, 'foliageDark', [0, 1.34, 0], [0.09, 0.5, 0.09], [0.2, 0, 0.3]),
    p(S, 'glow', [0, 1.78, 0.1], [0.11, 0.11, 0.11]),
  ],

  monolith: () => [
    p(B, 'stone', [0, 1.65, 0], [0.95, 3.3, 0.55], [0, 0.3, 0.04]),
    p(B, 'stoneDark', [0, 0.18, 0], [1.35, 0.36, 0.95], [0, 0.3, 0]),
    p(B, 'glow', [0, 2.45, 0.3], [0.42, 0.42, 0.06], [0, 0.3, 0.79]),
    p(B, 'accent', [0, 1.5, 0.3], [0.5, 0.09, 0.05], [0, 0.3, 0]),
    p(B, 'accent', [0, 1.15, 0.3], [0.32, 0.09, 0.05], [0, 0.3, 0]),
  ],

  banner: () => [
    p(CYL, 'trunk', [0, 1.5, 0], [0.08, 1.5, 0.08]),
    p(B, 'accent', [0.36, 2.2, 0], [0.72, 1.5, 0.06]),
    p(B, 'glow', [0.36, 2.5, 0.04], [0.4, 0.4, 0.02]),
    p(B, 'trunk', [0.2, 2.95, 0], [0.5, 0.07, 0.07]),
    p(C, 'accent', [0, 3.15, 0], [0.12, 0.34, 0.12]),
  ],

  /** Valla de listones, como las que bordean los caminos de la referencia. */
  fence: () => [
    // Postes
    p(B, 'painted', [-1.05, 0.62, 0], [0.15, 1.24, 0.15]),
    p(B, 'painted', [1.05, 0.62, 0], [0.15, 1.24, 0.15]),
    p(C, 'painted', [-1.05, 1.32, 0], [0.13, 0.2, 0.13]),
    p(C, 'painted', [1.05, 1.32, 0], [0.13, 0.2, 0.13]),
    // Travesaños
    p(B, 'painted', [0, 0.95, 0], [2.1, 0.13, 0.09]),
    p(B, 'painted', [0, 0.52, 0], [2.1, 0.13, 0.09]),
    // Listones verticales
    ...Array.from({ length: 4 }, (_, i) =>
      p(B, 'painted', [-0.63 + i * 0.42, 0.72, 0.02], [0.12, 1.0, 0.06]),
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      p(C, 'painted', [-0.63 + i * 0.42, 1.24, 0.02], [0.1, 0.16, 0.05]),
    ),
  ],

  /** Escalera de troncos apilados para salvar cuestas. */
  logStair: () => [
    ...Array.from({ length: 5 }, (_, i) => [
      p(CYL, 'trunk', [0, 0.22 + i * 0.42, -i * 0.62], [0.24, 1.5, 0.24], [0, 0, Math.PI / 2]),
      p(CYL, 'trunk', [0, 0.22 + i * 0.42, -i * 0.62 - 0.3], [0.2, 1.5, 0.2], [0, 0, Math.PI / 2]),
      // Tapas de tronco: los anillos que se ven de frente
      p(CYL, 'stoneDark', [0.74, 0.22 + i * 0.42, -i * 0.62], [0.245, 0.04, 0.245], [0, 0, Math.PI / 2]),
      p(CYL, 'stoneDark', [-0.74, 0.22 + i * 0.42, -i * 0.62], [0.245, 0.04, 0.245], [0, 0, Math.PI / 2]),
    ]).flat(),
    // Estacas laterales que sujetan la escalera
    p(CYL, 'trunk', [0.85, 0.5, 0.2], [0.11, 0.5, 0.11]),
    p(CYL, 'trunk', [-0.85, 0.5, 0.2], [0.11, 0.5, 0.11]),
  ],

  /** Caseta con tejado a dos aguas, puerta y ventana. */
  hut: () => [
    p(B, 'painted', [0, 0.95, 0], [2.5, 1.9, 2.2]),
    // Vigas de esquina
    ...[
      [-1.2, -1.05],
      [1.2, -1.05],
      [-1.2, 1.05],
      [1.2, 1.05],
    ].map(([x, z]) => p(B, 'trunk', [x, 0.95, z], [0.2, 1.95, 0.2])),
    // Tejado: dos planos inclinados
    p(B, 'roof', [-0.72, 2.2, 0], [1.75, 0.18, 2.7], [0, 0, 0.62]),
    p(B, 'roof', [0.72, 2.2, 0], [1.75, 0.18, 2.7], [0, 0, -0.62]),
    p(B, 'roof', [0, 2.62, 0], [0.28, 0.2, 2.8]),
    // Puerta y ventana
    p(B, 'trunk', [0, 0.6, 1.13], [0.9, 1.25, 0.08]),
    p(B, 'stoneDark', [0, 0.6, 1.18], [0.72, 1.05, 0.04]),
    p(B, 'glow', [-0.75, 1.25, 1.13], [0.5, 0.5, 0.06]),
    p(B, 'trunk', [-0.75, 1.25, 1.16], [0.55, 0.07, 0.05]),
    p(B, 'trunk', [-0.75, 1.25, 1.16], [0.07, 0.55, 0.05]),
  ],

  /** Cartel de madera junto al camino. */
  signpost: () => [
    p(CYL, 'trunk', [0, 0.8, 0], [0.1, 0.8, 0.1]),
    p(B, 'painted', [0.1, 1.5, 0], [1.15, 0.62, 0.09], [0, 0, -0.09]),
    p(B, 'trunk', [0.1, 1.5, 0.06], [1.0, 0.07, 0.04], [0, 0, -0.09]),
    p(B, 'accent', [0.1, 1.62, 0.07], [0.7, 0.1, 0.03], [0, 0, -0.09]),
    p(B, 'accent', [-0.05, 1.42, 0.07], [0.42, 0.1, 0.03], [0, 0, -0.09]),
  ],

  /** Barril con aros metálicos. */
  barrel: () => [
    p(CYL, 'trunk', [0, 0.55, 0], [0.44, 0.55, 0.44]),
    p(CYL, 'stoneDark', [0, 0.25, 0], [0.47, 0.07, 0.47]),
    p(CYL, 'stoneDark', [0, 0.85, 0], [0.47, 0.07, 0.47]),
    p(CYL, 'accent', [0, 1.11, 0], [0.42, 0.05, 0.42]),
  ],

  /** Farola de camino. */
  lampPost: () => [
    p(CYL, 'stoneDark', [0, 0.1, 0], [0.26, 0.12, 0.26]),
    p(CYL, 'painted', [0, 1.2, 0], [0.09, 1.2, 0.09]),
    p(B, 'painted', [0, 2.45, 0], [0.42, 0.1, 0.42]),
    p(B, 'glow', [0, 2.18, 0], [0.34, 0.42, 0.34]),
    p(C, 'painted', [0, 2.72, 0], [0.36, 0.34, 0.36]),
  ],

  /** Arco de entrada: marca los accesos importantes del nivel. */
  archway: () => [
    p(B, 'stone', [-1.4, 1.5, 0], [0.55, 3.0, 0.55]),
    p(B, 'stone', [1.4, 1.5, 0], [0.55, 3.0, 0.55]),
    p(B, 'stone', [-1.4, 0.16, 0], [0.85, 0.32, 0.85]),
    p(B, 'stone', [1.4, 0.16, 0], [0.85, 0.32, 0.85]),
    p(B, 'stone', [0, 3.15, 0], [3.6, 0.42, 0.6]),
    p(B, 'accent', [0, 3.5, 0], [2.6, 0.3, 0.45]),
    p(B, 'glow', [0, 3.5, 0.24], [1.5, 0.16, 0.05]),
  ],

  grass: () => [
    p(C5, 'foliage', [0, 0.17, 0], [0.045, 0.34, 0.045], [0.16, 0, 0.1]),
    p(C5, 'foliage', [0.09, 0.15, 0.05], [0.038, 0.3, 0.038], [0, 0, -0.34]),
    p(C5, 'foliageDark', [-0.08, 0.13, -0.04], [0.034, 0.26, 0.034], [0.22, 0, 0.4]),
    p(C5, 'foliage', [0.03, 0.12, 0.09], [0.03, 0.23, 0.03], [-0.32, 0, 0.12]),
    p(C5, 'foliageDark', [-0.05, 0.11, 0.07], [0.028, 0.21, 0.028], [0.1, 0, -0.5]),
  ],
};

/**
 * Fusiona las piezas horneando el color de cada rol en los vértices.
 *
 * Todas las piezas se pasan a no indexadas antes de fusionar por dos motivos:
 * mergeGeometries devuelve null si se mezclan geometrías indexadas y no
 * indexadas (icosaedros y esferas, por ejemplo), y sin índices el cálculo de
 * normales da facetas planas, que es justo el acabado de bajo polígono que
 * busca el juego.
 */
function buildGeometry(pieces: Piece[], colors: RoleColors): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  for (const piece of pieces) {
    const g = piece.geo.index ? piece.geo.toNonIndexed() : piece.geo.clone();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (piece.rot) q.setFromEuler(new THREE.Euler(...piece.rot));
    m.compose(new THREE.Vector3(...piece.pos), q, new THREE.Vector3(...piece.scale));
    g.applyMatrix4(m);

    c.setHex(colors[piece.role] ?? 0xffffff);
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('No se pudieron fusionar las piezas del prop: atributos incompatibles');
  merged.computeVertexNormals();
  return merged;
}

export type PropInstance = { x: number; y: number; z: number; scale: number; rotY: number; tint: number };

/**
 * Crea el InstancedMesh de un tipo de prop con su paleta de roles resuelta.
 * `uFadeNear` disuelve con ruido los objetos pegados a la cámara para que el
 * decorado no tape al jugador.
 */
export function createPropMesh(
  kind: PropKind,
  instances: PropInstance[],
  colors: RoleColors,
  opts: { emissive?: number; fadeNear?: number; castShadow?: boolean } = {},
): THREE.InstancedMesh {
  const geo = buildGeometry(BUILDERS[kind](), colors);
  // Misma textura gris de detalle que el terreno: da grano a corteza, hoja y
  // piedra sin necesitar una imagen distinta por tipo de objeto.
  const detail = groundDetailTexture().clone();
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  detail.repeat.set(2.5, 2.5);
  detail.needsUpdate = true;
  const mat = createCelMaterialInstanced({
    color: 0xffffff,
    bands: 3,
    emissive: opts.emissive ?? 0,
    vertexColors: true,
    map: detail,
  });

  const fadeNear = opts.fadeNear ?? 0;
  if (fadeNear > 0) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFadeNear = { value: fadeNear };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n varying float vCamDist;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n vCamDist = -mvPosition.z;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n uniform float uFadeNear;\n varying float vCamDist;')
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
           // Disolución por ruido: el decorado cercano no debe tapar la acción
           if (vCamDist < uFadeNear) {
             float keep = smoothstep(0.1, 1.0, vCamDist / uFadeNear);
             // Matriz de Bayer 4x4: patrón fijo en pantalla, así la disolución
             // no hierve al mover la cámara como hacía el ruido aleatorio.
             ivec2 px = ivec2(mod(gl_FragCoord.xy, 4.0));
             int idx = px.x + px.y * 4;
             float bayer[16];
             bayer[0]=0.0;  bayer[1]=8.0;  bayer[2]=2.0;  bayer[3]=10.0;
             bayer[4]=12.0; bayer[5]=4.0;  bayer[6]=14.0; bayer[7]=6.0;
             bayer[8]=3.0;  bayer[9]=11.0; bayer[10]=1.0; bayer[11]=9.0;
             bayer[12]=15.0;bayer[13]=7.0; bayer[14]=13.0;bayer[15]=5.0;
             float threshold = bayer[idx] / 16.0;
             if (keep < threshold) discard;
           }`,
        );
    };
  }

  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, instances.length));
  im.castShadow = opts.castShadow ?? true;
  im.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  instances.forEach((inst, i) => {
    dummy.position.set(inst.x, inst.y, inst.z);
    dummy.rotation.set(0, inst.rotY, 0);
    dummy.scale.setScalar(inst.scale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    tint.setScalar(1).multiplyScalar(inst.tint);
    im.setColorAt(i, tint);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.count = instances.length;
  im.frustumCulled = false;
  return im;
}

export function randomTint(rng: Rng): number {
  return rngRange(rng, 0.82, 1.14);
}
