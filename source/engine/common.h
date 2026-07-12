// Utilidades comunes del motor
#ifndef COMMON_H__
#define COMMON_H__

#include <nds.h>

// Punto fijo 20.12
typedef s32 fx32;
#define FX(n)        ((fx32)((n) << 12))
#define FXF(f)       ((fx32)((f) * 4096.0f))
#define FX2INT(v)    ((v) >> 12)
#define FXMUL(a, b)  ((fx32)(((s64)(a) * (b)) >> 12))

static inline int clampi(int v, int lo, int hi)
{
    return v < lo ? lo : (v > hi ? hi : v);
}

static inline int absi(int v) { return v < 0 ? -v : v; }

static inline int signi(int v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }

// RNG xorshift determinista (compartido con los tests de host)
typedef struct { u32 s; } Rng;

static inline u32 rng_next(Rng *r)
{
    u32 x = r->s;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    r->s = x ? x : 0x1234567u;
    return x;
}

static inline int rng_range(Rng *r, int lo, int hi)   // [lo, hi]
{
    return lo + (int)(rng_next(r) % (u32)(hi - lo + 1));
}

#endif
