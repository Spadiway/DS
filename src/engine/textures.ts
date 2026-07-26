/**
 * Texturas generadas con canvas 2D.
 *
 * Es la pieza que faltaba para el aspecto de consola portátil de mediados de
 * los 2000: aquellos juegos tenían poca geometría pero TODO texturizado, y las
 * caras de los personajes iban pintadas en la textura, no modeladas con
 * esferas. Se trabaja a baja resolución (64–256 px) y con filtro bilineal para
 * que el téxel se note, que es justo la textura de imagen de aquella época.
 *
 * Todo se dibuja en tiempo de ejecución: no hay ficheros de imagen.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, opts: { repeat?: number; nearest?: boolean } = {}): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(opts.repeat ?? 1, opts.repeat ?? 1);
  tex.magFilter = opts.nearest ? THREE.NearestFilter : THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function shade(color: number, amount: number): string {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * amount)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * amount)));
  return `rgb(${r},${g},${b})`;
}

/** Ruido con envoltura: se dibuja replicado para que la textura sea tileable. */
function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  radius: [number, number],
  colors: string[],
  alpha = 1,
): void {
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = radius[0] + Math.random() * (radius[1] - radius[0]);
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    // Se pinta también desplazado por los cuatro lados: así el borde encaja
    for (const [ox, oy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ─────────────────────────── Superficies ───────────────────────────

/**
 * Textura de detalle del terreno. Es en escala de grises y se multiplica por
 * el color de vértice: así una sola textura sirve para hierba, arena, roca,
 * nieve y limo, y cada mundo mantiene su paleta.
 */
export function groundDetailTexture(): THREE.CanvasTexture {
  const key = 'groundDetail';
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#9c9c9c';
  ctx.fillRect(0, 0, size, size);

  // Manchas amplias: zonas más gastadas y más frondosas
  speckle(ctx, size, 120, [14, 40], ['#b8b8b8', '#828282', '#a8a8a8'], 0.4);

  // Matas de hierba: grupos de briznas en abanico, no ruido suelto.
  // Es lo que hace que el suelo se lea como hierba y no como plástico moteado.
  for (let clump = 0; clump < 260; clump++) {
    const cxp = Math.random() * size;
    const cyp = Math.random() * size;
    const blades = 5 + Math.floor(Math.random() * 6);
    const bright = Math.random() < 0.5;
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const len = 4 + Math.random() * 8;
      const x0 = cxp + (Math.random() - 0.5) * 7;
      const y0 = cyp + (Math.random() - 0.5) * 7;
      ctx.strokeStyle = bright ? 'rgba(216,216,216,0.55)' : 'rgba(96,96,96,0.5)';
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5, y0 + Math.sin(a) * len * 0.6, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
      ctx.stroke();
      // Réplica por los bordes para que la textura siga siendo tileable
      for (const [ox, oy] of [
        [size, 0],
        [-size, 0],
        [0, size],
        [0, -size],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x0 + ox, y0 + oy);
        ctx.lineTo(x0 + ox + Math.cos(a) * len, y0 + oy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
  }

  // Guijarros y granos sueltos
  speckle(ctx, size, 520, [1, 2.8], ['#c8c8c8', '#6e6e6e', '#b0b0b0'], 0.5);

  // Ruido de téxel: el grano fino característico de la resolución de la época
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Corteza: anillos y vetas verticales. */
export function barkTexture(base: number): THREE.CanvasTexture {
  const key = `bark${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  // Vetas verticales profundas, como las de la referencia
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * size;
    const dark = Math.random() < 0.55;
    ctx.strokeStyle = dark ? shade(base, 0.6) : shade(base, 1.3);
    ctx.lineWidth = dark ? 1 + Math.random() * 3.5 : 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 6) ctx.lineTo(x + Math.sin(y * 0.35 + i) * 2.5, y);
    ctx.stroke();
  }
  // Nudos de la madera
  for (let i = 0; i < 3; i++) {
    const kx = Math.random() * size;
    const ky = Math.random() * size;
    ctx.strokeStyle = shade(base, 0.55);
    for (let r = 2; r < 9; r += 2) {
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r, r * 1.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  speckle(ctx, size, 140, [0.8, 2], [shade(base, 0.78), shade(base, 1.18)], 0.45);
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Hoja: nervadura central y moteado. */
export function leafTexture(base: number): THREE.CanvasTexture {
  const key = `leaf${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 150, [1, 3.5], [shade(base, 0.78), shade(base, 1.2), shade(base, 0.9)], 0.6);
  ctx.strokeStyle = shade(base, 1.3);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const y = (i + 0.5) * (size / 5);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Piedra: facetas y grietas. */
export function stoneTexture(base: number): THREE.CanvasTexture {
  const key = `stone${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 70, [4, 12], [shade(base, 0.85), shade(base, 1.12)], 0.5);
  speckle(ctx, size, 260, [0.7, 1.8], [shade(base, 0.7), shade(base, 1.25)], 0.5);
  ctx.strokeStyle = shade(base, 0.62);
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (Math.random() - 0.5) * 22;
      y += (Math.random() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Tarima de tablones: para plataformas y suelos construidos. */
export function plankTexture(base: number): THREE.CanvasTexture {
  const key = `plank${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);

  const planks = 4;
  const pw = size / planks;
  for (let i = 0; i < planks; i++) {
    // Cada tablón con su tono: nunca dos iguales seguidos
    const tone = 0.86 + ((i * 37) % 5) * 0.07;
    ctx.fillStyle = shade(base, tone);
    ctx.fillRect(i * pw, 0, pw - 1, size);
    // Veta longitudinal
    ctx.strokeStyle = shade(base, tone * 0.82);
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const x = i * pw + 3 + Math.random() * (pw - 6);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= size; y += 10) ctx.lineTo(x + Math.sin(y * 0.06 + k) * 1.6, y);
      ctx.stroke();
    }
    // Junta oscura entre tablones
    ctx.fillStyle = shade(base, 0.5);
    ctx.fillRect(i * pw + pw - 2, 0, 2, size);
  }
  // Clavos
  ctx.fillStyle = shade(base, 0.42);
  for (let i = 0; i < planks; i++) {
    for (const y of [6, size - 8]) {
      ctx.beginPath();
      ctx.arc(i * pw + pw * 0.5, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Metal con paneles y remaches, para la fábrica y la torre. */
export function panelTexture(base: number, accent: number): THREE.CanvasTexture {
  const key = `panel${base}_${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = shade(base, 0.65);
  ctx.lineWidth = 2;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo((i * size) / 2, 0);
    ctx.lineTo((i * size) / 2, size);
    ctx.moveTo(0, (i * size) / 2);
    ctx.lineTo(size, (i * size) / 2);
    ctx.stroke();
  }
  ctx.fillStyle = shade(accent, 1);
  for (const [x, y] of [
    [6, 6],
    [size - 6, 6],
    [6, size - 6],
    [size - 6, size - 6],
    [size / 2 + 6, size / 2 + 6],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, size, 90, [0.6, 1.6], [shade(base, 0.8), shade(base, 1.15)], 0.4);
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

// ─────────────────────────── Personajes ───────────────────────────

export type FurOptions = {
  base: number;
  /** Se conserva por compatibilidad: el vientre se resuelve con geometría. */
  belly: number;
  stripe?: number;
  stripes?: boolean;
};

/**
 * Textura del cuerpo. El vientre claro y las rayas van pintados, no montados
 * con geometría: así el personaje tiene detalle sin sumar polígonos, que es
 * exactamente cómo se resolvía en aquella generación de consolas.
 *
 * Coordenadas de esfera: u recorre el contorno (0.5 = frente), v va de la
 * base a la coronilla.
 */
export function furTexture(opts: FurOptions): THREE.CanvasTexture {
  const key = `fur${opts.base}_${opts.belly}_${opts.stripe ?? 0}_${opts.stripes ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 256;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(opts.base);
  ctx.fillRect(0, 0, size, size);

  // Sombreado suave hacia el lomo: da volumen sin depender de la luz
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0.22)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Anillos atigrados: bandas horizontales que rodean el cuerpo, más marcadas
  // en el lomo y difuminadas hacia el vientre.
  if (opts.stripes && opts.stripe !== undefined) {
    ctx.fillStyle = shade(opts.stripe, 1);
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * size + 6;
      const h = 7 + Math.random() * 7;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
      for (let x = size; x >= 0; x -= 12) ctx.lineTo(x, y + h + Math.sin(x * 0.05 + i) * 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Grano de pelo
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y + 2 + Math.random() * 3);
    ctx.stroke();
  }

  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

export type FaceOptions = {
  fur: number;
  belly: number;
  eye: number;
  /** 'cat' | 'dog' | 'pet' cambia la forma de ojo y hocico. */
  kind: 'cat' | 'dog' | 'pet';
  /** Ceño: 0 neutro, 1 enfadado. */
  angry?: number;
  stripe?: number;
  glasses?: boolean;
  tongue?: boolean;
};

/**
 * Cara pintada. Ojos, pupilas, brillo, nariz, boca, bigotes y ceño se dibujan
 * en la textura de la cabeza; la geometría es solo una esfera. Este es el
 * cambio que más acerca a los personajes al aspecto que buscamos.
 *
 * La cara se sitúa en u ≈ 0.5 (frente de la esfera) y v ≈ 0.55.
 */
export function faceTexture(opts: FaceOptions): THREE.CanvasTexture {
  const key = `face${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 256;
  const { c, ctx } = canvas(size);

  // Base de pelo, igual que el cuerpo
  ctx.fillStyle = hex(opts.fur);
  ctx.fillRect(0, 0, size, size);
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0.2)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.46;

  // Marca atigrada en la frente
  if (opts.stripe !== undefined) {
    ctx.strokeStyle = shade(opts.stripe, 1);
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.75;
    for (const dx of [-22, 0, 22]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy - 76);
      ctx.lineTo(cx + dx * 1.5, cy - 46);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Hocico claro
  ctx.fillStyle = hex(opts.belly);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 26, opts.kind === 'dog' ? 30 : 34, opts.kind === 'dog' ? 22 : 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ojos
  // Ojos grandes: es lo que da carácter, y en la textura salen gratis
  const eyeDX = opts.kind === 'dog' ? 30 : 34;
  const eyeRX = opts.kind === 'dog' ? 15 : 22;
  const eyeRY = opts.kind === 'dog' ? 18 : 26;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * eyeDX;
    const ey = cy - 8;

    // Contorno oscuro: el trazo que define el ojo de dibujo animado
    ctx.fillStyle = '#151019';
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeRX + 3, eyeRY + 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeRX, eyeRY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = hex(opts.eye);
    ctx.beginPath();
    ctx.ellipse(ex, ey + 1, eyeRX * 0.72, eyeRY * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupila: rendija en el gato, redonda en el resto
    ctx.fillStyle = '#120e16';
    ctx.beginPath();
    if (opts.kind === 'cat') ctx.ellipse(ex, ey + 1, eyeRX * 0.26, eyeRY * 0.62, 0, 0, Math.PI * 2);
    else ctx.ellipse(ex, ey + 1, eyeRX * 0.5, eyeRY * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brillo
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(ex + eyeRX * 0.34, ey - eyeRY * 0.38, eyeRX * 0.24, eyeRY * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Párpado / ceño
    const angry = opts.angry ?? 0;
    if (angry > 0) {
      ctx.fillStyle = shade(opts.fur, 0.85);
      ctx.save();
      ctx.translate(ex, ey - eyeRY * 0.75);
      ctx.rotate(sx * -0.42 * angry);
      ctx.fillRect(-eyeRX - 5, -10, (eyeRX + 5) * 2, 13);
      ctx.restore();
    }
  }

  if (opts.glasses) {
    ctx.strokeStyle = '#2a2a34';
    ctx.lineWidth = 4;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * eyeDX, cy - 8, eyeRX + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - eyeDX + eyeRX + 8, cy - 8);
    ctx.lineTo(cx + eyeDX - eyeRX - 8, cy - 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,220,255,0.35)';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * eyeDX, cy - 8, eyeRX + 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nariz
  ctx.fillStyle = opts.kind === 'dog' ? '#241c22' : '#ff8fa2';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 30);
  ctx.lineTo(cx - 9, cy + 18);
  ctx.lineTo(cx + 9, cy + 18);
  ctx.closePath();
  ctx.fill();

  // Boca
  ctx.strokeStyle = '#20181f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 36);
  ctx.lineTo(cx, cy + 45);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 11, cy + 43, 11, 0, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 11, cy + 43, 11, Math.PI * 0.15, Math.PI);
  ctx.stroke();

  if (opts.tongue) {
    ctx.fillStyle = '#ff5f86';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 62, 13, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d84068';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 48);
    ctx.lineTo(cx, cy + 76);
    ctx.stroke();
  }

  // Bigotes
  if (opts.kind === 'cat') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * 26, cy + 26 + i * 5);
        ctx.lineTo(cx + sx * 76, cy + 12 + i * 13);
        ctx.stroke();
      }
    }
  }

  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Tela de los pantalones de las mascotas, con costuras y bolsillos. */
export function clothTexture(base: number): THREE.CanvasTexture {
  const key = `cloth${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  // Trama
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < size; i += 3) {
    ctx.fillStyle = i % 6 === 0 ? '#ffffff' : '#000000';
    ctx.fillRect(0, i, size, 1);
    ctx.fillRect(i, 0, 1, size);
  }
  ctx.globalAlpha = 1;
  // Costura
  ctx.strokeStyle = shade(base, 0.7);
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, size);
  ctx.stroke();
  ctx.setLineDash([]);
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/** Casco de las mascotas: placas y rejilla. */
export function helmetTexture(base: number): THREE.CanvasTexture {
  const key = `helmet${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 64;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = shade(base, 0.6);
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * size) / 4);
    ctx.lineTo(size, (i * size) / 4);
    ctx.stroke();
  }
  ctx.fillStyle = shade(base, 1.35);
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/**
 * Cáusticas del agua: la red de luz que se ve en el fondo de las piscinas.
 * Es lo que distingue el agua de aquellos juegos de un plano azul liso.
 */
export function causticsTexture(): THREE.CanvasTexture {
  const key = 'caustics';
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 128;
  const { c, ctx } = canvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  // Celdas irregulares de luz, replicadas por los bordes para poder repetir
  for (let i = 0; i < 46; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 8 + Math.random() * 20;
    for (const [ox, oy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + Math.random() * 0.2})`;
      ctx.lineWidth = 2 + Math.random() * 4;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rr = r * (0.72 + Math.sin(a * 3 + i) * 0.28);
        const x = cx + ox + Math.cos(a) * rr;
        const y = cy + oy + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const tex = finish(c, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

/**
 * Nubes de fondo pintado: cúmulos blancos y gordos, no bruma. Se dibujan en una
 * banda que la cúpula del cielo coloca sobre el horizonte.
 */
export function cloudTexture(): THREE.CanvasTexture {
  const key = 'clouds';
  const hit = cache.get(key);
  if (hit) return hit;
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const puff = (x: number, y: number, r: number, alpha: number) => {
    for (const ox of [0, w, -w]) {
      const grd = ctx.createRadialGradient(x + ox, y, r * 0.25, x + ox, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(0.62, `rgba(255,255,255,${alpha * 0.85})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x + ox, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Cada nube es un racimo de bolas: base plana y cúpula abultada
  for (let i = 0; i < 13; i++) {
    const cx = Math.random() * w;
    const cy = h * (0.36 + Math.random() * 0.4);
    const scale = 0.6 + Math.random() * 0.9;
    const lobes = 4 + Math.floor(Math.random() * 4);
    for (let k = 0; k < lobes; k++) {
      const t = k / (lobes - 1) - 0.5;
      puff(cx + t * 62 * scale, cy - Math.cos(t * Math.PI) * 13 * scale, (16 + Math.random() * 15) * scale, 0.92);
    }
    // Sombra suave en la base
    for (let k = 0; k < lobes; k++) {
      const t = k / (lobes - 1) - 0.5;
      puff(cx + t * 58 * scale, cy + 11 * scale, 13 * scale, 0.3);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

export function disposeTextures(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
