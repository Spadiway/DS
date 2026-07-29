// ===== BENITO ESCAPE — bootstrap + screen state machine =====
import * as THREE from '../lib/three.module.js';
import { t, toggleLang, applyDomI18n, getLang } from './i18n.js';
import { Input, isTouchDevice } from './input.js';
import { Audio } from './audio.js';
import { loadSlots, saveSlot, deleteSlot, newGameData, recountTotal, NUM_SLOTS } from './save.js';
import { WORLDS, LEVELS, totalPetsInLevel } from './levels.js';
import { Hud } from './hud.js';
import { CutscenePlayer } from './cutscene.js';
import { LevelSession } from './game.js';
import { drawTitleBenito } from './portraits.js';

const el = (id) => document.getElementById(id);
const SCREENS = ['screen-title', 'screen-menu', 'screen-slots', 'screen-map',
  'screen-cutscene', 'screen-results', 'screen-pause', 'screen-gameover'];

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.gfxHigh = localStorage.getItem('benitoGfx') !== 'low';
    this.applyGfx();
    el('canvas-holder').appendChild(this.renderer.domElement);

    this.input = new Input();
    this.hud = new Hud();
    this.cutscenes = new CutscenePlayer(this.input);

    this.state = 'title';        // title | menu | slots | map | playing | paused | results | gameover | cutscene
    this.session = null;
    this.slotIndex = 0;
    this.save = null;
    this.lastTime = performance.now();

    applyDomI18n();
    drawTitleBenito(el('title-benito'));
    if (isTouchDevice()) el('touch').classList.remove('hidden');

    // audio needs a user gesture
    const initAudio = () => Audio.init();
    window.addEventListener('pointerdown', initAudio, { once: true });
    this.input.onAnyKey(initAudio);

    window.addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.session?.onResize();
    });

    this.bindMenus();
    this.showScreen('screen-title');
    window.__game = this; // debug/testing hook
    requestAnimationFrame((tm) => this.loop(tm));
  }

  applyGfx() {
    this.renderer.shadowMap.enabled = this.gfxHigh;
    this.renderer.setPixelRatio(this.gfxHigh ? Math.min(devicePixelRatio, 2) : 1);
    this.renderer.setSize(innerWidth, innerHeight);
  }

  // ---------------- screens ----------------
  showScreen(id) {
    for (const s of SCREENS) el(s).classList.add('hidden');
    if (id) el(id).classList.remove('hidden');
  }

  bindMenus() {
    el('slots-back').addEventListener('click', () => this.gotoMenu());
    el('map-menu-btn').addEventListener('click', () => this.gotoMenu());
    el('results-continue').addEventListener('click', () => this.closeResults());
    el('gameover-continue').addEventListener('click', () => {
      this.showScreen(null);
      this.gotoMap();
    });
  }

  // ---------------- title / menu ----------------
  gotoMenu() {
    this.disposeSession();
    this.state = 'menu';
    Audio.startMusic('title');
    const list = el('menu-list');
    list.innerHTML = '';
    const slots = loadSlots();
    const hasSave = slots.some((s) => s !== null);

    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'menu-btn';
      b.textContent = label;
      b.addEventListener('click', () => { Audio.sfx('select'); fn(); });
      list.appendChild(b);
      return b;
    };
    if (hasSave) mk(t('continueGame'), () => this.gotoSlots());
    mk(t('newGame'), () => this.gotoSlots());
    mk(t('langToggle'), () => { toggleLang(); this.gotoMenu(); });
    mk(Audio.musicOn ? t('musicOn') : t('musicOff'), () => { Audio.toggleMusic(); this.gotoMenu(); });
    mk(this.gfxHigh ? t('gfxHigh') : t('gfxLow'), () => {
      this.gfxHigh = !this.gfxHigh;
      localStorage.setItem('benitoGfx', this.gfxHigh ? 'high' : 'low');
      this.applyGfx();
      this.gotoMenu();
    });
    this.showScreen('screen-menu');
  }

  gotoSlots() {
    this.state = 'slots';
    const list = el('slot-list');
    list.innerHTML = '';
    const slots = loadSlots();
    const nLevels = WORLDS.reduce((n, w) => n + w.levels.length, 0);
    for (let i = 0; i < NUM_SLOTS; i++) {
      const data = slots[i];
      const card = document.createElement('button');
      card.className = 'slot-card';
      const info = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'slot-title';
      title.textContent = `${t('slot')} ${i + 1}`;
      const meta = document.createElement('div');
      meta.className = 'slot-meta';
      meta.textContent = data
        ? t('slotMeta', { caught: data.totalCaptured, done: Object.keys(data.completed).length, total: nLevels })
        : t('emptySlot');
      info.appendChild(title);
      info.appendChild(meta);
      card.appendChild(info);
      if (data) {
        const del = document.createElement('span');
        del.className = 'slot-del';
        del.textContent = t('deleteSlot');
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteSlot(i);
          this.gotoSlots();
        });
        card.appendChild(del);
      }
      card.addEventListener('click', () => {
        Audio.sfx('select');
        this.slotIndex = i;
        if (data) {
          this.save = data;
          this.gotoMap();
        } else {
          this.save = newGameData();
          saveSlot(i, this.save);
          this.playScene('opening', () => this.gotoMap());
        }
      });
      list.appendChild(card);
    }
    this.showScreen('screen-slots');
  }

  // ---------------- world map (archipelago canvas + detail panel) ----------------
  static MAP_ISLANDS = [
    { x: 0.09, y: 0.68 }, { x: 0.22, y: 0.34 }, { x: 0.36, y: 0.66 },
    { x: 0.50, y: 0.30 }, { x: 0.63, y: 0.64 }, { x: 0.76, y: 0.32 },
    { x: 0.87, y: 0.62 }, { x: 0.94, y: 0.24 },
  ];
  static MAP_COLORS = ['#6fbc4c', '#2e7d4f', '#e8c97a', '#cfeaff', '#9aa7b8', '#8892a8', '#8a5fd4', '#c0392b'];
  static MAP_ICONS = ['🦴', '🗿', '🏝️', '❄️', '🏯', '🌆', '🌀', '👑'];

  gotoMap() {
    this.disposeSession();
    this.state = 'map';
    Audio.startMusic('title');
    recountTotal(this.save);
    el('map-stats').textContent = t('totalCaught', { n: this.save.totalCaptured });
    if (!this.selectedWorld) this.selectedWorld = 1;
    this.showScreen('screen-map');
    this.drawWorldMap();
    this.renderWorldDetail();
    if (!this._mapClickBound) {
      this._mapClickBound = true;
      el('map-canvas').addEventListener('click', (e) => this.onMapClick(e));
    }
  }

  worldDone(world) {
    return world.levels.length > 0 && world.levels.every((id) => this.save.completed[id]);
  }

  drawWorldMap() {
    const cv = el('map-canvas');
    const ctx = cv.getContext('2d');
    const Wc = cv.width, Hc = cv.height;
    // sea
    const sea = ctx.createLinearGradient(0, 0, 0, Hc);
    sea.addColorStop(0, '#2a6a9e');
    sea.addColorStop(1, '#123a5e');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, Wc, Hc);
    // decorative waves
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const wx = (i * 137) % Wc, wy = (i * 83 + 40) % Hc;
      ctx.beginPath();
      ctx.arc(wx, wy, 9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    const P = Game.MAP_ISLANDS.map((p) => [p.x * Wc, p.y * Hc]);
    // dotted route
    ctx.setLineDash([7, 8]);
    ctx.lineWidth = 3;
    for (let i = 0; i < P.length - 1; i++) {
      const done = this.worldDone(WORLDS[i]);
      ctx.strokeStyle = done ? 'rgba(255,217,59,.9)' : 'rgba(255,255,255,.35)';
      const [x1, y1] = P[i], [x2, y2] = P[i + 1];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 26, x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // islands
    for (let i = 0; i < P.length; i++) {
      const world = WORLDS[i];
      const [x, y] = P[i];
      const R = 27;
      const avail = world.available;
      // sand base
      ctx.fillStyle = avail ? '#f0dca8' : '#8a94a2';
      ctx.beginPath();
      ctx.ellipse(x, y + 5, R + 7, R * 0.62 + 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // island body
      ctx.fillStyle = avail ? Game.MAP_COLORS[i] : '#6a7482';
      ctx.beginPath();
      ctx.arc(x, y - 4, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // selection ring
      if (this.selectedWorld === world.id) {
        ctx.strokeStyle = '#ffd93b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y - 4, R + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      // icon + number
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '24px sans-serif';
      ctx.fillText(avail ? Game.MAP_ICONS[i] : '🔒', x, y - 6);
      ctx.font = 'bold 13px Trebuchet MS, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.lineWidth = 3;
      const label = String(world.id);
      ctx.strokeText(label, x - R + 6, y - R + 4);
      ctx.fillText(label, x - R + 6, y - R + 4);
      // completed badge
      if (this.worldDone(world)) {
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#2ecc71';
        ctx.strokeText('✔', x + R - 7, y - R + 5);
        ctx.fillText('✔', x + R - 7, y - R + 5);
      }
      // name under available islands
      ctx.font = 'bold 11.5px Trebuchet MS, sans-serif';
      ctx.fillStyle = avail ? '#ffe9b8' : 'rgba(255,255,255,.45)';
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 3;
      const name = t(world.nameKey);
      ctx.strokeText(name, x, y + R + 16);
      ctx.fillText(name, x, y + R + 16);
    }
  }

  onMapClick(e) {
    const cv = el('map-canvas');
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (cv.width / rect.width);
    const my = (e.clientY - rect.top) * (cv.height / rect.height);
    for (let i = 0; i < Game.MAP_ISLANDS.length; i++) {
      const x = Game.MAP_ISLANDS[i].x * cv.width;
      const y = Game.MAP_ISLANDS[i].y * cv.height;
      if ((mx - x) ** 2 + (my - y) ** 2 < 36 * 36) {
        this.selectedWorld = WORLDS[i].id;
        Audio.sfx('select');
        this.drawWorldMap();
        this.renderWorldDetail();
        return;
      }
    }
  }

  renderWorldDetail() {
    const world = WORLDS.find((w) => w.id === this.selectedWorld) ?? WORLDS[0];
    const box = el('world-detail');
    box.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'world-card' + (world.available ? '' : ' locked');
    const title = document.createElement('div');
    title.className = 'world-title';
    const num = document.createElement('span');
    num.className = 'wnum';
    num.textContent = String(world.id);
    title.appendChild(num);
    title.appendChild(document.createTextNode(t(world.nameKey)));
    if (world.available) {
      let caught = 0, total = 0;
      for (const lvlId of world.levels) {
        caught += (this.save.captures[lvlId] ?? []).length;
        total += totalPetsInLevel(lvlId);
      }
      const prog = document.createElement('span');
      prog.className = 'world-progress';
      prog.textContent = `🐾 ${caught}/${total}`;
      title.appendChild(prog);
    }
    card.appendChild(title);

    const row = document.createElement('div');
    row.className = 'level-row';
    if (!world.available) {
      const note = document.createElement('div');
      note.className = 'lock-note';
      note.textContent = `🔒 ${t('comingSoon')}`;
      row.appendChild(note);
    } else {
      for (const lvlId of world.levels) {
        const unlocked = !!this.save.unlocked[lvlId];
        const done = !!this.save.completed[lvlId];
        const caught = (this.save.captures[lvlId] ?? []).length;
        const total = totalPetsInLevel(lvlId);
        const btn = document.createElement('button');
        btn.className = 'level-btn' + (done ? ' done' : '');
        btn.disabled = !unlocked;
        const name = document.createElement('span');
        name.className = 'lv-name';
        name.textContent = `${lvlId} · ${t('l' + lvlId)}`;
        const meta = document.createElement('span');
        meta.className = 'lv-meta';
        meta.textContent = unlocked ? `🐾 ${caught}/${total}${done ? ' ✔' : ''}` : `🔒 ${t('completeToUnlock')}`;
        btn.appendChild(name);
        btn.appendChild(meta);
        if (unlocked) btn.addEventListener('click', () => { Audio.sfx('select'); this.startLevel(lvlId); });
        row.appendChild(btn);
      }
    }
    card.appendChild(row);
    box.appendChild(card);
  }

  // ---------------- cutscenes ----------------
  playScene(sceneId, onDone) {
    if (this.save?.seenScenes?.[sceneId] && sceneId !== 'opening') { onDone?.(); return; }
    const prevState = this.state;
    this.state = 'cutscene';
    this.showScreen('screen-cutscene');
    Audio.stopMusic();
    this.cutscenes.play(sceneId, () => {
      if (this.save) {
        this.save.seenScenes[sceneId] = true;
        saveSlot(this.slotIndex, this.save);
      }
      this.state = prevState;
      onDone?.();
    });
  }

  // ---------------- gameplay ----------------
  startLevel(levelId) {
    const begin = () => {
      this.disposeSession();
      this.showScreen(null);
      this.state = 'playing';
      this.session = new LevelSession({
        levelId,
        save: this.save,
        hud: this.hud,
        renderer: this.renderer,
        onComplete: (results) => this.onLevelComplete(results),
        onGameOver: () => this.onGameOver(),
        onScene: (sceneId, cb) => {
          this.hud.hide();
          this.playScene(sceneId, () => {
            this.hud.show();
            this.state = 'playing';
            cb?.();
          });
        },
      });
    };
    if (levelId === '1-1' && !this.save.seenScenes['world1']) {
      this.playScene('world1', begin);
    } else {
      begin();
    }
  }

  onLevelComplete(results) {
    const def = LEVELS[results.levelId];
    // merge captures into the save
    this.save.captures[results.levelId] = [...results.captures];
    this.save.completed[results.levelId] = true;
    const best = this.save.bestTimes[results.levelId];
    if (!best || results.time < best) this.save.bestTimes[results.levelId] = results.time;
    this.save.playtime += results.time;

    // unlock next level in the world
    const world = WORLDS.find((w) => w.id === def.world);
    const idx = world.levels.indexOf(results.levelId);
    if (idx >= 0 && idx + 1 < world.levels.length) {
      this.save.unlocked[world.levels[idx + 1]] = true;
    }

    // gadget unlock
    let newGadget = null;
    if (def.unlockGadget && !this.save.gadgets.includes(def.unlockGadget)) {
      this.save.gadgets.push(def.unlockGadget);
      newGadget = def.unlockGadget;
    }
    recountTotal(this.save);
    saveSlot(this.slotIndex, this.save);

    this.hud.hide();
    const showResults = () => {
      this.state = 'results';
      const rows = el('results-rows');
      rows.innerHTML = '';
      const addRow = (label, val, cls = '') => {
        const r = document.createElement('div');
        r.className = 'res-row ' + cls;
        const a = document.createElement('span');
        a.textContent = label;
        const b = document.createElement('span');
        b.className = 'res-val';
        b.textContent = val;
        r.appendChild(a);
        r.appendChild(b);
        rows.appendChild(r);
      };
      const m = Math.floor(results.time / 60);
      const s = Math.floor(results.time % 60).toString().padStart(2, '0');
      addRow(t('resCaptures'), `${results.caughtThisRun} (${results.captures.size}/${totalPetsInLevel(results.levelId)})`);
      addRow(t('resTime'), `${m}:${s}`);
      addRow(t('resCookies'), String(results.cookies));
      if (newGadget) addRow(t('resGadget'), t('gadget_' + newGadget), 'res-new');
      this.showScreen('screen-results');
      this._lastLevelDone = results.levelId;
    };

    if (def.unlockScene && newGadget) {
      this.playScene(def.unlockScene, showResults);
    } else {
      showResults();
    }
  }

  closeResults() {
    Audio.sfx('select');
    // end of phase 1 note after beating the boss level
    if (this._lastLevelDone === '1-3') {
      this.gotoMap();
      setTimeout(() => this.hud.toast(t('demoEnd'), 3500), 200);
      this.hud.show();
      setTimeout(() => this.hud.hide(), 3800);
    } else {
      this.gotoMap();
    }
  }

  onGameOver() {
    this.hud.hide();
    this.state = 'gameover';
    this.showScreen('screen-gameover');
    applyDomI18n();
  }

  // ---------------- pause ----------------
  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.session.paused = true;
      const list = el('pause-list');
      list.innerHTML = '';
      const mk = (label, fn) => {
        const b = document.createElement('button');
        b.className = 'menu-btn';
        b.textContent = label;
        b.addEventListener('click', () => { Audio.sfx('select'); fn(); });
        list.appendChild(b);
      };
      mk(t('resume'), () => this.togglePause());
      mk(t('restart'), () => {
        const id = this.session.levelId;
        this.showScreen(null);
        this.startLevel(id);
      });
      mk(t('exitToMap'), () => { this.hud.hide(); this.gotoMap(); });
      this.showScreen('screen-pause');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.session.paused = false;
      this.showScreen(null);
    }
  }

  disposeSession() {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    this.hud.hide();
  }

  // ---------------- main loop ----------------
  loop(tm) {
    requestAnimationFrame((tm2) => this.loop(tm2));
    const dt = Math.min(0.05, (tm - this.lastTime) / 1000);
    this.lastTime = tm;

    this.cutscenes.update();

    switch (this.state) {
      case 'title':
        if (this.input.pressed('Enter') || this.input.pressed('Space')) {
          Audio.init();
          Audio.sfx('select');
          this.gotoMenu();
        }
        break;
      case 'playing':
        if (this.input.pausePressed()) { this.togglePause(); break; }
        this.session.update(dt, this.input);
        if (this.session) this.renderer.render(this.session.scene, this.session.camera);
        break;
      case 'paused':
        if (this.input.pausePressed()) this.togglePause();
        if (this.session) this.renderer.render(this.session.scene, this.session.camera);
        break;
      default:
        break;
    }
    this.input.endFrame();
  }
}

new Game();
