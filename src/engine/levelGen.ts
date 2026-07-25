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
import type { LevelSpec, PetColor, PropKind } from '../content/worlds';
import { createCelMaterial, createLiquidMaterial, createTerrainMaterial } from './celMaterial';
import { createPropMesh, randomTint, type PropInstance } from './props';
import { CollisionWorld, type BoxCollider, type Heightfield } from './physics';
import { fbm, makeRng, rngInt, rngPick, rngRange, scatterPoints, type Rng } from './mathx';
import { qualityPreset } from '../core/settings';

export type MovingPlatform = {
  box: BoxCollider;
  mesh: THREE.Object3D;
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
  materials: THREE.ShaderMaterial[];
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
  const half = size / 2;

  for (let z = 0; z < res; z++) {
    for (let x = 0; x < res; x++) {
      const wx = (x / (res - 1)) * size - half;
      const wz = (z / (res - 1)) * size - half;
      let h = fbm(wx * frequency, wz * frequency, spec.seed, octaves, ridged);

      // Aplanado central: garantiza zonas jugables amplias
      h = Math.sign(h) * Math.pow(Math.abs(h), 1 + plateau);
      h *= amplitude;

      // Caída en isla: los bordes se hunden bajo el líquido, cerrando el nivel
      const d = Math.max(Math.abs(wx), Math.abs(wz)) / half;
      const falloff = 1 - Math.pow(Math.max(0, (d - islandFalloff) / (1 - islandFalloff)), 1.6);
      h = h * Math.max(0, falloff) - (1 - Math.max(0, falloff)) * amplitude * 2.2;

      // Meseta de salida en el centro, siempre por encima del líquido
      const cd = Math.hypot(wx, wz);
      if (cd < 14) {
        const plat = Math.max(1.2, spec.liquid.level + 2.6);
        h = h * (cd / 14) * 0.4 + plat * (1 - cd / 14);
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
  if (total > 0 && dry / total < 0.4) {
    // Percentil 60 de la zona interior: el desnivel necesario para dejarlo seco
    heights.sort((a, b) => a - b);
    const target = heights[Math.floor(heights.length * 0.4)];
    const lift = dryLine - target;
    if (lift > 0) {
      for (let i = 0; i < data.length; i++) data[i] += lift;
    }
  }

  return { size, res, cell: size / (res - 1), data, liquidLevel: spec.liquid.level };
}

function buildTerrainMesh(hf: Heightfield, spec: LevelSpec): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
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

  const snowLine = spec.worldId === 4 ? 4 : 9999;
  const mat = createTerrainMaterial({
    ground: spec.palette.ground,
    groundAlt: spec.palette.groundAlt,
    cliff: spec.palette.cliff,
    bands: 4,
    snowLine,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return { mesh, mat };
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
  const materials: THREE.ShaderMaterial[] = [];
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
  const platMat = createCelMaterial({
    color: spec.palette.prop,
    colorAlt: spec.palette.propAlt,
    bands: 3,
    blendScale: 0.4,
  });
  const platMovingMat = createCelMaterial({
    color: spec.palette.propAlt,
    colorAlt: spec.palette.prop,
    bands: 3,
    emissive: 0.22,
    rim: 0xffffff,
  });
  materials.push(platMat, platMovingMat);

  // Un par de plataformas junto al inicio dan referencia vertical inmediata
  const platformPts = scatterPoints(rng, spec.platforms.count, spec.size * 0.42, 13);
  for (let i = 0; i < 2; i++) {
    const a = rng() * Math.PI * 2;
    const r = rngRange(rng, 14, 26);
    platformPts.unshift({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  const platGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(platGeo);

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
    m.castShadow = q.shadows;
    m.receiveShadow = q.shadows;
    group.add(m);

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
      m.castShadow = q.shadows;
      m.receiveShadow = q.shadows;
      group.add(m);
      world.addBox(new THREE.Vector3(ox, y, oz), new THREE.Vector3(w / 2, 0.4, w / 2), 'platform');
    }
  }

  // ── Decorado instanciado ──
  const grassScale = q.grassDensity;
  for (const propSpec of spec.props) {
    const count = Math.round(propSpec.count * (propSpec.kind === 'grass' ? grassScale : 1));
    if (count <= 0) continue;
    const instances: PropInstance[] = [];
    const pts = scatterPoints(rng, count, spec.size * 0.47, propSpec.kind === 'grass' ? 1.6 : 3.2, 8);
    for (const p of pts) {
      const h = world.terrainHeight(p.x, p.z);
      if (h < spec.liquid.level + 0.4 && propSpec.kind !== 'coral') continue;
      const n = world.terrainNormal(p.x, p.z);
      if (n.y < 0.75 && propSpec.kind !== 'rock') continue;
      instances.push({
        x: p.x,
        y: h - 0.15,
        z: p.z,
        scale: rngRange(rng, propSpec.scale[0], propSpec.scale[1]),
        rotY: rng() * Math.PI * 2,
        tint: randomTint(rng),
      });
    }
    if (instances.length === 0) continue;
    const color = propColorFor(propSpec.kind, spec);
    const im = createPropMesh(propSpec.kind, instances, color.main, color.alt, color.blend);
    im.castShadow = q.shadows && propSpec.kind !== 'grass';
    group.add(im);
    materials.push(im.material as THREE.ShaderMaterial);
    disposables.push(im.geometry);
  }

  // ── Obstáculos que requieren artefactos ──
  const obstacles: GateObstacle[] = [];
  const obstacleMats: Record<string, THREE.ShaderMaterial> = {
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

/**
 * Color de cada tipo de prop. `blend` mezcla por altura local: con él, los
 * árboles tienen el tronco de un color y la copa de otro pese a compartir
 * una sola malla instanciada.
 */
function propColorFor(kind: PropKind, spec: LevelSpec): { main: number; alt: number; blend: number } {
  const p = spec.palette;
  switch (kind) {
    case 'palm':
    case 'pine':
      return { main: p.prop, alt: 0x7a5334, blend: 0.5 };
    case 'deadTree':
      return { main: 0x6b4a30, alt: 0x4a3320, blend: 0.3 };
    case 'rock':
    case 'monolith':
    case 'pillar':
      return { main: p.cliff, alt: p.groundAlt, blend: 0 };
    case 'crystal':
      return { main: p.propAlt, alt: p.prop, blend: 0.35 };
    case 'neonSign':
      return { main: p.propAlt, alt: 0x3a3a4a, blend: 0.45 };
    case 'lantern':
      return { main: p.propAlt, alt: p.prop, blend: 0.4 };
    case 'bone':
      return { main: 0xe8e0cc, alt: 0xc0b8a0, blend: 0 };
    case 'iceSpike':
      return { main: 0xd8f0ff, alt: 0x9fd0e8, blend: 0.3 };
    case 'coral':
      return { main: p.prop, alt: p.propAlt, blend: 0.5 };
    case 'grass':
      return { main: p.prop, alt: p.ground, blend: 0 };
    default:
      return { main: p.prop, alt: p.propAlt, blend: 0 };
  }
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
  }
}
