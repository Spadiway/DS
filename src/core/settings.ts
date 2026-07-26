/** Ajustes persistentes: gráficos, idioma, accesibilidad y remapeo de controles. */

export type Quality = 'low' | 'medium' | 'high';
export type Lang = 'es' | 'en';

export type Bindings = {
  forward: string[];
  back: string[];
  left: string[];
  right: string[];
  jump: string[];
  attack: string[];
  sneak: string[];
  aim: string[];
  gadgetNext: string[];
  gadgetPrev: string[];
  camLeft: string[];
  camRight: string[];
  camUp: string[];
  camDown: string[];
  pause: string[];
  radar: string[];
};

export type Settings = {
  quality: Quality;
  lang: Lang;
  subtitles: boolean;
  musicVolume: number;
  sfxVolume: number;
  invertY: boolean;
  camSensitivity: number;
  bigIcons: boolean;
  colorBlindSafe: boolean;
  screenShake: boolean;
  bindings: Bindings;
  touchControls: 'auto' | 'on' | 'off';
};

export const DEFAULT_BINDINGS: Bindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  attack: ['KeyJ', 'Mouse0'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  aim: ['KeyL', 'Mouse2'],
  gadgetNext: ['KeyE'],
  gadgetPrev: ['KeyQ'],
  camLeft: ['KeyK'],
  camRight: ['Semicolon'],
  camUp: ['KeyO'],
  camDown: ['KeyP'],
  pause: ['Escape'],
  radar: ['KeyR'],
};

const DEFAULTS: Settings = {
  quality: 'high',
  lang: 'es',
  subtitles: true,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  invertY: false,
  camSensitivity: 1,
  bigIcons: false,
  colorBlindSafe: false,
  screenShake: true,
  bindings: DEFAULT_BINDINGS,
  touchControls: 'auto',
};

const KEY = 'benito-escape.settings.v1';

let current: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const listeners = new Set<(s: Settings) => void>();

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>): Settings {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* almacenamiento no disponible */
  }
  for (const l of listeners) l(current);
  return current;
}

export function resetBindings(): void {
  setSettings({ bindings: structuredClone(DEFAULT_BINDINGS) });
}

export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const QUALITY_PRESETS = {
  low: {
    quality: 'low' as Quality,
    shadows: false,
    pixelRatio: 0.75,
    drawDistance: 120,
    particles: 0.4,
    outlines: false,
    grassDensity: 0.3,
    bloom: false,
    bloomStrength: 0,
  },
  medium: {
    quality: 'medium' as Quality,
    shadows: true,
    pixelRatio: 1,
    drawDistance: 200,
    particles: 0.8,
    outlines: true,
    grassDensity: 0.7,
    bloom: true,
    bloomStrength: 0.28,
  },
  high: {
    quality: 'high' as Quality,
    shadows: true,
    pixelRatio: 1.5,
    drawDistance: 320,
    particles: 1.3,
    outlines: true,
    grassDensity: 1,
    bloom: true,
    bloomStrength: 0.38,
  },
} as const;

export function qualityPreset(q: Quality = current.quality) {
  return QUALITY_PRESETS[q];
}
