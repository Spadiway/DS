/**
 * Cámara de seguimiento con órbita manual, colisión contra el escenario,
 * modo de puntería en primera persona y sacudida por impactos.
 */
import * as THREE from 'three';
import { clamp, damp } from './mathx';
import type { CollisionWorld } from './physics';

export type CameraRig = {
  camera: THREE.PerspectiveCamera;
  yaw: number;
  pitch: number;
  distance: number;
  targetDistance: number;
  height: number;
  shake: number;
  shakeTime: number;
  firstPerson: boolean;
  fovBase: number;
  fovTarget: number;
};

export function createCameraRig(aspect: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(58, aspect, 0.15, 900);
  camera.position.set(0, 8, -12);
  return {
    camera,
    yaw: 0,
    pitch: 0.32,
    distance: 8.2,
    targetDistance: 8.2,
    height: 1.85,
    shake: 0,
    shakeTime: 0,
    firstPerson: false,
    fovBase: 58,
    fovTarget: 58,
  };
}

const desiredPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const dir = new THREE.Vector3();

export function updateCamera(
  rig: CameraRig,
  target: THREE.Vector3,
  world: CollisionWorld,
  lookX: number,
  lookY: number,
  dt: number,
  playerYaw: number,
  speedRatio: number,
  screenShakeEnabled: boolean,
): void {
  rig.yaw -= lookX;
  rig.pitch = clamp(rig.pitch + lookY, -0.5, 1.15);

  if (rig.firstPerson) {
    // Puntería en primera persona: la cámara se coloca en la cabeza de Benito
    rig.fovTarget = 74;
    lookTarget.copy(target);
    lookTarget.y += 1.32;
    rig.camera.position.lerp(lookTarget, Math.min(1, dt * 22));
    const pitch = clamp(rig.pitch, -0.9, 0.9);
    dir.set(Math.sin(rig.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(rig.yaw) * Math.cos(pitch));
    lookTarget.copy(rig.camera.position).add(dir);
    rig.camera.lookAt(lookTarget);
  } else {
    // Tercera persona: la distancia crece un poco al correr, como en las
    // plataformas 3D clásicas, para dar sensación de velocidad
    rig.targetDistance = 8.2 + speedRatio * 2.4;
    rig.distance = damp(rig.distance, rig.targetDistance, 4, dt);
    rig.fovTarget = 58 + speedRatio * 8;

    const cosP = Math.cos(rig.pitch);
    desiredPos.set(
      target.x - Math.sin(rig.yaw) * rig.distance * cosP,
      target.y + rig.height + Math.sin(rig.pitch) * rig.distance,
      target.z - Math.cos(rig.yaw) * rig.distance * cosP,
    );

    // Colisión: si el terreno tapa la cámara, se acerca al personaje
    const groundH = world.terrainHeight(desiredPos.x, desiredPos.z) + 1.4;
    if (desiredPos.y < groundH) desiredPos.y = groundH;

    for (const b of world.nearby(desiredPos.x, desiredPos.z, 1.5)) {
      if (!b.solid || b.kind === 'crate') continue;
      const top = b.center.y + b.half.y;
      if (
        desiredPos.y < top + 0.8 &&
        desiredPos.y > b.center.y - b.half.y - 0.8 &&
        Math.abs(desiredPos.x - b.center.x) < b.half.x + 1 &&
        Math.abs(desiredPos.z - b.center.z) < b.half.z + 1
      ) {
        desiredPos.y = top + 1.2;
      }
    }

    rig.camera.position.lerp(desiredPos, Math.min(1, dt * 9));
    lookTarget.set(target.x, target.y + 1.35, target.z);
    // Adelanta ligeramente la mirada en la dirección de Benito
    lookTarget.x += Math.sin(playerYaw) * speedRatio * 1.6;
    lookTarget.z += Math.cos(playerYaw) * speedRatio * 1.6;
    rig.camera.lookAt(lookTarget);
  }

  // Sacudida
  if (rig.shake > 0) {
    rig.shake = Math.max(0, rig.shake - dt * 2.2);
    rig.shakeTime += dt * 40;
    if (screenShakeEnabled) {
      const s = rig.shake * rig.shake * 0.5;
      rig.camera.position.x += Math.sin(rig.shakeTime * 1.7) * s;
      rig.camera.position.y += Math.cos(rig.shakeTime * 2.3) * s;
      rig.camera.rotateZ(Math.sin(rig.shakeTime * 1.1) * s * 0.12);
    }
  }

  rig.camera.fov = damp(rig.camera.fov, rig.fovTarget, 6, dt);
  rig.camera.updateProjectionMatrix();
}

export function shakeCamera(rig: CameraRig, amount: number): void {
  rig.shake = Math.min(2.2, rig.shake + amount);
}
