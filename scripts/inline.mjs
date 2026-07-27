/**
 * Empaqueta la compilación de `dist-single` en un único HTML autocontenido.
 *
 * Mete el módulo y la hoja de estilo dentro del propio documento, de modo que
 * el resultado se abre haciendo doble clic o se sube a cualquier sitio sin
 * necesidad de servidor ni de rutas relativas. No hay peticiones a la red: las
 * texturas, los modelos y la música se generan por procedimiento al arrancar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const js = readFileSync(join(dir, 'game.js'), 'utf8');
const css = readFileSync(join(dir, 'game.css'), 'utf8');

// El cierre de etiqueta dentro de una cadena de JavaScript cerraría el <script>
const safeJs = js.replaceAll('</script', '<\\/script');

/**
 * Se sustituye con función, no con cadena: en el texto de reemplazo de
 * `String.replace` las secuencias `$&`, `$\`` y `$'` son directivas, y un
 * paquete de un megabyte de JavaScript las contiene a docenas. Pasándolo como
 * cadena, el propio `<script src=...>` se reinsertaba en mitad del código.
 */
const out = html
  .replace(/<script[^>]*src="[^"]*game\.js"[^>]*><\/script>/, () => `<script type="module">${safeJs}</script>`)
  .replace(/<link[^>]*href="[^"]*game\.css"[^>]*>/, () => `<style>${css}</style>`)
  // El icono es un fichero aparte que aquí no existiría
  .replace(/<link rel="icon"[^>]*>/, '');

if (/src="[^"]*game\.js"/.test(out) || /href="[^"]*game\.css"/.test(out)) {
  throw new Error('Quedaron referencias externas en el HTML: revisa los nombres de salida de Vite');
}

const target = process.argv[2] ?? join(dir, 'benito-escape.html');
writeFileSync(target, out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log(`Escrito ${target} (${kb} kB)`);
