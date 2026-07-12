#include "player.h"

CatStats party[2];

// stats base a nivel 1 y crecimiento por nivel (x10 para precisión)
typedef struct {
    uint16_t hp0, pe0;
    uint8_t fue0, def0, vel0;
    uint16_t hp_g, pe_g, fue_g, def_g, vel_g;   // x10 por nivel
} Growth;

static const Growth growth[2] = {
    // Benito: tanque glotón
    { 22, 8, 6, 4, 5, 42, 18, 17, 13, 10 },
    // Silva: ágil y lista
    { 18, 10, 5, 3, 7, 33, 24, 14, 10, 17 },
};

static uint16_t stat_at(uint16_t base, uint16_t g10, uint8_t level)
{
    return base + (uint16_t)(((uint32_t)g10 * (level - 1)) / 10);
}

static void recalc(int cat)
{
    CatStats *c = &party[cat];
    const Growth *g = &growth[cat];
    uint16_t oldmax = c->hpmax;
    c->hpmax = stat_at(g->hp0, g->hp_g, c->level) + c->bonus_hp;
    c->pemax = stat_at(g->pe0, g->pe_g, c->level) + c->bonus_pe;
    c->fue = (uint8_t)stat_at(g->fue0, g->fue_g, c->level) + c->bonus_fue;
    c->def = (uint8_t)stat_at(g->def0, g->def_g, c->level) + c->bonus_def;
    c->vel = (uint8_t)stat_at(g->vel0, g->vel_g, c->level) + c->bonus_vel;
    // al subir de nivel, cura la diferencia
    if (c->hpmax > oldmax && c->hp > 0)
        c->hp += c->hpmax - oldmax;
    if (c->hp > c->hpmax)
        c->hp = c->hpmax;
    if (c->pe > c->pemax)
        c->pe = c->pemax;
}

void player_init_new(void)
{
    for (int i = 0; i < 2; i++) {
        CatStats *c = &party[i];
        c->level = 1;
        c->exp = 0;
        c->bonus_hp = c->bonus_pe = 0;
        c->bonus_fue = c->bonus_def = c->bonus_vel = 0;
        c->collar = false;
        c->hpmax = 1;   // recalc lo corrige
        recalc(i);
        c->hp = c->hpmax;
        c->pe = c->pemax;
    }
}

uint32_t exp_to_next(uint8_t level)
{
    return 8 + (uint32_t)level * level * 2;
}

static uint32_t exp_total_for(uint8_t level)
{
    uint32_t t = 0;
    for (uint8_t l = 1; l < level; l++)
        t += exp_to_next(l);
    return t;
}

int player_grant_exp(int cat, uint32_t amount)
{
    CatStats *c = &party[cat];
    c->exp += amount;
    int ups = 0;
    while (c->level < MAX_LEVEL &&
           c->exp >= exp_total_for(c->level + 1)) {
        c->level++;
        ups++;
        recalc(cat);
    }
    return ups;
}

void player_apply_bonus(int cat, int stat, int amount)
{
    CatStats *c = &party[cat];
    switch (stat) {
    case 0: c->bonus_hp += amount * 2; break;   // PV rinde doble
    case 1: c->bonus_pe += amount; break;
    case 2: c->bonus_fue += amount; break;
    case 3: c->bonus_def += amount; break;
    case 4: c->bonus_vel += amount; break;
    }
    recalc(cat);
}

int player_def_total(int cat)
{
    return party[cat].def + (party[cat].collar ? 2 : 0);
}
