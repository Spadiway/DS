// HUD estilo retro: vidas, salud, energía, capturas, gadgets y radar.

import { t } from './i18n.js';

const GADGET_ICONS = { net: '🕸️', baton: '⚡', hoop: '🌀', radar: '📡' };
const GADGET_KEYS = { net: 'J', baton: 'K', hoop: 'Shift', radar: 'R' };

export class Hud {
  constructor() {
    this.el = document.getElementById('hud');
    this.lives = document.getElementById('hud-lives');
    this.health = document.getElementById('hud-health');
    this.energyFill = document.getElementById('hud-energy-fill');
    this.captures = document.getElementById('hud-captures');
    this.levelName = document.getElementById('hud-level-name');
    this.gadgetBar = document.getElementById('hud-gadgets');
    this.message = document.getElementById('hud-message');
    this.radarBox = document.getElementById('hud-radar');
    this.radarCtx = document.getElementById('radar-canvas').getContext('2d');
    this.msgTimer = null;
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  setLevelName(name) { this.levelName.textContent = name; }

  update(player, lives, captured, required) {
    this.lives.textContent = '🐱'.repeat(Math.max(0, lives));
    this.health.textContent = '❤️'.repeat(Math.max(0, player.health)) + '🖤'.repeat(Math.max(0, 3 - player.health));
    this.energyFill.style.width = `${player.energy}%`;
    this.captures.textContent = required > 0 ? `🕸️ ${captured}/${required}` : `🕸️ ${captured}`;
  }

  buildGadgetBar(unlocked) {
    this.gadgetBar.innerHTML = '';
    for (const id of ['net', 'baton', 'hoop', 'radar']) {
      const slot = document.createElement('div');
      slot.className = 'gadget-slot' + (unlocked.includes(id) ? '' : ' locked');
      slot.dataset.gadget = id;
      slot.title = t(`gadgets.${id}`);
      slot.innerHTML = `<span>${GADGET_ICONS[id]}</span><span class="key">${GADGET_KEYS[id]}</span>`;
      this.gadgetBar.appendChild(slot);
    }
    this.highlightGadget('net');
  }

  highlightGadget(id) {
    for (const slot of this.gadgetBar.children) {
      slot.classList.toggle('active', slot.dataset.gadget === id);
    }
  }

  flashMessage(text, sec = 2.4) {
    this.message.textContent = text;
    this.message.classList.remove('hidden');
    if (this.msgTimer) clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => this.message.classList.add('hidden'), sec * 1000);
  }

  // Radar Bigotes: minimapa con mascotas.
  setRadarVisible(v) { this.radarBox.classList.toggle('hidden', !v); }

  drawRadar(player, pets, arenaHalf) {
    const c = this.radarCtx;
    const S = 140, R = S / 2;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(10, 40, 20, 0.9)';
    c.beginPath(); c.arc(R, R, R - 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3f6';
    c.lineWidth = 1;
    for (const rr of [R * 0.33, R * 0.66]) {
      c.beginPath(); c.arc(R, R, rr, 0, Math.PI * 2); c.stroke();
    }
    // barrido animado
    const sweep = (performance.now() * 0.002) % (Math.PI * 2);
    const grad = c.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, 'rgba(60,255,120,0.25)');
    grad.addColorStop(1, 'rgba(60,255,120,0)');
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(R, R);
    c.arc(R, R, R - 2, sweep, sweep + 0.7);
    c.closePath(); c.fill();

    const scale = (R - 8) / arenaHalf;
    for (const pet of pets) {
      if (pet.captured) continue;
      const dx = (pet.mesh.position.x - player.pos.x) * scale;
      const dz = (pet.mesh.position.z - player.pos.z) * scale;
      if (dx * dx + dz * dz > (R - 8) * (R - 8)) continue;
      c.fillStyle = { calm: '#2ec4f1', alert: '#ffd23f', alarm: '#ff5040' }[pet.state];
      c.beginPath(); c.arc(R + dx, R + dz, 3.4, 0, Math.PI * 2); c.fill();
    }
    // Benito al centro
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(R, R, 4, 0, Math.PI * 2); c.fill();
  }
}
