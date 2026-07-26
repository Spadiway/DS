/**
 * Generador de niveles determinista.
 *
 * A partir de un LevelSpec produce: terreno, líquido, plataformas (fijas y
 * móviles), obstáculos que requieren artefactos concretos, puntos de aparición
 * de mascotas, monedas, galletas, puntos de control y la puerta temporal.
 *
 * Es determinista: la misma semilla genera exactamente el mismo nivel, así que
 * los niveles son estables entre partidas aunque no haya ficheros de datos.
 */
import * as THREE from 'three';
import type { LevelSpec, PetColor } from '../content/worlds';
import { createCelMaterial, createLiquidMaterial, createTerrainMaterial } from './celMaterial';
import { createPropMesh, randomTint, type PropInstance, type RoleColors } from './props';
import { groundDetailTexture, plankTexture, tileTexture } from './textures';
import { CollisionWorld, type BoxCollider, type Heightfield } from './physics';
import { clamp, fbm, makeRng, rngInt, rngPick, rngRange, scatterPoints, terrace, type Rng } from './mathx';
import { qualityPreset } from '../core/settings';

export type MovingPlatform = {
  box: BoxCollider;
  mesh: THREE.Object3D;
  cap?: THREE.Object3D;
  trim?: THREE.Object3D;
  origin: THREE.Vector3;
  axis: THREE.Vector3;
  amplitude: number;
  speed: number;
  phase: number;
};

export type GateObstacle = {
  kind: 'punchWall' | 'dashGate' | 'hoopGap' | 'clubCrate' | 'waterZone';
  box: BoxCollider | null;
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  broken: boolean;
  /** Artefacto necesario para superarlo. */
  requires: string;
  reward?: 'coin' | 'cookie' | 'none';
};

export type SpawnPoint = { x: number; y: number; z: number };

export type GeneratedLevel = {
  spec: LevelSpec;
  group: THREE.Group;
  world: CollisionWorld;
  playerSpawn: THREE.Vector3;
  /** Orientación inicial: mira a lo largo del camino, donde está el contenido. */
  spawnYaw: number;
  petSpawns: { color: PetColor; pos: THREE.Vector3; patrol: THREE.Vector3[] }[];
  coinSpawns: THREE.Vector3[];
  cookieSpawns: THREE.Vector3[];
  checkpoints: THREE.Vector3[];
  gatePosition: THREE.Vector3;
  bossArena: THREE.Vector3 | null;
  movingPlatforms: MovingPlatform[];
  obstacles: GateObstacle[];
  /** Props altos que la cámara debe esquivar (posición y radio en el plano). */
  cameraBlockers: { x: number; z: number; r: number; top: number }[];
  materials: THREE.Material[];
  liquidMesh: THREE.Mesh | null;
  dispose: () => void;
};

/** Props lo bastante altos y opacos como para tapar al jugador. */
const TALL_PROPS = new Set([
  'palm',
  'broadleaf',
  'pine',
  'deadTree',
  'pillar',
  'monolith',
  'neonSign',
  'iceSpike',
  'crystal',
  'archway',
]);

const GATE_REQUIRES: Record<GateObstacle['kind'], string> = {
  punchWall: 'magicPunch',
  dashGate: 'dashHoop',
  hoopGap: 'superHoop',
  clubCrate: 'stunClub',
  waterZone: 'waterNet',
};

/**
 * Traza el camino principal del nivel: una ruta sinuosa que atraviesa la zona
 * jugable pasando por el centro. En las referencias del género el camino de
 * tierra es lo que hace que un escenario parezca construido y no generado:
 * ordena el recorrido, da un hilo que seguir y rompe la extensión de hierba.
 */
function buildPathPoints(spec: LevelSpec, rng: Rng): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const reach = spec.size * 0.4;
  const startAngle = rng() * Math.PI * 2;
  const nodes = 7;
  for (let i = 0; i < nodes; i++) {
    const t = i / (nodes - 1);
    // Recta de lado a lado con serpenteo perpendicular
    const along = (t - 0.5) * 2 * reach;
    const wobble = Math.sin(t * Math.PI * 2.3 + rng() * 0.6) * reach * 0.38;
    const c = Math.cos(startAngle);
    const sn = Math.sin(startAngle);
    pts.push({ x: along * c - wobble * sn, z: along * sn + wobble * c });
  }
  // Subdivisión suave: el camino no debe tener esquinas
  const smooth: { x: number; z: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const e = t * t * (3 - 2 * t);
      smooth.push({ x: a.x + (b.x - a.x) * e, z: a.z + (b.z - a.z) * e });
    }
  }
  smooth.push(pts[pts.length - 1]);
  return smooth;
}

/** Distancia de un punto a la polilínea del camino. */
function distanceToPath(x: number, z: number, path: { x: number; z: number }[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

function buildHeightfield(spec: LevelSpec, rng: Rng): { hf: Heightfield; path: { x: number; z: number }[]; pathMask: Float32Array } {
  const res = 129;
  const size = spec.size;
  const data = new Float32Array(res * res);
  const { amplitude, frequency, octaves, plateau, islandFalloff, ridged } = spec.terrain;
  // Por defecto todos los mundos se aterrazan: da repisas y riscos con los
  // que el sombreado y la escalada tienen algo que hacer.
  const terraceStep = spec.terrain.terraceStep ?? Math.max(1.6, amplitude * 0.26);
  const terraceAmount = spec.terrain.terraceAmount ?? 0.62;
  const half = size / 2;

  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const wx = (x / (res - 1)) * size - half;
      const wz = (z / (res - 1)) * size - half;
      let h = fbm(wx * frequency, wz * frequency, spec.seed, octaves, ridged);

      // Aplanado central: garantiza zonas jugables amplias
      h = Math.sign(h) * Math.pow(Math.abs(h), 1 + plateau);
      h *= amplitude;

      // Aterrazado antes del detalle: primero la arquitectura, luego la textura
      h = terrace(h, terraceStep, 4.5, terraceAmount);

      // Rugosidad de alta frecuencia: sin ella el terreno es una superficie
      // pulida y el sombreado no tiene nada a lo que agarrarse.
      h += fbm(wx * frequency * 6.5, wz * frequency * 6.5, spec.seed + 77, 3) * amplitude * 0.09;
      h += fbm(wx * frequency * 17, wz * frequency * 17, spec.seed + 991, 2) * amplitude * 0.035;

      // Caída en isla: los bordes se hunden bajo el líquido, cerrando el nivel
      const d = Math.max(Math.abs(wx), Math.abs(wz)) / half;
      const falloff = 1 - Math.pow(Math.max(0, (d - islandFalloff) / (1 - islandFalloff)), 1.6);
      h = h * Math.max(0, falloff) - (1 - Math.max(0, falloff)) * amplitude * 2.2;

      /**
       * Explanada de salida. Antes solo se aplanaba de verdad el punto central,
       * así que en los mapas escarpados la partida arrancaba en un barranco con
       * la cámara pegada a un talud. Ahora hay un claro liso de radio 7 con
       * transición suave hasta 16.
       */
      const cd = Math.hypot(wx, wz);
      if (cd < 16) {
        const plat = Math.max(1.2, spec.liquid.level + 2.6);
        const raw = clamp((cd - 7) / 9, 0, 1);
        const k = raw * raw * (3 - 2 * raw);
        h = plat * (1 - k) + h * k;
      }

      data[z * res + x] = h;
    }
  }

  /**
   * Garantía de terreno jugable: si la combinación de amplitud, meseta y nivel
   * de líquido deja casi toda la isla sumergida, no habría dónde colocar
   * mascotas ni objetos. Se eleva el terreno hasta que al menos el 40 % de la
   * zona interior queda en seco. Sin esto, un cambio de paleta puede vaciar un
   * nivel entero sin previo aviso.
   */
  const dryLine = spec.liquid.level + 1.5;
  const inner = Math.floor(res * 0.35);
  let dry = 0;
  let total = 0;
  const heights: number[] = [];
  for (let z = inner; z < res - inner; z++) {
    for (let x = inner; x < res - inner; x++) {
      const h = data[z * res + x];
      heights.push(h);
      total++;
      if (h >= dryLine) dry++;
    }
  }
  if (total > 0 && dry / total < 0.34) {
    heights.sort((a, b) => a - b);
    const target = heights[Math.floor(heights.length * 0.34)];
    // Se limita el desnivel: subir el terreno sin tope deja el líquido enterrado
    // y el nivel pierde sus lagos, calas y ríos de lava.
    const lift = Math.min(dryLine - target, amplitude * 0.55);
    if (lift > 0) {
      for (let i = 0; i < data.length; i++) data[i] += lift;
    }
  }

  // ── Camino ──────────────────────────────────────────────────────────────
  // Se allana el terreno bajo la ruta para que sea transitable de verdad, y se
  // guarda una máscara que el coloreado usa para pintar la tierra.
  const path = buildPathPoints(spec, rng);
  const pathMask = new Float32Array(res * res);
  const halfSize = size / 2;
  const pathWidth = 7.5;
  const feather = 5.5;

  // Altura de referencia del camino: media suavizada a lo largo del trazado
  const smoothHeights: number[] = [];
  for (const p of path) {
    const fx = Math.round(((p.x + halfSize) / size) * (res - 1));
    const fz = Math.round(((p.z + halfSize) / size) * (res - 1));
    const ix = Math.max(0, Math.min(res - 1, fx));
    const iz = Math.max(0, Math.min(res - 1, fz));
    smoothHeights.push(data[iz * res + ix]);
  }
  // Media móvil: el camino sube y baja con suavidad, sin escalones
  const rolled = smoothHeights.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = -4; k <= 4; k++) {
      const j = i + k;
      if (j >= 0 && j < smoothHeights.length) {
        sum += smoothHeights[j];
        n++;
      }
    }
    return sum / n;
  });

  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const wx = (x / (res - 1)) * size - halfSize;
      const wz = (z / (res - 1)) * size - halfSize;
      const d = distanceToPath(wx, wz, path);
      if (d > pathWidth + feather) continue;

      // Altura del punto más cercano del trazado
      let bestI = 0;
      let bestD = Infinity;
      for (let i = 0; i < path.length; i++) {
        const dd = Math.hypot(wx - path[i].x, wz - path[i].z);
        if (dd < bestD) {
          bestD = dd;
          bestI = i;
        }
      }
      const target = rolled[bestI];
      const t = d <= pathWidth ? 1 : 1 - (d - pathWidth) / feather;
      const w = t * t * (3 - 2 * t);
      const idx = z * res + x;
      data[idx] = data[idx] * (1 - w * 0.85) + target * w * 0.85;
      pathMask[idx] = Math.max(pathMask[idx], w);
    }
  }

  return { hf: { size, res, cell: size / (res - 1), data, liquidLevel: spec.liquid.level }, path, pathMask };
}

function buildTerrainMesh(
  hf: Heightfield,
  spec: LevelSpec,
  pathMask: Float32Array,
): { mesh: THREE.Mesh; mat: THREE.Material } {
  const geo = new THREE.PlaneGeometry(hf.size, hf.size, hf.res - 1, hf.res - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const row = Math.floor(i / hf.res);
    const col = i % hf.res;
    pos.setY(i, hf.data[row * hf.res + col]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  /**
   * Color por vértice. Mezcla hierba, tierra, roca, orilla y nieve según
   * pendiente, altura y ruido. Es donde el terreno gana lectura: pintar en el
   * fragmento daría el mismo tono plano en toda la superficie.
   */
  const pal = spec.palette;
  const grass = new THREE.Color(pal.ground);
  const dirt = new THREE.Color(pal.groundAlt);
  const rock = new THREE.Color(pal.cliff);
  const snow = new THREE.Color(0xf2f7ff);
  const shore = new THREE.Color(pal.liquid).lerp(new THREE.Color(pal.groundAlt), 0.55);
  // Tierra batida del camino: más cálida y saturada que el terreno alterno
  const pathColor = new THREE.Color(pal.groundAlt).lerp(new THREE.Color(0xa87a44), 0.6);
  const snowLine = spec.worldId === 4 ? 3.5 : Infinity;

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();

  /**
   * Oclusión horneada en el color de vértice.
   *
   * Es la técnica de la época: sin shadow mapping, el relieve se leía porque
   * el artista —o el compilador de iluminación— dejaba escritas en los
   * vértices las hondonadas oscuras y las crestas claras. Aquí se aproxima
   * comparando la altura de cada vértice con la media de su entorno a tres
   * radios: por encima de la media es cresta y recibe cielo; por debajo es
   * vaguada y está resguardada.
   *
   * Cuesta una pasada sobre el mapa de alturas en la generación y no cuesta
   * nada en tiempo de juego, y es lo que evita que una ladera entera se vea
   * como una lámina de color plano.
   */
  const res = hf.res;
  const cell = hf.cell;
  const rings: number[] = [2.5, 6, 12].map((r) => Math.max(1, Math.round(r / cell)));
  const sampleH = (row: number, col: number): number =>
    hf.data[clamp(row, 0, res - 1) * res + clamp(col, 0, res - 1)];
  const occlusion = (row: number, col: number): number => {
    const h0 = sampleH(row, col);
    let acc = 0;
    let weight = 0;
    for (let k = 0; k < rings.length; k++) {
      const d = rings[k];
      // Peso decreciente: el relieve cercano manda sobre el lejano
      const w = 1 / (k + 1);
      const avg =
        (sampleH(row - d, col) +
          sampleH(row + d, col) +
          sampleH(row, col - d) +
          sampleH(row, col + d) +
          sampleH(row - d, col - d) +
          sampleH(row + d, col + d) +
          sampleH(row - d, col + d) +
          sampleH(row + d, col - d)) /
        8;
      // Se normaliza por el radio para que una cuesta larga y suave no cuente
      // como hondonada profunda
      acc += clamp((h0 - avg) / (d * cell * 0.55), -1, 1) * w;
      weight += w;
    }
    return acc / weight;
  };
  // Tinte del cielo para las crestas y del rebote para las vaguadas: un
  // gradiente de temperatura, no solo de brillo.
  const skyTint = new THREE.Color(pal.sky[1]).lerp(new THREE.Color(0xffffff), 0.5);
  const hollowTint = new THREE.Color(pal.ground).lerp(new THREE.Color(0x2a2418), 0.55);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - Math.abs(normals.getY(i));

    // Parches irregulares de hierba y tierra a distintas escalas
    const patch = fbm(x * 0.028, z * 0.028, spec.seed + 501, 3) * 0.5 + 0.5;
    const mid = fbm(x * 0.085, z * 0.085, spec.seed + 313, 2) * 0.5 + 0.5;
    const fine = fbm(x * 0.19, z * 0.19, spec.seed + 733, 2) * 0.5 + 0.5;
    // Tres escalas de mancha: grandes praderas, calvas medianas y grano fino
    c.copy(grass).lerp(dirt, clamp(smoothstepf(0.35, 0.7, patch) + (mid - 0.5) * 0.5, 0, 1));

    // La roca aflora en las pendientes
    c.lerp(rock, smoothstepf(0.24, 0.52, slope));

    // Orilla justo por encima de la lámina de líquido
    const overLiquid = y - spec.liquid.level;
    if (overLiquid < 3.2) {
      c.lerp(shore, smoothstepf(3.2, 0.2, overLiquid) * 0.85);
    }

    // Nieve en las cotas altas del mundo helado
    if (y > snowLine) {
      c.lerp(snow, clamp((y - snowLine) / 6, 0, 1) * (1 - smoothstepf(0.3, 0.6, slope)));
    }

    // Camino de tierra pisada, con roderas más claras en el centro
    const row = Math.floor(i / hf.res);
    const col = i % hf.res;
    const pm = pathMask[row * hf.res + col] ?? 0;
    if (pm > 0.01) {
      const wear = 0.55 + fine * 0.5;
      c.lerp(pathColor.clone().multiplyScalar(wear), Math.min(1, pm * 1.15));
    }

    // Oclusión horneada: crestas hacia el cielo, vaguadas hacia la sombra
    const occ = occlusion(row, col);
    if (occ > 0) c.lerp(skyTint, occ * 0.13);
    else c.lerp(hollowTint, -occ * 0.3);

    // Variación fina de luminosidad: rompe las bandas planas
    tmp.setScalar(0.86 + fine * 0.28);
    c.multiply(tmp);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = createTerrainMaterial({
    ground: pal.ground,
    groundAlt: pal.groundAlt,
    cliff: pal.cliff,
    bands: 4,
    // Textura de detalle en gris, repetida densamente y multiplicada por el
    // color de vértice: es lo que quita al suelo el aspecto de plástico liso.
    detail: groundDetailTexture(),
    detailRepeat: hf.size / 5.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return { mesh, mat };
}

function smoothstepf(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Busca una posición de suelo válida (fuera del líquido, con pendiente suave). */
function findGround(
  world: CollisionWorld,
  rng: Rng,
  spec: LevelSpec,
  minDistFromCenter = 0,
  tries = 40,
  maxDistFromCenter = Infinity,
): THREE.Vector3 | null {
  const half = spec.size / 2 - 12;
  const n = new THREE.Vector3();
  // Dos vueltas: la primera exige terreno claramente seco y llano; la segunda
  // afloja los criterios para que ningún nivel se quede sin puntos válidos.
  for (let pass = 0; pass < 2; pass++) {
    const minHeight = spec.liquid.level + (pass === 0 ? 1.4 : 0.4);
    const minFlat = pass === 0 ? 0.72 : 0.55;
    const minDist = pass === 0 ? minDistFromCenter : minDistFromCenter * 0.5;
    for (let i = 0; i < tries; i++) {
      const x = rngRange(rng, -half, half);
      const z = rngRange(rng, -half, half);
      const d = Math.hypot(x, z);
      if (d < minDist || d > maxDistFromCenter) continue;
      const h = world.terrainHeight(x, z);
      if (h < minHeight) continue;
      world.terrainNormal(x, z, n);
      if (n.y < minFlat) continue;
      return new THREE.Vector3(x, h, z);
    }
  }
  return null;
}

export function generateLevel(spec: LevelSpec): GeneratedLevel {
  const rng = makeRng(spec.seed);
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const disposables: { dispose(): void }[] = [];
  const q = qualityPreset();

  // ── Terreno ──
  const { hf, path, pathMask } = buildHeightfield(spec, rng);
  const world = new CollisionWorld(hf);
  const { mesh: terrainMesh, mat: terrainMat } = buildTerrainMesh(hf, spec, pathMask);
  group.add(terrainMesh);
  materials.push(terrainMat);
  disposables.push(terrainMesh.geometry);

  // ── Líquido ──
  let liquidMesh: THREE.Mesh | null = null;
  if (spec.liquid.kind !== 'none' && spec.liquid.kind !== 'void') {
    const emissive = spec.liquid.kind === 'lava' ? 0.9 : spec.liquid.kind === 'acid' || spec.liquid.kind === 'slime' ? 0.55 : 0.12;
    const opacity = spec.liquid.kind === 'water' ? 0.72 : 0.9;
    // Veta superficial: espuma blanca en agua, costra oscura en lava, película
    // turbia en ácido y limo.
    const foamColor =
      spec.liquid.kind === 'lava'
        ? 0x2a0e08
        : spec.liquid.kind === 'acid' || spec.liquid.kind === 'slime'
          ? 0xd8ff8a
          : 0xffffff;
    const foamStrength = spec.liquid.kind === 'lava' ? 0.6 : spec.liquid.kind === 'water' ? 0.17 : 0.3;
    const lmat = createLiquidMaterial(
      spec.palette.liquid,
      emissive,
      opacity,
      spec.liquid.kind === 'water',
      foamColor,
      foamStrength,
    );
    const geo = new THREE.PlaneGeometry(spec.size * 1.6, spec.size * 1.6, 40, 40);
    liquidMesh = new THREE.Mesh(geo, lmat);
    liquidMesh.rotation.x = -Math.PI / 2;
    liquidMesh.position.y = spec.liquid.level;
    liquidMesh.renderOrder = 5;
    group.add(liquidMesh);
    materials.push(lmat);
    disposables.push(geo);
  }

  // ── Punto de aparición del jugador ──
  const spawnY = world.terrainHeight(0, 0);
  const playerSpawn = new THREE.Vector3(0, spawnY + 0.6, 0);

  /**
   * Orientación inicial. Antes siempre miraba a +Z, lo que en la mitad de los
   * niveles significaba abrir contra un talud. Ahora se mira a lo largo del
   * camino: el primer plano enseña la ruta, las vallas y las casetas.
   */
  let spawnYaw = 0;
  {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = Math.hypot(path[i].x, path[i].z);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    // Se mira hacia el extremo del camino que quede más lejos, que es el que
    // tiene recorrido por delante
    const aheadIdx = bestI < path.length / 2 ? path.length - 1 : 0;
    const t = path[aheadIdx];
    spawnYaw = Math.atan2(t.x - playerSpawn.x, t.z - playerSpawn.z);
  }

  // ── Plataformas ──
  const movingPlatforms: MovingPlatform[] = [];
  const cameraBlockers: { x: number; z: number; r: number; top: number }[] = [];
  // Las plataformas son tarima construida, no losas lisas: tablones arriba,
  // canto oscuro y postes de apoyo colgando.
  const platMat = createCelMaterial({ color: spec.palette.cliff, bands: 3 });
  const platTopMat = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    map: plankTexture(mixHex(spec.palette.propAlt, 0x8a5a32, 0.62)),
    mapRepeat: 1,
  });
  // Las móviles llevan la misma tarima; lo que las distingue es un friso
  // luminoso en el canto, no ser una losa emisiva entera (que salía como una
  // galleta gigante flotando).
  const platMovingMat = createCelMaterial({
    color: spec.palette.propAlt,
    bands: 3,
    emissive: 0.55,
    rim: spec.palette.propAlt,
  });
  materials.push(platMat, platTopMat, platMovingMat);

  // Un par de plataformas junto al inicio dan referencia vertical inmediata
  const platformPts = scatterPoints(rng, spec.platforms.count, spec.size * 0.42, 13);
  for (let i = 0; i < 2; i++) {
    const a = rng() * Math.PI * 2;
    const r = rngRange(rng, 14, 26);
    platformPts.unshift({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  const platGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(platGeo);
  const movingCaps: THREE.Mesh[] = [];
  const movingTrims: THREE.Mesh[] = [];

  platformPts.forEach((p, idx) => {
    const isMoving = idx < spec.platforms.moving;
    const w = rngRange(rng, spec.platforms.size[0], spec.platforms.size[1]);
    const d = rngRange(rng, spec.platforms.size[0], spec.platforms.size[1]);
    const th = 0.9;
    const groundH = world.terrainHeight(p.x, p.z);
    const base = Math.max(groundH, spec.liquid.level + 0.5);
    const y = base + rngRange(rng, spec.platforms.minY, spec.platforms.maxY);

    const m = new THREE.Mesh(platGeo, platMat);
    m.scale.set(w, th, d);
    m.position.set(p.x, y, p.z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);

    // Tarima superior: marca dónde se puede aterrizar
    const cap = new THREE.Mesh(platGeo, platTopMat);
    cap.scale.set(w * 1.04, th * 0.34, d * 1.04);
    cap.position.set(p.x, y + th * 0.44, p.z);
    cap.receiveShadow = true;
    group.add(cap);

    if (isMoving) {
      // Friso luminoso alrededor del canto
      const trim = new THREE.Mesh(platGeo, platMovingMat);
      trim.scale.set(w * 1.12, th * 0.22, d * 1.12);
      trim.position.set(p.x, y - th * 0.12, p.z);
      group.add(trim);
      movingCaps.push(cap);
      movingTrims.push(trim);
    }

    // Postes de apoyo bajo las esquinas: dan lectura de estructura construida
    if (!isMoving) {
      for (const [ox, oz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const post = new THREE.Mesh(platGeo, platMat);
        post.scale.set(0.34, 1.5, 0.34);
        post.position.set(p.x + ox * (w / 2 - 0.4), y - 0.9, p.z + oz * (d / 2 - 0.4));
        post.castShadow = true;
        group.add(post);
      }
    }

    const box = world.addBox(
      new THREE.Vector3(p.x, y, p.z),
      new THREE.Vector3(w / 2, th / 2, d / 2),
      'platform',
      undefined,
      isMoving,
    );

    if (isMoving) {
      const vertical = rng() < 0.35;
      movingPlatforms.push({
        box,
        mesh: m,
        cap: movingCaps[movingCaps.length - 1],
        trim: movingTrims[movingTrims.length - 1],
        origin: new THREE.Vector3(p.x, y, p.z),
        axis: vertical ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(Math.cos(rng() * 6.28), 0, Math.sin(rng() * 6.28)),
        amplitude: vertical ? rngRange(rng, 2.5, 6) : rngRange(rng, 4, 11),
        speed: rngRange(rng, 0.35, 0.9),
        phase: rng() * Math.PI * 2,
      });
    }
  });

  // ── Torres de acceso: pequeñas escaleras de cubos hacia plataformas altas ──
  for (let i = 0; i < Math.min(8, Math.floor(spec.platforms.count / 3)); i++) {
    const g = findGround(world, rng, spec, 18);
    if (!g) continue;
    const steps = rngInt(rng, 3, 6);
    for (let s = 0; s < steps; s++) {
      const w = rngRange(rng, 2.6, 4.2);
      const y = g.y + 1.1 + s * rngRange(rng, 1.5, 2.3);
      const ox = g.x + Math.cos(i * 2.4 + s * 0.9) * s * 1.6;
      const oz = g.z + Math.sin(i * 2.4 + s * 0.9) * s * 1.6;
      const m = new THREE.Mesh(platGeo, platMat);
      m.scale.set(w, 0.8, w);
      m.position.set(ox, y, oz);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      const cap = new THREE.Mesh(platGeo, platTopMat);
      cap.scale.set(w * 1.05, 0.22, w * 1.05);
      cap.position.set(ox, y + 0.34, oz);
      cap.receiveShadow = true;
      group.add(cap);
      world.addBox(new THREE.Vector3(ox, y, oz), new THREE.Vector3(w / 2, 0.4, w / 2), 'platform');
    }
  }

  // ── Decorado instanciado ──
  //
  // El reparto es deliberadamente desigual. Los niveles de referencia no son
  // llanuras uniformemente salpicadas: son corredores densamente vestidos, con
  // vegetación y construcciones al alcance de la mano y claros abiertos más
  // allá. Repartiendo los mismos props por igual sobre una isla de 190 metros
  // salía una mata cada noventa metros cuadrados —de ahí que todo se leyera
  // como un descampado—, así que la densidad se concentra donde el jugador
  // realmente camina y las piezas de cerca crecen de tamaño.
  const grassScale = q.grassDensity;
  const CORRIDOR = 20; // metros a cada lado del camino que se consideran "cerca"
  for (const propSpec of spec.props) {
    const isGrass = propSpec.kind === 'grass';
    const count = Math.round(propSpec.count * (isGrass ? grassScale * 3.2 : 3.4));
    if (count <= 0) continue;

    const instances: PropInstance[] = [];
    const minDist = isGrass ? 1.15 : 2.0;
    const pts = scatterPoints(rng, count, spec.size * 0.47, minDist, 8);

    for (const pt of pts) {
      // Agrupar en macizos: la dispersión uniforme parece césped artificial,
      // los grupos crean claros y espesuras que dan carácter al terreno.
      const clump = fbm(pt.x * 0.03, pt.z * 0.03, spec.seed + propSpec.kind.length * 17, 2);
      if (!isGrass && clump < -0.15) continue;

      // Proximidad al camino, 1 pegado a él y 0 a partir del corredor
      const pd = distanceToPath(pt.x, pt.z, path);
      const nearPath = clamp(1 - pd / CORRIDOR, 0, 1);
      // Lejos del camino sobrevive menos de la mitad: el presupuesto de
      // triángulos se gasta donde se ve.
      if (rng() > 0.42 + nearPath * 0.58) continue;

      const h = world.terrainHeight(pt.x, pt.z);
      if (h < spec.liquid.level + 0.4 && propSpec.kind !== 'coral') continue;
      const n = world.terrainNormal(pt.x, pt.z);
      if (n.y < 0.75 && propSpec.kind !== 'rock') continue;

      // Lo cercano se agranda: en la referencia un árbol junto a la ruta mide
      // tres o cuatro veces el personaje y llena media pantalla.
      const near = (1 + Math.max(0, clump) * 0.16) * (1 + nearPath * 0.34);
      const scl = rngRange(rng, propSpec.scale[0], propSpec.scale[1]) * near;
      // Los props altos y opacos entran en la lista que consulta la cámara
      if (TALL_PROPS.has(propSpec.kind)) {
        // El radio aproxima el tronco, no la copa: con la copa entera la
        // cámara se creía tapada por árboles que en realidad pasan por encima
        // del encuadre y se pegaba al personaje en cuanto había arbolado.
        cameraBlockers.push({ x: pt.x, z: pt.z, r: 0.7 * scl, top: h + 3.4 * scl });
      }
      instances.push({
        x: pt.x,
        y: h - 0.15,
        z: pt.z,
        scale: scl,
        rotY: rng() * Math.PI * 2,
        tint: randomTint(rng),
      });
    }
    if (instances.length === 0) continue;

    const glowKind = propSpec.kind === 'crystal' || propSpec.kind === 'neonSign' || propSpec.kind === 'lantern';
    const im = createPropMesh(propSpec.kind, instances, roleColorsFor(spec), {
      emissive: glowKind ? 0.32 : propSpec.kind === 'mushroom' || propSpec.kind === 'coral' ? 0.16 : 0,
      fadeNear: isGrass ? 0 : 2.2,
      castShadow: q.shadows && !isGrass,
    });
    group.add(im);
    materials.push(im.material as THREE.Material);
    disposables.push(im.geometry);
  }

  // ── Envolvente de interior ──────────────────────────────────────────────
  // Los niveles marcados como interior estaban abiertos al cielo y se leían
  // igual que los exteriores. Se cierran con un anillo de muros de azulejo y
  // pilastras: el escenario pasa a ser una sala y no un descampado.
  if (spec.interior) {
    const wallMat = createCelMaterial({
      color: 0xffffff,
      bands: 3,
      map: tileTexture(spec.palette.cliff, mixHex(spec.palette.cliff, 0x101018, 0.5)),
      mapRepeat: 1,
    });
    const pilasterMat = createCelMaterial({ color: spec.palette.groundAlt, bands: 3 });
    materials.push(wallMat, pilasterMat);

    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    disposables.push(wallGeo);
    const ringR = spec.size * 0.44;
    const wallH = 34;
    const segments = 22;
    const baseY = spec.liquid.level - 4;

    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const nx = Math.cos(a) * ringR;
      const nz = Math.sin(a) * ringR;
      const segW = (Math.PI * 2 * ringR) / segments + 2.5;

      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.scale.set(segW, wallH, 3);
      wall.position.set(nx, baseY + wallH / 2, nz);
      wall.rotation.y = -a + Math.PI / 2;
      wall.receiveShadow = true;
      wall.castShadow = false;
      group.add(wall);
      // La textura se repite según el tamaño real del segmento
      world.addBox(
        new THREE.Vector3(nx, baseY + wallH / 2, nz),
        new THREE.Vector3(segW * 0.5, wallH * 0.5, 2.2),
        'wall',
      );

      // Pilastra cada dos segmentos
      if (i % 2 === 0) {
        const pil = new THREE.Mesh(wallGeo, pilasterMat);
        pil.scale.set(2.6, wallH, 2.6);
        pil.position.set(nx * 0.985, baseY + wallH / 2, nz * 0.985);
        pil.rotation.y = -a;
        pil.castShadow = q.shadows;
        group.add(pil);
      }
    }

    // Techo plano y oscuro que cierra la sala por arriba
    const ceilMat = createCelMaterial({ color: mixHex(spec.palette.cliff, 0x080810, 0.55), bands: 2 });
    materials.push(ceilMat);
    const ceilGeo = new THREE.CylinderGeometry(ringR + 3, ringR + 3, 1.5, segments);
    disposables.push(ceilGeo);
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.position.set(0, baseY + wallH - 1, 0);
    group.add(ceiling);
  }

  // ── Mobiliario de escenario ─────────────────────────────────────────────
  // Se coloca siguiendo el camino, no al azar: vallas que lo bordean, farolas
  // a intervalos, escaleras donde la cuesta es fuerte y casetas junto a la
  // ruta. Es lo que convierte un terreno generado en un lugar habitado.
  {
    const roles = roleColorsFor(spec);
    const fences: PropInstance[] = [];
    const lamps: PropInstance[] = [];
    const stairs: PropInstance[] = [];
    const huts: PropInstance[] = [];
    const signs: PropInstance[] = [];
    const barrels: PropInstance[] = [];
    const arches: PropInstance[] = [];

    /**
     * Perfil de mobiliario por mundo. Una valla blanca de jardín y una caseta
     * con tejado quedaban fuera de lugar en la fortaleza de Deedee o en el
     * reino alterado, así que los mundos tecnológicos y alienígenas reciben
     * arcos y farolas en vez de mobiliario doméstico.
     */
    const rustic = spec.worldId <= 5;
    const urban = spec.worldId === 6;
    const alien = spec.worldId >= 7;
    const interior = !!spec.interior;
    let sinceLamp = 0;

    for (let i = 2; i < path.length - 2; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.01) continue;
      const dirX = dx / segLen;
      const dirZ = dz / segLen;
      const angle = Math.atan2(dirX, dirZ);
      const groundH = world.terrainHeight(a.x, a.z);
      if (groundH < spec.liquid.level + 0.6) continue;

      // Pendiente del tramo: si es fuerte, escalera de troncos
      const nextH = world.terrainHeight(b.x, b.z);
      const slope = Math.abs(nextH - groundH) / segLen;
      if (slope > 0.34 && stairs.length < 5 && i % 3 === 0) {
        const lowFirst = nextH > groundH;
        stairs.push({
          x: (a.x + b.x) / 2,
          y: Math.min(groundH, nextH) - 0.2,
          z: (a.z + b.z) / 2,
          scale: 1,
          rotY: angle + (lowFirst ? Math.PI : 0),
          tint: 1,
        });
        continue;
      }

      // Vallas a ambos lados, con huecos para poder salir del camino
      if (i % 2 === 0 && rng() < 0.62 && !interior && !alien) {
        for (const side of [-1, 1]) {
          if (rng() < 0.22) continue; // hueco
          const ox = -dirZ * side * 5.6;
          const oz = dirX * side * 5.6;
          const fx = a.x + ox;
          const fz = a.z + oz;
          const fh = world.terrainHeight(fx, fz);
          if (fh < spec.liquid.level + 0.4) continue;
          fences.push({ x: fx, y: fh - 0.1, z: fz, scale: rngRange(rng, 0.95, 1.1), rotY: angle, tint: randomTint(rng) });
        }
      }

      sinceLamp++;
      if (sinceLamp >= (alien ? 5 : 7)) {
        sinceLamp = 0;
        const side = rng() < 0.5 ? -1 : 1;
        const lx = a.x - dirZ * side * 4.6;
        const lz = a.z + dirX * side * 4.6;
        const lh = world.terrainHeight(lx, lz);
        if (lh > spec.liquid.level + 0.4) {
          lamps.push({ x: lx, y: lh - 0.1, z: lz, scale: rngRange(rng, 0.95, 1.15), rotY: rng() * 6.28, tint: 1 });
        }
      }
    }

    // Casetas y carteles junto al camino, sobre terreno llano
    for (let k = 0; k < 5; k++) {
      const i = 3 + Math.floor(rng() * Math.max(1, path.length - 6));
      const node = path[i];
      const side = rng() < 0.5 ? -1 : 1;
      const off = rngRange(rng, 9, 15);
      const hx = node.x + side * off;
      const hz = node.z + rngRange(rng, -6, 6);
      const hh = world.terrainHeight(hx, hz);
      if (hh < spec.liquid.level + 1.2) continue;
      const n = world.terrainNormal(hx, hz);
      if (n.y < 0.9) continue;
      const facing = Math.atan2(node.x - hx, node.z - hz);
      if (alien) {
        // Arcos monumentales: marcan accesos sin sugerir vida doméstica
        arches.push({ x: hx, y: hh - 0.15, z: hz, scale: rngRange(rng, 1, 1.4), rotY: facing, tint: randomTint(rng) });
        continue;
      }
      if (k < (urban ? 2 : 3)) {
        const hutScale = rngRange(rng, 0.85, 1.15);
        huts.push({ x: hx, y: hh - 0.15, z: hz, scale: hutScale, rotY: facing, tint: randomTint(rng) });
        cameraBlockers.push({ x: hx, z: hz, r: 2.2 * hutScale, top: hh + 2.8 * hutScale });
        // Un par de barriles junto a cada caseta
        for (let b = 0; b < 2; b++) {
          barrels.push({
            x: hx + rngRange(rng, -2.6, 2.6),
            y: hh - 0.1,
            z: hz + rngRange(rng, -2.6, 2.6),
            scale: rngRange(rng, 0.8, 1.05),
            rotY: rng() * 6.28,
            tint: randomTint(rng),
          });
        }
      } else {
        signs.push({ x: hx, y: hh - 0.1, z: hz, scale: 1, rotY: facing, tint: 1 });
      }
    }

    const furniture: [string, PropInstance[], number][] = [
      ['fence', fences, 0],
      ['logStair', rustic || urban ? stairs : [], 0],
      ['hut', huts, 0],
      ['signpost', signs, 0],
      ['barrel', rustic ? barrels : [], 0],
      ['archway', arches, 0.5],
      ['lampPost', lamps, 0.7],
    ];
    for (const [kind, list, emissive] of furniture) {
      if (list.length === 0) continue;
      const im = createPropMesh(kind as never, list, roles, {
        emissive,
        fadeNear: 2.2,
        castShadow: q.shadows,
      });
      group.add(im);
      materials.push(im.material as THREE.Material);
      disposables.push(im.geometry);
    }

    /**
     * Orillas del camino.
     *
     * En los fotogramas del original la senda de tierra nunca linda a hueso
     * con el prado: hay una franja tupida de matas y hierba alta que remata el
     * borde y separa los dos colores. Es un detalle pequeño que hace muchísimo,
     * porque convierte una mancha de textura en un camino de verdad.
     */
    const vergeKinds = spec.props
      .map((p) => p.kind)
      .filter((k) => k === 'bush' || k === 'fern' || k === 'grass');
    if (vergeKinds.length > 0 && !interior) {
      const verges = new Map<string, PropInstance[]>();
      for (let i = 1; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.01) continue;
        const dirX = dx / len;
        const dirZ = dz / len;
        // Varias matas por tramo y a los dos lados, con la separación variada
        for (let s = 0; s < 7; s++) {
          const t = rng();
          const side = rng() < 0.5 ? -1 : 1;
          const off = rngRange(rng, 4.6, 8.2);
          const vx = a.x + dirX * len * t - dirZ * side * off;
          const vz = a.z + dirZ * len * t + dirX * side * off;
          const vh = world.terrainHeight(vx, vz);
          if (vh < spec.liquid.level + 0.5) continue;
          if (world.terrainNormal(vx, vz).y < 0.72) continue;
          const kind = rngPick(rng, vergeKinds);
          const list = verges.get(kind) ?? [];
          list.push({
            x: vx,
            y: vh - 0.12,
            z: vz,
            scale: rngRange(rng, 0.85, 1.5),
            rotY: rng() * Math.PI * 2,
            tint: randomTint(rng),
          });
          verges.set(kind, list);
        }
      }
      for (const [kind, list] of verges) {
        if (list.length === 0) continue;
        const im = createPropMesh(kind as never, list, roles, { fadeNear: 0, castShadow: false });
        group.add(im);
        materials.push(im.material as THREE.Material);
        disposables.push(im.geometry);
      }
    }
  }

  // ── Obstáculos que requieren artefactos ──
  const obstacles: GateObstacle[] = [];
  const obstacleMats: Record<string, THREE.Material> = {
    punchWall: createCelMaterial({ color: 0xb8e8ff, colorAlt: 0x7ac0e0, bands: 3, opacity: 0.85, transparent: true, rim: 0xffffff }),
    dashGate: createCelMaterial({ color: 0x9fff40, bands: 3, emissive: 0.4, opacity: 0.55, transparent: true }),
    hoopGap: createCelMaterial({ color: 0xc080ff, bands: 3, emissive: 0.5, opacity: 0.5, transparent: true }),
    clubCrate: createCelMaterial({ color: 0xb8834a, colorAlt: 0x8a5f34, bands: 3 }),
    waterZone: createCelMaterial({ color: 0x2ad0ff, bands: 3, emissive: 0.4, opacity: 0.4, transparent: true }),
  };
  materials.push(...Object.values(obstacleMats));

  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const torusGeo = new THREE.TorusGeometry(1, 0.14, 6, 14);
  disposables.push(crateGeo, torusGeo);

  for (const gate of spec.gadgetGates) {
    for (let i = 0; i < gate.count; i++) {
      const g = findGround(world, rng, spec, 12);
      if (!g) continue;
      const mat = obstacleMats[gate.kind];
      let mesh: THREE.Object3D;
      let box: BoxCollider | null = null;

      if (gate.kind === 'clubCrate') {
        const s = rngRange(rng, 1.3, 1.9);
        const m = new THREE.Mesh(crateGeo, mat);
        m.scale.setScalar(s);
        m.position.set(g.x, g.y + s / 2, g.z);
        m.castShadow = q.shadows;
        // Listones de la caja
        for (let k = 0; k < 2; k++) {
          const slat = new THREE.Mesh(crateGeo, obstacleMats.dashGate);
          slat.scale.set(1.03, 0.12, 1.03);
          slat.position.y = -0.28 + k * 0.56;
          m.add(slat);
        }
        group.add(m);
        box = world.addBox(m.position.clone(), new THREE.Vector3(s / 2, s / 2, s / 2), 'crate');
        mesh = m;
      } else if (gate.kind === 'punchWall') {
        const w = rngRange(rng, 4, 7);
        const h = rngRange(rng, 3.5, 5.5);
        const m = new THREE.Mesh(crateGeo, mat);
        m.scale.set(w, h, 1.1);
        m.rotation.y = rng() * Math.PI;
        m.position.set(g.x, g.y + h / 2, g.z);
        m.castShadow = q.shadows;
        group.add(m);
        box = world.addBox(m.position.clone(), new THREE.Vector3(w / 2, h / 2, 0.8), 'gate');
        mesh = m;
      } else if (gate.kind === 'dashGate') {
        // Pasillo estrecho de anillos que solo se cruza con impulso
        const m = new THREE.Group();
        for (let k = 0; k < 3; k++) {
          const ring = new THREE.Mesh(torusGeo, mat);
          ring.scale.setScalar(1.7);
          ring.position.set(0, 1.9, k * 3.4);
          m.add(ring);
        }
        m.position.copy(g);
        m.rotation.y = rng() * Math.PI * 2;
        group.add(m);
        mesh = m;
      } else if (gate.kind === 'hoopGap') {
        const m = new THREE.Group();
        const ring = new THREE.Mesh(torusGeo, mat);
        ring.scale.setScalar(2.4);
        ring.rotation.x = Math.PI / 2;
        m.add(ring);
        m.position.set(g.x, g.y + rngRange(rng, 7, 15), g.z);
        group.add(m);
        mesh = m;
      } else {
        // waterZone: burbuja marcada bajo el líquido con tesoro
        const m = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mat);
        const angle = rng() * Math.PI * 2;
        const r = spec.size * 0.42;
        m.position.set(Math.cos(angle) * r, spec.liquid.level - 2.4, Math.sin(angle) * r);
        group.add(m);
        disposables.push(m.geometry);
        mesh = m;
      }

      obstacles.push({
        kind: gate.kind,
        box,
        mesh,
        position: mesh.position.clone(),
        broken: false,
        requires: GATE_REQUIRES[gate.kind],
        reward: gate.kind === 'clubCrate' ? (rng() < 0.5 ? 'cookie' : 'none') : 'coin',
      });
    }
  }

  // ── Apariciones de mascotas con rutas de patrulla ──
  const petSpawns: { color: PetColor; pos: THREE.Vector3; patrol: THREE.Vector3[] }[] = [];
  let placed = 0;
  for (const petGroup of spec.pets) {
    for (let i = 0; i < petGroup.count; i++) {
      // Las primeras mascotas se colocan cerca del punto de partida: sin esto,
      // en los mapas grandes el jugador aparece en un descampado sin nada que
      // cazar y el nivel arranca en vacío.
      const near = placed < 3;
      const g = findGround(world, rng, spec, near ? 12 : 16, near ? 90 : 60, near ? 42 : Infinity);
      if (!g) continue;
      placed++;
      const patrol: THREE.Vector3[] = [];
      const nodes = rngInt(rng, 3, 5);
      const radius = rngRange(rng, 8, 20);
      for (let k = 0; k < nodes; k++) {
        const a = (k / nodes) * Math.PI * 2 + rng() * 0.8;
        const px = g.x + Math.cos(a) * radius;
        const pz = g.z + Math.sin(a) * radius;
        const ph = world.terrainHeight(px, pz);
        patrol.push(new THREE.Vector3(px, Math.max(ph, spec.liquid.level + 0.5), pz));
      }
      petSpawns.push({ color: petGroup.color, pos: g.clone().setY(g.y + 0.2), patrol });
    }
  }

  // ── Coleccionables ──
  const coinSpawns: THREE.Vector3[] = [];
  for (let i = 0; i < spec.coins; i++) {
    // Las monedas se esconden alto o lejos: recompensan la exploración
    const usePlatform = platformPts.length > 0 && i % 2 === 0;
    if (usePlatform) {
      const p = rngPick(rng, platformPts);
      const groundH = world.terrainHeight(p.x, p.z);
      coinSpawns.push(new THREE.Vector3(p.x, Math.max(groundH, spec.liquid.level) + rngRange(rng, 8, 16), p.z));
    } else {
      const g = findGround(world, rng, spec, spec.size * 0.3);
      if (g) coinSpawns.push(g.clone().setY(g.y + 1.4));
    }
  }

  const cookieSpawns: THREE.Vector3[] = [];
  for (let i = 0; i < spec.cookies; i++) {
    const g = findGround(world, rng, spec, i === 0 ? 8 : 12, 40, i === 0 ? 38 : Infinity);
    if (g) cookieSpawns.push(g.clone().setY(g.y + 0.9));
  }

  const checkpoints: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const g = findGround(world, rng, spec, 25 + i * 15);
    if (g) checkpoints.push(g.clone().setY(g.y + 0.2));
  }

  // ── Puerta temporal ──
  let gatePos = findGround(world, rng, spec, spec.size * 0.28);
  if (!gatePos) gatePos = new THREE.Vector3(0, world.terrainHeight(0, 0), 0);

  // ── Arena del jefe ──
  let bossArena: THREE.Vector3 | null = null;
  if (spec.boss) {
    const arenaR = spec.boss === 'deedee' ? 26 : 20;
    const a = rng() * Math.PI * 2;
    const dist = spec.size * 0.3;
    const ax = Math.cos(a) * dist;
    const az = Math.sin(a) * dist;
    const ay = Math.max(world.terrainHeight(ax, az), spec.liquid.level + 1) + 0.4;
    bossArena = new THREE.Vector3(ax, ay, az);

    // Plataforma circular de combate
    const arenaMat = createCelMaterial({
      color: spec.palette.propAlt,
      colorAlt: spec.palette.cliff,
      bands: 3,
      emissive: 0.15,
    });
    materials.push(arenaMat);
    const arenaGeo = new THREE.CylinderGeometry(arenaR, arenaR * 1.05, 1.6, 26);
    const arenaMesh = new THREE.Mesh(arenaGeo, arenaMat);
    arenaMesh.position.set(ax, ay - 0.4, az);
    arenaMesh.receiveShadow = q.shadows;
    group.add(arenaMesh);
    disposables.push(arenaGeo);
    world.addBox(new THREE.Vector3(ax, ay - 0.4, az), new THREE.Vector3(arenaR * 0.72, 0.8, arenaR * 0.72), 'platform');

    // Anillo de columnas
    const ringGeo = new THREE.CylinderGeometry(0.8, 1.1, 6, 8);
    disposables.push(ringGeo);
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const px = ax + Math.cos(ang) * (arenaR * 0.85);
      const pz = az + Math.sin(ang) * (arenaR * 0.85);
      const col = new THREE.Mesh(ringGeo, arenaMat);
      col.position.set(px, ay + 2.6, pz);
      col.castShadow = q.shadows;
      group.add(col);
      world.addBox(new THREE.Vector3(px, ay + 2.6, pz), new THREE.Vector3(1, 3, 1), 'wall');
    }
  }

  world.rebuildIndex();

  const dispose = () => {
    for (const d of disposables) d.dispose();
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    for (const m of materials) m.dispose();
  };

  return {
    spec,
    group,
    world,
    playerSpawn,
    spawnYaw,
    petSpawns,
    coinSpawns,
    cookieSpawns,
    checkpoints,
    gatePosition: gatePos,
    bossArena,
    movingPlatforms,
    obstacles,
    cameraBlockers,
    materials,
    liquidMesh,
    dispose,
  };
}

/** Traduce la paleta del mundo a los colores por rol que usa el decorado. */
function roleColorsFor(spec: LevelSpec): RoleColors {
  const p = spec.palette;
  return {
    trunk: mixHex(p.cliff, 0x7a5334, 0.55),
    foliage: p.prop,
    foliageDark: mixHex(p.prop, 0x0a1408, 0.32),
    stone: p.cliff,
    stoneDark: mixHex(p.cliff, 0x0a0a12, 0.4),
    accent: p.propAlt,
    glow: p.propAlt,
    bone: 0xe8e0cc,
    // Madera pintada del mobiliario: clara y algo teñida por la paleta
    painted: mixHex(0xf2ece0, p.ground, 0.18),
    roof: mixHex(p.propAlt, 0xb04a3a, 0.45),
  };
}

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Actualiza las plataformas móviles y su delta para arrastrar a los actores. */
export function updateMovingPlatforms(level: GeneratedLevel, time: number): void {
  for (const mp of level.movingPlatforms) {
    const offset = Math.sin(time * mp.speed + mp.phase) * mp.amplitude;
    const nx = mp.origin.x + mp.axis.x * offset;
    const ny = mp.origin.y + mp.axis.y * offset;
    const nz = mp.origin.z + mp.axis.z * offset;
    mp.box.delta.set(nx - mp.box.center.x, ny - mp.box.center.y, nz - mp.box.center.z);
    mp.box.center.set(nx, ny, nz);
    mp.mesh.position.set(nx, ny, nz);
    if (mp.cap) mp.cap.position.set(nx, ny + 0.38, nz);
    if (mp.trim) mp.trim.position.set(nx, ny - 0.11, nz);
  }
}
