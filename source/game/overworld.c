#include <stdio.h>
#include <string.h>
#include "overworld.h"
#include "map.h"
#include "video.h"
#include "sprites.h"
#include "text.h"
#include "audio.h"
#include "fx.h"
#include "dialog.h"
#include "cutscene.h"
#include "game.h"
#include "player.h"
#include "items.h"
#include "npc.h"
#include "shop.h"
#include "scripts.h"
#include "tiles_data.h"

// ---------------------------------------------------------------------------
// estado
// ---------------------------------------------------------------------------

#define TRAIL_LEN 24
#define FOLLOW_DELAY 14

typedef struct {
    fx32 x, y;          // posición (pies) en mundo
    fx32 vy;            // vel vertical (lateral) / altura de salto (sup)
    fx32 z, vz;         // salto en vista superior
    int dir;            // 0 abajo, 1 arriba, 2 izquierda, 3 derecha
    bool on_ground;
    int anim_t;
    bool moving;
} Cat;

typedef struct {
    const EntityDef *def;
    fx32 x, y, vy;
    u8 state;           // genérico
    int t;
    bool gone;          // recogido/abierto/muerto
    int dir;
} Ent;

static int room_id = -1;
static const RoomDef *room;
static Cat leader, follower;
static fx32 trail_x[TRAIL_LEN], trail_y[TRAIL_LEN];
static int trail_head;
static Ent ents[24];
static int n_ents;
static int camx, camy;
static int iframes;         // tras combate/daño
static int pause_open;      // 0 no, 1 objetos, 2 estado
static int pause_sel;
static int side_mode;
static int entry_mx, entry_my;
static int fell_hazard;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

static bool solid_at(int px, int py, bool from_above)
{
    u8 f = map_flags_at(px, py);
    if (f & MF_SOLID)
        return true;
    if (side_mode && from_above && (f & MF_PLATFORM)) {
        // plataforma: sólo bloquea si el pie está en el cuarto superior
        if ((py & 15) < 6)
            return true;
    }
    // bloques empujables son sólidos
    for (int i = 0; i < n_ents; i++) {
        if (ents[i].gone || ents[i].def->type != E_BLOCK)
            continue;
        int bx = FX2INT(ents[i].x), by = FX2INT(ents[i].y);
        if (px >= bx - 8 && px < bx + 8 && py >= by - 16 && py < by)
            return true;
    }
    return false;
}

static bool body_blocked(int px, int py)
{
    // caja de colisión de 10 px de ancho, 8 de alto (pies)
    return solid_at(px - 5, py - 2, false) ||
           solid_at(px + 4, py - 2, false) ||
           solid_at(px - 5, py - 7, false) ||
           solid_at(px + 4, py - 7, false);
}

static Ent *ent_at(int type, int px, int py, int radius)
{
    for (int i = 0; i < n_ents; i++) {
        Ent *e = &ents[i];
        if (e->gone || e->def->type != type)
            continue;
        if (absi(FX2INT(e->x) - px) <= radius &&
            absi(FX2INT(e->y) - py) <= radius)
            return e;
    }
    return NULL;
}

// ---------------------------------------------------------------------------
// carga de sala
// ---------------------------------------------------------------------------

static void apply_persistent_state(void)
{
    // puertas/puzles ya resueltos según flags
    for (int i = 0; i < n_ents; i++) {
        Ent *e = &ents[i];
        switch (e->def->type) {
        case E_GATE:
            if (game_flag(FL_PUZLE_JARDIN)) {
                e->gone = true;
            } else {
                // cerrar la puerta: valla
                map_set_metatile(e->def->x >> 4, e->def->y >> 4,
                                 MT_JARDIN_FENCE);
            }
            break;
        case E_CHEST:
            if ((e->def->a == 0 && game_flag(FL_COFRE_JARDIN)) ||
                (e->def->a == 1 && game_flag(FL_COFRE_RECTO)))
                e->state = 1;   // abierto
            break;
        case E_DOOR:
            if (game_flag(FL_PUERTA_RECTO))
                map_set_metatile(e->def->x >> 4, e->def->y >> 4,
                                 MT_COLON_SPHINCTER_OPEN);
            break;
        case E_BOSS:
            if (game_flag(FL_JEFE_TAPON)) {
                e->gone = true;
            }
            break;
        case E_PLATE:
            if (game_flag(FL_PLACA0 + e->def->a))
                e->state = 1;
            break;
        }
    }
    // el tapón gigante bloquea recto_c hasta vencerlo
    if (room_id == ROOM_RECTO_C && game_flag(FL_JEFE_TAPON)) {
        for (int y = 0; y < room->h; y++)
            for (int x = 0; x < room->w; x++)
                if (map_metatile(x, y) == MT_COLON_SPHINCTER_CLOSED)
                    map_set_metatile(x, y, MT_COLON_SPHINCTER_OPEN);
    }
}

static void preload_room_sheets(void)
{
    spr_arena_reset();
    spr_preload(SH_BENITO);
    spr_preload(SH_SILVA);
    spr_preload(SH_FX);
    for (int i = 0; i < n_ents; i++) {
        switch (ents[i].def->type) {
        case E_NPC:
            spr_preload(ents[i].def->a >= NPC_ANCIANO ? SH_ABEJORRO
                                                      : SH_NPCS);
            break;
        case E_SHOP:
            spr_preload(SH_ABEJORRO);
            break;
        case E_ENEMY:
            switch (ents[i].def->a) {
            case 0: spr_preload(SH_PULGON); break;
            case 1: spr_preload(SH_SEMILLA); break;
            case 2: spr_preload(SH_BACTERIOLO); break;
            case 3: spr_preload(SH_GUSANILLO); break;
            }
            break;
        case E_BOSS:
            spr_preload(SH_TAPON);
            break;
        }
    }
    if (room_id == ROOM_CESPED) {
        // solo idle/walk/lick de Deedee: los 6 primeros frames
        spr_preload_max(SH_DEEDEE, 6);
        spr_preload(SH_TERELU);
    }
}

void ow_enter_room(int rid, int mx, int my)
{
    room_id = rid;
    room = &rooms[rid];
    side_mode = room->mode == 1;
    entry_mx = mx;
    entry_my = my;

    video_mode_map();
    map_load_room(room);

    n_ents = 0;
    for (int i = 0; i < room->n_ents && n_ents < 24; i++) {
        Ent *e = &ents[n_ents++];
        memset(e, 0, sizeof(*e));
        e->def = &room->ents[i];
        e->x = FX(e->def->x);
        e->y = FX(e->def->y + 8);      // pies
        e->dir = 2;
    }
    apply_persistent_state();
    preload_room_sheets();
    fx_clear();

    leader.x = FX(mx * 16 + 8);
    leader.y = FX(my * 16 + 15);
    leader.z = leader.vz = leader.vy = 0;
    leader.dir = side_mode ? 3 : 0;
    leader.on_ground = false;
    follower = leader;
    follower.x -= FX(14);
    for (int i = 0; i < TRAIL_LEN; i++) {
        trail_x[i] = leader.x;
        trail_y[i] = leader.y;
    }
    iframes = 40;
    pause_open = 0;

    music_play(room->music);
    hud_refresh();
    game_show_scene(room->tileset == 0 ? SCN_JARDIN : SCN_COLON);
}

int ow_room(void)
{
    return room_id;
}

void ow_party_pos(int *px, int *py)
{
    *px = FX2INT(leader.x);
    *py = FX2INT(leader.y);
}

void ow_warp(int mx, int my)
{
    leader.x = FX(mx * 16 + 8);
    leader.y = FX(my * 16 + 15);
    follower = leader;
    for (int i = 0; i < TRAIL_LEN; i++) {
        trail_x[i] = leader.x;
        trail_y[i] = leader.y;
    }
}

// ---------------------------------------------------------------------------
// movimiento
// ---------------------------------------------------------------------------

static void move_topdown(u16 held, u16 down)
{
    fx32 sp = FXF(1.4f);
    fx32 dx = 0, dy = 0;
    if (held & KEY_LEFT) { dx = -sp; leader.dir = 2; }
    if (held & KEY_RIGHT) { dx = sp; leader.dir = 3; }
    if (held & KEY_UP) { dy = -sp; if (!dx) leader.dir = 1; }
    if (held & KEY_DOWN) { dy = sp; if (!dx) leader.dir = 0; }
    leader.moving = dx || dy;

    int px = FX2INT(leader.x), py = FX2INT(leader.y);
    if (dx) {
        int nx = FX2INT(leader.x + dx);
        if (!body_blocked(nx, py))
            leader.x += dx;
    }
    if (dy) {
        int ny = FX2INT(leader.y + dy);
        if (!body_blocked(px, ny))
            leader.y += dy;
    }

    // salto cosmético (A sin interacción): pequeño brinco
    if (leader.z > 0 || leader.vz) {
        leader.z += leader.vz;
        leader.vz -= FXF(0.3f);
        if (leader.z <= 0) {
            leader.z = 0;
            leader.vz = 0;
            fx_puff(FX2INT(leader.x), FX2INT(leader.y), -FXF(0.1f));
        }
    }
}

static void side_physics(Cat *c, u16 held, u16 down, bool is_leader)
{
    fx32 sp = FXF(1.5f);
    if (is_leader) {
        c->moving = false;
        if (held & KEY_LEFT) {
            c->dir = 2;
            c->moving = true;
            int nx = FX2INT(c->x - sp);
            if (!body_blocked(nx, FX2INT(c->y)))
                c->x -= sp;
        }
        if (held & KEY_RIGHT) {
            c->dir = 3;
            c->moving = true;
            int nx = FX2INT(c->x + sp);
            if (!body_blocked(nx, FX2INT(c->y)))
                c->x += sp;
        }
        if ((down & KEY_A) && c->on_ground) {
            c->vy = -FXF(4.8f);
            c->on_ground = false;
            sfx(SND_SALTO);
        }
        // salto sostenido
        if (!(held & KEY_A) && c->vy < -FXF(1.5f))
            c->vy = -FXF(1.5f);
    }

    c->vy += FXF(0.28f);
    if (c->vy > FXF(4.2f))
        c->vy = FXF(4.2f);

    // corrientes de gas: si hay un puff activo bajo el gato
    for (int i = 0; i < n_ents; i++) {
        Ent *e = &ents[i];
        if (e->def->type != E_VENT || e->state == 0)
            continue;
        int vx = FX2INT(e->x);
        int px = FX2INT(c->x);
        int vy = FX2INT(e->y);
        int py = FX2INT(c->y);
        if (absi(px - vx) < 14 && py <= vy + 8 && py > vy - 90) {
            c->vy -= FXF(0.85f);
            if (c->vy < -FXF(4.6f))
                c->vy = -FXF(4.6f);
        }
    }

    // integración vertical con colisión
    fx32 step = c->vy;
    int dirn = step > 0 ? 1 : -1;
    int px = FX2INT(c->x);
    c->on_ground = false;
    while (step) {
        fx32 d = step;
        if (d > FX(4)) d = FX(4);
        if (d < -FX(4)) d = -FX(4);
        step -= d;
        int ny = FX2INT(c->y + d);
        if (dirn > 0) {
            if (solid_at(px - 4, ny, true) || solid_at(px + 3, ny, true)) {
                // aterrizar: alinear al tile
                c->y = FX((ny & ~15) - 1 + 16);
                // corrección: subir hasta salir del sólido
                while (solid_at(px - 4, FX2INT(c->y), true) ||
                       solid_at(px + 3, FX2INT(c->y), true))
                    c->y -= FX(1);
                c->vy = 0;
                c->on_ground = true;
                break;
            }
        } else {
            if (solid_at(px - 4, ny - 10, false) ||
                solid_at(px + 3, ny - 10, false)) {
                c->vy = 0;
                break;
            }
        }
        c->y += d;
    }
}

// ---------------------------------------------------------------------------
// entidades
// ---------------------------------------------------------------------------

static void open_chest(Ent *e)
{
    e->state = 1;
    sfx(SND_CHAPA);
    fx_sparkle(FX2INT(e->x), FX2INT(e->y) - 10);
    if (e->def->a == 0) {
        game_set_flag(FL_COFRE_JARDIN, 1);
        party[0].collar = true;
        party[1].collar = true;
        chapas += 25;
        dialog_open(SPRF_PORTRAITS_BENITO_FELIZ, "Benito",
                    "¡Un Collar Sencillo para cada uno y 25 chapas! "
                    "DEF +2. ¡Y encima hace juego con mis ojos!");
    } else {
        game_set_flag(FL_COFRE_RECTO, 1);
        item_give(IT_CROQUETA, 3);
        dialog_open(SPRF_PORTRAITS_SILVA_NORMAL, "Silva",
                    "Tres croquetas… dentro de un cofre… dentro de un "
                    "perro. No preguntes, Benito. Tú mastica.");
    }
    hud_refresh();
}

static void check_plates(void)
{
    // baldosas del puzle del jardín: pisa las 3 (se mantienen)
    if (room_id != ROOM_CESPED || game_flag(FL_PUZLE_JARDIN))
        return;
    int px = FX2INT(leader.x), py = FX2INT(leader.y);
    bool all = true;
    for (int i = 0; i < n_ents; i++) {
        Ent *e = &ents[i];
        if (e->def->type != E_PLATE)
            continue;
        if (!e->state &&
            absi(FX2INT(e->x) - px) < 10 && absi(FX2INT(e->y) - py) < 10 &&
            leader.z == 0) {
            e->state = 1;
            game_set_flag(FL_PLACA0 + e->def->a, 1);
            sfx(SND_OK);
            fx_sparkle(FX2INT(e->x), FX2INT(e->y) - 6);
        }
        if (!e->state)
            all = false;
    }
    if (all) {
        game_set_flag(FL_PUZLE_JARDIN, 1);
        sfx(SND_NIVEL);
        fx_shake(10, 2);
        for (int i = 0; i < n_ents; i++) {
            if (ents[i].def->type == E_GATE) {
                map_set_metatile(ents[i].def->x >> 4, ents[i].def->y >> 4,
                                 MT_JARDIN_GRASS0);
                ents[i].gone = true;
                fx_stars(ents[i].def->x, ents[i].def->y);
            }
        }
        dialog_open(SPRF_PORTRAITS_SILVA_FELIZ, "Silva",
                    "¡La puerta del recinto se ha abierto! Tres baldosas, "
                    "tres pisotones. Matemática felina.");
    }
}

static void update_block(Ent *e)
{
    // gravedad del bloque
    int bx = FX2INT(e->x), by = FX2INT(e->y);
    if (!(map_flags_at(bx - 6, by) & (MF_SOLID | MF_PLATFORM)) &&
        !(map_flags_at(bx + 5, by) & (MF_SOLID | MF_PLATFORM))) {
        e->vy += FXF(0.3f);
        if (e->vy > FX(3))
            e->vy = FX(3);
        e->y += e->vy;
    } else {
        if (e->vy > 0)
            sfx(SND_GOLPE);
        e->vy = 0;
        e->y = FX(((by - 1) & ~15) + 15);
    }
    // empuje por el líder
    int px = FX2INT(leader.x), py = FX2INT(leader.y);
    if (absi(py - by) < 14) {
        if (px < bx && px > bx - 14 && (keysHeld() & KEY_RIGHT)) {
            int nx = bx + 1;
            if (!(map_flags_at(nx + 8, by - 4) & MF_SOLID))
                e->x += FXF(0.7f);
        } else if (px > bx && px < bx + 14 && (keysHeld() & KEY_LEFT)) {
            int nx = bx - 1;
            if (!(map_flags_at(nx - 9, by - 4) & MF_SOLID))
                e->x -= FXF(0.7f);
        }
    }
    // ¿está sobre el interruptor?
    if (room_id == ROOM_RECTO_B && !game_flag(FL_PUERTA_RECTO)) {
        for (int i = 0; i < n_ents; i++) {
            Ent *s = &ents[i];
            if (s->def->type != E_SWITCH)
                continue;
            if (absi(FX2INT(e->x) - FX2INT(s->x)) < 10 &&
                absi(FX2INT(e->y) - FX2INT(s->y)) < 12) {
                game_set_flag(FL_PUERTA_RECTO, 1);
                sfx(SND_NIVEL);
                fx_shake(12, 2);
                map_set_metatile(s->def->x >> 4, s->def->y >> 4,
                                 MT_COLON_SWITCH_ON);
                for (int j = 0; j < n_ents; j++) {
                    if (ents[j].def->type == E_DOOR) {
                        map_set_metatile(ents[j].def->x >> 4,
                                         ents[j].def->y >> 4,
                                         MT_COLON_SPHINCTER_OPEN);
                        fx_stars(ents[j].def->x, ents[j].def->y);
                    }
                }
                dialog_open(SPRF_PORTRAITS_BENITO_FELIZ, "Benito",
                            "¡La albóndiga gigante ha pisado el botón! "
                            "…¿Puedo comérmela ahora?");
            }
        }
    }
}

static void update_enemy(Ent *e)
{
    int ex = FX2INT(e->x), ey = FX2INT(e->y);
    int px = FX2INT(leader.x), py = FX2INT(leader.y);
    int d2 = (ex - px) * (ex - px) + (ey - py) * (ey - py);

    if (side_mode) {
        // patrulla con gravedad
        if (!(map_flags_at(ex, ey + 1) & (MF_SOLID | MF_PLATFORM))) {
            e->vy += FXF(0.3f);
            e->y += e->vy;
        } else {
            e->vy = 0;
        }
        int step = (e->dir == 2) ? -1 : 1;
        // giro en bordes y paredes
        if ((map_flags_at(ex + step * 10, ey - 4) & MF_SOLID) ||
            !(map_flags_at(ex + step * 10, ey + 4) &
              (MF_SOLID | MF_PLATFORM)))
            e->dir = (e->dir == 2) ? 3 : 2;
        else
            e->x += FXF(0.5f) * step;
    } else {
        // paseo aleatorio suave
        e->t++;
        if ((e->t & 63) == 0)
            e->dir = (int)(rng_next(&(Rng){ e->t ^ ex ^ ey }) & 3);
        static const int ddx[4] = { 0, 0, -1, 1 };
        static const int ddy[4] = { 1, -1, 0, 0 };
        int nx = ex + ddx[e->dir], ny = ey + ddy[e->dir];
        // no salir lejos del punto de origen
        if (absi(nx - e->def->x) < 40 && absi(ny - e->def->y) < 40 &&
            !(map_flags_at(nx, ny) & MF_SOLID))
        {
            e->x += FXF(0.5f) * ddx[e->dir];
            e->y += FXF(0.5f) * ddy[e->dir];
        } else {
            e->dir ^= 1;
        }
        // persecución si te ve
        if (d2 < 56 * 56 && iframes == 0) {
            if (e->state == 0) {
                e->state = 1;
                fx_excl(ex, ey - 18);
                sfx(SND_MENU);
            }
            fx32 sp = FXF(0.8f);
            if (px < ex) e->x -= sp;
            if (px > ex) e->x += sp;
            if (py < ey) e->y -= sp;
            if (py > ey) e->y += sp;
        } else {
            e->state = 0;
        }
    }

    // contacto -> ¡combate!
    if (iframes == 0 && d2 < 14 * 14) {
        u8 form[3] = { e->def->a, e->def->b, e->def->c };
        e->gone = true;         // no reaparece hasta recargar sala
        game_request_battle(form, false);
    }
}

static void update_vent(Ent *e)
{
    // ciclo: 100 frames en calma, 80 soplando
    e->t++;
    int ph = e->t % 180;
    e->state = ph >= 100;
    if (e->state) {
        if ((e->t & 7) == 0) {
            fx_puff(FX2INT(e->x), FX2INT(e->y) + 8, -FXF(2.2f));
            if ((e->t & 31) == 0)
                sfx(SND_GAS);
        }
    }
}

static void interact(void)
{
    int px = FX2INT(leader.x), py = FX2INT(leader.y);
    // punto de interacción delante del gato
    static const int fx_[4] = { 0, 0, -14, 14 };
    static const int fy_[4] = { 14, -14, 0, 0 };
    int ix = px + fx_[leader.dir], iy = py + fy_[leader.dir];

    Ent *e;
    if ((e = ent_at(E_NPC, ix, iy, 16)) || (e = ent_at(E_NPC, px, py, 18))) {
        npc_talk(e->def->a);
        return;
    }
    if ((e = ent_at(E_SHOP, ix, iy, 16)) ||
        (e = ent_at(E_SHOP, px, py, 18))) {
        shop_open();
        return;
    }
    if ((e = ent_at(E_SAVE, px, py, 18))) {
        script_savepoint();
        return;
    }
    if ((e = ent_at(E_CHEST, ix, iy, 16))) {
        if (!e->state)
            open_chest(e);
        return;
    }
    if ((e = ent_at(E_TRIGGER, ix, iy, 16)) ||
        (e = ent_at(E_TRIGGER, px, py, 14))) {
        if (e->def->a == 0) {       // entrada al interior de Deedee
            script_enter_deedee();
            return;
        }
        if (e->def->a == 1) {       // cartel
            dialog_open(-1, NULL,
                        "«Césped Central. Bienvenidos al jardín. "
                        "Prohibido lamer a los vecinos.»|"
                        "Alguien ha tachado la última frase con babas.");
            return;
        }
    }
    // salto cosmético en vista superior
    if (!side_mode && leader.z == 0) {
        leader.vz = FXF(2.6f);
        leader.z = FXF(0.1f);
        sfx(SND_SALTO);
    }
}

static void check_exits_and_hazards(void)
{
    int px = FX2INT(leader.x), py = FX2INT(leader.y);

    Ent *e = ent_at(E_EXIT, px, py, 12);
    if (e) {
        // la salida al jardín desde recto_a solo tras vencer al jefe
        if (room_id == ROOM_RECTO_A && e->def->a == ROOM_CESPED &&
            !game_flag(FL_JEFE_TAPON)) {
            if ((keysDown() & KEY_A)) {
                dialog_open(SPRF_PORTRAITS_SILVA_NORMAL, "Silva",
                            "¿Salir ya? El esfínter de entrada solo abre "
                            "hacia dentro. Física intestinal básica. "
                            "Hay que seguir subiendo.");
            }
            return;
        }
        game_request_room(e->def->a, e->def->b, e->def->c);
        return;
    }

    // trigger de cinemática por contacto
    for (int i = 0; i < n_ents; i++) {
        Ent *t = &ents[i];
        if (t->def->type != E_TRIGGER || t->gone)
            continue;
        int tx = FX2INT(t->x), ty = FX2INT(t->y);
        if (absi(px - tx) < 14 && absi(py - ty) < 20) {
            if (t->def->a == 2 && !game_flag(FL_TUTO_INTERIOR)) {
                t->gone = true;
                game_set_flag(FL_TUTO_INTERIOR, 1);
                cutscene_start(sc_tutorial_interior);
            } else if (t->def->a == 3 && !game_flag(FL_JEFE_TAPON)) {
                t->gone = true;
                cutscene_start(sc_jefe_tapon);
            }
        }
    }

    // peligros (ácido)
    if (side_mode && iframes == 0 &&
        (map_flags_at(px, py) & MF_HAZARD)) {
        sfx(SND_DANO);
        fx_shake(10, 2);
        for (int c = 0; c < 2; c++) {
            if (party[c].hp > 3)
                party[c].hp -= 3;
            else if (party[c].hp > 1)
                party[c].hp = 1;
        }
        fx_damage(px, py - 20, 3, false);
        hud_refresh();
        iframes = 60;
        ow_warp(entry_mx, entry_my);
        fell_hazard++;
        if (fell_hazard == 2)
            dialog_open(SPRF_PORTRAITS_BENITO_SUSTO, "Benito",
                        "¡El ácido PICA! ¿Quién diseña un perro por "
                        "dentro? ¡Quiero hablar con el arquitecto!");
    }
}

// ---------------------------------------------------------------------------
// menú de pausa
// ---------------------------------------------------------------------------

static void draw_pause(void)
{
    u16 *map = video_text_map_main();
    txt_fill_screen(map);
    if (pause_open == 1) {
        txt_box(map, 2, 2, 28, 18);
        txt_draw(map, 4, 3, "Objetos  (A usar, B salir)", TXT_DARK);
        char buf[32];
        for (int i = 0; i < IT_COUNT; i++) {
            snprintf(buf, sizeof(buf), "%s%-15s ×%d",
                     (i == pause_sel) ? "→" : " ",
                     item_defs[i].name, inventory[i]);
            txt_draw(map, 4, 5 + i * 2, buf, TXT_DARK);
        }
        txt_draw(map, 4, 17, item_defs[pause_sel].desc, TXT_DARK);
    } else if (pause_open == 2) {
        txt_box(map, 2, 2, 28, 18);
        char buf[32];
        for (int c = 0; c < 2; c++) {
            int x = 4 + c * 14;
            txt_draw(map, x, 3, c == 0 ? "Benito" : "Silva", TXT_DARK);
            snprintf(buf, sizeof(buf), "Nv %d", party[c].level);
            txt_draw(map, x, 5, buf, TXT_DARK);
            snprintf(buf, sizeof(buf), "PV %d/%d", party[c].hp,
                     party[c].hpmax);
            txt_draw(map, x, 6, buf, TXT_DARK);
            snprintf(buf, sizeof(buf), "PE %d/%d", party[c].pe,
                     party[c].pemax);
            txt_draw(map, x, 7, buf, TXT_DARK);
            snprintf(buf, sizeof(buf), "FUE %d", party[c].fue);
            txt_draw(map, x, 8, buf, TXT_DARK);
            snprintf(buf, sizeof(buf), "DEF %d", player_def_total(c));
            txt_draw(map, x, 9, buf, TXT_DARK);
            snprintf(buf, sizeof(buf), "VEL %d", party[c].vel);
            txt_draw(map, x, 10, buf, TXT_DARK);
            u32 next = exp_to_next(party[c].level);
            snprintf(buf, sizeof(buf), "EXP %lu", (unsigned long)party[c].exp);
            txt_draw(map, x, 11, buf, TXT_DARK);
            snprintf(buf, sizeof(buf), "Sig +%lu", (unsigned long)next);
            txt_draw(map, x, 12, buf, TXT_DARK);
        }
        char b2[32];
        snprintf(b2, sizeof(b2), "Chapas: %d", chapas);
        txt_draw(map, 4, 15, b2, TXT_DARK);
        txt_draw(map, 4, 17, "SELECT: objetos  B: cerrar", TXT_DARK);
    }
}

static void update_pause(void)
{
    u16 down = keysDown();
    if (down & (KEY_START | KEY_B)) {
        pause_open = 0;
        txt_fill_screen(video_text_map_main());
        sfx(SND_CANCEL);
        return;
    }
    if (down & KEY_SELECT) {
        pause_open = (pause_open == 1) ? 2 : 1;
        sfx(SND_MENU);
        draw_pause();
        return;
    }
    if (pause_open == 1) {
        if (down & KEY_UP) {
            pause_sel = (pause_sel + IT_COUNT - 1) % IT_COUNT;
            sfx(SND_MENU);
        }
        if (down & KEY_DOWN) {
            pause_sel = (pause_sel + 1) % IT_COUNT;
            sfx(SND_MENU);
        }
        if (down & KEY_A) {
            int it = pause_sel;
            if (inventory[it] == 0 || it == IT_COLLAR || it == IT_HIERBA) {
                sfx(SND_CANCEL);
            } else {
                // usar fuera de combate
                int target = (party[0].hpmax - party[0].hp >=
                              party[1].hpmax - party[1].hp) ? 0 : 1;
                bool used = false;
                if (it == IT_CROQUETA || it == IT_CROQUETON) {
                    int heal = it == IT_CROQUETA ? 30 : 80;
                    if (party[target].hp > 0 &&
                        party[target].hp < party[target].hpmax) {
                        party[target].hp =
                            (party[target].hp + heal > party[target].hpmax)
                            ? party[target].hpmax : party[target].hp + heal;
                        used = true;
                    }
                } else if (it == IT_ATUN) {
                    for (int c = 0; c < 2; c++)
                        if (party[c].hp == 0) {
                            party[c].hp = party[c].hpmax / 2;
                            used = true;
                            break;
                        }
                } else if (it == IT_PELOTA) {
                    if (party[target].pe < party[target].pemax) {
                        party[target].pe =
                            (party[target].pe + 10 > party[target].pemax)
                            ? party[target].pemax : party[target].pe + 10;
                        used = true;
                    }
                }
                if (used) {
                    item_take(it);
                    sfx(SND_CURAR);
                    hud_refresh();
                } else {
                    sfx(SND_CANCEL);
                }
            }
        }
        draw_pause();
    }
}

// ---------------------------------------------------------------------------
// dibujo
// ---------------------------------------------------------------------------

static int cat_frame(const Cat *c, bool is_silva)
{
    int base;
    (void)is_silva;
    if (side_mode) {
        if (!c->on_ground)
            return (c->vy < 0) ? SPRF_BENITO_JUMP : SPRF_BENITO_FALL;
        if (c->moving)
            return SPRF_BENITO_WALK_SIDE0 + ((c->anim_t >> 3) & 3);
        return SPRF_BENITO_IDLE_SIDE0 + ((c->anim_t >> 5) & 1);
    }
    if (c->z > 0)
        return SPRF_BENITO_JUMP;
    switch (c->dir) {
    case 0: base = c->moving ? SPRF_BENITO_WALK_DOWN0
                             : SPRF_BENITO_IDLE_DOWN0; break;
    case 1: base = c->moving ? SPRF_BENITO_WALK_UP0
                             : SPRF_BENITO_IDLE_UP0; break;
    default: base = c->moving ? SPRF_BENITO_WALK_SIDE0
                              : SPRF_BENITO_IDLE_SIDE0; break;
    }
    int n = c->moving ? 4 : 2;
    int spd = c->moving ? 3 : 5;
    return base + ((c->anim_t >> spd) % n);
}

static void draw_cat_ow(const Cat *c, bool silva)
{
    int x = FX2INT(c->x) - camx;
    int y = FX2INT(c->y) - camy;
    bool hf = (c->dir == 3);
    if (side_mode)
        hf = (c->dir == 3);
    int z = FX2INT(c->z);
    // sombra
    spr_draw(SH_FX, SPRF_FX_SHADOW, x - 8, y - 12, false, 2);
    if (iframes > 0 && (iframes & 2))
        return;    // parpadeo de invulnerabilidad
    spr_draw(silva ? SH_SILVA : SH_BENITO, cat_frame(c, silva),
             x - 16, y - 30 - z, hf, 2);
}

static void draw_entity(Ent *e)
{
    if (e->gone)
        return;
    int x = FX2INT(e->x) - camx, y = FX2INT(e->y) - camy;
    int t = e->t;
    switch (e->def->type) {
    case E_NPC: {
        int npc = e->def->a;
        e->t++;
        int st = (t >> 5) & 1;
        if (npc == NPC_ANCIANO)
            spr_draw(SH_ABEJORRO, SPRF_ABEJORRO_ELDER0 + st, x - 16,
                     y - 28, false, 2);
        else if (npc == NPC_TENDERO)
            spr_draw(SH_ABEJORRO, SPRF_ABEJORRO_SHOP0 + st, x - 16,
                     y - 28, false, 2);
        else
            spr_draw(SH_NPCS, npc * 2 + st, x - 16, y - 28, false, 2);
        break;
    }
    case E_SHOP: {
        e->t++;
        int st = (t >> 5) & 1;
        spr_draw(SH_ABEJORRO, SPRF_ABEJORRO_SHOP0 + st, x - 16, y - 28,
                 false, 2);
        break;
    }
    case E_ENEMY: {
        e->t++;
        int sheet;
        switch (e->def->a) {
        case 0: sheet = SH_PULGON; break;
        case 1: sheet = SH_SEMILLA; break;
        case 2: sheet = SH_BACTERIOLO; break;
        default: sheet = SH_GUSANILLO; break;
        }
        spr_draw(sheet, (t >> 4) & 1, x - 16, y - 28,
                 e->dir == 3, 2);
        break;
    }
    case E_BOSS:
        e->t++;
        spr_draw(SH_TAPON, (t >> 5) & 1, x - 32, y - 56, false, 2);
        break;
    case E_SAVE: {
        e->t++;
        int st = (t >> 4) & 1;
        int fr = e->def->a ? SPRF_FX_SYNAPSE0 + st : SPRF_FX_HAIRBALL0 + st;
        spr_draw(SH_FX, fr, x - 8, y - 14, false, 2);
        if ((t & 31) == 0)
            fx_sparkle(FX2INT(e->x), FX2INT(e->y) - 12);
        break;
    }
    case E_CHEST:
        spr_draw(SH_FX, e->state ? SPRF_FX_CHEST1 : SPRF_FX_CHEST0,
                 x - 8, y - 14, false, 2);
        break;
    case E_PLATE:
        spr_draw(SH_FX, e->state ? SPRF_FX_PLATE1 : SPRF_FX_PLATE0,
                 x - 8, y - 12, false, 2);
        break;
    case E_BLOCK:
        spr_draw(SH_FX, SPRF_FX_BLOQUE, x - 8, y - 15, false, 2);
        break;
    default:
        break;
    }
}

// ---------------------------------------------------------------------------
// bucle
// ---------------------------------------------------------------------------

void ow_restore_after_battle(void)
{
    video_mode_map();
    preload_room_sheets();
    fx_clear();
    music_play(room->music);
    hud_refresh();
    game_show_scene(room->tileset == 0 ? SCN_JARDIN : SCN_COLON);
    iframes = 90;
}

void ow_update(void)
{
    u16 held = keysHeld(), down = keysDown();

    scripts_poll();

    if (shop_active()) {
        shop_update();
        spr_begin();
        shop_draw();
        spr_end();
        return;
    }

    if (cutscene_active()) {
        cutscene_update();
    } else if (dialog_active()) {
        dialog_update();
    } else if (pause_open) {
        update_pause();
    } else {
        if (down & KEY_START) {
            pause_open = 2;
            sfx(SND_OK);
            draw_pause();
        } else {
            if (side_mode) {
                side_physics(&leader, held, down, true);
            } else {
                move_topdown(held, down);
                if ((down & KEY_A))
                    interact();
            }
            if (side_mode && (down & KEY_B))
                interact();     // en lateral, B interactúa (A salta)

            // rastro del seguidor
            trail_x[trail_head] = leader.x;
            trail_y[trail_head] = leader.y;
            trail_head = (trail_head + 1) % TRAIL_LEN;
            int idx = (trail_head + TRAIL_LEN - FOLLOW_DELAY) % TRAIL_LEN;
            fx32 fx0 = trail_x[idx], fy0 = trail_y[idx];
            follower.moving = absi(follower.x - fx0) > FX(1) ||
                              absi(follower.y - fy0) > FX(1);
            if (follower.moving) {
                if (fx0 < follower.x) follower.dir = 2;
                if (fx0 > follower.x) follower.dir = 3;
                if (!side_mode) {
                    if (absi(fy0 - follower.y) > absi(fx0 - follower.x))
                        follower.dir = (fy0 > follower.y) ? 0 : 1;
                }
            }
            follower.x = fx0;
            follower.y = fy0;
            follower.on_ground = leader.on_ground;
            follower.vy = leader.vy;

            leader.anim_t++;
            follower.anim_t++;
            if (iframes > 0)
                iframes--;

            // entidades activas
            for (int i = 0; i < n_ents; i++) {
                if (ents[i].gone)
                    continue;
                switch (ents[i].def->type) {
                case E_ENEMY: update_enemy(&ents[i]); break;
                case E_BLOCK: update_block(&ents[i]); break;
                case E_VENT: update_vent(&ents[i]); break;
                }
            }
            if (!side_mode)
                check_plates();
            check_exits_and_hazards();
        }
    }

    // cámara
    int lx = FX2INT(leader.x), ly = FX2INT(leader.y);
    camx = clampi(lx - 128, 0, map_w_px() - 256);
    camy = clampi(ly - 110, 0, map_h_px() - 192);
    video_scroll(camx + fx_shake_x(), camy + fx_shake_y());

    map_tick();
    fx_update();

    // dibujo
    spr_begin();
    dialog_draw();
    fx_draw(camx, camy);
    if (cutscene_active())
        cutscene_draw(camx, camy);
    // orden: el que esté más abajo, delante
    if (leader.y >= follower.y) {
        draw_cat_ow(&leader, false);
        draw_cat_ow(&follower, true);
    } else {
        draw_cat_ow(&follower, true);
        draw_cat_ow(&leader, false);
    }
    for (int i = 0; i < n_ents; i++)
        draw_entity(&ents[i]);
    spr_end();
}

void ow_boss_defeated(void)
{
    for (int i = 0; i < n_ents; i++)
        if (ents[i].def->type == E_BOSS)
            ents[i].gone = true;
    if (room)
        for (int y = 0; y < room->h; y++)
            for (int x = 0; x < room->w; x++)
                if (map_metatile(x, y) == MT_COLON_SPHINCTER_CLOSED)
                    map_set_metatile(x, y, MT_COLON_SPHINCTER_OPEN);
}
