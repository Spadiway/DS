/**
 * Modelos de personajes construidos por procedimiento con primitivas de bajo
 * polígono, en la línea de los personajes de plataformas de consola portátil:
 * cabezas grandes, ojos enormes, cuerpos redondeados y silueta muy legible.
 *
 * Cada modelo devuelve un "rig" con grupos nombrados que engine/anim.ts anima.
 */
import * as THREE from 'three';
import { createCelMaterial, createOutlineMaterial } from './celMaterial';

export type CritterRig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  tail: THREE.Group;
  earL: THREE.Group;
  earR: THREE.Group;
  hand: THREE.Group;
  extras: Record<string, THREE.Object3D>;
  materials: THREE.Material[];
  height: number;
  radius: number;
};

function g(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  parent.add(grp);
  return grp;
}

function mesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
  rot: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

/** Añade un casco invertido para el contorno de dibujo animado. */
function outline(target: THREE.Mesh, thickness = 0.03): void {
  const o = new THREE.Mesh(target.geometry, createOutlineMaterial(thickness));
  o.position.copy(target.position);
  o.rotation.copy(target.rotation);
  o.scale.copy(target.scale);
  o.renderOrder = -1;
  target.parent?.add(o);
}

// Geometrías compartidas (se reutilizan entre todas las instancias)
const GEO = {
  sphere: new THREE.SphereGeometry(1, 14, 10),
  sphereLow: new THREE.SphereGeometry(1, 10, 7),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 16),
  plane: new THREE.PlaneGeometry(1, 1),
};

export type CatOptions = {
  fur: number;
  furAlt: number;
  eye: number;
  belly: number;
  fat: number;
  scale: number;
  eyeSize: number;
  withOutline: boolean;
  stripes: boolean;
};

/** Constructor genérico de felino: sirve para Benito (gordo) y Silva (esbelta). */
export function buildCat(opts: CatOptions): CritterRig {
  const mats: THREE.Material[] = [];
  const fur = createCelMaterial({ color: opts.fur, colorAlt: opts.furAlt, bands: 3, rimPower: 2.4 });
  const belly = createCelMaterial({ color: opts.belly, bands: 3 });
  const dark = createCelMaterial({ color: 0x2a2530, bands: 2 });
  const eyeWhite = createCelMaterial({ color: 0xfdfdff, bands: 2, emissive: 0.05 });
  const iris = createCelMaterial({ color: opts.eye, bands: 2, emissive: 0.55, rim: opts.eye });
  const nose = createCelMaterial({ color: 0xff9aa8, bands: 2 });
  mats.push(fur, belly, dark, eyeWhite, iris, nose);

  const root = new THREE.Group();
  const s = opts.scale;
  const fat = opts.fat;

  const body = g(root, 0, 0.62 * s, 0);
  const torso = mesh(body, GEO.sphere, fur, [0, 0, 0], [0.5 * s * fat, 0.44 * s, 0.46 * s * fat]);
  if (opts.withOutline) outline(torso, 0.028);
  mesh(body, GEO.sphere, belly, [0, -0.07 * s, 0.14 * s * fat], [0.34 * s * fat, 0.3 * s, 0.34 * s]);

  // Rayas atigradas: en el lomo y en los costados, para que se lean también
  // desde el ángulo de cámara habitual (tres cuartos por detrás).
  if (opts.stripes) {
    const stripeMat = createCelMaterial({ color: opts.furAlt, colorAlt: 0x3a3a46, bands: 2 });
    mats.push(stripeMat);
    for (let i = 0; i < 4; i++) {
      mesh(
        body,
        GEO.box,
        stripeMat,
        [0, 0.18 * s - i * 0.11 * s, -0.4 * s * fat],
        [0.36 * s * fat, 0.045 * s, 0.14 * s],
        [0, 0, (i % 2 ? 1 : -1) * 0.14],
      );
    }
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        mesh(
          body,
          GEO.box,
          stripeMat,
          [sx * 0.44 * s * fat, 0.14 * s - i * 0.13 * s, -0.06 * s],
          [0.1 * s, 0.05 * s, 0.3 * s],
          [0, 0, sx * 0.2],
        );
      }
    }
  }

  const head = g(body, 0, 0.52 * s, 0.03 * s);
  const skull = mesh(head, GEO.sphere, fur, [0, 0, 0], [0.42 * s, 0.4 * s, 0.4 * s]);
  if (opts.withOutline) outline(skull, 0.026);
  // Hocico
  mesh(head, GEO.sphere, belly, [0, -0.12 * s, 0.3 * s], [0.19 * s, 0.14 * s, 0.14 * s]);
  mesh(head, GEO.cone, nose, [0, -0.06 * s, 0.4 * s], [0.05 * s, 0.05 * s, 0.05 * s], [Math.PI / 2, 0, 0]);

  // Ojos grandes y expresivos
  const es = opts.eyeSize * s;
  for (const sx of [-1, 1]) {
    const eye = g(head, sx * 0.16 * s, 0.06 * s, 0.3 * s);
    mesh(eye, GEO.sphere, eyeWhite, [0, 0, 0], [es, es * 1.1, es * 0.75]);
    mesh(eye, GEO.sphere, iris, [0, 0, es * 0.5], [es * 0.62, es * 0.72, es * 0.5]);
    mesh(eye, GEO.sphere, dark, [0, 0, es * 0.72], [es * 0.24, es * 0.42, es * 0.3]);
    mesh(eye, GEO.sphere, eyeWhite, [es * 0.22, es * 0.3, es * 0.8], [es * 0.16, es * 0.16, es * 0.12]);
  }

  // Bigotes
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      mesh(
        head,
        GEO.box,
        dark,
        [sx * 0.24 * s, -0.08 * s + i * 0.045 * s, 0.3 * s],
        [0.16 * s, 0.008 * s, 0.008 * s],
        [0, 0, sx * (0.2 - i * 0.2)],
      );
    }
  }

  if (opts.stripes) {
    const brow = createCelMaterial({ color: opts.furAlt, colorAlt: 0x3a3a46, bands: 2 });
    mats.push(brow);
    for (const sx of [-1, 0, 1]) {
      mesh(head, GEO.box, brow, [sx * 0.1 * s, 0.3 * s, 0.16 * s], [0.045 * s, 0.2 * s, 0.16 * s], [0.35, 0, sx * 0.22]);
    }
  }

  const earL = g(head, -0.24 * s, 0.3 * s, 0);
  const earR = g(head, 0.24 * s, 0.3 * s, 0);
  for (const [ear, sx] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    const e = mesh(ear, GEO.cone, fur, [0, 0.08 * s, 0], [0.14 * s, 0.24 * s, 0.1 * s], [0, 0, sx * 0.22]);
    if (opts.withOutline) outline(e, 0.022);
    mesh(ear, GEO.cone, nose, [0, 0.07 * s, 0.03 * s], [0.08 * s, 0.16 * s, 0.05 * s], [0, 0, sx * 0.22]);
  }

  // Brazos
  const armL = g(body, -0.42 * s * fat, 0.18 * s, 0);
  const armR = g(body, 0.42 * s * fat, 0.18 * s, 0);
  for (const [arm, sx] of [
    [armL, -1],
    [armR, 1],
  ] as const) {
    mesh(arm, GEO.capsule, fur, [0, -0.16 * s, 0], [0.115 * s, 0.16 * s, 0.115 * s], [0, 0, sx * 0.1]);
    mesh(arm, GEO.sphere, belly, [0, -0.34 * s, 0.02 * s], [0.12 * s, 0.11 * s, 0.12 * s]);
  }
  const hand = g(armR, 0, -0.36 * s, 0.02 * s);

  // Patas cortas
  const legL = g(body, -0.22 * s * fat, -0.34 * s, 0);
  const legR = g(body, 0.22 * s * fat, -0.34 * s, 0);
  for (const leg of [legL, legR]) {
    mesh(leg, GEO.capsule, fur, [0, -0.1 * s, 0], [0.13 * s, 0.1 * s, 0.13 * s]);
    mesh(leg, GEO.sphere, belly, [0, -0.23 * s, 0.06 * s], [0.14 * s, 0.09 * s, 0.18 * s]);
  }

  // Cola segmentada
  const tail = g(body, 0, 0.02 * s, -0.44 * s * fat);
  let seg: THREE.Object3D = tail;
  for (let i = 0; i < 5; i++) {
    const nxt = g(seg, 0, 0, -0.13 * s);
    mesh(nxt, GEO.sphere, i % 2 === 0 ? fur : dark, [0, 0, 0], [(0.08 - i * 0.008) * s, (0.08 - i * 0.008) * s, 0.085 * s]);
    seg = nxt;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return {
    root,
    body,
    head,
    armL,
    armR,
    legL,
    legR,
    tail,
    earL,
    earR,
    hand,
    extras: { torso, skull },
    materials: mats,
    height: 1.5 * s,
    radius: 0.46 * s * fat,
  };
}

/** Benito: gato gris atigrado, corpulento, ojos verdes brillantes. */
export function buildBenito(withOutline = true): CritterRig {
  const rig = buildCat({
    fur: 0x8f8f9c,
    furAlt: 0x6a6a78,
    eye: 0x5cff8a,
    belly: 0xe6e2dc,
    fat: 1.32,
    scale: 1,
    eyeSize: 0.14,
    withOutline,
    stripes: true,
  });
  // Collar de explorador con placa
  const collar = createCelMaterial({ color: 0xd8412f, bands: 2 });
  const tag = createCelMaterial({ color: 0xffd23f, bands: 2, emissive: 0.3 });
  rig.materials.push(collar, tag);
  const c = new THREE.Mesh(GEO.torus, collar);
  c.scale.set(0.3, 0.3, 0.3);
  c.rotation.x = Math.PI / 2;
  c.position.set(0, 0.34, 0.02);
  rig.body.add(c);
  const t = new THREE.Mesh(GEO.sphere, tag);
  t.scale.set(0.07, 0.07, 0.03);
  t.position.set(0, 0.28, 0.3);
  rig.body.add(t);
  rig.extras.collar = c;
  return rig;
}

/** Silva: gata gris atigrada, esbelta, ojos verdes finos. */
export function buildSilva(withOutline = true): CritterRig {
  const rig = buildCat({
    fur: 0x7a8496,
    furAlt: 0x545c6e,
    eye: 0x9bff5c,
    belly: 0xcdd4de,
    fat: 0.82,
    scale: 1.05,
    eyeSize: 0.105,
    withOutline,
    stripes: true,
  });
  // Párpados caídos: mirada condescendiente
  const lid = createCelMaterial({ color: 0x545c6e, bands: 2 });
  rig.materials.push(lid);
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(GEO.sphere, lid);
    l.scale.set(0.13, 0.07, 0.1);
    l.position.set(sx * 0.168, 0.13, 0.32);
    rig.head.add(l);
  }
  // Banda de teniente
  const sash = createCelMaterial({ color: 0x2a2a3a, bands: 2 });
  rig.materials.push(sash);
  const s = new THREE.Mesh(GEO.box, sash);
  s.scale.set(0.62, 0.1, 0.62);
  s.rotation.z = 0.5;
  s.position.set(0, 0.05, 0);
  rig.body.add(s);
  return rig;
}

/** Deedee: chihuahua diminuto, canela, lengua permanentemente fuera, capa negra. */
export function buildDeedee(withOutline = true): CritterRig {
  const mats: THREE.Material[] = [];
  const fur = createCelMaterial({ color: 0xd8935a, colorAlt: 0xb06f3e, bands: 3 });
  const belly = createCelMaterial({ color: 0xf3d2a8, bands: 3 });
  const dark = createCelMaterial({ color: 0x241c22, bands: 2 });
  const tongueMat = createCelMaterial({ color: 0xff5f86, bands: 2 });
  const eyeMat = createCelMaterial({ color: 0x1a1420, bands: 2, emissive: 0.15 });
  const capeMat = createCelMaterial({ color: 0x140f1c, colorAlt: 0x2a1f36, bands: 2, side: THREE.DoubleSide });
  const helmMat = createCelMaterial({ color: 0x8a2be2, bands: 3, emissive: 0.35, rim: 0xff40ff });
  const glass = createCelMaterial({ color: 0x40ffe0, bands: 2, emissive: 0.8, opacity: 0.75, transparent: true });
  mats.push(fur, belly, dark, tongueMat, eyeMat, capeMat, helmMat, glass);

  const root = new THREE.Group();
  const s = 0.62; // muy pequeño frente a Benito

  const body = g(root, 0, 0.5 * s, 0);
  const torso = mesh(body, GEO.sphere, fur, [0, 0, 0], [0.3 * s, 0.33 * s, 0.36 * s]);
  if (withOutline) outline(torso, 0.025);
  mesh(body, GEO.sphere, belly, [0, -0.06 * s, 0.16 * s], [0.2 * s, 0.22 * s, 0.24 * s]);

  const head = g(body, 0, 0.46 * s, 0.05 * s);
  const skull = mesh(head, GEO.sphere, fur, [0, 0, 0], [0.34 * s, 0.34 * s, 0.31 * s]);
  if (withOutline) outline(skull, 0.025);
  // Hocico puntiagudo
  mesh(head, GEO.cone, fur, [0, -0.1 * s, 0.3 * s], [0.13 * s, 0.24 * s, 0.13 * s], [Math.PI / 2.1, 0, 0]);
  mesh(head, GEO.sphere, dark, [0, -0.05 * s, 0.44 * s], [0.05 * s, 0.045 * s, 0.05 * s]);

  // LENGUA FUERA — su rasgo distintivo: siempre visible desde cualquier ángulo
  const tongue = g(head, 0, -0.2 * s, 0.42 * s);
  mesh(tongue, GEO.box, tongueMat, [0, -0.1 * s, 0.05 * s], [0.13 * s, 0.24 * s, 0.07 * s], [0.5, 0, 0]);
  mesh(tongue, GEO.sphere, tongueMat, [0, -0.22 * s, 0.11 * s], [0.075 * s, 0.085 * s, 0.05 * s]);
  if (withOutline) {
    const to = new THREE.Mesh(GEO.box, createOutlineMaterial(0.03));
    to.position.set(0, -0.1 * s, 0.05 * s);
    to.scale.set(0.13 * s, 0.24 * s, 0.07 * s);
    to.rotation.x = 0.5;
    to.renderOrder = -1;
    tongue.add(to);
  }

  // Ojos pequeños y malvados
  for (const sx of [-1, 1]) {
    mesh(head, GEO.sphere, eyeMat, [sx * 0.14 * s, 0.06 * s, 0.26 * s], [0.06 * s, 0.075 * s, 0.05 * s]);
    mesh(head, GEO.box, fur, [sx * 0.14 * s, 0.13 * s, 0.28 * s], [0.14 * s, 0.05 * s, 0.05 * s], [0, 0, sx * 0.45]);
  }

  // Orejas enormes de chihuahua
  const earL = g(head, -0.26 * s, 0.24 * s, -0.02 * s);
  const earR = g(head, 0.26 * s, 0.24 * s, -0.02 * s);
  for (const [ear, sx] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    const e = mesh(ear, GEO.cone, fur, [0, 0.16 * s, 0], [0.16 * s, 0.4 * s, 0.06 * s], [0, 0, sx * 0.35]);
    if (withOutline) outline(e, 0.02);
    mesh(ear, GEO.cone, belly, [0, 0.15 * s, 0.02 * s], [0.1 * s, 0.3 * s, 0.03 * s], [0, 0, sx * 0.35]);
  }

  // Casco de Potencia Canina Avanzado
  const helmet = g(head, 0, 0.2 * s, 0);
  const dome = mesh(helmet, GEO.sphere, helmMat, [0, 0.06 * s, 0], [0.36 * s, 0.26 * s, 0.34 * s]);
  if (withOutline) outline(dome, 0.022);
  mesh(helmet, GEO.torus, helmMat, [0, 0.02 * s, 0], [0.36 * s, 0.36 * s, 0.36 * s], [Math.PI / 2, 0, 0]);
  const core = mesh(helmet, GEO.sphere, glass, [0, 0.2 * s, 0], [0.14 * s, 0.16 * s, 0.14 * s]);
  for (const sx of [-1, 1]) {
    mesh(helmet, GEO.cylinder, glass, [sx * 0.3 * s, 0.12 * s, 0], [0.03 * s, 0.28 * s, 0.03 * s], [0, 0, sx * 0.4]);
  }

  // Capa
  const cape = g(body, 0, 0.2 * s, -0.24 * s);
  const capeMesh = mesh(cape, GEO.cone, capeMat, [0, -0.34 * s, -0.05 * s], [0.5 * s, 0.8 * s, 0.34 * s], [0.22, 0, 0]);
  capeMesh.castShadow = true;

  // Extremidades finas
  const armL = g(body, -0.26 * s, 0.1 * s, 0);
  const armR = g(body, 0.26 * s, 0.1 * s, 0);
  for (const arm of [armL, armR]) {
    mesh(arm, GEO.capsule, fur, [0, -0.14 * s, 0], [0.06 * s, 0.12 * s, 0.06 * s]);
  }
  const legL = g(body, -0.15 * s, -0.28 * s, 0);
  const legR = g(body, 0.15 * s, -0.28 * s, 0);
  for (const leg of [legL, legR]) {
    mesh(leg, GEO.capsule, fur, [0, -0.12 * s, 0], [0.065 * s, 0.12 * s, 0.065 * s]);
    mesh(leg, GEO.sphere, belly, [0, -0.26 * s, 0.04 * s], [0.08 * s, 0.05 * s, 0.11 * s]);
  }
  const tail = g(body, 0, 0.1 * s, -0.32 * s);
  mesh(tail, GEO.capsule, fur, [0, 0.1 * s, -0.04 * s], [0.04 * s, 0.14 * s, 0.04 * s], [0.9, 0, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return {
    root,
    body,
    head,
    armL,
    armR,
    legL,
    legR,
    tail,
    earL,
    earR,
    hand: armR,
    extras: { helmet, tongue, cape, core, dome },
    materials: mats,
    height: 0.95,
    radius: 0.3,
  };
}

export const PET_COLORS: Record<string, { fur: number; furAlt: number; pants: number }> = {
  yellow: { fur: 0xcaa87a, furAlt: 0xa8865a, pants: 0xffd23f },
  red: { fur: 0xb07a6a, furAlt: 0x8a5a4a, pants: 0xe8402f },
  blue: { fur: 0x8aa0c0, furAlt: 0x6a80a0, pants: 0x3f8fff },
  white: { fur: 0xe8e4dc, furAlt: 0xc0bcb4, pants: 0xf4f4f8 },
  green: { fur: 0x8fb07a, furAlt: 0x6f905a, pants: 0x4fd86a },
};

export type PetRig = CritterRig & {
  helmetLight: THREE.Mesh;
  helmetMat: THREE.MeshToonMaterial;
};

/**
 * Mascota renegada: cuerpo de perrillo con casco cuya luz cambia de color
 * según el estado de alerta (azul → amarillo → rojo).
 */
export function buildPet(color: string, withOutline = true): PetRig {
  const c = PET_COLORS[color] ?? PET_COLORS.yellow;
  const mats: THREE.Material[] = [];
  const fur = createCelMaterial({ color: c.fur, colorAlt: c.furAlt, bands: 3 });
  const pants = createCelMaterial({ color: c.pants, bands: 3, emissive: 0.12 });
  const dark = createCelMaterial({ color: 0x2a2530, bands: 2 });
  const skin = createCelMaterial({ color: 0xf0cbb0, bands: 2 });
  const eyeWhite = createCelMaterial({ color: 0xffffff, bands: 2, emissive: 0.3 });
  const helmetMat = createCelMaterial({ color: 0x6a6f88, bands: 3, rim: 0xaad0ff });
  const lightMat = createCelMaterial({ color: 0x40a0ff, bands: 2, emissive: 1.1, rim: 0x80c0ff });
  mats.push(fur, pants, dark, skin, eyeWhite, helmetMat, lightMat);

  const root = new THREE.Group();
  const s = 0.78;

  const body = g(root, 0, 0.5 * s, 0);
  const torso = mesh(body, GEO.capsule, fur, [0, 0, 0], [0.26 * s, 0.2 * s, 0.26 * s]);
  if (withOutline) outline(torso, 0.024);
  mesh(body, GEO.sphere, skin, [0, -0.02 * s, 0.18 * s], [0.16 * s, 0.18 * s, 0.14 * s]);
  // Pantalones de color: identifican el tipo de mascota
  const trousers = mesh(body, GEO.capsule, pants, [0, -0.3 * s, 0], [0.27 * s, 0.14 * s, 0.27 * s]);
  if (withOutline) outline(trousers, 0.02);

  const head = g(body, 0, 0.42 * s, 0.02 * s);
  const skull = mesh(head, GEO.sphere, fur, [0, 0, 0], [0.32 * s, 0.3 * s, 0.3 * s]);
  if (withOutline) outline(skull, 0.024);
  mesh(head, GEO.sphere, skin, [0, -0.06 * s, 0.24 * s], [0.2 * s, 0.16 * s, 0.14 * s]);
  mesh(head, GEO.sphere, dark, [0, -0.02 * s, 0.34 * s], [0.05 * s, 0.045 * s, 0.045 * s]);
  for (const sx of [-1, 1]) {
    mesh(head, GEO.sphere, eyeWhite, [sx * 0.12 * s, 0.08 * s, 0.25 * s], [0.09 * s, 0.1 * s, 0.06 * s]);
    mesh(head, GEO.sphere, dark, [sx * 0.13 * s, 0.08 * s, 0.29 * s], [0.045 * s, 0.055 * s, 0.04 * s]);
  }

  const earL = g(head, -0.28 * s, 0.1 * s, 0);
  const earR = g(head, 0.28 * s, 0.1 * s, 0);
  for (const [ear, sx] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    mesh(ear, GEO.sphere, fur, [0, -0.06 * s, 0], [0.09 * s, 0.16 * s, 0.06 * s], [0, 0, sx * 0.2]);
  }

  // Casco con luz de estado
  const helmet = g(head, 0, 0.16 * s, 0);
  const dome = mesh(helmet, GEO.sphere, helmetMat, [0, 0.05 * s, 0], [0.34 * s, 0.24 * s, 0.32 * s]);
  if (withOutline) outline(dome, 0.02);
  mesh(helmet, GEO.torus, helmetMat, [0, 0, 0], [0.33 * s, 0.33 * s, 0.33 * s], [Math.PI / 2, 0, 0]);
  const helmetLight = mesh(helmet, GEO.sphere, lightMat, [0, 0.22 * s, 0.06 * s], [0.09 * s, 0.09 * s, 0.09 * s]);
  mesh(helmet, GEO.cylinder, helmetMat, [0, 0.16 * s, 0.04 * s], [0.02 * s, 0.14 * s, 0.02 * s]);

  const armL = g(body, -0.28 * s, 0.16 * s, 0);
  const armR = g(body, 0.28 * s, 0.16 * s, 0);
  for (const arm of [armL, armR]) {
    mesh(arm, GEO.capsule, fur, [0, -0.16 * s, 0], [0.07 * s, 0.14 * s, 0.07 * s]);
    mesh(arm, GEO.sphere, skin, [0, -0.34 * s, 0], [0.08 * s, 0.08 * s, 0.08 * s]);
  }
  const legL = g(body, -0.14 * s, -0.36 * s, 0);
  const legR = g(body, 0.14 * s, -0.36 * s, 0);
  for (const leg of [legL, legR]) {
    mesh(leg, GEO.capsule, pants, [0, -0.1 * s, 0], [0.09 * s, 0.1 * s, 0.09 * s]);
    mesh(leg, GEO.sphere, dark, [0, -0.26 * s, 0.05 * s], [0.1 * s, 0.06 * s, 0.13 * s]);
  }
  const tail = g(body, 0, 0.06 * s, -0.28 * s);
  mesh(tail, GEO.capsule, fur, [0, 0.08 * s, -0.06 * s], [0.05 * s, 0.12 * s, 0.05 * s], [0.7, 0, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return {
    root,
    body,
    head,
    armL,
    armR,
    legL,
    legR,
    tail,
    earL,
    earR,
    hand: armR,
    extras: { helmet, dome },
    materials: mats,
    height: 1.1,
    radius: 0.32,
    helmetLight,
    helmetMat: lightMat,
  };
}

/** Guardián: mascota grande con casco reforzado, hace de jefe intermedio. */
export function buildGuardian(withOutline = true): PetRig {
  const rig = buildPet('white', withOutline);
  rig.root.scale.setScalar(2.1);
  const armor = createCelMaterial({ color: 0x4a5068, bands: 3, rim: 0xff5a5a, emissive: 0.1 });
  rig.materials.push(armor);
  const plate = new THREE.Mesh(GEO.sphere, armor);
  plate.scale.set(0.34, 0.3, 0.3);
  plate.position.set(0, 0.02, 0.06);
  rig.body.add(plate);
  for (const sx of [-1, 1]) {
    const spike = new THREE.Mesh(GEO.cone, armor);
    spike.scale.set(0.07, 0.2, 0.07);
    spike.position.set(sx * 0.2, 0.36, 0);
    spike.rotation.z = sx * 0.4;
    rig.head.add(spike);
  }
  rig.height = 2.3;
  rig.radius = 0.7;
  return rig;
}

/** Dr. Pelomántiz: busto para el comunicador y las cinemáticas. */
export function buildProfessor(): CritterRig {
  const rig = buildCat({
    fur: 0xd8d4cc,
    furAlt: 0xb0aca4,
    eye: 0x40b0ff,
    belly: 0xf4f2ee,
    fat: 1.05,
    scale: 0.95,
    eyeSize: 0.12,
    withOutline: true,
    stripes: false,
  });
  const coat = createCelMaterial({ color: 0xf8f8fa, bands: 3 });
  const glassMat = createCelMaterial({ color: 0xa0e0ff, bands: 2, emissive: 0.5, opacity: 0.6, transparent: true });
  const frame = createCelMaterial({ color: 0x30303a, bands: 2 });
  rig.materials.push(coat, glassMat, frame);

  const lab = new THREE.Mesh(GEO.capsule, coat);
  lab.scale.set(0.5, 0.3, 0.48);
  lab.position.set(0, -0.06, 0);
  rig.body.add(lab);

  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(GEO.sphere, glassMat);
    lens.scale.set(0.17, 0.17, 0.06);
    lens.position.set(sx * 0.16, 0.06, 0.36);
    rig.head.add(lens);
    const ring = new THREE.Mesh(GEO.torus, frame);
    ring.scale.set(0.17, 0.17, 0.17);
    ring.position.set(sx * 0.16, 0.06, 0.36);
    rig.head.add(ring);
  }
  const bridge = new THREE.Mesh(GEO.box, frame);
  bridge.scale.set(0.16, 0.02, 0.02);
  bridge.position.set(0, 0.06, 0.36);
  rig.head.add(bridge);
  return rig;
}

// ─────────────────────────── Artefactos ───────────────────────────

export type GadgetModels = {
  group: THREE.Group;
  timeNet: THREE.Group;
  waterNet: THREE.Group;
  stunClub: THREE.Group;
  dashHoop: THREE.Group;
  magicPunch: THREE.Group;
  superHoop: THREE.Group;
  petRadar: THREE.Group;
  timeFreeze: THREE.Group;
};

function buildNet(hoopColor: number, meshColor: number): THREE.Group {
  const grp = new THREE.Group();
  const handleMat = createCelMaterial({ color: 0x8a5a3a, bands: 2 });
  const hoopMat = createCelMaterial({ color: hoopColor, bands: 3, emissive: 0.4, rim: hoopColor });
  const webMat = createCelMaterial({
    color: meshColor,
    bands: 2,
    emissive: 0.5,
    opacity: 0.45,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const handle = new THREE.Mesh(GEO.cylinder, handleMat);
  handle.scale.set(0.045, 0.62, 0.045);
  handle.position.set(0, -0.3, 0);
  grp.add(handle);
  const hoop = new THREE.Mesh(GEO.torus, hoopMat);
  hoop.scale.set(0.34, 0.34, 0.34);
  hoop.position.set(0, 0.12, 0);
  hoop.rotation.x = Math.PI / 2;
  grp.add(hoop);
  // Malla en forma de tela de araña
  const web = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.5, 10, 1, true), webMat);
  web.position.set(0, -0.1, 0);
  grp.add(web);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(GEO.torus, webMat);
    const k = 1 - i * 0.18;
    ring.scale.set(0.33 * k, 0.33 * k, 0.6);
    ring.position.set(0, 0.1 - i * 0.09, 0);
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);
  }
  return grp;
}

export function buildGadgets(): GadgetModels {
  const group = new THREE.Group();

  const timeNet = buildNet(0x40e0ff, 0x9ff0ff);
  const waterNet = buildNet(0x2ad0ff, 0x60ffe0);

  const stunClub = new THREE.Group();
  {
    const shaft = createCelMaterial({ color: 0x8a5a3a, bands: 2 });
    const headMat = createCelMaterial({ color: 0xffb040, bands: 3, emissive: 0.4, rim: 0xffe0a0 });
    const s = new THREE.Mesh(GEO.cylinder, shaft);
    s.scale.set(0.05, 0.5, 0.05);
    s.position.set(0, -0.22, 0);
    stunClub.add(s);
    const h = new THREE.Mesh(GEO.capsule, headMat);
    h.scale.set(0.13, 0.14, 0.13);
    h.position.set(0, 0.14, 0);
    stunClub.add(h);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(GEO.torus, headMat);
      ring.scale.set(0.16, 0.16, 0.5);
      ring.position.set(0, 0.06 + i * 0.1, 0);
      ring.rotation.x = Math.PI / 2;
      stunClub.add(ring);
    }
  }

  const makeHoop = (color: number, glow: number) => {
    const grp = new THREE.Group();
    const m = createCelMaterial({ color, bands: 3, emissive: glow, rim: color });
    const ring = new THREE.Mesh(GEO.torus, m);
    ring.scale.set(0.42, 0.42, 0.42);
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(GEO.box, m);
      spoke.scale.set(0.03, 0.03, 0.42);
      spoke.rotation.y = (i / 4) * Math.PI;
      grp.add(spoke);
    }
    return grp;
  };
  const dashHoop = makeHoop(0x9fff40, 0.6);
  const superHoop = makeHoop(0xc080ff, 0.7);

  const magicPunch = new THREE.Group();
  {
    const glove = createCelMaterial({ color: 0xff5a5a, colorAlt: 0xc03030, bands: 3, emissive: 0.15 });
    const band = createCelMaterial({ color: 0xffe0a0, bands: 2, emissive: 0.4 });
    const fist = new THREE.Mesh(GEO.sphere, glove);
    fist.scale.set(0.24, 0.22, 0.26);
    magicPunch.add(fist);
    for (let i = 0; i < 4; i++) {
      const knuckle = new THREE.Mesh(GEO.sphere, glove);
      knuckle.scale.set(0.07, 0.07, 0.07);
      knuckle.position.set(-0.14 + i * 0.09, 0.1, 0.2);
      magicPunch.add(knuckle);
    }
    const cuff = new THREE.Mesh(GEO.torus, band);
    cuff.scale.set(0.22, 0.22, 0.4);
    cuff.position.set(0, -0.02, -0.2);
    magicPunch.add(cuff);
  }

  const petRadar = new THREE.Group();
  {
    const body = createCelMaterial({ color: 0x3a4050, bands: 3 });
    const screen = createCelMaterial({ color: 0x40ffa0, bands: 2, emissive: 0.9, rim: 0x40ffa0 });
    const box = new THREE.Mesh(GEO.box, body);
    box.scale.set(0.3, 0.36, 0.09);
    petRadar.add(box);
    const scr = new THREE.Mesh(GEO.box, screen);
    scr.scale.set(0.22, 0.24, 0.02);
    scr.position.set(0, 0.02, 0.06);
    petRadar.add(scr);
    const ant = new THREE.Mesh(GEO.cylinder, body);
    ant.scale.set(0.015, 0.3, 0.015);
    ant.position.set(0.12, 0.3, 0);
    petRadar.add(ant);
  }

  const timeFreeze = new THREE.Group();
  {
    const shell = createCelMaterial({ color: 0xdfefff, bands: 3, emissive: 0.3, rim: 0xffffff });
    const core = createCelMaterial({ color: 0x80f0ff, bands: 2, emissive: 1.0, opacity: 0.8, transparent: true });
    const s = new THREE.Mesh(GEO.sphere, shell);
    s.scale.set(0.2, 0.2, 0.2);
    timeFreeze.add(s);
    const c = new THREE.Mesh(GEO.sphere, core);
    c.scale.set(0.3, 0.3, 0.3);
    timeFreeze.add(c);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(GEO.torus, shell);
      ring.scale.set(0.3, 0.3, 0.3);
      ring.rotation.set((i * Math.PI) / 3, i * 0.6, 0);
      timeFreeze.add(ring);
    }
  }

  const all = { timeNet, waterNet, stunClub, dashHoop, magicPunch, superHoop, petRadar, timeFreeze };
  for (const m of Object.values(all)) {
    m.visible = false;
    group.add(m);
  }
  timeNet.visible = true;
  return { group, ...all };
}

/** Puerta temporal de salida del nivel. */
export function buildTimeGate(): { group: THREE.Group; ring: THREE.Mesh; portal: THREE.Mesh; mats: THREE.Material[] } {
  const group = new THREE.Group();
  const frameMat = createCelMaterial({ color: 0xffd23f, bands: 3, emissive: 0.4, rim: 0xfff0a0 });
  const portalMat = createCelMaterial({
    color: 0x40e0ff,
    bands: 2,
    emissive: 1.0,
    opacity: 0.7,
    transparent: true,
    wobble: 0.25,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 8, 22), frameMat);
  ring.position.y = 2.6;
  group.add(ring);
  const portal = new THREE.Mesh(new THREE.CircleGeometry(2.1, 22), portalMat);
  portal.position.y = 2.6;
  group.add(portal);
  const portalBack = new THREE.Mesh(new THREE.CircleGeometry(2.1, 22), portalMat);
  portalBack.position.y = 2.6;
  portalBack.rotation.y = Math.PI;
  group.add(portalBack);
  const base = new THREE.Mesh(GEO.cylinder, frameMat);
  base.scale.set(1.4, 0.4, 1.4);
  base.position.y = 0.2;
  group.add(base);
  return { group, ring, portal, mats: [frameMat, portalMat] };
}

export function buildCoin(): THREE.Group {
  const grp = new THREE.Group();
  const gold = createCelMaterial({ color: 0xffd23f, bands: 3, emissive: 0.45, rim: 0xfff0a0 });
  const face = createCelMaterial({ color: 0xd8935a, bands: 2, emissive: 0.3 });
  const disc = new THREE.Mesh(GEO.cylinder, gold);
  disc.scale.set(0.5, 0.09, 0.5);
  disc.rotation.x = Math.PI / 2;
  grp.add(disc);
  // Silueta de la cabeza de Deedee grabada
  const head = new THREE.Mesh(GEO.sphere, face);
  head.scale.set(0.22, 0.22, 0.06);
  head.position.z = 0.06;
  grp.add(head);
  const head2 = head.clone();
  head2.position.z = -0.06;
  grp.add(head2);
  return grp;
}

export function buildCookie(): THREE.Group {
  const grp = new THREE.Group();
  const dough = createCelMaterial({ color: 0xd9a05a, colorAlt: 0xb87f3f, bands: 3 });
  const chip = createCelMaterial({ color: 0x4a2c1a, bands: 2 });
  const disc = new THREE.Mesh(GEO.cylinder, dough);
  disc.scale.set(0.42, 0.13, 0.42);
  grp.add(disc);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const c = new THREE.Mesh(GEO.sphere, chip);
    c.scale.setScalar(0.07);
    c.position.set(Math.cos(a) * 0.22, 0.08, Math.sin(a) * 0.22);
    grp.add(c);
  }
  return grp;
}
