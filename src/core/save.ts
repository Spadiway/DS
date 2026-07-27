/** Sistema de guardado: 5 ranuras en localStorage, auto-save al terminar nivel. */

export type SaveData = {
  slot: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  playTime: number;
  worldId: number;
  levelId: string;
  gadgets: string[];
  levels: Record<string, { caught: number; total: number; coins: number; bestTime: number; cleared: boolean }>;
  coins: number;
  seenCutscenes: string[];
  unlockedMinigames: string[];
  costume: string;
};

const KEY = 'benito-escape.saves.v1';
export const SLOT_COUNT = 5;

export function emptySave(slot: number): SaveData {
  return {
    slot,
    name: `Benito ${slot + 1}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    playTime: 0,
    worldId: 1,
    levelId: '1-1',
    gadgets: ['timeNet'],
    levels: {},
    coins: 0,
    seenCutscenes: [],
    unlockedMinigames: [],
    costume: 'default',
  };
}

function readAll(): (SaveData | null)[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Array(SLOT_COUNT).fill(null);
    const arr = JSON.parse(raw) as (SaveData | null)[];
    const out: (SaveData | null)[] = new Array(SLOT_COUNT).fill(null);
    for (let i = 0; i < SLOT_COUNT; i++) out[i] = arr[i] ?? null;
    return out;
  } catch {
    return new Array(SLOT_COUNT).fill(null);
  }
}

function writeAll(all: (SaveData | null)[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignorar cuota */
  }
}

export function listSaves(): (SaveData | null)[] {
  return readAll();
}

export function loadSave(slot: number): SaveData | null {
  return readAll()[slot] ?? null;
}

export function writeSave(data: SaveData): void {
  const all = readAll();
  data.updatedAt = Date.now();
  all[data.slot] = data;
  writeAll(all);
}

export function deleteSave(slot: number): void {
  const all = readAll();
  all[slot] = null;
  writeAll(all);
}

/** Total global de mascotas capturadas en la partida. */
export function totalCaught(save: SaveData): number {
  return Object.values(save.levels).reduce((a, l) => a + l.caught, 0);
}

export function totalPossible(save: SaveData): number {
  return Object.values(save.levels).reduce((a, l) => a + l.total, 0);
}

/** Registra el resultado de un nivel conservando el mejor intento. */
export function recordLevel(
  save: SaveData,
  levelId: string,
  caught: number,
  total: number,
  coins: number,
  time: number,
  cleared: boolean,
): SaveData {
  const prev = save.levels[levelId];
  save.levels[levelId] = {
    caught: Math.max(prev?.caught ?? 0, caught),
    total,
    coins: Math.max(prev?.coins ?? 0, coins),
    bestTime: prev?.bestTime && prev.bestTime > 0 ? Math.min(prev.bestTime, time) : time,
    cleared: (prev?.cleared ?? false) || cleared,
  };
  const gained = Math.max(0, coins - (prev?.coins ?? 0));
  save.coins += gained;
  return save;
}
