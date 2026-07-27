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

/**
 * Encuadre.
 *
 * Midiendo los fotogramas del juego de referencia, el horizonte cae en torno
 * al 35 % de la altura de pantalla y la cámara mira hacia abajo apenas 10°:
 * se ve mucho cielo y el escenario se lee en profundidad, hacia delante. Aquí
 * la cámara iba 21° picada y el horizonte quedaba al 14 %, de modo que dos
 * tercios de la pantalla eran una explanada de suelo vacío. Ese encuadre, más
 * que ninguna textura, es lo que hacía que los mundos parecieran desiertos.
 *
 * El campo de visión también baja: 58° verticales es una gran angular que
 * empequeñece todo lo que no esté pegado a la cámara.
 */
export const PITCH_BASE = 0.16;
const FOV = 52;
const HEIGHT_BASE = 1.5;

export function createCameraRig(aspect: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.15, 900);
  camera.position.set(0, 8, -12);
  return {
    camera,
    yaw: 0,
    pitch: PITCH_BASE,
    distance: 8.0,
    targetDistance: 8.0,
    height: HEIGHT_BASE,
    shake: 0,
    shakeTime: 0,
    firstPerson: false,
    fovBase: FOV,
    fovTarget: FOV,
  };
}

const desiredPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const dir = new THREE.Vector3();

/**
 * Acerca la cámara si un prop alto se interpone entre ella y el jugador.
 * Antes se disolvían los objetos cercanos con un tramado, que sobre las hojas
 * de palmera se veía como un damero enorme. Es mejor mover la cámara.
 */
function distanceBlockedBy(
  blockers: { x: number; z: number; r: number; top: number }[],
  targetX: number,
  targetZ: number,
  dirX: number,
  dirZ: number,
  maxDist: number,
  eyeY: number,
): number {
  let best = maxDist;
  for (const b of blockers) {
    if (b.top < eyeY - 0.5) continue; // demasiado bajo para tapar
    // Proyección del centro del prop sobre el rayo cámara-jugador
    const px = b.x - targetX;
    const pz = b.z - targetZ;
    const along = px * dirX + pz * dirZ;
    if (along < 0.5 || along > best) continue;
    const perp = Math.abs(px * dirZ - pz * dirX);
    if (perp > b.r) continue;
    // Se coloca justo delante del obstáculo, pero nunca encima de Benito:
    // por debajo de este mínimo el personaje llena la pantalla y se pierde el
    // contexto del escenario.
    best = Math.max(6, along - b.r * 0.7);
  }
  return best;
}

/**
 * Colisión de cámara contra el terreno.
 *
 * Se marcha por el rayo que va del jugador a la cámara y se mira si el suelo
 * lo corta. La respuesta es levantar la cámara, no acercarla: subir mantiene
 * el plano general —que es lo que se busca— mientras que acortar la distancia
 * planta la cámara en el cogote del personaje y deja la pantalla llena de
 * hierba. Solo cuando la subida necesaria es exagerada (un talud vertical
 * detrás) se cede y se acorta.
 *
 * Devuelve la distancia utilizable y el suelo más alto encontrado, para que
 * quien llama decida cuánto elevar.
 */
function terrainClearance(
  world: CollisionWorld,
  target: THREE.Vector3,
  dirX: number,
  dirZ: number,
  maxDist: number,
): number {
  const steps = 10;
  let ground = -Infinity;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * maxDist;
    ground = Math.max(ground, world.terrainHeight(target.x + dirX * t, target.z + dirZ * t));
  }
  // Margen sobre el terreno para que la cámara no roce la hierba
  return ground + 0.9;
}

/**
 * Cuánto puede subir la cámara sobre su altura nominal para librar el terreno.
 * Es un tope duro: sin él, al bajar una ladera el suelo de detrás quedaba muy
 * por encima del jugador, la cámara lo seguía y el juego pasaba a verse en
 * planta, que es como se veía el nivel 2-1.
 */
const MAX_LIFT = 2.2;

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
  blockers: { x: number; z: number; r: number; top: number }[] = [],
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
    rig.targetDistance = 8.0 + speedRatio * 2.2;

    // Dirección desde el jugador hacia la cámara, en el plano
    const backX = -Math.sin(rig.yaw);
    const backZ = -Math.cos(rig.yaw);
    const clear = distanceBlockedBy(
      blockers,
      target.x,
      target.z,
      backX,
      backZ,
      rig.targetDistance,
      target.y + rig.height,
    );
    // Altura nominal de la cámara con la distancia que se pide
    const nominalY = target.y + rig.height + Math.sin(rig.pitch) * rig.targetDistance;
    const clearGround = terrainClearance(world, target, backX, backZ, rig.targetDistance);
    // Lo que haría falta subir para librar el terreno, y lo que se permite
    const needLift = clearGround - nominalY;
    const overflow = Math.max(0, needLift - MAX_LIFT);
    // Lo que no se puede salvar subiendo se salva acercándose, pero nunca por
    // debajo de cinco metros: más cerca la espalda del gato llena la pantalla.
    const clearTerrain = overflow > 0 ? Math.max(5, rig.targetDistance - overflow * 1.4) : rig.targetDistance;

    // Se entra rápido para no ver el prop, y se sale despacio para no dar tirones
    const wanted = Math.min(rig.targetDistance, clear, clearTerrain);
    const lambda = wanted < rig.distance ? 16 : 3.2;
    rig.distance = damp(rig.distance, wanted, lambda, dt);
    rig.fovTarget = FOV + speedRatio * 7;

    // Cuanto más cerca queda la cámara, más se eleva: evita mirar de frente a
    // la espalda del personaje cuando un árbol la ha empujado hacia dentro.
    const closeness = 1 - Math.min(1, (rig.distance - 6) / 3.5);
    const pitch = rig.pitch + closeness * 0.16;
    const cosP = Math.cos(pitch);
    desiredPos.set(
      target.x - Math.sin(rig.yaw) * rig.distance * cosP,
      target.y + rig.height + closeness * 0.5 + Math.sin(pitch) * rig.distance + clamp(needLift, 0, MAX_LIFT),
      target.z - Math.cos(rig.yaw) * rig.distance * cosP,
    );

    // Colisión final contra el suelo justo bajo la cámara
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
