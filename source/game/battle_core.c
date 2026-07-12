#include <stddef.h>
#include "battle_core.h"

const SpeciesDef species_defs[SP_COUNT] = {
    [SP_PULGON] = { "Pulgón Bravucón", 14, 5, 2, 4, 6, 4, 0, 26, 0 },
    [SP_SEMILLA] = { "Semilla Saltona", 10, 6, 1, 6, 5, 3, 0, 44, 1 },
    [SP_BACTERIOLO] = { "Bacteriolo", 16, 5, 3, 5, 8, 5, 0, 28, 2 },
    [SP_GUSANILLO] = { "Gusanillo Ansioso", 13, 6, 2, 7, 8, 5, 0, 32, 3 },
    [SP_TAPON] = { "El Gran Tapón", 70, 8, 4, 3, 60, 40, 1, 36, 4 },
};

// ---------------------------------------------------------------------------
// utilidades internas
// ---------------------------------------------------------------------------

static uint32_t brand(Battle *b)
{
    uint32_t x = b->rngs;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    b->rngs = x ? x : 0x1234567u;
    return x;
}

static int brange(Battle *b, int lo, int hi)
{
    return lo + (int)(brand(b) % (uint32_t)(hi - lo + 1));
}

static void push(Battle *b, uint8_t type, int a, int aa, const char *s)
{
    int next = (b->ev_tail + 1) % 24;
    if (next == b->ev_head)
        return;
    b->ev[b->ev_tail] = (BtlEvent){ type, (int16_t)a, (int16_t)aa, s };
    b->ev_tail = next;
}

bool battle_pop_event(Battle *b, BtlEvent *out)
{
    if (b->ev_head == b->ev_tail)
        return false;
    *out = b->ev[b->ev_head];
    b->ev_head = (b->ev_head + 1) % 24;
    return true;
}

static void set_phase(Battle *b, uint8_t ph)
{
    b->phase = ph;
    b->t = 0;
}

static int cat_fue(Battle *b, int cat)
{
    int f = party[cat].fue;
    if (b->hierba[cat])
        f += f / 2;
    return f;
}

static int cat_def_battle(int cat)
{
    return player_def_total(cat);
}

static int alive_cats(void)
{
    return (party[0].hp > 0 ? 1 : 0) + (party[1].hp > 0 ? 1 : 0);
}

static int alive_enemies(Battle *b)
{
    int n = 0;
    for (int i = 0; i < b->n_en; i++)
        if (b->en[i].alive)
            n++;
    return n;
}

static int first_alive_cat(void)
{
    return party[0].hp > 0 ? 0 : 1;
}

static int damage_calc(Battle *b, int atk, int def, int mult_pct)
{
    int base = atk * 2 - def;
    if (base < 1)
        base = 1;
    base = base * mult_pct / 100;
    int var = base / 10 + 1;
    base += brange(b, -var, var);
    return base < 1 ? 1 : base;
}

static void hurt_enemy(Battle *b, int idx, int dmg)
{
    BEnemy *e = &b->en[idx];
    if (!e->alive)
        return;
    e->hp -= dmg;
    push(b, BE_DMG_ENEMY, idx, dmg, NULL);
    if (e->hp <= 0) {
        e->hp = 0;
        e->alive = false;
        push(b, BE_ENEMY_DIE, idx, 0, NULL);
    }
}

static void hurt_cat(Battle *b, int cat, int dmg)
{
    CatStats *c = &party[cat];
    if (c->hp == 0)
        return;
    c->hp = (dmg >= c->hp) ? 0 : c->hp - dmg;
    push(b, BE_DMG_CAT, cat, dmg, NULL);
    if (c->hp == 0)
        push(b, BE_CAT_KO, cat, 0, NULL);
}

// siguiente gato con turno pendiente en esta ronda; -1 si no queda
static int next_cat_actor(Battle *b, int after)
{
    (void)b;
    for (int i = after + 1; i < 2; i++)
        if (party[i].hp > 0)
            return i;
    return -1;
}

static void begin_menu_for(Battle *b, int cat)
{
    b->actor = cat;
    b->menu_sel = 0;
    set_phase(b, BF_MENU);
}

static void begin_enemy_round(Battle *b)
{
    b->en_cur = -1;
    // busca el primer enemigo vivo
    for (int i = 0; i < b->n_en; i++) {
        if (b->en[i].alive) {
            b->en_cur = i;
            break;
        }
    }
    if (b->en_cur < 0) {
        set_phase(b, BF_VICTORY);
        return;
    }
    set_phase(b, BF_ENEMY_TELE);
    // elegir objetivo: gato vivo al azar
    if (alive_cats() == 2)
        b->atk_target = brange(b, 0, 1);
    else
        b->atk_target = first_alive_cat();
}

static void next_enemy_or_menu(Battle *b)
{
    if (alive_cats() == 0) {
        set_phase(b, BF_DEFEAT);
        return;
    }
    for (int i = b->en_cur + 1; i < b->n_en; i++) {
        if (b->en[i].alive) {
            b->en_cur = i;
            if (alive_cats() == 2)
                b->atk_target = brange(b, 0, 1);
            else
                b->atk_target = first_alive_cat();
            set_phase(b, BF_ENEMY_TELE);
            return;
        }
    }
    if (alive_enemies(b) == 0) {
        set_phase(b, BF_VICTORY);
        return;
    }
    begin_menu_for(b, first_alive_cat());
}

static void after_player_action(Battle *b)
{
    if (alive_enemies(b) == 0) {
        set_phase(b, BF_VICTORY);
        return;
    }
    int nxt = next_cat_actor(b, b->actor);
    if (nxt >= 0)
        begin_menu_for(b, nxt);
    else
        begin_enemy_round(b);
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

void battle_init(Battle *b, const uint8_t formation[3], uint32_t seed,
                 bool boss)
{
    for (int i = 0; i < 24; i++)
        b->ev[i] = (BtlEvent){ 0 };
    b->ev_head = b->ev_tail = 0;
    b->rngs = seed | 1;
    b->n_en = 0;
    b->is_boss = boss;
    for (int i = 0; i < 3; i++) {
        if (formation[i] == 255)
            continue;
        const SpeciesDef *sd = &species_defs[formation[i]];
        BEnemy *e = &b->en[b->n_en++];
        e->species = formation[i];
        e->hp = e->hpmax = sd->hp;
        e->fue = sd->fue;
        e->def = sd->def;
        e->vel = sd->vel;
        e->alive = true;
    }
    b->hierba[0] = b->hierba[1] = 0;
    b->result = 0;
    b->lv_pending[0] = b->lv_pending[1] = 0;
    b->drop_item = -1;
    set_phase(b, BF_INTRO);
}

// ---------------------------------------------------------------------------
// fases del jugador
// ---------------------------------------------------------------------------

static void start_player_attack(Battle *b)
{
    b->pressed = false;
    b->bounce = false;
    b->rating = RT_REGULAR;
    b->impact_t = (b->action == ACT_SALTO) ? 28 : 22;
    set_phase(b, BF_PLAYER_ACT);
}

static void resolve_attack_hit(Battle *b)
{
    int mult;
    switch (b->rating) {
    case RT_EXCELENTE: mult = 150; break;
    case RT_BIEN:      mult = 100; break;
    case RT_REGULAR:   mult = 60; break;
    default:           mult = 50; break;
    }
    if (b->action == ACT_ZARPAZO)
        mult = mult * 125 / 100;
    int dmg = damage_calc(b, cat_fue(b, b->actor),
                          b->en[b->target_sel].def, mult);
    hurt_enemy(b, b->target_sel, dmg);
    push(b, BE_SFX, BSFX_GOLPE, 0, NULL);
    if (b->rating == RT_EXCELENTE)
        push(b, BE_RATING, RT_EXCELENTE, b->actor, NULL);
    else if (b->rating == RT_BIEN)
        push(b, BE_RATING, RT_BIEN, b->actor, NULL);
}

static void tick_player_act(Battle *b, uint16_t kdown)
{
    uint16_t mybtn = (b->actor == 0) ? BK_A : BK_B;
    // ventana de comando de acción
    if (!b->pressed && (kdown & mybtn)) {
        int dt = b->t - b->impact_t;
        b->pressed = true;
        if (dt >= -4 && dt <= 1) {
            b->rating = RT_EXCELENTE;
            push(b, BE_SFX, BSFX_EXCELENTE, 0, NULL);
        } else if (dt >= -9 && dt <= 3) {
            b->rating = RT_BIEN;
            push(b, BE_SFX, BSFX_BIEN, 0, NULL);
        } else {
            b->rating = RT_REGULAR;
        }
    }
    if (b->t == b->impact_t) {
        if (!b->pressed)
            b->rating = RT_FALLO;
        resolve_attack_hit(b);
        if (b->action == ACT_SALTO && b->rating == RT_EXCELENTE &&
            b->en[b->target_sel].alive) {
            b->bounce = true;
        }
    }
    // segundo bote del salto excelente
    if (b->bounce && b->t == b->impact_t + 20) {
        int dmg = damage_calc(b, cat_fue(b, b->actor),
                              b->en[b->target_sel].def, 75);
        hurt_enemy(b, b->target_sel, dmg);
        push(b, BE_SFX, BSFX_GOLPE, 0, NULL);
    }
    int total = b->impact_t + (b->bounce ? 40 : 26);
    if (b->t >= total)
        after_player_action(b);
}

static void tick_special(Battle *b, uint16_t kdown)
{
    // Bola de Pelo Gemela: machaca A/B alternando; remate con A
    const int CHARGE = 140, WINDOW = 14;
    if (b->t < CHARGE) {
        if ((kdown & BK_A) && b->last_btn != BK_A) {
            b->mash++;
            b->last_btn = BK_A;
            push(b, BE_SFX, BSFX_MENU, 0, NULL);
        } else if ((kdown & BK_B) && b->last_btn != BK_B) {
            b->mash++;
            b->last_btn = BK_B;
            push(b, BE_SFX, BSFX_MENU, 0, NULL);
        }
        if (b->mash > 40)
            b->mash = 40;
    } else if (b->t < CHARGE + WINDOW) {
        if (!b->pressed && (kdown & BK_A)) {
            b->pressed = true;
            b->rating = (b->t - CHARGE <= 8) ? RT_EXCELENTE : RT_BIEN;
            push(b, BE_SFX, b->rating == RT_EXCELENTE ?
                 BSFX_EXCELENTE : BSFX_BIEN, 0, NULL);
        }
    } else if (b->t == CHARGE + WINDOW) {
        // impacto sobre TODOS los enemigos
        int power = 60 + b->mash * 100 / 40;             // 60%..160%
        if (b->pressed && b->rating == RT_EXCELENTE)
            power = power * 120 / 100;
        else if (!b->pressed)
            power = power * 70 / 100;
        int atk = cat_fue(b, 0) + cat_fue(b, 1);
        push(b, BE_SHAKE, 0, 0, NULL);
        push(b, BE_SFX, BSFX_GOLPE, 0, NULL);
        if (b->pressed && b->rating == RT_EXCELENTE)
            push(b, BE_RATING, RT_EXCELENTE, 0, NULL);
        for (int i = 0; i < b->n_en; i++)
            if (b->en[i].alive)
                hurt_enemy(b, i, damage_calc(b, atk, b->en[i].def,
                                             power / 2));
    } else if (b->t >= CHARGE + WINDOW + 30) {
        after_player_action(b);
    }
}

static void use_item(Battle *b, int item)
{
    int cat = b->actor;
    // objetivo implícito sensato
    switch (item) {
    case IT_CROQUETA:
    case IT_CROQUETON: {
        // al más herido vivo
        int target = cat;
        if (party[1 - cat].hp > 0 &&
            (party[cat].hp == 0 ||
             (int)party[1 - cat].hpmax - party[1 - cat].hp >
             (int)party[cat].hpmax - party[cat].hp))
            target = 1 - cat;
        int heal = (item == IT_CROQUETA) ? 30 : 80;
        CatStats *c = &party[target];
        int real = (c->hp + heal > c->hpmax) ? c->hpmax - c->hp : heal;
        c->hp += real;
        push(b, BE_HEAL_CAT, target, real, NULL);
        push(b, BE_SFX, BSFX_CURAR, 0, NULL);
        break;
    }
    case IT_ATUN: {
        int target = (party[0].hp == 0) ? 0 : 1;
        if (party[target].hp > 0)
            break;
        party[target].hp = party[target].hpmax / 2;
        push(b, BE_HEAL_CAT, target, party[target].hp, NULL);
        push(b, BE_SFX, BSFX_CURAR, 0, NULL);
        break;
    }
    case IT_HIERBA:
        b->hierba[cat] = 1;
        push(b, BE_MSG, 0, 0, "¡FUE aumentada!");
        push(b, BE_SFX, BSFX_CURAR, 0, NULL);
        break;
    case IT_PELOTA: {
        CatStats *c = &party[cat];
        int real = (c->pe + 10 > c->pemax) ? c->pemax - c->pe : 10;
        c->pe += real;
        push(b, BE_HEAL_CAT, cat, -real, NULL);
        push(b, BE_SFX, BSFX_CURAR, 0, NULL);
        break;
    }
    }
}

static void tick_menu(Battle *b, uint16_t kdown)
{
    if (kdown & (BK_LEFT | BK_UP)) {
        b->menu_sel = (b->menu_sel + ACT_MENU_N - 1) % ACT_MENU_N;
        push(b, BE_SFX, BSFX_MENU, 0, NULL);
    }
    if (kdown & (BK_RIGHT | BK_DOWN)) {
        b->menu_sel = (b->menu_sel + 1) % ACT_MENU_N;
        push(b, BE_SFX, BSFX_MENU, 0, NULL);
    }
    if (!(kdown & BK_A))
        return;
    push(b, BE_SFX, BSFX_OK, 0, NULL);
    b->action = b->menu_sel;
    switch (b->menu_sel) {
    case ACT_SALTO:
    case ACT_ZARPAZO:
        // primer enemigo vivo como objetivo inicial
        b->target_sel = 0;
        while (!b->en[b->target_sel].alive)
            b->target_sel++;
        set_phase(b, BF_TARGET);
        break;
    case ACT_ESPECIAL:
        if (alive_cats() < 2) {
            push(b, BE_MSG, 0, 0, "¡Hacen falta los dos gatos!");
        } else if (party[0].pe < 4 || party[1].pe < 4) {
            push(b, BE_MSG, 0, 0, "No hay PE suficientes (4 y 4).");
        } else {
            party[0].pe -= 4;
            party[1].pe -= 4;
            b->mash = 0;
            b->last_btn = 0;
            b->pressed = false;
            b->rating = RT_REGULAR;
            set_phase(b, BF_SPECIAL);
        }
        break;
    case ACT_OBJETOS:
        b->item_sel = 0;
        set_phase(b, BF_ITEMS);
        break;
    case ACT_HUIR: {
        if (b->is_boss) {
            push(b, BE_MSG, 0, 0, "¡De un jefe no se huye!");
            break;
        }
        int evel = 0;
        for (int i = 0; i < b->n_en; i++)
            if (b->en[i].alive && b->en[i].vel > evel)
                evel = b->en[i].vel;
        int chance = 50 + ((int)party[0].vel + party[1].vel) / 2 * 3
                     - evel * 3;
        if (brange(b, 0, 99) < chance) {
            b->result = 3;
            set_phase(b, BF_DONE);
        } else {
            push(b, BE_FLEE_FAIL, 0, 0, NULL);
            push(b, BE_MSG, 0, 0, "¡No hay escapatoria!");
            begin_enemy_round(b);
        }
        break;
    }
    }
}

static void tick_items(Battle *b, uint16_t kdown)
{
    if (kdown & BK_UP) {
        b->item_sel = (b->item_sel + IT_COUNT - 1) % IT_COUNT;
        push(b, BE_SFX, BSFX_MENU, 0, NULL);
    }
    if (kdown & BK_DOWN) {
        b->item_sel = (b->item_sel + 1) % IT_COUNT;
        push(b, BE_SFX, BSFX_MENU, 0, NULL);
    }
    if (kdown & BK_B) {
        push(b, BE_SFX, BSFX_CANCEL, 0, NULL);
        set_phase(b, BF_MENU);
        return;
    }
    if (kdown & BK_A) {
        int it = b->item_sel;
        if (!item_defs[it].battle_usable || inventory[it] == 0) {
            push(b, BE_SFX, BSFX_CANCEL, 0, NULL);
            return;
        }
        if (it == IT_ATUN && party[0].hp > 0 && party[1].hp > 0) {
            push(b, BE_MSG, 0, 0, "Nadie está KO. ¡Ñam ñam evitado!");
            return;
        }
        item_take(it);
        push(b, BE_SFX, BSFX_OK, 0, NULL);
        use_item(b, it);
        after_player_action(b);
    }
}

static void tick_target(Battle *b, uint16_t kdown)
{
    if (kdown & (BK_LEFT | BK_RIGHT | BK_UP | BK_DOWN)) {
        int dir = (kdown & (BK_LEFT | BK_UP)) ? -1 : 1;
        int t = b->target_sel;
        for (int k = 0; k < 3; k++) {
            t = (t + dir + b->n_en) % b->n_en;
            if (b->en[t].alive)
                break;
        }
        if (t != b->target_sel) {
            b->target_sel = t;
            push(b, BE_SFX, BSFX_MENU, 0, NULL);
        }
    }
    if (kdown & BK_B) {
        push(b, BE_SFX, BSFX_CANCEL, 0, NULL);
        set_phase(b, BF_MENU);
        return;
    }
    if (kdown & BK_A) {
        push(b, BE_SFX, BSFX_SALTO, 0, NULL);
        start_player_attack(b);
    }
}

// ---------------------------------------------------------------------------
// turno enemigo
// ---------------------------------------------------------------------------

static void start_enemy_attack(Battle *b)
{
    BEnemy *e = &b->en[b->en_cur];
    const SpeciesDef *sd = &species_defs[e->species];
    b->dodged = false;
    b->feint = false;
    b->hits_left = 1;
    b->next_impact = sd->atk_impact;

    switch (sd->pattern) {
    case 2:     // rebote: golpea a los dos gatos
        b->hits_left = (alive_cats() == 2) ? 2 : 1;
        b->atk_target = first_alive_cat();
        break;
    case 3:     // finta: a veces retrasa el golpe
        if (brange(b, 0, 99) < 45) {
            b->feint = true;
            b->next_impact += 16;
        }
        break;
    case 4: {   // jefe: rota entre palmada doble, giro x3 y golpe fuerte
        bool enraged = e->hp * 100 / e->hpmax < 35;
        b->boss_move = (b->boss_move + 1) % 3;
        if (b->boss_move == 1)
            b->hits_left = (alive_cats() == 2) ? 2 : 1;
        else if (b->boss_move == 2)
            b->hits_left = 3;
        if (b->boss_move == 1)
            b->atk_target = first_alive_cat();
        if (enraged && b->next_impact > 24)
            b->next_impact -= 8;
        break;
    }
    }
    set_phase(b, BF_ENEMY_ACT);
}

static void enemy_hit_resolves(Battle *b)
{
    BEnemy *e = &b->en[b->en_cur];
    const SpeciesDef *sd = &species_defs[e->species];
    int cat = b->atk_target;
    if (party[cat].hp == 0) {
        // objetivo ya KO (p. ej. golpe anterior): pasa al otro
        cat = first_alive_cat();
        b->atk_target = cat;
    }
    if (b->dodged) {
        push(b, BE_DODGE, cat, 0, NULL);
        push(b, BE_SFX, BSFX_ESQUIVA, 0, NULL);
    } else {
        int mult = (sd->pattern == 4 && b->boss_move == 0) ? 130 : 100;
        int dmg = damage_calc(b, e->fue, cat_def_battle(cat), mult);
        hurt_cat(b, cat, dmg);
        push(b, BE_SFX, BSFX_DANO, 0, NULL);
    }
}

static void tick_enemy_act(Battle *b, uint16_t kdown)
{
    int cat = b->atk_target;
    uint16_t mybtn = (cat == 0) ? BK_A : BK_B;

    // ventana de esquiva: saltar justo antes del impacto
    if (!b->dodged && (kdown & mybtn) && party[cat].hp > 0) {
        int dt = b->t - b->next_impact;
        if (dt >= -8 && dt <= 0) {
            b->dodged = true;
            // esquiva perfecta = contraataque
            if (dt >= -4) {
                int dmg = damage_calc(b, cat_fue(b, cat),
                                      b->en[b->en_cur].def, 50);
                push(b, BE_COUNTER, cat, b->en_cur, NULL);
                hurt_enemy(b, b->en_cur, dmg);
            }
        } else if (dt < -8 && dt >= -20) {
            // salto demasiado pronto: se queda vendido (nada)
            push(b, BE_SFX, BSFX_SALTO, 0, NULL);
        }
    }

    if (b->t == b->next_impact) {
        enemy_hit_resolves(b);
        b->hits_left--;
        if (b->hits_left > 0 && alive_cats() > 0) {
            // siguiente golpe del patrón
            b->next_impact = b->t + 22;
            b->dodged = false;
            // alternar objetivo si hay dos gatos
            if (alive_cats() == 2)
                b->atk_target = 1 - b->atk_target;
            else
                b->atk_target = first_alive_cat();
        }
    }
    if (!b->en[b->en_cur].alive) {
        // murió por un contraataque a mitad de ataque
        next_enemy_or_menu(b);
        return;
    }
    if (b->t >= b->next_impact + 26 && b->hits_left <= 0)
        next_enemy_or_menu(b);
}

// ---------------------------------------------------------------------------
// victoria, ruleta y derrota
// ---------------------------------------------------------------------------

static void begin_victory(Battle *b)
{
    uint32_t pool = 0;
    uint16_t coins = 0;
    for (int i = 0; i < b->n_en; i++) {
        pool += species_defs[b->en[i].species].exp;
        coins += species_defs[b->en[i].species].chapas;
    }
    int nal = alive_cats();
    b->exp_each = nal ? pool / nal : 0;
    b->drop_chapas = coins;
    chapas = (chapas + coins > 9999) ? 9999 : chapas + coins;
    push(b, BE_EXP, (int)b->exp_each, 0, NULL);
    push(b, BE_CHAPAS, coins, 0, NULL);
    // botín ocasional
    if (brange(b, 0, 99) < 25) {
        b->drop_item = brange(b, 0, 99) < 70 ? IT_CROQUETA : IT_PELOTA;
        if (item_give(b->drop_item, 1))
            push(b, BE_ITEM_DROP, b->drop_item, 0, NULL);
        else
            b->drop_item = -1;
    }
    for (int c = 0; c < 2; c++) {
        if (party[c].hp == 0)
            continue;
        int ups = player_grant_exp(c, b->exp_each);
        b->lv_pending[c] = ups;
        if (ups)
            push(b, BE_LEVELUP, c, party[c].level, NULL);
    }
}

static void begin_roulette_if_any(Battle *b)
{
    for (int c = 0; c < 2; c++) {
        if (b->lv_pending[c] > 0) {
            b->lv_cat = c;
            b->lv_pending[c]--;
            b->wheel_pos = 0;
            b->wheel_t = 0;
            set_phase(b, BF_ROULETTE);
            return;
        }
    }
    b->result = 1;
    set_phase(b, BF_DONE);
}

static void tick_roulette(Battle *b, uint16_t kdown)
{
    b->wheel_t++;
    if ((b->wheel_t & 7) == 0) {
        b->wheel_pos = (b->wheel_pos + 1) % 5;
        push(b, BE_SFX, BSFX_MENU, 0, NULL);
    }
    if (kdown & BK_A) {
        int roll = brange(b, 0, 99);
        int amount = roll < 50 ? 1 : (roll < 85 ? 2 : 3);
        player_apply_bonus(b->lv_cat, b->wheel_pos, amount);
        push(b, BE_BONUS, b->wheel_pos, amount, NULL);
        push(b, BE_SFX, BSFX_NIVEL, 0, NULL);
        begin_roulette_if_any(b);
    }
}

// ---------------------------------------------------------------------------
// tick principal
// ---------------------------------------------------------------------------

void battle_tick(Battle *b, uint16_t kdown, uint16_t kheld)
{
    (void)kheld;
    if (b->result && b->phase == BF_DONE)
        return;
    b->t++;

    switch (b->phase) {
    case BF_INTRO:
        if (b->t >= 40)
            begin_menu_for(b, first_alive_cat());
        break;
    case BF_MENU:
        tick_menu(b, kdown);
        break;
    case BF_ITEMS:
        tick_items(b, kdown);
        break;
    case BF_TARGET:
        tick_target(b, kdown);
        break;
    case BF_PLAYER_ACT:
        tick_player_act(b, kdown);
        break;
    case BF_SPECIAL:
        tick_special(b, kdown);
        break;
    case BF_ENEMY_TELE:
        if (b->t == 1)
            push(b, BE_SFX, BSFX_MENU, 0, NULL);
        if (b->t >= 45)
            start_enemy_attack(b);
        break;
    case BF_ENEMY_ACT:
        tick_enemy_act(b, kdown);
        break;
    case BF_VICTORY:
        if (b->t == 1)
            begin_victory(b);
        if (b->t >= 90)
            begin_roulette_if_any(b);
        break;
    case BF_ROULETTE:
        tick_roulette(b, kdown);
        break;
    case BF_DEFEAT:
        if (b->t >= 60) {
            b->result = 2;
            set_phase(b, BF_DONE);
        }
        break;
    case BF_DONE:
        break;
    }
}
