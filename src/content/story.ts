/**
 * Guion completo: cinemáticas de apertura, entre mundos, jefes y final.
 * Cada "beat" es una línea con hablante, texto bilingüe y un plano de cámara
 * que la escena cinemática interpreta (engine/cutscene.ts).
 */

export type Speaker = 'benito' | 'deedee' | 'silva' | 'professor' | 'narrator';

export type Shot =
  | 'lab'
  | 'benitoClose'
  | 'deedeeClose'
  | 'silvaClose'
  | 'professorClose'
  | 'wide'
  | 'tower'
  | 'timeMachine'
  | 'throne'
  | 'park'
  | 'sky';

export type Beat = {
  speaker: Speaker;
  es: string;
  en: string;
  shot: Shot;
};

export type Cutscene = {
  id: string;
  title: { es: string; en: string };
  beats: Beat[];
  music: string;
};

export const CUTSCENES: Record<string, Cutscene> = {
  opening: {
    id: 'opening',
    title: { es: 'Acto I · El Casco', en: 'Act I · The Helmet' },
    music: 'hub',
    beats: [
      {
        speaker: 'narrator',
        es: 'En el Parque de Mascotas de Villa Ronroneo vivía un chihuahua diminuto llamado Deedee.',
        en: 'In the Purrville Pet Park there lived a tiny chihuahua named Deedee.',
        shot: 'park',
      },
      {
        speaker: 'narrator',
        es: 'Era amable. Era pequeño. Y estaba muy, muy harto de que lo llamaran "monada".',
        en: 'He was kind. He was small. And he was very, very tired of being called "cutie".',
        shot: 'park',
      },
      {
        speaker: 'narrator',
        es: 'Hasta que una noche encontró un prototipo defectuoso: el Casco de Potencia Canina.',
        en: 'Until one night he found a faulty prototype: the Canine Power Helmet.',
        shot: 'deedeeClose',
      },
      {
        speaker: 'deedee',
        es: '¡JA! ¡Mi cerebro… es ENORME! ¡Trescientos por ciento de chihuahua!',
        en: 'HA! My brain… is HUGE! Three hundred percent chihuahua!',
        shot: 'deedeeClose',
      },
      {
        speaker: 'professor',
        es: '¡Benito! ¡Benito, despierta! Alguien ha entrado en el laboratorio.',
        en: 'Benito! Benito, wake up! Someone has broken into the lab.',
        shot: 'lab',
      },
      {
        speaker: 'benito',
        es: 'Estaba soñando con atún. ¿Es importante? …Vale, sí, es importante.',
        en: 'I was dreaming about tuna. Is this important? …Okay, yes, it is important.',
        shot: 'benitoClose',
      },
      {
        speaker: 'silva',
        es: 'Nadie se mueve. La Máquina Temporal de Patas viene con nosotros.',
        en: 'Nobody moves. The Paw Time Machine is coming with us.',
        shot: 'silvaClose',
      },
      {
        speaker: 'professor',
        es: '¡No! ¡Ese prototipo no está calibrado! ¡Si lo activáis, el tiempo se romperá!',
        en: 'No! That prototype is not calibrated! If you switch it on, time will tear!',
        shot: 'professorClose',
      },
      {
        speaker: 'deedee',
        es: 'Perfecto. Un mundo roto es un mundo que se puede volver a montar. A MI gusto.',
        en: 'Perfect. A broken world is a world you can rebuild. MY way.',
        shot: 'deedeeClose',
      },
      {
        speaker: 'narrator',
        es: 'La máquina rugió. El laboratorio se dobló como papel. Y todos cayeron a través del tiempo.',
        en: 'The machine roared. The lab folded like paper. And everyone fell through time.',
        shot: 'timeMachine',
      },
      {
        speaker: 'professor',
        es: '¡Benito! ¡Toma la Red Temporal! Captura a cada mascota con casco que encuentres.',
        en: 'Benito! Take the Time Net! Catch every helmeted pet you find.',
        shot: 'professorClose',
      },
      {
        speaker: 'benito',
        es: 'Red en mano. Michi en misión. ¿Qué podría salir mal?',
        en: 'Net in paw. Cat on a mission. What could possibly go wrong?',
        shot: 'benitoClose',
      },
    ],
  },

  world2: {
    id: 'world2',
    title: { es: 'La Era Misteriosa', en: 'The Mysterious Age' },
    music: 'w2',
    beats: [
      {
        speaker: 'professor',
        es: 'Estás en una era de templos. Deedee ha soltado mascotas aquí para reescribir la historia.',
        en: 'You are in an age of temples. Deedee has released pets here to rewrite history.',
        shot: 'wide',
      },
      {
        speaker: 'silva',
        es: 'Vaya, el gato gordo sabe saltar. Qué ternura. Deedee ni siquiera te considera una amenaza.',
        en: 'Well, the fat cat can jump. How adorable. Deedee does not even consider you a threat.',
        shot: 'silvaClose',
      },
      {
        speaker: 'benito',
        es: 'Dile que la amenaza pesa nueve kilos y viene subiendo las escaleras.',
        en: 'Tell him the threat weighs twenty pounds and is coming up the stairs.',
        shot: 'benitoClose',
      },
    ],
  },

  world3: {
    id: 'world3',
    title: { es: 'Oceana', en: 'Oceana' },
    music: 'w3',
    beats: [
      {
        speaker: 'professor',
        es: 'Detecto una firma temporal enorme bajo el agua. Y… algo que respira. Algo grande.',
        en: 'I detect a huge temporal signature underwater. And… something breathing. Something big.',
        shot: 'wide',
      },
      {
        speaker: 'benito',
        es: '¿Cómo de grande, Profesor?',
        en: 'How big, Professor?',
        shot: 'benitoClose',
      },
      {
        speaker: 'professor',
        es: 'Del tamaño de "vas a explorarlo por dentro". Se llama Tragaldabas. Buena suerte.',
        en: 'The size of "you are going to explore it from the inside". It is called the Gobbler. Good luck.',
        shot: 'professorClose',
      },
    ],
  },

  world4: {
    id: 'world4',
    title: { es: 'Nueva Tierra de Hielo', en: 'New Freezeland' },
    music: 'w4',
    beats: [
      {
        speaker: 'deedee',
        es: 'Gato. GATO. Sí, tú, el redondo. He estado observándote desde mi torre.',
        en: 'Cat. CAT. Yes, you, the round one. I have been watching you from my tower.',
        shot: 'tower',
      },
      {
        speaker: 'deedee',
        es: 'Mira mi Casco Avanzado. Hecho a medida. Ya no soy una mascota: soy una ERA.',
        en: 'Behold my Advanced Helmet. Custom made. I am not a pet anymore: I am an ERA.',
        shot: 'deedeeClose',
      },
      {
        speaker: 'deedee',
        es: 'Ah, y una cosita más. ¿Recuerdas a tu amigo del laboratorio? Ahora es MI amigo.',
        en: 'Oh, and one more thing. Remember your friend from the lab? He is MY friend now.',
        shot: 'deedeeClose',
      },
      {
        speaker: 'benito',
        es: '…¿Qué le has hecho?',
        en: '…What did you do to him?',
        shot: 'benitoClose',
      },
      {
        speaker: 'deedee',
        es: 'Mejorarlo. Como haré con toda la historia. ¡Empezando por la Edad de Hielo!',
        en: 'Improved him. As I will improve all of history. Starting with the Ice Age!',
        shot: 'deedeeClose',
      },
    ],
  },

  world5: {
    id: 'world5',
    title: { es: 'Época Medieval', en: 'Medieval Mayhem' },
    music: 'w5',
    beats: [
      {
        speaker: 'professor',
        es: 'Las mascotas de Deedee están armando ejércitos en el pasado reciente. Si vencen aquí…',
        en: "Deedee's pets are raising armies in the recent past. If they win here…",
        shot: 'wide',
      },
      {
        speaker: 'professor',
        es: '…la historia entera pertenecerá a la raza canina. Y felina. Es complicado.',
        en: '…all of history belongs to dogkind. And catkind. It is complicated.',
        shot: 'professorClose',
      },
      {
        speaker: 'benito',
        es: 'Entonces capturo más rápido. Tengo hambre y eso me hace eficiente.',
        en: 'Then I catch faster. I am hungry, and that makes me efficient.',
        shot: 'benitoClose',
      },
    ],
  },

  world6: {
    id: 'world6',
    title: { es: 'Futurama', en: 'Futurama' },
    music: 'w6',
    beats: [
      {
        speaker: 'professor',
        es: 'Esta es tu época, Benito. O lo era. Mira la torre de antenas.',
        en: 'This is your own time, Benito. Or it was. Look at the antenna tower.',
        shot: 'tower',
      },
      {
        speaker: 'narrator',
        es: 'La ciudad estaba cubierta de pantallas. En todas ellas, la misma lengua fuera.',
        en: 'The city was covered in screens. On every one of them, the same tongue hanging out.',
        shot: 'tower',
      },
      {
        speaker: 'silva',
        es: 'Bienvenido a casa, Benito. Reformamos un poco. Espero que te guste el rosa.',
        en: 'Welcome home, Benito. We redecorated. Hope you like pink.',
        shot: 'silvaClose',
      },
    ],
  },

  world7: {
    id: 'world7',
    title: { es: 'El Reino Invertido', en: 'The Inverted Realm' },
    music: 'w7',
    beats: [
      {
        speaker: 'professor',
        es: 'Esto no es una época. Es un presente alternativo: el mundo si Deedee gana.',
        en: 'This is not an era. It is an alternate present: the world if Deedee wins.',
        shot: 'wide',
      },
      {
        speaker: 'silva',
        es: 'Y es precioso, ¿verdad? Aquí nadie nos mete en una jaula por la noche.',
        en: 'And it is beautiful, is it not? Here nobody puts us in a cage at night.',
        shot: 'silvaClose',
      },
      {
        speaker: 'benito',
        es: 'Silva… tú tampoco elegiste esto. Puedes bajarte del tren.',
        en: 'Silva… you did not choose this either. You can step off the train.',
        shot: 'benitoClose',
      },
      {
        speaker: 'silva',
        es: 'El tren es mío, gordito. Y tú estás en las vías.',
        en: 'The train is mine, chubby. And you are on the tracks.',
        shot: 'silvaClose',
      },
    ],
  },

  world8: {
    id: 'world8',
    title: { es: 'Acto III · Dimensión X', en: 'Act III · Dimension X' },
    music: 'w8',
    beats: [
      {
        speaker: 'narrator',
        es: 'La fortaleza flotaba sobre nada, sostenida solo por la testarudez de un chihuahua.',
        en: 'The fortress floated over nothing, held up only by one chihuahua’s stubbornness.',
        shot: 'throne',
      },
      {
        speaker: 'deedee',
        es: 'Has llegado. Ocho eras. Cientos de mascotas. Y sigues siendo un gato con una red.',
        en: 'You made it. Eight eras. Hundreds of pets. And you are still a cat with a net.',
        shot: 'throne',
      },
      {
        speaker: 'benito',
        es: 'Y tú sigues siendo un perro con un sombrero caro.',
        en: 'And you are still a dog in an expensive hat.',
        shot: 'benitoClose',
      },
      {
        speaker: 'deedee',
        es: '¡ES UN CASCO! …Da igual. ¿Sabes lo que había antes del casco, gato?',
        en: 'IT IS A HELMET! …Never mind. Do you know what came before the helmet, cat?',
        shot: 'deedeeClose',
      },
      {
        speaker: 'deedee',
        es: 'Una jaula. Y una mano que solo entraba para limpiarla. Nunca para acariciar.',
        en: 'A cage. And a hand that only reached in to clean it. Never to pet.',
        shot: 'deedeeClose',
      },
      {
        speaker: 'benito',
        es: 'Lo sé. Y lo siento de verdad. Pero eso no te da derecho a romper el tiempo.',
        en: 'I know. And I am truly sorry. But that does not let you break time.',
        shot: 'benitoClose',
      },
      {
        speaker: 'deedee',
        es: 'No quiero tu pena. ¡QUIERO EL SIGLO ENTERO! ¡Guardianes! ¡A él!',
        en: 'I do not want your pity. I WANT THE WHOLE CENTURY! Guardians! Get him!',
        shot: 'throne',
      },
    ],
  },

  ending: {
    id: 'ending',
    title: { es: 'Epílogo', en: 'Epilogue' },
    music: 'victory',
    beats: [
      {
        speaker: 'narrator',
        es: 'El Casco Avanzado se partió en dos y la Dimensión X se plegó sobre sí misma.',
        en: 'The Advanced Helmet split in two and Dimension X folded in on itself.',
        shot: 'throne',
      },
      {
        speaker: 'deedee',
        es: '…¿Qué? ¿Dónde está mi imperio? ¿Por qué todo… huele a serrín limpio?',
        en: '…What? Where is my empire? Why does everything… smell of clean sawdust?',
        shot: 'deedeeClose',
      },
      {
        speaker: 'professor',
        es: 'La Red Suprema deshizo el efecto. Volvió a ser lo que siempre fue: pequeño.',
        en: 'The Supreme Net undid the effect. He is what he always was: small.',
        shot: 'professorClose',
      },
      {
        speaker: 'benito',
        es: 'Pequeño no es lo mismo que solo. Profesor, ¿su antiguo cuidador sigue en el parque?',
        en: 'Small is not the same as alone. Professor, is his old keeper still at the park?',
        shot: 'benitoClose',
      },
      {
        speaker: 'narrator',
        es: 'Devolvieron a Deedee al Parque de Mascotas. Su cuidador lo estaba esperando.',
        en: 'They returned Deedee to the Pet Park. His keeper was waiting for him.',
        shot: 'park',
      },
      {
        speaker: 'narrator',
        es: 'Esta vez la mano entró en la jaula para acariciar. Y se quedó un buen rato.',
        en: 'This time the hand reached into the cage to pet him. And it stayed a good while.',
        shot: 'park',
      },
      {
        speaker: 'benito',
        es: 'Profesor… ¿ahora sí puedo desayunar?',
        en: 'Professor… can I have breakfast now?',
        shot: 'benitoClose',
      },
      {
        speaker: 'professor',
        es: 'Te has ganado el atún, Benito. Te lo has ganado ocho veces.',
        en: 'You earned the tuna, Benito. You earned it eight times over.',
        shot: 'professorClose',
      },
      { speaker: 'narrator', es: 'FIN', en: 'THE END', shot: 'sky' },
    ],
  },
};

/** Cinemática previa a cada jefe. */
export const BOSS_INTRO: Record<string, Beat[]> = {
  silva: [
    {
      speaker: 'silva',
      es: 'Hasta aquí has llegado, michi. Deedee me dio permiso para ensuciarme las garras.',
      en: 'This is as far as you go, kitty. Deedee gave me permission to get my claws dirty.',
      shot: 'silvaClose',
    },
    {
      speaker: 'benito',
      es: 'Yo tengo una red y muchísima paciencia. Adelante.',
      en: 'I have a net and a whole lot of patience. Go ahead.',
      shot: 'benitoClose',
    },
  ],
  guardian: [
    {
      speaker: 'professor',
      es: '¡Cuidado! ¡Es un Guardián de casco reforzado! Aturde primero, captura después.',
      en: 'Careful! It is a reinforced-helmet Guardian! Stun it first, catch it after.',
      shot: 'professorClose',
    },
  ],
  deedee: [
    {
      speaker: 'deedee',
      es: '¡Tres fases, gato! ¡Una por cada cien por cien de mi cerebro!',
      en: 'Three phases, cat! One for every hundred percent of my brain!',
      shot: 'throne',
    },
  ],
};

/** Líneas del comunicador durante el juego. */
export const COMMS: Record<string, { es: string; en: string; speaker: Speaker }> = {
  'comms.start': {
    speaker: 'professor',
    es: 'Benito, te oigo. Captura las mascotas necesarias y la puerta temporal se abrirá.',
    en: 'Benito, I read you. Catch the required pets and the time gate will open.',
  },
  'comms.alert': {
    speaker: 'professor',
    es: '¡Te han visto! Si el casco se pone rojo, huirán o atacarán.',
    en: 'They spotted you! If the helmet turns red, they will flee or attack.',
  },
  'comms.sneak': {
    speaker: 'professor',
    es: 'Agáchate para acercarte. Un gato gordo silencioso sigue siendo silencioso.',
    en: 'Crouch to get closer. A silent fat cat is still silent.',
  },
  'comms.gateOpen': {
    speaker: 'professor',
    es: '¡Puerta temporal abierta! Ve al portal cuando quieras. O captura más. Tú mandas.',
    en: 'Time gate open! Head for the portal whenever you want. Or catch more. Your call.',
  },
  'comms.lowHealth': {
    speaker: 'professor',
    es: '¡Estás muy tocado! Busca galletas para recuperar energía.',
    en: 'You are badly hurt! Find cookies to restore energy.',
  },
  'comms.waterNet': {
    speaker: 'professor',
    es: 'La Red de Agua ya funciona: nada, bucea y captura bajo la superficie.',
    en: 'The Water Net is online: swim, dive and catch below the surface.',
  },
  'comms.boss': {
    speaker: 'professor',
    es: '¡Firma de casco reforzado! Aturde primero, después la red.',
    en: 'Reinforced helmet signature! Stun first, then the net.',
  },
  'comms.deedeeTaunt1': {
    speaker: 'deedee',
    es: '¿Ya te cansaste, bola de pelo?',
    en: 'Tired already, furball?',
  },
  'comms.deedeeTaunt2': {
    speaker: 'deedee',
    es: '¡Mis mascotas te van a hacer un nudo en la cola!',
    en: 'My pets are going to tie your tail in a knot!',
  },
  'comms.silvaTaunt1': {
    speaker: 'silva',
    es: 'Corre, corre. Me divierte verte respirar así.',
    en: 'Run, run. I enjoy watching you breathe like that.',
  },
  'comms.benitoCatch1': { speaker: 'benito', es: '¡A la red y a dormir!', en: 'Into the net and off to bed!' },
  'comms.benitoCatch2': { speaker: 'benito', es: '¡Otra mascota reciclada!', en: 'Another pet recycled!' },
  'comms.benitoCatch3': { speaker: 'benito', es: '¡Esto se me da mejor que la siesta!', en: 'I am better at this than napping!' },
  'comms.benitoCatch4': { speaker: 'benito', es: '¡Ronroneo de victoria!', en: 'Victory purr!' },
  'comms.benitoMiss1': { speaker: 'benito', es: '¡Vuelve aquí, alfombra con patas!', en: 'Get back here, rug with legs!' },
  'comms.benitoHurt1': { speaker: 'benito', es: '¡Eso ha sido en la barriga! ¡Es zona protegida!', en: 'That was the belly! That area is protected!' },
};

export const TUTORIALS: Record<string, { es: string; en: string }> = {
  'tut.move': {
    es: 'WASD o joystick para moverte. MAYÚS para agacharte y acercarte sin ruido.',
    en: 'WASD or stick to move. SHIFT to crouch and approach quietly.',
  },
  'tut.jump': { es: 'ESPACIO para saltar. Pulsa de nuevo en el aire para el doble salto.', en: 'SPACE to jump. Press again in mid-air for the double jump.' },
  'tut.net': { es: 'Clic izquierdo o J para usar el artefacto. La Red Temporal captura de un golpe.', en: 'Left click or J to use the gadget. The Time Net catches in one swing.' },
  'tut.alert': {
    es: 'Mira el casco: azul = tranquila, amarillo = sospecha, rojo = te ha visto.',
    en: 'Watch the helmet: blue = calm, yellow = suspicious, red = spotted you.',
  },
};

export function beatText(b: Beat, lang: 'es' | 'en'): string {
  return lang === 'en' ? b.en : b.es;
}
