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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
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

  // ---------------- world map ----------------
  gotoMap() {
    this.disposeSession();
    this.state = 'map';
    Audio.startMusic('title');
    recountTotal(this.save);
    el('map-stats').textContent = t('totalCaught', { n: this.save.totalCaptured });

    const list = el('world-list');
    list.innerHTML = '';
    for (const world of WORLDS) {
      const card = document.createElement('div');
      card.className = 'world-card' + (world.available ? '' : ' locked');
      const title = document.createElement('div');
      title.className = 'world-title';
      const num = document.createElement('span');
      num.className = 'wnum';
      num.textContent = String(world.id);
      title.appendChild(num);
      title.appendChild(document.createTextNode(t(world.nameKey)));
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
      list.appendChild(card);
    }
    this.showScreen('screen-map');
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
