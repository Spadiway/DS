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
import { CollisionWorld, type BoxCollider, type Heightfield } from './physics';
import { clamp, fbm, makeRng, rngInt, rngPick, rngRange, scatterPoints, terrace, type Rng } from './mathx';
import { qualityPreset } from '../core/settings';

export type MovingPlatform = {
  box: BoxCollider;
  mesh: THREE.Object3D;
  cap?: THREE.Object3D;
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
  petSpawns: { color: PetColor; pos: THREE.Vector3; patrol: THREE.Vector3[] }[];
  coinSpawns: THREE.Vector3[];
  cookieSpawns: THREE.Vector3[];
  checkpoints: THREE.Vector3[];
  gatePosition: THREE.Vector3;
  bossArena: THREE.Vector3 | null;
  movingPlatforms: MovingPlatform[];
  obstacles: GateObstacle[];
  materials: THREE.Material[];
  liquidMesh: THREE.Mesh | null;
  dispose: () => void;
};

const GATE_REQUIRES: Record<GateObstacle['kind'], string> = {
  punchWall: 'magicPunch',
  dashGate: 'dashHoop',
  hoopGap: 'superHoop',
  clubCrate: 'stunClub',
  waterZone: 'waterNet',
};

function buildHeightfield(spec: LevelSpec): Heightfield {
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

      // Meseta de salida en el centro, siempre por encima del líquido
      const cd = Math.hypot(wx, wz);
      if (cd < 9) {
        const plat = Math.max(1.2, spec.liquid.level + 2.6);
        const k = cd / 9;
        h = h * (0.35 + k * 0.65) + plat * (1 - k) * 0.9;
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

  return { size, res, cell: size / (res - 1), data, liquidLevel: spec.liquid.level };
}

function buildTerrainMesh(hf: Heightfield, spec: LevelSpec): { mesh: THREE.Mesh; mat: THREE.Material } {
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
  const snowLine = spec.worldId === 4 ? 3.5 : Infinity;

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();

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

    // Variación fina de luminosidad: rompe las bandas planas
    tmp.setScalar(0.82 + fine * 0.36);
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
  const hf = buildHeightfield(spec);
  const world = new CollisionWorld(hf);
  const { mesh: terrainMesh, mat: terrainMat } = buildTerrainMesh(hf, spec);
  group.add(terrainMesh);
  materials.push(terrainMat);
  disposables.push(terrainMesh.geometry);

  // ── Líquido ──
  let liquidMesh: THREE.Mesh | null = null;
  if (spec.liquid.kind !== 'none' && spec.liquid.kind !== 'void') {
    const emissive = spec.liquid.kind === 'lava' ? 0.9 : spec.liquid.kind === 'acid' || spec.liquid.kind === 'slime' ? 0.55 : 0.12;
    const opacity = spec.liquid.kind === 'water' ? 0.72 : 0.9;
    const lmat = createLiquidMaterial(spec.palette.liquid, emissive, opacity);
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

  // ── Plataformas ──
  const movingPlatforms: MovingPlatform[] = [];
  const platMat = createCelMaterial({ color: spec.palette.prop, bands: 3 });
  const platTopMat = createCelMaterial({ color: spec.palette.propAlt, bands: 3 });
  const platMovingMat = createCelMaterial({
    color: spec.palette.propAlt,
    bands: 3,
    emissive: 0.5,
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

  platformPts.forEach((p, idx) => {
    const isMoving = idx < spec.platforms.moving;
    const w = rngRange(rng, spec.platforms.size[0], spec.platforms.size[1]);
    const d = rngRange(rng, spec.platforms.size[0], spec.platforms.size[1]);
    const th = 0.9;
    const groundH = world.terrainHeight(p.x, p.z);
    const base = Math.max(groundH, spec.liquid.level + 0.5);
    const y = base + rngRange(rng, spec.platforms.minY, spec.platforms.maxY);

    const m = new THREE.Mesh(platGeo, isMoving ? platMovingMat : platMat);
    m.scale.set(w, th, d);
    m.position.set(p.x, y, p.z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);

    // Franja superior de otro tono: marca dónde se puede aterrizar
    const cap = new THREE.Mesh(platGeo, isMoving ? platMovingMat : platTopMat);
    cap.scale.set(w * 1.04, th * 0.28, d * 1.04);
    cap.position.set(p.x, y + th * 0.42, p.z);
    cap.receiveShadow = true;
    group.add(cap);
    if (isMoving) movingCaps.push(cap);

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
  const grassScale = q.grassDensity;
  for (const propSpec of spec.props) {
    const isGrass = propSpec.kind === 'grass';
    // Bastante más denso que antes: el mundo se veía desierto
    const count = Math.round(propSpec.count * (isGrass ? grassScale * 2.4 : 2.2));
    if (count <= 0) continue;

    const instances: PropInstance[] = [];
    const minDist = isGrass ? 1.3 : 2.4;
    const pts = scatterPoints(rng, count, spec.size * 0.47, minDist, 8);

    for (const pt of pts) {
      // Agrupar en macizos: la dispersión uniforme parece césped artificial,
      // los grupos crean claros y espesuras que dan carácter al terreno.
      const clump = fbm(pt.x * 0.03, pt.z * 0.03, spec.seed + propSpec.kind.length * 17, 2);
      if (!isGrass && clump < -0.15) continue;

      const h = world.terrainHeight(pt.x, pt.z);
      if (h < spec.liquid.level + 0.4 && propSpec.kind !== 'coral') continue;
      const n = world.terrainNormal(pt.x, pt.z);
      if (n.y < 0.75 && propSpec.kind !== 'rock') continue;

      const near = 1 + Math.max(0, clump) * 0.16;
      instances.push({
        x: pt.x,
        y: h - 0.15,
        z: pt.z,
        scale: rngRange(rng, propSpec.scale[0], propSpec.scale[1]) * near,
        rotY: rng() * Math.PI * 2,
        tint: randomTint(rng),
      });
    }
    if (instances.length === 0) continue;

    const glowKind = propSpec.kind === 'crystal' || propSpec.kind === 'neonSign' || propSpec.kind === 'lantern';
    const im = createPropMesh(propSpec.kind, instances, roleColorsFor(spec), {
      emissive: glowKind ? 0.32 : propSpec.kind === 'mushroom' || propSpec.kind === 'coral' ? 0.16 : 0,
      fadeNear: isGrass ? 0 : 4.2,
      castShadow: q.shadows && !isGrass,
    });
    group.add(im);
    materials.push(im.material as THREE.Material);
    disposables.push(im.geometry);
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
    petSpawns,
    coinSpawns,
    cookieSpawns,
    checkpoints,
    gatePosition: gatePos,
    bossArena,
    movingPlatforms,
    obstacles,
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
  }
}
