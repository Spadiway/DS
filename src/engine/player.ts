/**
 * Benito: control del jugador. Movimiento relativo a la cámara, doble salto,
 * nado, deslizamiento sobre hielo, agacharse para el sigilo y estados de daño.
 */
import * as THREE from 'three';
import { buildBenito, buildGadgets, type CritterRig, type GadgetModels } from './models';
import { createActor, moveActor, type Actor, type CollisionWorld } from './physics';
import { createAnimState, triggerHurt, triggerSwing, updateAnim, type AnimState } from './anim';
import { clamp, damp } from './mathx';
import type { GadgetId } from '../content/gadgets';
import { GADGETS } from '../content/gadgets';
import { sfx } from '../core/audio';

export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_ENERGY = 100;

export type PlayerState = {
  rig: CritterRig;
  actor: Actor;
  anim: AnimState;
  gadgets: GadgetModels;
  yaw: number;
  health: number;
  energy: number;
  lives: number;
  invuln: number;
  dashTimer: number;
  dashDir: THREE.Vector3;
  hoopTimer: number;
  gadgetCooldown: number;
  currentGadget: GadgetId;
  unlocked: GadgetId[];
  crouching: boolean;
  swimming: boolean;
  floating: boolean;
  jumpsLeft: number;
  coyote: number;
  jumpBuffer: number;
  dead: boolean;
  respawnTimer: number;
  checkpoint: THREE.Vector3;
  freezeTimer: number;
  radarTimer: number;
  lastGroundedPos: THREE.Vector3;
  landedThisFrame: boolean;
};

const WALK_SPEED = 8.2;
const RUN_SPEED = 12.4;
const CROUCH_SPEED = 4.2;
const SWIM_SPEED = 6.4;
const JUMP_VELOCITY = 13.2;
const GRAVITY = 34;
const DASH_SPEED = 28;

export function createPlayer(withOutline: boolean): PlayerState {
  const rig = buildBenito(withOutline);
  const gadgets = buildGadgets();
  // El artefacto se sujeta con la mano derecha
  gadgets.group.position.set(0, -0.12, 0.1);
  gadgets.group.rotation.set(-0.6, 0, 0.3);
  rig.hand.add(gadgets.group);

  return {
    rig,
    actor: createActor(0.62, 1.5),
    anim: createAnimState(),
    gadgets,
    yaw: 0,
    health: PLAYER_MAX_HEALTH,
    energy: PLAYER_MAX_ENERGY,
    lives: 3,
    invuln: 0,
    dashTimer: 0,
    dashDir: new THREE.Vector3(),
    hoopTimer: 0,
    gadgetCooldown: 0,
    currentGadget: 'timeNet',
    unlocked: ['timeNet'],
    crouching: false,
    swimming: false,
    floating: false,
    jumpsLeft: 2,
    coyote: 0,
    jumpBuffer: 0,
    dead: false,
    respawnTimer: 0,
    checkpoint: new THREE.Vector3(),
    freezeTimer: 0,
    radarTimer: 0,
    lastGroundedPos: new THREE.Vector3(),
    landedThisFrame: false,
  };
}

export type PlayerInput = {
  moveX: number;
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  sneak: boolean;
  cameraYaw: number;
};

export type LevelModifiers = {
  slippery: boolean;
  lowGravity: boolean;
  canSwim: boolean;
  liquidDamage: number;
};

const moveDir = new THREE.Vector3();
const desired = new THREE.Vector3();

export function updatePlayer(
  p: PlayerState,
  world: CollisionWorld,
  input: PlayerInput,
  mods: LevelModifiers,
  dt: number,
): void {
  const a = p.actor;
  p.landedThisFrame = false;

  if (p.dead) {
    p.respawnTimer -= dt;
    updateAnim(p.rig, p.anim, {
      dt,
      speed: 0,
      maxSpeed: WALK_SPEED,
      onGround: true,
      verticalVel: 0,
      crouching: false,
      swimming: false,
    });
    p.rig.root.rotation.z = clamp(p.rig.root.rotation.z + dt * 4, 0, Math.PI / 2);
    return;
  }

  p.invuln = Math.max(0, p.invuln - dt);
  p.gadgetCooldown = Math.max(0, p.gadgetCooldown - dt);
  p.freezeTimer = Math.max(0, p.freezeTimer - dt);
  p.radarTimer = Math.max(0, p.radarTimer - dt);

  const wasGround = a.onGround;

  // ── Dirección deseada, relativa a la cámara ──
  const cy = input.cameraYaw;
  moveDir.set(
    input.moveX * Math.cos(cy) - input.moveY * Math.sin(cy),
    0,
    input.moveX * Math.sin(cy) + input.moveY * Math.cos(cy),
  );
  const inputMag = Math.min(1, moveDir.length());
  if (inputMag > 0.001) moveDir.normalize();

  p.swimming = a.inLiquid && mods.canSwim && a.liquidDepth > 0.8;
  // Sin la Red de Agua, Benito no sabe bucear: chapotea en la superficie y ha
  // de volver a tierra. Antes se hundía sin fondo, que era una trampa mortal.
  p.floating = a.inLiquid && !mods.canSwim && mods.liquidDamage <= 0;
  p.crouching = input.sneak && a.onGround && !p.swimming && !p.floating;

  // ── Velocidad objetivo ──
  let targetSpeed = p.crouching ? CROUCH_SPEED : input.sneak ? WALK_SPEED * 0.7 : RUN_SPEED;
  if (p.swimming) targetSpeed = SWIM_SPEED;
  if (p.floating) targetSpeed = SWIM_SPEED * 0.7;
  if (p.dashTimer > 0) targetSpeed = DASH_SPEED;

  desired.copy(moveDir).multiplyScalar(targetSpeed * inputMag);

  // Aceleración: el hielo resbala, el agua frena, el impulso manda
  let accel: number;
  if (p.dashTimer > 0) {
    accel = 40;
    desired.copy(p.dashDir).multiplyScalar(DASH_SPEED);
  } else if (p.swimming || p.floating) {
    accel = 6;
  } else if (!a.onGround) {
    accel = 7;
  } else if (mods.slippery) {
    accel = inputMag > 0.1 ? 3.2 : 1.1;
  } else {
    accel = inputMag > 0.1 ? 16 : 20;
  }

  a.velocity.x = damp(a.velocity.x, desired.x, accel, dt);
  a.velocity.z = damp(a.velocity.z, desired.z, accel, dt);

  // ── Saltos ──
  if (a.onGround) {
    p.coyote = 0.14;
    p.jumpsLeft = 2;
  } else {
    p.coyote = Math.max(0, p.coyote - dt);
  }
  p.jumpBuffer = input.jumpPressed ? 0.16 : Math.max(0, p.jumpBuffer - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);

  if (p.floating) {
    // Empuje hacia la superficie: siempre se puede salir del agua
    const targetY = world.heightfield.liquidLevel - 0.35;
    a.velocity.y = damp(a.velocity.y, clamp((targetY - a.position.y) * 4, -2, 6), 7, dt);
  } else if (p.swimming) {
    // Nadar: flotación hacia la superficie y ascenso con salto
    const targetY = world.heightfield.liquidLevel - 0.7;
    const diff = targetY - a.position.y;
    a.velocity.y = damp(a.velocity.y, clamp(diff * 3, -4, 5) + (input.jumpHeld ? 4 : 0), 5, dt);
  } else if (p.jumpBuffer > 0 && (p.coyote > 0 || p.jumpsLeft > 0)) {
    const isDouble = p.coyote <= 0;
    a.velocity.y = JUMP_VELOCITY * (isDouble ? 0.86 : 1);
    p.jumpsLeft = isDouble ? 0 : 1;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.anim.squash = 1.15;
    sfx('jump');
    if (isDouble) {
      // Voltereta del doble salto
      p.rig.body.rotation.x = -0.9;
    }
  }

  // Salto variable: soltar el botón corta el ascenso
  if (!input.jumpHeld && a.velocity.y > 3 && !p.swimming) a.velocity.y -= 26 * dt;

  // ── Aro Supremo: planeo ──
  if (p.hoopTimer > 0 && !a.onGround && !p.swimming) {
    a.velocity.y = Math.max(a.velocity.y, -1.2);
    if (input.jumpHeld) a.velocity.y = damp(a.velocity.y, 3.4, 4, dt);
    p.hoopTimer -= dt;
  }

  let gravity = GRAVITY * (mods.lowGravity ? 0.58 : 1);
  if (p.swimming || p.floating) gravity = 0;
  if (p.hoopTimer > 0) gravity *= 0.35;

  moveActor(world, a, dt, gravity, 0.62);

  if (!wasGround && a.onGround) {
    p.landedThisFrame = true;
    p.anim.squash = 0.85;
    if (a.velocity.length() > 1) sfx('land');
  }
  if (a.onGround) p.lastGroundedPos.copy(a.position);

  // ── Orientación ──
  const horizSpeed = Math.hypot(a.velocity.x, a.velocity.z);
  if (horizSpeed > 0.6) {
    const target = Math.atan2(a.velocity.x, a.velocity.z);
    let d = ((target - p.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    p.yaw += d * Math.min(1, dt * 14);
  }

  // ── Sincronizar la representación visual ──
  p.rig.root.position.copy(a.position);
  p.rig.root.rotation.y = p.yaw;
  p.rig.root.rotation.z = 0;
  if (p.swimming || p.floating) p.rig.root.rotation.x = 0.4;
  else p.rig.root.rotation.x = damp(p.rig.root.rotation.x, 0, 10, dt);

  updateAnim(p.rig, p.anim, {
    dt,
    speed: horizSpeed,
    maxSpeed: RUN_SPEED,
    onGround: a.onGround,
    verticalVel: a.velocity.y,
    crouching: p.crouching,
    swimming: p.swimming || p.floating,
  });

  // ── Recarga lenta de energía ──
  p.energy = Math.min(PLAYER_MAX_ENERGY, p.energy + dt * 3.4);
}

export function damagePlayer(p: PlayerState, amount: number): boolean {
  if (p.invuln > 0 || p.dead) return false;
  p.health -= amount;
  p.invuln = 1.1;
  triggerHurt(p.anim);
  sfx('hurt');
  p.actor.velocity.y = Math.max(p.actor.velocity.y, 6);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    p.respawnTimer = 1.9;
    p.lives -= 1;
    return true;
  }
  return false;
}

export function healPlayer(p: PlayerState, amount: number): void {
  p.health = Math.min(PLAYER_MAX_HEALTH, p.health + amount);
  p.energy = Math.min(PLAYER_MAX_ENERGY, p.energy + amount);
}

export function respawnPlayer(p: PlayerState, at: THREE.Vector3): void {
  p.dead = false;
  p.health = PLAYER_MAX_HEALTH;
  p.energy = PLAYER_MAX_ENERGY;
  p.actor.position.copy(at);
  p.actor.velocity.set(0, 0, 0);
  p.invuln = 2;
  p.rig.root.rotation.set(0, p.yaw, 0);
  p.rig.root.scale.setScalar(1);
  p.dashTimer = 0;
  p.hoopTimer = 0;
}

/** Cambia el artefacto activo y actualiza el modelo que sostiene Benito. */
export function selectGadget(p: PlayerState, id: GadgetId): void {
  if (!p.unlocked.includes(id)) return;
  p.currentGadget = id;
  for (const key of Object.keys(p.gadgets) as (keyof GadgetModels)[]) {
    if (key === 'group') continue;
    (p.gadgets[key] as THREE.Object3D).visible = key === id;
  }
  sfx('gadgetSwitch');
}

export function cycleGadget(p: PlayerState, dir: number): void {
  if (p.unlocked.length < 2) return;
  const i = p.unlocked.indexOf(p.currentGadget);
  const next = (i + dir + p.unlocked.length) % p.unlocked.length;
  selectGadget(p, p.unlocked[next]);
}

export function unlockGadget(p: PlayerState, id: GadgetId): void {
  if (p.unlocked.includes(id)) return;
  p.unlocked.push(id);
  p.unlocked.sort((a, b) => GADGETS[a].worldUnlock - GADGETS[b].worldUnlock);
}

/** ¿Puede usarse ahora el artefacto activo? */
export function canUseGadget(p: PlayerState): boolean {
  const def = GADGETS[p.currentGadget];
  return p.gadgetCooldown <= 0 && p.energy >= def.cost && !p.dead;
}

/** Consume el artefacto y arranca la animación. Devuelve el tipo de acción. */
export function useGadget(p: PlayerState): 'net' | 'club' | 'dash' | 'punch' | 'hoop' | 'radar' | 'freeze' | null {
  if (!canUseGadget(p)) return null;
  const def = GADGETS[p.currentGadget];
  p.energy -= def.cost;
  p.gadgetCooldown = def.cooldown;

  switch (p.currentGadget) {
    case 'timeNet':
    case 'waterNet':
      triggerSwing(p.anim, 'net', def.duration);
      sfx('netSwing');
      return 'net';
    case 'stunClub':
      triggerSwing(p.anim, 'club', def.duration);
      sfx('clubHit');
      return 'club';
    case 'dashHoop': {
      p.dashTimer = def.duration;
      p.dashDir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      p.actor.velocity.y = Math.max(p.actor.velocity.y, 2.4);
      sfx('dash');
      return 'dash';
    }
    case 'magicPunch':
      triggerSwing(p.anim, 'punch', def.duration);
      sfx('punch');
      return 'punch';
    case 'superHoop':
      p.hoopTimer = 1.4;
      sfx('hoop');
      return 'hoop';
    case 'petRadar':
      p.radarTimer = def.duration;
      sfx('radarPing');
      return 'radar';
    case 'timeFreeze':
      p.freezeTimer = def.duration;
      sfx('freeze');
      return 'freeze';
    default:
      return null;
  }
}

/** Punto de impacto del artefacto (delante de Benito, a la altura del pecho). */
export function gadgetHitPoint(p: PlayerState, out = new THREE.Vector3()): THREE.Vector3 {
  const def = GADGETS[p.currentGadget];
  return out.set(
    p.actor.position.x + Math.sin(p.yaw) * def.reach * 0.6,
    p.actor.position.y + 0.75,
    p.actor.position.z + Math.cos(p.yaw) * def.reach * 0.6,
  );
}
