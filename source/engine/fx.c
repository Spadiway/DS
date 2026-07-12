#include <string.h>
#include "fx.h"
#include "sprites.h"

typedef struct {
    bool on;
    fx32 x, y, vx, vy;
    s16 life;
    u8 kind;        // 0 estrella, 1 corazón, 2 chispa, 3 gas, 4 ¡!
} Particle;

typedef struct {
    bool on;
    fx32 x, y, vy;
    s16 life;
    u16 value;
    bool heal;
} DmgNum;

#define NPART 32
#define NDMG 8

static Particle parts[NPART];
static DmgNum dmgs[NDMG];
static int shake_t, shake_pow;
static Rng fxrng = { 0xC0FFEE };

void fx_clear(void)
{
    memset(parts, 0, sizeof(parts));
    memset(dmgs, 0, sizeof(dmgs));
    shake_t = 0;
}

static Particle *alloc_part(void)
{
    for (int i = 0; i < NPART; i++)
        if (!parts[i].on)
            return &parts[i];
    return &parts[0];
}

void fx_stars(int x, int y)
{
    for (int i = 0; i < 4; i++) {
        Particle *p = alloc_part();
        p->on = true;
        p->kind = 0;
        p->x = FX(x);
        p->y = FX(y);
        p->vx = FXF(1.2f) * ((i & 1) ? 1 : -1);
        p->vy = -FXF(1.5f) - (fx32)(rng_next(&fxrng) % 4096);
        p->life = 22 + (i * 3);
    }
}

void fx_heart(int x, int y)
{
    Particle *p = alloc_part();
    p->on = true;
    p->kind = 1;
    p->x = FX(x);
    p->y = FX(y);
    p->vx = 0;
    p->vy = -FXF(0.6f);
    p->life = 40;
}

void fx_sparkle(int x, int y)
{
    Particle *p = alloc_part();
    p->on = true;
    p->kind = 2;
    p->x = FX(x + (int)(rng_next(&fxrng) % 9) - 4);
    p->y = FX(y + (int)(rng_next(&fxrng) % 9) - 4);
    p->vx = 0;
    p->vy = -FXF(0.3f);
    p->life = 24;
}

void fx_puff(int x, int y, int vy)
{
    Particle *p = alloc_part();
    p->on = true;
    p->kind = 3;
    p->x = FX(x + (int)(rng_next(&fxrng) % 7) - 3);
    p->y = FX(y);
    p->vx = ((int)(rng_next(&fxrng) % 2048)) - 1024;
    p->vy = vy;
    p->life = 30;
}

void fx_excl(int x, int y)
{
    Particle *p = alloc_part();
    p->on = true;
    p->kind = 4;
    p->x = FX(x);
    p->y = FX(y);
    p->vx = 0;
    p->vy = 0;
    p->life = 30;
}

void fx_damage(int x, int y, int value, bool heal)
{
    for (int i = 0; i < NDMG; i++) {
        if (dmgs[i].on)
            continue;
        dmgs[i].on = true;
        dmgs[i].x = FX(x);
        dmgs[i].y = FX(y);
        dmgs[i].vy = -FXF(2.2f);
        dmgs[i].life = 45;
        dmgs[i].value = value > 999 ? 999 : value;
        dmgs[i].heal = heal;
        return;
    }
}

void fx_shake(int frames, int power)
{
    shake_t = frames;
    shake_pow = power;
}

int fx_shake_x(void)
{
    if (shake_t <= 0)
        return 0;
    return ((shake_t & 1) ? 1 : -1) * shake_pow;
}

int fx_shake_y(void)
{
    if (shake_t <= 0)
        return 0;
    return ((shake_t & 2) ? 1 : -1) * (shake_pow / 2);
}

void fx_update(void)
{
    if (shake_t > 0)
        shake_t--;
    for (int i = 0; i < NPART; i++) {
        Particle *p = &parts[i];
        if (!p->on)
            continue;
        p->x += p->vx;
        p->y += p->vy;
        if (p->kind == 0)
            p->vy += FXF(0.15f);     // gravedad de estrellas
        if (--p->life <= 0)
            p->on = false;
    }
    for (int i = 0; i < NDMG; i++) {
        DmgNum *d = &dmgs[i];
        if (!d->on)
            continue;
        d->y += d->vy;
        d->vy += FXF(0.18f);
        if (d->vy > FXF(1.0f))
            d->vy = FXF(1.0f);
        if (--d->life <= 0)
            d->on = false;
    }
}

void fx_draw(int camx, int camy)
{
    for (int i = 0; i < NDMG; i++) {
        DmgNum *d = &dmgs[i];
        if (!d->on)
            continue;
        // dígitos centrados
        int v = d->value;
        int digits[3];
        int n = 0;
        do {
            digits[n++] = v % 10;
            v /= 10;
        } while (v && n < 3);
        int px = FX2INT(d->x) - camx - (n * 10) / 2;
        int py = FX2INT(d->y) - camy;
        int base = d->heal ? SPRF_FX_HEAL0 : SPRF_FX_DMG0;
        for (int k = n - 1; k >= 0; k--) {
            int wob = ((d->life + k * 5) % 10) < 5 ? -1 : 0;
            spr_draw(SH_FX, base + digits[k], px, py + wob, false, 0);
            px += 10;
        }
    }
    for (int i = 0; i < NPART; i++) {
        Particle *p = &parts[i];
        if (!p->on)
            continue;
        int fr;
        switch (p->kind) {
        case 0: fr = (p->life > 10) ? SPRF_FX_STAR0 : SPRF_FX_STAR1; break;
        case 1: fr = (p->life & 4) ? SPRF_FX_HEART0 : SPRF_FX_HEART1; break;
        case 2: fr = (p->life & 4) ? SPRF_FX_SPARKLE0 : SPRF_FX_SPARKLE1; break;
        case 3: fr = p->life > 20 ? SPRF_FX_PUFF0 :
                     (p->life > 10 ? SPRF_FX_PUFF1 : SPRF_FX_PUFF2); break;
        default: fr = SPRF_FX_EXCL; break;
        }
        spr_draw(SH_FX, fr, FX2INT(p->x) - camx - 8, FX2INT(p->y) - camy - 8,
                 false, 0);
    }
}
