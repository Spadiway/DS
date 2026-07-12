// Estadísticas y progresión de Benito y Silva.
// Portable (sin libnds): se compila también en los tests de host.
#ifndef PLAYER_H__
#define PLAYER_H__

#include <stdint.h>
#include <stdbool.h>

#define MAX_LEVEL 33
#define CAT_BENITO 0
#define CAT_SILVA  1

typedef struct {
    uint8_t level;
    uint32_t exp;           // exp total acumulada
    uint16_t hp, hpmax;
    uint16_t pe, pemax;
    uint8_t fue, def, vel;
    // bonus acumulados de la ruleta de nivel
    uint8_t bonus_hp, bonus_pe, bonus_fue, bonus_def, bonus_vel;
    bool collar;            // collar equipado (+2 DEF)
} CatStats;

extern CatStats party[2];

void player_init_new(void);
// exp necesaria para pasar del nivel n al n+1
uint32_t exp_to_next(uint8_t level);
// añade exp; devuelve cuántos niveles ha subido (recalcula stats)
int player_grant_exp(int cat, uint32_t amount);
// aplica el bonus de la ruleta: stat 0=PV 1=PE 2=FUE 3=DEF 4=VEL
void player_apply_bonus(int cat, int stat, int amount);
// stats efectivos (equipo incluido)
int player_def_total(int cat);

#endif
