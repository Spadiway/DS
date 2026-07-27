/**
 * Sistema de partículas por lotes: un único InstancedMesh reciclado para todos
 * los efectos (captura, chispas, salpicaduras, humo, estrellas de aturdimiento).
 */
import * as THREE from 'three';
import { createCelMaterialInstanced } from './celMaterial';
import { qualityPreset } from '../core/settings';

type Particle = {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  gravity: number;
};

export class ParticleSystem {
  mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private dummy = new THREE.Object3D();
  private colors: Float32Array;
  private capacity: number;
  private cursor = 0;

  constructor(capacity = 360) {
    this.capacity = capacity;
    const geo = new THREE.TetrahedronGeometry(0.5, 0);
    const mat = createCelMaterialInstanced({
      color: 0xffffff,
      bands: 2,
      emissive: 0.9,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 10;
    this.colors = new Float32Array(capacity * 3);
    geo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(this.colors, 3));
    for (let i = 0; i < capacity; i++) {
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        life: 0,
        maxLife: 1,
        size: 1,
        spin: 0,
        gravity: 0,
      });
    }
  }

  /** Recicla la partícula más antigua si no quedan libres. */
  private take(): Particle {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[(this.cursor + i) % this.capacity];
      if (!p.alive) {
        this.cursor = (this.cursor + i + 1) % this.capacity;
        return p;
      }
    }
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    return p;
  }

  private spawnOne(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.Color,
    life: number,
    size: number,
    gravity: number,
  ): void {
    const p = this.take();
    p.alive = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.color.copy(color);
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.spin = (Math.random() - 0.5) * 12;
    p.gravity = gravity;
  }

  burst(
    pos: THREE.Vector3,
    count: number,
    speed: number,
    color: THREE.ColorRepresentation,
    opts?: { life?: number; size?: number; gravity?: number; up?: number },
  ): void {
    const q = qualityPreset();
    const n = Math.max(1, Math.round(count * q.particles));
    const c = new THREE.Color(color);
    const vel = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      vel
        .set(Math.cos(a) * Math.cos(e), Math.sin(e) + (opts?.up ?? 0.6), Math.sin(a) * Math.cos(e))
        .multiplyScalar(speed * (0.5 + Math.random() * 0.9));
      this.spawnOne(pos, vel, c, opts?.life ?? 0.7, (opts?.size ?? 0.28) * (0.6 + Math.random() * 0.8), opts?.gravity ?? 14);
    }
  }

  /** Anillo plano: ondas de choque, impactos, portales. */
  ring(pos: THREE.Vector3, count: number, radius: number, color: THREE.ColorRepresentation): void {
    const q = qualityPreset();
    const n = Math.max(3, Math.round(count * q.particles));
    const c = new THREE.Color(color);
    const vel = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      vel.set(Math.cos(a) * radius, 1.2, Math.sin(a) * radius);
      this.spawnOne(pos, vel, c, 0.55, 0.22, 4);
    }
  }

  /** Chorro dirigido: estelas de impulso, salpicaduras, humo de la fábrica. */
  jet(pos: THREE.Vector3, dir: THREE.Vector3, count: number, speed: number, color: THREE.ColorRepresentation, spread = 0.35): void {
    const q = qualityPreset();
    const n = Math.max(1, Math.round(count * q.particles));
    const c = new THREE.Color(color);
    const vel = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      vel
        .copy(dir)
        .normalize()
        .addScalar(0)
        .add(
          new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread),
        )
        .multiplyScalar(speed * (0.6 + Math.random() * 0.7));
      this.spawnOne(pos, vel, c, 0.5, 0.22, 6);
    }
  }

  update(dt: number): void {
    let count = 0;
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      const t = p.life / p.maxLife;
      this.dummy.position.copy(p.pos);
      this.dummy.rotation.set(p.spin * p.life, p.spin * p.life * 0.7, 0);
      this.dummy.scale.setScalar(p.size * t);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix);
      this.colors[count * 3] = p.color.r * 1.3;
      this.colors[count * 3 + 1] = p.color.g * 1.3;
      this.colors[count * 3 + 2] = p.color.b * 1.3;
      count++;
      if (count >= this.capacity) break;
    }
    this.mesh.count = count;
    if (count > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      (this.mesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }

  clear(): void {
    for (const p of this.particles) p.alive = false;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
