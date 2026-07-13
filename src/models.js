// Modelos low-poly construidos con primitivas de Three.js.
// Estética caricaturesca: cabezas grandes, cuerpos redondos, colores saturados.

import * as THREE from 'three';

const toon = (color) => new THREE.MeshToonMaterial({ color });

function sphere(r, color, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), toon(color));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
  m.castShadow = true;
  return m;
}

function cone(r, h, color) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), toon(color));
  m.castShadow = true;
  return m;
}

function eyePair(parent, r, color, x, y, z, pupil = true) {
  for (const s of [-1, 1]) {
    const eye = sphere(r, 0xffffff);
    eye.position.set(s * x, y, z);
    parent.add(eye);
    const iris = sphere(r * 0.55, color);
    iris.position.set(s * x, y, z + r * 0.55);
    parent.add(iris);
    if (pupil) {
      const p = sphere(r * 0.26, 0x111111);
      p.position.set(s * x, y, z + r * 0.9);
      parent.add(p);
    }
  }
}

// ---------- BENITO: gato gris atigrado, gordo, ojos verdes ----------
export function buildBenito() {
  const g = new THREE.Group();
  const GRAY = 0x8a8f98, DARK = 0x5c626e, BELLY = 0xd8dbe0;

  const body = sphere(0.55, GRAY, 1.05, 1, 0.95);
  body.position.y = 0.55;
  g.add(body);

  const belly = sphere(0.42, BELLY, 0.9, 0.85, 0.6);
  belly.position.set(0, 0.5, 0.28);
  g.add(belly);

  // rayas atigradas
  for (let i = 0; i < 3; i++) {
    const stripe = box(0.5, 0.09, 0.2, DARK);
    stripe.position.set(0, 0.72 - i * 0.16, -0.42);
    stripe.rotation.x = -0.5;
    g.add(stripe);
  }

  const head = sphere(0.42, GRAY, 1, 0.95, 0.95);
  head.position.y = 1.28;
  g.add(head);

  eyePair(head, 0.11, 0x37d24a, 0.17, 0.08, 0.32);

  const nose = sphere(0.055, 0xe07a9a);
  nose.position.set(0, -0.05, 0.42);
  head.add(nose);

  for (const s of [-1, 1]) {
    const ear = cone(0.13, 0.24, GRAY);
    ear.position.set(s * 0.24, 0.4, 0);
    ear.rotation.z = -s * 0.3;
    head.add(ear);

    const armF = sphere(0.14, GRAY, 1, 1.4, 1);
    armF.position.set(s * 0.52, 0.5, 0.15);
    g.add(armF);

    const leg = sphere(0.17, DARK, 1, 0.8, 1.2);
    leg.position.set(s * 0.26, 0.12, 0.05);
    g.add(leg);
  }

  const tail = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const seg = sphere(0.1 - i * 0.012, i % 2 ? DARK : GRAY);
    seg.position.set(0, i * 0.16, -0.1 - i * 0.1);
    tail.add(seg);
  }
  tail.position.set(0, 0.5, -0.5);
  g.add(tail);
  g.userData.tail = tail;

  return g;
}

// ---------- Red de captura (para la mano de Benito) ----------
export function buildNet() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), toon(0xcf4420));
  handle.position.y = 0.45;
  g.add(handle);
  const ringGeo = new THREE.TorusGeometry(0.28, 0.035, 8, 18);
  const ring = new THREE.Mesh(ringGeo, toon(0xffd23f));
  ring.position.y = 1.05;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const netMat = new THREE.MeshBasicMaterial({ color: 0xbfefff, wireframe: true, transparent: true, opacity: 0.8 });
  const netCone = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.4, 10, 3, true), netMat);
  netCone.position.y = 0.88;
  g.add(netCone);
  return g;
}

// ---------- MASCOTA MINION: con casco de luz (azul/amarillo/rojo) ----------
// type define color de "pantalones" y comportamiento.
export const PET_COLORS = {
  yellow: 0xf5c518,
  red: 0xe23b2e,
  blue: 0x2e7fe2,
  white: 0xf2f2f2,
  green: 0x37b34a
};

export function buildPet(type = 'yellow') {
  const g = new THREE.Group();
  const FUR2 = 0xb98a5a;

  const body = sphere(0.3, FUR2, 1, 1.1, 0.9);
  body.position.y = 0.42;
  g.add(body);

  const pants = sphere(0.31, PET_COLORS[type] ?? PET_COLORS.yellow, 1, 0.6, 0.92);
  pants.position.y = 0.3;
  g.add(pants);

  const head = sphere(0.26, FUR2);
  head.position.y = 0.88;
  g.add(head);

  const muzzle = sphere(0.13, 0xe8cfa8, 1, 0.8, 0.9);
  muzzle.position.set(0, -0.04, 0.2);
  head.add(muzzle);

  eyePair(head, 0.06, 0x442200, 0.11, 0.07, 0.2);

  for (const s of [-1, 1]) {
    const ear = sphere(0.09, FUR2);
    ear.position.set(s * 0.2, 0.2, 0);
    head.add(ear);
    const leg = sphere(0.09, FUR2, 1, 1.3, 1);
    leg.position.set(s * 0.14, 0.1, 0);
    g.add(leg);
    const arm = sphere(0.07, FUR2, 1, 1.4, 1);
    arm.position.set(s * 0.32, 0.5, 0.05);
    g.add(arm);
  }

  // Casco con luz de alarma
  const helmet = sphere(0.2, 0xd8d8e6, 1, 0.7, 1);
  helmet.position.y = 1.06;
  g.add(helmet);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x2ec4f1 });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lightMat);
  light.position.y = 1.2;
  g.add(light);
  g.userData.alarmLight = lightMat;

  const tail = sphere(0.06, FUR2, 1, 1, 2.2);
  tail.position.set(0, 0.35, -0.32);
  g.add(tail);

  return g;
}

// ---------- DEEDEE: chihuahua canela, lengua fuera, capa negra ----------
export function buildDeedee() {
  const g = new THREE.Group();
  const TAN = 0xd98e4a;

  const cape = cone(0.42, 0.72, 0x181828);
  cape.position.y = 0.42;
  g.add(cape);

  const body = sphere(0.24, TAN, 1, 1.05, 0.9);
  body.position.y = 0.52;
  g.add(body);

  const head = sphere(0.3, TAN);
  head.position.y = 0.98;
  g.add(head);

  // orejas enormes de chihuahua
  for (const s of [-1, 1]) {
    const ear = cone(0.13, 0.34, TAN);
    ear.position.set(s * 0.24, 0.3, 0);
    ear.rotation.z = -s * 0.45;
    head.add(ear);
  }

  eyePair(head, 0.07, 0x30100a, 0.12, 0.06, 0.24);

  const muzzle = sphere(0.11, 0xeab377, 1, 0.75, 1);
  muzzle.position.set(0, -0.07, 0.24);
  head.add(muzzle);

  // lengua fuera permanente
  const tongue = box(0.09, 0.02, 0.16, 0xf06a8a);
  tongue.position.set(0.04, -0.15, 0.3);
  tongue.rotation.x = 0.35;
  head.add(tongue);

  // casco de potencia
  const helmet = sphere(0.24, 0x40406a, 1, 0.65, 1);
  helmet.position.y = 1.2;
  g.add(helmet);
  const gem = sphere(0.08, 0xff3355);
  gem.position.y = 1.34;
  g.add(gem);

  return g;
}

// ---------- SILVA: gata gris esbelta ----------
export function buildSilva() {
  const g = new THREE.Group();
  const GRAY = 0x9aa4b2;

  const body = sphere(0.3, GRAY, 0.8, 1.5, 0.8);
  body.position.y = 0.62;
  g.add(body);

  const head = sphere(0.28, GRAY, 1, 0.9, 0.9);
  head.position.y = 1.3;
  g.add(head);

  for (const s of [-1, 1]) {
    const ear = cone(0.1, 0.22, GRAY);
    ear.position.set(s * 0.17, 0.28, 0);
    head.add(ear);
  }

  // ojos finos y verdes
  for (const s of [-1, 1]) {
    const eye = sphere(0.07, 0x35e07c, 1, 0.5, 0.5);
    eye.position.set(s * 0.12, 0.05, 0.24);
    head.add(eye);
  }

  const tail = sphere(0.06, GRAY, 1, 1, 3.4);
  tail.position.set(0, 0.62, -0.4);
  tail.rotation.x = 0.8;
  g.add(tail);

  return g;
}

// ---------- Objetos de nivel ----------
export function buildCookie() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), toon(0xc98a3d));
  c.castShadow = true;
  g.add(c);
  for (let i = 0; i < 5; i++) {
    const chip = sphere(0.035, 0x5a3218);
    const a = (i / 5) * Math.PI * 2;
    chip.position.set(Math.cos(a) * 0.11, 0.05, Math.sin(a) * 0.11);
    g.add(chip);
  }
  return g;
}

export function buildPortal() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.14, 12, 30),
    new THREE.MeshToonMaterial({ color: 0xffd23f, emissive: 0x664400 })
  );
  g.add(ring);
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(0.98, 24),
    new THREE.MeshBasicMaterial({ color: 0x9040ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  g.add(disk);
  g.userData.ring = ring;
  return g;
}

export function buildTree(theme) {
  const g = new THREE.Group();
  const trunkColor = theme === 'ice' ? 0x7a8a99 : 0x7a4a26;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 8), toon(trunkColor));
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  g.add(trunk);
  const foliage = {
    prehistoric: 0x5a9c2e, jungle: 0x2e7d32, beach: 0x4caf50,
    ice: 0xe8f4ff, medieval: 0x4c7a3f, future: 0x35e0c0, finale: 0x8040c0
  }[theme] ?? 0x4caf50;
  for (let i = 0; i < 3; i++) {
    const leaf = sphere(0.55 - i * 0.12, foliage);
    leaf.position.y = 1.35 + i * 0.36;
    g.add(leaf);
  }
  return g;
}

export function buildRock(theme) {
  const color = theme === 'ice' ? 0xbcd9ee : theme === 'future' ? 0x5a6a8a : 0x8d8d84;
  const r = sphere(0.4 + Math.random() * 0.35, color, 1, 0.7, 1);
  const g = new THREE.Group();
  r.position.y = 0.25;
  g.add(r);
  return g;
}
