/** Los 8 artefactos de Benito: coste de energía, tiempos y comportamiento. */

export type GadgetId =
  | 'timeNet'
  | 'waterNet'
  | 'stunClub'
  | 'dashHoop'
  | 'magicPunch'
  | 'superHoop'
  | 'petRadar'
  | 'timeFreeze';

export type GadgetDef = {
  id: GadgetId;
  icon: string;
  color: number;
  /** Energía consumida por uso (o por segundo en los sostenidos). */
  cost: number;
  cooldown: number;
  /** Duración de la animación/efecto. */
  duration: number;
  hold: boolean;
  reach: number;
  arc: number;
  worldUnlock: number;
};

export const GADGETS: Record<GadgetId, GadgetDef> = {
  timeNet: { id: 'timeNet', icon: '🕸️', color: 0x40e0ff, cost: 0, cooldown: 0.42, duration: 0.34, hold: false, reach: 3.4, arc: 1.5, worldUnlock: 0 },
  waterNet: { id: 'waterNet', icon: '🌊', color: 0x2ad0ff, cost: 0, cooldown: 0.45, duration: 0.36, hold: false, reach: 3.6, arc: 1.6, worldUnlock: 1 },
  stunClub: { id: 'stunClub', icon: '🏏', color: 0xffb040, cost: 4, cooldown: 0.5, duration: 0.4, hold: false, reach: 3.2, arc: 2.1, worldUnlock: 2 },
  dashHoop: { id: 'dashHoop', icon: '💨', color: 0x9fff40, cost: 12, cooldown: 0.9, duration: 0.55, hold: false, reach: 2.4, arc: 1.2, worldUnlock: 3 },
  magicPunch: { id: 'magicPunch', icon: '👊', color: 0xff5a5a, cost: 16, cooldown: 0.85, duration: 0.5, hold: false, reach: 3.0, arc: 1.1, worldUnlock: 4 },
  superHoop: { id: 'superHoop', icon: '🪁', color: 0xc080ff, cost: 22, cooldown: 0.2, duration: 0, hold: true, reach: 0, arc: 0, worldUnlock: 5 },
  petRadar: { id: 'petRadar', icon: '📡', color: 0x40ffa0, cost: 6, cooldown: 1.2, duration: 8, hold: false, reach: 0, arc: 0, worldUnlock: 6 },
  timeFreeze: { id: 'timeFreeze', icon: '⏱️', color: 0xffffff, cost: 45, cooldown: 6, duration: 5, hold: false, reach: 0, arc: 0, worldUnlock: 8 },
};

export const GADGET_ORDER: GadgetId[] = [
  'timeNet',
  'waterNet',
  'stunClub',
  'dashHoop',
  'magicPunch',
  'superHoop',
  'petRadar',
  'timeFreeze',
];

export function isGadgetId(v: string): v is GadgetId {
  return v in GADGETS;
}
