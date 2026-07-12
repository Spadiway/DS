// Exploración: vista superior (jardín) y lateral con gravedad (interior).
#ifndef OVERWORLD_H__
#define OVERWORLD_H__

#include "common.h"
#include "rooms_data.h"

void ow_enter_room(int room_id, int mx, int my);   // carga sala y coloca
void ow_update(void);                              // un frame de juego
void ow_party_pos(int *px, int *py);               // posición del líder
void ow_warp(int mx, int my);                      // recoloca a los gatos
void ow_boss_defeated(void);                       // tras vencer al Tapón
void ow_restore_after_battle(void);
int  ow_room(void);

#endif
