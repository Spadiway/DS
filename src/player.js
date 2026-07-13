// Controlador de Benito: movimiento relativo a cámara, salto, gadgets y colisiones.

import * as THREE from 'three';
import { buildBenito, buildNet } from './models.js';
import { sfx } from './audio.js';

const GRAVITY = -22;
const WALK_SPEED = 5.2;
const DASH_SPEED = 10.5;
const JUMP_VEL = 8.6;

export class Player {
  constructor(input) {
    this.input = input;
    this.mesh = buildBenito();
    this.net = buildNet();
    this.net.position.set(0.55, 0.35, 0.25);
    this.net.rotation.z = -0.5;
    this.mesh.add(this.net);

    this.pos = this.mesh.position;
    this.velY = 0;
    this.onGround = true;
    this.facing = 0;                // ángulo yaw hacia donde mira Benito
    this.health = 3;
    this.energy = 100;
    this.invuln = 0;

    this.swingTimer = 0;            // animación de red activa
    this.swingCooldown = 0;
    this.batonTimer = 0;
    this.batonCooldown = 0;
    this.walkPhase = 0;
    this.slipVel = new THREE.Vector3(); // inercia sobre hielo
  }

  reset(x = 0, z = 0) {
    this.pos.set(x, 0, z);
    this.velY = 0;
    this.onGround = true;
    this.health = 3;
    this.energy = 100;
    this.invuln = 2;
    this.swingTimer = 0;
    this.batonTimer = 0;
    this.slipVel.set(0, 0, 0);
  }

  get netActive() { return this.swingTimer > 0; }
  get batonActive() { return this.batonTimer > 0; }

  // Punto de captura: delante de Benito.
  netPoint() {
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.facing) * 1.1,
      this.pos.y + 0.6,
      this.pos.z + Math.cos(this.facing) * 1.1
    );
  }

  swingNet() {
    if (this.swingCooldown > 0 || this.energy < 4) return false;
    this.swingTimer = 0.28;
    this.swingCooldown = 0.45;
    this.energy = Math.max(0, this.energy - 4);
    sfx.swing();
    return true;
  }

  swingBaton() {
    if (this.batonCooldown > 0 || this.energy < 6) return false;
    this.batonTimer = 0.4;
    this.batonCooldown = 0.9;
    this.energy = Math.max(0, this.energy - 6);
    sfx.swing();
    return true;
  }

  hurt() {
    if (this.invuln > 0) return false;
    this.health -= 1;
    this.invuln = 1.5;
    sfx.hurt();
    return true;
  }

  update(dt, camYaw, level, platforms, gadgets, activeGadget) {
    const k = this.input;

    // --- Movimiento relativo a la cámara ---
    let mx = 0, mz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;

    const moving = mx !== 0 || mz !== 0;
    const dashing = moving && gadgets.includes('hoop') && (k.has('ShiftLeft') || k.has('ShiftRight')) && this.energy > 0.5;
    let speed = dashing ? DASH_SPEED : WALK_SPEED;
    if (dashing) this.energy = Math.max(0, this.energy - dt * 9);

    const dir = new THREE.Vector3();
    if (moving) {
      const ang = Math.atan2(mx, mz);
      const worldAng = camYaw + ang + Math.PI; // adelante = alejarse de cámara
      dir.set(Math.sin(worldAng), 0, Math.cos(worldAng));
      this.facing = worldAng;
    }

    if (level.slippery) {
      // hielo: aceleración con inercia
      this.slipVel.lerp(dir.clone().multiplyScalar(speed), dt * 1.6);
      this.pos.addScaledVector(this.slipVel, dt);
    } else {
      this.slipVel.copy(dir).multiplyScalar(speed);
      if (moving) this.pos.addScaledVector(dir, speed * dt);
    }

    // límites del nivel
    const lim = level.size / 2 - 1;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);

    // --- Gravedad y plataformas ---
    this.velY += GRAVITY * dt;
    this.pos.y += this.velY * dt;

    let groundY = 0;
    for (const p of platforms) {
      // p = [x,y,z,w,h,d]; superficie superior = y + h/2
      const top = p[1] + p[4] / 2;
      if (
        Math.abs(this.pos.x - p[0]) < p[3] / 2 + 0.3 &&
        Math.abs(this.pos.z - p[2]) < p[5] / 2 + 0.3 &&
        this.pos.y >= top - 0.9 && top > groundY
      ) {
        groundY = top;
      }
    }

    if (this.pos.y <= groundY) {
      this.pos.y = groundY;
      this.velY = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if ((k.consume('Space')) && this.onGround) {
      this.velY = JUMP_VEL;
      this.onGround = false;
      sfx.jump();
    }

    // --- Gadgets ---
    if (k.consume('KeyJ') || k.consume('MouseLeft')) this.swingNet();
    if ((k.consume('KeyK')) && gadgets.includes('baton')) this.swingBaton();

    this.swingTimer = Math.max(0, this.swingTimer - dt);
    this.swingCooldown = Math.max(0, this.swingCooldown - dt);
    this.batonTimer = Math.max(0, this.batonTimer - dt);
    this.batonCooldown = Math.max(0, this.batonCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);

    // regeneración lenta de energía
    this.energy = Math.min(100, this.energy + dt * 3.5);

    // --- Animación ---
    this.mesh.rotation.y = this.facing;
    if (moving && this.onGround) {
      this.walkPhase += dt * (dashing ? 18 : 11);
      this.mesh.position.y = this.pos.y + Math.abs(Math.sin(this.walkPhase)) * 0.08;
    }
    const tail = this.mesh.userData.tail;
    if (tail) tail.rotation.x = Math.sin(performance.now() * 0.004) * 0.3;

    // animación de red: barrido hacia delante
    if (this.netActive) {
      const t = 1 - this.swingTimer / 0.28;
      this.net.rotation.x = -Math.PI * 0.8 * Math.sin(t * Math.PI);
    } else if (this.batonActive) {
      this.net.rotation.x = 0;
      this.mesh.rotation.y += (1 - this.batonTimer / 0.4) * Math.PI * 2; // giro completo
    } else {
      this.net.rotation.x = 0;
    }

    // parpadeo de invulnerabilidad
    this.mesh.visible = this.invuln > 0 ? Math.floor(performance.now() / 90) % 2 === 0 : true;

    return { dashing, moving };
  }
}

// --- Entrada de teclado/ratón con "consume" para pulsaciones únicas ---
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.down.add('MouseLeft'); this.pressed.add('MouseLeft'); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.down.delete('MouseLeft');
    });
    window.addEventListener('blur', () => { this.down.clear(); });
  }
  has(code) { return this.down.has(code); }
  consume(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  endFrame() { this.pressed.clear(); }
}
