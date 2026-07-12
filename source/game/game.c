#include <stdio.h>
#include <string.h>
#include "game.h"
#include "video.h"
#include "text.h"
#include "sprites.h"
#include "audio.h"
#include "save.h"
#include "fx.h"
#include "dialog.h"
#include "cutscene.h"
#include "map.h"
#include "player.h"
#include "items.h"
#include "overworld.h"
#include "battle_render.h"
#include "scripts.h"

#include "scn_scene_jardin_bin.h"
#include "scn_scene_caos_bin.h"
#include "scn_scene_consejo_bin.h"
#include "scn_scene_colon_bin.h"
#include "scn_scene_cerebro_bin.h"
#include "scn_scene_title_bin.h"
#include "scn_scene_status_bin.h"

static int state = GS_TITLE;
static u8 flags[FL_COUNT];

// peticiones diferidas
static int req_room = -1, req_mx, req_my;
static u8 req_form[3];
static bool req_battle, req_boss;
static bool battle_was_boss;

// título
static int title_sel;
static bool title_has_save;
static int title_t;

static const char *const room_names[ROOM_COUNT] = {
    "Césped Central", "Recto de Deedee", "Colon Bajo", "Antro del Tapón",
};

// ---------------------------------------------------------------------------
// flags y escenas
// ---------------------------------------------------------------------------

int game_flag(int idx)
{
    return flags[idx];
}

void game_set_flag(int idx, int val)
{
    flags[idx] = (u8)val;
}

void game_show_scene(int id)
{
    static const u8 *const scenes[] = {
        [SCN_JARDIN] = scn_scene_jardin_bin,
        [SCN_CAOS] = scn_scene_caos_bin,
        [SCN_CONSEJO] = scn_scene_consejo_bin,
        [SCN_COLON] = scn_scene_colon_bin,
        [SCN_CEREBRO] = scn_scene_cerebro_bin,
        [SCN_TITLE] = scn_scene_title_bin,
        [SCN_STATUS] = scn_scene_status_bin,
    };
    video_show_scene(scenes[id]);
    if (id == SCN_STATUS)
        hud_refresh();
    else
        txt_fill_screen(video_text_map_sub());
}

void hud_refresh(void)
{
    if (state == GS_BATTLE)
        return;     // el combate pinta su propio HUD superior
    u16 *map = video_text_map_sub();
    txt_fill_screen(map);
    char buf[32];
    // panel inferior sobre la escena
    for (int c = 0; c < 2; c++) {
        int y = 19 + c * 2;
        snprintf(buf, sizeof(buf), "%-7s Nv%-2d",
                 c == 0 ? "Benito" : "Silva", party[c].level);
        txt_draw(map, 1, y, buf, TXT_LIGHT);
        txt_bar(map, 13, y, 5, party[c].hp, party[c].hpmax, 0);
        snprintf(buf, sizeof(buf), "%d", party[c].hp);
        txt_draw(map, 19, y, buf, TXT_LIGHT);
        txt_bar(map, 23, y, 4, party[c].pe, party[c].pemax, 1);
        snprintf(buf, sizeof(buf), "%d", party[c].pe);
        txt_draw(map, 28, y, buf, TXT_LIGHT);
    }
    int room = ow_room();
    if (room >= 0 && room < ROOM_COUNT) {
        txt_draw(map, 1, 17, room_names[room], TXT_LIGHT);
    }
    snprintf(buf, sizeof(buf), "Chapas %d", chapas);
    txt_draw(map, 22, 17, buf, TXT_LIGHT);
}

// ---------------------------------------------------------------------------
// peticiones diferidas
// ---------------------------------------------------------------------------

void game_request_room(int room, int mx, int my)
{
    req_room = room;
    req_mx = mx;
    req_my = my;
}

void game_request_battle(const u8 formation[3], bool boss)
{
    memcpy(req_form, formation, 3);
    req_battle = true;
    req_boss = boss;
}

void game_request_state(int s)
{
    state = s;
}

int game_current_room(void)
{
    return ow_room();
}

void game_party_warp(int mx, int my)
{
    ow_warp(mx, my);
}

// ---------------------------------------------------------------------------
// guardado
// ---------------------------------------------------------------------------

bool game_save(void)
{
    SaveData d;
    memset(&d, 0, sizeof(d));
    for (int c = 0; c < 2; c++) {
        d.cat[c].level = party[c].level;
        d.cat[c].fue = party[c].fue;
        d.cat[c].def = party[c].def;
        d.cat[c].vel = party[c].vel;
        d.cat[c].hp = party[c].hp;
        d.cat[c].hpmax = party[c].hpmax;
        d.cat[c].pe = party[c].pe;
        d.cat[c].pemax = party[c].pemax;
        d.cat[c].exp = party[c].exp;
        d.cat[c].bonus_fue = party[c].bonus_fue;
        d.cat[c].bonus_def = party[c].bonus_def;
        d.cat[c].bonus_vel = party[c].bonus_vel;
        d.cat[c].bonus_hp = party[c].bonus_hp;
        d.cat[c].bonus_pe = party[c].bonus_pe;
    }
    d.chapas = chapas;
    for (int i = 0; i < IT_COUNT && i < SAVE_NITEMS; i++)
        d.inventory[i] = inventory[i];
    // collares en flags reservados del final
    d.flags[SAVE_NFLAGS - 1] = (party[0].collar ? 1 : 0) |
                               (party[1].collar ? 2 : 0);
    for (int i = 0; i < FL_COUNT; i++)
        d.flags[i] = flags[i];
    d.room = (u8)ow_room();
    int px, py;
    ow_party_pos(&px, &py);
    d.px = (u16)px;
    d.py = (u16)py;
    return save_write(&d);
}

bool game_load(void)
{
    SaveData d;
    if (!save_read(&d))
        return false;
    player_init_new();
    for (int c = 0; c < 2; c++) {
        party[c].level = d.cat[c].level ? d.cat[c].level : 1;
        party[c].exp = d.cat[c].exp;
        party[c].bonus_fue = d.cat[c].bonus_fue;
        party[c].bonus_def = d.cat[c].bonus_def;
        party[c].bonus_vel = d.cat[c].bonus_vel;
        party[c].bonus_hp = d.cat[c].bonus_hp;
        party[c].bonus_pe = d.cat[c].bonus_pe;
        // recalcular stats por nivel: grant 0 exp fuerza recálculo
    }
    // reconstruir stats derivados aplicando el nivel
    for (int c = 0; c < 2; c++) {
        u8 lvl = party[c].level;
        party[c].level = 1;
        u32 exp = party[c].exp;
        party[c].exp = 0;
        // subir nivel a nivel sin ruleta (los bonus ya vienen guardados)
        while (party[c].level < lvl)
            player_grant_exp(c, exp_to_next(party[c].level));
        party[c].exp = exp;
        party[c].hp = d.cat[c].hp > party[c].hpmax ? party[c].hpmax
                                                   : d.cat[c].hp;
        party[c].pe = d.cat[c].pe > party[c].pemax ? party[c].pemax
                                                   : d.cat[c].pe;
    }
    party[0].collar = d.flags[SAVE_NFLAGS - 1] & 1;
    party[1].collar = (d.flags[SAVE_NFLAGS - 1] & 2) != 0;
    chapas = d.chapas;
    for (int i = 0; i < IT_COUNT && i < SAVE_NITEMS; i++)
        inventory[i] = d.inventory[i];
    for (int i = 0; i < FL_COUNT; i++)
        flags[i] = d.flags[i];
    int room = d.room < ROOM_COUNT ? d.room : 0;
    state = GS_OVERWORLD;
    ow_enter_room(room, d.px / 16, d.py / 16);
    return true;
}

void game_new(void)
{
    memset(flags, 0, sizeof(flags));
    memset(inventory, 0, sizeof(inventory));
    player_init_new();
    chapas = 30;
    item_give(IT_CROQUETA, 2);
    state = GS_OVERWORLD;
    ow_enter_room(ROOM_CESPED, rooms[ROOM_CESPED].entry_x,
                  rooms[ROOM_CESPED].entry_y);
    cutscene_start(sc_intro);
}

void game_new_skip_intro(void)
{
    memset(flags, 0, sizeof(flags));
    memset(inventory, 0, sizeof(inventory));
    player_init_new();
    chapas = 60;
    item_give(IT_CROQUETA, 3);
    flags[FL_INTRO] = 1;
    state = GS_OVERWORLD;
    ow_enter_room(ROOM_RECTO_A, rooms[ROOM_RECTO_A].entry_x,
                  rooms[ROOM_RECTO_A].entry_y);
}

// ---------------------------------------------------------------------------
// título
// ---------------------------------------------------------------------------

static void title_enter(void)
{
    state = GS_TITLE;
    title_t = 0;
    title_sel = 0;
    title_has_save = save_exists();
    video_mode_battle();                    // main = bitmap
    video_battle_bitmap(scn_scene_title_bin);
    game_show_scene(SCN_JARDIN);
    spr_arena_reset();
    spr_preload(SH_FX);
    music_play(MUS_JARDIN);
    u16 *map = video_text_map_main();
    txt_fill_screen(map);
}

static void title_update(void)
{
    title_t++;
    u16 *map = video_text_map_main();
    u16 down = keysDown();

    txt_clear(map, 8, 16, 20, 4);
    txt_draw(map, 10, 16, "Nueva partida", TXT_LIGHT);
    if (title_has_save)
        txt_draw(map, 10, 18, "Continuar", TXT_LIGHT);
    if ((title_t & 63) < 40)
        txt_draw(map, 3, 22, "Un RPG de gatos y vísceras", TXT_LIGHT);

    if (down & (KEY_UP | KEY_DOWN)) {
        if (title_has_save) {
            title_sel ^= 1;
            sfx(SND_MENU);
        }
    }
    if (down & (KEY_A | KEY_START)) {
        sfx(SND_OK);
        fade_out(20);
        txt_fill_screen(map);
        if (title_sel == 1 && title_has_save) {
            if (!game_load())
                game_new();
        } else {
            game_new();
        }
        fade_in(20);
        return;
    }
    if (down & (KEY_SELECT | KEY_Y)) {
        // acceso rápido de desarrollo: empezar dentro de Deedee
        sfx(SND_OK);
        fade_out(10);
        txt_fill_screen(map);
        game_new_skip_intro();
        fade_in(10);
        return;
    }

    spr_begin();
    spr_draw(SH_FX, (title_t & 16) ? SPRF_FX_PAW0 : SPRF_FX_PAW1,
             64, 128 + title_sel * 16, false, 0);
    spr_end();
}

// ---------------------------------------------------------------------------
// game over
// ---------------------------------------------------------------------------

static int go_t;

static void gameover_enter(void)
{
    state = GS_GAMEOVER;
    go_t = 0;
    music_stop();
    sfx(SND_KO);
    video_mode_battle();
    video_battle_bitmap(scn_scene_caos_bin);
    game_show_scene(SCN_CAOS);
    spr_arena_reset();
    spr_preload(SH_BENITO);
    spr_preload(SH_SILVA);
    u16 *map = video_text_map_main();
    txt_fill_screen(map);
    txt_box(map, 4, 8, 24, 8);
    txt_draw(map, 7, 10, "Los gatos han gastado", TXT_DARK);
    txt_draw(map, 7, 11, "una de sus siete vidas…", TXT_DARK);
    txt_draw(map, 7, 13, "A: reintentar", TXT_DARK);
}

static void gameover_update(void)
{
    go_t++;
    spr_begin();
    spr_draw(SH_BENITO, SPRF_BENITO_KO, 96, 140, false, 0);
    spr_draw(SH_SILVA, SPRF_SILVA_KO, 136, 140, false, 0);
    spr_end();
    if (go_t > 30 && (keysDown() & (KEY_A | KEY_START))) {
        fade_out(20);
        // reintentar: recuperar el guardado o volver al título
        if (save_exists() && game_load()) {
            // media vida para el reintento
            for (int c = 0; c < 2; c++)
                if (party[c].hp == 0)
                    party[c].hp = party[c].hpmax / 2;
            fade_in(20);
        } else {
            title_enter();
            fade_in(20);
        }
    }
}

// ---------------------------------------------------------------------------
// bucle central
// ---------------------------------------------------------------------------

static void apply_requests(void)
{
    if (req_battle) {
        req_battle = false;
        battle_was_boss = req_boss;
        state = GS_BATTLE;
        fade_out(12);
        battle_enter(req_form, req_boss,
                     rooms[ow_room()].tileset == 1);
        fade_in(12);
        return;
    }
    if (req_room >= 0) {
        int r = req_room, mx = req_mx, my = req_my;
        req_room = -1;
        fade_out(14);
        txt_fill_screen(video_text_map_main());
        ow_enter_room(r, mx, my);
        fade_in(14);
    }
}

void game_init(void)
{
    scripts_init();
    title_enter();
}

void game_frame(void)
{
    switch (state) {
    case GS_TITLE:
        title_update();
        break;
    case GS_OVERWORLD:
        ow_update();
        apply_requests();
        break;
    case GS_BATTLE: {
        int r = battle_update();
        if (r) {
            battle_exit();
            if (r == 2) {
                gameover_enter();
                break;
            }
            fade_out(12);
            state = GS_OVERWORLD;
            ow_restore_after_battle();
            if (r == 1 && battle_was_boss) {
                ow_boss_defeated();
                cutscene_start(sc_tapon_derrotado);
            }
            fade_in(12);
        }
        break;
    }
    case GS_GAMEOVER:
        gameover_update();
        break;
    }
}
