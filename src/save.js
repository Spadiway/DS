// ===== BENITO ESCAPE — save system (localStorage, 3 slots) =====

const KEY = 'benitoEscapeSaves';
export const NUM_SLOTS = 3;

export function newGameData() {
  return {
    createdAt: Date.now(),
    gadgets: ['net'],
    currentGadget: 'net',
    unlocked: { '1-1': true },
    completed: {},          // levelId -> true
    captures: {},           // levelId -> array of captured pet ids (best run, cumulative)
    bestTimes: {},          // levelId -> seconds
    totalCaptured: 0,
    playtime: 0,
    seenScenes: {},         // sceneId -> true
  };
}

export function loadSlots() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Array(NUM_SLOTS).fill(null);
    const arr = JSON.parse(raw);
    const out = new Array(NUM_SLOTS).fill(null);
    for (let i = 0; i < NUM_SLOTS; i++) out[i] = arr[i] || null;
    return out;
  } catch {
    return new Array(NUM_SLOTS).fill(null);
  }
}

export function saveSlot(index, data) {
  const slots = loadSlots();
  slots[index] = data;
  try { localStorage.setItem(KEY, JSON.stringify(slots)); } catch { /* storage full/blocked */ }
}

export function deleteSlot(index) {
  const slots = loadSlots();
  slots[index] = null;
  try { localStorage.setItem(KEY, JSON.stringify(slots)); } catch { /* ignore */ }
}

/** Recompute total unique captures across levels. */
export function recountTotal(data) {
  let n = 0;
  for (const id of Object.keys(data.captures)) n += data.captures[id].length;
  data.totalCaptured = n;
  return n;
}
