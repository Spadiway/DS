/**
 * Modelos de personajes construidos por procedimiento con primitivas de bajo
 * polígono, en la línea de los personajes de plataformas de consola portátil:
 * cabezas grandes, ojos enormes, cuerpos redondeados y silueta muy legible.
 *
 * Cada modelo devuelve un "rig" con grupos nombrados que engine/anim.ts anima.
 */
import * as THREE from 'three';
import { createCelMaterial, createOutlineMaterial } from './celMaterial';
import { clothTexture, faceTexture, furTexture, helmetTexture } from './textures';

/**
 * La cara y el vientre van pintados en la textura, así que hay que alinearlos
 * con el frente del modelo. En la esfera de Three el eje +Z —hacia donde mira
 * el personaje— cae en u = 0.25, mientras que la textura dibuja la cara
 * centrada en u = 0.5: este desplazamiento las hace coincidir.
 */
function faceForward(tex: THREE.Texture): THREE.Texture {
  const t = tex.clone();
  t.offset.x = 0.25;
  t.needsUpdate = true;
  return t;
}

export type CritterRig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  /** Articulaciones intermedias: permiten doblar codo y rodilla al animar. */
  forearmL?: THREE.Group;
  forearmR?: THREE.Group;
  shinL?: THREE.Group;
  shinR?: THREE.Group;
  neck?: THREE.Group;
  /** Altura de reposo del torso: la animación parte de aquí al respirar. */
  bodyRestY: number;
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

/**
 * Cuerpo torneado a partir de un perfil. Una esfera escalada da una bola; un
 * torno permite hombros estrechos que se ensanchan hacia la barriga y se
 * cierran en la cadera, que es la silueta de los personajes de referencia.
 * El torno genera UV (u alrededor, v a lo largo), así que la textura de pelo
 * envuelve igual que en la esfera.
 */
function latheBody(profile: [number, number][], segments = 14): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)),
    segments,
  );
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
  /** Intensidad del ceño pintado en la cara: 0 neutro, 1 muy enfadado. */
  angry?: number;
  glasses?: boolean;
};

/**
 * Constructor genérico de felino: sirve para Benito (corpulento) y Silva
 * (esbelta).
 *
 * Construcción por partes articuladas, no esferas apiladas:
 *   cabeza grande con la cara pintada · cuello · torso torneado en pera ·
 *   brazo con hombro, codo y zarpa · pierna con cadera, rodilla y pie grande ·
 *   cola segmentada.
 *
 * Toda la expresión facial va en la textura: ojos con iris, pupila y brillo,
 * nariz, boca, bigotes, marca atigrada y ceño. Poca geometría y mucha imagen,
 * que es como se resolvía en la época.
 */
export function buildCat(opts: CatOptions): CritterRig {
  const mats: THREE.Material[] = [];

  const furMap = faceForward(
    furTexture({ base: opts.fur, belly: opts.belly, stripe: opts.furAlt, stripes: opts.stripes }),
  );
  // Lustre leve en el pelaje y algo más en la nariz y las almohadillas: la
  // referencia tiene un acabado plástico y brillante en todo, no mate.
  const fur = createCelMaterial({ color: 0xffffff, bands: 3, map: furMap, gloss: 0.12 });
  const plain = createCelMaterial({ color: opts.fur, bands: 3, gloss: 0.12 });
  const belly = createCelMaterial({ color: opts.belly, bands: 3, gloss: 0.1 });
  const dark = createCelMaterial({ color: 0x2a2530, bands: 2, gloss: 0.35 });
  const faceMat = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    gloss: 0.16,
    map: faceForward(
      faceTexture({
        fur: opts.fur,
        belly: opts.belly,
        eye: opts.eye,
        kind: 'cat',
        stripe: opts.stripes ? opts.furAlt : undefined,
        angry: opts.angry ?? 0,
        glasses: opts.glasses ?? false,
      }),
    ),
  });
  mats.push(fur, plain, belly, dark, faceMat);

  const root = new THREE.Group();
  const s = opts.scale;
  const fat = opts.fat;

  // ── Torso ──────────────────────────────────────────────────────────────
  // Perfil de pera: hombros estrechos, barriga ancha, cadera recogida.
  const torsoGeo = latheBody([
    [0.04, -0.46],
    [0.26, -0.45],
    [0.40, -0.36],
    [0.47, -0.18],
    [0.48, 0.02],
    [0.43, 0.20],
    [0.33, 0.34],
    [0.21, 0.43],
    [0.09, 0.47],
    [0.02, 0.48],
  ]);
  const body = g(root, 0, 0.78 * s, 0);
  const torso = mesh(body, torsoGeo, fur, [0, 0, 0], [s * fat, s, s * fat]);
  if (opts.withOutline) outline(torso, 0.042);
  // Pechera clara, desde la barbilla hasta la tripa
  mesh(body, GEO.sphere, belly, [0, -0.06 * s, 0.3 * s * fat], [0.27 * s * fat, 0.32 * s, 0.22 * s]);

  // ── Cuello y cabeza ────────────────────────────────────────────────────
  const neck = g(body, 0, 0.44 * s, 0.01 * s);
  mesh(neck, GEO.cylinder, plain, [0, 0.06 * s, 0], [0.17 * s, 0.13 * s, 0.17 * s]);

  const head = g(neck, 0, 0.22 * s, 0.02 * s);
  // Cabeza ligeramente achatada: la cara pintada se lee mejor sobre una
  // superficie ancha y poco esférica.
  const skull = mesh(head, GEO.sphere, faceMat, [0, 0, 0], [0.46 * s, 0.42 * s, 0.42 * s]);
  if (opts.withOutline) outline(skull, 0.038);
  // Carrillos: rompen la silueta redonda y dan cara de gato
  for (const sx of [-1, 1]) {
    mesh(head, GEO.sphere, plain, [sx * 0.33 * s, -0.1 * s, 0.14 * s], [0.14 * s, 0.13 * s, 0.14 * s]);
  }

  const earL = g(head, -0.27 * s, 0.28 * s, -0.02 * s);
  const earR = g(head, 0.27 * s, 0.28 * s, -0.02 * s);
  for (const [ear, sx] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    const e = mesh(ear, GEO.cone, plain, [0, 0.11 * s, 0], [0.16 * s, 0.28 * s, 0.12 * s], [0, 0, sx * 0.26]);
    if (opts.withOutline) outline(e, 0.024);
    mesh(ear, GEO.cone, belly, [0, 0.1 * s, 0.04 * s], [0.09 * s, 0.19 * s, 0.05 * s], [0, 0, sx * 0.26]);
  }

  // ── Brazos: hombro, codo y zarpa ───────────────────────────────────────
  // Los hombros van donde el perfil se estrecha: más afuera quedaban sueltos,
  // más adentro desaparecían dentro de la barriga.
  const armL = g(body, -0.45 * s * fat, 0.24 * s, 0.06 * s);
  const armR = g(body, 0.45 * s * fat, 0.24 * s, 0.06 * s);
  const forearms: THREE.Group[] = [];
  for (const [arm, sx] of [
    [armL, -1],
    [armR, 1],
  ] as const) {
    mesh(arm, GEO.sphere, plain, [0, 0, 0], [0.14 * s, 0.14 * s, 0.14 * s]);
    mesh(arm, GEO.capsule, plain, [0, -0.14 * s, 0], [0.105 * s, 0.11 * s, 0.105 * s], [0, 0, sx * 0.14]);
    const forearm = g(arm, sx * 0.05 * s, -0.29 * s, 0);
    mesh(forearm, GEO.capsule, plain, [0, -0.1 * s, 0], [0.095 * s, 0.1 * s, 0.095 * s]);
    // Zarpa: bola clara con dedos marcados
    mesh(forearm, GEO.sphere, belly, [0, -0.24 * s, 0.01 * s], [0.115 * s, 0.1 * s, 0.115 * s]);
    for (let i = -1; i <= 1; i++) {
      mesh(forearm, GEO.sphere, belly, [i * 0.055 * s, -0.28 * s, 0.06 * s], [0.04 * s, 0.035 * s, 0.045 * s]);
    }
    forearms.push(forearm);
  }
  const hand = g(forearms[1], 0, -0.26 * s, 0.04 * s);

  // ── Piernas: cadera, rodilla y pie grande ──────────────────────────────
  const legL = g(body, -0.23 * s * fat, -0.38 * s, 0);
  const legR = g(body, 0.23 * s * fat, -0.38 * s, 0);
  const shins: THREE.Group[] = [];
  for (const leg of [legL, legR]) {
    mesh(leg, GEO.sphere, plain, [0, 0, 0], [0.145 * s, 0.14 * s, 0.145 * s]);
    mesh(leg, GEO.capsule, plain, [0, -0.11 * s, 0], [0.12 * s, 0.08 * s, 0.12 * s]);
    const shin = g(leg, 0, -0.24 * s, 0);
    mesh(shin, GEO.capsule, plain, [0, -0.06 * s, 0], [0.105 * s, 0.06 * s, 0.105 * s]);
    // Pie grande y alargado: en la referencia son muy marcados
    const foot = mesh(shin, GEO.sphere, belly, [0, -0.16 * s, 0.07 * s], [0.145 * s, 0.09 * s, 0.22 * s]);
    if (opts.withOutline) outline(foot, 0.02);
    for (let i = -1; i <= 1; i++) {
      mesh(shin, GEO.sphere, belly, [i * 0.062 * s, -0.17 * s, 0.23 * s], [0.048 * s, 0.042 * s, 0.055 * s]);
    }
    shins.push(shin);
  }

  // ── Cola ───────────────────────────────────────────────────────────────
  const tail = g(body, 0, -0.12 * s, -0.42 * s * fat);
  let seg: THREE.Object3D = tail;
  for (let i = 0; i < 6; i++) {
    const nxt = g(seg, 0, 0, -0.12 * s);
    mesh(
      nxt,
      GEO.sphere,
      i % 2 === 0 ? plain : dark,
      [0, 0, 0],
      [(0.085 - i * 0.007) * s, (0.085 - i * 0.007) * s, 0.09 * s],
    );
    seg = nxt;
  }

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return {
    root,
    body,
    head,
    neck,
    armL,
    armR,
    forearmL: forearms[0],
    forearmR: forearms[1],
    legL,
    legR,
    shinL: shins[0],
    shinR: shins[1],
    tail,
    earL,
    earR,
    hand,
    bodyRestY: 0.78 * s,
    extras: { torso, skull },
    materials: mats,
    height: 1.55 * s,
    radius: 0.46 * s * fat,
  };
}

/** Benito: gato gris atigrado, corpulento, ojos verdes brillantes. */
export function buildBenito(withOutline = true): CritterRig {
  const rig = buildCat({
    // Pardo cálido en vez de gris azulado. Un gris frío sobre hierba y arena
    // —los dos suelos más frecuentes— tiene casi el mismo valor que el fondo
    // y el personaje se despega solo por el contorno.
    fur: 0xa89686,
    furAlt: 0x4a3f38,
    eye: 0x5cff8a,
    belly: 0xf4ece0,
    fat: 1.32,
    scale: 1,
    eyeSize: 0.14,
    withOutline,
    stripes: true,
  });
  // Collar de explorador con placa
  const collar = createCelMaterial({ color: 0xd8412f, bands: 2, gloss: 0.4 });
  const tag = createCelMaterial({ color: 0xffd23f, bands: 2, emissive: 0.35, gloss: 0.5 });
  rig.materials.push(collar, tag);
  const c = new THREE.Mesh(GEO.torus, collar);
  c.scale.set(0.24, 0.24, 0.7);
  c.rotation.x = Math.PI / 2;
  c.position.set(0, -0.01, 0);
  (rig.neck ?? rig.body).add(c);
  const t = new THREE.Mesh(GEO.sphere, tag);
  t.scale.set(0.075, 0.09, 0.05);
  t.position.set(0, -0.09, 0.19);
  (rig.neck ?? rig.body).add(t);
  rig.extras.collar = c;

  /**
   * Mochila de artefactos.
   *
   * El jugador ve la espalda de Benito el 95 % de la partida, y por detrás no
   * había un solo acento de color: el collar rojo queda tapado por la cabeza.
   * Los protagonistas del género se leen de espaldas a la primera porque
   * llevan ropa de colores planos y saturados. Aquí la mochila cumple esa
   * función y además justifica de dónde salen los ocho artefactos.
   */
  const pack = createCelMaterial({ color: 0xe4552c, bands: 2, gloss: 0.42 });
  const strap = createCelMaterial({ color: 0x2f6fd0, bands: 2, gloss: 0.34 });
  const buckle = createCelMaterial({ color: 0xffc93c, bands: 2, emissive: 0.2, gloss: 0.55 });
  rig.materials.push(pack, strap, buckle);

  const backpack = new THREE.Group();
  // Caja achatada, no una bola: pegada al lomo se lee como una mochila, y
  // esférica se leía como un globo atado a la espalda.
  const shell = new THREE.Mesh(GEO.box, pack);
  shell.scale.set(0.42, 0.44, 0.34);
  backpack.add(shell);
  const pocket = new THREE.Mesh(GEO.box, strap);
  pocket.scale.set(0.3, 0.16, 0.1);
  pocket.position.set(0, -0.1, -0.2);
  backpack.add(pocket);
  // Tapa superior, más clara, para que el bulto no se lea como una pelota
  const lid = new THREE.Mesh(GEO.box, buckle);
  lid.scale.set(0.46, 0.1, 0.36);
  lid.position.set(0, 0.24, 0.0);
  backpack.add(lid);
  // Correas cruzadas sobre el lomo, hacia los hombros
  for (const side of [-1, 1]) {
    const st = new THREE.Mesh(GEO.box, strap);
    st.scale.set(0.09, 0.6, 0.06);
    st.position.set(side * 0.2, 0.04, 0.3);
    st.rotation.z = side * 0.24;
    backpack.add(st);
  }
  const clip = new THREE.Mesh(GEO.box, buckle);
  clip.scale.set(0.14, 0.1, 0.06);
  clip.position.set(0, 0.04, -0.19);
  backpack.add(clip);
  // El torso mide 0.48 x 1.32 de radio: por delante de z = -0.6 la mochila
  // quedaba enterrada dentro del gato y solo asomaba un punto naranja.
  // El torso llega a z = -0.63: por delante de aquí la mochila se hunde
  backpack.position.set(0, 0.08, -0.74);
  rig.body.add(backpack);
  rig.extras.backpack = backpack;

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
    // Mirada condescendiente: el ceño va pintado en la cara
    angry: 0.85,
  });
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
  const fur = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    map: faceForward(furTexture({ base: 0xd8935a, belly: 0xf3d2a8 })),
  });
  const plain = createCelMaterial({ color: 0xd8935a, bands: 3 });
  const belly = createCelMaterial({ color: 0xf3d2a8, bands: 3 });
  const capeMat = createCelMaterial({ color: 0x1a1226, bands: 2, side: THREE.DoubleSide });
  const capeLining = createCelMaterial({ color: 0x8a1030, bands: 2, side: THREE.DoubleSide });
  const helmMat = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    map: helmetTexture(0x9b3ff0),
    emissive: 0.2,
    rim: 0xc060ff,
  });
  const glass = createCelMaterial({ color: 0x40ffe0, bands: 2, emissive: 0.55, opacity: 0.82, transparent: true, rim: 0x40ffe0 });
  const faceMat = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    gloss: 0.16,
    map: faceForward(
      faceTexture({ fur: 0xd8935a, belly: 0xf3d2a8, eye: 0x2a1a10, kind: 'dog', angry: 1, tongue: true }),
    ),
  });
  mats.push(fur, plain, belly, capeMat, capeLining, helmMat, glass, faceMat);

  const root = new THREE.Group();
  const s = 0.68; // diminuto frente a Benito: el contraste es intencionado

  // Torso pequeño y estrecho, de chihuahua
  const torsoGeo = latheBody([
    [0.03, -0.28],
    [0.16, -0.27],
    [0.21, -0.16],
    [0.22, 0.0],
    [0.2, 0.14],
    [0.13, 0.24],
    [0.03, 0.27],
  ]);
  const body = g(root, 0, 0.62 * s, 0);
  const torso = mesh(body, torsoGeo, fur, [0, 0, 0], [s, s, s * 0.95]);
  if (withOutline) outline(torso, 0.024);
  mesh(body, GEO.sphere, belly, [0, -0.04 * s, 0.18 * s], [0.14 * s, 0.18 * s, 0.1 * s]);

  const neck = g(body, 0, 0.26 * s, 0.01 * s);
  const head = g(neck, 0, 0.18 * s, 0.02 * s);
  // Cabeza grande respecto al cuerpo: acentúa lo cómico del personaje
  const skull = mesh(head, GEO.sphere, faceMat, [0, 0, 0], [0.44 * s, 0.42 * s, 0.4 * s]);
  if (withOutline) outline(skull, 0.026);
  // Morro puntiagudo, rasgo de la raza
  mesh(head, GEO.cone, belly, [0, -0.16 * s, 0.3 * s], [0.11 * s, 0.16 * s, 0.11 * s], [Math.PI / 2.05, 0, 0]);

  // Orejas enormes: su silueta más reconocible
  const earL = g(head, -0.3 * s, 0.26 * s, -0.02 * s);
  const earR = g(head, 0.3 * s, 0.26 * s, -0.02 * s);
  for (const [ear, sx] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    const e = mesh(ear, GEO.cone, plain, [0, 0.22 * s, 0], [0.19 * s, 0.5 * s, 0.08 * s], [0, 0, sx * 0.36]);
    if (withOutline) outline(e, 0.022);
    mesh(ear, GEO.cone, belly, [0, 0.21 * s, 0.035 * s], [0.11 * s, 0.38 * s, 0.03 * s], [0, 0, sx * 0.36]);
  }

  // Casco de Potencia Canina Avanzado
  const helmet = g(head, 0, 0.24 * s, 0);
  const dome = mesh(helmet, GEO.sphere, helmMat, [0, 0.07 * s, 0], [0.4 * s, 0.3 * s, 0.38 * s]);
  if (withOutline) outline(dome, 0.024);
  mesh(helmet, GEO.torus, helmMat, [0, 0.02 * s, 0], [0.4 * s, 0.4 * s, 0.4 * s], [Math.PI / 2, 0, 0]);
  const core = mesh(helmet, GEO.sphere, glass, [0, 0.24 * s, 0], [0.15 * s, 0.17 * s, 0.15 * s]);
  for (const sx of [-1, 1]) {
    mesh(helmet, GEO.cylinder, glass, [sx * 0.34 * s, 0.14 * s, 0], [0.03 * s, 0.32 * s, 0.03 * s], [0, 0, sx * 0.42]);
    mesh(helmet, GEO.sphere, glass, [sx * 0.42 * s, 0.28 * s, 0], [0.05 * s, 0.05 * s, 0.05 * s]);
  }

  // Capa con forro rojo: se ve al girarse
  const cape = g(body, 0, 0.18 * s, -0.2 * s);
  mesh(cape, GEO.cone, capeMat, [0, -0.36 * s, -0.06 * s], [0.5 * s, 0.86 * s, 0.34 * s], [0.2, 0, 0]);
  mesh(cape, GEO.cone, capeLining, [0, -0.35 * s, -0.04 * s], [0.44 * s, 0.8 * s, 0.28 * s], [0.2, 0, 0]);
  mesh(cape, GEO.torus, capeLining, [0, 0.02 * s, 0.02 * s], [0.2 * s, 0.2 * s, 0.4 * s], [Math.PI / 2, 0, 0]);

  const armL = g(body, -0.21 * s, 0.12 * s, 0);
  const armR = g(body, 0.21 * s, 0.12 * s, 0);
  const forearms: THREE.Group[] = [];
  for (const arm of [armL, armR]) {
    mesh(arm, GEO.capsule, plain, [0, -0.1 * s, 0], [0.055 * s, 0.08 * s, 0.055 * s]);
    const forearm = g(arm, 0, -0.2 * s, 0);
    mesh(forearm, GEO.capsule, plain, [0, -0.07 * s, 0], [0.05 * s, 0.07 * s, 0.05 * s]);
    mesh(forearm, GEO.sphere, belly, [0, -0.16 * s, 0], [0.062 * s, 0.06 * s, 0.062 * s]);
    forearms.push(forearm);
  }

  const legL = g(body, -0.13 * s, -0.25 * s, 0);
  const legR = g(body, 0.13 * s, -0.25 * s, 0);
  const shins: THREE.Group[] = [];
  for (const leg of [legL, legR]) {
    mesh(leg, GEO.capsule, plain, [0, -0.07 * s, 0], [0.06 * s, 0.07 * s, 0.06 * s]);
    const shin = g(leg, 0, -0.17 * s, 0);
    mesh(shin, GEO.capsule, plain, [0, -0.05 * s, 0], [0.055 * s, 0.05 * s, 0.055 * s]);
    mesh(shin, GEO.sphere, belly, [0, -0.14 * s, 0.04 * s], [0.08 * s, 0.055 * s, 0.12 * s]);
    shins.push(shin);
  }

  const tail = g(body, 0, 0.08 * s, -0.24 * s);
  mesh(tail, GEO.capsule, plain, [0, 0.1 * s, -0.04 * s], [0.038 * s, 0.13 * s, 0.038 * s], [0.95, 0, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return {
    root,
    body,
    head,
    neck,
    armL,
    armR,
    forearmL: forearms[0],
    forearmR: forearms[1],
    legL,
    legR,
    shinL: shins[0],
    shinR: shins[1],
    tail,
    earL,
    earR,
    hand: forearms[1],
    bodyRestY: 0.62 * s,
    extras: { helmet, cape, core, dome },
    materials: mats,
    height: 1.0,
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

  const fur = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    map: faceForward(furTexture({ base: c.fur, belly: c.furAlt, stripe: c.furAlt })),
  });
  const plain = createCelMaterial({ color: c.fur, bands: 3 });
  const pants = createCelMaterial({ color: 0xffffff, bands: 3, map: clothTexture(c.pants), mapRepeat: 2 });
  const dark = createCelMaterial({ color: 0x2a2530, bands: 2 });
  const skin = createCelMaterial({ color: 0xf0cbb0, bands: 2 });
  // Casco muy lustroso: es la pieza que identifica a una mascota controlada
  const helmetMat = createCelMaterial({ color: 0xffffff, bands: 3, map: helmetTexture(0x6a6f88), gloss: 0.6 });
  // La intensidad real la fija pet.ts según el nivel de alerta
  const lightMat = createCelMaterial({ color: 0x40a0ff, bands: 2, emissive: 0.4, rim: 0x80c0ff });
  const faceMat = createCelMaterial({
    color: 0xffffff,
    bands: 3,
    map: faceForward(faceTexture({ fur: c.fur, belly: 0xf0cbb0, eye: 0x201820, kind: 'pet' })),
  });
  mats.push(fur, plain, pants, dark, skin, helmetMat, lightMat, faceMat);

  const root = new THREE.Group();
  const s = 0.82;

  // Torso torneado: hombros marcados y cintura, no una cápsula lisa
  const torsoGeo = latheBody([
    [0.03, -0.3],
    [0.19, -0.29],
    [0.24, -0.18],
    [0.25, -0.02],
    [0.27, 0.12],
    [0.24, 0.22],
    [0.15, 0.29],
    [0.03, 0.31],
  ]);
  const body = g(root, 0, 0.72 * s, 0);
  const torso = mesh(body, torsoGeo, fur, [0, 0, 0], [s, s, s * 0.92]);
  if (withOutline) outline(torso, 0.026);
  mesh(body, GEO.sphere, skin, [0, 0.02 * s, 0.2 * s], [0.15 * s, 0.17 * s, 0.1 * s]);

  // Pantalón corto de color: la señal que identifica el tipo de mascota, así
  // que ocupa cadera y medio muslo en vez de una banda estrecha.
  const trousers = mesh(body, GEO.capsule, pants, [0, -0.3 * s, 0], [0.29 * s, 0.16 * s, 0.29 * s]);
  if (withOutline) outline(trousers, 0.024);
  // Cinturón
  mesh(body, GEO.torus, dark, [0, -0.17 * s, 0], [0.28 * s, 0.28 * s, 0.55 * s], [Math.PI / 2, 0, 0]);
  mesh(body, GEO.box, lightMat, [0, -0.17 * s, 0.26 * s], [0.09 * s, 0.07 * s, 0.03 * s]);

  const neck = g(body, 0, 0.3 * s, 0.01 * s);
  const head = g(neck, 0, 0.14 * s, 0.01 * s);
  const skull = mesh(head, GEO.sphere, faceMat, [0, 0, 0], [0.34 * s, 0.32 * s, 0.32 * s]);
  if (withOutline) outline(skull, 0.026);

  const earL = g(head, -0.31 * s, -0.02 * s, 0);
  const earR = g(head, 0.31 * s, -0.02 * s, 0);
  for (const [ear, sx] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    const e = mesh(ear, GEO.sphere, plain, [0, -0.08 * s, 0], [0.11 * s, 0.21 * s, 0.08 * s], [0, 0, sx * 0.26]);
    if (withOutline) outline(e, 0.02);
  }

  /**
   * Casco. La luz de estado va al FRENTE, sobre la visera, como el foco de un
   * casco de minero: es la señal de juego más importante —dice si te han visto—
   * y en la versión anterior estaba en la coronilla, invisible desde la cámara.
   */
  const helmet = g(head, 0, 0.14 * s, 0);
  const dome = mesh(helmet, GEO.sphere, helmetMat, [0, 0.06 * s, -0.02 * s], [0.37 * s, 0.28 * s, 0.36 * s]);
  if (withOutline) outline(dome, 0.022);
  // Visera hacia delante
  mesh(helmet, GEO.sphere, helmetMat, [0, -0.02 * s, 0.16 * s], [0.34 * s, 0.07 * s, 0.24 * s]);
  // Banda del color del tipo de mascota: refuerza la identificación
  mesh(helmet, GEO.torus, pants, [0, -0.02 * s, 0], [0.37 * s, 0.37 * s, 0.5 * s], [Math.PI / 2, 0, 0]);
  // Foco frontal: soporte oscuro y lente emisiva bien visible
  mesh(helmet, GEO.cylinder, helmetMat, [0, 0.12 * s, 0.24 * s], [0.09 * s, 0.05 * s, 0.09 * s], [Math.PI / 2, 0, 0]);
  const helmetLight = mesh(helmet, GEO.sphere, lightMat, [0, 0.12 * s, 0.31 * s], [0.115 * s, 0.115 * s, 0.09 * s]);
  // Antena con bombilla, que repite el color de estado por si el foco queda oculto
  mesh(helmet, GEO.cylinder, helmetMat, [0, 0.24 * s, -0.06 * s], [0.02 * s, 0.13 * s, 0.02 * s]);
  const beacon = mesh(helmet, GEO.sphere, lightMat, [0, 0.4 * s, -0.06 * s], [0.07 * s, 0.07 * s, 0.07 * s]);

  const armL = g(body, -0.28 * s, 0.14 * s, 0);
  const armR = g(body, 0.28 * s, 0.14 * s, 0);
  const forearms: THREE.Group[] = [];
  for (const [arm, sx] of [
    [armL, -1],
    [armR, 1],
  ] as const) {
    mesh(arm, GEO.sphere, plain, [0, 0, 0], [0.095 * s, 0.095 * s, 0.095 * s]);
    mesh(arm, GEO.capsule, plain, [0, -0.11 * s, 0], [0.07 * s, 0.09 * s, 0.07 * s], [0, 0, sx * 0.06]);
    const forearm = g(arm, 0, -0.23 * s, 0);
    mesh(forearm, GEO.capsule, plain, [0, -0.08 * s, 0], [0.062 * s, 0.08 * s, 0.062 * s]);
    mesh(forearm, GEO.sphere, skin, [0, -0.19 * s, 0], [0.085 * s, 0.08 * s, 0.085 * s]);
    forearms.push(forearm);
  }

  const legL = g(body, -0.15 * s, -0.38 * s, 0);
  const legR = g(body, 0.15 * s, -0.38 * s, 0);
  const shins: THREE.Group[] = [];
  for (const leg of [legL, legR]) {
    mesh(leg, GEO.capsule, pants, [0, -0.07 * s, 0], [0.105 * s, 0.08 * s, 0.105 * s]);
    const shin = g(leg, 0, -0.19 * s, 0);
    mesh(shin, GEO.capsule, plain, [0, -0.05 * s, 0], [0.075 * s, 0.05 * s, 0.075 * s]);
    const foot = mesh(shin, GEO.sphere, dark, [0, -0.15 * s, 0.06 * s], [0.11 * s, 0.065 * s, 0.17 * s]);
    if (withOutline) outline(foot, 0.018);
    shins.push(shin);
  }

  const tail = g(body, 0, 0.04 * s, -0.26 * s);
  mesh(tail, GEO.capsule, plain, [0, 0.08 * s, -0.06 * s], [0.05 * s, 0.12 * s, 0.05 * s], [0.7, 0, 0]);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  return {
    root,
    body,
    head,
    neck,
    armL,
    armR,
    forearmL: forearms[0],
    forearmR: forearms[1],
    legL,
    legR,
    shinL: shins[0],
    shinR: shins[1],
    tail,
    earL,
    earR,
    hand: forearms[1],
    bodyRestY: 0.72 * s,
    extras: { helmet, dome, beacon },
    materials: mats,
    height: 1.2,
    radius: 0.33,
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
    glasses: true,
  });
  const coat = createCelMaterial({ color: 0xf8f8fa, bands: 3 });
  const glassMat = createCelMaterial({ color: 0xa0e0ff, bands: 2, emissive: 0.5, opacity: 0.6, transparent: true });
  const frame = createCelMaterial({ color: 0x30303a, bands: 2 });
  rig.materials.push(coat, glassMat, frame);

  const lab = new THREE.Mesh(GEO.capsule, coat);
  lab.scale.set(0.5, 0.3, 0.48);
  lab.position.set(0, -0.06, 0);
  rig.body.add(lab);

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
