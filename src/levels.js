// ===== BENITO ESCAPE — data-driven level definitions (Phase 1: World 1) =====
// Layouts, names and placements are original designs.

export const WORLDS = [
  { id: 1, nameKey: 'w1', levels: ['1-1', '1-2', '1-3'], available: true },
  { id: 2, nameKey: 'w2', levels: [], available: false },
  { id: 3, nameKey: 'w3', levels: [], available: false },
  { id: 4, nameKey: 'w4', levels: [], available: false },
  { id: 5, nameKey: 'w5', levels: [], available: false },
  { id: 6, nameKey: 'w6', levels: [], available: false },
  { id: 7, nameKey: 'w7', levels: [], available: false },
  { id: 8, nameKey: 'w8', levels: [], available: false },
];

export const THEMES = {
  plains: {
    sky: 0x7ec8ff, fog: 0xa8d8f0, fogNear: 40, fogFar: 130,
    skyTop: '#3f8fe8', skyHorizon: '#bfe4ff',
    groundBase: '#5eab3f', groundBlotch: ['#4c9635', '#6fbc4c', '#579f3a', '#7cc95a'],
    sun: 0xfff2cc, hill: 0x4c8a3a,
    details: [['grass', 0.45], ['flower', 0.35], ['fern', 0.2]],
  },
  swamp: {
    sky: 0x9bb56b, fog: 0xa8b87a, fogNear: 26, fogFar: 100,
    skyTop: '#7fa04e', skyHorizon: '#dcdca6',
    groundBase: '#6d7a3a', groundBlotch: ['#5d6a30', '#7c8a46', '#4f5c28', '#87954f'],
    sun: 0xf0e6b8, hill: 0x54613a,
    details: [['grass', 0.4], ['mushroom', 0.35], ['fern', 0.25]],
  },
  canyon: {
    sky: 0xffb066, fog: 0xe8a05c, fogNear: 34, fogFar: 120,
    skyTop: '#f07f2e', skyHorizon: '#ffdfb0',
    groundBase: '#b06a3b', groundBlotch: ['#9a5a30', '#c07a46', '#8a4f28', '#c98a52'],
    sun: 0xffd9a0, hill: 0x8a4a2e,
    details: [['crystal', 0.3], ['rock', 0.45], ['drygrass', 0.25]],
  },
};

export const LEVELS = {
  // ================================================================
  // 1-1 · PRADERA DE LOS HUESOS — tutorial meadow
  // ================================================================
  '1-1': {
    world: 1,
    theme: 'plains',
    music: 'world1',
    bounds: { minX: -34, maxX: 34, minZ: -34, maxZ: 34 },
    spawn: [0, -28],
    exit: [0, 29],
    required: 5,
    tutorial: true,
    platforms: [
      // rocky steps up to a small plateau (jump lesson, pet p5 lives up there)
      { x: 20, y: 0.5, z: 12, w: 6, h: 1, d: 6, color: 0x8d99ae },
      { x: 24, y: 1.25, z: 17, w: 6, h: 2.5, d: 6, color: 0x7d8a9e },
      { x: 19, y: 2.0, z: 22, w: 8, h: 4, d: 8, color: 0x8d99ae },
      // a couple of stray boulder platforms
      { x: -22, y: 0.6, z: 2, w: 5, h: 1.2, d: 5, color: 0x8d99ae },
    ],
    decos: [
      { t: 'volcano', x: -46, z: 44, s: 2.2 }, { t: 'volcano', x: 52, z: 40, s: 1.6 },
      { t: 'tree', x: -12, z: -22, s: 1.2 }, { t: 'tree', x: 14, z: -18, s: 1 },
      { t: 'tree', x: -26, z: -8, s: 1.4 }, { t: 'tree', x: 28, z: -4, s: 1.1 },
      { t: 'tree', x: -18, z: 18, s: 1.3 }, { t: 'tree', x: 8, z: 14, s: 1 },
      { t: 'tree', x: -6, z: 26, s: 1.2 }, { t: 'tree', x: 26, z: 28, s: 1 },
      { t: 'fern', x: -8, z: -14, s: 1 }, { t: 'fern', x: 10, z: -26, s: 1.2 },
      { t: 'fern', x: -30, z: 12, s: 1 }, { t: 'fern', x: 18, z: 2, s: 1 },
      { t: 'rock', x: -14, z: 6, s: 1.1 }, { t: 'rock', x: 6, z: -6, s: 0.8 },
      { t: 'rock', x: 30, z: 12, s: 1.3 }, { t: 'rock', x: -28, z: 26, s: 1 },
      { t: 'bone', x: 3, z: -20, s: 1.4 }, { t: 'bone', x: -20, z: -16, s: 1 },
      { t: 'bone', x: 12, z: 22, s: 1.8 }, { t: 'bone', x: -10, z: 12, s: 1.2 },
    ],
    lavas: [],
    waters: [],
    cookies: [
      [0, -22], [3, -18], [-3, -18], [8, -10], [-8, -10],
      [16, -2], [-16, -2], [0, 4], [10, 10], [-12, 16],
      [22, 6], [-24, 18], [19, 22.5], [0, 22], [4, 26],
    ],
    checkpoints: [[0, 0]],
    pets: [
      { id: 'p1', type: 'amarillo', x: 4, z: -14, patrol: [[4, -14], [10, -12], [8, -6]] },
      { id: 'p2', type: 'amarillo', x: -10, z: -2, patrol: [[-10, -2], [-16, 4], [-8, 8]] },
      { id: 'p3', type: 'azul', x: 12, z: 6, patrol: [[12, 6], [22, 0], [16, -8]] },
      { id: 'p4', type: 'rojo', x: -22, z: 10, patrol: [[-22, 10], [-26, 16], [-18, 16]] },
      { id: 'p5', type: 'amarillo', x: 19, z: 22, patrol: [[19, 22], [21, 24], [17, 24]] },
      { id: 'p6', type: 'blanco', x: -8, z: 24, patrol: [[-8, 24], [-14, 28], [-2, 28]] },
      { id: 'p7', type: 'verde', x: 26, z: -14, patrol: [[26, -14], [30, -20], [22, -22]] },
    ],
  },

  // ================================================================
  // 1-2 · CIÉNAGA BURBUJEANTE — swamp with ponds (Aqua Snare unlock)
  // ================================================================
  '1-2': {
    world: 1,
    theme: 'swamp',
    music: 'swamp',
    bounds: { minX: -36, maxX: 36, minZ: -36, maxZ: 36 },
    spawn: [-28, -28],
    exit: [30, 30],
    required: 6,
    unlockGadget: 'waternet',
    unlockScene: 'waternet',
    platforms: [
      // fallen-log bridge across the central pond
      { x: -4, y: 0.35, z: 2, w: 9, h: 0.7, d: 2.2, color: 0x7a5230 },
      { x: 5, y: 0.35, z: 5, w: 9, h: 0.7, d: 2.2, color: 0x6b4423 },
      // stumps
      { x: -16, y: 0.5, z: 14, w: 3, h: 1, d: 3, color: 0x7a5230 },
      { x: -10, y: 0.9, z: 19, w: 3, h: 1.8, d: 3, color: 0x6b4423 },
      { x: 22, y: 0.6, z: -12, w: 4, h: 1.2, d: 4, color: 0x7a5230 },
    ],
    decos: [
      { t: 'palm', x: -20, z: -20, s: 1.2 }, { t: 'palm', x: -30, z: -6, s: 1 },
      { t: 'palm', x: 12, z: -24, s: 1.3 }, { t: 'palm', x: 28, z: -22, s: 1 },
      { t: 'palm', x: -26, z: 22, s: 1.2 }, { t: 'palm', x: 4, z: 30, s: 1.1 },
      { t: 'palm', x: 20, z: 18, s: 1.3 }, { t: 'palm', x: 32, z: 6, s: 1 },
      { t: 'fern', x: -14, z: -10, s: 1.3 }, { t: 'fern', x: -2, z: -20, s: 1.1 },
      { t: 'fern', x: 16, z: -6, s: 1.2 }, { t: 'fern', x: -22, z: 6, s: 1 },
      { t: 'fern', x: 10, z: 22, s: 1.4 }, { t: 'fern', x: 26, z: 26, s: 1 },
      { t: 'rock', x: -32, z: -16, s: 1 }, { t: 'rock', x: 34, z: -10, s: 1.1 },
      { t: 'rock', x: -6, z: 32, s: 1.2 },
      { t: 'bone', x: 18, z: 8, s: 1.2 }, { t: 'bone', x: -28, z: 30, s: 1.5 },
    ],
    lavas: [],
    waters: [
      { x: 0, z: 4, r: 8.5 },        // big central pond (log bridge crosses it)
      { x: -24, z: 12, r: 5 },
      { x: 24, z: -2, r: 5.5 },
      { x: 12, z: -16, r: 4.5 },
    ],
    cookies: [
      [-24, -24], [-18, -26], [-12, -24], [-4, -28], [6, -28],
      [-4, 2.2, 1.1], [5, 5.2, 1.1],   // on the log bridge
      [-16, 14, 1.4], [-10, 19, 2.2],  // on stumps
      [16, 0], [28, 8], [24, 16], [30, 22], [14, 28], [-30, 18],
    ],
    checkpoints: [[0, -12], [18, 12]],
    pets: [
      { id: 'p1', type: 'amarillo', x: -16, z: -18, patrol: [[-16, -18], [-10, -14], [-18, -10]] },
      { id: 'p2', type: 'amarillo', x: 8, z: -8, patrol: [[8, -8], [14, -10], [10, -2]] },
      { id: 'p3', type: 'rojo', x: -20, z: 2, patrol: [[-20, 2], [-16, 8], [-24, 6]] },
      { id: 'p4', type: 'azul', x: 22, z: 22, patrol: [[22, 22], [28, 16], [16, 18]] },
      { id: 'p5', type: 'blanco', x: 0, z: 24, patrol: [[0, 24], [-6, 28], [6, 28]] },
      { id: 'p6', type: 'verde', x: 30, z: -18, patrol: [[30, -18], [26, -26], [34, -24]] },
      { id: 'p7', type: 'amarillo', x: -12, z: 30, patrol: [[-12, 30], [-18, 32], [-8, 33]] },
      // pond dwellers — need the Aqua Snare (replay after unlocking!)
      { id: 'w1', type: 'azul', x: 0, z: 6, water: true, patrol: [[0, 6], [-4, 5], [3, 8]] },
      { id: 'w2', type: 'amarillo', x: -24, z: 12, water: true, patrol: [[-24, 12], [-26, 10], [-22, 14]] },
      { id: 'w3', type: 'verde', x: 24, z: -2, water: true, patrol: [[24, -2], [22, 0], [26, -4]] },
    ],
  },

  // ================================================================
  // 1-3 · CAÑÓN DE LAVA — hazards + boss "Capitán Colmillo"
  // ================================================================
  '1-3': {
    world: 1,
    theme: 'canyon',
    music: 'world1',
    bossMusic: 'boss',
    bounds: { minX: -30, maxX: 30, minZ: -38, maxZ: 38 },
    spawn: [0, -33],
    exit: [0, 33],
    required: 0,            // boss capture opens the portal
    bossRequired: true,
    platforms: [
      // stepping stones over the lava river (z ≈ -8)
      { x: -8, y: 0.4, z: -8, w: 3, h: 0.8, d: 3, color: 0x6e4a33 },
      { x: -2, y: 0.5, z: -7, w: 3, h: 1, d: 3, color: 0x7d5238 },
      { x: 4, y: 0.4, z: -8.5, w: 3, h: 0.8, d: 3, color: 0x6e4a33 },
      { x: 10, y: 0.5, z: -7.5, w: 3, h: 1, d: 3, color: 0x7d5238 },
      // canyon ledges
      { x: -22, y: 0.75, z: 0, w: 7, h: 1.5, d: 7, color: 0x8a5a3a },
      { x: 24, y: 0.75, z: 2, w: 7, h: 1.5, d: 7, color: 0x8a5a3a },
      // arena walls (boss crashes into these)
      { x: -13, y: 1.5, z: 22, w: 3, h: 3, d: 16, color: 0x7a4a2a },
      { x: 13, y: 1.5, z: 22, w: 3, h: 3, d: 16, color: 0x7a4a2a },
      { x: 0, y: 1.5, z: 31, w: 24, h: 3, d: 3, color: 0x7a4a2a },
    ],
    decos: [
      { t: 'volcano', x: -40, z: 20, s: 2.4 }, { t: 'volcano', x: 44, z: 10, s: 1.8 },
      { t: 'volcano', x: 0, z: 52, s: 3 },
      { t: 'rock', x: -16, z: -20, s: 1.4 }, { t: 'rock', x: 18, z: -24, s: 1.2 },
      { t: 'rock', x: -26, z: -28, s: 1 }, { t: 'rock', x: 26, z: -14, s: 1.5 },
      { t: 'rock', x: -8, z: 8, s: 1.1 }, { t: 'rock', x: 8, z: 6, s: 0.9 },
      { t: 'bone', x: -4, z: -18, s: 2 }, { t: 'bone', x: 14, z: -14, s: 1.4 },
      { t: 'bone', x: -20, z: 8, s: 1.6 }, { t: 'bone', x: 0, z: 14, s: 2.4 },
      { t: 'fern', x: -28, z: -12, s: 0.8 }, { t: 'fern', x: 28, z: -30, s: 0.8 },
    ],
    lavas: [
      // lava river across the level, crossed on the stepping stones
      { x: -14, z: -8, r: 4.5 }, { x: -7, z: -8, r: 4 }, { x: 0, z: -8, r: 4.5 },
      { x: 7, z: -8, r: 4 }, { x: 14, z: -8, r: 4.5 }, { x: 21, z: -8, r: 4 },
      { x: -21, z: -8, r: 4 }, { x: 27, z: -8, r: 4 }, { x: -27, z: -8, r: 4 },
      // scattered pools
      { x: -18, z: -28, r: 3 }, { x: 22, z: 10, r: 3 }, { x: -24, z: 14, r: 3.2 },
    ],
    waters: [],
    cookies: [
      [-6, -30], [6, -30], [0, -24], [-12, -22], [12, -20],
      [-2, -7, 1.2], [4, -8.5, 1.1],   // on the stepping stones
      [-22, 0, 1.8], [24, 2, 1.8],     // on the ledges
      [0, 0], [-8, 14], [8, 14], [0, 18],
    ],
    checkpoints: [[0, -16], [0, 4]],
    pets: [
      { id: 'p1', type: 'rojo', x: -10, z: -26, patrol: [[-10, -26], [-4, -28], [-12, -30]] },
      { id: 'p2', type: 'amarillo', x: 14, z: -28, patrol: [[14, -28], [20, -30], [16, -22]] },
      { id: 'p3', type: 'verde', x: -22, z: 0, patrol: [[-22, 0], [-24, 2], [-20, -2]] },
      { id: 'p4', type: 'verde', x: 24, z: 2, patrol: [[24, 2], [26, 4], [22, 0]] },
      { id: 'p5', type: 'azul', x: -6, z: 10, patrol: [[-6, 10], [4, 12], [-2, 16]] },
      { id: 'p6', type: 'blanco', x: 6, z: 0, patrol: [[6, 0], [12, 2], [8, 6]] },
    ],
    boss: { x: 0, z: 22, arena: { x: 0, z: 22, r: 12 }, triggerZ: 12 },
  },
};

/** Total pets available across a save (for stats). */
export function totalPetsInLevel(levelId) {
  const def = LEVELS[levelId];
  let n = def.pets.length;
  if (def.boss) n += 1;
  return n;
}
