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
```

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
| Interfaz | CSS puro |

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

### Rendimiento

Medido sobre los 20 niveles: 65 000–195 000 triángulos y 136–800 llamadas de
dibujo por escena, con la generación completa de un nivel entre 20 y 45 ms
(objetivo de carga: menos de 3 s). El decorado se dibuja con `InstancedMesh`
—un solo draw call por tipo de objeto— y las partículas comparten un único
lote reciclado.

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
