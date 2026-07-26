/**
 * Animación procedural de los rigs. No hay ficheros de animación: cada pose se
 * calcula con osciladores, lo que da ciclos fluidos a 60 FPS y permite mezclar
 * estados (andar + girar la cabeza + colear) sin sistema de blending.
 */
import type { CritterRig } from './models';
import { damp, lerp } from './mathx';

export type AnimState = {
  t: number;
  walkPhase: number;
  /** Mezcla 0..1 entre reposo y locomoción. */
  locomotion: number;
  swing: number;
  swingType: 'net' | 'club' | 'punch' | 'none';
  hurt: number;
  jumpBlend: number;
  squash: number;
  headYaw: number;
  headPitch: number;
};

export function createAnimState(): AnimState {
  return {
    t: Math.random() * 10,
    walkPhase: 0,
    locomotion: 0,
    swing: 0,
    swingType: 'none',
    hurt: 0,
    jumpBlend: 0,
    squash: 1,
    headYaw: 0,
    headPitch: 0,
  };
}

export type AnimInput = {
  dt: number;
  speed: number;
  maxSpeed: number;
  onGround: boolean;
  verticalVel: number;
  crouching: boolean;
  swimming: boolean;
};

export function updateAnim(rig: CritterRig, st: AnimState, input: AnimInput): void {
  const { dt, speed, maxSpeed, onGround, verticalVel } = input;
  st.t += dt;

  const norm = maxSpeed > 0 ? Math.min(1, speed / maxSpeed) : 0;
  st.locomotion = damp(st.locomotion, norm, 12, dt);
  st.walkPhase += dt * (5 + norm * 9);
  st.jumpBlend = damp(st.jumpBlend, onGround ? 0 : 1, 10, dt);
  st.hurt = Math.max(0, st.hurt - dt * 2.5);
  st.swing = Math.max(0, st.swing - dt);

  const w = st.walkPhase;
  const loco = st.locomotion;
  const air = st.jumpBlend;
  const breathe = Math.sin(st.t * 2.2) * 0.02;

  // ── Cuerpo ──
  const bob = Math.sin(w * 2) * 0.045 * loco;
  const crouchDrop = input.crouching ? -0.22 : 0;
  rig.body.position.y = lerp(rig.body.position.y, rig.bodyRestY + bob + crouchDrop + breathe, Math.min(1, dt * 18));
  rig.body.rotation.x = lerp(rig.body.rotation.x, loco * 0.16 + (input.crouching ? 0.3 : 0) + air * -0.12, Math.min(1, dt * 12));
  rig.body.rotation.z = Math.sin(w) * 0.05 * loco;
  rig.body.rotation.y = Math.sin(w) * 0.09 * loco;

  // Estirar al saltar, aplastar al caer: comedia de dibujos animados
  const stretch = onGround ? 1 : verticalVel > 0 ? 1.07 : 0.94;
  st.squash = damp(st.squash, stretch, 9, dt);
  rig.body.scale.set(2 - st.squash, st.squash, 2 - st.squash);

  // ── Cabeza ──
  rig.head.rotation.y = damp(rig.head.rotation.y, st.headYaw, 8, dt);
  rig.head.rotation.x = damp(rig.head.rotation.x, st.headPitch + loco * 0.1 + Math.sin(w * 2 + 1) * 0.04 * loco, 8, dt);
  rig.head.rotation.z = Math.sin(w) * 0.05 * loco + st.hurt * Math.sin(st.t * 40) * 0.1;

  // ── Orejas: siguen el movimiento con retardo ──
  const earFlop = Math.sin(w * 2 + 0.6) * 0.14 * loco + Math.sin(st.t * 3) * 0.03;
  rig.earL.rotation.z = 0.1 + earFlop;
  rig.earR.rotation.z = -0.1 - earFlop;
  rig.earL.rotation.x = -air * 0.3;
  rig.earR.rotation.x = -air * 0.3;

  // ── Piernas ──
  // Con rodilla, la pierna de apoyo se estira y la de vuelo se recoge, que es
  // lo que da lectura de paso en vez de un péndulo rígido.
  const legSwing = Math.sin(w) * 0.85 * loco;
  const legSwing2 = Math.sin(w + Math.PI) * 0.85 * loco;
  rig.legL.rotation.x = legSwing - air * 0.5;
  rig.legR.rotation.x = legSwing2 - air * 0.2;
  rig.legL.rotation.z = 0.05;
  rig.legR.rotation.z = -0.05;
  if (rig.shinL) {
    const bend = Math.max(0, -Math.sin(w)) * 1.15 * loco + air * 0.55 + (input.crouching ? 0.7 : 0);
    rig.shinL.rotation.x = bend;
  }
  if (rig.shinR) {
    const bend = Math.max(0, -Math.sin(w + Math.PI)) * 1.15 * loco + air * 0.35 + (input.crouching ? 0.7 : 0);
    rig.shinR.rotation.x = bend;
  }
  if (rig.neck) {
    rig.neck.rotation.x = damp(rig.neck.rotation.x, -loco * 0.12 + (input.crouching ? 0.2 : 0), 9, dt);
  }

  // ── Brazos ──
  const armBase = input.swimming ? 1.0 : 0;
  rig.armL.rotation.x = Math.sin(w + Math.PI) * 0.7 * loco - air * 0.9 + armBase;
  rig.armL.rotation.z = 0.3 + loco * 0.1;
  if (rig.forearmL) {
    rig.forearmL.rotation.x = -0.25 - Math.max(0, Math.sin(w + Math.PI)) * 0.75 * loco - air * 0.4;
  }

  if (st.swing > 0) {
    // Golpe: arco rápido hacia delante con anticipación
    const p = 1 - st.swing / 0.42;
    const anticip = p < 0.25 ? -Math.sin((p / 0.25) * Math.PI * 0.5) * 0.8 : 0;
    const strike = p >= 0.25 ? Math.sin(((p - 0.25) / 0.75) * Math.PI) : 0;
    if (st.swingType === 'punch') {
      rig.armR.rotation.x = -1.6 * strike + anticip;
      rig.armR.rotation.z = -0.1;
      rig.body.rotation.y += strike * 0.25;
      // El codo se extiende al golpear: da chasquido al movimiento
      if (rig.forearmR) rig.forearmR.rotation.x = -0.9 + strike * 0.9;
    } else {
      rig.armR.rotation.x = -2.6 * strike + anticip;
      rig.armR.rotation.z = -0.6 - strike * 0.9;
      rig.body.rotation.y += strike * 0.55;
      if (rig.forearmR) rig.forearmR.rotation.x = -0.6 - strike * 0.5;
    }
  } else {
    rig.armR.rotation.x = damp(rig.armR.rotation.x, Math.sin(w) * 0.7 * loco - air * 0.9 + armBase, 12, dt);
    rig.armR.rotation.z = damp(rig.armR.rotation.z, -0.3 - loco * 0.1, 12, dt);
    if (rig.forearmR) {
      rig.forearmR.rotation.x = damp(
        rig.forearmR.rotation.x,
        -0.25 - Math.max(0, Math.sin(w)) * 0.75 * loco - air * 0.4,
        12,
        dt,
      );
    }
  }

  // ── Cola: látigo con retardo ──
  rig.tail.rotation.y = Math.sin(st.t * 2.6 + w * 0.5) * (0.25 + loco * 0.35);
  rig.tail.rotation.x = -0.3 - Math.sin(st.t * 2.1) * 0.15 - air * 0.4;
  let seg = rig.tail.children.find((c) => c.type === 'Group');
  let i = 1;
  while (seg && i < 6) {
    seg.rotation.y = Math.sin(st.t * 2.6 + w * 0.5 - i * 0.5) * 0.22;
    seg.rotation.x = Math.sin(st.t * 2.0 - i * 0.4) * 0.1;
    seg = seg.children.find((c) => c.type === 'Group');
    i++;
  }
}

/** Dispara la animación de golpe con el artefacto. */
export function triggerSwing(st: AnimState, type: AnimState['swingType'], duration = 0.42): void {
  st.swing = duration;
  st.swingType = type;
}

export function triggerHurt(st: AnimState): void {
  st.hurt = 1;
}

/** Pose de captura: la mascota se encoge y gira dentro de la red. */
export function poseCaptured(rig: CritterRig, progress: number): void {
  const p = Math.min(1, progress);
  rig.root.rotation.y += 0.4;
  rig.root.scale.setScalar(Math.max(0.001, 1 - p));
  rig.body.rotation.x = p * 1.4;
  rig.armL.rotation.x = -p * 2.2;
  rig.armR.rotation.x = -p * 2.2;
  rig.legL.rotation.x = p * 1.8;
  rig.legR.rotation.x = p * 1.8;
  if (rig.shinL) rig.shinL.rotation.x = p * 2.2;
  if (rig.shinR) rig.shinR.rotation.x = p * 2.2;
}

/** Pose de aturdimiento: tambaleo con estrellas. */
export function poseStunned(rig: CritterRig, st: AnimState, dt: number): void {
  st.t += dt;
  const wob = Math.sin(st.t * 12) * 0.28;
  rig.body.rotation.z = wob;
  rig.body.rotation.x = 0.25;
  rig.head.rotation.z = -wob * 1.4;
  rig.head.rotation.x = 0.2;
  rig.armL.rotation.x = -0.6 + wob;
  rig.armR.rotation.x = -0.6 - wob;
  rig.legL.rotation.x = 0.2;
  rig.legR.rotation.x = -0.2;
  if (rig.shinL) rig.shinL.rotation.x = 0.5;
  if (rig.shinR) rig.shinR.rotation.x = 0.35;
  if (rig.neck) rig.neck.rotation.z = wob * 0.6;
}
