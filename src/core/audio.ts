/**
 * Audio 100% procedural (WebAudio). Sin ficheros externos:
 * - Música synthwave por mundo: bajo, arpegio, pad, batería, generada por semilla.
 * - Efectos: red, captura, salto, golpe, monedas, chillidos de mascota…
 */
import { getSettings, onSettingsChange } from './settings';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export type MusicMood = {
  root: number;
  scale: number[];
  bpm: number;
  wave: OscillatorType;
  padWave: OscillatorType;
  drive: number;
  arpDensity: number;
  tension: number;
};

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export const MOODS: Record<string, MusicMood> = {
  menu: { root: 55, scale: MINOR, bpm: 96, wave: 'sawtooth', padWave: 'triangle', drive: 0.25, arpDensity: 0.5, tension: 0.2 },
  hub: { root: 58.27, scale: MAJOR, bpm: 104, wave: 'triangle', padWave: 'sine', drive: 0.18, arpDensity: 0.45, tension: 0.1 },
  w1: { root: 49, scale: DORIAN, bpm: 118, wave: 'square', padWave: 'triangle', drive: 0.3, arpDensity: 0.65, tension: 0.3 },
  w2: { root: 51.9, scale: PHRYGIAN, bpm: 112, wave: 'sawtooth', padWave: 'sine', drive: 0.35, arpDensity: 0.6, tension: 0.45 },
  w3: { root: 61.7, scale: MAJOR, bpm: 126, wave: 'triangle', padWave: 'sine', drive: 0.22, arpDensity: 0.7, tension: 0.25 },
  w4: { root: 46.2, scale: MINOR, bpm: 108, wave: 'sine', padWave: 'triangle', drive: 0.2, arpDensity: 0.5, tension: 0.35 },
  w5: { root: 55, scale: DORIAN, bpm: 122, wave: 'sawtooth', padWave: 'triangle', drive: 0.4, arpDensity: 0.7, tension: 0.4 },
  w6: { root: 65.4, scale: MINOR, bpm: 134, wave: 'sawtooth', padWave: 'sawtooth', drive: 0.5, arpDensity: 0.85, tension: 0.5 },
  w7: { root: 43.65, scale: PHRYGIAN, bpm: 128, wave: 'square', padWave: 'sawtooth', drive: 0.55, arpDensity: 0.8, tension: 0.7 },
  w8: { root: 41.2, scale: PHRYGIAN, bpm: 142, wave: 'sawtooth', padWave: 'sawtooth', drive: 0.65, arpDensity: 0.95, tension: 0.9 },
  boss: { root: 43.65, scale: PHRYGIAN, bpm: 150, wave: 'sawtooth', padWave: 'square', drive: 0.7, arpDensity: 1, tension: 1 },
  victory: { root: 65.4, scale: MAJOR, bpm: 128, wave: 'triangle', padWave: 'sine', drive: 0.2, arpDensity: 0.8, tension: 0 },
};

export function initAudio(): void {
  if (ctx) return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  musicGain = ctx.createGain();
  musicGain.gain.value = getSettings().musicVolume;
  musicGain.connect(masterGain);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = getSettings().sfxVolume;
  sfxGain.connect(masterGain);

  const len = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  onSettingsChange((s) => {
    if (musicGain) musicGain.gain.value = s.musicVolume;
    if (sfxGain) sfxGain.gain.value = s.sfxVolume;
  });
}

export function resumeAudio(): void {
  initAudio();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

// ───────────────────────────────── SFX ─────────────────────────────────

function noiseSource(): AudioBufferSourceNode | null {
  if (!ctx || !noiseBuffer) return null;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

function env(node: GainNode, t: number, a: number, d: number, peak = 1): void {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function blip(freq: number, dur: number, type: OscillatorType, vol = 0.3, slide = 0, delay = 0): void {
  if (!ctx || !sfxGain) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  env(g, t, 0.008, dur, vol);
  osc.connect(g).connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBurst(dur: number, vol: number, freq: number, q = 1, sweep = 1): void {
  if (!ctx || !sfxGain) return;
  const src = noiseSource();
  if (!src) return;
  const t = ctx.currentTime;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(freq, t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
  filt.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.005, dur, vol);
  src.connect(filt).connect(g).connect(sfxGain);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export type SfxName =
  | 'netSwing'
  | 'netCatch'
  | 'jump'
  | 'land'
  | 'clubHit'
  | 'dash'
  | 'punch'
  | 'hoop'
  | 'coin'
  | 'cookie'
  | 'hurt'
  | 'petAlert'
  | 'petSuspect'
  | 'petChatter'
  | 'gadgetSwitch'
  | 'uiMove'
  | 'uiConfirm'
  | 'uiBack'
  | 'unlock'
  | 'radarPing'
  | 'freeze'
  | 'bossHit'
  | 'explosion'
  | 'splash'
  | 'gateOpen'
  | 'checkpoint';

export function sfx(name: SfxName): void {
  if (!ctx) return;
  switch (name) {
    case 'netSwing':
      noiseBurst(0.16, 0.22, 1800, 0.8, 0.25);
      break;
    case 'netCatch':
      blip(880, 0.09, 'square', 0.25);
      blip(1320, 0.09, 'square', 0.22, 1, 0.07);
      blip(1760, 0.16, 'triangle', 0.28, 1.5, 0.14);
      noiseBurst(0.2, 0.12, 3000, 2, 0.4);
      break;
    case 'jump':
      blip(300, 0.14, 'square', 0.16, 2.6);
      break;
    case 'land':
      noiseBurst(0.1, 0.16, 260, 1.4, 0.4);
      break;
    case 'clubHit':
      blip(140, 0.16, 'square', 0.3, 0.4);
      noiseBurst(0.14, 0.28, 900, 1.2, 0.2);
      break;
    case 'dash':
      noiseBurst(0.35, 0.22, 500, 1.5, 5);
      blip(200, 0.3, 'sawtooth', 0.14, 3);
      break;
    case 'punch':
      blip(90, 0.25, 'sawtooth', 0.35, 0.3);
      noiseBurst(0.3, 0.3, 500, 0.7, 0.15);
      break;
    case 'hoop':
      blip(520, 0.5, 'sine', 0.12, 1.6);
      break;
    case 'coin':
      blip(1174, 0.07, 'square', 0.2);
      blip(1567, 0.16, 'square', 0.2, 1, 0.06);
      break;
    case 'cookie':
      blip(660, 0.1, 'triangle', 0.2);
      blip(990, 0.18, 'triangle', 0.2, 1.2, 0.08);
      break;
    case 'hurt':
      blip(400, 0.28, 'sawtooth', 0.3, 0.25);
      noiseBurst(0.22, 0.18, 700, 0.8, 0.3);
      break;
    case 'petAlert':
      blip(1200, 0.09, 'square', 0.2, 1.3);
      blip(1500, 0.09, 'square', 0.2, 1.3, 0.1);
      break;
    case 'petSuspect':
      blip(700, 0.12, 'triangle', 0.15, 1.5);
      break;
    case 'petChatter':
      blip(900 + Math.random() * 500, 0.05, 'square', 0.08, 1.6);
      blip(1100 + Math.random() * 500, 0.05, 'square', 0.07, 0.7, 0.06);
      break;
    case 'gadgetSwitch':
      blip(660, 0.06, 'square', 0.14);
      blip(880, 0.06, 'square', 0.12, 1, 0.05);
      break;
    case 'uiMove':
      blip(520, 0.05, 'square', 0.1);
      break;
    case 'uiConfirm':
      blip(660, 0.07, 'square', 0.16);
      blip(990, 0.12, 'square', 0.14, 1, 0.06);
      break;
    case 'uiBack':
      blip(440, 0.1, 'square', 0.12, 0.6);
      break;
    case 'unlock':
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.22, 1, i * 0.09));
      break;
    case 'radarPing':
      blip(1400, 0.35, 'sine', 0.14, 0.5);
      break;
    case 'freeze':
      [1800, 1500, 1200, 900].forEach((f, i) => blip(f, 0.3, 'sine', 0.16, 0.7, i * 0.05));
      noiseBurst(0.7, 0.1, 4000, 3, 0.2);
      break;
    case 'bossHit':
      blip(110, 0.4, 'sawtooth', 0.35, 0.4);
      noiseBurst(0.4, 0.3, 380, 0.7, 0.2);
      break;
    case 'explosion':
      noiseBurst(0.7, 0.4, 320, 0.5, 0.1);
      blip(70, 0.6, 'sawtooth', 0.3, 0.4);
      break;
    case 'splash':
      noiseBurst(0.3, 0.24, 1400, 0.6, 0.2);
      break;
    case 'gateOpen':
      [392, 523, 659, 784, 1046].forEach((f, i) => blip(f, 0.35, 'triangle', 0.2, 1, i * 0.1));
      break;
    case 'checkpoint':
      blip(784, 0.14, 'triangle', 0.18);
      blip(1046, 0.22, 'triangle', 0.18, 1, 0.1);
      break;
  }
}

// ──────────────────────────────── Música ────────────────────────────────

type MusicVoices = {
  timer: number | null;
  step: number;
  mood: MusicMood;
  bus: GainNode;
  intensity: number;
};

let music: MusicVoices | null = null;
let currentMoodKey = '';

function scheduleNote(freq: number, time: number, dur: number, type: OscillatorType, vol: number, bus: GainNode, detune = 0): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g).connect(bus);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function scheduleDrum(kind: 'kick' | 'snare' | 'hat', time: number, bus: GainNode, vol: number): void {
  if (!ctx) return;
  if (kind === 'kick') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(g).connect(bus);
    osc.start(time);
    osc.stop(time + 0.25);
  } else {
    const src = noiseSource();
    if (!src) return;
    const filt = ctx.createBiquadFilter();
    filt.type = kind === 'snare' ? 'bandpass' : 'highpass';
    filt.frequency.value = kind === 'snare' ? 1900 : 7000;
    filt.Q.value = kind === 'snare' ? 0.8 : 0.5;
    const g = ctx.createGain();
    const dur = kind === 'snare' ? 0.14 : 0.045;
    g.gain.setValueAtTime(vol * (kind === 'snare' ? 1 : 0.45), time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filt).connect(g).connect(bus);
    src.start(time);
    src.stop(time + dur + 0.02);
  }
}

function tick(): void {
  if (!ctx || !music) return;
  const m = music.mood;
  const beat = 60 / m.bpm / 2; // corcheas
  const t = ctx.currentTime + 0.06;
  const step = music.step;
  const bar = Math.floor(step / 16);
  const inBar = step % 16;
  const intensity = music.intensity;

  // Progresión de acordes de 4 compases
  const prog = [0, 5, 3, 4];
  const degree = prog[bar % 4];
  const chordRoot = m.root * Math.pow(2, m.scale[degree % m.scale.length] / 12);

  // Bajo
  if (inBar % 2 === 0) {
    scheduleNote(chordRoot, t, beat * 1.6, m.wave, 0.16 + m.drive * 0.1, music.bus);
  }
  // Pad cada compás
  if (inBar === 0) {
    for (const iv of [0, 3, 7]) {
      scheduleNote(chordRoot * 2 * Math.pow(2, iv / 12), t, beat * 15, m.padWave, 0.035 + m.tension * 0.02, music.bus, 6);
    }
  }
  // Arpegio
  if (Math.random() < m.arpDensity * (0.55 + intensity * 0.45)) {
    const idx = (inBar * 2 + degree) % m.scale.length;
    const oct = inBar % 4 === 0 ? 4 : 3;
    scheduleNote(m.root * oct * Math.pow(2, m.scale[idx] / 12), t, beat * 0.9, m.wave, 0.055 + intensity * 0.03, music.bus, -4);
  }
  // Melodía en el segundo tiempo de compases impares
  if (bar % 2 === 1 && (inBar === 4 || inBar === 10 || inBar === 14)) {
    const idx = (bar * 3 + inBar) % m.scale.length;
    scheduleNote(m.root * 4 * Math.pow(2, m.scale[idx] / 12), t, beat * 1.8, 'triangle', 0.08, music.bus);
  }
  // Batería
  if (inBar % 8 === 0) scheduleDrum('kick', t, music.bus, 0.32);
  if (inBar === 6 || inBar === 14) scheduleDrum('kick', t, music.bus, 0.2);
  if (inBar % 8 === 4) scheduleDrum('snare', t, music.bus, 0.2);
  if (inBar % 2 === 0 || intensity > 0.6) scheduleDrum('hat', t, music.bus, 0.12);

  music.step = (step + 1) % 64;
  music.timer = window.setTimeout(tick, beat * 1000);
}

export function playMusic(moodKey: keyof typeof MOODS | string, intensity = 0.5): void {
  initAudio();
  if (!ctx || !musicGain) return;
  if (currentMoodKey === moodKey && music) {
    music.intensity = intensity;
    return;
  }
  stopMusic(0.6);
  const mood = MOODS[moodKey] ?? MOODS.menu;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.2);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 4200;
  bus.connect(filt).connect(musicGain);
  currentMoodKey = String(moodKey);
  music = { timer: null, step: 0, mood, bus, intensity };
  tick();
}

export function setMusicIntensity(v: number): void {
  if (music) music.intensity = Math.max(0, Math.min(1, v));
}

export function stopMusic(fade = 0.8): void {
  if (!music || !ctx) return;
  const m = music;
  music = null;
  currentMoodKey = '';
  if (m.timer !== null) clearTimeout(m.timer);
  try {
    m.bus.gain.cancelScheduledValues(ctx.currentTime);
    m.bus.gain.setValueAtTime(m.bus.gain.value, ctx.currentTime);
    m.bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
    setTimeout(() => m.bus.disconnect(), fade * 1000 + 120);
  } catch {
    m.bus.disconnect();
  }
}

/** "Voz" caricaturesca: pitidos modulados según el personaje. */
export function speak(speaker: string, length = 6): void {
  if (!ctx) return;
  const base =
    speaker === 'deedee' ? 260 : speaker === 'silva' ? 520 : speaker === 'professor' ? 180 : speaker === 'benito' ? 340 : 300;
  const type: OscillatorType = speaker === 'deedee' ? 'sawtooth' : speaker === 'silva' ? 'triangle' : 'square';
  const n = Math.min(10, Math.max(3, Math.floor(length)));
  for (let i = 0; i < n; i++) {
    blip(base * (0.85 + Math.random() * 0.5), 0.055, type, 0.07, 1 + (Math.random() - 0.5) * 0.3, i * 0.07);
  }
}
