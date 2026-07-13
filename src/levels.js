// Definición de niveles: 8 mundos temáticos originales del universo Benito Escape.
// Cada nivel es data pura; game.js construye la escena a partir de esto.
// pets: [tipo, x, z] · platforms: [x, y, z, w, h, d] · cookies: [x, y, z]

export const LEVELS = [
  {
    id: 'valle-jurasico',
    world: 1,
    icon: '🦕',
    name: { es: 'Valle Jurásico', en: 'Jurassic Valley' },
    worldName: { es: 'La Era Perdida', en: 'The Lost Era' },
    theme: 'prehistoric',
    music: 'prehistoric',
    sky: 0xffb35c, fog: 0xffc98a, ground: 0x7dab4a,
    size: 46,
    required: 4,
    platforms: [
      [8, 1, -6, 5, 2, 5], [14, 2.2, -10, 4, 2, 4], [-10, 1.2, 8, 6, 2.4, 6],
      [0, 1, -14, 7, 2, 4], [-14, 1.6, -4, 4, 3.2, 4]
    ],
    trees: 14, rocks: 8,
    pets: [
      ['yellow', 6, 4], ['yellow', -8, -6], ['yellow', 12, -9.5],
      ['blue', -12, 10], ['red', 2, -13.5], ['yellow', -16, 2]
    ],
    cookies: [[4, 0.5, -4], [-6, 0.5, 6], [14, 3.7, -10], [-14, 3.7, -4], [10, 0.5, 10]],
    unlockGadget: null,
    intro: [
      ['prof', { es: '¡Benito! La máquina temporal te dejó en la era de los dinosaurios. Deedee ya soltó mascotas con casco por todo el valle.', en: 'Benito! The time machine dropped you in the dinosaur era. Deedee already released helmeted pets all over the valley.' }],
      ['benito', { es: '¿Dinosaurios? ¡Yo solo quería mi siesta de las 14:00...!', en: 'Dinosaurs? I just wanted my 2 PM nap...!' }],
      ['prof', { es: 'Usa la Red Atrapamascotas con [J]. Acércate sin que te vean: ¡mira la luz de su casco!', en: 'Use the Pet-Catcher Net with [J]. Sneak up unseen: watch their helmet light!' }]
    ]
  },
  {
    id: 'ruinas-selvaticas',
    world: 2,
    icon: '🌿',
    name: { es: 'Ruinas Selváticas', en: 'Jungle Ruins' },
    worldName: { es: 'La Edad Misteriosa', en: 'The Mysterious Age' },
    theme: 'jungle',
    music: 'jungle',
    sky: 0x77c4a0, fog: 0x8fd4b4, ground: 0x3e7d3a,
    size: 50,
    required: 5,
    platforms: [
      [10, 1.4, 6, 5, 2.8, 5], [16, 2.6, 0, 4, 2, 4], [-8, 1, -10, 6, 2, 6],
      [-16, 2, -2, 4, 4, 4], [0, 1.2, 14, 8, 2.4, 5], [6, 2.8, 18, 4, 2, 4]
    ],
    trees: 22, rocks: 10,
    pets: [
      ['yellow', 8, -4], ['blue', -10, 12], ['red', 16, 1], ['red', -6, -9],
      ['white', 0, 15], ['yellow', -18, -14], ['blue', 14, 14]
    ],
    cookies: [[6, 0.5, 0], [-12, 0.5, 4], [16, 4.1, 0], [0, 2.9, 14], [-18, 0.5, 10], [10, 0.5, -14]],
    unlockGadget: 'baton',
    intro: [
      ['prof', { es: 'Estas ruinas esconden trampas. ¡Te envío el Bastón Chispa! Pulsa [K] para aturdir mascotas alborotadas.', en: 'These ruins hide traps. I am sending you the Spark Baton! Press [K] to stun rowdy pets.' }],
      ['silva', { es: 'Miau... el gato gordo llegó lejos. Deedee no estará contento. Yo sí: me divierte verte sufrir.', en: 'Meow... the chubby cat made it far. Deedee will not be pleased. I am: watching you struggle amuses me.' }],
      ['benito', { es: '¡Silva! Cuando esto acabe, ¿me devuelves mi rascador? Era edición limitada.', en: 'Silva! When this is over, can I have my scratching post back? It was limited edition.' }]
    ]
  },
  {
    id: 'bahia-coral',
    world: 3,
    icon: '🏝️',
    name: { es: 'Bahía Coral', en: 'Coral Bay' },
    worldName: { es: 'Oceana Primitiva', en: 'Primitive Oceana' },
    theme: 'beach',
    music: 'beach',
    sky: 0x6fd2f5, fog: 0xa8e6ff, ground: 0xf0dc9a,
    size: 52,
    required: 5,
    platforms: [
      [12, 1, 8, 6, 2, 6], [-14, 1.4, -8, 5, 2.8, 5], [0, 1, -16, 8, 2, 5],
      [18, 2.4, -2, 4, 2, 4], [-6, 1.8, 14, 5, 3.6, 5]
    ],
    trees: 12, rocks: 14,
    pets: [
      ['yellow', 10, -6], ['blue', -12, 10], ['blue', 18, -1], ['white', -14, -6.5],
      ['red', 0, -15], ['yellow', 16, 14], ['green', -4, 15]
    ],
    cookies: [[8, 0.5, 2], [-10, 0.5, -2], [18, 3.9, -2], [-6, 4.1, 14], [0, 0.5, 18], [-18, 0.5, 14]],
    unlockGadget: 'hoop',
    intro: [
      ['prof', { es: '¡Playa a la vista! Toma el Aro Turbo: mantén [Shift] para correr como un rayo peludo.', en: 'Beach ahoy! Take the Turbo Hoop: hold [Shift] to run like a furry lightning bolt.' }],
      ['benito', { es: 'Arena... en mis almohadillas... Este trabajo necesita mejor sindicato.', en: 'Sand... in my paw pads... This job needs a better union.' }]
    ]
  },
  {
    id: 'tundra-brillante',
    world: 4,
    icon: '❄️',
    name: { es: 'Tundra Brillante', en: 'Glimmer Tundra' },
    worldName: { es: 'La Gran Helada', en: 'The Big Freeze' },
    theme: 'ice',
    music: 'ice',
    sky: 0xbfe8ff, fog: 0xdff2ff, ground: 0xeaf6ff,
    size: 50,
    required: 6,
    slippery: true,
    platforms: [
      [10, 1.2, -8, 5, 2.4, 5], [-12, 1, 6, 6, 2, 6], [2, 2, 14, 4, 4, 4],
      [-4, 1, -14, 7, 2, 4], [16, 2.2, 4, 4, 2, 4], [-18, 1.8, -6, 4, 3.6, 4]
    ],
    trees: 16, rocks: 12,
    pets: [
      ['yellow', 8, 6], ['white', -10, 8], ['white', 14, -8], ['blue', 2, 16],
      ['red', -4, -13], ['green', 16, 6], ['yellow', -18, -3], ['blue', -14, -12]
    ],
    cookies: [[6, 0.5, -2], [-8, 0.5, 2], [2, 4.5, 14], [16, 3.7, 4], [-18, 4.1, -6], [10, 0.5, 12]],
    unlockGadget: null,
    intro: [
      ['prof', { es: '¡Cuidado, Benito! El hielo es resbaladizo: frena con tiempo o patinarás hasta el año 3000.', en: 'Careful, Benito! The ice is slippery: brake early or you will skate into year 3000.' }],
      ['benito', { es: 'Frío. Odio el frío. Mi pancita no está aislada para esto.', en: 'Cold. I hate cold. My belly is not insulated for this.' }]
    ]
  },
  {
    id: 'castillo-crepusculo',
    world: 5,
    icon: '🏯',
    name: { es: 'Castillo Crepúsculo', en: 'Twilight Castle' },
    worldName: { es: 'Tiempos Medievales', en: 'Medieval Times' },
    theme: 'medieval',
    music: 'medieval',
    sky: 0xc48ae0, fog: 0xd8aae8, ground: 0x6a8a4a,
    size: 48,
    required: 6,
    platforms: [
      [0, 2, -12, 10, 4, 6], [0, 4.4, -12, 6, 0.8, 4], [-12, 1.4, 4, 5, 2.8, 5],
      [12, 1.4, 4, 5, 2.8, 5], [0, 1, 12, 6, 2, 6], [-16, 2.4, -10, 4, 2, 4], [16, 2.4, -10, 4, 2, 4]
    ],
    trees: 10, rocks: 8,
    pets: [
      ['red', 0, -10], ['red', -12, 6], ['white', 12, 6], ['yellow', 0, 14],
      ['green', 0, -8], ['blue', -16, -8], ['blue', 16, -8], ['yellow', 8, -16]
    ],
    cookies: [[0, 5.3, -12], [-12, 3.3, 4], [12, 3.3, 4], [0, 0.5, 8], [-16, 3.9, -10], [16, 3.9, -10]],
    unlockGadget: 'radar',
    intro: [
      ['prof', { es: 'Nuevo invento: ¡el Radar Bigotes! Pulsa [R] y verás a las mascotas en el círculo verde.', en: 'New invention: the Whisker Radar! Press [R] and pets will appear on the green circle.' }],
      ['deedee', { es: '¡BENITO! ¿Sigues aquí? ¡Yo ya reescribí tres siglos! Los perros ya inventaron la catapulta lanza-gatos. JA-JA.', en: 'BENITO! Still here? I already rewrote three centuries! Dogs invented the cat-launching catapult. HA-HA.' }],
      ['benito', { es: 'Eso... explica muchas cosas de camino aquí.', en: 'That... explains a lot about my trip here.' }]
    ]
  },
  {
    id: 'metropolis-neon',
    world: 6,
    icon: '🌆',
    name: { es: 'Metrópolis Neón', en: 'Neon Metropolis' },
    worldName: { es: 'El Presente Robado', en: 'The Stolen Present' },
    theme: 'future',
    music: 'future',
    sky: 0x1a1440, fog: 0x2a2060, ground: 0x3a3a52,
    size: 52,
    required: 7,
    platforms: [
      [10, 2, -6, 4, 4, 4], [16, 3.5, -12, 4, 7, 4], [-10, 2, 8, 4, 4, 4],
      [-16, 3, 14, 4, 6, 4], [0, 1.6, -16, 8, 3.2, 5], [-6, 2.5, -6, 3, 5, 3], [6, 1.4, 12, 5, 2.8, 5]
    ],
    trees: 8, rocks: 6,
    pets: [
      ['green', 10, -4], ['green', -10, 10], ['red', 0, -14], ['white', 16, -10],
      ['white', -16, 16], ['blue', 6, 14], ['blue', -4, -18], ['yellow', 18, 8], ['red', -18, -8]
    ],
    cookies: [[10, 4.5, -6], [-10, 4.5, 8], [16, 7.5, -12], [0, 3.7, -16], [6, 3.3, 12], [-16, 6.5, 14], [0, 0.5, 4]],
    unlockGadget: null,
    intro: [
      ['prof', { es: 'La ciudad del presente... convertida en fábrica de cascos. Las mascotas verdes disparan: ¡esquiva y acércate en zigzag!', en: 'The present-day city... turned into a helmet factory. Green pets shoot: dodge and zigzag closer!' }],
      ['silva', { es: 'Impresionante, bola de pelo. Pero Deedee ya casi termina su Casco Supremo. Ríndete y te dejaremos un cojín.', en: 'Impressive, furball. But Deedee is nearly done with his Supreme Helmet. Surrender and we will spare you a cushion.' }],
      ['benito', { es: '¿Qué tipo de cojín? ...¡NO! ¡Concéntrate, Benito!', en: 'What kind of cushion? ...NO! Focus, Benito!' }]
    ]
  },
  {
    id: 'dimension-onirica',
    world: 7,
    icon: '🌀',
    name: { es: 'Dimensión Onírica', en: 'Dreamscape Dimension' },
    worldName: { es: 'El Mundo de Deedee', en: "Deedee's World" },
    theme: 'finale',
    music: 'finale',
    sky: 0x30105a, fog: 0x50208a, ground: 0x7a5aba,
    size: 46,
    required: 8,
    platforms: [
      [0, 2, 0, 6, 4, 6], [10, 3, -10, 4, 6, 4], [-10, 3, -10, 4, 6, 4],
      [10, 3, 10, 4, 6, 4], [-10, 3, 10, 4, 6, 4], [0, 4, -16, 5, 8, 4], [0, 1.4, 16, 6, 2.8, 5]
    ],
    trees: 12, rocks: 10,
    pets: [
      ['white', 0, 2], ['red', 10, -8], ['red', -10, -8], ['green', 10, 12],
      ['green', -10, 12], ['blue', 0, -14], ['blue', 16, 0], ['white', -16, 0],
      ['yellow', 0, 18], ['red', -16, -16]
    ],
    cookies: [[0, 4.5, 0], [10, 6.5, -10], [-10, 6.5, -10], [0, 8.5, -16], [0, 3.9, 16], [16, 0.5, 8], [-16, 0.5, 8]],
    unlockGadget: null,
    intro: [
      ['prof', { es: 'Esta dimensión la creó el casco de Deedee con sus sueños... Colores invertidos, gravedad rara. ¡Su guarida está cerca!', en: "Deedee's helmet built this dimension from his dreams... Inverted colors, weird gravity. His lair is close!" }],
      ['silva', { es: 'Hasta aquí llegaste. Yo protejo este mundo. No es nada personal... bueno, sí, un poco sí.', en: 'This is where you stop. I guard this world. Nothing personal... well, maybe a little personal.' }],
      ['benito', { es: 'Silva, aún puedes cambiar de bando. Tenemos galletas.', en: 'Silva, you can still switch sides. We have cookies.' }]
    ]
  },
  {
    id: 'fortaleza-deedee',
    world: 8,
    icon: '👑',
    name: { es: 'Fortaleza de Deedee', en: "Deedee's Fortress" },
    worldName: { es: 'Batalla Final', en: 'Final Battle' },
    theme: 'finale',
    music: 'finale',
    sky: 0x180830, fog: 0x301050, ground: 0x4a3a6a,
    size: 36,
    required: 0,
    boss: true,
    platforms: [
      [10, 1.5, 0, 4, 3, 4], [-10, 1.5, 0, 4, 3, 4], [0, 1.5, 10, 4, 3, 4], [0, 1.5, -10, 4, 3, 4]
    ],
    trees: 0, rocks: 6,
    pets: [],
    cookies: [[10, 3.5, 0], [-10, 3.5, 0], [0, 3.5, 10], [0, 3.5, -10]],
    unlockGadget: null,
    intro: [
      ['deedee', { es: '¡BIENVENIDO, BENITO! Contempla mi trono flotante. Antes era la mascota enjaulada de un parque... ¡AHORA LA HISTORIA ES MI JAULA PARA USTEDES!', en: 'WELCOME, BENITO! Behold my floating throne. I used to be a caged park pet... NOW HISTORY IS MY CAGE FOR ALL OF YOU!' }],
      ['benito', { es: 'Deedee... sé que te trataron mal. Pero ¡esto no arregla nada! Baja de ahí y hablemos con galletas.', en: 'Deedee... I know they treated you badly. But this fixes nothing! Come down and let us talk over cookies.' }],
      ['deedee', { es: '¿GALLETAS? ¡JA! ¡Mi lengua ya no conoce la piedad! ¡GUARDIAS!', en: 'COOKIES? HA! My tongue knows no mercy anymore! GUARDS!' }],
      ['prof', { es: '¡Benito! Su casco lo protege, pero se recalienta cuando embiste. ¡Golpéalo con la red justo después de que cargue!', en: 'Benito! His helmet shields him, but it overheats when he charges. Whack him with the net right after he rams!' }]
    ],
    outro: [
      ['deedee', { es: 'Mi casco... roto... ¿Qué... qué he hecho? Yo solo... no quería volver a la jaula...', en: 'My helmet... broken... What... what have I done? I just... did not want to go back to the cage...' }],
      ['benito', { es: 'Nadie volverá a enjaularte, pequeño. Te lo promete el gato más gordo del multiverso.', en: 'No one will cage you again, little guy. The chubbiest cat in the multiverse promises.' }],
      ['prof', { es: 'La máquina temporal está reparada. Volvamos todos a casa... incluido Deedee. Su viejo cuidador pregunta por él cada día.', en: 'The time machine is fixed. Let us all go home... Deedee included. His old caretaker asks about him every day.' }]
    ]
  }
];

export function getLevel(idx) { return LEVELS[idx]; }
