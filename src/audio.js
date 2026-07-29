// ===== BENITO ESCAPE — WebAudio synth: original chiptune-style music + SFX =====
// All melodies and effects are original compositions generated procedurally.

class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOn = localStorage.getItem('benitoMusic') !== 'off';
    this._timer = null;
    this._theme = null;
    this._step = 0;
    this._nextTime = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.master);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    localStorage.setItem('benitoMusic', this.musicOn ? 'on' : 'off');
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
    return this.musicOn;
  }

  // ---------- low-level helpers ----------
  _note(freq, when, dur, type, gain, dest, slideTo) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  _noise(when, dur, gain, dest, hp = 4000) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start(when);
  }

  // ---------- SFX ----------
  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.sfxGain;
    switch (name) {
      case 'jump':
        this._note(300, t, 0.18, 'square', 0.18, d, 620);
        break;
      case 'swing':
        this._noise(t, 0.16, 0.35, d, 2500);
        this._note(900, t, 0.1, 'sawtooth', 0.05, d, 300);
        break;
      case 'capture': { // little original victory arpeggio
        const seq = [523, 659, 784, 1047];
        seq.forEach((f, i) => this._note(f, t + i * 0.07, 0.12, 'square', 0.16, d));
        this._noise(t, 0.08, 0.2, d, 6000);
        break;
      }
      case 'pickup':
        this._note(880, t, 0.07, 'square', 0.14, d);
        this._note(1320, t + 0.07, 0.1, 'square', 0.14, d);
        break;
      case 'hurt':
        this._note(320, t, 0.25, 'sawtooth', 0.22, d, 90);
        break;
      case 'alert':
        this._note(700, t, 0.09, 'square', 0.15, d);
        this._note(700, t + 0.12, 0.09, 'square', 0.15, d);
        break;
      case 'alarm':
        this._note(950, t, 0.1, 'square', 0.16, d);
        this._note(760, t + 0.11, 0.12, 'square', 0.16, d);
        this._note(950, t + 0.24, 0.14, 'square', 0.16, d);
        break;
      case 'splash':
        this._noise(t, 0.3, 0.3, d, 900);
        this._note(220, t, 0.22, 'sine', 0.15, d, 90);
        break;
      case 'roar':
        this._note(90, t, 0.6, 'sawtooth', 0.3, d, 45);
        this._noise(t, 0.4, 0.25, d, 300);
        break;
      case 'dizzy':
        [660, 550, 440, 550, 660].forEach((f, i) => this._note(f, t + i * 0.1, 0.09, 'triangle', 0.14, d));
        break;
      case 'checkpoint':
        this._note(659, t, 0.1, 'square', 0.15, d);
        this._note(880, t + 0.1, 0.18, 'square', 0.15, d);
        break;
      case 'portal':
        this._note(392, t, 0.4, 'triangle', 0.16, d, 784);
        this._note(523, t + 0.15, 0.45, 'triangle', 0.14, d, 1047);
        break;
      case 'select':
        this._note(660, t, 0.06, 'square', 0.12, d);
        break;
      case 'fanfare': { // original 8-note clear jingle
        const seq = [392, 392, 523, 659, 587, 523, 784, 1047];
        const dur = [0.1, 0.1, 0.14, 0.14, 0.1, 0.1, 0.16, 0.4];
        let tt = t;
        seq.forEach((f, i) => {
          this._note(f, tt, dur[i] + 0.05, 'square', 0.17, d);
          this._note(f / 2, tt, dur[i] + 0.05, 'triangle', 0.12, d);
          tt += dur[i];
        });
        break;
      }
      case 'gameover': {
        const seq = [523, 494, 440, 392, 330, 262];
        seq.forEach((f, i) => this._note(f, t + i * 0.16, 0.2, 'triangle', 0.16, d));
        break;
      }
    }
  }

  // ---------- music sequencer (original loops) ----------
  // Patterns: 32 steps, ~8th notes. null = rest.
  static THEMES = {
    title: {
      bpm: 96,
      bass: [131, null, 131, null, 175, null, 175, null, 147, null, 147, null, 196, null, 165, null,
             131, null, 131, null, 175, null, 175, null, 147, null, 147, null, 98, null, 123, null],
      lead: [523, null, null, 659, null, 587, null, null, 523, null, 440, null, 392, null, null, null,
             440, null, null, 523, null, 587, null, null, 659, null, 587, null, 523, null, null, null],
      hat: 4,
    },
    world1: {
      bpm: 132,
      bass: [98, null, 98, 98, null, 98, null, 110, 98, null, 98, 98, null, 131, null, 123,
             98, null, 98, 98, null, 98, null, 110, 147, null, 147, 131, null, 110, null, 98],
      lead: [392, null, 440, null, 523, null, 440, 392, null, null, 330, null, 392, null, null, null,
             392, null, 440, null, 523, null, 587, 523, null, null, 659, 587, 523, 440, null, null],
      hat: 2,
    },
    swamp: {
      bpm: 112,
      bass: [87, null, null, 87, null, null, 104, null, 87, null, null, 87, null, null, 78, null,
             87, null, null, 87, null, null, 104, null, 117, null, null, 104, null, null, 87, null],
      lead: [349, null, null, null, 415, null, 392, null, 349, null, null, null, 311, null, null, null,
             349, null, null, null, 415, null, 466, null, 415, null, 392, null, 349, null, null, null],
      hat: 4,
    },
    boss: {
      bpm: 152,
      bass: [82, 82, null, 82, 98, null, 82, null, 82, 82, null, 82, 73, null, 78, null,
             82, 82, null, 82, 98, null, 82, null, 110, 110, null, 104, 98, null, 92, null],
      lead: [330, null, 330, 392, null, 330, null, 311, 330, null, 330, 392, null, 466, null, 440,
             330, null, 330, 392, null, 330, null, 311, 523, null, 466, null, 440, null, 392, null],
      hat: 1,
    },
  };

  startMusic(themeName) {
    if (!this.ctx) return;
    if (this._theme === themeName && this._timer) return;
    this.stopMusic();
    const theme = AudioSys.THEMES[themeName];
    if (!theme) return;
    this._theme = themeName;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    const stepDur = 60 / theme.bpm / 2; // 8th notes
    this._timer = setInterval(() => {
      if (!this.ctx) return;
      while (this._nextTime < this.ctx.currentTime + 0.25) {
        const i = this._step % 32;
        const tt = this._nextTime;
        const b = theme.bass[i];
        if (b) this._note(b, tt, stepDur * 0.9, 'triangle', 0.3, this.musicGain);
        const l = theme.lead[i];
        if (l) this._note(l, tt, stepDur * 0.85, 'square', 0.11, this.musicGain);
        if (i % theme.hat === 0) this._noise(tt, 0.03, 0.06, this.musicGain, 7000);
        if (i % 8 === 0) this._note(55, tt, 0.1, 'sine', 0.35, this.musicGain, 40); // kick
        this._step++;
        this._nextTime += stepDur;
      }
    }, 90);
  }

  stopMusic() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._theme = null;
  }
}

export const Audio = new AudioSys();
