// ===== BENITO ESCAPE — player controller (Benito) =====
import * as THREE from '../lib/three.module.js';
import { makeBenito } from './models.js';
import { groundYAt, resolveWalls, inCircleZone } from './levelbuilder.js';
import { Audio } from './audio.js';

const GRAVITY = -24;
const JUMP_VEL = 9.2;
const MOVE_SPEED = 6.2;
const SNEAK_SPEED = 2.6;
const WATER_SPEED = 3.4;
const RADIUS = 0.55;

export class Player {
  constructor(scene, ctx) {
    this.ctx = ctx; // { colliders, waters, lavas, bounds }
    const model = makeBenito();
    this.model = model;
    this.group = model.group;
    scene.add(this.group);

    this.pos = this.group.position;
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.onGround = true;
    this.sneaking = false;
    this.inWater = false;

    this.energy = 3;
    this.maxEnergy = 3;
    this.lives = 3;
    this.hurtCooldown = 0;
    this.animT = 0;

    // net swing
    this.swingT = -1;       // -1 = idle, else seconds since swing start
    this.swingDur = 0.42;
    this.model.net.visible = true;
  }

  spawnAt(x, z, face = 0) {
    this.pos.set(x, groundYAt(this.ctx.colliders, x, z), z);
    this.vel.set(0, 0, 0);
    this.heading = face;
    this.group.rotation.y = face;
    this.hurtCooldown = 1.2;
  }

  get swinging() { return this.swingT >= 0; }

  startSwing() {
    if (this.swinging) return false;
    this.swingT = 0;
    Audio.sfx('swing');
    return true;
  }

  /** Returns the world-space center of the net's active hit zone (mid-swing). */
  netHitZone() {
    const reach = 1.7;
    return {
      x: this.pos.x + Math.sin(this.heading) * reach,
      z: this.pos.z + Math.cos(this.heading) * reach,
      r: 1.55,
    };
  }

  hurt(fromPos) {
    if (this.hurtCooldown > 0) return;
    this.energy -= 1;
    this.hurtCooldown = 1.4;
    Audio.sfx('hurt');
    // knockback away from the source
    if (fromPos) {
      const dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z;
      const d = Math.hypot(dx, dz) || 1;
      this.vel.x = (dx / d) * 7;
      this.vel.z = (dz / d) * 7;
      this.vel.y = 4;
      this.onGround = false;
    }
    this.ctx.onHurt?.();
  }

  update(dt, input, camYaw) {
    this.animT += dt;
    if (this.hurtCooldown > 0) this.hurtCooldown -= dt;

    // ---------- swing animation ----------
    if (this.swinging) {
      this.swingT += dt;
      const k = this.swingT / this.swingDur;
      if (k >= 1) {
        this.swingT = -1;
        this.model.armR.rotation.x = 0;
      } else {
        // wind up back, then slam forward
        const phase = k < 0.3 ? -(k / 0.3) * 1.4 : -1.4 + ((k - 0.3) / 0.7) * 2.6;
        this.model.armR.rotation.x = phase;
      }
    } else {
      this.model.armR.rotation.x = Math.sin(this.animT * 2) * 0.08;
    }
    this.model.armL.rotation.x = Math.sin(this.animT * 2 + Math.PI) * 0.08;

    // ---------- movement ----------
    this.sneaking = input.sneakDown() && this.onGround;
    const axis = input.moveAxis();
    const moving = axis.x !== 0 || axis.y !== 0;

    if (moving) {
      // camera-relative
      const wx = Math.sin(camYaw) * axis.y + Math.cos(camYaw) * axis.x;
      const wz = Math.cos(camYaw) * axis.y - Math.sin(camYaw) * axis.x;
      const target = Math.atan2(wx, wz);
      let hd = target - this.heading;
      while (hd > Math.PI) hd -= Math.PI * 2;
      while (hd < -Math.PI) hd += Math.PI * 2;
      this.heading += hd * Math.min(1, dt * 10);
      this.group.rotation.y = this.heading;

      let speed = this.sneaking ? SNEAK_SPEED : MOVE_SPEED;
      if (this.inWater) speed = WATER_SPEED;
      const mag = Math.min(1, Math.hypot(axis.x, axis.y));
      this.vel.x = Math.sin(this.heading) * speed * mag;
      this.vel.z = Math.cos(this.heading) * speed * mag;
    } else if (this.onGround) {
      this.vel.x *= Math.max(0, 1 - dt * 12);
      this.vel.z *= Math.max(0, 1 - dt * 12);
    }

    // jump
    if (input.jumpPressed() && this.onGround && !this.inWater) {
      this.vel.y = JUMP_VEL;
      this.onGround = false;
      Audio.sfx('jump');
    }

    // gravity
    this.vel.y += GRAVITY * dt;

    // integrate
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    // bounds
    const b = this.ctx.bounds;
    this.pos.x = Math.max(b.minX + 0.6, Math.min(b.maxX - 0.6, this.pos.x));
    this.pos.z = Math.max(b.minZ + 0.6, Math.min(b.maxZ - 0.6, this.pos.z));

    // walls
    resolveWalls(this.ctx.colliders, this.pos, RADIUS, this.pos.y);

    // ground
    const gy = groundYAt(this.ctx.colliders, this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      if (!this.onGround && this.vel.y < -12) Audio.sfx('splash');
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y > gy + 0.02) {
      this.onGround = false;
    }

    // water check (only at ground level)
    this.inWater = this.pos.y <= 0.05 && !!inCircleZone(this.ctx.waters, this.pos.x, this.pos.z);

    // ---------- procedural animation ----------
    const speedNow = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && speedNow > 0.5) {
      const rate = this.sneaking ? 6 : 11;
      this.group.position.y = this.pos.y + Math.abs(Math.sin(this.animT * rate)) * 0.08;
      this.group.rotation.z = Math.sin(this.animT * rate) * 0.05;
    } else {
      this.group.rotation.z = 0;
    }
    if (this.inWater) this.group.position.y = this.pos.y - 0.35; // wading belly-deep
    // sneak crouch
    const crouch = this.sneaking ? 0.85 : 1;
    this.model.body.scale.y = 0.95 * crouch;
    this.model.head.position.y = 1.34 * (this.sneaking ? 0.9 : 1);
    // tail wag
    this.model.tail.rotation.x = 0.4 + Math.sin(this.animT * 3) * 0.25;
    this.model.tail.rotation.z = Math.sin(this.animT * 2.2) * 0.3;
    // blob shadow sticks to the ground
    this.model.shadow.position.y = gy - this.group.position.y + 0.03;
    // hurt flash
    this.group.visible = this.hurtCooldown > 0 ? Math.floor(this.animT * 14) % 2 === 0 : true;
  }
}
