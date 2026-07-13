// Orquestador del juego: escena Three.js, estados (menú/nivel/diálogo/pausa),
// construcción de niveles, captura de mascotas, jefe final y progresión.

import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { Player, Input } from './player.js';
import { Pet } from './pets.js';
import { Hud } from './hud.js';
import { DialogSystem } from './dialog.js';
import { Menus } from './menu.js';
import { loadSave, writeSave, resetSave } from './save.js';
import { setLang, t, getLang } from './i18n.js';
import { playMusic, stopMusic, sfx, unlockAudio } from './audio.js';
import { buildCookie, buildPortal, buildTree, buildRock, buildDeedee, buildSilva } from './models.js';

const STATE = { MENU: 0, PLAYING: 1, DIALOG: 2, PAUSED: 3, RESULTS: 4, CAPTURING: 5 };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.save = loadSave();
    setLang(this.save.lang);

    // --- Renderer / escena ---
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.camDist = 9;

    this.input = new Input();
    this.player = new Player(this.input);
    this.hud = new Hud();
    this.dialog = new DialogSystem();
    this.menus = new Menus(this);

    this.state = STATE.MENU;
    this.levelIndex = 0;
    this.level = null;
    this.levelGroup = null;
    this.pets = [];
    this.capturing = [];        // mascotas en animación de captura
    this.cookies = [];
    this.projectiles = [];
    this.portal = null;
    this.portalOpen = false;
    this.lives = 3;
    this.capturedCount = 0;
    this.levelTime = 0;
    this.radarOn = false;
    this.boss = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindKeys();

    this.clock = new THREE.Clock();
    this.menus.showMain();
    this.loop();
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      unlockAudio();
      if (this.state === STATE.DIALOG) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') this.dialog.advance();
        if (e.code === 'Escape') this.dialog.skipAll();
        return;
      }
      if (this.state === STATE.PLAYING) {
        if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
        if (e.code === 'KeyR' && this.gadgets().includes('radar')) {
          this.radarOn = !this.radarOn;
          this.hud.setRadarVisible(this.radarOn);
          sfx.select();
        }
        // cámara con Q/E
      } else if (this.state === STATE.PAUSED) {
        if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
      }
    });
    window.addEventListener('mousedown', () => unlockAudio(), { once: true });
  }

  gadgets() { return this.save.gadgets; }

  persist() { writeSave(this.save); }

  newGame() {
    this.save = resetSave();
    this.save.lang = getLang();
    this.persist();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  quitToMenu() {
    this.state = STATE.MENU;
    this.hud.hide();
    this.hud.setRadarVisible(false);
    stopMusic();
    playMusic('menu');
    this.menus.showMain();
  }

  // ---------- Construcción de nivel ----------
  startLevel(idx) {
    this.levelIndex = Math.min(idx, LEVELS.length - 1);
    const lv = LEVELS[this.levelIndex];
    this.level = lv;
    this.menus.hideAll();

    // limpiar escena
    if (this.levelGroup) this.scene.remove(this.levelGroup);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.pets = [];
    this.capturing = [];
    this.cookies = [];
    this.projectiles = [];
    this.portal = null;
    this.portalOpen = false;
    this.boss = null;
    this.capturedCount = 0;
    this.levelTime = 0;
    this.lives = 3;
    this.radarOn = false;
    this.hud.setRadarVisible(false);

    // ambiente
    this.scene.background = new THREE.Color(lv.sky);
    this.scene.fog = new THREE.Fog(lv.fog, 25, lv.size * 1.6);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 1.0);
    this.levelGroup.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    sun.position.set(14, 24, 10);
    sun.castShadow = true;
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
    sun.shadow.mapSize.set(1024, 1024);
    this.levelGroup.add(sun);

    // suelo
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(lv.size, 1, lv.size),
      new THREE.MeshToonMaterial({ color: lv.ground })
    );
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.levelGroup.add(ground);

    // plataformas
    for (const p of lv.platforms) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p[3], p[4], p[5]),
        new THREE.MeshToonMaterial({ color: new THREE.Color(lv.ground).offsetHSL(0.02, 0, 0.08) })
      );
      mesh.position.set(p[0], p[1], p[2]);
      mesh.castShadow = mesh.receiveShadow = true;
      this.levelGroup.add(mesh);
    }

    // decoración pseudoaleatoria pero determinista por nivel
    let seed = this.levelIndex * 1000 + 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const lim = lv.size / 2 - 2;
    for (let i = 0; i < lv.trees; i++) {
      const tr = buildTree(lv.theme);
      tr.position.set((rand() * 2 - 1) * lim, 0, (rand() * 2 - 1) * lim);
      tr.rotation.y = rand() * Math.PI * 2;
      const s = 0.8 + rand() * 0.7;
      tr.scale.set(s, s, s);
      this.levelGroup.add(tr);
    }
    for (let i = 0; i < lv.rocks; i++) {
      const rk = buildRock(lv.theme);
      rk.position.set((rand() * 2 - 1) * lim, 0, (rand() * 2 - 1) * lim);
      this.levelGroup.add(rk);
    }

    // mascotas
    for (const [type, x, z] of lv.pets) {
      const pet = new Pet(type, x, z, lv.size / 2);
      this.pets.push(pet);
      this.levelGroup.add(pet.mesh);
    }

    // galletas
    for (const [x, y, z] of lv.cookies) {
      const c = buildCookie();
      c.position.set(x, y, z);
      this.cookies.push(c);
      this.levelGroup.add(c);
    }

    // jugador
    if (!this.player.mesh.parent) this.scene.add(this.player.mesh);
    this.player.reset(0, lv.size / 2 - 5);
    this.camYaw = Math.PI;

    // jefe
    if (lv.boss) this.setupBoss();

    // HUD
    this.hud.show();
    this.hud.setLevelName(`${lv.icon} ${lv.name[getLang()]} — ${lv.worldName[getLang()]}`);
    this.hud.buildGadgetBar(this.gadgets());

    stopMusic();
    playMusic(lv.music);

    // diálogo de introducción
    this.state = STATE.DIALOG;
    this.dialog.start(lv.intro, () => {
      this.state = STATE.PLAYING;
      if (lv.boss) this.hud.flashMessage(t('bossHits')(0), 3);
      else this.hud.flashMessage(t('goal')(lv.required), 3);
    });
  }

  // ---------- Jefe final: Deedee en trono flotante ----------
  setupBoss() {
    const group = new THREE.Group();
    const throne = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.5, 0.6, 12),
      new THREE.MeshToonMaterial({ color: 0x8a2be2 })
    );
    throne.castShadow = true;
    group.add(throne);
    const deedee = buildDeedee();
    deedee.position.y = 0.3;
    deedee.scale.set(1.4, 1.4, 1.4);
    group.add(deedee);
    group.position.set(0, 3, 0);
    this.levelGroup.add(group);

    const silva = buildSilva();
    silva.position.set(4, 0, -12);
    this.levelGroup.add(silva);

    this.boss = {
      mesh: group,
      hits: 0,
      phase: 'hover',       // hover -> charge -> tired -> hover
      timer: 3,
      chargeDir: new THREE.Vector3(),
      angle: 0,
      spawnTimer: 8
    };
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    const pos = b.mesh.position;
    b.timer -= dt;

    if (b.phase === 'hover') {
      // órbita flotante alrededor del centro, disparando de vez en cuando
      b.angle += dt * 0.7;
      const r = 8 - b.hits * 1.5;
      pos.x = THREE.MathUtils.lerp(pos.x, Math.cos(b.angle) * r, dt * 2);
      pos.z = THREE.MathUtils.lerp(pos.z, Math.sin(b.angle) * r, dt * 2);
      pos.y = 3 + Math.sin(b.angle * 3) * 0.5;
      b.mesh.lookAt(this.player.pos.x, pos.y, this.player.pos.z);
      if (b.timer <= 0) {
        b.phase = 'charge';
        b.timer = 1.2;
        b.chargeDir = this.player.pos.clone().sub(pos).setY(0).normalize();
        sfx.dash();
      }
    } else if (b.phase === 'charge') {
      // embestida hacia el jugador, baja al suelo
      pos.y = THREE.MathUtils.lerp(pos.y, 1.0, dt * 6);
      pos.addScaledVector(b.chargeDir, dt * 13);
      const lim = this.level.size / 2 - 2;
      pos.x = THREE.MathUtils.clamp(pos.x, -lim, lim);
      pos.z = THREE.MathUtils.clamp(pos.z, -lim, lim);
      // daño por contacto durante embestida
      if (pos.distanceTo(this.player.pos.clone().setY(pos.y)) < 1.6) {
        if (this.player.hurt()) this.checkPlayerDeath();
      }
      if (b.timer <= 0) {
        b.phase = 'tired';   // casco recalentado: ventana de golpe
        b.timer = 2.4;
      }
    } else if (b.phase === 'tired') {
      pos.y = THREE.MathUtils.lerp(pos.y, 0.8, dt * 4);
      b.mesh.rotation.y += dt * 1.5; // mareado
      // golpe con la red durante la ventana
      if (this.player.netActive) {
        const netP = this.player.netPoint();
        if (netP.distanceTo(pos) < 2.0) {
          b.hits++;
          b.phase = 'hover';
          b.timer = 3 - b.hits * 0.4;
          sfx.bossHit();
          this.hud.flashMessage(t('bossHits')(b.hits), 2);
          if (b.hits >= 3) return this.bossDefeated();
        }
      }
      if (b.timer <= 0) {
        b.phase = 'hover';
        b.timer = 2.5;
      }
    }

    // refuerzos: mascotas rojas de apoyo
    b.spawnTimer -= dt;
    if (b.spawnTimer <= 0 && this.pets.filter(p => !p.captured).length < 3) {
      b.spawnTimer = 9;
      const a = Math.random() * Math.PI * 2;
      const pet = new Pet('red', Math.cos(a) * 10, Math.sin(a) * 10, this.level.size / 2);
      pet.setLight('alarm');
      this.pets.push(pet);
      this.levelGroup.add(pet.mesh);
    }
  }

  bossDefeated() {
    this.state = STATE.DIALOG;
    stopMusic();
    sfx.victory();
    this.dialog.start(this.level.outro, () => {
      this.save.finished = true;
      this.save.unlockedLevel = Math.max(this.save.unlockedLevel, LEVELS.length - 1);
      this.persist();
      this.hud.hide();
      this.menus.showResults(t('theEnd'), t('finaleBody'), () => this.quitToMenu());
      this.state = STATE.RESULTS;
    });
  }

  // ---------- Lógica de nivel ----------
  openPortal() {
    this.portalOpen = true;
    const p = buildPortal();
    p.position.set(0, 1.4, -this.level.size / 2 + 5);
    this.portal = p;
    this.levelGroup.add(p);
    sfx.portal();
    this.hud.flashMessage(t('portalOpen'), 3.2);
  }

  completeLevel() {
    this.state = STATE.RESULTS;
    stopMusic();
    sfx.victory();
    this.hud.hide();
    this.hud.setRadarVisible(false);

    const lv = this.level;
    // guardar progreso
    const best = this.save.levelCaptures[lv.id] ?? 0;
    if (this.capturedCount > best) {
      this.save.totalCaptured += this.capturedCount - best;
      this.save.levelCaptures[lv.id] = this.capturedCount;
    }
    let unlockMsg = '';
    if (lv.unlockGadget && !this.save.gadgets.includes(lv.unlockGadget)) {
      this.save.gadgets.push(lv.unlockGadget);
      unlockMsg = `\n${t('gadgetUnlocked')} ${t('gadgets.' + lv.unlockGadget)}!`;
    }
    const nextIdx = this.levelIndex + 1;
    if (nextIdx < LEVELS.length) this.save.unlockedLevel = Math.max(this.save.unlockedLevel, nextIdx);
    this.persist();

    const mins = Math.floor(this.levelTime / 60);
    const secs = Math.floor(this.levelTime % 60).toString().padStart(2, '0');
    const body = `${t('petsCaptured')}: ${this.capturedCount}/${lv.pets.length}\n${t('timeUsed')}: ${mins}:${secs}${unlockMsg}`;

    this.menus.showResults(t('levelClear'), body, () => {
      if (nextIdx < LEVELS.length) this.startLevel(nextIdx);
      else this.quitToMenu();
    });
  }

  checkPlayerDeath() {
    if (this.player.health > 0) return;
    this.lives--;
    sfx.lose();
    if (this.lives <= 0) {
      this.state = STATE.RESULTS;
      stopMusic();
      this.hud.hide();
      this.menus.showResults(t('gameOver'), t('gameOverBody'), () => this.quitToMenu());
      return;
    }
    this.hud.flashMessage(t('lifeLost'), 2);
    this.player.reset(0, this.level.size / 2 - 5);
  }

  spawnProjectile(from, dir) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5533 })
    );
    m.position.copy(from).add(new THREE.Vector3(0, 0.8, 0));
    this.levelGroup.add(m);
    this.projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(9), life: 3 });
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this.menus.showPause();
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this.menus.hidePause();
    }
  }

  // ---------- Bucle principal ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;

    if (this.state === STATE.DIALOG) {
      this.dialog.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    if (this.state !== STATE.PLAYING && this.state !== STATE.CAPTURING) {
      if (this.level) this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    this.levelTime += dt;

    // cámara: rotación con Q/E
    if (this.input.has('KeyQ')) this.camYaw += dt * 2.2;
    if (this.input.has('KeyE')) this.camYaw -= dt * 2.2;

    // jugador
    this.player.update(dt, this.camYaw, this.level, this.level.platforms, this.gadgets(), 'net');

    // mascotas
    const alive = [];
    for (const pet of this.pets) {
      if (pet.captured) continue;
      const ev = pet.update(dt, this.player.pos, time);
      if (ev.attack && this.player.hurt()) this.checkPlayerDeath();
      if (ev.shoot) this.spawnProjectile(pet.mesh.position, ev.shoot);

      // aturdir con el bastón
      if (this.player.batonActive) {
        const d = pet.mesh.position.distanceTo(this.player.pos);
        if (d < 2.2) pet.stun(3);
      }

      // captura con la red
      if (this.player.netActive) {
        const netP = this.player.netPoint();
        const petP = pet.mesh.position.clone().setY(netP.y);
        if (netP.distanceTo(petP) < 1.15) {
          pet.captured = true;
          this.capturing.push(pet);
          this.capturedCount++;
          sfx.capture();
          const remaining = this.level.required - this.capturedCount;
          if (remaining > 0) this.hud.flashMessage(t('remaining')(remaining), 1.4);
          continue;
        }
      }
      alive.push(pet);
    }

    // animación de captura
    this.capturing = this.capturing.filter((pet) => {
      if (pet.playCapture(dt)) {
        this.levelGroup.remove(pet.mesh);
        return false;
      }
      return true;
    });

    // abrir portal al llegar al objetivo
    if (!this.level.boss && !this.portalOpen && this.capturedCount >= this.level.required) {
      this.openPortal();
    }

    // portal
    if (this.portal) {
      this.portal.rotation.y += dt * 1.2;
      this.portal.userData.ring.rotation.z += dt * 2;
      if (this.portal.position.distanceTo(this.player.pos.clone().setY(this.portal.position.y)) < 1.4) {
        return this.completeLevel();
      }
    }

    // galletas
    for (let i = this.cookies.length - 1; i >= 0; i--) {
      const c = this.cookies[i];
      c.rotation.y += dt * 2;
      c.position.y += Math.sin(time * 3 + i) * dt * 0.15;
      if (c.position.distanceTo(this.player.pos.clone().setY(c.position.y)) < 1.0) {
        this.levelGroup.remove(c);
        this.cookies.splice(i, 1);
        this.player.energy = Math.min(100, this.player.energy + 35);
        if (this.player.health < 3) this.player.health++;
        sfx.pickup();
      }
    }

    // proyectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.life -= dt;
      const hit = pr.mesh.position.distanceTo(this.player.pos.clone().add(new THREE.Vector3(0, 0.8, 0))) < 0.85;
      if (hit) {
        if (this.player.hurt()) this.checkPlayerDeath();
      }
      if (hit || pr.life <= 0) {
        this.levelGroup.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // jefe
    this.updateBoss(dt);

    // aviso de energía baja
    if (this.player.energy < 8 && Math.floor(time) % 5 === 0) {
      // mensaje ocasional, no cada frame
      if (!this._energyWarned) { this.hud.flashMessage(t('energyLow'), 1.6); this._energyWarned = true; }
    } else if (this.player.energy > 20) {
      this._energyWarned = false;
    }

    // cámara sigue a Benito
    const camTarget = this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const camPos = new THREE.Vector3(
      camTarget.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
      camTarget.y + Math.sin(this.camPitch) * this.camDist,
      camTarget.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist
    );
    this.camera.position.lerp(camPos, 1 - Math.pow(0.0001, dt));
    this.camera.lookAt(camTarget);

    // HUD
    this.hud.update(this.player, this.lives, this.capturedCount, this.level.required);
    if (this.radarOn) this.hud.drawRadar(this.player, this.pets, this.level.size / 2);

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
}
