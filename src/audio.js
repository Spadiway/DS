// Audio sintetizado con WebAudio: melodías originales estilo chiptune y SFX.
// No se usa ningún audio externo; todo se genera en tiempo real.

let ctx = null;
let musicGain = null;
let sfxGain = null;
let seq = null;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.3;
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---------- Música: secuenciador de pasos ----------
// Cada tema es una progresión original definida como notas MIDI por pista.

const N = null;
// Escalas y patrones originales por ambiente (compuestos para este juego).
const THEMES = {
  menu: {
    bpm: 96, wave: 'triangle',
    bass: [45, N, 45, N, 48, N, 43, N, 45, N, 45, N, 50, N, 43, N],
    lead: [69, 72, 76, 72, 69, N, 67, N, 69, 71, 72, 71, 67, N, 64, N]
  },
  prehistoric: {
    bpm: 104, wave: 'square',
    bass: [38, N, 38, 45, 36, N, 36, 43, 38, N, 38, 45, 41, N, 43, N],
    lead: [62, N, 65, 62, 67, N, 65, 62, 60, N, 62, 65, 69, 67, 65, 62]
  },
  jungle: {
    bpm: 112, wave: 'square',
    bass: [40, N, 47, N, 40, N, 45, N, 38, N, 45, N, 43, N, 47, N],
    lead: [71, 69, 67, N, 64, 67, 69, N, 71, 74, 72, 71, 69, N, 67, N]
  },
  beach: {
    bpm: 100, wave: 'triangle',
    bass: [41, N, 48, N, 46, N, 53, N, 39, N, 46, N, 41, 43, 45, 46],
    lead: [65, 69, 72, 69, 74, 72, 69, 65, 63, 65, 67, 70, 72, N, 65, N]
  },
  ice: {
    bpm: 92, wave: 'triangle',
    bass: [43, N, N, 50, 41, N, N, 48, 40, N, N, 47, 43, N, 47, N],
    lead: [74, N, 71, 67, 72, N, 69, 65, 71, N, 67, 64, 69, 71, 72, N]
  },
  medieval: {
    bpm: 108, wave: 'square',
    bass: [38, N, 38, N, 41, N, 36, N, 38, N, 38, N, 45, 43, 41, 40],
    lead: [62, 64, 65, 67, 69, N, 65, N, 67, 65, 64, 62, 60, N, 62, N]
  },
  future: {
    bpm: 124, wave: 'sawtooth',
    bass: [36, 36, N, 36, 39, N, 36, N, 34, 34, N, 34, 41, N, 39, N],
    lead: [72, N, 75, 72, 77, 75, N, 72, 70, N, 72, 75, 79, N, 77, 75]
  },
  finale: {
    bpm: 132, wave: 'sawtooth',
    bass: [33, 33, 45, 33, 33, 33, 44, 33, 31, 31, 43, 31, 38, 38, 41, 40],
    lead: [69, N, 68, 69, 72, N, 71, 72, 76, 75, 76, N, 74, 72, 71, 68]
  }
};

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function playNote(midi, time, dur, wave, gainNode, vol = 1) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g).connect(gainNode);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

export function playMusic(themeName) {
  ensureCtx();
  stopMusic();
  const theme = THEMES[themeName] || THEMES.menu;
  const stepDur = 60 / theme.bpm / 2; // corcheas
  let step = 0;
  let nextTime = ctx.currentTime + 0.05;

  seq = setInterval(() => {
    while (nextTime < ctx.currentTime + 0.25) {
      const i = step % 16;
      const b = theme.bass[i];
      const l = theme.lead[i];
      if (b !== null) playNote(b, nextTime, stepDur * 0.9, 'triangle', musicGain, 0.9);
      if (l !== null) playNote(l, nextTime, stepDur * 0.8, theme.wave, musicGain, 0.55);
      // percusión: ruido corto en tiempos fuertes
      if (i % 4 === 0) noiseHit(nextTime, 0.03, 0.25);
      else if (i % 4 === 2) noiseHit(nextTime, 0.015, 0.12);
      nextTime += stepDur;
      step++;
    }
  }, 90);
}

function noiseHit(time, dur, vol) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(musicGain);
  src.start(time);
}

export function stopMusic() {
  if (seq) { clearInterval(seq); seq = null; }
}

// ---------- Efectos de sonido ----------

function sweep(f0, f1, dur, wave = 'square', vol = 0.5) {
  ensureCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function arpeggio(midis, stepDur = 0.07, wave = 'square', vol = 0.5) {
  ensureCtx();
  const t = ctx.currentTime;
  midis.forEach((m, i) => playNote(m, t + i * stepDur, stepDur * 1.6, wave, sfxGain, vol));
}

export const sfx = {
  jump: () => sweep(300, 640, 0.18, 'square', 0.35),
  swing: () => sweep(700, 180, 0.12, 'sawtooth', 0.3),
  capture: () => arpeggio([72, 76, 79, 84], 0.06, 'square', 0.5),
  hurt: () => sweep(260, 70, 0.3, 'sawtooth', 0.5),
  pickup: () => arpeggio([76, 81], 0.05, 'triangle', 0.5),
  alert: () => sweep(500, 900, 0.1, 'square', 0.3),
  dash: () => sweep(220, 880, 0.25, 'sawtooth', 0.3),
  stun: () => sweep(950, 420, 0.2, 'square', 0.4),
  portal: () => arpeggio([60, 64, 67, 72, 76, 79], 0.07, 'triangle', 0.45),
  victory: () => arpeggio([65, 69, 72, 77, 72, 77, 81], 0.09, 'square', 0.55),
  lose: () => arpeggio([64, 60, 57, 52], 0.14, 'triangle', 0.5),
  select: () => sweep(600, 900, 0.06, 'square', 0.25),
  bossHit: () => arpeggio([79, 72, 79, 84], 0.05, 'sawtooth', 0.5),
  talk: () => sweep(480, 560, 0.04, 'square', 0.12)
};

export function unlockAudio() { ensureCtx(); }
