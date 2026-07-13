// Punto de entrada: crea el juego y arranca la música del menú tras la
// primera interacción del usuario (requisito de los navegadores).

import { Game } from './game.js';
import { playMusic, unlockAudio } from './audio.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

let musicStarted = false;
function startMenuMusic() {
  if (musicStarted) return;
  musicStarted = true;
  unlockAudio();
  playMusic('menu');
}
window.addEventListener('pointerdown', startMenuMusic, { once: true });
window.addEventListener('keydown', startMenuMusic, { once: true });

// referencia global para depuración en consola
window.__benito = game;
