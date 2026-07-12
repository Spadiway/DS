// Presentación DS del combate (usa battle_core como lógica).
#ifndef BATTLE_RENDER_H__
#define BATTLE_RENDER_H__

#include "common.h"

// formation: 3 especies (255 = hueco). interior: fondo/música de zona.
void battle_enter(const u8 formation[3], bool boss, bool interior);
// devuelve 0 en curso, 1 victoria, 2 derrota, 3 huida
int battle_update(void);
void battle_exit(void);

#endif
