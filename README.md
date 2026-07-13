# 🐱 BENITO ESCAPE — El Juego de Mascotas

Plataformas 3D de captura de mascotas en tiempo real, hecho con **Three.js** (WebGL).
Un homenaje **original** al género de los cazamonos de los 2000: mismo espíritu
(redes, cascos con lucecitas, sigilo y épocas históricas), con personajes, niveles,
arte, música y código 100 % propios.

> **Fase 1 (esta versión):** menú + guardado + cinemáticas + **Mundo 1 completo
> (3 niveles)** con jefe final del mundo.

## ▶️ Cómo jugar

No hay build: es HTML + módulos ES. Solo necesitas servir la carpeta:

```bash
# opción A
python3 -m http.server 8080
# opción B
npx serve .
```

Abre `http://localhost:8080` en el navegador.

### Controles (teclado)

| Acción | Tecla |
| --- | --- |
| Mover | `WASD` / flechas |
| Saltar | `ESPACIO` |
| Usar red | `J` (o clic en botón táctil) |
| Sigilo (agacharse) | `SHIFT` mantenido |
| Girar cámara | `Q` / `E` |
| Cambiar gadget | `1` / `2` |
| Pausa | `ESC` / `P` |

En móvil/tablet aparecen un joystick virtual y botones A (salto) / B (red).

## 🎮 Mecánicas

- **Luces del casco:** 🔵 tranquila · 🟡 te ha visto · 🔴 alarmada (huye o ataca).
  Acércate en sigilo para que no salten las alarmas.
- **Pantalones = personalidad:** amarillo (normal), rojo (te embiste), azul
  (rapidísima), blanco (radar de alerta enorme), verde (lanza proyectiles).
- **Gadgets:** Red Temporal (base) y **Red Acuática** (se gana al superar 1‑2;
  vuelve a la ciénaga a por las mascotas de los estanques).
- **Jefe del Mundo 1:** *Capitán Colmillo*. Esquiva su embestida, deja que se
  estampe contra el muro y dale con la red mientras está mareado (×3).
- Galletas = energía. 3 corazones, 3 vidas, banderas de punto de control y
  portal temporal que se abre al capturar las mascotas requeridas.
- **Guardado:** 3 ranuras en `localStorage`, autoguardado al superar nivel.
- **Idiomas:** Español e Inglés (menú principal).

## 🗺️ Contenido de la Fase 1

| Nivel | Nombre | Novedad |
| --- | --- | --- |
| 1‑1 | Pradera de los Huesos | Tutorial (mover, red, sigilo, cámara) |
| 1‑2 | Ciénaga Burbujeante | Estanques + desbloqueo de Red Acuática |
| 1‑3 | Cañón de Lava | Ríos de lava + jefe Capitán Colmillo |

Los mundos 2–8 aparecen en el mapa como «próximamente»: el sistema de niveles es
declarativo (`src/levels.js`), así que añadir mundos nuevos es añadir datos.

## 🏗️ Estructura

```
index.html          página + overlays de UI (HUD, menús, cinemáticas)
styles.css          estilo retro-portátil 2005
lib/three.module.js Three.js vendorizado (MIT, ver THREE_LICENSE.txt)
src/
  main.js           arranque + máquina de estados de pantallas
  game.js           sesión de nivel (bucle, cámara, capturas, jefe, efectos)
  player.js         controlador de Benito (movimiento, salto, red, animación)
  pets.js           IA de mascotas (patrulla/alerta/pánico) + jefe
  levels.js         datos de mundos y niveles (declarativo)
  levelbuilder.js   construye escena + colisiones desde los datos
  models.js         fábricas de modelos low-poly (toon) originales
  portraits.js      retratos 2D procedurales para diálogos
  cutscene.js       reproductor de diálogos con máquina de escribir
  hud.js            HUD DOM (vidas, energía, capturas, gadgets, avisos)
  audio.js          música chiptune y SFX sintetizados (WebAudio)
  i18n.js           textos ES/EN + guiones de cinemáticas
  input.js          teclado + controles táctiles
  save.js           ranuras de guardado en localStorage
```

## 🧭 Hoja de ruta

- **Fase 2:** Mundos 2–4 (jungla ancestral, playa, hielo) + Porra Aturdidora,
  Aro Turbo y Puño de Hielo.
- **Fase 3:** Mundos 5–8, Silva como mini-jefa recurrente, batalla final
  contra Deedee (3 fases).
- **Fase 4:** minijuegos desbloqueables, trajes, radar de mascotas, modo 100 %.

## ⚖️ Nota sobre propiedad intelectual

Este proyecto **no** usa modelos, música, sprites, nombres de niveles ni ningún
otro asset de juegos comerciales. Es una obra nueva inspirada en un género
clásico; todo el contenido del repositorio es original (Three.js se incluye
bajo su licencia MIT).
