// ===== BENITO ESCAPE — original low-poly character & prop factories =====
import * as THREE from '../lib/three.module.js';

// ---------- toon shading ----------
let _gradientMap = null;
function gradientMap() {
  if (_gradientMap) return _gradientMap;
  const data = new Uint8Array([80, 160, 255]);
  _gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  _gradientMap.needsUpdate = true;
  _gradientMap.minFilter = THREE.NearestFilter;
  _gradientMap.magFilter = THREE.NearestFilter;
  return _gradientMap;
}

export function toonMat(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts });
  return m;
}

function sphere(r, color, sx = 1, sy = 1, sz = 1, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), toonMat(color));
  mesh.scale.set(sx, sy, sz);
  return mesh;
}
function cyl(rt, rb, h, color, seg = 12) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMat(color));
}
function cone(r, h, color, seg = 12) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), toonMat(color));
}

// ---------- blob shadow ----------
export function blobShadow(radius = 0.5) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// ============================================================
// BENITO — chubby grey tabby cat, green eyes, stands upright
// ============================================================
export function makeBenito() {
  const g = new THREE.Group();
  const GREY = 0x9aa1ac, DARK = 0x6b7280, CREAM = 0xe8e4d8, PINK = 0xf2a6b5, GREEN = 0x3ddc84;

  // body (fat!)
  const body = sphere(0.56, GREY, 1.06, 0.95, 0.95);
  body.position.y = 0.6;
  g.add(body);
  const belly = sphere(0.4, CREAM, 1, 0.92, 0.62);
  belly.position.set(0, 0.52, 0.3);
  g.add(belly);
  // tabby stripes (flattened dark blobs on the back)
  for (let i = 0; i < 3; i++) {
    const s = sphere(0.17, DARK, 1.5, 0.4, 0.6);
    s.position.set((i - 1) * 0.24, 0.98, -0.22);
    g.add(s);
  }

  // head
  const head = new THREE.Group();
  head.position.y = 1.34;
  g.add(head);
  head.add(sphere(0.42, GREY, 1.08, 0.95, 0.95));
  // head stripe
  const hs = sphere(0.12, DARK, 1.2, 0.35, 1.4);
  hs.position.set(0, 0.36, 0);
  head.add(hs);
  // ears
  for (const sx of [-1, 1]) {
    const ear = cone(0.15, 0.3, GREY, 4);
    ear.position.set(sx * 0.26, 0.42, 0);
    ear.rotation.z = -sx * 0.25;
    head.add(ear);
    const inner = cone(0.08, 0.16, PINK, 4);
    inner.position.set(sx * 0.25, 0.4, 0.05);
    inner.rotation.z = -sx * 0.25;
    head.add(inner);
  }
  // eyes (big bright green)
  for (const sx of [-1, 1]) {
    const white = sphere(0.115, 0xffffff);
    white.position.set(sx * 0.17, 0.06, 0.34);
    head.add(white);
    const iris = sphere(0.068, GREEN);
    iris.position.set(sx * 0.17, 0.06, 0.415);
    head.add(iris);
    const pupil = sphere(0.032, 0x111111);
    pupil.position.set(sx * 0.17, 0.06, 0.465);
    head.add(pupil);
  }
  // muzzle + nose
  const muzzle = sphere(0.17, CREAM, 1.25, 0.8, 0.8);
  muzzle.position.set(0, -0.14, 0.33);
  head.add(muzzle);
  const nose = sphere(0.05, PINK, 1.2, 0.8, 0.8);
  nose.position.set(0, -0.06, 0.46);
  head.add(nose);

  // legs (stubby)
  for (const sx of [-1, 1]) {
    const leg = cyl(0.13, 0.15, 0.3, GREY);
    leg.position.set(sx * 0.24, 0.15, 0);
    g.add(leg);
    const foot = sphere(0.14, CREAM, 1.1, 0.6, 1.3);
    foot.position.set(sx * 0.24, 0.05, 0.06);
    g.add(foot);
  }

  // arms — right arm holds the net and is the swing pivot
  const armL = new THREE.Group();
  armL.position.set(-0.55, 1.0, 0);
  const armLm = cyl(0.09, 0.11, 0.44, GREY);
  armLm.position.y = -0.2;
  armL.add(armLm);
  const pawL = sphere(0.11, CREAM);
  pawL.position.y = -0.44;
  armL.add(pawL);
  g.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.55, 1.0, 0);
  const armRm = cyl(0.09, 0.11, 0.44, GREY);
  armRm.position.y = -0.2;
  armR.add(armRm);
  const pawR = sphere(0.11, CREAM);
  pawR.position.y = -0.44;
  armR.add(pawR);
  g.add(armR);

  // tail (three chained segments, wags)
  const tail = new THREE.Group();
  tail.position.set(0, 0.55, -0.5);
  let parent = tail;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    const m = cyl(0.09 - i * 0.02, 0.11 - i * 0.02, 0.3, i === 2 ? DARK : GREY);
    m.position.y = 0.15;
    seg.add(m);
    seg.position.y = i === 0 ? 0 : 0.3;
    seg.rotation.x = 0.5;
    parent.add(seg);
    parent = seg;
  }
  g.add(tail);

  // the net (attached to right paw)
  const net = makeNet();
  net.position.set(0, -0.44, 0.1);
  net.rotation.x = Math.PI / 2.4;
  armR.add(net);

  const shadow = blobShadow(0.62);
  g.add(shadow);

  return { group: g, head, armL, armR, tail, net, shadow, body };
}

// ---------- capture net ----------
export function makeNet() {
  const g = new THREE.Group();
  const handle = cyl(0.035, 0.035, 1.0, 0xb5651d);
  handle.position.y = 0.5;
  g.add(handle);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 20), toonMat(0xffd93b));
  ring.position.y = 1.05;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  // spiderweb-style mesh
  const web = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 8),
    new THREE.MeshBasicMaterial({ color: 0xbfe8ff, wireframe: true, transparent: true, opacity: 0.85 })
  );
  web.position.y = 1.05;
  web.rotation.x = Math.PI / 2;
  g.add(web);
  return g;
}

// ============================================================
// RENEGADE PET — small critter with power helmet + colored pants
// pantsColor drives its AI type
// ============================================================
export const PET_COLORS = {
  amarillo: 0xf5c518,
  rojo: 0xe74c3c,
  azul: 0x3498db,
  blanco: 0xecf0f1,
  verde: 0x2ecc71,
};

export function makePet(type = 'amarillo') {
  const g = new THREE.Group();
  const FUR = 0xcaa06a, FURD = 0xa87f4f;
  const pantsColor = PET_COLORS[type] ?? PET_COLORS.amarillo;

  const pants = cyl(0.27, 0.3, 0.26, pantsColor);
  pants.position.y = 0.2;
  g.add(pants);
  const body = sphere(0.29, FUR, 1, 0.95, 0.9);
  body.position.y = 0.42;
  g.add(body);
  const bellyP = sphere(0.18, 0xe8d5b0, 1, 0.8, 0.6);
  bellyP.position.set(0, 0.42, 0.16);
  g.add(bellyP);

  for (const sx of [-1, 1]) {
    const leg = cyl(0.07, 0.09, 0.16, FURD);
    leg.position.set(sx * 0.13, 0.07, 0);
    g.add(leg);
    const arm = cyl(0.05, 0.06, 0.24, FUR);
    arm.position.set(sx * 0.3, 0.42, 0);
    arm.rotation.z = sx * 0.5;
    g.add(arm);
  }

  const head = new THREE.Group();
  head.position.y = 0.78;
  g.add(head);
  head.add(sphere(0.24, FUR));
  for (const sx of [-1, 1]) {
    const ear = sphere(0.08, FURD);
    ear.position.set(sx * 0.2, 0.14, 0);
    head.add(ear);
    const eye = sphere(0.05, 0x111111);
    eye.position.set(sx * 0.09, 0.02, 0.21);
    head.add(eye);
  }
  const snout = sphere(0.1, 0xe8d5b0, 1.2, 0.7, 0.9);
  snout.position.set(0, -0.07, 0.19);
  head.add(snout);

  // power helmet + status light
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat(0x95a5a6)
  );
  helmet.position.y = 0.06;
  head.add(helmet);
  const brim = cyl(0.285, 0.285, 0.05, 0x7f8c8d);
  brim.position.y = 0.08;
  head.add(brim);
  const antenna = cyl(0.02, 0.02, 0.18, 0x555b60);
  antenna.position.y = 0.4;
  head.add(antenna);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x2e86ff });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lightMat);
  light.position.y = 0.52;
  head.add(light);

  const tail = cone(0.05, 0.22, FURD, 6);
  tail.position.set(0, 0.32, -0.28);
  tail.rotation.x = -1.2;
  g.add(tail);

  const shadow = blobShadow(0.34);
  g.add(shadow);

  return { group: g, head, lightMat, shadow };
}

// ============================================================
// BOSS — "Capitán Colmillo", a huge helmeted bulldog
// ============================================================
export function makeBoss() {
  const g = new THREE.Group();
  const FUR = 0x8d6239, FURD = 0x6b4423, CREAM = 0xd9c39a;

  const body = sphere(0.95, FUR, 1.25, 1, 1.15);
  body.position.y = 1.0;
  g.add(body);
  const chest = sphere(0.62, CREAM, 1.1, 0.9, 0.7);
  chest.position.set(0, 0.9, 0.62);
  g.add(chest);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = cyl(0.22, 0.26, 0.6, FURD);
      leg.position.set(sx * 0.62, 0.3, sz * 0.55);
      g.add(leg);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 1.75, 0.85);
  g.add(head);
  head.add(sphere(0.55, FUR, 1.1, 0.95, 0.95));
  // jowls
  for (const sx of [-1, 1]) {
    const jowl = sphere(0.22, CREAM, 1, 1.2, 0.8);
    jowl.position.set(sx * 0.2, -0.28, 0.3);
    head.add(jowl);
    // fangs!
    const fang = cone(0.06, 0.2, 0xffffff, 6);
    fang.position.set(sx * 0.2, -0.32, 0.48);
    head.add(fang);
    // angry eyes
    const eye = sphere(0.09, 0xff3b30);
    eye.position.set(sx * 0.2, 0.12, 0.42);
    head.add(eye);
    const ear = sphere(0.12, FURD);
    ear.position.set(sx * 0.42, 0.35, -0.1);
    head.add(ear);
  }
  const noseB = sphere(0.11, 0x222222, 1.3, 0.8, 0.8);
  noseB.position.set(0, -0.08, 0.55);
  head.add(noseB);

  // oversized spiked helmet + light
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat(0x707b7c)
  );
  helmet.position.y = 0.15;
  head.add(helmet);
  for (let i = 0; i < 4; i++) {
    const spike = cone(0.07, 0.22, 0xbdc3c7, 6);
    const a = (i / 4) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.45, 0.5, Math.sin(a) * 0.45);
    head.add(spike);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), lightMat);
  light.position.y = 0.85;
  head.add(light);

  const tailB = cone(0.1, 0.3, FURD, 6);
  tailB.position.set(0, 1.1, -1.15);
  tailB.rotation.x = -1.4;
  g.add(tailB);

  const shadow = blobShadow(1.35);
  g.add(shadow);

  g.scale.setScalar(1.5);
  return { group: g, head, lightMat, shadow };
}

// ============================================================
// PROPS
// ============================================================
export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = cyl(0.16, 0.24, 1.6, 0x8b5a2b);
  trunk.position.y = 0.8;
  g.add(trunk);
  const f1 = sphere(0.85, 0x3fa34d);
  f1.position.y = 1.9;
  g.add(f1);
  const f2 = sphere(0.6, 0x54b948);
  f2.position.set(0.4, 2.3, 0.15);
  g.add(f2);
  g.scale.setScalar(scale);
  return g;
}

export function makePalm(scale = 1) {
  const g = new THREE.Group();
  const trunk = cyl(0.12, 0.2, 2.2, 0x9a6b3f);
  trunk.position.y = 1.1;
  trunk.rotation.z = 0.15;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = cone(0.16, 1.3, 0x2e8b57, 5);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(0.33 + Math.cos(a) * 0.5, 2.25, Math.sin(a) * 0.5);
    leaf.rotation.set(Math.sin(a) * 1.35, 0, -Math.cos(a) * 1.35);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeFern(scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const leaf = cone(0.09, 0.9, 0x4caf50, 4);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.18, 0.4, Math.sin(a) * 0.18);
    leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    g.add(leaf);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeRock(scale = 1, color = 0x8d99ae) {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), toonMat(color));
  m.position.y = 0.35 * scale;
  m.scale.setScalar(scale);
  m.rotation.y = Math.random() * Math.PI;
  return m;
}

export function makeBone(scale = 1) {
  const g = new THREE.Group();
  const shaft = cyl(0.09, 0.09, 1.4, 0xf5f0e1);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const knob = sphere(0.15, 0xf5f0e1);
      knob.position.set(sx * 0.7, sy * 0.1, 0);
      g.add(knob);
    }
  }
  g.position.y = 0.16;
  g.rotation.y = Math.random() * Math.PI;
  g.scale.setScalar(scale);
  return g;
}

export function makeVolcano(scale = 1) {
  const g = new THREE.Group();
  const bodyV = cone(3.2, 4.2, 0x5d4037, 9);
  bodyV.position.y = 2.1;
  g.add(bodyV);
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 0.3, 9),
    new THREE.MeshBasicMaterial({ color: 0xff5722 })
  );
  glow.position.y = 4.1;
  g.add(glow);
  g.scale.setScalar(scale);
  return g;
}

export function makeCookie() {
  const g = new THREE.Group();
  const base = cyl(0.24, 0.24, 0.09, 0xd8963c, 14);
  g.add(base);
  for (let i = 0; i < 5; i++) {
    const chip = sphere(0.045, 0x5d3a1a);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.15;
    chip.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    g.add(chip);
  }
  g.rotation.x = 0.3;
  return g;
}

export function makeFlag() {
  const g = new THREE.Group();
  const pole = cyl(0.05, 0.05, 2.2, 0xcccccc);
  pole.position.y = 1.1;
  g.add(pole);
  const flagMat = toonMat(0xe74c3c);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.04), flagMat);
  flag.position.set(0.42, 1.85, 0);
  g.add(flag);
  return { group: g, flagMat };
}

export function makePortal() {
  const g = new THREE.Group();
  const ringMat = toonMat(0xffc93b);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.16, 10, 28), ringMat);
  ring.position.y = 1.8;
  g.add(ring);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x59d4ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.36, 28), discMat);
  disc.position.y = 1.8;
  g.add(disc);
  // little pedestal
  const ped = cyl(1.0, 1.25, 0.3, 0x9b7653);
  ped.position.y = 0.15;
  g.add(ped);
  return { group: g, ring, ringMat, discMat };
}

export function makeCloud(scale = 1) {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sizes = [[0, 0, 0, 1], [0.9, 0.1, 0.2, 0.7], [-0.85, 0.05, -0.1, 0.75], [0.3, 0.4, 0, 0.6]];
  for (const [x, y, z, s] of sizes) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 10, 8), white);
    b.position.set(x, y, z);
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeProjectile() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5533 })
  );
}

export function makeSparkle(color = 0xffe066) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 5),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
  );
}

// ---------- ground texture (retro pixel blotches) ----------
export function makeGroundTexture(base, blotches, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = blotches[Math.floor(Math.random() * blotches.length)];
    const s = 2 + Math.random() * 5;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
