/**
 * Jefes.
 *
 * Silva y los Guardianes son combates de dos tiempos: aturdir → capturar.
 * Deedee tiene tres fases con patrones distintos, culminando en la captura
 * final con la Red Suprema.
 */
import * as THREE from 'three';
import { buildDeedee, buildGuardian, buildSilva, type CritterRig } from './models';
import { createActor, moveActor, type Actor, type CollisionWorld } from './physics';
import { createAnimState, poseStunned, updateAnim, type AnimState } from './anim';
import { clamp, damp } from './mathx';
import { sfx } from '../core/audio';

export type BossKind = 'silva' | 'guardian' | 'deedee';

export type BossProjectile = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  radius: number;
  damage: number;
  color: number;
  homing: boolean;
};

export type Boss = {
  kind: BossKind;
  rig: CritterRig;
  actor: Actor;
  anim: AnimState;
  hp: number;
  maxHp: number;
  phase: number;
  maxPhase: number;
  yaw: number;
  state: 'intro' | 'idle' | 'chase' | 'attack' | 'recover' | 'stunned' | 'vulnerable' | 'defeated';
  stateTimer: number;
  attackCooldown: number;
  stunTimer: number;
  vulnerableTimer: number;
  invuln: number;
  arena: THREE.Vector3;
  arenaRadius: number;
  projectiles: BossProjectile[];
  defeated: boolean;
  captured: boolean;
  hoverPhase: number;
  slamPending: boolean;
  name: string;
};

const BOSS_STATS: Record<BossKind, { hp: number; phases: number; radius: number; name: string }> = {
  silva: { hp: 3, phases: 1, radius: 18, name: 'Silva' },
  guardian: { hp: 3, phases: 1, radius: 16, name: 'Guardián' },
  deedee: { hp: 9, phases: 3, radius: 24, name: 'Deedee' },
};

export function createBoss(kind: BossKind, arena: THREE.Vector3, withOutline: boolean): Boss {
  const stats = BOSS_STATS[kind];
  const rig = kind === 'silva' ? buildSilva(withOutline) : kind === 'deedee' ? buildDeedee(withOutline) : buildGuardian(withOutline);
  if (kind === 'silva') rig.root.scale.setScalar(1.35);
  if (kind === 'deedee') rig.root.scale.setScalar(1.7);

  const actor = createActor(kind === 'guardian' ? 1.1 : 0.7, kind === 'guardian' ? 2.3 : 1.7);
  actor.position.copy(arena).add(new THREE.Vector3(0, 1, 6));

  return {
    kind,
    rig,
    actor,
    anim: createAnimState(),
    hp: stats.hp,
    maxHp: stats.hp,
    phase: 1,
    maxPhase: stats.phases,
    yaw: Math.PI,
    state: 'intro',
    stateTimer: 1.4,
    attackCooldown: 1.6,
    stunTimer: 0,
    vulnerableTimer: 0,
    invuln: 0,
    arena: arena.clone(),
    arenaRadius: stats.radius,
    projectiles: [],
    defeated: false,
    captured: false,
    hoverPhase: 0,
    slamPending: false,
    name: stats.name,
  };
}

export type BossContext = {
  playerPos: THREE.Vector3;
  world: CollisionWorld;
  gravity: number;
};

export type BossResult = {
  meleeHit: boolean;
  shockwave: THREE.Vector3 | null;
  newProjectiles: BossProjectile[];
  phaseChanged: boolean;
};

const toPlayer = new THREE.Vector3();
const desired = new THREE.Vector3();

export function updateBoss(boss: Boss, ctx: BossContext, dt: number): BossResult {
  const res: BossResult = { meleeHit: false, shockwave: null, newProjectiles: [], phaseChanged: false };

  boss.invuln = Math.max(0, boss.invuln - dt);
  boss.hoverPhase += dt;
  updateProjectiles(boss, ctx, dt);

  if (boss.defeated) {
    boss.stateTimer -= dt;
    boss.rig.root.position.copy(boss.actor.position);
    boss.rig.root.rotation.y += dt * 2.4;
    if (boss.captured) {
      const s = Math.max(0.001, boss.rig.root.scale.x - dt * 1.4);
      boss.rig.root.scale.setScalar(s);
    } else {
      poseStunned(boss.rig, boss.anim, dt);
    }
    return res;
  }

  toPlayer.copy(ctx.playerPos).sub(boss.actor.position);
  const flat = toPlayer.clone().setY(0);
  const flatDist = flat.length();
  if (flatDist > 0.01) flat.divideScalar(flatDist);

  boss.stateTimer -= dt;
  boss.attackCooldown = Math.max(0, boss.attackCooldown - dt);
  desired.set(0, 0, 0);
  let speed = 0;

  switch (boss.state) {
    case 'intro':
      if (boss.stateTimer <= 0) boss.state = 'chase';
      break;

    case 'stunned':
      boss.stunTimer -= dt;
      if (boss.stunTimer <= 0) {
        boss.state = 'vulnerable';
        boss.vulnerableTimer = 3.2;
      }
      break;

    case 'vulnerable':
      boss.vulnerableTimer -= dt;
      if (boss.vulnerableTimer <= 0) {
        boss.state = 'chase';
        boss.attackCooldown = 1.2;
      }
      break;

    case 'chase': {
      speed = bossSpeed(boss);
      desired.copy(flat);
      // Deedee flota y mantiene distancia; los demás persiguen
      if (boss.kind === 'deedee') {
        const ideal = boss.phase === 3 ? 7 : 12;
        desired.multiplyScalar(flatDist > ideal ? 1 : -0.8);
        desired.x += -flat.z * 0.7;
        desired.z += flat.x * 0.7;
        desired.normalize();
      }
      if (boss.attackCooldown <= 0 && flatDist < attackRange(boss)) {
        boss.state = 'attack';
        boss.stateTimer = boss.kind === 'guardian' ? 0.75 : 0.55;
        boss.slamPending = true;
      }
      break;
    }

    case 'attack': {
      speed = bossSpeed(boss) * (boss.kind === 'silva' ? 1.7 : 0.4);
      desired.copy(flat);
      if (boss.stateTimer <= 0 && boss.slamPending) {
        boss.slamPending = false;
        performAttack(boss, ctx, res, flat, flatDist);
        boss.state = 'recover';
        // Tras un ataque queda expuesto: es la ventana para golpear
        boss.stateTimer = boss.kind === 'guardian' ? 1.5 : 1.1;
        boss.attackCooldown = 2.6 - boss.phase * 0.35;
      }
      break;
    }

    case 'recover':
      speed = bossSpeed(boss) * 0.2;
      if (boss.stateTimer <= 0) boss.state = 'chase';
      break;

    default:
      break;
  }

  // ── Movimiento ──
  const canMove = boss.state !== 'stunned' && boss.state !== 'vulnerable' && boss.state !== 'intro';
  if (canMove) {
    boss.actor.velocity.x = damp(boss.actor.velocity.x, desired.x * speed, 7, dt);
    boss.actor.velocity.z = damp(boss.actor.velocity.z, desired.z * speed, 7, dt);
  } else {
    boss.actor.velocity.x = damp(boss.actor.velocity.x, 0, 9, dt);
    boss.actor.velocity.z = damp(boss.actor.velocity.z, 0, 9, dt);
  }

  // Deedee flota sobre su trono
  if (boss.kind === 'deedee' && boss.state !== 'stunned' && boss.state !== 'vulnerable') {
    const targetY = ctx.world.terrainHeight(boss.actor.position.x, boss.actor.position.z) + 3.2 + Math.sin(boss.hoverPhase * 1.6) * 0.5;
    boss.actor.velocity.y = damp(boss.actor.velocity.y, (targetY - boss.actor.position.y) * 3, 6, dt);
    moveActor(ctx.world, boss.actor, dt, 0, 0.6);
  } else {
    moveActor(ctx.world, boss.actor, dt, ctx.gravity, 0.6);
  }

  // Se mantiene dentro de la arena
  const fromCenter = new THREE.Vector3(boss.actor.position.x - boss.arena.x, 0, boss.actor.position.z - boss.arena.z);
  if (fromCenter.length() > boss.arenaRadius) {
    fromCenter.setLength(boss.arenaRadius);
    boss.actor.position.x = boss.arena.x + fromCenter.x;
    boss.actor.position.z = boss.arena.z + fromCenter.z;
  }

  // ── Orientación y pose ──
  if (flatDist > 0.1) {
    const target = Math.atan2(flat.x, flat.z);
    let d = ((target - boss.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    boss.yaw += d * Math.min(1, dt * 5);
  }

  boss.rig.root.position.copy(boss.actor.position);
  boss.rig.root.rotation.y = boss.yaw;

  if (boss.state === 'stunned') {
    poseStunned(boss.rig, boss.anim, dt);
  } else if (boss.state === 'vulnerable') {
    poseStunned(boss.rig, boss.anim, dt * 0.5);
  } else {
    updateAnim(boss.rig, boss.anim, {
      dt,
      speed: Math.hypot(boss.actor.velocity.x, boss.actor.velocity.z),
      maxSpeed: bossSpeed(boss),
      onGround: boss.actor.onGround || boss.kind === 'deedee',
      verticalVel: boss.actor.velocity.y,
      crouching: false,
      swimming: false,
    });
    if (boss.state === 'attack') {
      const t = 1 - clamp(boss.stateTimer / 0.6, 0, 1);
      boss.rig.body.rotation.x = -0.5 * Math.sin(t * Math.PI);
      boss.rig.armR.rotation.x = -2.2 * Math.sin(t * Math.PI);
      boss.rig.armL.rotation.x = -2.2 * Math.sin(t * Math.PI);
    }
  }

  return res;
}

function bossSpeed(boss: Boss): number {
  if (boss.kind === 'silva') return 8.5 + boss.phase * 0.5;
  if (boss.kind === 'guardian') return 5.6;
  return 7 + boss.phase * 1.6;
}

function attackRange(boss: Boss): number {
  if (boss.kind === 'silva') return 8;
  if (boss.kind === 'guardian') return 5.5;
  return 26;
}

function performAttack(boss: Boss, ctx: BossContext, res: BossResult, flat: THREE.Vector3, flatDist: number): void {
  const origin = boss.actor.position.clone();
  origin.y += 1.2;

  if (boss.kind === 'guardian') {
    // Pisotón con onda expansiva
    sfx('bossHit');
    res.shockwave = boss.actor.position.clone();
    if (flatDist < 7) res.meleeHit = true;
    return;
  }

  if (boss.kind === 'silva') {
    // Zarpazo veloz y tres garras arrojadizas
    sfx('clubHit');
    if (flatDist < 4.5) res.meleeHit = true;
    for (let i = -1; i <= 1; i++) {
      const dir = flat.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.28);
      res.newProjectiles.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(19),
        life: 2.4,
        radius: 0.55,
        damage: 14,
        color: 0x9bff5c,
        homing: false,
      });
    }
    return;
  }

  // Deedee: patrón según la fase
  sfx('explosion');
  if (boss.phase === 1) {
    // Abanico de energía psíquica
    for (let i = -3; i <= 3; i++) {
      const dir = flat.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.22);
      res.newProjectiles.push({
        pos: origin.clone(),
        vel: dir.multiplyScalar(15),
        life: 3,
        radius: 0.7,
        damage: 12,
        color: 0xff40ff,
        homing: false,
      });
    }
  } else if (boss.phase === 2) {
    // Anillo completo + dos perseguidores
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      res.newProjectiles.push({
        pos: origin.clone(),
        vel: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(13),
        life: 3.2,
        radius: 0.65,
        damage: 11,
        color: 0xff2a6a,
        homing: false,
      });
    }
    for (let i = 0; i < 2; i++) {
      res.newProjectiles.push({
        pos: origin.clone().add(new THREE.Vector3(i ? 1.5 : -1.5, 0, 0)),
        vel: flat.clone().multiplyScalar(9),
        life: 4.5,
        radius: 0.8,
        damage: 16,
        color: 0x40ffe0,
        homing: true,
      });
    }
  } else {
    // Fase 3: lluvia y onda de choque
    res.shockwave = boss.actor.position.clone();
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 14;
      res.newProjectiles.push({
        pos: new THREE.Vector3(ctx.playerPos.x + Math.cos(a) * r, boss.actor.position.y + 12, ctx.playerPos.z + Math.sin(a) * r),
        vel: new THREE.Vector3(0, -16, 0),
        life: 3,
        radius: 0.9,
        damage: 18,
        color: 0xff2a4a,
        homing: false,
      });
    }
  }
}

function updateProjectiles(boss: Boss, ctx: BossContext, dt: number): void {
  for (let i = boss.projectiles.length - 1; i >= 0; i--) {
    const p = boss.projectiles[i];
    p.life -= dt;
    if (p.homing) {
      const dir = ctx.playerPos.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(p.pos).normalize();
      p.vel.lerp(dir.multiplyScalar(p.vel.length()), Math.min(1, dt * 1.6));
    }
    p.pos.addScaledVector(p.vel, dt);
    const groundH = ctx.world.terrainHeight(p.pos.x, p.pos.z);
    if (p.life <= 0 || p.pos.y < groundH - 1) {
      boss.projectiles.splice(i, 1);
    }
  }
}

/** Golpe del Palo Aturdidor o del Puño Mágico sobre el jefe. */
export function hitBoss(boss: Boss, kind: 'stun' | 'punch'): 'stunned' | 'damaged' | 'blocked' {
  if (boss.defeated || boss.invuln > 0) return 'blocked';
  if (boss.state === 'stunned' || boss.state === 'vulnerable') {
    // Ya aturdido: los golpes le quitan vida
    boss.hp -= kind === 'punch' ? 2 : 1;
    boss.invuln = 0.35;
    sfx('bossHit');
    checkPhase(boss);
    return 'damaged';
  }
  // Solo es vulnerable durante la recuperación tras atacar
  if (boss.state === 'recover' || boss.state === 'attack') {
    boss.state = 'stunned';
    boss.stunTimer = 2.4;
    boss.invuln = 0.3;
    sfx('bossHit');
    return 'stunned';
  }
  boss.invuln = 0.25;
  return 'blocked';
}

/** Intento de captura con la red: solo funciona con el jefe aturdido y sin vida. */
export function tryCaptureBoss(boss: Boss, from: THREE.Vector3, reach: number): 'captured' | 'notReady' | 'miss' {
  if (boss.defeated) return 'miss';
  const d = boss.actor.position.distanceTo(from);
  if (d > reach + 1.8) return 'miss';
  if (boss.hp > 0 || (boss.state !== 'stunned' && boss.state !== 'vulnerable')) return 'notReady';
  boss.defeated = true;
  boss.captured = true;
  boss.state = 'defeated';
  boss.stateTimer = 3;
  sfx('netCatch');
  return 'captured';
}

function checkPhase(boss: Boss): void {
  if (boss.hp > 0) return;
  if (boss.phase < boss.maxPhase) {
    boss.phase++;
    boss.hp = boss.maxHp;
    boss.state = 'chase';
    boss.invuln = 1.6;
    boss.attackCooldown = 1.2;
    sfx('unlock');
    // Cada fase de Deedee sube la apuesta visualmente
    if (boss.kind === 'deedee') {
      const helm = boss.rig.extras.helmet as THREE.Object3D | undefined;
      if (helm) helm.scale.setScalar(1 + boss.phase * 0.18);
    }
  } else {
    boss.hp = 0;
    boss.state = 'stunned';
    boss.stunTimer = 999;
  }
}

export function bossReadyForCapture(boss: Boss): boolean {
  return !boss.defeated && boss.hp <= 0;
}
