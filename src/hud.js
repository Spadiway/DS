// ===== BENITO ESCAPE — HUD (DOM overlay) =====
import { t, getLang, CHAR_NAMES } from './i18n.js';
import { drawPortrait } from './portraits.js';

const el = (id) => document.getElementById(id);

export const GADGET_ORDER = ['net', 'waternet'];

export class Hud {
  constructor() {
    this.root = el('hud');
    this.toastTimer = null;
    this.commTimer = null;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() {
    this.root.classList.add('hidden');
    this.hideComm();
    el('hud-toast').classList.add('hidden');
  }

  setLives(n) {
    const box = el('hud-lives');
    box.innerHTML = '';
    const chip = document.createElement('div');
    chip.className = 'hud-chip';
    chip.textContent = '😺 × ' + n;
    box.appendChild(chip);
  }

  setEnergy(energy, max) {
    const box = el('hud-energy');
    box.innerHTML = '';
    const chip = document.createElement('div');
    chip.className = 'hud-chip';
    for (let i = 0; i < max; i++) {
      const h = document.createElement('div');
      h.className = 'heart' + (i < energy ? '' : ' empty');
      chip.appendChild(h);
    }
    box.appendChild(chip);
  }

  setCaptures(caught, required, total) {
    const box = el('hud-captures');
    box.className = 'hud-chip';
    box.textContent = `🥅 ${caught}/${required}  ·  🐾 ${total}`;
  }

  setTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    el('hud-timer').textContent = `${m}:${s}`;
  }

  setGadgets(owned, current) {
    const box = el('hud-gadgets');
    box.innerHTML = '';
    GADGET_ORDER.forEach((g, i) => {
      if (!owned.includes(g)) return;
      const slot = document.createElement('div');
      slot.className = 'gadget-slot' + (g === current ? ' active' : '');
      const icon = document.createElement('div');
      icon.textContent = g === 'net' ? '🕸️' : '💧';
      icon.style.fontSize = '22px';
      slot.appendChild(icon);
      const label = document.createElement('div');
      label.textContent = String(i + 1);
      slot.appendChild(label);
      box.appendChild(slot);
    });
  }

  toast(msg, dur = 2400) {
    const box = el('hud-toast');
    box.textContent = msg;
    box.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => box.classList.add('hidden'), dur);
  }

  /** Professor communicator popup. */
  comm(who, text, dur = 5200) {
    const box = el('hud-comm');
    drawPortrait(el('comm-portrait'), who);
    el('comm-name').textContent = CHAR_NAMES[getLang()][who] ?? who;
    el('comm-text').textContent = text;
    box.classList.remove('hidden');
    clearTimeout(this.commTimer);
    this.commTimer = setTimeout(() => box.classList.add('hidden'), dur);
  }

  hideComm() {
    el('hud-comm').classList.add('hidden');
    clearTimeout(this.commTimer);
  }
}
