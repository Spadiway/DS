/**
 * Sombreado cel (toon) con bandas duras, luz de borde y contorno por casco invertido.
 * Es lo que da el aspecto de plataformas 3D de consola portátil de mediados de los 2000:
 * pocos polígonos, colores saturados y silueta marcada.
 */
import * as THREE from 'three';

/**
 * Los shaders cel escriben el color final directamente, sin flujo PBR ni
 * conversión de espacio. Si three convirtiera sRGB→lineal al crear cada Color,
 * la paleta saldría muy oscura y perdería la saturación que define el estilo.
 */
THREE.ColorManagement.enabled = false;

const VERT = /* glsl */ `
  precision mediump float;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vViewDir;
  varying float vHeight;
  varying float vCamDist;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vHeight = position.y;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec3 toCam = cameraPosition - wp.xyz;
    vCamDist = length(toCam);
    vViewDir = toCam / max(vCamDist, 0.0001);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  uniform vec3 uColor;
  uniform vec3 uColorAlt;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uBands;
  uniform float uEmissive;
  uniform float uBlendScale;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uWobble;

  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vViewDir;
  varying float vHeight;
  varying float vCamDist;

  void main() {
    vec3 n = normalize(vNormalW);
    float ndl = dot(n, normalize(uLightDir));

    // Bandas duras: el rasgo esencial del cel shading
    float lit = ndl * 0.5 + 0.5;
    float banded = floor(lit * uBands) / (uBands - 1.0);
    banded = clamp(banded, 0.0, 1.0);
    // Un pequeño suavizado evita el aliasing en los bordes de banda
    float soft = smoothstep(0.0, 0.06, abs(fract(lit * uBands) - 0.5));
    banded = mix(banded, lit, 0.12 * (1.0 - soft));
    banded = mix(0.5, 1.0, banded);

    // Mezcla de dos tonos según orientación (y altura si se pide): da volumen
    // a las formas sin necesidad de texturas.
    float mixer = clamp(n.y * 0.55 + 0.45, 0.0, 1.0);
    if (uBlendScale > 0.0) mixer *= clamp(vHeight * uBlendScale + 0.5, 0.0, 1.0);
    vec3 base = mix(uColorAlt, uColor, mixer);

    vec3 diffuse = base * (uAmbient + uLightColor * banded);

    // Luz de borde estilo dibujo animado
    float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), uRimPower);
    rim = smoothstep(0.45, 0.85, rim);
    diffuse += uRimColor * rim * 0.3;

    diffuse += base * uEmissive;

    // Ondulación de brillo para superficies "vivas" (agua, neón, energía)
    if (uWobble > 0.0) {
      float w = sin(vPosW.x * 0.35 + uTime * 1.6) * cos(vPosW.z * 0.31 - uTime * 1.2);
      diffuse += base * w * uWobble;
    }

    // Niebla: mezcla en bandas suaves hacia el color del cielo
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
    diffuse = mix(diffuse, uFogColor, clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(diffuse, uOpacity);
  }
`;

/** Variante del vértice para InstancedMesh (un solo draw call por tipo de objeto). */
const VERT_INSTANCED = /* glsl */ `
  precision mediump float;
  attribute vec3 instanceColor;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vViewDir;
  varying float vHeight;
  varying vec3 vTint;
  varying float vCamDist;

  void main() {
    mat4 im = instanceMatrix;
    vec4 local = im * vec4(position, 1.0);
    vec4 wp = modelMatrix * local;
    vPosW = wp.xyz;
    vHeight = position.y;
    vTint = instanceColor;
    vNormalW = normalize(mat3(modelMatrix) * mat3(im) * normal);
    vec3 toCam = cameraPosition - wp.xyz;
    vCamDist = length(toCam);
    vViewDir = toCam / max(vCamDist, 0.0001);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG_INSTANCED = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform vec3 uColorAlt;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uBands;
  uniform float uEmissive;
  uniform float uBlendScale;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uWobble;

  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uFadeNear;

  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vViewDir;
  varying float vHeight;
  varying vec3 vTint;
  varying float vCamDist;

  void main() {
    // Los props que se interponen entre la cámara y el jugador se disuelven con
    // un patrón de tramado en lugar de tapar la acción.
    if (uFadeNear > 0.0 && vCamDist < uFadeNear) {
      float keep = smoothstep(0.15, 1.0, vCamDist / uFadeNear);
      float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      if (keep < noise) discard;
    }
    vec3 n = normalize(vNormalW);
    float lit = dot(n, normalize(uLightDir)) * 0.5 + 0.5;
    float banded = clamp(floor(lit * uBands) / (uBands - 1.0), 0.0, 1.0);
    banded = mix(0.5, 1.0, banded);
    float mixer = uBlendScale > 0.0 ? clamp(vHeight * uBlendScale, 0.0, 1.0) : clamp(n.y * 0.55 + 0.45, 0.0, 1.0);
    vec3 base = mix(uColorAlt, uColor, mixer) * vTint;
    vec3 col = base * (uAmbient + uLightColor * banded);
    float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), uRimPower);
    col += uRimColor * smoothstep(0.5, 0.9, rim) * 0.4;
    col += base * uEmissive;
    if (uWobble > 0.0) {
      col += base * sin(vPosW.x * 0.3 + uTime * 1.4) * uWobble;
    }
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
    col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
    gl_FragColor = vec4(col, uOpacity);
  }
`;

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
};

/** Estado de iluminación global compartido por todos los materiales cel. */
export const celLight = {
  dir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(),
  color: new THREE.Color(0xfff2d0),
  ambient: new THREE.Color(0x8899bb),
  intensity: 1.4,
  fogColor: new THREE.Color(0x9fc0e0),
  fogDensity: 0.006,
};

const registry = new Set<THREE.ShaderMaterial>();

export function createCelMaterial(opts: CelOptions): THREE.ShaderMaterial {
  const color = new THREE.Color(opts.color);
  const alt = new THREE.Color(opts.colorAlt ?? opts.color).multiplyScalar(opts.colorAlt ? 1 : 0.72);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: opts.transparent ?? (opts.opacity ?? 1) < 1,
    depthWrite: opts.depthWrite ?? true,
    side: opts.side ?? THREE.FrontSide,
    uniforms: {
      uColor: { value: color },
      uColorAlt: { value: alt },
      uLightDir: { value: celLight.dir.clone() },
      uLightColor: { value: celLight.color.clone().multiplyScalar(celLight.intensity * 0.6) },
      uAmbient: { value: celLight.ambient.clone().multiplyScalar(0.42) },
      uRimColor: { value: new THREE.Color(opts.rim ?? 0xffffff) },
      uRimPower: { value: opts.rimPower ?? 2.2 },
      uBands: { value: opts.bands ?? 3 },
      uEmissive: { value: opts.emissive ?? 0 },
      uBlendScale: { value: opts.blendScale ?? 0 },
      uOpacity: { value: opts.opacity ?? 1 },
      uTime: { value: 0 },
      uWobble: { value: opts.wobble ?? 0 },
      uFogColor: { value: celLight.fogColor.clone() },
      uFogDensity: { value: celLight.fogDensity },
      uFadeNear: { value: 0 },
    },
  });
  registry.add(mat);
  return mat;
}

/** Igual que createCelMaterial pero apto para InstancedMesh con tinte por instancia. */
export function createCelMaterialInstanced(opts: CelOptions): THREE.ShaderMaterial {
  const mat = createCelMaterial(opts);
  mat.vertexShader = VERT_INSTANCED;
  mat.fragmentShader = FRAG_INSTANCED;
  return mat;
}

/**
 * Material del terreno: mezcla tres tonos (hierba / hierba alternativa / roca)
 * según la altura y la pendiente, con las mismas bandas duras del cel shading.
 */
export function createTerrainMaterial(opts: {
  ground: number;
  groundAlt: number;
  cliff: number;
  bands?: number;
  snowLine?: number;
}): THREE.ShaderMaterial {
  const mat = createCelMaterial({ color: opts.ground, colorAlt: opts.groundAlt, bands: opts.bands ?? 4 });
  mat.uniforms.uCliff = { value: new THREE.Color(opts.cliff) };
  mat.uniforms.uSnowLine = { value: opts.snowLine ?? 9999 };
  mat.vertexShader = /* glsl */ `
    precision mediump float;
    varying vec3 vNormalW;
    varying vec3 vPosW;
    varying vec3 vViewDir;
    varying float vCamDist;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vPosW = wp.xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vec3 toCam = cameraPosition - wp.xyz;
      vCamDist = length(toCam);
      vViewDir = toCam / max(vCamDist, 0.0001);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  mat.fragmentShader = /* glsl */ `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uColorAlt;
    uniform vec3 uCliff;
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    uniform vec3 uAmbient;
    uniform vec3 uRimColor;
    uniform float uBands;
    uniform float uSnowLine;
    uniform float uTime;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    varying vec3 vNormalW;
    varying vec3 vPosW;
    varying vec3 vViewDir;
    varying float vCamDist;

    void main() {
      vec3 n = normalize(vNormalW);
      float slope = 1.0 - clamp(n.y, 0.0, 1.0);
      float rock = smoothstep(0.28, 0.55, slope);

      // Parches de color en el suelo: rompe la uniformidad sin usar texturas
      float blotch = sin(vPosW.x * 0.09) * cos(vPosW.z * 0.11) * 0.5 + 0.5;
      vec3 grass = mix(uColorAlt, uColor, smoothstep(0.35, 0.75, blotch));
      vec3 base = mix(grass, uCliff, rock);
      base = mix(base, vec3(0.95, 0.97, 1.0), smoothstep(uSnowLine, uSnowLine + 6.0, vPosW.y));

      float lit = dot(n, normalize(uLightDir)) * 0.5 + 0.5;
      float banded = clamp(floor(lit * uBands) / (uBands - 1.0), 0.0, 1.0);
      banded = mix(0.55, 1.0, banded);
      vec3 col = base * (uAmbient + uLightColor * banded);

      float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 3.0);
      col += uRimColor * smoothstep(0.75, 1.0, rim) * 0.08;

      float fog = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
      col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `;
  return mat;
}

/** Material de líquido (agua, lava, ácido, limo) con oleaje animado. */
export function createLiquidMaterial(color: number, emissive: number, opacity: number): THREE.ShaderMaterial {
  const mat = createCelMaterial({ color, bands: 3, emissive, opacity, transparent: true, side: THREE.DoubleSide });
  mat.vertexShader = /* glsl */ `
    precision mediump float;
    uniform float uTime;
    varying vec3 vPosW;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    void main() {
      vec3 p = position;
      float w = sin(p.x * 0.12 + uTime * 1.3) * 0.32 + cos(p.y * 0.15 - uTime * 1.05) * 0.28;
      p.z += w;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vPosW = wp.xyz;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  mat.fragmentShader = /* glsl */ `
    precision mediump float;
    uniform vec3 uColor;
    uniform vec3 uLightColor;
    uniform vec3 uAmbient;
    uniform float uEmissive;
    uniform float uOpacity;
    uniform float uTime;
    varying vec3 vPosW;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    void main() {
      // Espuma en bandas: agua "de dibujos", no realista
      float ripple = sin(vPosW.x * 0.5 + uTime * 2.0) * cos(vPosW.z * 0.42 - uTime * 1.6);
      float foam = smoothstep(0.55, 0.95, ripple);
      vec3 col = uColor * (uAmbient + uLightColor * 0.8) + uColor * uEmissive;
      col += vec3(0.35) * foam;
      float fres = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 2.5);
      col += vec3(0.25) * fres;
      gl_FragColor = vec4(col, clamp(uOpacity + fres * 0.25, 0.0, 1.0));
    }
  `;
  return mat;
}

export function updateCelLighting(dir: THREE.Vector3, color: THREE.Color, ambient: THREE.Color, intensity: number): void {
  celLight.dir.copy(dir).normalize();
  celLight.color.copy(color);
  celLight.ambient.copy(ambient);
  celLight.intensity = intensity;
  // Ambiente y luz directa se reparten el rango: juntos rondan 1.0 en las zonas
  // iluminadas, de modo que los colores saturados no se queman a blanco.
  const scaled = color.clone().multiplyScalar(intensity * 0.6);
  const amb = ambient.clone().multiplyScalar(0.42);
  for (const m of registry) {
    m.uniforms.uLightDir.value.copy(celLight.dir);
    m.uniforms.uLightColor.value.copy(scaled);
    m.uniforms.uAmbient.value.copy(amb);
  }
}

/** Ajusta la niebla global (color del horizonte y densidad) de todos los cel. */
export function updateCelFog(color: THREE.Color, density: number): void {
  celLight.fogColor.copy(color);
  celLight.fogDensity = density;
  for (const m of registry) {
    if (m.uniforms.uFogColor) m.uniforms.uFogColor.value.copy(color);
    if (m.uniforms.uFogDensity) m.uniforms.uFogDensity.value = density;
  }
}

export function tickCelMaterials(time: number): void {
  for (const m of registry) {
    if (m.uniforms.uTime) m.uniforms.uTime.value = time;
  }
}

export function disposeCelMaterial(mat: THREE.ShaderMaterial): void {
  registry.delete(mat);
  mat.dispose();
}

export function clearCelRegistry(keep: Set<THREE.ShaderMaterial>): void {
  for (const m of Array.from(registry)) {
    if (!keep.has(m)) {
      registry.delete(m);
      m.dispose();
    }
  }
}

// ─────────────────────────── Contorno ───────────────────────────

const OUTLINE_VERT = /* glsl */ `
  precision mediump float;
  uniform float uThickness;
  void main() {
    vec3 p = position + normal * uThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }
`;

export function createOutlineMaterial(thickness = 0.035, color = 0x10121c): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(color) },
    },
    side: THREE.BackSide,
  });
}

/** Envuelve una malla con su casco invertido para dibujar el contorno negro. */
export function withOutline(mesh: THREE.Mesh, thickness = 0.035, color = 0x10121c): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh);
  const outline = new THREE.Mesh(mesh.geometry, createOutlineMaterial(thickness, color));
  outline.renderOrder = -1;
  outline.frustumCulled = mesh.frustumCulled;
  group.add(outline);
  return group;
}

/** Cielo con degradado vertical (dos colores) mediante una esfera invertida. */
export function createSkyDome(top: number, bottom: number, radius = 520): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      varying float vHeight01;
      varying vec2 vSwirl;
      void main() {
        // La altura normalizada se calcula aquí: en el fragmento, con mediump,
        // normalizar un vector de cientos de unidades desborda el rango.
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
      void main() {
        // Bandas suaves: el cielo también es "cel"
        float h = vHeight01;
        float b = floor(h * 8.0) / 8.0;
        h = mix(h, b, 0.4);
        vec3 col = mix(uBottom, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
        // Nubes largas y planas, en la línea del cielo de dibujos animados
        float cloud = sin(vSwirl.x * 3.1 + uTime * 0.05) * cos(vSwirl.y * 2.4 - uTime * 0.04);
        col += vec3(0.09) * smoothstep(0.55, 0.95, cloud) * smoothstep(0.45, 0.8, vHeight01);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
