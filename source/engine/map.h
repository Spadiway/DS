// Mapas tileados: carga de sala (tileset + capas BG), colisiones por
// metatile y modificación en caliente (puertas, interruptores).
#ifndef MAP_H__
#define MAP_H__

#include "common.h"
#include "rooms_data.h"

// flags de metatile (coinciden con tools/gen_tiles.py)
#define MF_SOLID    1
#define MF_PLATFORM 2
#define MF_HAZARD   4
#define MF_WATER    8
#define MF_OVERLAY  16

void map_load_room(const RoomDef *room);
void map_tick(void);                    // animación de paleta (agua/ácido)

int  map_w_px(void);
int  map_h_px(void);
u8   map_flags_at(int px, int py);      // flags en coordenadas de píxel
u8   map_flags_mt(int mx, int my);
int  map_metatile(int mx, int my);
void map_set_metatile(int mx, int my, int mt);

#endif
