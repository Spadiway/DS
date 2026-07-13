// Sistema de diálogos estilo dibujos animados con efecto máquina de escribir.

import { t, getLang } from './i18n.js';
import { sfx } from './audio.js';

const PORTRAITS = { benito: '🐱', deedee: '🐶', silva: '🐈', prof: '👨‍🔬' };

export class DialogSystem {
  constructor() {
    this.box = document.getElementById('dialog-box');
    this.portrait = document.getElementById('dialog-portrait');
    this.name = document.getElementById('dialog-name');
    this.text = document.getElementById('dialog-text');
    this.hint = document.getElementById('dialog-hint');
    this.queue = [];
    this.active = false;
    this.charIndex = 0;
    this.currentLine = '';
    this.typeTimer = 0;
    this.onDone = null;
  }

  // lines: [ [charId, {es, en}], ... ]
  start(lines, onDone) {
    this.queue = [...lines];
    this.onDone = onDone;
    this.active = true;
    this.box.classList.remove('hidden');
    this.hint.textContent = t('dialogHint');
    this.nextLine();
  }

  nextLine() {
    const line = this.queue.shift();
    if (!line) return this.finish();
    const [charId, textByLang] = line;
    this.portrait.textContent = PORTRAITS[charId] ?? '❓';
    this.name.textContent = t(`chars.${charId}`);
    this.currentLine = textByLang[getLang()] ?? textByLang.es;
    this.charIndex = 0;
    this.text.textContent = '';
  }

  finish() {
    this.active = false;
    this.box.classList.add('hidden');
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }

  advance() {
    if (!this.active) return;
    if (this.charIndex < this.currentLine.length) {
      // completar línea de golpe
      this.charIndex = this.currentLine.length;
      this.text.textContent = this.currentLine;
    } else {
      this.nextLine();
    }
  }

  skipAll() {
    if (!this.active) return;
    this.queue = [];
    this.finish();
  }

  update(dt) {
    if (!this.active) return;
    if (this.charIndex < this.currentLine.length) {
      this.typeTimer += dt;
      const CPS = 40;
      while (this.typeTimer > 1 / CPS && this.charIndex < this.currentLine.length) {
        this.typeTimer -= 1 / CPS;
        this.charIndex++;
        if (this.charIndex % 3 === 0) sfx.talk();
      }
      this.text.textContent = this.currentLine.slice(0, this.charIndex);
    }
  }
}
