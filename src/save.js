// Guardado en localStorage: progreso, gadgets y ajustes.

const KEY = 'benito-escape-save-v1';

const DEFAULT_SAVE = {
  lang: 'es',
  unlockedLevel: 0,          // índice del nivel más alto desbloqueado
  levelCaptures: {},         // { [levelId]: mejorNúmeroDeCapturas }
  gadgets: ['net'],          // gadgets desbloqueados
  totalCaptured: 0,
  finished: false
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return { ...structuredClone(DEFAULT_SAVE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* sin almacenamiento */ }
}

export function resetSave() {
  const fresh = structuredClone(DEFAULT_SAVE);
  writeSave(fresh);
  return fresh;
}
