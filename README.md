# Benito Escape

Juego de plataformas 3D en tiempo real sobre la caza de mascotas renegadas.
Benito, un gato gris atigrado y corpulento, persigue a Deedee —un chihuahua
diminuto con un casco que le multiplicó la inteligencia y le arruinó el
carácter— a través de ocho eras del tiempo.

Corre en el navegador: **React + Three.js + TypeScript**, sin plugins.

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # compilación de producción en dist/
npm run preview  # servir la compilación

npm run build:single   # dist-single/benito-escape.html: el juego entero
                       # en un solo fichero, sin servidor ni recursos aparte
```

`build:single` deja un HTML autocontenido de unos 950 kB que se abre haciendo
doble clic y no pide nada a la red: las texturas, los modelos, las voces y la
música se generan en el arranque.

---

## Sobre los recursos: todo es original y generado por procedimiento

Este proyecto está inspirado en el género de plataformas 3D de captura de
criaturas, pero **no reutiliza ningún recurso de ningún juego comercial**. No
contiene modelos, texturas, geometría de niveles, música ni efectos extraídos
de otro título: todo eso es propiedad de sus autores y no puede copiarse.

En su lugar, **el juego genera todo en tiempo de ejecución**:

| Elemento | Cómo se produce |
|---|---|
| Personajes | Primitivas de Three.js compuestas en `engine/models.ts` |
| Animación | Osciladores procedurales en `engine/anim.ts`, sin ficheros de animación |
| Niveles | Ruido fBm con semilla fija en `engine/levelGen.ts` |
| Decorado | Geometrías fusionadas e instanciadas en `engine/props.ts` |
| Música | Síntesis WebAudio por mundo en `core/audio.ts` |
| Efectos | Osciladores y ruido filtrado, también en `core/audio.ts` |
| Texturas | Dibujadas con canvas 2D en `engine/textures.ts` |
| Caras | Pintadas en la textura de la cabeza, no modeladas |
| Interfaz | CSS puro |

El sombreado es cel real sobre `MeshToonMaterial`: bandas duras mediante mapa de
degradado de pocos pasos, con sombras proyectadas, niebla y luces del pipeline
de Three, contorno por casco invertido y una pasada de bloom para el neón.

**Todo va texturizado**, que es lo que separa el aspecto de aquella generación
de consolas del "low poly" moderno de colores planos: suelo, corteza, hoja,
piedra, chapa, tela y casco tienen su imagen, dibujada a 64–256 px para que el
téxel se note. Y **las caras de los personajes están pintadas en la textura**
—ojos, iris, pupila, brillo, nariz, boca, bigotes y ceño—, no montadas con
esferas: poca geometría y toda la expresión en la imagen.

Consecuencias prácticas: el repositorio no tiene carpeta de recursos, la
compilación pesa unos 900 kB (≈250 kB comprimidos), no hay descargas al
arrancar y un nivel se genera en **20–45 ms**.

---

## Historia

**Acto I.** Deedee era una mascota pequeña y amable de un parque. Encuentra un
prototipo defectuoso del Casco de Potencia Canina, que le amplifica la
inteligencia un 300 % y le corrompe el juicio. Libera a las mascotas del
parque, las equipa con cascos, asalta el laboratorio del Dr. Pelomántiz y roba
la Máquina Temporal de Patas. Al activarla, todos son arrastrados por el tiempo.

**Acto II.** Desde su fortaleza, Deedee exhibe su Casco Avanzado y anuncia que
ha controlado la mente de un amigo de Benito. Envía mascotas armadas a
distintas épocas para reescribir la historia.

**Acto III.** Benito lo persigue por ocho mundos. En la Dimensión X, Deedee
admite que odiaba su vida anterior de mascota enjaulada, pero se niega a
cambiar. Vencido y capturado, vuelve a ser un chihuahua normal y regresa al
parque, donde su antiguo cuidador lo está esperando.

### Personajes

| | Personaje | Descripción |
|---|---|---|
| 🐱 | **Benito** | Gato gris atigrado y gordo, ojos verdes brillantes. Valiente, algo ingenuo, leal. |
| 🐶 | **Deedee** | Chihuahua canela diminuto con la lengua permanentemente fuera y capa negra. Megalómano y colérico. |
| 😼 | **Silva** | Gata gris esbelta de ojos finos y verdes. Lugarteniente servil, calculadora y sarcástica. |
| 🥽 | **Dr. Pelomántiz** | Científico inventor. Envía artefactos y da apoyo por comunicador. |

---

## Los ocho mundos

| # | Mundo | Niveles | Artefacto | Jefe |
|---|---|---|---|---|
| 1 | La Tierra Perdida | Llanura Fósil · Ciénaga Primigenia · Valle de Lava | Red de Agua | Silva |
| 2 | La Era Misteriosa | Jungla Ancestral · Ruinas del Eco · Templo Cifrado | Palo Aturdidor | Guardián |
| 3 | Oceana | Playa Cangrejal · Gruta de Coral · El Vientre de Tragaldabas | Aro de Velocidad | Guardián |
| 4 | Nueva Tierra de Hielo | Océano Congelado · Refugio Escarchado · Aguas Termales | Puño Mágico | Silva |
| 5 | Época Medieval | Templo Sereno · La Gran Muralla · Castillo en Ruinas | Aro Supremo | Guardián |
| 6 | Futurama | Parque Urbano · Fábrica de Cascos · Torre de Antenas | Radar de Mascotas | Silva |
| 7 | El Reino Invertido | Reino Invertido | — | Silva |
| 8 | Dimensión X | Fortaleza de Deedee | — | **Deedee** (3 fases) |

Cada mundo tiene su propia paleta, líquido (agua, lava, ácido, limo o vacío),
decorado y reglas: hielo resbaladizo en el mundo 4, gravedad reducida en el 7,
interiores orgánicos en el 3-3.

---

## Mecánicas

### Captura y sistema de alerta

La luz del casco de cada mascota indica su estado, igual que un semáforo:

- 🔵 **Azul** — tranquila. Patrulla su ruta y juega.
- 🟡 **Amarillo** — sospecha. Ha oído algo y se gira a mirar.
- 🔴 **Rojo** — te ha visto. Huye, embiste o dispara según su tipo.

La percepción combina un cono de visión (con comprobación de línea de visión
contra el escenario) y un radio de oído que **depende de cómo te muevas**:
agachado haces un 25 % de ruido, corriendo más del 100 %. Capturar una mascota
alerta a las que estén cerca.

El color del pantalón define el comportamiento:

| Color | Comportamiento |
|---|---|
| 🟡 Amarilla | Normal, velocidad media, huye al ser descubierta |
| 🔴 Roja | Agresiva: embiste y golpea |
| 🔵 Azul | Rápida y saltarina, esquiva la red el 45 % de las veces |
| ⚪ Blanca | Vista y oído muy superiores, difícil de sorprender |
| 🟢 Verde | Mantiene la distancia y lanza proyectiles |

Una mascota aturdida o congelada **siempre** cae a la red: el Palo Aturdidor
convierte cualquier captura difícil en segura.

### Los ocho artefactos

| | Artefacto | Efecto | Se obtiene en |
|---|---|---|---|
| 🕸️ | Red Temporal | Captura de un golpe. Arma principal | Inicio |
| 🌊 | Red de Agua | Nadar, bucear y capturar bajo el agua | 1-2 |
| 🏏 | Palo Aturdidor | Aturde mascotas y rompe cajas | 2-2 |
| 💨 | Aro de Velocidad | Impulso rápido, cruza puertas de anillos | 3-1 |
| 👊 | Puño Mágico | Destruye muros de hielo y cristal | 4-1 |
| 🪁 | Aro Supremo | Planeo y flotación hacia plataformas altas | 5-1 |
| 📡 | Radar de Mascotas | Marca todas las mascotas en el minimapa | 6-1 |
| ⏱️ | Congelador Temporal | Congela el tiempo 5 segundos | Post-juego |

Los artefactos consumen energía, que se recarga sola y con galletas. Cada
mundo esconde obstáculos que solo cede el artefacto correspondiente, así que
volver a niveles antiguos con equipo nuevo abre zonas y monedas.

### Progresión

3 vidas, puntos de control, galletas de curación y 3–4 Monedas Deedee por
nivel. Para abrir la puerta temporal hay que capturar un mínimo de mascotas;
las demás se pueden cazar en repeticiones. Vencer a un jefe abre la puerta al
instante. Los mundos se desbloquean por total acumulado de capturas.

---

## Controles

| Acción | Teclado / ratón | Mando |
|---|---|---|
| Moverse | `W A S D` o flechas | Stick izquierdo |
| Cámara | `K` `;` `O` `P` o ratón | Stick derecho |
| Saltar (doble salto) | `Espacio` | A |
| Usar artefacto | `J` o clic izquierdo | X / RT |
| Agacharse (sigilo) | `Mayús` | B |
| Puntería 1.ª persona | `L` o clic derecho | LT |
| Cambiar artefacto | `Q` `E`, rueda o `1`–`8` | LB / RB |
| Radar | `R` | Y |
| Pausa | `Esc` | Start |

Todas las teclas son reasignables en Ajustes. En pantallas táctiles aparece un
joystick virtual con botones; se puede forzar o desactivar desde Ajustes.

---

## Opciones

- **Gráficos**: baja / media / alta — controlan sombras, contornos, densidad de
  vegetación, partículas y resolución de renderizado.
- **Idioma**: español e inglés, con subtítulos conmutables.
- **Accesibilidad**: iconos grandes, modo daltónico (las luces de casco pasan a
  azul / blanco / magenta) y desactivación de la vibración de cámara.
- **Guardado**: 5 ranuras en `localStorage`, autoguardado al terminar nivel.

---

## Arquitectura

```
src/
  core/       Sistemas independientes del render
    events.ts     Bus tipado motor → interfaz
    input.ts      Teclado + ratón + mando + táctil, reasignable
    audio.ts      Música y efectos sintetizados
    save.ts       Ranuras de guardado
    settings.ts   Ajustes persistentes
    i18n.ts       Textos ES/EN
  content/    Datos puros, sin lógica
    worlds.ts     Los 20 niveles y sus paletas
    story.ts      Cinemáticas y diálogos
    gadgets.ts    Definición de artefactos
  engine/     Simulación y render (Three.js, sin React)
    game.ts       Bucle principal y reglas
    levelGen.ts   Generación de niveles
    models.ts     Personajes y objetos
    anim.ts       Animación procedural
    physics.ts    Terreno de altura + cajas, actores cápsula
    pet.ts        IA y alerta de mascotas
    player.ts     Control de Benito
    boss.ts       Jefes y sus fases
    celMaterial.ts  Sombreado cel, contornos, niebla, cielo
    props.ts      Decorado instanciado
    particles.ts  Partículas por lotes
    cameraRig.ts  Cámara de seguimiento
  ui/         React: menús, HUD, cinemáticas
```

React nunca toca la escena 3D y el motor nunca importa React: se comunican por
el bus de `core/events.ts`. El motor publica el estado del HUD diez veces por
segundo en vez de en cada fotograma, para no re-renderizar React a 60 Hz.

### Aspecto visual

La dirección de arte no se decidió a ojo. Se midieron fotograma a fotograma
capturas del juego que sirve de referencia y se compararon con capturas
propias, superficie por superficie:

| superficie | referencia | luminancia | saturación |
| --- | --- | --- | --- |
| arena | `#fce489` | 226 | 0.45 |
| camino de tierra | `#b96b17` | 117 | 0.87 |
| madera | `#915523` | 94 | 0.76 |
| ladrillo | `#a27750` | 125 | 0.50 |
| mar cercano | `#61d8f8` | 193 | 0.61 |
| colina lejana | `#9e8470` | 136 | 0.29 |

Sobre el cuadro completo la referencia da una dominante cálida de +53 a +78 en
la diferencia R-B, con dos tercios de los píxeles saturados en el sector
naranja y una luminancia mediana entre 117 y 207. Las capturas de aquí daban
+2 a +8 —neutro—, casi la mitad de los píxeles en verde y una mediana de 84.
No era falta de detalle: era falta de temperatura, de saturación y de luz.

De ahí salen las decisiones de abajo, junto con cómo se iluminaban los juegos
de esa generación de portátiles: sin sombras dinámicas, con la luz horneada en
las texturas y en los colores de vértice.

- **Gradación de paleta en un solo punto**: las veinte paletas pasan por una
  función que arrastra los tonos hacia el naranja de referencia ponderando por
  cercanía —un verde se vuelve oliva dorado, un cian de agua apenas se mueve—,
  sube saturación y valor, y deja la niebla con el tono del horizonte en vez de
  irse al gris.
- **Sin mapeo de tonos.** ACES es una curva de cine: comprime los altos y
  arrastra los colores vivos hacia el blanco. Aquel hardware sacaba el color
  lineal y lo recortaba por canal, que es justamente por lo que aquellos juegos
  se ven tan encendidos. Un verde quemado seguía siendo verde.
- **Rampa de cel shading plana y alta** (0.70–1.00): la cara en sombra se lee
  casi como la iluminada, igual que con iluminación horneada.
- **Luz hemisférica como fuente principal** —cielo arriba, rebote cálido del
  suelo abajo— con el sol aportando poco más que dirección y matiz, y la sombra
  proyectada casi anulada. El presupuesto se recorta según el albedo dominante
  del mundo: el reparto que deja bonito un prado revienta un mundo de hielo.
- **Oclusión horneada en los vértices del terreno**: cada punto se compara con
  la media de su entorno a tres radios; las crestas reciben cielo y las
  vaguadas se resguardan. Cuesta una pasada en la generación y nada en juego.
- **Degradado horneado por pieza en el decorado**: claro y frío arriba, oscuro
  y cálido abajo. Sin él las copas se veían como recortes de cartulina.
- **Lustre especular recortado en dos escalones**, inyectado a mano porque
  `MeshToonMaterial` no lo trae: leve en el pelaje, alto en cascos, cristal,
  hielo, metal y agua. Es el acabado brillante que define la estética de la
  época; todo mate se leía como cartón pintado.
- **Cielo** con cúmulos grandes de panza azulada pegados al horizonte —que es
  donde mira una cámara casi horizontal—, cenit saturado y una banda fina de
  calima sobre la línea del suelo.
- **Encuadre bajo**: el horizonte cae al 35 % de la pantalla y la cámara pica
  apenas 12°, con 52° de campo de visión. Iba a 21° y con el horizonte al 14 %,
  de modo que dos tercios de la pantalla eran suelo vacío. Ese encuadre, más
  que ninguna textura, es lo que hacía que los mundos parecieran desiertos.
- **Terreno aterrazado**: el ruido se cuantiza en mesetas separadas por riscos.
  El color va en los vértices y mezcla hierba, tierra, roca, orilla y nieve
  según pendiente, altura y tres escalas de ruido.
- **Camino de tierra** de once metros tallado en el terreno y llevado casi del
  todo al naranja medido. En la referencia la senda ocupa entre un cuarto y un
  tercio de la pantalla, y es lo que hace que el reparto de tonos del cuadro
  sea naranja y no verde.
- **Decorado repartido por cercanía al camino**, con orillas tupidas de matas y
  el corredor de paso limpio. La densidad uniforme sobre una isla de 190 metros
  dejaba una mata cada noventa metros cuadrados.
- **Máscaras de entablado y de chapa remachada** —centradas en blanco, porque
  el color va en los vértices— para vallas, casetas, barriles, arcos y
  tuberías. Eran cajas de color liso, y es el dibujo de las juntas lo que da
  escala y oficio a una construcción.
- **Personajes articulados**: torso torneado con perfil de pera, cuello, brazos
  con codo y zarpa, piernas con rodilla y pies grandes, cola segmentada. La
  animación dobla codos y rodillas, así que el paso se lee como paso.
- **Caras pintadas**: la cabeza es una esfera y el rostro va en la textura,
  alineado con el frente del modelo. El ceño de Silva, las gafas del Profesor y
  la lengua fuera de Deedee son parámetros de la misma función.
- **Mochila de artefactos** en la espalda de Benito. El jugador le ve la
  espalda casi toda la partida y por detrás no había un solo acento de color.
- **Envolvente de interior**: los niveles bajo techo se cierran con muros de
  azulejo, pilastras y techo.
- **La cámara esquiva los estorbos altos** —árboles, columnas, peñascos, muros
  de artefacto— y se eleva sobre el terreno en vez de acercarse, que es lo que
  planta la cámara en el cogote del personaje.
- **Bloom** sobre lo emisivo, con la emisión limitada por máscara de vértice a
  las piezas que de verdad brillan y atemperada según lo claro que sea su
  color: sin eso, una farola blanca se convertía en un chorro de luz.

### Rendimiento

Medido sobre los 20 niveles: 165 000–287 000 triángulos por escena y generación
completa de un nivel entre 49 y 143 ms (objetivo de carga: menos de 3 s). El
decorado se dibuja con `InstancedMesh` —un solo draw call por tipo de objeto— y
las partículas comparten un único lote reciclado. La calidad baja desactiva
sombras, bloom y contornos.

### Depuración

Añade `?debug=1` a la URL y el motor queda expuesto en `window.benito`, con
acceso a `pets`, `boss`, `level`, `player` y `loadLevel(id, gadgets)` para
saltar a cualquier nivel desde la consola.

---

## Estado

Jugable de principio a fin: los 20 niveles se generan y se completan, los ocho
artefactos funcionan, los jefes tienen sus fases y el arco narrativo está
íntegro, con cinemáticas de apertura, de cada mundo y epílogo.

Ideas pendientes: los cuatro minijuegos de Extras se compran con monedas pero
todavía no tienen escena propia, y los trajes desbloqueables aún no cambian el
modelo de Benito.
