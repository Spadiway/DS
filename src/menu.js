// Menús DOM: principal, selector de niveles, pausa y resultados.

import { t, getLang, setLang } from './i18n.js';
import { LEVELS } from './levels.js';
import { sfx } from './audio.js';

export class Menus {
  constructor(game) {
    this.game = game;
    this.menu = document.getElementById('menu');
    this.levelSelect = document.getElementById('level-select');
    this.pause = document.getElementById('pause-menu');
    this.results = document.getElementById('results');
  }

  hideAll() {
    for (const el of [this.menu, this.levelSelect, this.pause, this.results]) {
      el.classList.add('hidden');
    }
  }

  btn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'menu-btn';
    b.textContent = label;
    b.addEventListener('click', () => { sfx.select(); onClick(); });
    return b;
  }

  showMain() {
    this.hideAll();
    this.menu.classList.remove('hidden');
    document.getElementById('menu-subtitle').textContent = t('subtitle');
    document.getElementById('menu-footer').textContent = t('footer');

    const box = document.getElementById('menu-buttons');
    box.innerHTML = '';
    const save = this.game.save;
    const hasProgress = save.unlockedLevel > 0 || Object.keys(save.levelCaptures).length > 0;

    if (hasProgress) {
      box.appendChild(this.btn(t('continue'), () => this.game.startLevel(save.unlockedLevel)));
      box.appendChild(this.btn(t('levelSelect'), () => this.showLevelSelect()));
      box.appendChild(this.btn(t('newGame'), () => { this.game.newGame(); this.showMain(); }));
    } else {
      box.appendChild(this.btn(t('play'), () => this.game.startLevel(0)));
    }
    box.appendChild(this.btn(t('language'), () => {
      const next = getLang() === 'es' ? 'en' : 'es';
      setLang(next);
      this.game.save.lang = next;
      this.game.persist();
      this.showMain();
    }));
  }

  showLevelSelect() {
    this.hideAll();
    this.levelSelect.classList.remove('hidden');
    document.getElementById('ls-title').textContent = t('levelSelectTitle');

    const grid = document.getElementById('ls-grid');
    grid.innerHTML = '';
    const save = this.game.save;

    LEVELS.forEach((lv, i) => {
      const unlocked = i <= save.unlockedLevel;
      const card = document.createElement('div');
      card.className = 'ls-card' + (unlocked ? '' : ' locked');
      const best = save.levelCaptures[lv.id] ?? 0;
      const total = lv.pets.length;
      card.innerHTML = `
        <div class="icon">${unlocked ? lv.icon : '🔒'}</div>
        <div class="world">${lv.worldName[getLang()]}</div>
        <div class="name">${unlocked ? lv.name[getLang()] : t('locked')}</div>
        <div class="prog">${unlocked ? (lv.boss ? '👑' : `${t('captures')}: ${best}/${total}`) : ''}</div>
      `;
      if (unlocked) card.addEventListener('click', () => { sfx.select(); this.game.startLevel(i); });
      grid.appendChild(card);
    });

    document.getElementById('ls-stats').textContent = `${t('totalCaptured')}: ${save.totalCaptured}`;
    const back = document.getElementById('ls-back');
    back.textContent = t('back');
    back.onclick = () => { sfx.select(); this.showMain(); };
  }

  showPause() {
    this.pause.classList.remove('hidden');
    document.getElementById('pause-title').textContent = t('paused');
    const box = document.getElementById('pause-buttons');
    box.innerHTML = '';
    box.appendChild(this.btn(t('resume'), () => this.game.togglePause()));
    box.appendChild(this.btn(t('restart'), () => { this.game.togglePause(); this.game.startLevel(this.game.levelIndex); }));
    box.appendChild(this.btn(t('quitToMenu'), () => { this.game.togglePause(); this.game.quitToMenu(); }));
  }

  hidePause() { this.pause.classList.add('hidden'); }

  // body: texto multilínea · onContinue: callback del botón
  showResults(title, body, onContinue) {
    this.hideAll();
    this.results.classList.remove('hidden');
    document.getElementById('results-title').textContent = title;
    document.getElementById('results-body').textContent = body;
    const btn = document.getElementById('results-continue');
    btn.textContent = t('pressContinue');
    btn.onclick = () => { sfx.select(); onContinue(); };
  }
}
