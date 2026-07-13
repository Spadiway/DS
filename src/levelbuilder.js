// ===== BENITO ESCAPE — builds a playable scene from a level definition =====
import * as THREE from '../lib/three.module.js';
import {
  toonMat, makeTree, makePalm, makeFern, makeRock, makeBone, makeVolcano,
  makeCookie, makeFlag, makePortal, makeCloud, makeGroundTexture,
} from './models.js';
import { THEMES } from './levels.js';

const DECO_FACTORIES = {
  tree: makeTree, palm: makePalm, fern: makeFern,
  rock: makeRock, bone: makeBone, volcano: makeVolcano,
};

export function buildLevel(def, scene) {
  const theme = THEMES[def.theme];
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(theme.sky, 0x554433, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, 1.6);
  sun.position.set(18, 30, 12);
  scene.add(sun);

  // ---- ground ----
  const W = def.bounds.maxX - def.bounds.minX;
  const D = def.bounds.maxZ - def.bounds.minZ;
  const tex = makeGroundTexture(theme.groundBase, theme.groundBlotch);
  tex.repeat.set(W / 7, D / 7);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 70, D + 70),
    new THREE.MeshToonMaterial({ map: tex })
  );
  ground.material.gradientMap = null;
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((def.bounds.minX + def.bounds.maxX) / 2, 0, (def.bounds.minZ + def.bounds.maxZ) / 2);
  scene.add(ground);

  // ---- platforms (colliders) ----
  const colliders = [];
  for (const p of def.platforms) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), toonMat(p.color));
    mesh.position.set(p.x, p.y, p.z);
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

  // ---- water ponds ----
  const waterMats = [];
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
  }

  // ---- cookies ----
  const cookies = [];
  for (const c of def.cookies) {
    const mesh = makeCookie();
    const y = c[2] !== undefined ? c[2] : 0;
    mesh.position.set(c[0], y + 0.5, c[1]);
    scene.add(mesh);
    cookies.push({ mesh, taken: false, baseY: y + 0.5 });
  }

  // ---- checkpoints ----
  const checkpoints = [];
  for (const cp of def.checkpoints) {
    const { group, flagMat } = makeFlag();
    group.position.set(cp[0], groundYAt(colliders, cp[0], cp[1]), cp[1]);
    scene.add(group);
    checkpoints.push({ x: cp[0], z: cp[1], flagMat, active: false });
  }

  // ---- exit portal ----
  const portal = makePortal();
  portal.group.position.set(def.exit[0], groundYAt(colliders, def.exit[0], def.exit[1]), def.exit[1]);
  scene.add(portal.group);

  // ---- sky clouds ----
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const cl = makeCloud(1.4 + Math.random() * 1.6);
    cl.position.set(
      def.bounds.minX + Math.random() * W,
      16 + Math.random() * 8,
      def.bounds.minZ + Math.random() * D
    );
    scene.add(cl);
    clouds.push(cl);
  }

  return { colliders, lavaMats, waterMats, cookies, checkpoints, portal, clouds, theme };
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
