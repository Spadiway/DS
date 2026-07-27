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
import { causticsTexture, cloudTexture } from './textures';

// Con materiales estándar, la gestión de color de Three es la correcta:
// los colores se declaran en sRGB y se convierten al espacio lineal de trabajo.
THREE.ColorManagement.enabled = true;

/** Mapa de degradado: define cuántas bandas de luz tiene el sombreado. */
function makeGradientMap(steps: number): THREE.DataTexture {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    /**
     * Rampa muy plana y muy alta a propósito.
     *
     * En la PSP la iluminación iba horneada en las texturas y en los colores
     * de vértice: no había un término difuso que apagase la cara en sombra,
     * de modo que un objeto se leía casi igual de claro por delante que por
     * detrás y el volumen lo daba el dibujo de la textura. Midiendo los
     * fotogramas del original, la cara oscura de una pared ronda el 70 % del
     * valor de la cara iluminada; aquí caía al 42 % y todo parecía tomado al
     * atardecer.
     */
    const v = 0.7 + (i / (steps - 1)) * 0.3;
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
  /** Textura difusa. Si es en escala de grises, multiplica al color base. */
  map?: THREE.Texture | null;
  /** Repetición de la textura sobre la superficie. */
  mapRepeat?: number;
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
  const map = opts.map ?? null;
  if (map && opts.mapRepeat && opts.mapRepeat !== 1) {
    map.repeat.set(opts.mapRepeat, opts.mapRepeat);
    map.needsUpdate = true;
  }
  const mat = new THREE.MeshToonMaterial({
    color,
    map,
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
  detail?: THREE.Texture | null;
  detailRepeat?: number;
}): THREE.MeshToonMaterial {
  // La textura de detalle es gris y se multiplica por el color de vértice:
  // una sola imagen sirve para hierba, arena, roca y nieve manteniendo la
  // paleta de cada mundo, y aporta el grano de téxel de la época.
  const mat = createCelMaterial({
    color: 0xffffff,
    bands: opts.bands ?? 4,
    vertexColors: true,
    map: opts.detail ?? null,
  });
  if (mat.map && opts.detailRepeat) {
    mat.map = mat.map.clone();
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(opts.detailRepeat, opts.detailRepeat);
    mat.map.needsUpdate = true;
  }

  /**
   * Rotura del tileado. Una sola textura repetida decenas de veces sobre el
   * terreno deja un patrón de cuadrícula muy evidente. Se muestrea a dos
   * escalas incomensurables y se combinan: la repetición deja de percibirse
   * sin necesitar una textura enorme.
   */
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
         vec3 detailA = texture2D( map, vMapUv ).rgb;
         vec3 detailB = texture2D( map, vMapUv * 0.2437 + vec2(0.37, 0.61) ).rgb;
         vec3 detailC = texture2D( map, vMapUv * 3.1211 ).rgb;
         // Media ponderada: la escala grande manda, la fina solo añade grano
         vec3 detail = detailA * 0.5 + detailB * 0.34 + detailC * 0.16;
         // Se recentra en torno a 1 para que multiplique sin oscurecer. La
         // máscara es lineal (gris medio 0.612), así que ese es el divisor.
         detail = detail / 0.612;
         // Margen estrecho: el detalle da grano, no manchas. Cuando podía
         // bajar al 55 % el suelo se llenaba de lamparones de suciedad.
         diffuseColor.rgb *= clamp(detail, 0.78, 1.24);
       #endif`,
    );
  };
  return mat;
}

/** Líquido con oleaje: aquí sí interesa un shader propio, pero con niebla. */
export function createLiquidMaterial(
  color: number,
  emissive: number,
  opacity: number,
  /** Las cáusticas solo tienen sentido en agua; en lava o ácido dan un damero. */
  withCaustics = true,
  /**
   * Color de la veta superficial. En agua es espuma blanca; en lava debe ser
   * costra oscura, que es como se lee una colada. Con blanco parecía nieve.
   */
  foam: number = 0xffffff,
  foamStrength = 0.28,
): THREE.MeshToonMaterial {
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
    shader.uniforms.uCaustics = { value: causticsTexture() };
    shader.uniforms.uCausticAmount = { value: withCaustics ? 1.5 : 0 };
    shader.uniforms.uFoam = { value: new THREE.Color(foam) };
    shader.uniforms.uFoamStrength = { value: foamStrength };
    shader.uniforms.uSheen = { value: new THREE.Color(color) };
    shader.uniforms.uSunDir = { value: celLight.dir.clone() };
    // La lava y el ácido no reflejan como el agua: apenas un apunte
    shader.uniforms.uSpecular = { value: withCaustics ? 0.85 : 0.22 };
    mat.userData.shader = shader;
    mat.userData.sunDirUniform = true;
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
         uniform sampler2D uCaustics;
         uniform float uCausticAmount;
         uniform vec3 uFoam;
         uniform float uFoamStrength;
         uniform vec3 uSheen;
         uniform vec3 uSunDir;
         uniform float uSpecular;
         varying vec3 vWorld;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // Espuma en bandas: agua de dibujos, no reflejo realista
         float ripple = sin(vWorld.x * 0.5 + uTime * 2.0) * cos(vWorld.z * 0.42 - uTime * 1.6);
         float vein = smoothstep(0.7, 0.99, ripple);
         // Se mezcla en vez de sumar: así la costra de lava oscurece de verdad
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uFoam, vein * uFoamStrength);
         // Segunda veta más fina y lenta, para que la superficie no sea uniforme
         float slow = sin(vWorld.x * 0.17 - uTime * 0.5) * cos(vWorld.z * 0.21 + uTime * 0.42);
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uFoam, smoothstep(0.82, 1.0, slow) * uFoamStrength * 0.6);

         // Cáusticas: dos capas de red luminosa a distinta deriva, la marca de
         // agua de los juegos de esta época. Se tiñen con el propio color del
         // líquido en vez de con un gris verdoso: sumar blanco desaturaba el
         // agua justo donde más brilla y la dejaba de color charco.
         vec2 cuv = vWorld.xz * 0.055;
         float k1 = texture2D(uCaustics, cuv + vec2(uTime * 0.021, uTime * 0.013)).r;
         float k2 = texture2D(uCaustics, cuv * 1.7 - vec2(uTime * 0.017, uTime * 0.024)).r;
         float caustic = max(0.0, (k1 + k2) - 1.05);
         gl_FragColor.rgb += mix(uSheen, vec3(1.0), 0.35) * caustic * uCausticAmount;

         /**
          * Brillo especular de sol sobre el oleaje.
          *
          * Es lo que separa una lámina de color de una superficie de agua, y
          * el rasgo más reconocible del acabado brillante de la época: reflejo
          * duro, muy blanco y con borde marcado, no un degradado suave.
          */
         vec3 nrm = normalize(vec3(
           sin(vWorld.x * 0.35 + uTime * 1.7) * 0.22 + sin(vWorld.z * 0.21 - uTime * 1.1) * 0.16,
           1.0,
           cos(vWorld.z * 0.31 - uTime * 1.4) * 0.22 + cos(vWorld.x * 0.19 + uTime * 0.9) * 0.16
         ));
         vec3 viewDir = normalize(cameraPosition - vWorld);
         vec3 halfway = normalize(uSunDir + viewDir);
         float spec = pow(max(dot(nrm, halfway), 0.0), 42.0);
         // Recorte en dos escalones: el reflejo se lee como una mancha con
         // contorno, igual que en el sombreado plano del resto del juego
         spec = smoothstep(0.25, 0.45, spec) * 0.55 + smoothstep(0.6, 0.75, spec) * 0.45;
         gl_FragColor.rgb += vec3(1.0, 0.98, 0.92) * spec * uSpecular;`,
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
    if (!sh?.uniforms) continue;
    if (sh.uniforms.uTime) sh.uniforms.uTime.value = liquidTime;
    // La dirección del sol cambia con la paleta del nivel
    if (sh.uniforms.uSunDir) (sh.uniforms.uSunDir.value as THREE.Vector3).copy(celLight.dir);
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
      uClouds: { value: cloudTexture() },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      varying float vHeight01;
      varying vec2 vUv;
      void main() {
        vec3 n = normalize(position);
        vHeight01 = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
        // Coordenada panorámica: las nubes envuelven el horizonte
        vUv = vec2(atan(n.z, n.x) / 6.2831853 + 0.5, clamp(n.y, 0.0, 1.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uTime;
      uniform sampler2D uClouds;
      varying float vHeight01;
      varying vec2 vUv;

      float band(float x, float n) { return floor(x * n) / n; }

      void main() {
        float h = vHeight01;
        // Cuantización suave: con la mezcla al 45 % los cielos saturados
        // salían con anillos concéntricos muy visibles, que en el original no
        // existen. Queda lo justo para insinuar el escalonado de la época.
        float b = band(h, 11.0);
        h = mix(h, b, 0.18);
        vec3 col = mix(uBottom, uTop, pow(clamp(h, 0.0, 1.0), 0.32));

        /**
         * Dos capas de cúmulos a distinta velocidad y escala. La capa lejana
         * se pega al horizonte y la cercana ocupa media bóveda: en el juego
         * de referencia el cielo es sobre todo nube, no azul liso, y esa masa
         * blanca es la mitad de la sensación de aire libre.
         */
        // Las bandas van muy pegadas al horizonte: la cámara mira casi
        // horizontal y solo entran en cuadro los quince primeros grados de
        // cielo. Con las nubes repartidas por toda la bóveda no se veía una.
        float band1 = clamp((vUv.y - 0.004) / 0.10, 0.0, 1.0);
        float band2 = clamp((vUv.y - 0.012) / 0.30, 0.0, 1.0);
        vec4 c1 = texture2D(uClouds, vec2(vUv.x * 1.6 + uTime * 0.0035, band1));
        vec4 c2 = texture2D(uClouds, vec2(vUv.x * 0.85 - uTime * 0.0018 + 0.37, band2));

        // Se desvanecen justo contra el horizonte y hacia el cenit
        float fade = smoothstep(0.0, 0.06, vHeight01 - 0.5) * (1.0 - smoothstep(0.86, 1.0, vHeight01));

        /**
         * Composición correcta de las dos capas: la cercana sobre la lejana,
         * ponderando por alfa. Mezclando los colores a secas, los téxeles
         * transparentes —que en un lienzo valen negro— arrastraban el cielo a
         * un gris plano; era el velo sucio que cubría la parte alta del cuadro.
         */
        float aFar = c1.a * 0.7;
        float aNear = c2.a;
        float aTot = aNear + aFar * (1.0 - aNear);
        vec3 cloudCol = aTot > 0.001
          ? (c2.rgb * aNear + c1.rgb * aFar * (1.0 - aNear)) / aTot
          : vec3(1.0);
        col = mix(col, cloudCol, clamp(aTot, 0.0, 1.0) * fade * 0.95);

        // Banda de calima sobre el horizonte: la lámina pálida que en todos
        // los fotogramas separa el cielo del suelo y aleja el fondo. Tiene que
        // ser fina —dos o tres grados— porque la cámara mira casi horizontal
        // y una banda ancha se come todo el cielo visible.
        float haze = 1.0 - smoothstep(0.5, 0.523, vHeight01);
        col = mix(col, mix(uBottom, vec3(1.0), 0.45), haze * 0.9);

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
