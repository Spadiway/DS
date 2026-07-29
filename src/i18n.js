// ===== BENITO ESCAPE — i18n (ES default / EN) =====
// All text is original writing for this fan-inspired project.

const STR = {
  es: {
    subtitle: 'El Juego de Mascotas',
    pressStart: 'PULSA ENTER',
    mainMenu: 'Menú Principal',
    newGame: 'Nueva partida',
    continueGame: 'Continuar',
    options: 'Idioma: Español',
    back: 'Volver',
    backToMenu: 'Menú principal',
    chooseSlot: 'Elige ranura',
    emptySlot: 'Ranura vacía — ¡empezar aquí!',
    slot: 'Ranura',
    deleteSlot: 'Borrar',
    slotMeta: '{caught} mascotas · {done}/{total} niveles',
    worldMap: 'Mapa de Épocas',
    mapHint: 'Toca una isla para ver sus niveles',
    totalCaught: 'Mascotas capturadas: {n}',
    locked: 'Bloqueado',
    comingSoon: 'Próximamente en la siguiente fase…',
    completeToUnlock: 'Completa el nivel anterior para desbloquear',
    play: 'Jugar',
    levelClear: '¡Nivel superado!',
    resCaptures: 'Mascotas capturadas',
    resTime: 'Tiempo',
    resCookies: 'Galletas recogidas',
    resGadget: '¡Gadget nuevo!',
    continue: 'Continuar',
    paused: 'Pausa',
    resume: 'Reanudar',
    restart: 'Reiniciar nivel',
    exitToMap: 'Salir al mapa',
    langToggle: 'Language: English',
    musicOn: 'Música: Sí',
    musicOff: 'Música: No',
    gfxHigh: 'Gráficos: Altos',
    gfxLow: 'Gráficos: Bajos',
    gameOver: 'Fin de la partida',
    gameOverText: 'Las mascotas se han salido con la suya… ¡por ahora!',
    backToMap: 'Volver al mapa',
    advanceHint: 'ENTER / clic para continuar',
    skip: 'Saltar »',
    // Worlds (thematic eras, original names)
    w1: 'La Tierra Perdida', w2: 'La Era Misteriosa', w3: 'Oceana',
    w4: 'Tierra de Hielo', w5: 'Época Medieval', w6: 'Metrópolis',
    w7: 'Dimensión Deedee', w8: 'Fortaleza Final',
    // World 1 levels (original names)
    'l1-1': 'Pradera de los Huesos',
    'l1-2': 'Ciénaga Burbujeante',
    'l1-3': 'Cañón de Lava',
    // Gadgets (original names)
    gadget_net: 'Red Temporal',
    gadget_waternet: 'Red Acuática',
    gadget_club: 'Porra Aturdidora',
    gadget_net_desc: 'Captura mascotas de un buen redazo.',
    gadget_waternet_desc: '¡Ahora puedes atrapar mascotas dentro del agua!',
    // HUD / in-game
    capturesLabel: '{c}/{r}',
    needMore: '¡Captura {n} mascotas más para abrir el portal!',
    portalOpen: '¡El portal temporal está abierto!',
    checkpoint: '¡Punto de control!',
    caught: '¡Mascota capturada!',
    caughtBoss: '¡¡Capitán Colmillo capturado!!',
    waterBlocked: '¡Necesitas la Red Acuática para pescar aquí!',
    gotWaterNet: '¡Has conseguido la RED ACUÁTICA!',
    fellDown: '¡Cuidado con la lava!',
    lifeLost: '¡Has perdido una vida!',
    bossWarning: '¡¡CAPITÁN COLMILLO te ha visto!!',
    bossDizzy: '¡Está mareado! ¡Dale con la red!',
    demoEnd: 'FIN DE LA FASE 1 — ¡Continuará!',
    tutMove: 'Muévete con WASD / flechas. Salta con ESPACIO.',
    tutNet: 'Pulsa J (o clic) para lanzar la Red Temporal.',
    tutSneak: 'Mantén SHIFT para acercarte sigilosamente.',
    tutCam: 'Gira la cámara con Q y E.',
  },
  en: {
    subtitle: 'The Pet Chase Game',
    pressStart: 'PRESS ENTER',
    mainMenu: 'Main Menu',
    newGame: 'New game',
    continueGame: 'Continue',
    options: 'Language: Spanish',
    back: 'Back',
    backToMenu: 'Main menu',
    chooseSlot: 'Choose a slot',
    emptySlot: 'Empty slot — start here!',
    slot: 'Slot',
    deleteSlot: 'Delete',
    slotMeta: '{caught} pets · {done}/{total} levels',
    worldMap: 'Era Map',
    mapHint: 'Tap an island to see its levels',
    totalCaught: 'Pets captured: {n}',
    locked: 'Locked',
    comingSoon: 'Coming in the next phase…',
    completeToUnlock: 'Beat the previous level to unlock',
    play: 'Play',
    levelClear: 'Level clear!',
    resCaptures: 'Pets captured',
    resTime: 'Time',
    resCookies: 'Cookies collected',
    resGadget: 'New gadget!',
    continue: 'Continue',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart level',
    exitToMap: 'Exit to map',
    langToggle: 'Idioma: Español',
    musicOn: 'Music: On',
    musicOff: 'Music: Off',
    gfxHigh: 'Graphics: High',
    gfxLow: 'Graphics: Low',
    gameOver: 'Game over',
    gameOverText: 'The pets got away with it… for now!',
    backToMap: 'Back to map',
    advanceHint: 'ENTER / click to continue',
    skip: 'Skip »',
    w1: 'The Lost Land', w2: 'The Cryptic Era', w3: 'Oceana',
    w4: 'Frozen Realm', w5: 'Medieval Times', w6: 'Metropolis',
    w7: 'Deedee Dimension', w8: 'Final Fortress',
    'l1-1': 'Bone Meadow',
    'l1-2': 'Bubbling Bog',
    'l1-3': 'Lava Canyon',
    gadget_net: 'Time Snare',
    gadget_waternet: 'Aqua Snare',
    gadget_club: 'Stun Baton',
    gadget_net_desc: 'Capture pets with one good swing.',
    gadget_waternet_desc: 'Now you can catch pets underwater!',
    capturesLabel: '{c}/{r}',
    needMore: 'Capture {n} more pets to open the portal!',
    portalOpen: 'The time portal is open!',
    checkpoint: 'Checkpoint!',
    caught: 'Pet captured!',
    caughtBoss: 'Captain Fang captured!!',
    waterBlocked: 'You need the Aqua Snare to fish here!',
    gotWaterNet: 'You got the AQUA SNARE!',
    fellDown: 'Watch out for the lava!',
    lifeLost: 'You lost a life!',
    bossWarning: 'CAPTAIN FANG has spotted you!!',
    bossDizzy: "He's dizzy! Swing the net!",
    demoEnd: 'END OF PHASE 1 — To be continued!',
    tutMove: 'Move with WASD / arrows. Jump with SPACE.',
    tutNet: 'Press J (or click) to swing the Time Snare.',
    tutSneak: 'Hold SHIFT to sneak up on pets.',
    tutCam: 'Rotate the camera with Q and E.',
  },
};

// -------- Cutscene scripts (original writing) --------
export const SCENES = {
  es: {
    opening: {
      backdrop: 'lab',
      lines: [
        { who: 'prof',   text: '¡Benito! Llegas justo a tiempo. Mira mi último invento: ¡la Máquina Temporal de Patas!' },
        { who: 'benito', text: '¿Sirve para viajar a la hora de la merienda? Porque tengo un hambre prehistórica…' },
        { who: 'prof',   text: '¡No toques nada! Este otro prototipo es el Casco de Potencia Canina. Aún es… inestable.' },
        { who: 'deedee', text: '¡Bla, bla, bla! ¡Este casco es MÍO, y esta máquina también! ¡El mundo será de las mascotas!' },
        { who: 'benito', text: '¡¿Deedee?! ¿El chihuahua del parque? ¡Pero si te saqué una espina de la pata el martes!' },
        { who: 'silva',  text: 'El amo Deedee ya no necesita tu lástima, bola de pelo. Silva se encargará de ti.' },
        { who: 'deedee', text: '¡Mascotas, al ataque! ¡Nos vamos de paseo por la HISTORIA! ¡Mua-ja-ja-ja!' },
        { who: 'narrator', text: 'La máquina se descontrola… ¡y arrastra a todos a través del tiempo!' },
      ],
    },
    world1: {
      backdrop: 'prehistoric',
      lines: [
        { who: 'prof',   text: '¿Benito? ¿Me recibes? ¡Has aterrizado en la era prehistórica!' },
        { who: 'benito', text: 'Recibido. Aquí todo es enorme… menos yo, que sigo siendo ancho.' },
        { who: 'prof',   text: 'Deedee ha soltado mascotas con casco por toda la zona. ¡Usa la Red Temporal para capturarlas!' },
      ],
    },
    waternet: {
      backdrop: 'prehistoric',
      lines: [
        { who: 'prof',   text: '¡Te envío un regalo por el teletransportador: la RED ACUÁTICA!' },
        { who: 'benito', text: '¿Mojarme? Bueno… por la humanidad. Y por las galletas.' },
      ],
    },
    bossIntro: {
      backdrop: 'prehistoric',
      lines: [
        { who: 'silva',  text: 'Hasta aquí llegaste, Benito. Te presento al guardián del cañón: ¡CAPITÁN COLMILLO!' },
        { who: 'benito', text: '…Ese bulldog tiene un casco del tamaño de mi nevera.' },
        { who: 'silva',  text: 'Cuando embista, más te vale apartarte. Nos vemos… si sobrevives. Miau.' },
      ],
    },
    bossOutro: {
      backdrop: 'evil',
      lines: [
        { who: 'deedee', text: '¡¿COLMILLO CAPTURADO?! ¡Inútiles! ¡Todos son unos inútiles!' },
        { who: 'deedee', text: 'Disfruta tu victoria, gato gordo. La siguiente época será tu PERDICIÓN. ¡Blegh!' },
        { who: 'benito', text: '¿Acaba de hacerme una pedorreta con la lengua fuera?' },
        { who: 'narrator', text: 'FIN DE LA FASE 1 — La persecución continuará en La Era Misteriosa…' },
      ],
    },
  },
  en: {
    opening: {
      backdrop: 'lab',
      lines: [
        { who: 'prof',   text: 'Benito! Right on time. Behold my latest invention: the Paw-Powered Time Machine!' },
        { who: 'benito', text: 'Can it travel to snack time? Because I am prehistorically hungry…' },
        { who: 'prof',   text: "Don't touch anything! This other prototype is the Canine Power Helmet. It's still… unstable." },
        { who: 'deedee', text: 'Blah, blah, blah! That helmet is MINE, and so is the machine! The world will belong to the pets!' },
        { who: 'benito', text: 'Deedee?! The chihuahua from the park? I pulled a thorn out of your paw on Tuesday!' },
        { who: 'silva',  text: 'Master Deedee no longer needs your pity, furball. Silva will deal with you.' },
        { who: 'deedee', text: 'Pets, attack! We are taking a stroll through HISTORY! Mwa-ha-ha-ha!' },
        { who: 'narrator', text: 'The machine goes haywire… and drags everyone through time!' },
      ],
    },
    world1: {
      backdrop: 'prehistoric',
      lines: [
        { who: 'prof',   text: 'Benito? Do you copy? You landed in the prehistoric era!' },
        { who: 'benito', text: 'Copy that. Everything here is huge… except me. I remain merely wide.' },
        { who: 'prof',   text: 'Deedee released helmet-wearing pets all over the area. Use the Time Snare to capture them!' },
      ],
    },
    waternet: {
      backdrop: 'prehistoric',
      lines: [
        { who: 'prof',   text: "I'm beaming you a gift: the AQUA SNARE!" },
        { who: 'benito', text: 'Getting wet? Fine… for humanity. And for the cookies.' },
      ],
    },
    bossIntro: {
      backdrop: 'prehistoric',
      lines: [
        { who: 'silva',  text: 'This is as far as you go, Benito. Meet the guardian of the canyon: CAPTAIN FANG!' },
        { who: 'benito', text: '…That bulldog has a helmet the size of my fridge.' },
        { who: 'silva',  text: 'When he charges, you had better move. See you around… if you survive. Meow.' },
      ],
    },
    bossOutro: {
      backdrop: 'evil',
      lines: [
        { who: 'deedee', text: 'FANG GOT CAPTURED?! Useless! You are all useless!' },
        { who: 'deedee', text: 'Enjoy your little win, chunky cat. The next era will be your DOOM. Blegh!' },
        { who: 'benito', text: 'Did he just blow a raspberry at me with his tongue out?' },
        { who: 'narrator', text: 'END OF PHASE 1 — The chase continues in The Cryptic Era…' },
      ],
    },
  },
};

export const CHAR_NAMES = {
  es: { benito: 'Benito', deedee: 'Deedee', silva: 'Silva', prof: 'Profesor Miau', narrator: '· · ·' },
  en: { benito: 'Benito', deedee: 'Deedee', silva: 'Silva', prof: 'Professor Meow', narrator: '· · ·' },
};

let lang = localStorage.getItem('benitoLang') || 'es';

export function getLang() { return lang; }
export function setLang(l) {
  lang = l;
  localStorage.setItem('benitoLang', l);
  applyDomI18n();
}
export function toggleLang() { setLang(lang === 'es' ? 'en' : 'es'); }

export function t(key, vars) {
  let s = (STR[lang] && STR[lang][key]) ?? STR.es[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll('{' + k + '}', vars[k]);
  return s;
}

export function applyDomI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}
