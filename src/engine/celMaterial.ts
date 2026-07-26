/**
 * Capa de materiales del juego.
 *
 * Construida sobre MeshToonMaterial en lugar de shaders escritos a mano: así el
 * cel shading entra en el pipeline de iluminación de Three y recibe sombras
 * proyectadas, niebla y luces reales. Los shaders propios daban el bandeado
 * pero dejaban todo plano y flotando, sin contacto con el suelo.
 *
 * El bandeado duro se consigue con un mapa de degradado de pocos pasos y filtro
 * de vecino más próximo; el contorno, con casco invertido.
 */
import * as THREE from 'three';

// Con materiales estándar, la gestión de color de Three es la correcta:
// los colores se declaran en sRGB y se convierten al espacio lineal de trabajo.
THREE.ColorManagement.enabled = true;

/** Mapa de degradado: define cuántas bandas de luz tiene el sombreado. */
function makeGradientMap(steps: number): THREE.DataTexture {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    // Suelo de sombra alto: la cara oscura sigue siendo legible, como en el
    // cel shading de dibujos animados (nunca cae a negro).
    const v = 0.42 + (i / (steps - 1)) * 0.58;
    const c = Math.round(v * 255);
    data[i * 4] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const gradients = new Map<number, THREE.DataTexture>();
function gradientMap(steps: number): THREE.DataTexture {
  const key = Math.max(2, Math.min(6, Math.round(steps)));
  let g = gradients.get(key);
  if (!g) {
    g = makeGradientMap(key);
    gradients.set(key, g);
  }
  return g;
}

export type CelOptions = {
  color: number;
  colorAlt?: number;
  bands?: number;
  emissive?: number;
  rim?: number;
  rimPower?: number;
  opacity?: number;
  transparent?: boolean;
  blendScale?: number;
  wobble?: number;
  side?: THREE.Side;
  depthWrite?: boolean;
  vertexColors?: boolean;
};

const registry = new Set<THREE.Material>();

/** Estado de luz global, consultado por quien necesite orientar efectos. */
export const celLight = {
  dir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(),
  color: new THREE.Color(0xfff2d0),
  ambient: new THREE.Color(0x8899bb),
  intensity: 1.4,
  fogColor: new THREE.Color(0x9fc0e0),
  fogDensity: 0.006,
};

/**
 * Material base de personajes y objetos. `emissive` se usa para lo que debe
 * brillar (cascos, portales, cristales): el bloque de post-proceso lo recoge.
 */
export function createCelMaterial(opts: CelOptions): THREE.MeshToonMaterial {
  const color = new THREE.Color(opts.color);
  const emissiveAmount = opts.emissive ?? 0;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(opts.bands ?? 3),
    transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? true,
    side: opts.side ?? THREE.FrontSide,
    fog: true,
    vertexColors: opts.vertexColors ?? false,
    emissive: new THREE.Color(opts.rim && emissiveAmount > 0 ? opts.rim : opts.color),
    emissiveIntensity: emissiveAmount,
  });
  registry.add(mat);
  return mat;
}

/**
 * Igual, pero para InstancedMesh. Three ya multiplica por `instanceColor`,
 * así que el tinte por instancia funciona sin tocar el shader.
 */
export function createCelMaterialInstanced(opts: CelOptions): THREE.MeshToonMaterial {
  return createCelMaterial(opts);
}

/**
 * Terreno. El color viene en los vértices (hierba, roca, arena, nieve según
 * pendiente y altura), que es mucho más barato y detallado que mezclar en el
 * fragmento, y permite variar el tono metro a metro.
 */
export function createTerrainMaterial(opts: {
  ground: number;
  groundAlt: number;
  cliff: number;
  bands?: number;
  snowLine?: number;
}): THREE.MeshToonMaterial {
  const mat = createCelMaterial({
    color: 0xffffff,
    bands: opts.bands ?? 4,
    vertexColors: true,
  });
  return mat;
}

/** Líquido con oleaje: aquí sí interesa un shader propio, pero con niebla. */
export function createLiquidMaterial(color: number, emissive: number, opacity: number): THREE.MeshToonMaterial {
  const mat = createCelMaterial({
    color,
    bands: 3,
    emissive,
    rim: color,
    opacity,
    transparent: true,
    side: THREE.DoubleSide,
  });
  mat.userData.liquid = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // Oleaje: el plano de agua nunca es una lámina perfectamente plana
         transformed.z += sin(position.x * 0.12 + uTime * 1.3) * 0.35
                        + cos(position.y * 0.15 - uTime * 1.05) * 0.3;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec3 vWorld;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // Espuma en bandas: agua de dibujos, no reflejo realista
         float ripple = sin(vWorld.x * 0.5 + uTime * 2.0) * cos(vWorld.z * 0.42 - uTime * 1.6);
         gl_FragColor.rgb += vec3(0.28) * smoothstep(0.6, 0.95, ripple);`,
      );
    // Posición de mundo para la espuma
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  };
  return mat;
}

export function updateCelLighting(
  dir: THREE.Vector3,
  color: THREE.Color,
  ambient: THREE.Color,
  intensity: number,
): void {
  celLight.dir.copy(dir).normalize();
  celLight.color.copy(color);
  celLight.ambient.copy(ambient);
  celLight.intensity = intensity;
}

export function updateCelFog(color: THREE.Color, density: number): void {
  celLight.fogColor.copy(color);
  celLight.fogDensity = density;
}

let liquidTime = 0;

export function tickCelMaterials(time: number): void {
  liquidTime = time;
  for (const m of registry) {
    const sh = (m as THREE.Material & { userData: { shader?: THREE.WebGLProgramParametersWithUniforms } }).userData?.shader;
    if (sh?.uniforms?.uTime) sh.uniforms.uTime.value = liquidTime;
  }
}

export function disposeCelMaterial(mat: THREE.Material): void {
  registry.delete(mat);
  mat.dispose();
}

// ─────────────────────────── Contorno ───────────────────────────

/**
 * Contorno por casco invertido. Se escala el grosor con la distancia a la
 * cámara para que la línea se mantenga constante en pantalla en vez de
 * engordar de cerca y desaparecer de lejos.
 */
export function createOutlineMaterial(thickness = 0.035, color = 0x0d0f18): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      uniform float uThickness;
      #ifdef USE_INSTANCING
        // three define este atributo en las mallas instanciadas
      #endif
      void main() {
        vec3 scaled = position + normalize(normal) * uThickness;
        vec4 mv = modelViewMatrix * vec4(scaled, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }
    `,
    side: THREE.BackSide,
    fog: false,
  });
}

export function withOutline(mesh: THREE.Mesh, thickness = 0.035, color = 0x0d0f18): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh);
  const outline = new THREE.Mesh(mesh.geometry, createOutlineMaterial(thickness, color));
  outline.renderOrder = -1;
  outline.frustumCulled = mesh.frustumCulled;
  group.add(outline);
  return group;
}

// ─────────────────────────── Cielo ───────────────────────────

/**
 * Cúpula de cielo con degradado en bandas y nubes planas. Se calcula la altura
 * normalizada en el vértice: hacerlo en el fragmento desborda mediump cuando el
 * radio de la esfera es de cientos de unidades.
 */
export function createSkyDome(zenith: number, horizon: number, radius = 520): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(zenith) },
      uBottom: { value: new THREE.Color(horizon) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      varying float vHeight01;
      varying vec2 vSwirl;
      void main() {
        vHeight01 = clamp(normalize(position).y * 0.5 + 0.5, 0.0, 1.0);
        vSwirl = position.xz / 260.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uTime;
      varying float vHeight01;
      varying vec2 vSwirl;

      float band(float x, float n) { return floor(x * n) / n; }

      void main() {
        float h = vHeight01;
        float b = band(h, 9.0);
        h = mix(h, b, 0.45);
        vec3 col = mix(uBottom, uTop, pow(clamp(h, 0.0, 1.0), 0.5));

        // Nubes largas y planas, en capas, al estilo de fondo pintado
        float c1 = sin(vSwirl.x * 2.4 + uTime * 0.04) * cos(vSwirl.y * 1.7 - uTime * 0.03);
        float c2 = sin(vSwirl.x * 5.1 - uTime * 0.06) * cos(vSwirl.y * 3.9 + uTime * 0.05);
        float clouds = smoothstep(0.5, 0.9, c1) * 0.75 + smoothstep(0.65, 0.95, c2) * 0.45;
        col = mix(col, col + vec3(0.16), clouds * smoothstep(0.42, 0.8, vHeight01));

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.userData.skyMat = mat;
  return mesh;
}

export function tickSky(sky: THREE.Mesh, time: number): void {
  const mat = sky.userData.skyMat as THREE.ShaderMaterial | undefined;
  if (mat) mat.uniforms.uTime.value = time;
}

/**
 * Sombra de contacto: un disco oscuro bajo cada personaje. El mapa de sombras
 * cubre solo un radio alrededor del jugador, y aun dentro de él este disco
 * asienta la figura en el suelo de forma inequívoca.
 */
const blobGeo = new THREE.CircleGeometry(1, 20);
let blobTexture: THREE.CanvasTexture | null = null;

function getBlobTexture(): THREE.CanvasTexture {
  if (blobTexture) return blobTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  blobTexture = new THREE.CanvasTexture(canvas);
  return blobTexture;
}

export function createBlobShadow(radius = 0.7): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: getBlobTexture(),
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(blobGeo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(radius);
  mesh.renderOrder = 1;
  return mesh;
}
