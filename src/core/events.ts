/**
 * Bus de eventos tipado que conecta el motor (Three.js) con la UI (React).
 * El motor nunca importa React; solo emite eventos.
 */

export type CommsLine = {
  speaker: 'professor' | 'benito' | 'deedee' | 'silva' | 'narrator';
  key: string;
  duration?: number;
};

export type HudState = {
  energy: number;
  maxEnergy: number;
  lives: number;
  health: number;
  maxHealth: number;
  petsCaught: number;
  petsTotal: number;
  petsRequired: number;
  coins: number;
  gadget: string;
  gadgets: string[];
  levelName: string;
  worldName: string;
  time: number;
  radarActive: boolean;
  timeFrozen: number;
  firstPerson: boolean;
};

export type MinimapBlip = {
  x: number;
  z: number;
  kind: 'pet' | 'coin' | 'exit' | 'cookie' | 'boss';
  alert?: 0 | 1 | 2;
  caught?: boolean;
};

export type MinimapState = {
  px: number;
  pz: number;
  pyaw: number;
  radius: number;
  blips: MinimapBlip[];
};

export type LevelResult = {
  worldId: number;
  levelId: string;
  caught: number;
  total: number;
  coins: number;
  time: number;
  gadgetUnlocked?: string;
  success: boolean;
};

type EventMap = {
  hud: HudState;
  minimap: MinimapState;
  comms: CommsLine | null;
  toast: { key: string; params?: Record<string, string | number>; icon?: string };
  levelComplete: LevelResult;
  gameOver: { worldId: number; levelId: string };
  bossHealth: { name: string; hp: number; max: number; phase: number } | null;
  loading: { progress: number; label: string } | null;
  requestPause: void;
  fps: number;
  cutscene: string | null;
};

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const handlers = new Map<string, Set<Handler<never>>>();

export function on<K extends keyof EventMap>(key: K, fn: Handler<K>): () => void {
  let set = handlers.get(key);
  if (!set) {
    set = new Set();
    handlers.set(key, set);
  }
  set.add(fn as Handler<never>);
  return () => {
    set!.delete(fn as Handler<never>);
  };
}

export function emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
  const set = handlers.get(key);
  if (!set) return;
  for (const fn of set) (fn as Handler<K>)(payload);
}

export function clearAllListeners(): void {
  handlers.clear();
}
