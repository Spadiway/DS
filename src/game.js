// ===== BENITO ESCAPE — level session: gameplay loop for one level =====
import * as THREE from '../lib/three.module.js';
import { LEVELS } from './levels.js';
import { buildLevel, inCircleZone } from './levelbuilder.js';
import { Player } from './player.js';
import { Pet, Boss } from './pets.js';
import { makeProjectile, makeSparkle } from './models.js';
import { Audio } from './audio.js';
import { t } from './i18n.js';

export class LevelSession {
  /**
   * opts: { levelId, save, hud, onComplete(results), onGameOver, onScene(id, cb) }
   */
  constructor(opts) {
    this.opts = opts;
    this.levelId = opts.levelId;
    this.def = LEVELS[opts.levelId];
    this.save = opts.save;
    this.hud = opts.hud;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
    this.camYaw = 0;

    this.built = buildLevel(this.def, this.scene);

    // effects
    this.sparkles = [];
    this.projectiles = [];
    const fx = {
      burst: (x, y, z, color, n = 8) => this.burst(x, y, z, color, n),
      spawnProjectile: (from, to) => this.spawnProjectile(from, to),
    };

    const ctx = {
      colliders: this.built.colliders,
      waters: this.def.waters,
      lavas: this.def.lavas,
      bounds: this.def.bounds,
      fx,
      onHurt: () => this.onPlayerHurt(),
    };
    this.ctx = ctx;

    // player
    this.player = new Player(this.scene, ctx);
    this.player.spawnAt(this.def.spawn[0], this.def.spawn[1], 0);
    this.respawnPoint = { x: this.def.spawn[0], z: this.def.spawn[1] };
    this.lastSafe = { x: this.def.spawn[0], z: this.def.spawn[1] };
    this.safeTimer = 0;

    // pets (skip ones already captured in previous runs)
    this.capturedSet = new Set(this.save.captures[this.levelId] ?? []);
    this.pets = [];
    for (const pdef of this.def.pets) {
      if (this.capturedSet.has(pdef.id)) continue;
      this.pets.push(new Pet(pdef, this.scene, ctx));
    }

    // boss
    this.boss = null;
    this.bossIntroDone = false;
    if (this.def.boss) {
      ctx.onBossDizzy = () => this.hud.toast(t('bossDizzy'), 2000);
      this.boss = new Boss(this.def.boss, this.scene, ctx);
      if (this.capturedSet.has('boss')) {
        this.boss.captured = true;
        this.boss.group.visible = false;
        this.bossIntroDone = true;
      }
    }

    // run state
    this.elapsed = 0;
    this.caughtThisRun = 0;
    this.cookiesCollected = 0;
    this.portalOpen = false;
    this.finished = false;
    this.paused = false;
    this.swingChecked = false;
    this.portalHintT = 0;
    this.currentGadget = this.save.currentGadget && this.save.gadgets.includes(this.save.currentGadget)
      ? this.save.currentGadget : 'net';

    // tutorial script (level 1-1)
    this.tutQueue = this.def.tutorial
      ? [[1.2, 'tutMove'], [6.5, 'tutNet'], [13, 'tutSneak'], [19, 'tutCam']]
      : [];

    // HUD init
    this.hud.show();
    this.hud.setLives(this.player.lives);
    this.hud.setEnergy(this.player.energy, this.player.maxEnergy);
    this.hud.setGadgets(this.save.gadgets, this.currentGadget);
    this.updateCaptureHud();

    Audio.startMusic(this.def.music);
    this.updatePortal(0);
  }

  get requiredMet() {
    if (this.def.bossRequired) return this.boss?.captured ?? false;
    return this.capturedSet.size >= this.def.required;
  }

  updateCaptureHud() {
    const total = this.def.pets.length + (this.def.boss ? 1 : 0);
    const req = this.def.bossRequired ? 1 : this.def.required;
    const cur = this.def.bossRequired ? (this.boss?.captured ? 1 : 0) : this.capturedSet.size;
    this.hud.setCaptures(cur, req, total);
  }

  // ---------------- effects ----------------
  burst(x, y, z, color, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = makeSparkle(color);
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2), 2 + Math.random() * 3, Math.sin(a) * (1 + Math.random() * 2));
      this.scene.add(m);
      this.sparkles.push({ mesh: m, vel: v, life: 0.9 });
    }
  }

  spawnProjectile(from, to) {
    const m = makeProjectile();
    m.position.set(from.x, from.y + 0.8, from.z);
    const dx = to.x - from.x, dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 7.5;
    const vel = new THREE.Vector3((dx / d) * speed, 4.2, (dz / d) * speed);
    this.scene.add(m);
    this.projectiles.push({ mesh: m, vel, life: 4 });
    Audio.sfx('swing');
  }

  // ---------------- damage / respawn ----------------
  onPlayerHurt() {
    this.hud.setEnergy(this.player.energy, this.player.maxEnergy);
    if (this.player.energy <= 0) this.loseLife();
  }

  loseLife() {
    this.player.lives -= 1;
    this.hud.setLives(Math.max(0, this.player.lives));
    if (this.player.lives < 0) {
      this.finished = true;
      Audio.stopMusic();
      Audio.sfx('gameover');
      this.opts.onGameOver();
      return;
    }
    this.hud.toast(t('lifeLost'));
    this.player.energy = this.player.maxEnergy;
    this.hud.setEnergy(this.player.energy, this.player.maxEnergy);
    this.player.spawnAt(this.respawnPoint.x, this.respawnPoint.z, this.player.heading);
  }

  // ---------------- capture ----------------
  doNetHit() {
    const zone = this.player.netHitZone();
    const rSq = zone.r * zone.r;
    const hasWaterNet = this.save.gadgets.includes('waternet') && this.currentGadget === 'waternet';

    // boss first
    if (this.boss && !this.boss.captured) {
      const dx = this.boss.group.position.x - zone.x;
      const dz = this.boss.group.position.z - zone.z;
      if (dx * dx + dz * dz < (zone.r + 1.6) * (zone.r + 1.6)) {
        const res = this.boss.tryCapture();
        if (res === 'captured') {
          this.capturedSet.add('boss');
          this.caughtThisRun += 1;
          Audio.sfx('fanfare');
          this.burst(this.boss.group.position.x, this.boss.group.position.y + 2, this.boss.group.position.z, 0xffe066, 16);
          this.hud.toast(t('caughtBoss'), 3000);
          this.updateCaptureHud();
          Audio.startMusic(this.def.music);
          this.opts.onScene?.('bossOutro', () => {});
          return;
        }
        if (res === 'hit') {
          Audio.sfx('capture');
          this.burst(this.boss.group.position.x, this.boss.group.position.y + 2.5, this.boss.group.position.z, 0xff9d5c, 10);
          return;
        }
      }
    }

    for (const pet of this.pets) {
      if (pet.captured) continue;
      const dx = pet.group.position.x - zone.x;
      const dz = pet.group.position.z - zone.z;
      const dy = Math.abs(pet.group.position.y - this.player.pos.y);
      if (dx * dx + dz * dz < rSq && dy < 2.2) {
        const res = pet.tryCapture(hasWaterNet);
        if (res === 'ok') {
          this.capturedSet.add(pet.def.id);
          this.caughtThisRun += 1;
          Audio.sfx('capture');
          this.burst(pet.group.position.x, pet.group.position.y + 0.8, pet.group.position.z, 0xffe066, 10);
          this.hud.toast(t('caught'), 1400);
          this.updateCaptureHud();
        } else if (res === 'water-blocked') {
          Audio.sfx('splash');
          this.hud.toast(t('waterBlocked'), 2200);
        }
      }
    }
  }

  // ---------------- portal ----------------
  updatePortal(dt) {
    const open = this.requiredMet;
    if (open && !this.portalOpen) {
      this.portalOpen = true;
      Audio.sfx('portal');
      this.hud.toast(t('portalOpen'), 2600);
    }
    const p = this.built.portal;
    p.ring.rotation.y += dt * (this.portalOpen ? 2.4 : 0.3);
    p.ringMat.color.setHex(this.portalOpen ? 0xffc93b : 0x777777);
    p.discMat.opacity = this.portalOpen ? 0.4 + Math.sin(this.elapsed * 4) * 0.12 : 0.08;
  }

  // ---------------- main update ----------------
  update(dt, input) {
    if (this.paused || this.finished) return;
    this.elapsed += dt;

    // tutorial hints
    if (this.tutQueue.length && this.elapsed > this.tutQueue[0][0]) {
      this.hud.comm('prof', t(this.tutQueue[0][1]), 4600);
      this.tutQueue.shift();
    }

    // gadget switching
    if (input.pressed('Digit1')) this.selectGadget('net');
    if (input.pressed('Digit2') && this.save.gadgets.includes('waternet')) this.selectGadget('waternet');

    // camera yaw
    const CAM_ROT = 2.4;
    if (input.camLeft()) this.camYaw += CAM_ROT * dt;
    if (input.camRight()) this.camYaw -= CAM_ROT * dt;

    // swing
    if (input.netPressed() && !this.player.swinging) {
      this.player.startSwing();
      this.swingChecked = false;
    }
    if (this.player.swinging && !this.swingChecked && this.player.swingT > 0.16) {
      this.swingChecked = true;
      this.doNetHit();
    }

    // player
    this.player.update(dt, input, this.camYaw);

    // lava
    const inLava = this.player.pos.y <= 0.05 && inCircleZone(this.def.lavas, this.player.pos.x, this.player.pos.z);
    if (inLava && this.player.hurtCooldown <= 0) {
      this.player.hurt(null);
      this.hud.toast(t('fellDown'), 1600);
      this.player.pos.set(this.lastSafe.x, 0.1, this.lastSafe.z);
      this.player.vel.set(0, 0, 0);
      this.hud.setEnergy(this.player.energy, this.player.maxEnergy);
      if (this.player.energy <= 0) { this.loseLife(); return; }
    }

    // track last safe standing spot
    this.safeTimer -= dt;
    if (this.safeTimer <= 0 && this.player.onGround && !this.player.inWater &&
        !inCircleZone(this.def.lavas, this.player.pos.x, this.player.pos.z)) {
      this.lastSafe.x = this.player.pos.x;
      this.lastSafe.z = this.player.pos.z;
      this.safeTimer = 0.5;
    }

    // pets
    for (const pet of this.pets) pet.update(dt, this.player);

    // boss trigger + update
    if (this.boss && !this.bossIntroDone && this.player.pos.z > this.def.boss.triggerZ) {
      this.bossIntroDone = true;
      this.paused = true;
      this.opts.onScene?.('bossIntro', () => {
        this.paused = false;
        this.boss.activate();
        if (this.def.bossMusic) Audio.startMusic(this.def.bossMusic);
        this.hud.toast(t('bossWarning'), 2600);
      });
      return;
    }
    if (this.boss) this.boss.update(dt, this.player);

    // cookies
    for (const c of this.built.cookies) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2.5;
      c.mesh.position.y = c.baseY + Math.sin(this.elapsed * 3 + c.baseY) * 0.08;
      const dx = c.mesh.position.x - this.player.pos.x;
      const dz = c.mesh.position.z - this.player.pos.z;
      const dy = c.mesh.position.y - (this.player.pos.y + 0.6);
      if (dx * dx + dz * dz < 1.2 && Math.abs(dy) < 1.6) {
        c.taken = true;
        c.mesh.visible = false;
        this.cookiesCollected += 1;
        Audio.sfx('pickup');
        if (this.player.energy < this.player.maxEnergy) {
          this.player.energy += 1;
          this.hud.setEnergy(this.player.energy, this.player.maxEnergy);
        }
      }
    }

    // checkpoints
    for (const cp of this.built.checkpoints) {
      if (cp.active) continue;
      const dx = cp.x - this.player.pos.x, dz = cp.z - this.player.pos.z;
      if (dx * dx + dz * dz < 2.8) {
        cp.active = true;
        cp.flagMat.color.setHex(0x2ecc71);
        this.respawnPoint = { x: cp.x, z: cp.z };
        Audio.sfx('checkpoint');
        this.hud.toast(t('checkpoint'), 1600);
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.vel.y -= 14 * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.life -= dt;
      const dx = pr.mesh.position.x - this.player.pos.x;
      const dz = pr.mesh.position.z - this.player.pos.z;
      const dy = pr.mesh.position.y - (this.player.pos.y + 0.8);
      if (dx * dx + dz * dz < 0.8 && Math.abs(dy) < 1.2) {
        this.player.hurt(pr.mesh.position);
        pr.life = 0;
      }
      if (pr.mesh.position.y < 0 || pr.life <= 0) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.vel.y -= 8 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.life -= dt;
      sp.mesh.material.opacity = Math.max(0, sp.life);
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        this.sparkles.splice(i, 1);
      }
    }

    // clouds drift
    for (const cl of this.built.clouds) {
      cl.position.x += dt * 0.6;
      if (cl.position.x > this.def.bounds.maxX + 30) cl.position.x = this.def.bounds.minX - 30;
    }

    // portal
    this.updatePortal(dt);
    const pdx = this.built.portal.group.position.x - this.player.pos.x;
    const pdz = this.built.portal.group.position.z - this.player.pos.z;
    const pDistSq = pdx * pdx + pdz * pdz;
    if (pDistSq < 4) {
      if (this.portalOpen) { this.complete(); return; }
      this.portalHintT -= dt;
      if (this.portalHintT <= 0) {
        this.portalHintT = 3;
        const remaining = this.def.bossRequired ? 1 : Math.max(0, this.def.required - this.capturedSet.size);
        this.hud.toast(t('needMore', { n: remaining }), 2400);
      }
    }

    // camera follow
    const dist = 8.6, height = 4.8;
    const tx = this.player.pos.x - Math.sin(this.camYaw) * dist;
    const tz = this.player.pos.z - Math.cos(this.camYaw) * dist;
    const ty = this.player.pos.y + height;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 5);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 5);
    this.camera.lookAt(this.player.pos.x, this.player.pos.y + 1.4, this.player.pos.z);

    // HUD timer
    this.hud.setTimer(this.elapsed);
  }

  selectGadget(g) {
    this.currentGadget = g;
    this.save.currentGadget = g;
    Audio.sfx('select');
    this.hud.setGadgets(this.save.gadgets, g);
  }

  complete() {
    this.finished = true;
    Audio.stopMusic();
    Audio.sfx('fanfare');
    const results = {
      levelId: this.levelId,
      captures: this.capturedSet,
      caughtThisRun: this.caughtThisRun,
      time: this.elapsed,
      cookies: this.cookiesCollected,
    };
    this.opts.onComplete(results);
  }

  dispose() {
    Audio.stopMusic();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) { m.map?.dispose(); m.dispose(); }
      }
    });
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
