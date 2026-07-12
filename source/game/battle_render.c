#include <stdio.h>
#include <string.h>
#include "battle_render.h"
#include "battle_core.h"
#include "video.h"
#include "text.h"
#include "sprites.h"
#include "audio.h"
#include "fx.h"
#include "game.h"

#include "scn_bg_battle_jardin_bin.h"
#include "scn_bg_battle_colon_bin.h"

static Battle btl;
static bool is_interior;
static int end_timer;
static char msg[40];
static int msg_t;
static int banner_id = -1, banner_t, banner_x, banner_y;
static int intro_music_done;

// posición base (pies) de cada combatiente
#define GROUND_Y 140

static const u8 species_sheet[SP_COUNT] = {
    [SP_PULGON] = SH_PULGON,
    [SP_SEMILLA] = SH_SEMILLA,
    [SP_BACTERIOLO] = SH_BACTERIOLO,
    [SP_GUSANILLO] = SH_GUSANILLO,
    [SP_TAPON] = SH_TAPON,
};

static int enemy_cx(int i)
{
    if (btl.n_en == 1)
        return 56;
    return 34 + i * 40;
}

static int cat_home_x(int cat) { return cat == 0 ? 172 : 206; }
static int cat_home_y(int cat) { return cat == 0 ? GROUND_Y : GROUND_Y + 10; }

// ---------------------------------------------------------------------------
// UI en el layer de texto
// ---------------------------------------------------------------------------

static const char *const menu_labels[ACT_MENU_N] = {
    "Salto", "Zarpazo", "Especial", "Objetos", "Huir"
};

static void draw_panels(void)
{
    u16 *map = video_text_map_main();
    txt_clear(map, 0, 16, 32, 8);
    txt_box(map, 0, 18, 32, 6);
    // paneles de los gatos
    txt_draw(map, 2, 19, "Benito", TXT_DARK);
    txt_draw(map, 17, 19, "Silva", TXT_DARK);
    char buf[16];
    for (int c = 0; c < 2; c++) {
        int x = c ? 17 : 2;
        txt_draw(map, x, 20, "PV", TXT_DARK);
        txt_bar(map, x + 2, 20, 5, party[c].hp, party[c].hpmax, 0);
        snprintf(buf, sizeof(buf), "%d", party[c].hp);
        txt_fill_box(map, x + 8, 20, 4, 1);
        txt_draw(map, x + 8, 20, buf, TXT_DARK);
        txt_draw(map, x, 21, "PE", TXT_DARK);
        txt_bar(map, x + 2, 21, 5, party[c].pe, party[c].pemax, 1);
        snprintf(buf, sizeof(buf), "%d", party[c].pe);
        txt_fill_box(map, x + 8, 21, 4, 1);
        txt_draw(map, x + 8, 21, buf, TXT_DARK);
    }
}

static void draw_menu(void)
{
    u16 *map = video_text_map_main();
    txt_fill_box(map, 1, 22, 30, 1);
    if (btl.phase == BF_MENU) {
        int x = 2;
        for (int i = 0; i < ACT_MENU_N; i++) {
            txt_draw(map, x, 22, menu_labels[i], TXT_DARK);
            if (i == btl.menu_sel) {
                // subrayado con el color del gato actual
                txt_draw(map, x - 1, 22, "→", TXT_DARK);
            }
            x += txt_width(menu_labels[i]) + 1;
        }
    } else if (btl.phase == BF_ITEMS) {
        char buf[34];
        const ItemDef *d = &item_defs[btl.item_sel];
        snprintf(buf, sizeof(buf), "→%s ×%d  %s", d->name,
                 inventory[btl.item_sel], d->desc);
        txt_draw(map, 1, 22, buf, TXT_DARK);
    } else if (btl.phase == BF_TARGET) {
        txt_draw(map, 2, 22, "¿A quién? (A confirma, B atrás)", TXT_DARK);
    } else if (btl.phase == BF_SPECIAL) {
        txt_draw(map, 2, 22, "¡Alterna A y B! Remata con A", TXT_DARK);
    } else if (btl.phase == BF_ROULETTE) {
        u16 *m = map;
        static const char *const stats[5] =
            { "PV", "PE", "FUE", "DEF", "VEL" };
        int x = 3;
        txt_draw(m, 2, 22, "→", TXT_DARK);
        for (int i = 0; i < 5; i++) {
            char buf[8];
            if (i == btl.wheel_pos)
                snprintf(buf, sizeof(buf), "×%s×", stats[i]);
            else
                snprintf(buf, sizeof(buf), " %s ", stats[i]);
            txt_draw(m, x, 22, buf, TXT_DARK);
            x += 5;
        }
    }
    // mensaje flotante
    txt_clear(map, 1, 17, 31, 1);
    if (msg_t > 0)
        txt_draw(map, 2, 17, msg, TXT_LIGHT);
}

static void hud_enemies(void)
{
    u16 *map = video_text_map_sub();
    txt_clear(map, 1, 15, 30, 8);
    txt_draw(map, 2, 15, "Enemigos:", TXT_LIGHT);
    for (int i = 0; i < btl.n_en; i++) {
        const SpeciesDef *sd = &species_defs[btl.en[i].species];
        txt_draw(map, 2, 17 + i * 2, sd->name, TXT_LIGHT);
        if (btl.en[i].alive)
            txt_bar(map, 22, 17 + i * 2, 6, btl.en[i].hp,
                    btl.en[i].hpmax, 0);
        else
            txt_draw(map, 22, 17 + i * 2, "KO", TXT_LIGHT);
    }
}

static void set_msg(const char *s)
{
    strncpy(msg, s, sizeof(msg) - 1);
    msg[sizeof(msg) - 1] = 0;
    msg_t = 110;
}

// ---------------------------------------------------------------------------
// eventos del núcleo -> presentación
// ---------------------------------------------------------------------------

static const u8 sfx_map[] = {
    [BSFX_SALTO] = SND_SALTO, [BSFX_GOLPE] = SND_GOLPE,
    [BSFX_EXCELENTE] = SND_EXCELENTE, [BSFX_BIEN] = SND_BIEN,
    [BSFX_DANO] = SND_DANO, [BSFX_MENU] = SND_MENU,
    [BSFX_OK] = SND_OK, [BSFX_CANCEL] = SND_CANCEL,
    [BSFX_CURAR] = SND_CURAR, [BSFX_ESQUIVA] = SND_ESQUIVA,
    [BSFX_KO] = SND_KO, [BSFX_NIVEL] = SND_NIVEL,
    [BSFX_CHAPA] = SND_CHAPA,
};

static void enemy_center(int i, int *x, int *y)
{
    bool big = species_defs[btl.en[i].species].big;
    *x = enemy_cx(i) + (big ? 16 : 0);
    *y = GROUND_Y - (big ? 28 : 14);
}

static void consume_events(void)
{
    BtlEvent e;
    char buf[40];
    while (battle_pop_event(&btl, &e)) {
        switch (e.type) {
        case BE_MSG:
            set_msg(e.str);
            break;
        case BE_DMG_ENEMY: {
            int x, y;
            enemy_center(e.a, &x, &y);
            fx_damage(x, y - 10, e.b, false);
            fx_stars(x, y);
            break;
        }
        case BE_DMG_CAT:
            fx_damage(cat_home_x(e.a), cat_home_y(e.a) - 34, e.b, false);
            fx_stars(cat_home_x(e.a), cat_home_y(e.a) - 16);
            fx_shake(8, 2);
            break;
        case BE_HEAL_CAT:
            fx_damage(cat_home_x(e.a), cat_home_y(e.a) - 34,
                      e.b < 0 ? -e.b : e.b, true);
            fx_sparkle(cat_home_x(e.a), cat_home_y(e.a) - 20);
            break;
        case BE_RATING:
            banner_id = (e.a == RT_EXCELENTE) ? SPRF_BANNERS_EXCELENTE
                                              : SPRF_BANNERS_BIEN;
            banner_t = 50;
            banner_x = cat_home_x(e.b) - 40;
            banner_y = cat_home_y(e.b) - 60;
            break;
        case BE_SFX:
            sfx(sfx_map[e.a]);
            break;
        case BE_SHAKE:
            fx_shake(14, 3);
            break;
        case BE_ENEMY_DIE: {
            int x, y;
            enemy_center(e.a, &x, &y);
            fx_stars(x, y);
            fx_stars(x + 6, y - 6);
            sfx(SND_KO);
            break;
        }
        case BE_CAT_KO:
            sfx(SND_KO);
            snprintf(buf, sizeof(buf), "¡%s está KO!",
                     e.a == 0 ? "Benito" : "Silva");
            set_msg(buf);
            break;
        case BE_COUNTER:
            snprintf(buf, sizeof(buf), "¡Contraataque de %s!",
                     e.a == 0 ? "Benito" : "Silva");
            set_msg(buf);
            break;
        case BE_DODGE:
            fx_sparkle(cat_home_x(e.a), cat_home_y(e.a) - 24);
            break;
        case BE_EXP:
            snprintf(buf, sizeof(buf), "¡Victoria! +%d EXP cada uno",
                     e.a);
            set_msg(buf);
            music_play(MUS_VICTORIA);
            break;
        case BE_CHAPAS:
            if (e.a) {
                sfx(SND_CHAPA);
                fx_sparkle(128, 100);
            }
            break;
        case BE_ITEM_DROP:
            snprintf(buf, sizeof(buf), "¡Ha caído: %s!",
                     item_defs[e.a].name);
            set_msg(buf);
            break;
        case BE_LEVELUP:
            snprintf(buf, sizeof(buf), "¡%s sube a nivel %d!",
                     e.a == 0 ? "Benito" : "Silva", e.b);
            set_msg(buf);
            sfx(SND_NIVEL);
            break;
        case BE_BONUS: {
            static const char *const stats[5] =
                { "PV", "PE", "FUE", "DEF", "VEL" };
            snprintf(buf, sizeof(buf), "¡Bonus! %s +%d", stats[e.a],
                     e.a == 0 ? e.b * 2 : e.b);
            set_msg(buf);
            break;
        }
        case BE_FLEE_FAIL:
            sfx(SND_CANCEL);
            break;
        }
        hud_enemies();
        draw_panels();
    }
}

// ---------------------------------------------------------------------------
// dibujo de combatientes según fase
// ---------------------------------------------------------------------------

// parábola simple 0..1 -> altura de arco
static int arc(int t, int total, int height)
{
    if (total <= 0)
        return 0;
    int half = total / 2;
    int dt = t - half;
    return height - (height * dt * dt) / (half * half);
}

static void draw_cat(int cat)
{
    const CatStats *c = &party[cat];
    int sheet = (cat == 0) ? SH_BENITO : SH_SILVA;
    int x = cat_home_x(cat), y = cat_home_y(cat);
    int frame;
    int t = btl.t;
    bool acting = (btl.phase == BF_PLAYER_ACT && btl.actor == cat);

    if (c->hp == 0) {
        frame = SPRF_BENITO_KO;
        spr_draw(sheet, frame, x - 16, y - 24, false, 1);
        return;
    }

    if (btl.phase == BF_INTRO) {
        int start = 260 + cat * 24;
        int cx = start + (x - start) * clampi(t, 0, 34) / 34;
        frame = SPRF_BENITO_WALK_SIDE0 + ((t >> 3) & 3);
        spr_draw(sheet, frame, cx - 16, y - 30, false, 1);
        return;
    }

    if (acting) {
        int ex, ey;
        enemy_center(btl.target_sel, &ex, &ey);
        if (btl.action == ACT_SALTO) {
            int T = btl.impact_t;
            if (t <= T) {
                int cx = x + (ex - x) * t / T;
                int cy = y - arc(t, T, 46);
                frame = (t < T / 2) ? SPRF_BENITO_JUMP : SPRF_BENITO_FALL;
                spr_draw(sheet, frame, cx - 16, cy - 30, false, 1);
            } else if (btl.bounce && t <= T + 20) {
                int tt = t - T;
                int cx = ex + (ex - ex) + 8;
                int cy = ey - arc(tt, 20, 30);
                frame = (tt < 10) ? SPRF_BENITO_JUMP : SPRF_BENITO_FALL;
                spr_draw(sheet, frame, cx - 16, cy - 30, false, 1);
            } else {
                int tt = clampi(t - T - (btl.bounce ? 20 : 0), 0, 20);
                int cx = ex + (x - ex) * tt / 20;
                int cy = y - arc(tt, 20, 24);
                frame = SPRF_BENITO_JUMP;
                spr_draw(sheet, frame, cx - 16, cy - 30, tt > 4, 1);
            }
            return;
        }
        if (btl.action == ACT_ZARPAZO) {
            int T = btl.impact_t;
            if (t <= T - 6) {
                int cx = x + (ex + 20 - x) * t / (T - 6);
                frame = SPRF_BENITO_WALK_SIDE0 + ((t >> 2) & 3);
                spr_draw(sheet, frame, cx - 16, y - 30, false, 1);
            } else if (t <= T + 8) {
                frame = (t <= T) ? SPRF_BENITO_ATK_CLAW0
                                 : SPRF_BENITO_ATK_CLAW1;
                spr_draw(sheet, frame, ex + 6, y - 30, false, 1);
            } else {
                int tt = clampi(t - T - 8, 0, 16);
                int cx = ex + 20 + (x - ex - 20) * tt / 16;
                frame = SPRF_BENITO_WALK_SIDE0 + ((t >> 2) & 3);
                spr_draw(sheet, frame, cx - 16, y - 30, true, 1);
            }
            return;
        }
    }

    if (btl.phase == BF_SPECIAL) {
        // bola rodante gigante: los dos gatos giran juntos
        int cx = 190 - (btl.t / 3) % 12, cy = GROUND_Y - 20;
        if (btl.t >= 140) {
            int ex, ey;
            enemy_center(0, &ex, &ey);
            int tt = clampi(btl.t - 140, 0, 14);
            cx = cx + (ex - cx) * tt / 14;
            cy = cy - arc(tt, 14, 30);
        }
        frame = ((btl.t >> 2) & 1) ? SPRF_BENITO_JUMP : SPRF_BENITO_FALL;
        if (cat == 1)
            spr_draw(sheet, frame, cx - 16 + 6, cy - 24, (btl.t >> 2) & 1, 1);
        else
            spr_draw(sheet, frame, cx - 16 - 6, cy - 30, !((btl.t >> 2) & 1), 1);
        if ((btl.t & 3) == 0)
            fx_puff(cx, cy + 8, -FXF(0.2f));
        return;
    }

    // esquiva: salto en el sitio
    if (btl.phase == BF_ENEMY_ACT && btl.atk_target == cat && btl.dodged) {
        int dt = clampi(btl.next_impact + 8 - t, 0, 16);
        int cy = y - arc(16 - dt, 16, 34);
        spr_draw(sheet, SPRF_BENITO_JUMP, x - 16, cy - 30, false, 1);
        return;
    }
    // recibiendo golpe
    if (btl.phase == BF_ENEMY_ACT && btl.atk_target == cat &&
        t >= btl.next_impact && t < btl.next_impact + 12 && !btl.dodged) {
        spr_draw(sheet, SPRF_BENITO_HURT, x - 16, y - 30, false, 1);
        return;
    }

    if (btl.phase == BF_VICTORY || btl.phase == BF_ROULETTE) {
        frame = ((btl.t >> 4) & 1) ? SPRF_BENITO_VICTORY0
                                   : SPRF_BENITO_VICTORY1;
        spr_draw(sheet, frame, x - 16, y - 30, false, 1);
        return;
    }

    // idle; el gato con turno bota suavemente
    bool my_turn = (btl.phase == BF_MENU || btl.phase == BF_ITEMS ||
                    btl.phase == BF_TARGET) && btl.actor == cat;
    frame = ((btl.t >> 4) & 1) ? SPRF_BENITO_IDLE_SIDE1
                               : SPRF_BENITO_IDLE_SIDE0;
    int bob = my_turn ? -(arc(btl.t % 30, 30, 4)) : 0;
    spr_draw(sheet, frame, x - 16, y - 30 + bob, false, 1);
}

static void draw_enemy(int i)
{
    BEnemy *e = &btl.en[i];
    if (!e->alive)
        return;
    const SpeciesDef *sd = &species_defs[e->species];
    int sheet = species_sheet[e->species];
    bool big = sd->big;
    int size = big ? 64 : 32;
    int x = enemy_cx(i);                 // borde izquierdo del sprite
    int y = GROUND_Y - size + (big ? 12 : 4);
    int frame = ((btl.t >> 4) & 1) ? 1 : 0;   // idle0/idle1

    if (btl.phase == BF_ENEMY_TELE && btl.en_cur == i) {
        frame = 2;      // telegraph
        if ((btl.t >> 3) & 1)
            spr_draw(SH_FX, SPRF_FX_EXCL, x + size / 2 - 8, y - 14,
                     false, 0);
        // flecha sobre el gato objetivo
        spr_draw(SH_FX, (btl.t & 16) ? SPRF_FX_ARROW0 : SPRF_FX_ARROW1,
                 cat_home_x(btl.atk_target) - 8,
                 cat_home_y(btl.atk_target) - 54, false, 0);
    } else if (btl.phase == BF_ENEMY_ACT && btl.en_cur == i) {
        frame = 3;      // attack
        // embestida hacia el objetivo
        int T = btl.next_impact;
        int tx = cat_home_x(btl.atk_target) - size / 2 - 10;
        if (btl.t <= T) {
            x = x + (tx - x) * clampi(btl.t, 0, T) / T;
            if (sd->pattern == 1 || sd->pattern == 2)
                y -= arc(btl.t, T, 40);
        } else {
            int tt = clampi(btl.t - T, 0, 22);
            x = tx + (x - tx) * tt / 22;
        }
    } else if (btl.phase == BF_PLAYER_ACT && btl.target_sel == i &&
               btl.t >= btl.impact_t && btl.t < btl.impact_t + 12) {
        frame = 4;      // hurt
    }

    spr_draw(sheet, frame, x, y, true, 1);

    // cursor de objetivo
    if (btl.phase == BF_TARGET && btl.target_sel == i) {
        spr_draw(SH_FX, (btl.t & 16) ? SPRF_FX_ARROW0 : SPRF_FX_ARROW1,
                 x + size / 2 - 8, y - 16, false, 0);
    }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

void battle_enter(const u8 formation[3], bool boss, bool interior)
{
    is_interior = interior;
    end_timer = 0;
    msg_t = 0;
    banner_id = -1;
    intro_music_done = 0;

    video_mode_battle();
    video_battle_bitmap(interior ? scn_bg_battle_colon_bin
                                 : scn_bg_battle_jardin_bin);
    spr_arena_reset();
    fx_clear();
    spr_preload(SH_BENITO);
    spr_preload(SH_SILVA);
    spr_preload(SH_FX);
    spr_preload(SH_BANNERS);
    for (int i = 0; i < 3; i++)
        if (formation[i] != 255)
            spr_preload(species_sheet[formation[i]]);

    battle_init(&btl, formation, (u32)(keysHeld() * 2654435761u) ^ 0xBEEF,
                boss);
    music_play(boss ? MUS_JEFE : MUS_COMBATE);

    u16 *map = video_text_map_main();
    txt_fill_screen(map);
    draw_panels();
    game_show_scene(SCN_STATUS);
    hud_enemies();
}

int battle_update(void)
{
    u16 kd = keysDown(), kh = keysHeld();
    u16 bd = 0, bh = 0;
    if (kd & KEY_A) bd |= BK_A;
    if (kd & KEY_B) bd |= BK_B;
    if (kd & KEY_UP) bd |= BK_UP;
    if (kd & KEY_DOWN) bd |= BK_DOWN;
    if (kd & KEY_LEFT) bd |= BK_LEFT;
    if (kd & KEY_RIGHT) bd |= BK_RIGHT;
    if (kh & KEY_A) bh |= BK_A;
    if (kh & KEY_B) bh |= BK_B;

    battle_tick(&btl, bd, bh);
    consume_events();
    if (msg_t > 0)
        msg_t--;
    if ((btl.t & 15) == 0)
        draw_panels();
    draw_menu();

    fx_update();
    spr_begin();
    if (banner_t > 0) {
        banner_t--;
        spr_draw(SH_BANNERS, banner_id, banner_x,
                 banner_y - (50 - banner_t) / 6, false, 0);
    }
    fx_draw(0, 0);
    draw_cat(0);
    draw_cat(1);
    for (int i = 0; i < btl.n_en; i++)
        draw_enemy(i);
    spr_end();

    bgSetScroll(bg_back, fx_shake_x(), fx_shake_y());

    if (btl.result && btl.phase == BF_DONE) {
        end_timer++;
        if (end_timer > 30)
            return btl.result;
    }
    return 0;
}

void battle_exit(void)
{
    u16 *map = video_text_map_main();
    txt_fill_screen(map);
    txt_fill_screen(video_text_map_sub());
    fx_clear();
}
