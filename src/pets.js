// ===== BENITO ESCAPE — renegade pet AI (patrol / alert / panic) + boss =====
import * as THREE from '../lib/three.module.js';
import { makePet, makeBoss } from './models.js';
import { groundYAt, inCircleZone } from './levelbuilder.js';
import { Audio } from './audio.js';

const LIGHT_COLORS = { calm: 0x2e86ff, alert: 0xffd23b, panic: 0xff2d2d };

// per-type tuning: pants color = personality
const TYPE_STATS = {
  amarillo: { speed: 3.2, fleeSpeed: 4.6, sight: 8, attacks: false },
  rojo:     { speed: 3.4, fleeSpeed: 4.2, sight: 9, attacks: true, chaseSpeed: 5.2 },
  azul:     { speed: 4.2, fleeSpeed: 7.0, sight: 9, attacks: false },
  blanco:   { speed: 3.0, fleeSpeed: 5.0, sight: 14, attacks: false },
  verde:    { speed: 2.6, fleeSpeed: 4.0, sight: 10, attacks: false, shoots: true },
};

export class Pet {
  constructor(def, scene, ctx) {
    this.def = def;
    this.ctx = ctx;              // { colliders, waters, bounds, playerRef, fx }
    this.type = def.type;
    this.stats = TYPE_STATS[def.type] ?? TYPE_STATS.amarillo;
    this.isWater = !!def.water;

    const model = makePet(def.type);
    this.model = model;
    this.group = model.group;
    this.group.position.set(def.x, 0, def.z);
    scene.add(this.group);

    this.state = 'calm';         // calm | alert | panic | captured
    this.alertT = 0;
    this.loseT = 0;
    this.shootT = 0;
    this.wpIndex = 0;
    this.waitT = Math.random() * 1.5;
    this.heading = Math.random() * Math.PI * 2;
    this.animT = Math.random() * 10;
    this.captured = false;
    this.captureAnimT = -1;
  }

  setLight(mode) {
    this.model.lightMat.color.setHex(LIGHT_COLORS[mode]);
  }

  /** Squared distance to player on the ground plane. */
  distSqTo(p) {
    const dx = this.group.position.x - p.x;
    const dz = this.group.position.z - p.z;
    return dx * dx + dz * dz;
  }

  canSee(player) {
    let sight = this.stats.sight * (player.sneaking ? 0.45 : 1);
    if (this.isWater) sight *= 0.8;
    const dSq = this.distSqTo(player.pos);
    if (dSq > sight * sight) return false;
    if (dSq < 2.6 * 2.6) return true; // too close: always noticed
    const toP = Math.atan2(player.pos.x - this.group.position.x, player.pos.z - this.group.position.z);
    let diff = toP - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < 1.35;
  }

  update(dt, player) {
    if (this.captured) {
      if (this.captureAnimT >= 0) {
        this.captureAnimT += dt;
        const k = Math.max(0, 1 - this.captureAnimT * 2.2);
        this.group.scale.setScalar(k);
        this.group.rotation.y += dt * 18;
        this.group.position.y += dt * 2.2;
        if (k <= 0) { this.group.visible = false; this.captureAnimT = -1; }
      }
      return;
    }

    this.animT += dt;
    const pos = this.group.position;
    const st = this.stats;

    // ---------- perception ----------
    const sees = this.canSee(player);
    if (sees) {
      this.alertT += dt;
      this.loseT = 0;
      if (this.state === 'calm' && this.alertT > 0.35) {
        this.state = 'alert';
        this.setLight('alert');
        Audio.sfx('alert');
      } else if (this.state === 'alert' && (this.alertT > 1.1 || this.distSqTo(player.pos) < 16)) {
        this.state = 'panic';
        this.setLight('panic');
        Audio.sfx('alarm');
      }
    } else {
      this.loseT += dt;
      if (this.loseT > 3.2 && this.state !== 'calm') {
        this.state = 'calm';
        this.alertT = 0;
        this.setLight('calm');
      }
    }

    // ---------- movement ----------
    let speed = 0;
    let targetHeading = this.heading;

    if (this.state === 'calm') {
      const wp = this.def.patrol[this.wpIndex];
      const dx = wp[0] - pos.x, dz = wp[1] - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        if (this.waitT > 0) this.waitT -= dt;
        else { this.wpIndex = (this.wpIndex + 1) % this.def.patrol.length; this.waitT = 0.6 + Math.random(); }
      } else {
        targetHeading = Math.atan2(dx, dz);
        speed = st.speed * (this.isWater ? 0.7 : 1);
      }
    } else if (this.state === 'alert') {
      // face the player nervously, hop in place
      targetHeading = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z);
      speed = 0;
    } else if (this.state === 'panic') {
      if (st.attacks) {
        // red pants: charge the player!
        targetHeading = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z);
        speed = st.chaseSpeed;
        if (this.distSqTo(player.pos) < 1.1 && player.hurtCooldown <= 0) {
          player.hurt(pos);
        }
      } else if (st.shoots) {
        // green pants: keep distance and lob shots
        targetHeading = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z);
        const dSq = this.distSqTo(player.pos);
        speed = dSq < 36 ? -st.fleeSpeed * 0.7 : 0;
        this.shootT -= dt;
        if (this.shootT <= 0 && dSq < 220) {
          this.shootT = 2.1;
          this.ctx.fx.spawnProjectile(pos, player.pos);
        }
      } else {
        // flee away from the player
        targetHeading = Math.atan2(pos.x - player.pos.x, pos.z - player.pos.z) + Math.sin(this.animT * 3) * 0.5;
        speed = st.fleeSpeed * (this.isWater ? 0.75 : 1);
      }
    }

    // smooth turn
    let hd = targetHeading - this.heading;
    while (hd > Math.PI) hd -= Math.PI * 2;
    while (hd < -Math.PI) hd += Math.PI * 2;
    this.heading += hd * Math.min(1, dt * 8);
    this.group.rotation.y = this.heading;

    if (speed !== 0) {
      let nx = pos.x + Math.sin(this.heading) * speed * dt;
      let nz = pos.z + Math.cos(this.heading) * speed * dt;
      const b = this.ctx.bounds;
      nx = Math.max(b.minX + 1, Math.min(b.maxX - 1, nx));
      nz = Math.max(b.minZ + 1, Math.min(b.maxZ - 1, nz));
      // water pets stay in their pond; land pets avoid deep water & lava
      if (this.isWater) {
        const pond = inCircleZone(this.ctx.waters, nx, nz);
        if (pond) { pos.x = nx; pos.z = nz; }
      } else {
        const inLava = inCircleZone(this.ctx.lavas, nx, nz);
        if (!inLava) { pos.x = nx; pos.z = nz; }
        else this.heading += Math.PI * 0.6; // bounce off hazards
      }
    }

    // ---------- vertical placement + waddle animation ----------
    const gy = groundYAt(this.ctx.colliders, pos.x, pos.z, pos.y);
    const bob = speed !== 0 ? Math.abs(Math.sin(this.animT * 9)) * 0.09 : 0;
    const hop = this.state === 'alert' ? Math.abs(Math.sin(this.animT * 7)) * 0.16 : 0;
    if (this.isWater) {
      pos.y = -0.18 + Math.sin(this.animT * 2.2) * 0.05; // bobbing in the pond
    } else {
      pos.y = gy + bob + hop;
    }
    this.model.shadow.position.y = gy - pos.y + 0.02;
    const wob = speed !== 0 ? Math.sin(this.animT * 9) * 0.08 : 0;
    this.group.rotation.z = wob;
  }

  /** Attempt capture. Returns 'ok' | 'water-blocked' | 'miss'. */
  tryCapture(hasWaterNet) {
    if (this.captured) return 'miss';
    if (this.isWater && !hasWaterNet) return 'water-blocked';
    this.captured = true;
    this.captureAnimT = 0;
    return 'ok';
  }
}

// ============================================================
// BOSS — Capitán Colmillo
// states: waiting (pre-trigger) → roar → charge → dizzy → roar…
// ============================================================
export class Boss {
  constructor(def, scene, ctx) {
    this.def = def;
    this.ctx = ctx;
    const model = makeBoss();
    this.model = model;
    this.group = model.group;
    this.group.position.set(def.x, 0, def.z);
    scene.add(this.group);

    this.state = 'waiting';
    this.hp = 3;
    this.timer = 0;
    this.heading = Math.PI; // face south (towards the player's approach)
    this.chargeDir = new THREE.Vector2();
    this.animT = 0;
    this.captured = false;
    this.captureAnimT = -1;
    this.model.lightMat.color.setHex(0xff2d2d);
  }

  activate() {
    if (this.state === 'waiting') {
      this.state = 'roar';
      this.timer = 1.3;
      Audio.sfx('roar');
    }
  }

  update(dt, player) {
    if (this.captured) {
      if (this.captureAnimT >= 0) {
        this.captureAnimT += dt;
        const k = Math.max(0, 1 - this.captureAnimT * 1.4);
        this.group.scale.setScalar(1.5 * k);
        this.group.rotation.y += dt * 14;
        this.group.position.y += dt * 2.5;
        if (k <= 0) { this.group.visible = false; this.captureAnimT = -1; }
      }
      return;
    }

    this.animT += dt;
    const pos = this.group.position;
    const arena = this.def.arena;

    if (this.state === 'waiting') {
      pos.y = Math.abs(Math.sin(this.animT * 1.6)) * 0.08;
      return;
    }

    if (this.state === 'roar') {
      this.timer -= dt;
      // face player, stomp in place
      this.heading = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z);
      this.group.rotation.y = this.heading;
      pos.y = Math.abs(Math.sin(this.animT * 10)) * 0.12;
      if (this.timer <= 0) {
        this.state = 'charge';
        this.chargeDir.set(player.pos.x - pos.x, player.pos.z - pos.z).normalize();
        this.heading = Math.atan2(this.chargeDir.x, this.chargeDir.y);
        Audio.sfx('roar');
      }
      return;
    }

    if (this.state === 'charge') {
      const SPEED = 13;
      pos.x += this.chargeDir.x * SPEED * dt;
      pos.z += this.chargeDir.y * SPEED * dt;
      this.group.rotation.y = this.heading;
      pos.y = Math.abs(Math.sin(this.animT * 18)) * 0.1;

      // hit the player?
      const dx = player.pos.x - pos.x, dz = player.pos.z - pos.z;
      if (dx * dx + dz * dz < 2.6 && player.hurtCooldown <= 0) {
        player.hurt(pos);
      }
      // crashed into the arena edge?
      const ax = pos.x - arena.x, az = pos.z - arena.z;
      if (Math.hypot(ax, az) > arena.r) {
        const n = Math.hypot(ax, az);
        pos.x = arena.x + (ax / n) * arena.r;
        pos.z = arena.z + (az / n) * arena.r;
        this.state = 'dizzy';
        this.timer = 3.6;
        this.model.lightMat.color.setHex(0xffd23b);
        Audio.sfx('dizzy');
        this.ctx.fx.burst(pos.x, pos.y + 3.4, pos.z, 0xffe066, 10);
        this.ctx.onBossDizzy?.();
      }
      return;
    }

    if (this.state === 'dizzy') {
      this.timer -= dt;
      this.group.rotation.y += dt * 3.2; // wobbling around, seeing stars
      this.group.rotation.z = Math.sin(this.animT * 6) * 0.12;
      if (this.timer <= 0) {
        this.group.rotation.z = 0;
        this.state = 'roar';
        this.timer = 1.1;
        this.model.lightMat.color.setHex(0xff2d2d);
        Audio.sfx('roar');
      }
    }
  }

  /** Net hit while dizzy: lose 1 HP. Returns 'captured' | 'hit' | 'blocked'. */
  tryCapture() {
    if (this.captured || this.state === 'waiting') return 'blocked';
    if (this.state !== 'dizzy') return 'blocked';
    this.hp -= 1;
    if (this.hp <= 0) {
      this.captured = true;
      this.captureAnimT = 0;
      return 'captured';
    }
    this.state = 'roar';
    this.timer = 1.4;
    this.group.rotation.z = 0;
    this.model.lightMat.color.setHex(0xff2d2d);
    return 'hit';
  }
}
