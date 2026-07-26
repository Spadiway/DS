/**
 * Definición de los 8 mundos y sus niveles.
 * Cada LevelSpec es la "semilla de diseño" que consume engine/levelGen.ts:
 * el generador es determinista, así que un mismo spec produce siempre el mismo nivel.
 */

export type PetColor = 'yellow' | 'red' | 'blue' | 'white' | 'green';

export type LiquidKind = 'none' | 'water' | 'lava' | 'acid' | 'slime' | 'void';

export type ThemePalette = {
  /** [color del horizonte, color del cenit]. La niebla usa el del horizonte. */
  sky: [number, number];
  fog: number;
  fogDensity: number;
  ground: number;
  groundAlt: number;
  cliff: number;
  prop: number;
  propAlt: number;
  liquid: number;
  ambient: number;
  sun: number;
  sunIntensity: number;
};

export type PropKind =
  | 'palm'
  | 'fern'
  | 'pine'
  | 'deadTree'
  | 'rock'
  | 'crystal'
  | 'mushroom'
  | 'bone'
  | 'coral'
  | 'iceSpike'
  | 'pillar'
  | 'lantern'
  | 'neonSign'
  | 'pipe'
  | 'flesh'
  | 'monolith'
  | 'banner'
  | 'grass'
  // Mobiliario construido: es lo que puebla el escenario y le da escala
  | 'fence'
  | 'logStair'
  | 'hut'
  | 'signpost'
  | 'barrel'
  | 'lampPost'
  | 'archway';

export type LevelSpec = {
  id: string;
  worldId: number;
  nameKey: string;
  name: { es: string; en: string };
  size: number;
  seed: number;
  terrain: {
    amplitude: number;
    frequency: number;
    octaves: number;
    plateau: number;
    islandFalloff: number;
    ridged?: boolean;
    /** Altura de cada meseta; 0 desactiva el aterrazado. */
    terraceStep?: number;
    terraceAmount?: number;
  };
  liquid: { kind: LiquidKind; level: number; damage: number };
  palette: ThemePalette;
  props: { kind: PropKind; count: number; scale: [number, number] }[];
  platforms: { count: number; minY: number; maxY: number; size: [number, number]; moving: number };
  pets: { color: PetColor; count: number }[];
  required: number;
  coins: number;
  cookies: number;
  gadgetUnlock?: string;
  gadgetGates: { kind: 'punchWall' | 'dashGate' | 'hoopGap' | 'clubCrate' | 'waterZone'; count: number }[];
  boss?: 'silva' | 'guardian' | 'deedee';
  music: string;
  slippery?: boolean;
  lowGravity?: boolean;
  interior?: boolean;
  tutorial?: string[];
};

const pal = (p: Partial<ThemePalette> & Pick<ThemePalette, 'sky' | 'ground' | 'liquid'>): ThemePalette => ({
  fog: p.fog ?? p.sky[0],
  fogDensity: p.fogDensity ?? 0.006,
  groundAlt: p.groundAlt ?? p.ground,
  cliff: p.cliff ?? 0x6b5a48,
  prop: p.prop ?? 0x3f8a3a,
  propAlt: p.propAlt ?? 0x2f6b2c,
  ambient: p.ambient ?? 0x8899bb,
  sun: p.sun ?? 0xfff2d0,
  sunIntensity: p.sunIntensity ?? 1.5,
  ...p,
});

// ───────────────────────── MUNDO 1 · LA TIERRA PERDIDA ─────────────────────────

const W1: LevelSpec[] = [
  {
    id: '1-1',
    worldId: 1,
    nameKey: 'level.1-1',
    name: { es: 'Llanura Fósil', en: 'Fossil Plain' },
    size: 190,
    seed: 1101,
    terrain: { amplitude: 15, frequency: 0.016, octaves: 4, plateau: 0.35, islandFalloff: 0.75 },
    liquid: { kind: 'water', level: -2.5, damage: 0 },
    palette: pal({
      sky: [0xffd79a, 0x7fb2e8],
      ground: 0x8fbf5a,
      groundAlt: 0xc2a85f,
      cliff: 0x8a6d4a,
      prop: 0x4f9e42,
      propAlt: 0xd8c98f,
      liquid: 0x3fa8d8,
      fogDensity: 0.0035,
    }),
    props: [
      { kind: 'palm', count: 26, scale: [1, 1.6] },
      { kind: 'fern', count: 40, scale: [0.7, 1.3] },
      { kind: 'bone', count: 18, scale: [1, 2.2] },
      { kind: 'rock', count: 22, scale: [0.8, 2] },
      { kind: 'grass', count: 260, scale: [0.6, 1.2] },
    ],
    platforms: { count: 10, minY: 3, maxY: 12, size: [5, 9], moving: 2 },
    pets: [
      { color: 'yellow', count: 5 },
      { color: 'blue', count: 2 },
    ],
    required: 5,
    coins: 3,
    cookies: 4,
    gadgetGates: [{ kind: 'clubCrate', count: 4 }],
    music: 'w1',
    tutorial: ['tut.move', 'tut.jump', 'tut.net', 'tut.alert'],
  },
  {
    id: '1-2',
    worldId: 1,
    nameKey: 'level.1-2',
    name: { es: 'Ciénaga Primigenia', en: 'Primordial Marsh' },
    size: 200,
    seed: 1102,
    terrain: { amplitude: 12, frequency: 0.021, octaves: 4, plateau: 0.28, islandFalloff: 0.7 },
    liquid: { kind: 'water', level: 1.2, damage: 0 },
    palette: pal({
      sky: [0xa8d9a0, 0x4e7f5e],
      ground: 0x5f7a3c,
      groundAlt: 0x46603a,
      cliff: 0x51513f,
      prop: 0x2f7a4a,
      propAlt: 0x7fae4f,
      liquid: 0x3d7a5c,
      fogDensity: 0.012,
      ambient: 0x6f8f7a,
      sunIntensity: 1.15,
    }),
    props: [
      { kind: 'fern', count: 60, scale: [0.9, 1.8] },
      { kind: 'mushroom', count: 30, scale: [0.8, 2.2] },
      { kind: 'deadTree', count: 20, scale: [1.2, 2.4] },
      { kind: 'rock', count: 16, scale: [0.7, 1.6] },
      { kind: 'grass', count: 200, scale: [0.7, 1.4] },
    ],
    platforms: { count: 14, minY: 3, maxY: 11, size: [4, 8], moving: 4 },
    pets: [
      { color: 'yellow', count: 4 },
      { color: 'blue', count: 3 },
      { color: 'red', count: 2 },
    ],
    required: 6,
    coins: 3,
    cookies: 5,
    gadgetUnlock: 'waterNet',
    gadgetGates: [
      { kind: 'waterZone', count: 3 },
      { kind: 'clubCrate', count: 3 },
    ],
    music: 'w1',
  },
  {
    id: '1-3',
    worldId: 1,
    nameKey: 'level.1-3',
    name: { es: 'Valle de Lava', en: 'Molten Valley' },
    size: 175,
    seed: 1103,
    terrain: { amplitude: 14, frequency: 0.022, octaves: 4, plateau: 0.25, islandFalloff: 0.8, ridged: true },
    liquid: { kind: 'lava', level: -1, damage: 34 },
    palette: pal({
      sky: [0xff8a3d, 0x5e2438],
      ground: 0xb0603c,
      groundAlt: 0x4e4048,
      cliff: 0x3e2c2c,
      prop: 0x4a2a22,
      propAlt: 0xff8a3a,
      liquid: 0xff4a12,
      fogDensity: 0.009,
      ambient: 0xd08a5a,
      sun: 0xffc890,
      sunIntensity: 1.5,
    }),
    props: [
      { kind: 'rock', count: 40, scale: [1, 3] },
      { kind: 'deadTree', count: 14, scale: [1, 2] },
      { kind: 'bone', count: 12, scale: [1, 2] },
      { kind: 'crystal', count: 10, scale: [1, 2.4] },
    ],
    platforms: { count: 18, minY: 2, maxY: 14, size: [4, 7], moving: 7 },
    pets: [
      { color: 'yellow', count: 3 },
      { color: 'red', count: 4 },
      { color: 'white', count: 2 },
    ],
    required: 7,
    coins: 3,
    cookies: 6,
    gadgetGates: [{ kind: 'clubCrate', count: 5 }],
    boss: 'silva',
    music: 'w1',
  },
];

// ───────────────────────── MUNDO 2 · LA ERA MISTERIOSA ─────────────────────────

const W2: LevelSpec[] = [
  {
    id: '2-1',
    worldId: 2,
    nameKey: 'level.2-1',
    name: { es: 'Jungla Ancestral', en: 'Ancestral Jungle' },
    size: 205,
    seed: 2101,
    terrain: { amplitude: 12, frequency: 0.018, octaves: 4, plateau: 0.35, islandFalloff: 0.72 },
    liquid: { kind: 'water', level: -1.5, damage: 0 },
    palette: pal({
      sky: [0xbfe08a, 0x24512f],
      ground: 0x2f6b34,
      groundAlt: 0x53853a,
      cliff: 0x4d4535,
      prop: 0x1f5c33,
      propAlt: 0x8fce56,
      liquid: 0x2f7f6a,
      fogDensity: 0.014,
      ambient: 0x5f8f5a,
    }),
    props: [
      { kind: 'palm', count: 46, scale: [1.4, 2.6] },
      { kind: 'fern', count: 70, scale: [1, 2] },
      { kind: 'mushroom', count: 22, scale: [0.8, 1.8] },
      { kind: 'pillar', count: 10, scale: [1, 2] },
      { kind: 'grass', count: 300, scale: [0.8, 1.6] },
    ],
    platforms: { count: 18, minY: 4, maxY: 20, size: [4, 8], moving: 5 },
    pets: [
      { color: 'yellow', count: 4 },
      { color: 'blue', count: 3 },
      { color: 'red', count: 2 },
      { color: 'white', count: 1 },
    ],
    required: 7,
    coins: 3,
    cookies: 5,
    gadgetGates: [
      { kind: 'clubCrate', count: 4 },
      { kind: 'waterZone', count: 2 },
    ],
    music: 'w2',
  },
  {
    id: '2-2',
    worldId: 2,
    nameKey: 'level.2-2',
    name: { es: 'Ruinas del Eco', en: 'Echo Ruins' },
    size: 185,
    seed: 2102,
    terrain: { amplitude: 13, frequency: 0.017, octaves: 4, plateau: 0.45, islandFalloff: 0.78 },
    liquid: { kind: 'water', level: -3, damage: 0 },
    palette: pal({
      sky: [0x6a5c8a, 0x1e1a2e],
      ground: 0x64597c,
      groundAlt: 0x8a7f9c,
      cliff: 0x352f44,
      prop: 0x9a92a8,
      propAlt: 0x4de0c0,
      liquid: 0x2a4a6a,
      fogDensity: 0.01,
      ambient: 0x6a6390,
      sun: 0xd0bcff,
      sunIntensity: 1.35,
    }),
    props: [
      { kind: 'pillar', count: 34, scale: [1.2, 3] },
      { kind: 'monolith', count: 16, scale: [1, 2.4] },
      { kind: 'rock', count: 24, scale: [0.8, 2] },
      { kind: 'crystal', count: 14, scale: [0.8, 2] },
      { kind: 'lantern', count: 18, scale: [1, 1.4] },
    ],
    platforms: { count: 22, minY: 3, maxY: 18, size: [4, 7], moving: 8 },
    pets: [
      { color: 'yellow', count: 3 },
      { color: 'blue', count: 3 },
      { color: 'red', count: 3 },
      { color: 'white', count: 2 },
    ],
    required: 8,
    coins: 3,
    cookies: 5,
    gadgetUnlock: 'stunClub',
    gadgetGates: [{ kind: 'clubCrate', count: 8 }],
    music: 'w2',
  },
  {
    id: '2-3',
    worldId: 2,
    nameKey: 'level.2-3',
    name: { es: 'Templo Cifrado', en: 'Ciphered Temple' },
    size: 175,
    seed: 2103,
    terrain: { amplitude: 10, frequency: 0.024, octaves: 4, plateau: 0.5, islandFalloff: 0.82 },
    liquid: { kind: 'acid', level: -2, damage: 26 },
    palette: pal({
      sky: [0x8a6a4a, 0x2a1e18],
      ground: 0x7a6142,
      groundAlt: 0x94764e,
      cliff: 0x4a3826,
      prop: 0xc0a068,
      propAlt: 0x7fe0a0,
      liquid: 0x7fe04a,
      fogDensity: 0.018,
      ambient: 0x6a5a44,
      sun: 0xffd8a0,
      sunIntensity: 1.1,
    }),
    props: [
      { kind: 'pillar', count: 40, scale: [1.4, 3.2] },
      { kind: 'monolith', count: 22, scale: [1, 2.6] },
      { kind: 'lantern', count: 24, scale: [1, 1.5] },
      { kind: 'crystal', count: 12, scale: [1, 2] },
    ],
    platforms: { count: 26, minY: 3, maxY: 22, size: [3.5, 7], moving: 10 },
    pets: [
      { color: 'yellow', count: 3 },
      { color: 'blue', count: 3 },
      { color: 'red', count: 3 },
      { color: 'white', count: 2 },
      { color: 'green', count: 1 },
    ],
    required: 9,
    coins: 3,
    cookies: 6,
    gadgetGates: [
      { kind: 'clubCrate', count: 6 },
      { kind: 'waterZone', count: 2 },
    ],
    boss: 'guardian',
    music: 'w2',
  },
];

// ───────────────────────────── MUNDO 3 · OCEANA ─────────────────────────────

const W3: LevelSpec[] = [
  {
    id: '3-1',
    worldId: 3,
    nameKey: 'level.3-1',
    name: { es: 'Playa Cangrejal', en: 'Crab Shore' },
    size: 210,
    seed: 3101,
    terrain: { amplitude: 11, frequency: 0.014, octaves: 4, plateau: 0.5, islandFalloff: 0.62 },
    liquid: { kind: 'water', level: 0.5, damage: 0 },
    palette: pal({
      sky: [0x9fe0ff, 0x2f9fd8],
      ground: 0xf0dfa8,
      groundAlt: 0xd8c07a,
      cliff: 0xb09a6a,
      prop: 0x3fae7a,
      propAlt: 0xff9f5a,
      liquid: 0x28b8e0,
      fogDensity: 0.003,
      ambient: 0xaad8ff,
      sunIntensity: 1.8,
    }),
    props: [
      { kind: 'palm', count: 34, scale: [1.2, 2.2] },
      { kind: 'coral', count: 40, scale: [0.8, 2] },
      { kind: 'rock', count: 26, scale: [0.7, 2.2] },
      { kind: 'grass', count: 160, scale: [0.6, 1.1] },
    ],
    platforms: { count: 16, minY: 3, maxY: 14, size: [5, 9], moving: 6 },
    pets: [
      { color: 'yellow', count: 3 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 2 },
      { color: 'white', count: 2 },
    ],
    required: 8,
    coins: 3,
    cookies: 5,
    gadgetUnlock: 'dashHoop',
    gadgetGates: [
      { kind: 'dashGate', count: 5 },
      { kind: 'waterZone', count: 4 },
    ],
    music: 'w3',
  },
  {
    id: '3-2',
    worldId: 3,
    nameKey: 'level.3-2',
    name: { es: 'Gruta de Coral', en: 'Coral Grotto' },
    size: 180,
    seed: 3102,
    terrain: { amplitude: 11, frequency: 0.026, octaves: 4, plateau: 0.4, islandFalloff: 0.85 },
    liquid: { kind: 'water', level: 2, damage: 0 },
    palette: pal({
      sky: [0x2a6a9a, 0x0a2a4a],
      ground: 0x3a5a6a,
      groundAlt: 0x2e4756,
      cliff: 0x24394a,
      prop: 0xff6aa0,
      propAlt: 0x5fe0d0,
      liquid: 0x1f8fbf,
      fogDensity: 0.013,
      ambient: 0x4a94b8,
      sun: 0xbdf0ff,
      sunIntensity: 1.3,
    }),
    props: [
      { kind: 'coral', count: 90, scale: [1, 3] },
      { kind: 'crystal', count: 26, scale: [0.8, 2.4] },
      { kind: 'rock', count: 30, scale: [1, 2.6] },
      { kind: 'mushroom', count: 20, scale: [0.8, 1.6] },
    ],
    platforms: { count: 24, minY: 3, maxY: 18, size: [4, 7], moving: 9 },
    pets: [
      { color: 'yellow', count: 3 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 2 },
      { color: 'white', count: 2 },
      { color: 'green', count: 1 },
    ],
    required: 9,
    coins: 3,
    cookies: 6,
    gadgetGates: [
      { kind: 'waterZone', count: 5 },
      { kind: 'dashGate', count: 3 },
    ],
    music: 'w3',
  },
  {
    id: '3-3',
    worldId: 3,
    nameKey: 'level.3-3',
    name: { es: 'El Vientre de Tragaldabas', en: "The Gobbler's Belly" },
    size: 165,
    seed: 3103,
    terrain: { amplitude: 9, frequency: 0.03, octaves: 4, plateau: 0.35, islandFalloff: 0.9 },
    liquid: { kind: 'acid', level: -0.5, damage: 30 },
    interior: true,
    palette: pal({
      sky: [0x8a2a3a, 0x3a0a12],
      ground: 0xd47f86,
      groundAlt: 0xac5a64,
      cliff: 0x8c3743,
      prop: 0xe08a94,
      propAlt: 0xffc0c8,
      liquid: 0xaee04a,
      fogDensity: 0.015,
      ambient: 0xa85a64,
      sun: 0xffb8c0,
      sunIntensity: 1.25,
    }),
    props: [
      { kind: 'flesh', count: 60, scale: [1, 3] },
      { kind: 'mushroom', count: 34, scale: [1, 2.6] },
      { kind: 'pipe', count: 18, scale: [1, 2.2] },
      { kind: 'crystal', count: 10, scale: [0.8, 1.6] },
    ],
    platforms: { count: 30, minY: 2, maxY: 20, size: [3.5, 6.5], moving: 14 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 3 },
      { color: 'white', count: 2 },
      { color: 'green', count: 2 },
    ],
    required: 10,
    coins: 3,
    cookies: 7,
    gadgetGates: [
      { kind: 'dashGate', count: 4 },
      { kind: 'clubCrate', count: 6 },
    ],
    boss: 'guardian',
    music: 'w3',
  },
];

// ─────────────────── MUNDO 4 · NUEVA TIERRA DE HIELO ───────────────────

const W4: LevelSpec[] = [
  {
    id: '4-1',
    worldId: 4,
    nameKey: 'level.4-1',
    name: { es: 'Océano Congelado', en: 'Frozen Ocean' },
    size: 205,
    seed: 4101,
    terrain: { amplitude: 13, frequency: 0.015, octaves: 4, plateau: 0.5, islandFalloff: 0.7 },
    liquid: { kind: 'water', level: -1, damage: 12 },
    slippery: true,
    palette: pal({
      sky: [0xdff2ff, 0x8fbfe0],
      ground: 0xeaf6ff,
      groundAlt: 0xc4dff0,
      cliff: 0x9fc0d8,
      prop: 0xbfe8ff,
      propAlt: 0x7fd0f0,
      liquid: 0x2a6a9a,
      fogDensity: 0.007,
      ambient: 0xc0dcf0,
      sun: 0xffffff,
      sunIntensity: 1.7,
    }),
    props: [
      { kind: 'iceSpike', count: 54, scale: [1, 3] },
      { kind: 'pine', count: 30, scale: [1.2, 2.4] },
      { kind: 'rock', count: 20, scale: [0.8, 2] },
    ],
    platforms: { count: 20, minY: 3, maxY: 16, size: [4, 8], moving: 8 },
    pets: [
      { color: 'yellow', count: 3 },
      { color: 'blue', count: 3 },
      { color: 'red', count: 3 },
      { color: 'white', count: 3 },
    ],
    required: 9,
    coins: 3,
    cookies: 6,
    gadgetUnlock: 'magicPunch',
    gadgetGates: [
      { kind: 'punchWall', count: 6 },
      { kind: 'dashGate', count: 3 },
    ],
    music: 'w4',
  },
  {
    id: '4-2',
    worldId: 4,
    nameKey: 'level.4-2',
    name: { es: 'Refugio Escarchado', en: 'Frosty Refuge' },
    size: 180,
    seed: 4102,
    terrain: { amplitude: 13, frequency: 0.025, octaves: 4, plateau: 0.35, islandFalloff: 0.86 },
    liquid: { kind: 'water', level: -2, damage: 14 },
    slippery: true,
    interior: true,
    palette: pal({
      sky: [0x4a7a9a, 0x0f2438],
      ground: 0xa8d8ea,
      groundAlt: 0x7fb0cc,
      cliff: 0x5a8098,
      prop: 0xd0f0ff,
      propAlt: 0x60c8e8,
      liquid: 0x1a4a6a,
      fogDensity: 0.012,
      ambient: 0x6aa4c8,
      sun: 0xe4f4ff,
      sunIntensity: 1.4,
    }),
    props: [
      { kind: 'iceSpike', count: 80, scale: [1, 3.4] },
      { kind: 'crystal', count: 30, scale: [1, 2.4] },
      { kind: 'rock', count: 24, scale: [0.9, 2.2] },
    ],
    platforms: { count: 26, minY: 3, maxY: 20, size: [3.5, 7], moving: 11 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 3 },
      { color: 'white', count: 3 },
      { color: 'green', count: 1 },
    ],
    required: 10,
    coins: 3,
    cookies: 6,
    gadgetGates: [
      { kind: 'punchWall', count: 7 },
      { kind: 'clubCrate', count: 5 },
    ],
    music: 'w4',
  },
  {
    id: '4-3',
    worldId: 4,
    nameKey: 'level.4-3',
    name: { es: 'Aguas Termales', en: 'Steaming Springs' },
    size: 175,
    seed: 4103,
    terrain: { amplitude: 10, frequency: 0.02, octaves: 4, plateau: 0.45, islandFalloff: 0.8 },
    liquid: { kind: 'water', level: 0.8, damage: 0 },
    palette: pal({
      sky: [0xffd8e8, 0x9a7fb0],
      ground: 0x8a7f70,
      groundAlt: 0xbfae98,
      cliff: 0x6a5f56,
      prop: 0xe8b8c8,
      propAlt: 0x7fd8c0,
      liquid: 0x8fe0e8,
      fogDensity: 0.015,
      ambient: 0xc0a8c0,
      sun: 0xffe8f0,
      sunIntensity: 1.4,
    }),
    props: [
      { kind: 'pine', count: 34, scale: [1.2, 2.6] },
      { kind: 'rock', count: 40, scale: [1, 2.6] },
      { kind: 'lantern', count: 20, scale: [1, 1.4] },
      { kind: 'grass', count: 180, scale: [0.6, 1.2] },
    ],
    platforms: { count: 24, minY: 3, maxY: 18, size: [4, 7], moving: 10 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 3 },
      { color: 'white', count: 3 },
      { color: 'green', count: 2 },
    ],
    required: 11,
    coins: 3,
    cookies: 7,
    gadgetGates: [
      { kind: 'punchWall', count: 4 },
      { kind: 'waterZone', count: 4 },
      { kind: 'dashGate', count: 3 },
    ],
    boss: 'silva',
    music: 'w4',
  },
];

// ─────────────────────── MUNDO 5 · ÉPOCA MEDIEVAL ───────────────────────

const W5: LevelSpec[] = [
  {
    id: '5-1',
    worldId: 5,
    nameKey: 'level.5-1',
    name: { es: 'Templo Sereno', en: 'Serene Temple' },
    size: 190,
    seed: 5101,
    terrain: { amplitude: 14, frequency: 0.017, octaves: 4, plateau: 0.45, islandFalloff: 0.75 },
    liquid: { kind: 'water', level: -1.5, damage: 0 },
    palette: pal({
      sky: [0xffc0a8, 0xa85a6a],
      ground: 0x7a9a5a,
      groundAlt: 0xa8b878,
      cliff: 0x8a7a5a,
      prop: 0xc04a3a,
      propAlt: 0xffd8a0,
      liquid: 0x4a8fa8,
      fogDensity: 0.008,
      ambient: 0xc09a8a,
      sun: 0xffd0a0,
      sunIntensity: 1.5,
    }),
    props: [
      { kind: 'pine', count: 40, scale: [1.4, 2.8] },
      { kind: 'lantern', count: 30, scale: [1, 1.6] },
      { kind: 'pillar', count: 22, scale: [1, 2.4] },
      { kind: 'banner', count: 18, scale: [1, 2] },
      { kind: 'grass', count: 220, scale: [0.7, 1.3] },
    ],
    platforms: { count: 24, minY: 4, maxY: 24, size: [4, 8], moving: 10 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 4 },
      { color: 'white', count: 2 },
      { color: 'green', count: 1 },
    ],
    required: 10,
    coins: 3,
    cookies: 6,
    gadgetUnlock: 'superHoop',
    gadgetGates: [
      { kind: 'hoopGap', count: 6 },
      { kind: 'punchWall', count: 3 },
    ],
    music: 'w5',
  },
  {
    id: '5-2',
    worldId: 5,
    nameKey: 'level.5-2',
    name: { es: 'La Gran Muralla', en: 'The Great Wall' },
    size: 215,
    seed: 5102,
    terrain: { amplitude: 18, frequency: 0.02, octaves: 4, plateau: 0.3, islandFalloff: 0.72, ridged: true },
    liquid: { kind: 'void', level: -22, damage: 100 },
    palette: pal({
      sky: [0xd8c8a8, 0x8a7a6a],
      ground: 0x9a8a6a,
      groundAlt: 0x7a6a52,
      cliff: 0x5a4e40,
      prop: 0xb0a080,
      propAlt: 0xc03a3a,
      liquid: 0x1a1a22,
      fogDensity: 0.01,
      ambient: 0xa89a80,
      sunIntensity: 1.4,
    }),
    props: [
      { kind: 'pillar', count: 44, scale: [1.2, 3 ] },
      { kind: 'banner', count: 30, scale: [1, 2.2] },
      { kind: 'rock', count: 26, scale: [1, 2.4] },
      { kind: 'lantern', count: 22, scale: [1, 1.4] },
    ],
    platforms: { count: 30, minY: 4, maxY: 26, size: [3.5, 7], moving: 14 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 4 },
      { color: 'white', count: 3 },
      { color: 'green', count: 2 },
    ],
    required: 11,
    coins: 3,
    cookies: 7,
    gadgetGates: [
      { kind: 'hoopGap', count: 7 },
      { kind: 'dashGate', count: 4 },
    ],
    music: 'w5',
  },
  {
    id: '5-3',
    worldId: 5,
    nameKey: 'level.5-3',
    name: { es: 'Castillo en Ruinas', en: 'Crumbling Castle' },
    size: 185,
    seed: 5103,
    terrain: { amplitude: 12, frequency: 0.022, octaves: 4, plateau: 0.45, islandFalloff: 0.84 },
    liquid: { kind: 'water', level: -4, damage: 0 },
    interior: true,
    palette: pal({
      sky: [0x5a4a6a, 0x1a1424],
      ground: 0x7d6f60,
      groundAlt: 0x4a3f42,
      cliff: 0x332b2c,
      prop: 0xa2937f,
      propAlt: 0xffb04a,
      liquid: 0x2a3a4a,
      fogDensity: 0.011,
      ambient: 0x6a5a78,
      sun: 0xffd08a,
      sunIntensity: 1.35,
    }),
    props: [
      { kind: 'pillar', count: 46, scale: [1.4, 3.4] },
      { kind: 'banner', count: 26, scale: [1, 2.4] },
      { kind: 'lantern', count: 30, scale: [1, 1.6] },
      { kind: 'rock', count: 22, scale: [0.8, 2] },
    ],
    platforms: { count: 30, minY: 3, maxY: 24, size: [3.5, 7], moving: 13 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 3 },
      { color: 'red', count: 5 },
      { color: 'white', count: 3 },
      { color: 'green', count: 2 },
    ],
    required: 12,
    coins: 3,
    cookies: 7,
    gadgetGates: [
      { kind: 'punchWall', count: 5 },
      { kind: 'hoopGap', count: 5 },
      { kind: 'clubCrate', count: 6 },
    ],
    boss: 'guardian',
    music: 'w5',
  },
];

// ────────────────────────── MUNDO 6 · FUTURAMA ──────────────────────────

const W6: LevelSpec[] = [
  {
    id: '6-1',
    worldId: 6,
    nameKey: 'level.6-1',
    name: { es: 'Parque Urbano', en: 'City Park' },
    size: 200,
    seed: 6101,
    terrain: { amplitude: 12, frequency: 0.016, octaves: 4, plateau: 0.52, islandFalloff: 0.7 },
    liquid: { kind: 'water', level: -2, damage: 0 },
    palette: pal({
      sky: [0xff9fd0, 0x3a2a6a],
      ground: 0x4a8a4a,
      groundAlt: 0x6a6a7a,
      cliff: 0x50505f,
      prop: 0x3a9a5a,
      propAlt: 0x00e0ff,
      liquid: 0x2a8fbf,
      fogDensity: 0.008,
      ambient: 0x8a7ab0,
      sun: 0xffc0e0,
      sunIntensity: 1.4,
    }),
    props: [
      { kind: 'pine', count: 36, scale: [1.2, 2.4] },
      { kind: 'neonSign', count: 26, scale: [1, 2.2] },
      { kind: 'lantern', count: 30, scale: [1, 1.5] },
      { kind: 'pipe', count: 16, scale: [1, 2] },
      { kind: 'grass', count: 200, scale: [0.6, 1.2] },
    ],
    platforms: { count: 26, minY: 3, maxY: 20, size: [4, 8], moving: 12 },
    pets: [
      { color: 'yellow', count: 2 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 4 },
      { color: 'white', count: 3 },
      { color: 'green', count: 2 },
    ],
    required: 11,
    coins: 3,
    cookies: 6,
    gadgetUnlock: 'petRadar',
    gadgetGates: [
      { kind: 'dashGate', count: 4 },
      { kind: 'hoopGap', count: 4 },
      { kind: 'punchWall', count: 3 },
    ],
    music: 'w6',
  },
  {
    id: '6-2',
    worldId: 6,
    nameKey: 'level.6-2',
    name: { es: 'Fábrica de Cascos', en: 'Helmet Factory' },
    size: 180,
    seed: 6102,
    terrain: { amplitude: 13, frequency: 0.028, octaves: 4, plateau: 0.5, islandFalloff: 0.9 },
    liquid: { kind: 'slime', level: -1.5, damage: 28 },
    interior: true,
    palette: pal({
      sky: [0x3a3a5a, 0x12121e],
      ground: 0x8288a0,
      groundAlt: 0x565c72,
      cliff: 0x33363f,
      prop: 0x9aa0b8,
      propAlt: 0xff2a6a,
      liquid: 0xaa30ff,
      fogDensity: 0.013,
      ambient: 0x6a72a0,
      sun: 0xbcd4ff,
      sunIntensity: 1.4,
    }),
    props: [
      { kind: 'pipe', count: 60, scale: [1, 3] },
      { kind: 'neonSign', count: 30, scale: [1, 2] },
      { kind: 'monolith', count: 20, scale: [1, 2.6] },
      { kind: 'crystal', count: 14, scale: [0.8, 1.6] },
    ],
    platforms: { count: 34, minY: 3, maxY: 24, size: [3.5, 7], moving: 18 },
    pets: [
      { color: 'yellow', count: 1 },
      { color: 'blue', count: 4 },
      { color: 'red', count: 5 },
      { color: 'white', count: 3 },
      { color: 'green', count: 3 },
    ],
    required: 12,
    coins: 3,
    cookies: 7,
    gadgetGates: [
      { kind: 'punchWall', count: 5 },
      { kind: 'dashGate', count: 5 },
      { kind: 'clubCrate', count: 6 },
    ],
    music: 'w6',
  },
  {
    id: '6-3',
    worldId: 6,
    nameKey: 'level.6-3',
    name: { es: 'Torre de Antenas', en: 'Antenna Tower' },
    size: 170,
    seed: 6103,
    terrain: { amplitude: 20, frequency: 0.026, octaves: 4, plateau: 0.25, islandFalloff: 0.9, ridged: true },
    liquid: { kind: 'void', level: -26, damage: 100 },
    palette: pal({
      sky: [0xff5a9a, 0x1a0f3a],
      ground: 0x3f4f8a,
      groundAlt: 0x8a3f9a,
      cliff: 0x1e2242,
      prop: 0x7a86c0,
      propAlt: 0x00ffd0,
      liquid: 0x0a0a18,
      fogDensity: 0.0075,
      ambient: 0x8a6ac0,
      sun: 0xffb0e0,
      sunIntensity: 1.55,
    }),
    props: [
      { kind: 'neonSign', count: 46, scale: [1, 2.6] },
      { kind: 'pipe', count: 34, scale: [1, 2.6] },
      { kind: 'monolith', count: 24, scale: [1, 3] },
    ],
    platforms: { count: 36, minY: 4, maxY: 30, size: [3.5, 6.5], moving: 20 },
    pets: [
      { color: 'blue', count: 4 },
      { color: 'red', count: 5 },
      { color: 'white', count: 4 },
      { color: 'green', count: 3 },
    ],
    required: 13,
    coins: 3,
    cookies: 8,
    gadgetGates: [
      { kind: 'hoopGap', count: 8 },
      { kind: 'dashGate', count: 5 },
    ],
    boss: 'silva',
    music: 'w6',
  },
];

// ─────────────────── MUNDO 7 · EL REINO INVERTIDO ───────────────────

const W7: LevelSpec[] = [
  {
    id: '7-1',
    worldId: 7,
    nameKey: 'level.7-1',
    name: { es: 'Reino Invertido', en: 'Inverted Realm' },
    size: 200,
    seed: 7101,
    terrain: { amplitude: 22, frequency: 0.024, octaves: 5, plateau: 0.3, islandFalloff: 0.8, ridged: true },
    liquid: { kind: 'void', level: -28, damage: 100 },
    lowGravity: true,
    palette: pal({
      sky: [0xc040ff, 0x0a0020],
      ground: 0x7a30c0,
      groundAlt: 0x40a0ff,
      cliff: 0x2a1050,
      prop: 0xff40c0,
      propAlt: 0x40ffd0,
      liquid: 0x000010,
      fogDensity: 0.013,
      ambient: 0x7040a0,
      sun: 0xe0a0ff,
      sunIntensity: 1.2,
    }),
    props: [
      { kind: 'crystal', count: 70, scale: [1, 3.4] },
      { kind: 'monolith', count: 34, scale: [1, 3] },
      { kind: 'neonSign', count: 24, scale: [1, 2.2] },
      { kind: 'deadTree', count: 20, scale: [1, 2.4] },
    ],
    platforms: { count: 40, minY: 4, maxY: 34, size: [3.5, 7], moving: 24 },
    pets: [
      { color: 'blue', count: 4 },
      { color: 'red', count: 5 },
      { color: 'white', count: 5 },
      { color: 'green', count: 4 },
    ],
    required: 14,
    coins: 4,
    cookies: 8,
    gadgetGates: [
      { kind: 'hoopGap', count: 8 },
      { kind: 'punchWall', count: 5 },
      { kind: 'dashGate', count: 5 },
      { kind: 'clubCrate', count: 5 },
    ],
    boss: 'silva',
    music: 'w7',
  },
];

// ─────────────────── MUNDO 8 · DIMENSIÓN X ───────────────────

const W8: LevelSpec[] = [
  {
    id: '8-1',
    worldId: 8,
    nameKey: 'level.8-1',
    name: { es: 'Fortaleza de Deedee', en: "Deedee's Fortress" },
    size: 150,
    seed: 8101,
    terrain: { amplitude: 10, frequency: 0.03, octaves: 4, plateau: 0.55, islandFalloff: 0.95 },
    liquid: { kind: 'void', level: -20, damage: 100 },
    palette: pal({
      sky: [0xff2a4a, 0x0a0012],
      ground: 0x554d74,
      groundAlt: 0x82396f,
      cliff: 0x241f3a,
      prop: 0x6f5c96,
      propAlt: 0xff2a6a,
      liquid: 0x000008,
      fogDensity: 0.009,
      ambient: 0x9a4a72,
      sun: 0xff8aa2,
      sunIntensity: 1.6,
    }),
    props: [
      { kind: 'monolith', count: 30, scale: [1.4, 3.4] },
      { kind: 'neonSign', count: 24, scale: [1, 2.4] },
      { kind: 'crystal', count: 26, scale: [1, 2.6] },
    ],
    platforms: { count: 22, minY: 3, maxY: 20, size: [5, 9], moving: 10 },
    pets: [
      { color: 'red', count: 4 },
      { color: 'white', count: 4 },
      { color: 'green', count: 4 },
    ],
    required: 6,
    coins: 4,
    cookies: 10,
    gadgetGates: [{ kind: 'clubCrate', count: 4 }],
    boss: 'deedee',
    music: 'w8',
  },
];

export const LEVELS: LevelSpec[] = [...W1, ...W2, ...W3, ...W4, ...W5, ...W6, ...W7, ...W8];

export type World = {
  id: number;
  name: { es: string; en: string };
  subtitle: { es: string; en: string };
  color: number;
  levels: LevelSpec[];
  /** Mascotas totales requeridas (acumuladas) para desbloquear el mundo. */
  unlockAt: number;
};

export const WORLDS: World[] = [
  {
    id: 1,
    name: { es: 'La Tierra Perdida', en: 'The Lost Land' },
    subtitle: { es: 'Era Prehistórica', en: 'Prehistoric Era' },
    color: 0x8fbf5a,
    levels: W1,
    unlockAt: 0,
  },
  {
    id: 2,
    name: { es: 'La Era Misteriosa', en: 'The Mysterious Age' },
    subtitle: { es: 'Templos y reliquias', en: 'Temples and relics' },
    color: 0x8a8296,
    levels: W2,
    unlockAt: 14,
  },
  {
    id: 3,
    name: { es: 'Oceana', en: 'Oceana' },
    subtitle: { es: 'Era primitiva costera', en: 'Primitive coastal age' },
    color: 0x28b8e0,
    levels: W3,
    unlockAt: 34,
  },
  {
    id: 4,
    name: { es: 'Nueva Tierra de Hielo', en: 'New Freezeland' },
    subtitle: { es: 'Edad de Hielo', en: 'Ice Age' },
    color: 0xc4dff0,
    levels: W4,
    unlockAt: 60,
  },
  {
    id: 5,
    name: { es: 'Época Medieval', en: 'Medieval Mayhem' },
    subtitle: { es: 'Pasado reciente', en: 'Recent past' },
    color: 0xc04a3a,
    levels: W5,
    unlockAt: 89,
  },
  {
    id: 6,
    name: { es: 'Futurama', en: 'Futurama' },
    subtitle: { es: 'Era moderna', en: 'Modern era' },
    color: 0x00e0ff,
    levels: W6,
    unlockAt: 122,
  },
  {
    id: 7,
    name: { es: 'El Reino Invertido', en: 'The Inverted Realm' },
    subtitle: { es: 'Presente alternativo', en: 'Alternate present' },
    color: 0xc040ff,
    levels: W7,
    unlockAt: 158,
  },
  {
    id: 8,
    name: { es: 'Dimensión X', en: 'Dimension X' },
    subtitle: { es: 'Confrontación final', en: 'Final confrontation' },
    color: 0xff2a4a,
    levels: W8,
    unlockAt: 176,
  },
];

export function getLevel(id: string): LevelSpec | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function getWorld(id: number): World | undefined {
  return WORLDS.find((w) => w.id === id);
}

export function levelPetTotal(spec: LevelSpec): number {
  return spec.pets.reduce((a, p) => a + p.count, 0);
}

export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i < 0 || i === LEVELS.length - 1) return null;
  return LEVELS[i + 1].id;
}

/** Total de mascotas del juego (para el 100 %). */
export const TOTAL_PETS = LEVELS.reduce((a, l) => a + levelPetTotal(l), 0);
export const TOTAL_COINS = LEVELS.reduce((a, l) => a + l.coins, 0);
