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

  /** Live minimap: terrain zones, pets by alert state, portal, player arrow. */
  drawMinimap(s) {
    const cv = el('hud-minimap');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const size = cv.width;
    const b = s.def.bounds;
    const W = b.maxX - b.minX, D = b.maxZ - b.minZ;
    const scale = (size - 16) / Math.max(W, D);
    const ox = (size - W * scale) / 2;
    const oy = (size - D * scale) / 2;
    const X = (x) => ox + (x - b.minX) * scale;
    const Y = (z) => oy + (b.maxZ - z) * scale; // +Z (forward at spawn) points up

    ctx.clearRect(0, 0, size, size);
    // playable area
    ctx.fillStyle = s.built.theme.groundBase;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(X(b.minX), Y(b.minZ), W * scale, D * scale);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(b.minX), Y(b.minZ), W * scale, D * scale);

    // zones
    for (const w of s.def.waters) {
      ctx.fillStyle = 'rgba(72,150,214,.85)';
      ctx.beginPath();
      ctx.arc(X(w.x), Y(w.z), w.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const l of s.def.lavas) {
      ctx.fillStyle = 'rgba(255,96,32,.85)';
      ctx.beginPath();
      ctx.arc(X(l.x), Y(l.z), l.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // platforms
    ctx.fillStyle = 'rgba(215,215,225,.5)';
    for (const c of s.built.colliders) {
      ctx.fillRect(X(c.minX), Y(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
    }
    // checkpoints
    for (const cp of s.built.checkpoints) {
      ctx.fillStyle = cp.active ? '#2ecc71' : '#e8e8e8';
      ctx.fillRect(X(cp.x) - 2, Y(cp.z) - 2, 4, 4);
    }
    // portal
    const ex = X(s.def.exit[0]), ey = Y(s.def.exit[1]);
    const blink = s.portalOpen ? 0.6 + 0.4 * Math.sin(s.elapsed * 6) : 0.9;
    ctx.globalAlpha = blink;
    ctx.fillStyle = s.portalOpen ? '#ffd93b' : '#9a9a9a';
    ctx.beginPath();
    ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // pets (colored by alert state)
    const stateColor = { calm: '#3f9dff', alert: '#ffd23b', panic: '#ff3b30' };
    for (const p of s.pets) {
      if (p.captured) continue;
      ctx.fillStyle = stateColor[p.state] ?? '#3f9dff';
      ctx.beginPath();
      ctx.arc(X(p.group.position.x), Y(p.group.position.z), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // boss
    if (s.boss && !s.boss.captured) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(X(s.boss.group.position.x), Y(s.boss.group.position.z), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    // player arrow
    const px = X(s.player.pos.x), py = Y(s.player.pos.z);
    const h = s.player.heading;
    const dx = Math.sin(h), dy = -Math.cos(h);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + dx * 6, py + dy * 6);
    ctx.lineTo(px - dy * 3.6 - dx * 3, py + dx * 3.6 - dy * 3);
    ctx.lineTo(px + dy * 3.6 - dx * 3, py - dx * 3.6 - dy * 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
