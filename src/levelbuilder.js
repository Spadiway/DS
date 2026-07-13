// ===== BENITO ESCAPE — builds a playable scene from a level definition =====
import * as THREE from '../lib/three.module.js';
import {
  toonMat, makeTree, makePalm, makeFern, makeRock, makeBone, makeVolcano,
  makeCookie, makeFlag, makePortal, makeCloud, makeGroundTexture,
  makeGrass, makeFlower, makeMushroom, makeCrystal, makeHill,
  makeSkyDome, makeSunSprite, enableShadows,
} from './models.js';
import { THEMES } from './levels.js';

const DECO_FACTORIES = {
  tree: makeTree, palm: makePalm, fern: makeFern,
  rock: makeRock, bone: makeBone, volcano: makeVolcano,
};

// deterministic per-level RNG so scenery is stable between runs
function seededRng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h |= 0; h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLevel(def, scene, levelId = 'x', maxAnisotropy = 4) {
  const theme = THEMES[def.theme];
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);

  const W = def.bounds.maxX - def.bounds.minX;
  const D = def.bounds.maxZ - def.bounds.minZ;
  const cx = (def.bounds.minX + def.bounds.maxX) / 2;
  const cz = (def.bounds.minZ + def.bounds.maxZ) / 2;

  // ---- sky dome + sun sprite ----
  const dome = makeSkyDome(theme.skyTop, theme.skyHorizon);
  dome.position.set(cx, 0, cz);
  scene.add(dome);
  const sunDir = new THREE.Vector3(0.55, 0.8, 0.35).normalize();
  const sunSprite = makeSunSprite();
  sunSprite.position.copy(sunDir).multiplyScalar(140).add(new THREE.Vector3(cx, 0, cz));
  sunSprite.scale.setScalar(48);
  scene.add(sunSprite);

  // ---- lights (with real-time shadows) ----
  const hemi = new THREE.HemisphereLight(theme.sky, 0x554433, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, 1.55);
  sun.position.set(cx + sunDir.x * 55, sunDir.y * 55, cz + sunDir.z * 55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const span = Math.max(W, D) * 0.62;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 130;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(cx, 0, cz);
  scene.add(sun);
  scene.add(sun.target);

  // ---- ground ----
  const tex = makeGroundTexture(theme.groundBase, theme.groundBlotch);
  tex.repeat.set(W / 10, D / 10);
  tex.anisotropy = maxAnisotropy;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 90, D + 90),
    new THREE.MeshToonMaterial({ map: tex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- border hills ring (just outside the playable bounds) ----
  const rng = seededRng(levelId + ':' + def.theme);
  const step = 11;
  const ring = [];
  for (let x = def.bounds.minX - 8; x <= def.bounds.maxX + 8; x += step) {
    ring.push([x + (rng() - 0.5) * 6, def.bounds.minZ - 8 - rng() * 10]);
    ring.push([x + (rng() - 0.5) * 6, def.bounds.maxZ + 8 + rng() * 10]);
  }
  for (let z = def.bounds.minZ - 8; z <= def.bounds.maxZ + 8; z += step) {
    ring.push([def.bounds.minX - 8 - rng() * 10, z + (rng() - 0.5) * 6]);
    ring.push([def.bounds.maxX + 8 + rng() * 10, z + (rng() - 0.5) * 6]);
  }
  for (const [hx, hz] of ring) {
    const hill = makeHill(2.5 + rng() * 4.5, theme.hill);
    hill.position.x = hx;
    hill.position.z = hz;
    scene.add(hill);
  }

  // ---- platforms (colliders) ----
  const colliders = [];
  for (const p of def.platforms) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), toonMat(p.color));
    mesh.position.set(p.x, p.y, p.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({
      minX: p.x - p.w / 2, maxX: p.x + p.w / 2,
      minY: p.y - p.h / 2, maxY: p.y + p.h / 2,
      minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2,
    });
  }

  // ---- decorations ----
  for (const d of def.decos) {
    const make = DECO_FACTORIES[d.t];
    if (!make) continue;
    const mesh = make(d.s ?? 1);
    mesh.position.x = d.x;
    mesh.position.z = d.z;
    enableShadows(mesh);
    scene.add(mesh);
  }

  // ---- scattered small details (grass, flowers, mushrooms, crystals…) ----
  const detailFactories = {
    grass: (s) => makeGrass(s),
    drygrass: (s) => makeGrass(s, 0xc2a24a),
    flower: makeFlower,
    mushroom: makeMushroom,
    crystal: makeCrystal,
    fern: makeFern,
    rock: (s) => makeRock(s * 0.5),
  };
  const blocked = (x, z) => {
    if (inCircleZone(def.lavas, x, z) || inCircleZone(def.waters, x, z)) return true;
    for (const c of colliders) {
      if (x > c.minX - 0.6 && x < c.maxX + 0.6 && z > c.minZ - 0.6 && z < c.maxZ + 0.6) return true;
    }
    const nearPts = [def.spawn, def.exit, ...def.checkpoints];
    for (const p of nearPts) {
      const dx = x - p[0], dz = z - p[1];
      if (dx * dx + dz * dz < 12) return true;
    }
    return false;
  };
  for (let i = 0; i < 56; i++) {
    const x = def.bounds.minX + 2 + rng() * (W - 4);
    const z = def.bounds.minZ + 2 + rng() * (D - 4);
    if (blocked(x, z)) continue;
    let pick = rng();
    let kind = theme.details[theme.details.length - 1][0];
    for (const [name, w] of theme.details) {
      if (pick < w) { kind = name; break; }
      pick -= w;
    }
    const mesh = detailFactories[kind](0.7 + rng() * 0.7);
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.rotation.y = rng() * Math.PI * 2;
    scene.add(mesh);
  }

  // ---- lava pools ----
  const lavaMats = [];
  for (const l of def.lavas) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(l.r, 22), mat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(l.x, 0.05, l.z);
    scene.add(pool);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(l.r, l.r + 0.5, 22),
      new THREE.MeshBasicMaterial({ color: 0x7a2a08 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(l.x, 0.04, l.z);
    scene.add(rim);
    lavaMats.push(mat);
  }

  // ---- water ponds (with animated ripple rings) ----
  const waterMats = [];
  const ripples = [];
  for (const w of def.waters) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a86c8, transparent: true, opacity: 0.75 });
    const pond = new THREE.Mesh(new THREE.CircleGeometry(w.r, 24), mat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(w.x, 0.05, w.z);
    scene.add(pond);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(w.r, w.r + 0.4, 24),
      new THREE.MeshBasicMaterial({ color: 0x5d6a30 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(w.x, 0.04, w.z);
    scene.add(rim);
    waterMats.push(mat);
    const rip = new THREE.Mesh(
      new THREE.RingGeometry(w.r * 0.5, w.r * 0.56, 24),
      new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.4, depthWrite: false })
    );
    rip.rotation.x = -Math.PI / 2;
    rip.position.set(w.x, 0.07, w.z);
    scene.add(rip);
    ripples.push({ mesh: rip, t: Math.random() * 1.6 });
  }

  // ---- cookies ----
  const cookies = [];
  for (const c of def.cookies) {
    const mesh = makeCookie();
    const y = c[2] !== undefined ? c[2] : 0;
    mesh.position.set(c[0], y + 0.5, c[1]);
    enableShadows(mesh);
    scene.add(mesh);
    cookies.push({ mesh, taken: false, baseY: y + 0.5 });
  }

  // ---- checkpoints ----
  const checkpoints = [];
  for (const cp of def.checkpoints) {
    const { group, flagMat } = makeFlag();
    group.position.set(cp[0], groundYAt(colliders, cp[0], cp[1]), cp[1]);
    enableShadows(group);
    scene.add(group);
    checkpoints.push({ x: cp[0], z: cp[1], flagMat, active: false });
  }

  // ---- exit portal ----
  const portal = makePortal();
  portal.group.position.set(def.exit[0], groundYAt(colliders, def.exit[0], def.exit[1]), def.exit[1]);
  enableShadows(portal.group);
  scene.add(portal.group);

  // ---- sky clouds ----
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const cl = makeCloud(1.4 + rng() * 1.6);
    cl.position.set(def.bounds.minX + rng() * W, 16 + rng() * 8, def.bounds.minZ + rng() * D);
    scene.add(cl);
    clouds.push(cl);
  }

  return { colliders, lavaMats, waterMats, ripples, cookies, checkpoints, portal, clouds, theme };
}

/** Highest walkable surface at (x, z) for a standing character. */
export function groundYAt(colliders, x, z, fromY = Infinity) {
  let y = 0;
  for (const c of colliders) {
    if (x >= c.minX - 0.05 && x <= c.maxX + 0.05 && z >= c.minZ - 0.05 && z <= c.maxZ + 0.05) {
      if (c.maxY <= fromY + 0.45 && c.maxY > y) y = c.maxY;
    }
  }
  return y;
}

/** Push a sphere of `radius` at (pos.x, pos.z, height y) out of collider walls. */
export function resolveWalls(colliders, pos, radius, feetY) {
  for (const c of colliders) {
    // ignore if we're standing on top (or box is far below/above)
    if (feetY >= c.maxY - 0.25 || feetY + 1.2 <= c.minY) continue;
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        pos.x = nx + (dx / dist) * radius;
        pos.z = nz + (dz / dist) * radius;
      } else {
        // center inside the box — push out along the smallest penetration axis
        const pens = [
          { d: pos.x - c.minX + radius, x: -1, z: 0 },
          { d: c.maxX - pos.x + radius, x: 1, z: 0 },
          { d: pos.z - c.minZ + radius, x: 0, z: -1 },
          { d: c.maxZ - pos.z + radius, x: 0, z: 1 },
        ];
        pens.sort((a, b) => a.d - b.d);
        pos.x += pens[0].x * pens[0].d;
        pos.z += pens[0].z * pens[0].d;
      }
    }
  }
}

export function inCircleZone(zones, x, z) {
  for (const zn of zones) {
    const dx = x - zn.x, dz = z - zn.z;
    if (dx * dx + dz * dz < zn.r * zn.r) return zn;
  }
  return null;
}
