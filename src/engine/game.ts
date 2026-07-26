/**
 * Bucle principal del juego: monta la escena, carga niveles, dirige la lógica
 * de captura, coleccionables, jefes y transiciones, y publica el estado a la
 * interfaz mediante el bus de eventos.
 */
import * as THREE from 'three';
import { emit, type MinimapBlip } from '../core/events';
import { getSettings, qualityPreset } from '../core/settings';
import { pollInput, type InputState } from '../core/input';
import { playMusic, setMusicIntensity, sfx, stopMusic } from '../core/audio';
import { GADGETS, type GadgetId, isGadgetId } from '../content/gadgets';
import { getLevel, getWorld, levelPetTotal, type LevelSpec } from '../content/worlds';
import {
  createBlobShadow,
  createSkyDome,
  tickCelMaterials,
  tickSky,
  updateCelFog,
  updateCelLighting,
} from './celMaterial';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { generateLevel, updateMovingPlatforms, type GeneratedLevel } from './levelGen';
import { buildCoin, buildCookie, buildTimeGate } from './models';
import { ParticleSystem } from './particles';
import { createCameraRig, shakeCamera, updateCamera, type CameraRig } from './cameraRig';
import {
  createPlayer,
  cycleGadget,
  damagePlayer,
  gadgetHitPoint,
  healPlayer,
  respawnPlayer,
  selectGadget,
  unlockGadget,
  updatePlayer,
  useGadget,
  type PlayerState,
  PLAYER_MAX_ENERGY,
  PLAYER_MAX_HEALTH,
} from './player';
import {
  capturePet,
  createPet,
  playerNoiseLevel,
  stunPet,
  tryCapture,
  updatePet,
  type Pet,
} from './pet';
import { createBoss, hitBoss, tryCaptureBoss, updateBoss, type Boss, type BossProjectile } from './boss';
import { clamp } from './mathx';
import { surfaceBelow } from './physics';

type Collectible = {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  kind: 'coin' | 'cookie';
  taken: boolean;
  bob: number;
};

export type GameCallbacks = {
  onLevelComplete: (result: {
    levelId: string;
    caught: number;
    total: number;
    coins: number;
    time: number;
    gadgetUnlocked?: string;
  }) => void;
  onGameOver: (levelId: string) => void;
  onComms: (key: string) => void;
};

const GRAVITY = 34;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  player: PlayerState;
  particles = new ParticleSystem(360);

  level: GeneratedLevel | null = null;
  spec: LevelSpec | null = null;
  pets: Pet[] = [];
  boss: Boss | null = null;
  collectibles: Collectible[] = [];
  projectiles: (BossProjectile & { mesh: THREE.Mesh })[] = [];

  private sun = new THREE.DirectionalLight(0xffffff, 1.6);
  private hemi = new THREE.HemisphereLight(0x99bbff, 0x334422, 0.6);
  private fill = new THREE.DirectionalLight(0xffffff, 0.35);
  /**
   * Luz ambiental por paleta. El sombreado toon solo devuelve el suelo de la
   * banda oscura sobre la luz direccional; sin este relleno, los mundos de
   * paleta oscura (lava, fábrica, Dimensión X) se hunden en negro.
   */
  private ambient = new THREE.AmbientLight(0xffffff, 0.9);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private blobs: { mesh: THREE.Mesh; follow: () => THREE.Vector3; radius: number }[] = [];
  private sky: THREE.Mesh | null = null;
  private gate: { group: THREE.Group; ring: THREE.Mesh; portal: THREE.Mesh } | null = null;
  private gateOpen = false;
  private levelGroup: THREE.Group | null = null;

  private clock = new THREE.Clock();
  private running = false;
  private paused = false;
  private frameHandle = 0;
  private elapsed = 0;
  private levelTime = 0;
  private caught = 0;
  private coinsThisLevel = 0;
  private hudTimer = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private finished = false;
  private commsTimer = 0;
  private shownComms = new Set<string>();

  callbacks: GameCallbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    const q = qualityPreset();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: getSettings().quality !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x101828);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES comprime los altos: sin él, los colores saturados del cel shading
    // se queman en cuanto entra la luz directa más el brillo emisivo.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.rig = createCameraRig(canvas.clientWidth / Math.max(1, canvas.clientHeight));
    this.player = createPlayer(q.outlines);
    this.scene.add(this.player.rig.root);
    this.scene.add(this.particles.mesh);

    // Sombra ceñida al jugador: un mapa pequeño sobre poca área da sombras
    // nítidas donde importa, en vez de una mancha borrosa sobre todo el nivel.
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.quality === 'high' ? 2048 : 1024, q.quality === 'high' ? 2048 : 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 130;
    this.sun.shadow.bias = -0.0012;
    /**
     * Sombra parcial. Por defecto la sombra proyectada anula toda la luz
     * direccional, y en los mundos de paleta oscura eso dejaba zonas enteras
     * en negro con el personaje invisible. Un 60 % conserva lectura y encaja
     * mejor con el sombreado plano de dibujo animado.
     */
    this.sun.shadow.intensity = 0.6;
    this.sun.shadow.normalBias = 0.035;
    const shadowCam = this.sun.shadow.camera as THREE.OrthographicCamera;
    shadowCam.left = -34;
    shadowCam.right = 34;
    shadowCam.top = 34;
    shadowCam.bottom = -34;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(this.hemi);
    this.scene.add(this.ambient);
    // Luz de relleno opuesta: evita que la cara en sombra quede plana
    this.fill.position.set(-24, 18, -18);
    this.scene.add(this.fill);

    this.setupComposer();
    this.resize();
  }

  /** Cadena de post-proceso: solo bloom, que es lo que hace brillar el neón. */
  private setupComposer(): void {
    const q = qualityPreset();
    if (!q.bloom) {
      this.composer = null;
      return;
    }
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.rig.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      q.bloomStrength,
      0.5,
      0.92,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloom = bloom;
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.camera.aspect = w / Math.max(1, h);
    this.rig.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    this.bloom?.setSize(w, h);
  }

  // ─────────────────────────── Ciclo de vida del nivel ───────────────────────────

  loadLevel(levelId: string, gadgets: GadgetId[], lives = 3): void {
    this.unloadLevel();
    const spec = getLevel(levelId);
    if (!spec) throw new Error(`Nivel desconocido: ${levelId}`);
    this.spec = spec;
    this.finished = false;
    this.caught = 0;
    this.coinsThisLevel = 0;
    this.levelTime = 0;
    this.gateOpen = false;
    this.shownComms.clear();

    const q = qualityPreset();
    const level = generateLevel(spec);
    this.level = level;
    this.levelGroup = level.group;
    this.scene.add(level.group);

    // ── Ambiente ──
    // La cúpula recibe (cenit, horizonte): la paleta los guarda al revés
    this.sky = createSkyDome(spec.palette.sky[1], spec.palette.sky[0]);
    this.scene.add(this.sky);
    this.scene.fog = new THREE.FogExp2(spec.palette.fog, spec.palette.fogDensity);
    this.renderer.setClearColor(spec.palette.fog);

    const sunColor = new THREE.Color(spec.palette.sun);
    const ambient = new THREE.Color(spec.palette.ambient);
    this.sun.color.copy(sunColor);
    this.hemi.color.copy(new THREE.Color(spec.palette.sky[1]));
    this.hemi.groundColor.copy(new THREE.Color(spec.palette.ground));
    /**
     * Presupuesto de luz. Las cuatro fuentes deben sumar en torno a 1.6 sobre
     * una cara iluminada de frente; por encima de eso el tonemapping ya no
     * salva los tonos claros y las superficies horizontales se queman a blanco
     * (era lo que pasaba con las tarimas de madera vistas desde arriba).
     */
    this.sun.intensity = spec.palette.sunIntensity * 0.62;
    this.hemi.intensity = 0.36;
    this.ambient.color.copy(ambient).lerp(new THREE.Color(0xffffff), 0.3);
    // Las paletas oscuras necesitan más relleno; las claras, menos
    const groundLum = new THREE.Color(spec.palette.ground).getHSL({ h: 0, s: 0, l: 0 }).l;
    this.ambient.intensity = clamp(0.62 - groundLum * 0.3, 0.34, 0.6);
    this.fill.color.copy(new THREE.Color(spec.palette.sky[1])).lerp(new THREE.Color(0xffffff), 0.4);
    this.fill.intensity = 0.2;
    updateCelLighting(new THREE.Vector3(0.42, 0.82, 0.36), sunColor, ambient, spec.palette.sunIntensity);
    // La niebla toma el color del horizonte para que el terreno se funda con el cielo
    updateCelFog(new THREE.Color(spec.palette.fog), spec.palette.fogDensity);

    // ── Jugador ──
    this.player.unlocked = gadgets.filter(isGadgetId);
    if (this.player.unlocked.length === 0) this.player.unlocked = ['timeNet'];
    selectGadget(this.player, this.player.unlocked[0]);
    this.player.lives = lives;
    this.player.health = PLAYER_MAX_HEALTH;
    this.player.energy = PLAYER_MAX_ENERGY;
    this.player.dead = false;
    this.player.checkpoint.copy(level.playerSpawn);
    respawnPlayer(this.player, level.playerSpawn);
    this.addBlobShadow(() => this.player.actor.position, 0.85);
    this.rig.yaw = level.spawnYaw;
    this.player.yaw = level.spawnYaw;
    this.player.rig.root.rotation.y = level.spawnYaw;
    this.rig.pitch = 0.32;
    this.rig.firstPerson = false;

    // ── Mascotas ──
    for (const s of level.petSpawns) {
      const pet = createPet(s.color, s.pos, s.patrol, q.outlines);
      this.pets.push(pet);
      this.scene.add(pet.rig.root);
      this.addBlobShadow(() => pet.actor.position, 0.55);
    }

    // ── Jefe ──
    if (spec.boss && level.bossArena) {
      this.boss = createBoss(spec.boss, level.bossArena, q.outlines);
      this.scene.add(this.boss.rig.root);
      const boss = this.boss;
      this.addBlobShadow(() => boss.actor.position, spec.boss === 'guardian' ? 1.5 : 1.1);
      emit('bossHealth', null);
    }

    // ── Coleccionables ──
    for (const p of level.coinSpawns) this.addCollectible('coin', p);
    for (const p of level.cookieSpawns) this.addCollectible('cookie', p);

    // ── Puerta temporal ──
    const gate = buildTimeGate();
    gate.group.position.copy(level.gatePosition);
    this.scene.add(gate.group);
    this.gate = gate;
    this.setGateOpen(false);

    playMusic(spec.music, 0.5);
    this.emitHud();
    this.queueComms('comms.start', 1.5);
  }

  /**
   * Sombra de contacto bajo cada figura. El mapa de sombras solo cubre un radio
   * alrededor del jugador; estos discos aseguran que toda criatura, esté donde
   * esté, se lea apoyada en el suelo y no flotando.
   */
  private addBlobShadow(follow: () => THREE.Vector3, radius: number): void {
    const mesh = createBlobShadow(radius);
    this.scene.add(mesh);
    this.blobs.push({ mesh, follow, radius });
  }

  private updateBlobShadows(): void {
    const level = this.level;
    if (!level) return;
    for (const b of this.blobs) {
      const p = b.follow();
      const ground = surfaceBelow(level.world, p.x, p.z, p.y + 0.3);
      const height = Math.max(0, p.y - ground);
      // Se difumina y encoge con la altura, como una sombra real
      const fade = Math.max(0, 1 - height / 9);
      b.mesh.visible = fade > 0.04;
      if (!b.mesh.visible) continue;
      b.mesh.position.set(p.x, ground + 0.045, p.z);
      b.mesh.scale.setScalar(b.radius * (1 + height * 0.055));
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
    }
  }

  private addCollectible(kind: 'coin' | 'cookie', pos: THREE.Vector3): void {
    const mesh = kind === 'coin' ? buildCoin() : buildCookie();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.collectibles.push({ mesh, pos: pos.clone(), kind, taken: false, bob: Math.random() * 6.28 });
  }

  unloadLevel(): void {
    for (const b of this.blobs) {
      this.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    this.blobs = [];
    for (const pet of this.pets) this.scene.remove(pet.rig.root);
    this.pets = [];
    if (this.boss) {
      this.scene.remove(this.boss.rig.root);
      this.boss = null;
    }
    for (const c of this.collectibles) this.scene.remove(c.mesh);
    this.collectibles = [];
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    if (this.gate) {
      this.scene.remove(this.gate.group);
      this.gate = null;
    }
    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      (this.sky.material as THREE.Material).dispose();
      this.sky = null;
    }
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup = null;
    }
    if (this.level) {
      this.level.dispose();
      this.level = null;
    }
    this.particles.clear();
    emit('bossHealth', null);
  }

  // ─────────────────────────── Bucle ───────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.frameHandle = requestAnimationFrame(loop);
      this.frame();
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  setPaused(v: boolean): void {
    this.paused = v;
    if (v) setMusicIntensity(0.2);
  }

  dispose(): void {
    this.stop();
    this.unloadLevel();
    this.particles.dispose();
    stopMusic(0.3);
    this.renderer.dispose();
  }

  private frame(): void {
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.elapsed += dt;

    // Métrica de FPS para el HUD de rendimiento
    this.fpsAccum += raw;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      emit('fps', Math.round(this.fpsFrames / this.fpsAccum));
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    tickCelMaterials(this.elapsed);

    if (!this.paused && this.level) {
      this.update(dt);
    }

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.rig.camera);
  }

  private update(dt: number): void {
    const level = this.level!;
    const spec = this.spec!;
    const input = pollInput(dt);
    this.levelTime += dt;
    this.commsTimer = Math.max(0, this.commsTimer - dt);

    if (input.pausePressed) emit('requestPause', undefined);

    updateMovingPlatforms(level, this.elapsed);

    // ── Cámara y puntería ──
    if (input.aimPressed) this.rig.firstPerson = !this.rig.firstPerson;
    const speedRatio = clamp(Math.hypot(this.player.actor.velocity.x, this.player.actor.velocity.z) / 12.4, 0, 1);
    updateCamera(
      this.rig,
      this.player.actor.position,
      level.world,
      input.lookX,
      input.lookY,
      dt,
      this.player.yaw,
      speedRatio,
      getSettings().screenShake,
      level.cameraBlockers,
    );

    // ── Selección de artefacto ──
    if (input.gadgetNext) cycleGadget(this.player, 1);
    if (input.gadgetPrev) cycleGadget(this.player, -1);
    if (input.gadgetDirect >= 0 && input.gadgetDirect < this.player.unlocked.length) {
      selectGadget(this.player, this.player.unlocked[input.gadgetDirect]);
    }
    if (input.radarPressed && this.player.unlocked.includes('petRadar')) {
      selectGadget(this.player, 'petRadar');
    }

    // ── Jugador ──
    const camYaw = this.rig.firstPerson ? this.rig.yaw : this.rig.yaw;
    if (this.rig.firstPerson) this.player.yaw = this.rig.yaw;
    updatePlayer(
      this.player,
      level.world,
      {
        moveX: input.moveX,
        moveY: input.moveY,
        jumpPressed: input.jumpPressed,
        jumpHeld: input.jump,
        sneak: input.sneak,
        cameraYaw: camYaw,
      },
      {
        slippery: !!spec.slippery,
        lowGravity: !!spec.lowGravity,
        canSwim: this.player.unlocked.includes('waterNet'),
        liquidDamage: spec.liquid.damage,
      },
      dt,
    );

    if (this.player.dashTimer > 0) {
      this.particles.jet(
        this.player.actor.position.clone().setY(this.player.actor.position.y + 0.6),
        new THREE.Vector3(-Math.sin(this.player.yaw), 0.2, -Math.cos(this.player.yaw)),
        2,
        6,
        0x9fff40,
      );
    }
    if (this.player.hoopTimer > 0 && !this.player.actor.onGround) {
      this.particles.jet(
        this.player.actor.position.clone(),
        new THREE.Vector3(0, -1, 0),
        1,
        3,
        0xc080ff,
      );
    }

    // ── Uso de artefactos ──
    if (input.attackPressed) this.handleGadgetUse();

    // ── Muerte y reaparición ──
    this.handleDeath(dt);

    // ── Líquido dañino ──
    const liquidDamage = spec.liquid.damage;
    if (liquidDamage > 0 && this.player.actor.inLiquid) {
      const canSwimHere = spec.liquid.kind === 'water' && this.player.unlocked.includes('waterNet');
      if (!canSwimHere) {
        if (damagePlayer(this.player, liquidDamage * dt * 2.2)) this.onPlayerDied();
        this.particles.burst(this.player.actor.position, 2, 3, spec.palette.liquid, { life: 0.4 });
        // Empujar fuera del líquido
        this.player.actor.velocity.y = Math.max(this.player.actor.velocity.y, 5);
      }
    }
    if (spec.liquid.kind === 'void' && this.player.actor.position.y < spec.liquid.level + 4) {
      if (damagePlayer(this.player, 100)) this.onPlayerDied();
    }
    // Red de seguridad para todos los niveles: caer fuera del mundo cuesta una
    // vida en vez de dejar a Benito cayendo indefinidamente.
    if (this.player.actor.position.y < spec.liquid.level - 45) {
      this.player.health = 0.1;
      this.player.invuln = 0;
      if (damagePlayer(this.player, 100)) this.onPlayerDied();
    }
    if (spec.liquid.kind === 'water' && this.player.actor.inLiquid && Math.random() < dt * 6) {
      this.particles.burst(this.player.actor.position.clone().setY(spec.liquid.level), 2, 2.5, 0xaaddff, { life: 0.4, gravity: 8 });
    }

    // ── Mascotas ──
    this.updatePets(dt);

    // ── Jefe ──
    this.updateBossFight(dt);

    // ── Proyectiles ──
    this.updateProjectiles(dt);

    // ── Coleccionables ──
    this.updateCollectibles(dt);

    // ── Obstáculos ──
    this.updateObstacles(dt);

    // ── Puerta temporal ──
    this.updateGate(dt);

    // ── Luz de sombra siguiendo al jugador ──
    const p = this.player.actor.position;
    this.sun.position.set(p.x + 26, p.y + 42, p.z + 22);
    this.sun.target.position.copy(p);
    this.sun.target.updateMatrixWorld();
    this.fill.position.set(p.x - 26, p.y + 20, p.z - 20);
    this.fill.target.position.copy(p);
    this.fill.target.updateMatrixWorld();
    this.updateBlobShadows();

    if (this.sky) {
      this.sky.position.copy(this.rig.camera.position);
      tickSky(this.sky, this.elapsed);
    }

    this.particles.update(dt);

    // ── HUD ──
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
      this.emitMinimap();
    }

    // Tensión musical según cuántas mascotas te han visto
    const alerted = this.pets.filter((x) => !x.captured && x.alert === 2).length;
    setMusicIntensity(clamp(0.35 + alerted * 0.18 + (this.boss ? 0.3 : 0), 0, 1));

    // Avisos contextuales
    if (this.player.health < 30) this.queueComms('comms.lowHealth', 0);
  }

  // ─────────────────────────── Sistemas ───────────────────────────

  private handleGadgetUse(): void {
    const action = useGadget(this.player);
    if (!action) {
      if (this.player.energy < GADGETS[this.player.currentGadget].cost) {
        emit('toast', { key: 'toast.noEnergy', icon: '⚡' });
      }
      return;
    }
    const def = GADGETS[this.player.currentGadget];
    const from = this.player.actor.position;
    const hitPoint = gadgetHitPoint(this.player);

    switch (action) {
      case 'net': {
        this.particles.ring(hitPoint, 10, 2.4, def.color);
        let hitSomething = false;
        for (const pet of this.pets) {
          if (pet.captured) continue;
          if (pet.actor.inLiquid && this.player.currentGadget !== 'waterNet') continue;
          const r = tryCapture(pet, from, this.player.yaw, def.reach, def.arc);
          if (r === 'caught') {
            this.onPetCaught(pet);
            hitSomething = true;
            break;
          }
          if (r === 'dodged') {
            emit('toast', { key: 'toast.petEscaped', icon: '💨' });
            this.callbacks.onComms('comms.benitoMiss1');
            hitSomething = true;
            break;
          }
        }
        if (!hitSomething && this.boss) {
          const r = tryCaptureBoss(this.boss, from, def.reach + 1.5);
          if (r === 'captured') this.onBossCaptured();
        }
        break;
      }
      case 'club': {
        this.particles.burst(hitPoint, 8, 5, 0xffb040, { life: 0.5 });
        shakeCamera(this.rig, 0.25);
        for (const pet of this.pets) {
          if (pet.captured) continue;
          const d = pet.actor.position.distanceTo(hitPoint);
          if (d < def.reach) {
            stunPet(pet, 3.4);
            this.particles.burst(pet.actor.position.clone().setY(pet.actor.position.y + 1.2), 10, 4, 0xffe08a);
          }
        }
        if (this.boss && this.boss.actor.position.distanceTo(hitPoint) < def.reach + 1.4) {
          const r = hitBoss(this.boss, 'stun');
          if (r !== 'blocked') {
            shakeCamera(this.rig, 0.5);
            this.particles.burst(this.boss.actor.position.clone().setY(this.boss.actor.position.y + 1.5), 16, 7, 0xffd23f);
          }
        }
        this.breakObstacles(hitPoint, 'stunClub', def.reach);
        break;
      }
      case 'punch': {
        this.particles.burst(hitPoint, 14, 7, 0xff5a5a, { life: 0.6 });
        shakeCamera(this.rig, 0.5);
        for (const pet of this.pets) {
          if (pet.captured) continue;
          if (pet.actor.position.distanceTo(hitPoint) < def.reach) {
            stunPet(pet, 4);
            pet.actor.velocity.y = 9;
          }
        }
        if (this.boss && this.boss.actor.position.distanceTo(hitPoint) < def.reach + 1.6) {
          const r = hitBoss(this.boss, 'punch');
          if (r !== 'blocked') {
            shakeCamera(this.rig, 0.8);
            this.particles.burst(this.boss.actor.position.clone().setY(this.boss.actor.position.y + 1.5), 20, 9, 0xff5a5a);
          }
        }
        this.breakObstacles(hitPoint, 'magicPunch', def.reach + 1.5);
        this.breakObstacles(hitPoint, 'stunClub', def.reach);
        break;
      }
      case 'freeze': {
        for (const pet of this.pets) {
          if (!pet.captured) pet.frozen = GADGETS.timeFreeze.duration;
        }
        this.particles.ring(this.player.actor.position, 26, 12, 0xffffff);
        shakeCamera(this.rig, 0.3);
        break;
      }
      case 'radar': {
        this.particles.ring(this.player.actor.position, 22, 9, 0x40ffa0);
        break;
      }
      case 'dash':
      case 'hoop':
      default:
        break;
    }

    // El impulso atraviesa las puertas de anillos y las cajas
    if (action === 'dash') {
      this.breakObstacles(this.player.actor.position, 'dashHoop', 4);
    }
  }

  private breakObstacles(at: THREE.Vector3, gadget: string, radius: number): void {
    const level = this.level;
    if (!level) return;
    for (const o of level.obstacles) {
      if (o.broken || o.requires !== gadget) continue;
      if (o.mesh.position.distanceTo(at) > radius + 2.4) continue;
      o.broken = true;
      if (o.box) o.box.solid = false;
      o.mesh.visible = false;
      this.particles.burst(o.mesh.position.clone().setY(o.mesh.position.y + 1), 18, 7, 0xffffff, { life: 0.8 });
      sfx('explosion');
      shakeCamera(this.rig, 0.35);
      if (o.reward === 'cookie') {
        this.addCollectible('cookie', o.mesh.position.clone().setY(o.mesh.position.y + 0.8));
      }
    }
  }

  private updatePets(dt: number): void {
    const level = this.level!;
    const spec = this.spec!;
    const playerSpeed = Math.hypot(this.player.actor.velocity.x, this.player.actor.velocity.z);
    const noise = playerNoiseLevel(playerSpeed, this.player.crouching, this.player.actor.onGround);
    const colorBlindSafe = getSettings().colorBlindSafe;
    const gravity = GRAVITY * (spec.lowGravity ? 0.58 : 1);
    const playerVisible = this.player.invuln < 1.6 || true;

    for (const pet of this.pets) {
      if (pet.captured && pet.captureProgress > 1.4) {
        if (pet.rig.root.parent) this.scene.remove(pet.rig.root);
        continue;
      }
      // Simulación reducida a distancia: mantiene los 60 FPS con muchas mascotas
      const dist = pet.actor.position.distanceTo(this.player.actor.position);
      if (dist > 90) continue;

      const r = updatePet(
        pet,
        level.world,
        { playerPos: this.player.actor.position, playerNoise: noise, playerVisible, colorBlindSafe },
        dt,
        gravity,
      );

      if (r.attacked) {
        if (damagePlayer(this.player, 12)) this.onPlayerDied();
        else {
          this.callbacks.onComms('comms.benitoHurt1');
          shakeCamera(this.rig, 0.4);
        }
      }
      if (r.projectile) {
        this.spawnProjectile({
          pos: r.projectile.from,
          vel: r.projectile.dir.multiplyScalar(17),
          life: 3,
          radius: 0.5,
          damage: 10,
          color: 0x4fd86a,
          homing: false,
        });
      }
      if (r.alertChanged && pet.alert === 2) {
        this.queueComms('comms.alert', 0);
      }
    }
  }

  private updateBossFight(dt: number): void {
    const boss = this.boss;
    if (!boss || !this.level) return;

    // El jefe despierta cuando el jugador entra en la arena
    if (boss.state === 'intro' && this.player.actor.position.distanceTo(boss.arena) > boss.arenaRadius + 6) {
      return;
    }

    const res = updateBoss(boss, { playerPos: this.player.actor.position, world: this.level.world, gravity: GRAVITY }, dt);

    for (const p of res.newProjectiles) this.spawnProjectile(p);

    if (res.meleeHit) {
      if (damagePlayer(this.player, boss.kind === 'guardian' ? 20 : 15)) this.onPlayerDied();
      shakeCamera(this.rig, 0.6);
    }
    if (res.shockwave) {
      this.particles.ring(res.shockwave, 30, 14, 0xffaa40);
      shakeCamera(this.rig, 0.9);
      const d = this.player.actor.position.distanceTo(res.shockwave);
      if (d < 11 && this.player.actor.onGround) {
        if (damagePlayer(this.player, 16)) this.onPlayerDied();
      }
    }

    if (!boss.defeated) {
      emit('bossHealth', { name: boss.name, hp: boss.hp, max: boss.maxHp, phase: boss.phase });
    }

    if (boss.defeated && boss.stateTimer <= 0 && boss.captured) {
      this.scene.remove(boss.rig.root);
      this.boss = null;
      emit('bossHealth', null);
      // Vencer al jefe abre la puerta aunque falten mascotas
      this.setGateOpen(true);
    }
  }

  private spawnProjectile(p: BossProjectile): void {
    const geo = new THREE.SphereGeometry(p.radius, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: p.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(p.pos);
    this.scene.add(mesh);
    this.projectiles.push({ ...p, mesh });
  }

  private updateProjectiles(dt: number): void {
    const pp = this.player.actor.position;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.homing) {
        const dir = pp.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(p.pos).normalize();
        p.vel.lerp(dir.multiplyScalar(p.vel.length()), Math.min(1, dt * 1.5));
      }
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;

      const hitPlayer = p.pos.distanceTo(new THREE.Vector3(pp.x, pp.y + 0.8, pp.z)) < p.radius + 0.7;
      const groundH = this.level!.world.terrainHeight(p.pos.x, p.pos.z);
      if (hitPlayer || p.life <= 0 || p.pos.y < groundH - 0.5) {
        if (hitPlayer) {
          if (damagePlayer(this.player, p.damage)) this.onPlayerDied();
          shakeCamera(this.rig, 0.35);
        }
        this.particles.burst(p.pos, 8, 4, p.color, { life: 0.4 });
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateCollectibles(dt: number): void {
    const pp = this.player.actor.position;
    for (const c of this.collectibles) {
      if (c.taken) continue;
      c.bob += dt * 2.4;
      c.mesh.position.y = c.pos.y + 0.5 + Math.sin(c.bob) * 0.22;
      c.mesh.rotation.y += dt * (c.kind === 'coin' ? 2.4 : 1.2);

      if (c.mesh.position.distanceTo(pp) < 1.9) {
        c.taken = true;
        c.mesh.visible = false;
        if (c.kind === 'coin') {
          this.coinsThisLevel++;
          sfx('coin');
          this.particles.burst(c.mesh.position, 14, 5, 0xffd23f);
          emit('toast', { key: 'toast.coin', params: { n: this.coinsThisLevel }, icon: '🪙' });
        } else {
          healPlayer(this.player, 34);
          sfx('cookie');
          this.particles.burst(c.mesh.position, 10, 4, 0xd9a05a);
          emit('toast', { key: 'toast.cookie', icon: '🍪' });
        }
      }
    }

    // Puntos de control
    const level = this.level!;
    for (const cp of level.checkpoints) {
      if (cp.distanceTo(pp) < 3 && this.player.checkpoint.distanceTo(cp) > 1) {
        this.player.checkpoint.copy(cp);
        sfx('checkpoint');
        this.particles.ring(cp, 16, 4, 0x40ffa0);
        emit('toast', { key: 'toast.checkpoint', icon: '🚩' });
      }
    }
  }

  private updateObstacles(dt: number): void {
    const level = this.level!;
    const pp = this.player.actor.position;
    for (const o of level.obstacles) {
      if (o.broken) continue;
      if (o.kind === 'hoopGap' || o.kind === 'dashGate' || o.kind === 'waterZone') {
        o.mesh.rotation.y += dt * 0.8;
        // Atravesarlos recompensa: es la razón para llevar el artefacto correcto
        if (o.mesh.position.distanceTo(pp) < 3.2) {
          const usingRight =
            (o.kind === 'hoopGap' && this.player.hoopTimer > 0) ||
            (o.kind === 'dashGate' && this.player.dashTimer > 0) ||
            (o.kind === 'waterZone' && this.player.swimming);
          if (usingRight) {
            o.broken = true;
            o.mesh.visible = false;
            this.particles.ring(o.mesh.position, 18, 5, 0xffd23f);
            sfx('unlock');
            this.addCollectible('coin', o.mesh.position.clone());
          }
        }
      }
    }
  }

  private updateGate(dt: number): void {
    if (!this.gate || !this.spec) return;
    const required = this.spec.required;
    if (!this.gateOpen && this.caught >= required) this.setGateOpen(true);

    this.gate.ring.rotation.z += dt * (this.gateOpen ? 1.4 : 0.3);
    const portalMat = this.gate.portal.material as THREE.ShaderMaterial;
    if (portalMat.uniforms?.uOpacity) {
      portalMat.uniforms.uOpacity.value = this.gateOpen ? 0.75 : 0.18;
    }
    if (this.gateOpen && Math.random() < dt * 8) {
      this.particles.burst(
        this.gate.group.position.clone().setY(this.gate.group.position.y + 2.6),
        1,
        2.5,
        0x40e0ff,
        { life: 1, gravity: -2, up: 0 },
      );
    }

    if (this.gateOpen && !this.finished) {
      const d = this.player.actor.position.distanceTo(this.gate.group.position.clone().setY(this.player.actor.position.y));
      if (d < 2.6) this.completeLevel();
    }
  }

  private setGateOpen(open: boolean): void {
    this.gateOpen = open;
    if (!this.gate) return;
    const frameMat = this.gate.ring.material as THREE.ShaderMaterial;
    if (frameMat.uniforms?.uEmissive) frameMat.uniforms.uEmissive.value = open ? 0.9 : 0.15;
    if (open) {
      sfx('gateOpen');
      emit('toast', { key: 'toast.exitOpen', icon: '🌀' });
      this.queueComms('comms.gateOpen', 0);
      this.particles.ring(this.gate.group.position.clone().setY(this.gate.group.position.y + 2.6), 26, 6, 0x40e0ff);
    }
  }

  private onPetCaught(pet: Pet): void {
    capturePet(pet);
    this.caught++;
    const total = levelPetTotal(this.spec!);
    this.particles.burst(pet.actor.position.clone().setY(pet.actor.position.y + 0.9), 22, 6, 0x40e0ff, { life: 0.9 });
    this.particles.ring(pet.actor.position, 14, 3, 0xffffff);
    emit('toast', { key: 'toast.petCaught', params: { n: this.caught, t: total }, icon: '🕸️' });
    const lines = ['comms.benitoCatch1', 'comms.benitoCatch2', 'comms.benitoCatch3', 'comms.benitoCatch4'];
    if (Math.random() < 0.45) this.callbacks.onComms(lines[Math.floor(Math.random() * lines.length)]);

    // Las mascotas cercanas se alertan al ver la captura
    for (const other of this.pets) {
      if (other.captured || other === pet) continue;
      if (other.actor.position.distanceTo(pet.actor.position) < 12) {
        other.suspicion = Math.max(other.suspicion, 1.0);
        other.lastKnownPlayer.copy(this.player.actor.position);
      }
    }
  }

  private onBossCaptured(): void {
    if (!this.boss) return;
    this.particles.burst(this.boss.actor.position, 40, 10, 0xffd23f, { life: 1.4 });
    this.particles.ring(this.boss.actor.position, 30, 10, 0x40e0ff);
    shakeCamera(this.rig, 1.4);
    sfx('unlock');
  }

  private handleDeath(dt: number): void {
    if (!this.player.dead) return;
    if (this.player.respawnTimer > 0) return;
    if (this.player.lives <= 0) {
      if (!this.finished) {
        this.finished = true;
        stopMusic(0.5);
        this.callbacks.onGameOver(this.spec!.id);
      }
      return;
    }
    respawnPlayer(this.player, this.player.checkpoint);
    this.particles.ring(this.player.actor.position, 18, 4, 0x40e0ff);
    emit('toast', { key: 'toast.lifeLost', params: { n: this.player.lives }, icon: '💔' });
    void dt;
  }

  private onPlayerDied(): void {
    shakeCamera(this.rig, 1);
    this.particles.burst(this.player.actor.position.clone().setY(this.player.actor.position.y + 0.8), 24, 6, 0xff5a5a);
  }

  private completeLevel(): void {
    if (this.finished) return;
    this.finished = true;
    const spec = this.spec!;
    stopMusic(0.5);
    sfx('unlock');
    this.callbacks.onLevelComplete({
      levelId: spec.id,
      caught: this.caught,
      total: levelPetTotal(spec),
      coins: this.coinsThisLevel,
      time: this.levelTime,
      gadgetUnlocked: spec.gadgetUnlock,
    });
  }

  /** Concede el artefacto del nivel (se llama al mostrar el resumen). */
  grantGadget(id: string): void {
    if (isGadgetId(id)) unlockGadget(this.player, id);
  }

  private queueComms(key: string, delay: number): void {
    if (this.shownComms.has(key)) return;
    this.shownComms.add(key);
    if (delay > 0) {
      window.setTimeout(() => this.callbacks.onComms(key), delay * 1000);
    } else {
      this.callbacks.onComms(key);
    }
  }

  private emitHud(): void {
    const spec = this.spec;
    if (!spec) return;
    const world = getWorld(spec.worldId);
    emit('hud', {
      energy: this.player.energy,
      maxEnergy: PLAYER_MAX_ENERGY,
      lives: this.player.lives,
      health: this.player.health,
      maxHealth: PLAYER_MAX_HEALTH,
      petsCaught: this.caught,
      petsTotal: levelPetTotal(spec),
      petsRequired: spec.required,
      coins: this.coinsThisLevel,
      gadget: this.player.currentGadget,
      gadgets: this.player.unlocked,
      levelName: spec.name[getSettings().lang] ?? spec.name.es,
      worldName: world ? world.name[getSettings().lang] ?? world.name.es : '',
      time: this.levelTime,
      radarActive: this.player.radarTimer > 0,
      timeFrozen: this.player.freezeTimer,
      firstPerson: this.rig.firstPerson,
    });
  }

  private emitMinimap(): void {
    const blips: MinimapBlip[] = [];
    const radarOn = this.player.radarTimer > 0;
    const range = radarOn ? 200 : 44;
    const pp = this.player.actor.position;

    for (const pet of this.pets) {
      if (pet.captured) continue;
      const d = pet.actor.position.distanceTo(pp);
      if (d > range) continue;
      blips.push({ x: pet.actor.position.x, z: pet.actor.position.z, kind: 'pet', alert: pet.alert });
    }
    for (const c of this.collectibles) {
      if (c.taken) continue;
      const d = c.mesh.position.distanceTo(pp);
      if (d > range) continue;
      blips.push({ x: c.pos.x, z: c.pos.z, kind: c.kind });
    }
    if (this.gate && this.gateOpen) {
      blips.push({ x: this.gate.group.position.x, z: this.gate.group.position.z, kind: 'exit' });
    }
    if (this.boss) {
      blips.push({ x: this.boss.actor.position.x, z: this.boss.actor.position.z, kind: 'boss' });
    }

    emit('minimap', { px: pp.x, pz: pp.z, pyaw: this.rig.yaw, radius: range, blips });
  }

  /** Estado para guardar al salir del nivel. */
  snapshot(): { caught: number; coins: number; time: number; lives: number } {
    return { caught: this.caught, coins: this.coinsThisLevel, time: this.levelTime, lives: this.player.lives };
  }

  get inputState(): InputState {
    return pollInput(0);
  }
}
