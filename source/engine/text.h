// Texto con la fuente propia (8x8, español completo) sobre capas BG0.
#ifndef TEXT_H__
#define TEXT_H__

#include "common.h"

// variantes de la fuente
#define TXT_DARK  0    // tinta oscura (sobre caja crema)
#define TXT_LIGHT 1    // tinta clara con sombra (sobre escena)

void text_init(void);     // carga tiles de fuente y de caja en ambas pantallas

// Dibuja en coordenadas de celda (x: 0-31, y: 0-23). Devuelve celdas escritas.
int txt_draw(u16 *map, int x, int y, const char *utf8, int variant);
void txt_clear(u16 *map, int x, int y, int w, int h);
void txt_fill_screen(u16 *map);        // limpia todo el layer

// nº de celdas que ocupará una cadena (para centrar)
int txt_width(const char *utf8);

// caja de diálogo estilo BIS: marco redondeado crema
void txt_box(u16 *map, int x, int y, int w, int h);
// limpia una zona INTERIOR de caja (relleno crema, no transparente)
void txt_fill_box(u16 *map, int x, int y, int w, int h);

// barra de progreso (PV/PE): 'cells' celdas, valor 0..max
void txt_bar(u16 *map, int x, int y, int cells, int val, int max, int color);

// decodifica el siguiente codepoint UTF-8 y avanza el puntero
u32 utf8_next(const char **p);
// índice de glifo para un codepoint (0 = espacio si desconocido)
int txt_glyph(u32 cp);
// índice de TILE en el mapa para un codepoint y variante
int txt_tile(u32 cp, int variant);

#endif
