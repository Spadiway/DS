/**
 * Entrada unificada: teclado remapeable + ratón + gamepad + joystick táctil.
 * El motor solo lee el snapshot `state`; nunca escucha eventos DOM directamente.
 */
import { getSettings, type Bindings } from './settings';

export type InputState = {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  jumpPressed: boolean;
  attack: boolean;
  attackPressed: boolean;
  sneak: boolean;
  aim: boolean;
  aimPressed: boolean;
  gadgetNext: boolean;
  gadgetPrev: boolean;
  gadgetDirect: number;
  radarPressed: boolean;
  pausePressed: boolean;
  anyPressed: boolean;
};

const down = new Set<string>();
const pressedThisFrame = new Set<string>();

export const touch = {
  active: false,
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  jump: false,
  attack: false,
  sneak: false,
  aim: false,
};

let mouseDX = 0;
let mouseDY = 0;
let wheel = 0;
let pointerLocked = false;
let installed = false;

export const state: InputState = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  jump: false,
  jumpPressed: false,
  attack: false,
  attackPressed: false,
  sneak: false,
  aim: false,
  aimPressed: false,
  gadgetNext: false,
  gadgetPrev: false,
  gadgetDirect: -1,
  radarPressed: false,
  pausePressed: false,
  anyPressed: false,
};

const prev = { jump: false, attack: false, aim: false, radar: false, pause: false };

function onKeyDown(e: KeyboardEvent) {
  if (e.repeat) return;
  if (!down.has(e.code)) pressedThisFrame.add(e.code);
  down.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
}
function onKeyUp(e: KeyboardEvent) {
  down.delete(e.code);
}
function onMouseDown(e: MouseEvent) {
  const code = `Mouse${e.button}`;
  if (!down.has(code)) pressedThisFrame.add(code);
  down.add(code);
}
function onMouseUp(e: MouseEvent) {
  down.delete(`Mouse${e.button}`);
}
function onMouseMove(e: MouseEvent) {
  if (pointerLocked) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
}
function onWheel(e: WheelEvent) {
  wheel += Math.sign(e.deltaY);
}
function onBlur() {
  down.clear();
}
function onPointerLockChange() {
  pointerLocked = document.pointerLockElement !== null;
}

export function installInput(): () => void {
  if (installed) return () => {};
  installed = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  return () => {
    installed = false;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
  };
}

function anyDown(codes: string[]): boolean {
  for (const c of codes) if (down.has(c)) return true;
  return false;
}

function deadzone(v: number, dz = 0.18): number {
  return Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz);
}

/** Recalcula el snapshot. Llamar una vez por frame antes de la lógica. */
export function pollInput(dt: number): InputState {
  const b: Bindings = getSettings().bindings;
  const sens = getSettings().camSensitivity;

  let mx = (anyDown(b.right) ? 1 : 0) - (anyDown(b.left) ? 1 : 0);
  let my = (anyDown(b.forward) ? 1 : 0) - (anyDown(b.back) ? 1 : 0);
  let lx = (anyDown(b.camRight) ? 1 : 0) - (anyDown(b.camLeft) ? 1 : 0);
  let ly = (anyDown(b.camDown) ? 1 : 0) - (anyDown(b.camUp) ? 1 : 0);

  let jump = anyDown(b.jump);
  let attack = anyDown(b.attack);
  let sneak = anyDown(b.sneak);
  let aim = anyDown(b.aim);
  let next = pressedThisFrame.has(b.gadgetNext[0]);
  let prevG = pressedThisFrame.has(b.gadgetPrev[0]);
  let radar = anyDown(b.radar);
  const pause = anyDown(b.pause);

  // Gamepad
  const pads = navigator.getGamepads?.() ?? [];
  for (const pad of pads) {
    if (!pad) continue;
    mx += deadzone(pad.axes[0] ?? 0);
    my += deadzone(-(pad.axes[1] ?? 0));
    lx += deadzone(pad.axes[2] ?? 0) * 2.5;
    ly += deadzone(pad.axes[3] ?? 0) * 2.5;
    jump = jump || !!pad.buttons[0]?.pressed;
    attack = attack || !!pad.buttons[2]?.pressed || (pad.buttons[7]?.value ?? 0) > 0.5;
    sneak = sneak || !!pad.buttons[1]?.pressed;
    aim = aim || (pad.buttons[6]?.value ?? 0) > 0.5;
    next = next || !!pad.buttons[5]?.pressed;
    prevG = prevG || !!pad.buttons[4]?.pressed;
    radar = radar || !!pad.buttons[3]?.pressed;
    break;
  }

  // Táctil
  if (touch.active) {
    mx += touch.moveX;
    my += touch.moveY;
    lx += touch.lookX * 3;
    ly += touch.lookY * 3;
    jump = jump || touch.jump;
    attack = attack || touch.attack;
    sneak = sneak || touch.sneak;
    aim = aim || touch.aim;
  }

  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  state.moveX = mx;
  state.moveY = my;
  state.lookX = lx * 2.2 * sens * dt + (mouseDX * 0.0022 * sens);
  state.lookY = (ly * 1.4 * sens * dt + mouseDY * 0.0016 * sens) * (getSettings().invertY ? -1 : 1);
  mouseDX = 0;
  mouseDY = 0;

  state.jumpPressed = jump && !prev.jump;
  state.attackPressed = attack && !prev.attack;
  state.aimPressed = aim && !prev.aim;
  state.radarPressed = radar && !prev.radar;
  state.pausePressed = pause && !prev.pause;
  state.jump = jump;
  state.attack = attack;
  state.sneak = sneak;
  state.aim = aim;
  state.gadgetNext = next || wheel > 0;
  state.gadgetPrev = prevG || wheel < 0;
  state.anyPressed = pressedThisFrame.size > 0;

  state.gadgetDirect = -1;
  for (let i = 1; i <= 8; i++) {
    if (pressedThisFrame.has(`Digit${i}`)) state.gadgetDirect = i - 1;
  }

  prev.jump = jump;
  prev.attack = attack;
  prev.aim = aim;
  prev.radar = radar;
  prev.pause = pause;
  wheel = 0;
  pressedThisFrame.clear();
  return state;
}

/** Captura la siguiente tecla pulsada (para el remapeo en Ajustes). */
export function captureNextKey(cb: (code: string) => void): () => void {
  const handler = (e: KeyboardEvent) => {
    e.preventDefault();
    cleanup();
    cb(e.code);
  };
  const mouse = (e: MouseEvent) => {
    e.preventDefault();
    cleanup();
    cb(`Mouse${e.button}`);
  };
  const cleanup = () => {
    window.removeEventListener('keydown', handler, true);
    window.removeEventListener('mousedown', mouse, true);
  };
  window.addEventListener('keydown', handler, true);
  window.addEventListener('mousedown', mouse, true);
  return cleanup;
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  if (code.startsWith('Mouse')) return `M${code.slice(5)}`;
  const map: Record<string, string> = {
    Space: 'ESPACIO',
    ShiftLeft: 'MAYÚS-I',
    ShiftRight: 'MAYÚS-D',
    Escape: 'ESC',
    Semicolon: ';',
    ControlLeft: 'CTRL',
  };
  return map[code] ?? code;
}
