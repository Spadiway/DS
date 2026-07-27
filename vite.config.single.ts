/**
 * Configuración para la compilación en un solo fichero.
 *
 * La compilación normal reparte el código en tres trozos (three, react y el
 * juego) porque para servir por web conviene que el navegador los cachee por
 * separado. Para repartir el juego como un único HTML que se abre haciendo
 * doble clic hace falta lo contrario: un solo módulo, sin importaciones entre
 * trozos, que después `scripts/inline.mjs` mete dentro del HTML.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-single',
    chunkSizeWarningLimit: 4000,
    // Sin trocear: un módulo y una hoja de estilo
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'game.js',
        assetFileNames: 'game[extname]',
      },
    },
  },
});
