// IA de mascotas renegadas. Estados de alarma según la luz del casco:
//   CALM (azul): deambula sin sospechas.
//   ALERT (amarillo): vio a Benito, se pone nerviosa y toma distancia.
//   ALARM (rojo): huye a toda velocidad o ataca según su tipo.

import * as THREE from 'three';
import { buildPet } from './models.js';
import { sfx } from './audio.js';

const STATE_COLORS = { calm: 0x2ec4f1, alert: 0xffd23f, alarm: 0xff3030 };

// Parámetros por tipo (color de pantalones).
const TYPE_STATS = {
  yellow: { speed: 2.4, fleeSpeed: 4.2, sight: 6,  attacks: false, shoots: false },
  red:    { speed: 2.2, fleeSpeed: 3.6, sight: 7,  attacks: true,  shoots: false },
  blue:   { speed: 3.4, fleeSpeed: 6.0, sight: 6,  attacks: false, shoots: false },
  white:  { speed: 2.6, fleeSpeed: 4.6, sight: 11, attacks: false, shoots: false },
  green:  { speed: 2.0, fleeSpeed: 3.4, sight: 8,  attacks: false, shoots: true }
};

export class Pet {
  constructor(type, x, z, arena) {
    this.type = type;
    this.stats = TYPE_STATS[type] ?? TYPE_STATS.yellow;
    this.mesh = buildPet(type);
    this.mesh.position.set(x, 0, z);
    this.home = new THREE.Vector3(x, 0, z);
    this.arena = arena;                 // semiancho del nivel
    this.state = 'calm';
    this.stunned = 0;
    this.captured = false;
    this.wanderTarget = this.pickWander();
    this.wanderPause = Math.random() * 2;
    this.shootCooldown = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.setLight('calm');
  }

  setLight(state) {
    this.state = state;
    this.mesh.userData.alarmLight.color.setHex(STATE_COLORS[state]);
  }

  pickWander() {
    const r = 3 + Math.random() * 4;
    const a = Math.random() * Math.PI * 2;
    const t = this.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    const lim = this.arena - 2;
    t.x = THREE.MathUtils.clamp(t.x, -lim, lim);
    t.z = THREE.MathUtils.clamp(t.z, -lim, lim);
    return t;
  }

  stun(sec) {
    if (this.captured) return;
    this.stunned = Math.max(this.stunned, sec);
    sfx.stun();
  }

  // Devuelve eventos para game.js: {attack: bool, shoot: Vector3|null}
  update(dt, playerPos, time) {
    const out = { attack: false, shoot: null };
    if (this.captured) return out;

    const pos = this.mesh.position;
    const toPlayer = playerPos.clone().sub(pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // animación de flote/pasos
    this.bobPhase += dt * 8;
    this.mesh.children.forEach(() => {});
    this.mesh.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.06;

    if (this.stunned > 0) {
      this.stunned -= dt;
      this.mesh.rotation.y += dt * 10; // mareado dando vueltas
      return out;
    }

    // Transiciones de alarma
    const sight = this.stats.sight;
    if (dist < sight * 0.5) {
      if (this.state !== 'alarm') { this.setLight('alarm'); sfx.alert(); }
    } else if (dist < sight) {
      if (this.state === 'calm') { this.setLight('alert'); sfx.alert(); }
      else if (this.state === 'alarm' && dist > sight * 0.75) this.setLight('alert');
    } else if (dist > sight * 1.6 && this.state !== 'calm') {
      this.setLight('calm');
    }

    let vel = new THREE.Vector3();

    if (this.state === 'calm') {
      // deambular tranquilo
      if (this.wanderPause > 0) {
        this.wanderPause -= dt;
      } else {
        const toT = this.wanderTarget.clone().sub(pos); toT.y = 0;
        if (toT.length() < 0.5) {
          this.wanderTarget = this.pickWander();
          this.wanderPause = 0.5 + Math.random() * 2;
        } else {
          vel = toT.normalize().multiplyScalar(this.stats.speed * 0.55);
        }
      }
    } else if (this.state === 'alert') {
      // nervioso: se aleja despacio mirando al jugador
      vel = toPlayer.clone().normalize().multiplyScalar(-this.stats.speed * 0.7);
      this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
    } else {
      // ALARM
      if (this.stats.attacks && dist > 1.1) {
        vel = toPlayer.clone().normalize().multiplyScalar(this.stats.speed * 1.5);
      } else if (this.stats.attacks) {
        out.attack = true;
      } else {
        vel = toPlayer.clone().normalize().multiplyScalar(-this.stats.fleeSpeed);
      }
      if (this.stats.shoots) {
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0 && dist < 14) {
          this.shootCooldown = 2.2 + Math.random();
          out.shoot = toPlayer.clone().normalize();
        }
        // los tiradores mantienen distancia en vez de huir sin fin
        if (dist > 9) vel.multiplyScalar(0);
      }
    }

    if (vel.lengthSq() > 0.0001) {
      pos.addScaledVector(vel, dt);
      const lim = this.arena - 1.2;
      pos.x = THREE.MathUtils.clamp(pos.x, -lim, lim);
      pos.z = THREE.MathUtils.clamp(pos.z, -lim, lim);
      const facing = pos.clone().add(vel);
      this.mesh.lookAt(facing.x, pos.y, facing.z);
    }

    return out;
  }

  // Animación de captura: encoger con chispas. Devuelve true al terminar.
  playCapture(dt) {
    this.mesh.scale.multiplyScalar(Math.max(0.0001, 1 - dt * 4));
    this.mesh.rotation.y += dt * 14;
    this.mesh.position.y += dt * 1.5;
    return this.mesh.scale.x < 0.05;
  }
}
