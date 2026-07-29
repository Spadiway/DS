// ===== BENITO ESCAPE — keyboard + touch input =====

export class Input {
  constructor() {
    this.keys = new Set();
    this.just = new Set();
    this.touch = { active: false, x: 0, y: 0, jump: false, jumpJust: false, net: false, netJust: false };
    this.anyKeyListeners = [];

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      this.keys.add(c);
      this.just.add(c);
      for (const fn of this.anyKeyListeners) fn(c);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this._setupTouch();
  }

  onAnyKey(fn) { this.anyKeyListeners.push(fn); }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.just.has(code); }

  /** Movement vector in screen space: x = right, y = forward. Normalized. */
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.touch.active) { x += this.touch.x; y -= this.touch.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  jumpPressed() { return this.pressed('Space') || this.touch.jumpJust; }
  netPressed() { return this.pressed('KeyJ') || this.pressed('Enter') || this.touch.netJust; }
  sneakDown() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  camLeft() { return this.down('KeyQ'); }
  camRight() { return this.down('KeyE'); }
  pausePressed() { return this.pressed('Escape') || this.pressed('KeyP'); }

  /** Call at end of each frame. */
  endFrame() {
    this.just.clear();
    this.touch.jumpJust = false;
    this.touch.netJust = false;
  }

  _setupTouch() {
    const zone = document.getElementById('stick-zone');
    const nub = document.getElementById('stick-nub');
    const base = document.getElementById('stick-base');
    if (!zone) return;
    let touchId = null;
    let cx = 0, cy = 0;
    const R = 45;

    const onMove = (t) => {
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      nub.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touch.x = dx / R;
      this.touch.y = dy / R;
    };
    zone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      const rect = base.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      this.touch.active = true;
      onMove(t);
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchId) onMove(t);
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === touchId) {
        touchId = null;
        this.touch.active = false;
        this.touch.x = this.touch.y = 0;
        nub.style.transform = '';
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);

    const bindBtn = (id, downKey, justKey) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => {
        this.touch[downKey] = true;
        this.touch[justKey] = true;
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', () => { this.touch[downKey] = false; });
    };
    bindBtn('btn-jump', 'jump', 'jumpJust');
    bindBtn('btn-net', 'net', 'netJust');
  }
}

export function isTouchDevice() {
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0;
}
