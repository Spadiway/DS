// Efectos jugosos: partículas, números de daño saltarines y sacudida.
#ifndef FX_H__
#define FX_H__

#include "common.h"

void fx_clear(void);
void fx_update(void);
void fx_draw(int camx, int camy);   // llamar entre spr_begin/spr_end

// partículas (coordenadas de mundo)
void fx_stars(int x, int y);            // impacto
void fx_heart(int x, int y);
void fx_sparkle(int x, int y);
void fx_puff(int x, int y, int vy);     // nube de gas/polvo (vy en fx32)
void fx_excl(int x, int y);             // ¡! de alerta (breve)

// número de daño saltarín (coordenadas de mundo)
void fx_damage(int x, int y, int value, bool heal);

// sacudida de pantalla
void fx_shake(int frames, int power);
int  fx_shake_x(void);
int  fx_shake_y(void);

#endif
