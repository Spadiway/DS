#include <string.h>
#include "cutscene.h"
#include "dialog.h"
#include "sprites.h"
#include "audio.h"
#include "video.h"
#include "fx.h"

#define NACTORS 8
#define NCALLBACKS 16

typedef struct {
    bool on;
    u8 sheet;
    u16 frame;
    fx32 x, y;
    fx32 tx, ty;
    fx32 speed;
    bool moving;
    bool hflip;
    // animación cíclica
    u16 anim_base, anim_n, anim_period, anim_t;
} Actor;

static Actor actors[NACTORS];
static const CsCmd *pc;
static bool active = false;
static int wait_t;
static CsCallback callbacks[NCALLBACKS];

// el juego define cómo mostrar escenas y warps: callbacks especiales
extern void game_show_scene(int id);
extern void game_party_warp(int mx, int my);

void cutscene_register(int id, CsCallback fn)
{
    if (id >= 0 && id < NCALLBACKS)
        callbacks[id] = fn;
}

void cutscene_start(const CsCmd *script)
{
    memset(actors, 0, sizeof(actors));
    pc = script;
    active = true;
    wait_t = 0;
}

bool cutscene_active(void)
{
    return active;
}

static bool step_command(void)
{
    // devuelve true si hay que seguir ejecutando comandos este frame
    const CsCmd *c = pc;
    switch (c->op) {
    case CS_END:
        active = false;
        return false;
    case CS_SAY:
        dialog_open(c->a, cs_names[c->b], c->str);
        pc++;
        return false;
    case CS_SCENE:
        game_show_scene(c->a);
        pc++;
        return true;
    case CS_MUSIC:
        music_play(c->a);
        pc++;
        return true;
    case CS_SFX:
        sfx(c->a);
        pc++;
        return true;
    case CS_WAIT:
        wait_t = c->a;
        pc++;
        return false;
    case CS_SPAWN: {
        Actor *a = &actors[c->a];
        a->on = true;
        a->sheet = c->b;
        spr_preload(c->b);
        a->x = FX(c->c);
        a->y = FX(c->d);
        a->frame = 0;
        a->anim_n = 0;
        a->moving = false;
        pc++;
        return true;
    }
    case CS_MOVE: {
        Actor *a = &actors[c->a];
        a->tx = FX(c->b);
        a->ty = FX(c->c);
        a->speed = c->d * 256;      // d en 1/16 px por frame
        a->moving = true;
        a->hflip = (a->tx > a->x);
        pc++;
        return false;               // bloquea hasta llegar
    }
    case CS_ANIM: {
        Actor *a = &actors[c->a];
        a->anim_base = c->b;
        a->anim_n = c->c;
        a->anim_period = c->d ? c->d : 12;
        a->anim_t = 0;
        pc++;
        return true;
    }
    case CS_FRAME:
        actors[c->a].frame = c->b;
        actors[c->a].anim_n = 0;
        pc++;
        return true;
    case CS_FLIP:
        actors[c->a].hflip = c->b;
        pc++;
        return true;
    case CS_HIDE:
        actors[c->a].on = false;
        pc++;
        return true;
    case CS_SHAKE:
        fx_shake(c->a, c->b);
        pc++;
        return true;
    case CS_FADE:
        if (c->a == 0)
            fade_out(c->b);
        else
            fade_in(c->b);
        pc++;
        return true;
    case CS_FLAG: {
        extern void game_set_flag(int idx, int val);
        game_set_flag(c->a, c->b);
        pc++;
        return true;
    }
    case CS_CALL:
        if (callbacks[c->a])
            callbacks[c->a](c->b);
        pc++;
        return true;
    case CS_PARTY_WARP:
        game_party_warp(c->a, c->b);
        pc++;
        return true;
    default:
        pc++;
        return true;
    }
}

void cutscene_update(void)
{
    if (!active)
        return;

    // animar actores siempre
    for (int i = 0; i < NACTORS; i++) {
        Actor *a = &actors[i];
        if (!a->on)
            continue;
        if (a->anim_n) {
            a->anim_t++;
            a->frame = a->anim_base +
                (a->anim_t / a->anim_period) % a->anim_n;
        }
        if (a->moving) {
            fx32 dx = a->tx - a->x, dy = a->ty - a->y;
            fx32 sp = a->speed;
            if (absi(dx) <= sp && absi(dy) <= sp) {
                a->x = a->tx;
                a->y = a->ty;
                a->moving = false;
            } else {
                if (absi(dx) > sp)
                    a->x += (dx > 0) ? sp : -sp;
                else
                    a->x = a->tx;
                if (absi(dy) > sp)
                    a->y += (dy > 0) ? sp : -sp;
                else
                    a->y = a->ty;
            }
        }
    }

    if (dialog_active()) {
        dialog_update();
        return;
    }
    if (wait_t > 0) {
        wait_t--;
        return;
    }
    // ¿algún actor bloqueando por movimiento?
    for (int i = 0; i < NACTORS; i++)
        if (actors[i].on && actors[i].moving)
            return;

    while (active && step_command())
        ;
}

void cutscene_draw(int camx, int camy)
{
    if (!active)
        return;
    for (int i = 0; i < NACTORS; i++) {
        Actor *a = &actors[i];
        if (!a->on)
            continue;
        int half = (a->sheet == SH_DEEDEE || a->sheet == SH_TAPON) ? 32 : 16;
        spr_draw(a->sheet, a->frame, FX2INT(a->x) - camx - half,
                 FX2INT(a->y) - camy - half * 2 + (half == 16 ? 4 : 8),
                 a->hflip, 1);
    }
    dialog_draw();
}
