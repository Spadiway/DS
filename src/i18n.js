// Textos EN/ES. Todo el contenido es original del universo "Benito Escape".

const STRINGS = {
  es: {
    subtitle: '¡El Juego de Mascotas!',
    play: 'JUGAR',
    continue: 'CONTINUAR',
    newGame: 'NUEVA PARTIDA',
    levelSelect: 'ELEGIR NIVEL',
    language: 'Idioma: Español',
    resume: 'REANUDAR',
    restart: 'REINICIAR NIVEL',
    quitToMenu: 'SALIR AL MENÚ',
    paused: 'PAUSA',
    back: 'VOLVER',
    footer: 'Un juego original de fans para fans. WASD mover · Espacio saltar · J red · K gadget · 1-4 elegir gadget',
    levelSelectTitle: 'MAPA TEMPORAL',
    totalCaptured: 'Mascotas capturadas en total',
    locked: 'BLOQUEADO',
    captures: 'Capturas',
    levelClear: '¡NIVEL COMPLETADO!',
    petsCaptured: 'Mascotas capturadas',
    timeUsed: 'Tiempo',
    gadgetUnlocked: '¡Nuevo gadget desbloqueado!',
    pressContinue: 'CONTINUAR',
    gameOver: 'FIN DEL JUEGO...',
    gameOverBody: 'Deedee sigue suelto por la historia.\n¡Inténtalo de nuevo, Benito!',
    goal: (n) => `¡Captura ${n} mascotas!`,
    remaining: (n) => `¡Quedan ${n} mascotas!`,
    portalOpen: '¡Portal temporal abierto!\nBusca el anillo dorado.',
    lifeLost: '¡Ay! Benito perdió una vida...',
    dialogHint: '[Enter] continuar · [Esc] saltar',
    theEnd: '¡FIN!',
    finaleBody: 'Deedee fue devuelto al parque de mascotas,\ndonde su antiguo cuidador lo espera con galletas.\n\n¡Gracias por jugar, héroe!',
    bossHits: (n) => `¡Golpea a Deedee con la red! (${n}/3)`,
    energyLow: '¡Energía baja! Busca galletas.',
    gadgets: {
      net: 'Red Atrapamascotas',
      baton: 'Bastón Chispa',
      hoop: 'Aro Turbo',
      radar: 'Radar Bigotes'
    },
    chars: {
      benito: 'Benito',
      deedee: 'Deedee',
      silva: 'Silva',
      prof: 'Profesor Miau'
    }
  },
  en: {
    subtitle: 'The Pet-Catching Game!',
    play: 'PLAY',
    continue: 'CONTINUE',
    newGame: 'NEW GAME',
    levelSelect: 'LEVEL SELECT',
    language: 'Language: English',
    resume: 'RESUME',
    restart: 'RESTART LEVEL',
    quitToMenu: 'QUIT TO MENU',
    paused: 'PAUSED',
    back: 'BACK',
    footer: 'An original fan-style game. WASD move · Space jump · J net · K gadget · 1-4 select gadget',
    levelSelectTitle: 'TIME MAP',
    totalCaptured: 'Total pets captured',
    locked: 'LOCKED',
    captures: 'Captures',
    levelClear: 'LEVEL CLEAR!',
    petsCaptured: 'Pets captured',
    timeUsed: 'Time',
    gadgetUnlocked: 'New gadget unlocked!',
    pressContinue: 'CONTINUE',
    gameOver: 'GAME OVER...',
    gameOverBody: 'Deedee is still loose in history.\nTry again, Benito!',
    goal: (n) => `Capture ${n} pets!`,
    remaining: (n) => `${n} pets left!`,
    portalOpen: 'Time portal open!\nFind the golden ring.',
    lifeLost: 'Ouch! Benito lost a life...',
    dialogHint: '[Enter] next · [Esc] skip',
    theEnd: 'THE END!',
    finaleBody: 'Deedee was returned to the pet park,\nwhere his old caretaker waits with cookies.\n\nThanks for playing, hero!',
    bossHits: (n) => `Whack Deedee with the net! (${n}/3)`,
    energyLow: 'Low energy! Find cookies.',
    gadgets: {
      net: 'Pet-Catcher Net',
      baton: 'Spark Baton',
      hoop: 'Turbo Hoop',
      radar: 'Whisker Radar'
    },
    chars: {
      benito: 'Benito',
      deedee: 'Deedee',
      silva: 'Silva',
      prof: 'Professor Meow'
    }
  }
};

let current = 'es';

export function setLang(lang) { current = STRINGS[lang] ? lang : 'es'; }
export function getLang() { return current; }
export function t(key) {
  const parts = key.split('.');
  let node = STRINGS[current];
  for (const p of parts) node = node?.[p];
  return node ?? key;
}
