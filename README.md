# 🐱 Benito Escape — El Juego de Mascotas

Juego de plataformas 3D en el navegador donde **Benito**, un gato gris atigrado
gordito y de ojos verdes, persigue a través del tiempo a **Deedee**, un
chihuahua megalómano con la lengua siempre fuera, para capturar con su red a
las mascotas renegadas que ha soltado por la historia.

Construido con **Three.js + Vite**. Todos los assets (modelos 3D, música y
efectos de sonido) se generan por código en tiempo real: no hay ficheros de
arte ni audio externos.

## 🎮 Cómo jugar

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Para compilar la versión de producción:

```bash
npm run build    # genera dist/
npm run preview  # sirve dist/ localmente
```

### Controles

| Acción | Tecla |
|---|---|
| Mover | `WASD` o flechas |
| Saltar | `Espacio` |
| Red Atrapamascotas | `J` o clic izquierdo |
| Bastón Chispa (aturdir) | `K` |
| Aro Turbo (correr) | mantener `Shift` |
| Radar Bigotes | `R` |
| Girar cámara | `Q` / `E` |
| Pausa | `Esc` o `P` |
| Diálogos | `Enter` avanzar · `Esc` saltar |

## 🕹️ Mecánicas

- **Sistema de alarma por casco**: cada mascota lleva un casco con luz.
  - 🔵 **Azul**: tranquila, no te ha visto. ¡Acércate por detrás!
  - 🟡 **Amarillo**: te ha visto y toma distancia.
  - 🔴 **Rojo**: alarma total — huye a toda velocidad o te ataca.
- **Tipos de mascota** (color de pantalones): amarillo (normal), rojo
  (agresiva), azul (rápida), blanco (vista larga), verde (dispara proyectiles).
- **Galletas**: restauran energía y salud.
- **Portal temporal**: se abre al capturar el número objetivo de mascotas.
- **Jefe final**: Deedee embiste desde su trono flotante; golpéalo con la red
  cuando su casco se recalienta.

## 🗺️ Mundos

1. 🦕 Valle Jurásico — La Era Perdida (tutorial)
2. 🌿 Ruinas Selváticas — La Edad Misteriosa (desbloquea Bastón Chispa)
3. 🏝️ Bahía Coral — Oceana Primitiva (desbloquea Aro Turbo)
4. ❄️ Tundra Brillante — La Gran Helada (¡hielo resbaladizo!)
5. 🏯 Castillo Crepúsculo — Tiempos Medievales (desbloquea Radar Bigotes)
6. 🌆 Metrópolis Neón — El Presente Robado
7. 🌀 Dimensión Onírica — El Mundo de Deedee
8. 👑 Fortaleza de Deedee — Batalla Final

## 💾 Progresión

El progreso (niveles desbloqueados, gadgets, capturas totales e idioma) se
guarda automáticamente en `localStorage` al completar cada nivel. Idiomas
disponibles: **Español** e **Inglés**.

## 📝 Nota sobre el diseño

Este es un juego original inspirado en el *género* clásico de plataformas de
captura de mascotas de los 2000. Personajes, nombres, niveles, diálogos,
música y modelos son creaciones originales de este proyecto.
