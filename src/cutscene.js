// ===== BENITO ESCAPE — dialogue cutscene player (DOM overlay) =====
import { SCENES, CHAR_NAMES, getLang, t } from './i18n.js';
import { drawPortrait } from './portraits.js';
import { Audio } from './audio.js';

const el = (id) => document.getElementById(id);

export class CutscenePlayer {
  constructor(input) {
    this.input = input;
    this.active = false;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.typeTimer = null;
    this.onDone = null;
    this.scene = null;

    el('cutscene-skip').addEventListener('click', () => this.finish());
    el('screen-cutscene').addEventListener('click', (e) => {
      if (e.target.id !== 'cutscene-skip') this.advance();
    });
  }

  play(sceneId, onDone) {
    const lang = getLang();
    this.scene = SCENES[lang][sceneId] ?? SCENES.es[sceneId];
    if (!this.scene) { onDone?.(); return; }
    this.onDone = onDone;
    this.active = true;
    this.lineIndex = -1;
    el('screen-cutscene').classList.remove('hidden');
    el('cutscene-backdrop').className = '';
    el('cutscene-backdrop').classList.add(this.scene.backdrop || 'lab');
    el('cutscene-skip').textContent = t('skip');
    el('cutscene-hint').textContent = t('advanceHint');
    this.advance();
  }

  advance() {
    if (!this.active) return;
    // if mid-typing, complete the line instantly
    const line = this.scene.lines[this.lineIndex];
    if (line && this.charIndex < line.text.length) {
      clearInterval(this.typeTimer);
      this.charIndex = line.text.length;
      el('cutscene-text').textContent = line.text;
      return;
    }
    this.lineIndex++;
    if (this.lineIndex >= this.scene.lines.length) { this.finish(); return; }
    const next = this.scene.lines[this.lineIndex];
    drawPortrait(el('cutscene-portrait'), next.who);
    el('cutscene-name').textContent = CHAR_NAMES[getLang()][next.who] ?? next.who;
    this.charIndex = 0;
    el('cutscene-text').textContent = '';
    Audio.sfx('select');
    clearInterval(this.typeTimer);
    this.typeTimer = setInterval(() => {
      this.charIndex += 1;
      el('cutscene-text').textContent = next.text.slice(0, this.charIndex);
      if (this.charIndex >= next.text.length) clearInterval(this.typeTimer);
    }, 22);
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.typeTimer);
    el('screen-cutscene').classList.add('hidden');
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  /** Call each frame so ENTER advances dialogue. */
  update() {
    if (!this.active) return;
    if (this.input.pressed('Enter') || this.input.pressed('Space') || this.input.pressed('KeyJ')) {
      this.advance();
    }
  }
}
