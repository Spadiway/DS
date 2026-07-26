/**
 * IA de las mascotas renegadas.
 *
 * Sistema de alerta de tres estados señalizado por la luz del casco:
 *   AZUL   → tranquila, patrulla o juega
 *   AMARILLO → sospecha, mira hacia el ruido
 *   ROJA   → te ha visto: huye o ataca según su color de pantalón
 *
 * Cada color de pantalón define un patrón distinto, así que cada mascota es un
 * pequeño puzle de aproximación y sincronización, no un enemigo cualquiera.
 */
import * as THREE from 'three';
import { buildPet, type PetRig } from './models';
import { createActor, hasLineOfSight, moveActor, type Actor, type CollisionWorld } from './physics';
import { createAnimState, poseCaptured, poseStunned, updateAnim, type AnimState } from './anim';
import { clamp, damp } from './mathx';
import { sfx } from '../core/audio';
import type { PetColor } from '../content/worlds';

export type AlertLevel = 0 | 1 | 2;

export type PetBehavior = {
  speed: number;
  runSpeed: number;
  sightRange: number;
  sightAngle: number;
  hearRange: number;
  /** Cuánto tarda en pasar de sospecha a alerta. */
  suspicionRate: number;
  calmRate: number;
  /** 'flee' huye, 'charge' embiste, 'ranged' dispara. */
  reaction: 'flee' | 'charge' | 'ranged';
  /** Probabilidad de esquivar el red-swing estando en alerta roja. */
  dodgeChance: number;
  stunResist: number;
  jumpy: boolean;
};

export const PET_BEHAVIOR: Record<PetColor, PetBehavior> = {
  yellow: {
    speed: 2.4,
    runSpeed: 6.2,
    sightRange: 13,
    sightAngle: 1.0,
    hearRange: 8,
    suspicionRate: 1.0,
    calmRate: 0.5,
    reaction: 'flee',
    dodgeChance: 0.1,
    stunResist: 1,
    jumpy: false,
  },
  red: {
    speed: 2.8,
    runSpeed: 8.0,
    sightRange: 16,
    sightAngle: 1.15,
    hearRange: 11,
    suspicionRate: 1.6,
    calmRate: 0.35,
    reaction: 'charge',
    dodgeChance: 0.18,
    stunResist: 1.5,
    jumpy: false,
  },
  blue: {
    speed: 3.6,
    runSpeed: 10.5,
    sightRange: 15,
    sightAngle: 1.25,
    hearRange: 10,
    suspicionRate: 1.4,
    calmRate: 0.6,
    reaction: 'flee',
    dodgeChance: 0.45,
    stunResist: 0.8,
    jumpy: true,
  },
  white: {
    speed: 2.6,
    runSpeed: 7.4,
    sightRange: 22,
    sightAngle: 1.6,
    hearRange: 16,
    suspicionRate: 2.6,
    calmRate: 0.25,
    reaction: 'flee',
    dodgeChance: 0.3,
    stunResist: 1.2,
    jumpy: false,
  },
  green: {
    speed: 2.2,
    runSpeed: 5.6,
    sightRange: 24,
    sightAngle: 1.1,
    hearRange: 9,
    suspicionRate: 1.5,
    calmRate: 0.4,
    reaction: 'ranged',
    dodgeChance: 0.12,
    stunResist: 1.3,
    jumpy: false,
  },
};

const ALERT_COLORS = [0x40a0ff, 0xffd23f, 0xff3a3a];
const ALERT_COLORS_CB = [0x0060ff, 0xffffff, 0xff00c0]; // modo daltónico: azul / blanco / magenta

export type Pet = {
  id: number;
  color: PetColor;
  rig: PetRig;
  actor: Actor;
  anim: AnimState;
  behavior: PetBehavior;
  alert: AlertLevel;
  suspicion: number;
  yaw: number;
  patrol: THREE.Vector3[];
  patrolIndex: number;
  waitTimer: number;
  stunTimer: number;
  captured: boolean;
  captureProgress: number;
  attackCooldown: number;
  chatterTimer: number;
  lastKnownPlayer: THREE.Vector3;
  fleeTimer: number;
  dodgeTimer: number;
  frozen: number;
  home: THREE.Vector3;
  isBoss: boolean;
  hp: number;
  maxHp: number;
};

let nextPetId = 1;

export function createPet(color: PetColor, pos: THREE.Vector3, patrol: THREE.Vector3[], withOutline: boolean): Pet {
  const rig = buildPet(color, withOutline);
  const actor = createActor(0.42, 1.1);
  actor.position.copy(pos);
  rig.root.position.copy(pos);
  return {
    id: nextPetId++,
    color,
    rig,
    actor,
    anim: createAnimState(),
    behavior: PET_BEHAVIOR[color],
    alert: 0,
    suspicion: 0,
    yaw: Math.random() * Math.PI * 2,
    patrol,
    patrolIndex: 0,
    waitTimer: Math.random() * 2,
    stunTimer: 0,
    captured: false,
    captureProgress: 0,
    attackCooldown: 0,
    chatterTimer: Math.random() * 6,
    lastKnownPlayer: new THREE.Vector3(),
    fleeTimer: 0,
    dodgeTimer: 0,
    frozen: 0,
    home: pos.clone(),
    isBoss: false,
    hp: 1,
    maxHp: 1,
  };
}

const toPlayer = new THREE.Vector3();
const forward = new THREE.Vector3();
const desired = new THREE.Vector3();
const eyePos = new THREE.Vector3();
const playerEye = new THREE.Vector3();

export type PetSenseContext = {
  playerPos: THREE.Vector3;
  playerNoise: number;
  playerVisible: boolean;
  colorBlindSafe: boolean;
};

export type PetUpdateResult = {
  attacked: boolean;
  projectile: { from: THREE.Vector3; dir: THREE.Vector3 } | null;
  alertChanged: boolean;
};

export function updatePet(
  pet: Pet,
  world: CollisionWorld,
  ctx: PetSenseContext,
  dt: number,
  gravity: number,
): PetUpdateResult {
  const result: PetUpdateResult = { attacked: false, projectile: null, alertChanged: false };

  if (pet.captured) {
    pet.captureProgress += dt * 2.4;
    poseCaptured(pet.rig, pet.captureProgress);
    return result;
  }

  // Congelación temporal: la mascota se detiene por completo
  if (pet.frozen > 0) {
    pet.frozen -= dt;
    pet.rig.root.position.copy(pet.actor.position);
    return result;
  }

  const b = pet.behavior;
  pet.chatterTimer -= dt;
  pet.attackCooldown = Math.max(0, pet.attackCooldown - dt);
  pet.dodgeTimer = Math.max(0, pet.dodgeTimer - dt);

  // ── Aturdida ──
  if (pet.stunTimer > 0) {
    pet.stunTimer -= dt;
    pet.actor.velocity.x = damp(pet.actor.velocity.x, 0, 8, dt);
    pet.actor.velocity.z = damp(pet.actor.velocity.z, 0, 8, dt);
    moveActor(world, pet.actor, dt, gravity, 0.5);
    pet.rig.root.position.copy(pet.actor.position);
    poseStunned(pet.rig, pet.anim, dt);
    setHelmetColor(pet, 1, ctx.colorBlindSafe, dt, true);
    return result;
  }

  // ── Percepción ──
  toPlayer.copy(ctx.playerPos).sub(pet.actor.position);
  const dist = toPlayer.length();
  forward.set(Math.sin(pet.yaw), 0, Math.cos(pet.yaw));
  const flat = toPlayer.clone().setY(0).normalize();
  const facing = dist > 0.01 ? forward.dot(flat) : 1;
  const angleOk = Math.acos(clamp(facing, -1, 1)) < b.sightAngle;

  eyePos.copy(pet.actor.position).addScalar(0);
  eyePos.y += 0.9;
  playerEye.copy(ctx.playerPos);
  playerEye.y += 0.8;

  let seen = false;
  if (ctx.playerVisible && dist < b.sightRange && angleOk) {
    seen = hasLineOfSight(world, eyePos, playerEye);
  }
  // El oído no depende del ángulo: correr te delata aunque no te vean
  const heard = dist < b.hearRange * ctx.playerNoise;

  const prevAlert = pet.alert;
  if (seen || heard) {
    const closeness = 1 - clamp(dist / b.sightRange, 0, 1);
    pet.suspicion += dt * b.suspicionRate * (seen ? 1 + closeness : 0.55) * ctx.playerNoise;
    pet.lastKnownPlayer.copy(ctx.playerPos);
  } else {
    pet.suspicion -= dt * b.calmRate;
  }
  pet.suspicion = clamp(pet.suspicion, 0, 2.2);
  pet.alert = pet.suspicion > 1.35 ? 2 : pet.suspicion > 0.45 ? 1 : 0;

  if (pet.alert !== prevAlert) {
    result.alertChanged = true;
    if (pet.alert === 2 && dist < 30) sfx('petAlert');
    else if (pet.alert === 1 && dist < 24) sfx('petSuspect');
    if (pet.alert === 2) pet.fleeTimer = 4.5;
  }
  if (pet.alert === 2) pet.fleeTimer = Math.max(pet.fleeTimer, 2.4);
  pet.fleeTimer = Math.max(0, pet.fleeTimer - dt);

  setHelmetColor(pet, pet.alert, ctx.colorBlindSafe, dt, false);

  // Parloteo ambiental
  if (pet.chatterTimer <= 0) {
    pet.chatterTimer = 4 + Math.random() * 8;
    if (dist < 22 && pet.alert === 0) sfx('petChatter');
  }

  // ── Decisión de movimiento ──
  desired.set(0, 0, 0);
  let speed = b.speed;

  if (pet.alert === 2) {
    speed = b.runSpeed;
    if (b.reaction === 'charge') {
      // Embiste al jugador
      desired.copy(toPlayer).setY(0).normalize();
      if (dist < 1.9 && pet.attackCooldown <= 0) {
        pet.attackCooldown = 1.5;
        result.attacked = true;
        pet.actor.velocity.y = 5;
      }
      if (dist < 4) speed *= 1.25;
    } else if (b.reaction === 'ranged') {
      // Mantiene distancia y dispara misiles
      const ideal = 12;
      const sign = dist < ideal - 2 ? -1 : dist > ideal + 3 ? 1 : 0;
      desired.copy(toPlayer).setY(0).normalize().multiplyScalar(sign);
      // Deriva lateral para hacerse difícil
      desired.x += -flat.z * 0.6;
      desired.z += flat.x * 0.6;
      if (desired.lengthSq() > 0.001) desired.normalize();
      speed = b.speed * 1.6;
      if (pet.attackCooldown <= 0 && dist < 26 && seen) {
        pet.attackCooldown = 2.2;
        result.projectile = {
          from: eyePos.clone(),
          dir: playerEye.clone().sub(eyePos).normalize(),
        };
      }
    } else {
      // Huye en dirección contraria, buscando espacio abierto
      desired.copy(toPlayer).setY(0).normalize().multiplyScalar(-1);
      // Zigzag para dificultar la red
      const wobble = Math.sin(pet.anim.t * 6 + pet.id) * 0.7;
      desired.x += -flat.z * wobble;
      desired.z += flat.x * wobble;
      if (desired.lengthSq() > 0.001) desired.normalize();
      if (b.jumpy && pet.actor.onGround && Math.random() < dt * 1.6) {
        pet.actor.velocity.y = 9;
      }
    }
  } else if (pet.alert === 1) {
    // Sospecha: se gira hacia el ruido y avanza despacio
    speed = b.speed * 0.55;
    const look = pet.lastKnownPlayer.clone().sub(pet.actor.position).setY(0);
    if (look.lengthSq() > 1) {
      desired.copy(look).normalize().multiplyScalar(0.5);
    }
  } else {
    // Patrulla tranquila
    if (pet.patrol.length > 0) {
      const target = pet.patrol[pet.patrolIndex];
      const d = target.clone().sub(pet.actor.position).setY(0);
      if (d.length() < 2.2) {
        pet.waitTimer -= dt;
        if (pet.waitTimer <= 0) {
          pet.patrolIndex = (pet.patrolIndex + 1) % pet.patrol.length;
          pet.waitTimer = 1 + Math.random() * 2.5;
        }
      } else {
        desired.copy(d).normalize();
      }
    }
    // Salto de juego ocasional
    if (pet.actor.onGround && Math.random() < dt * 0.25) pet.actor.velocity.y = 6;
  }

  // Esquiva reactiva: si está roja y el jugador está muy cerca, da un salto lateral
  if (pet.alert === 2 && dist < 3.6 && pet.dodgeTimer <= 0 && Math.random() < dt * 2.2) {
    pet.dodgeTimer = 1.4;
    const side = Math.random() < 0.5 ? 1 : -1;
    pet.actor.velocity.x += -flat.z * side * 9;
    pet.actor.velocity.z += flat.x * side * 9;
    pet.actor.velocity.y = 6.5;
  }

  const accel = pet.alert === 2 ? 11 : 6;
  pet.actor.velocity.x = damp(pet.actor.velocity.x, desired.x * speed, accel, dt);
  pet.actor.velocity.z = damp(pet.actor.velocity.z, desired.z * speed, accel, dt);

  // Evita ahogarse: si está en líquido, sale hacia tierra
  if (pet.actor.inLiquid) {
    const out = pet.home.clone().sub(pet.actor.position).setY(0);
    if (out.lengthSq() > 0.01) {
      out.normalize();
      pet.actor.velocity.x += out.x * dt * 12;
      pet.actor.velocity.z += out.z * dt * 12;
    }
    pet.actor.velocity.y = Math.max(pet.actor.velocity.y, 1.5);
  }

  moveActor(world, pet.actor, dt, gravity, 0.5);

  const horiz = Math.hypot(pet.actor.velocity.x, pet.actor.velocity.z);
  if (horiz > 0.4) {
    const target = Math.atan2(pet.actor.velocity.x, pet.actor.velocity.z);
    let d = ((target - pet.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    pet.yaw += d * Math.min(1, dt * 9);
  } else if (pet.alert > 0) {
    // Mira hacia donde sospecha
    const target = Math.atan2(pet.lastKnownPlayer.x - pet.actor.position.x, pet.lastKnownPlayer.z - pet.actor.position.z);
    let d = ((target - pet.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    pet.yaw += d * Math.min(1, dt * 4);
  }

  pet.rig.root.position.copy(pet.actor.position);
  pet.rig.root.rotation.y = pet.yaw;

  updateAnim(pet.rig, pet.anim, {
    dt,
    speed: horiz,
    maxSpeed: b.runSpeed,
    onGround: pet.actor.onGround,
    verticalVel: pet.actor.velocity.y,
    crouching: false,
    swimming: false,
  });

  return result;
}

const helmetColor = new THREE.Color();
const targetColor = new THREE.Color();

function setHelmetColor(pet: Pet, level: AlertLevel, colorBlind: boolean, dt: number, stunned: boolean): void {
  const palette = colorBlind ? ALERT_COLORS_CB : ALERT_COLORS;
  targetColor.setHex(stunned ? 0xffffff : palette[level]);
  const mat = pet.rig.helmetMat;
  helmetColor.copy(mat.color);
  helmetColor.lerp(targetColor, Math.min(1, dt * 10));
  mat.color.copy(helmetColor);
  mat.emissive.copy(helmetColor);
  // Parpadeo cuando está alerta: la luz roja debe verse desde lejos
  const pulse = level === 2 ? 1.6 + Math.sin(performance.now() * 0.02) * 0.7 : level === 1 ? 1.3 : 0.9;
  mat.emissiveIntensity = pulse;
  pet.rig.helmetLight.scale.setScalar(0.07 * (1 + (level === 2 ? 0.45 : 0)));
}

/**
 * Intento de captura con la red.
 * Devuelve 'caught', 'dodged' o 'miss'. Una mascota aturdida siempre cae.
 */
export function tryCapture(pet: Pet, from: THREE.Vector3, yaw: number, reach: number, arc: number): 'caught' | 'dodged' | 'miss' {
  if (pet.captured) return 'miss';
  const dx = pet.actor.position.x - from.x;
  const dz = pet.actor.position.z - from.z;
  const dy = pet.actor.position.y - from.y;
  const dist = Math.hypot(dx, dz);
  if (dist > reach + pet.actor.radius || Math.abs(dy) > 2.4) return 'miss';

  const angle = Math.atan2(dx, dz);
  let d = ((angle - yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > arc / 2) return 'miss';

  if (pet.stunTimer > 0 || pet.frozen > 0) return 'caught';
  if (pet.alert === 2 && Math.random() < pet.behavior.dodgeChance) {
    // Salto de esquiva: aterriza lejos y en alerta máxima
    pet.actor.velocity.y = 9;
    const away = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(9);
    pet.actor.velocity.x = away.x;
    pet.actor.velocity.z = away.z;
    pet.suspicion = 2.2;
    return 'dodged';
  }
  return 'caught';
}

export function capturePet(pet: Pet): void {
  pet.captured = true;
  pet.captureProgress = 0;
  sfx('netCatch');
}

export function stunPet(pet: Pet, seconds: number): void {
  pet.stunTimer = Math.max(pet.stunTimer, seconds / pet.behavior.stunResist);
  pet.suspicion = 2.2;
  pet.actor.velocity.set(0, 3, 0);
}

/** El ruido que hace el jugador según cómo se mueva. */
export function playerNoiseLevel(speed: number, crouching: boolean, onGround: boolean): number {
  if (crouching) return 0.25;
  if (!onGround) return 0.55;
  return clamp(0.3 + (speed / 12.4) * 0.95, 0.3, 1.3);
}
