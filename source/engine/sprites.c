#include <string.h>
#include "sprites.h"

#include "spr_benito_bin.h"
#include "spr_silva_bin.h"
#include "spr_deedee_bin.h"
#include "spr_terelu_bin.h"
#include "spr_abejorro_bin.h"
#include "spr_npcs_bin.h"
#include "spr_pulgon_bin.h"
#include "spr_semilla_bin.h"
#include "spr_bacteriolo_bin.h"
#include "spr_gusanillo_bin.h"
#include "spr_tapon_bin.h"
#include "spr_fx_bin.h"
#include "spr_portraits_bin.h"
#include "spr_banners_bin.h"

typedef struct {
    const u8 *data;
    u32 size_bytes;
    u16 fw, fh;             // tamaño de frame en píxeles
    SpriteSize osize;
} SheetDef;

#define SHEET(sym, w, h, os) { sym, sym##_size, w, h, os }

static const SheetDef sheets[SH_COUNT] = {
    [SH_BENITO]     = SHEET(spr_benito_bin, 32, 32, SpriteSize_32x32),
    [SH_SILVA]      = SHEET(spr_silva_bin, 32, 32, SpriteSize_32x32),
    [SH_DEEDEE]     = SHEET(spr_deedee_bin, 64, 64, SpriteSize_64x64),
    [SH_TERELU]     = SHEET(spr_terelu_bin, 32, 32, SpriteSize_32x32),
    [SH_ABEJORRO]   = SHEET(spr_abejorro_bin, 32, 32, SpriteSize_32x32),
    [SH_NPCS]       = SHEET(spr_npcs_bin, 32, 32, SpriteSize_32x32),
    [SH_PULGON]     = SHEET(spr_pulgon_bin, 32, 32, SpriteSize_32x32),
    [SH_SEMILLA]    = SHEET(spr_semilla_bin, 32, 32, SpriteSize_32x32),
    [SH_BACTERIOLO] = SHEET(spr_bacteriolo_bin, 32, 32, SpriteSize_32x32),
    [SH_GUSANILLO]  = SHEET(spr_gusanillo_bin, 32, 32, SpriteSize_32x32),
    [SH_TAPON]      = SHEET(spr_tapon_bin, 64, 64, SpriteSize_64x64),
    [SH_FX]         = SHEET(spr_fx_bin, 16, 16, SpriteSize_16x16),
    [SH_PORTRAITS]  = SHEET(spr_portraits_bin, 32, 32, SpriteSize_32x32),
    [SH_BANNERS]    = SHEET(spr_banners_bin, 64, 32, SpriteSize_64x32),
};

#define MAX_FRAMES 64
// el último KB de VRAM B queda reservado para el retrato de diálogo
#define ARENA_MAX (127 * 1024)
#define PORTRAIT_SLOT ((u16 *)((u8 *)SPRITE_GFX + ARENA_MAX))

static u16 *frame_gfx[SH_COUNT][MAX_FRAMES];
static bool sheet_loaded[SH_COUNT];
static u32 arena_off;
static int oam_next;
static int portrait_cur = -1;

void spr_init(void)
{
    spr_arena_reset();
}

void spr_arena_reset(void)
{
    arena_off = 0;
    memset(sheet_loaded, 0, sizeof(sheet_loaded));
    memset(frame_gfx, 0, sizeof(frame_gfx));
    portrait_cur = -1;
    oamClear(&oamMain, 0, 128);
    oamClear(&oamSub, 0, 128);
}

void spr_preload_max(int sheet, int maxframes)
{
    if (sheet_loaded[sheet])
        return;
    const SheetDef *s = &sheets[sheet];
    u32 frame_bytes = (u32)s->fw * s->fh;
    int nframes = s->size_bytes / frame_bytes;
    if (nframes > maxframes)
        nframes = maxframes;
    if (nframes > MAX_FRAMES)
        nframes = MAX_FRAMES;
    for (int i = 0; i < nframes; i++) {
        // alineación de 128 bytes (SpriteMapping_1D_128)
        arena_off = (arena_off + 127) & ~127u;
        u16 *dst = (u16 *)((u8 *)SPRITE_GFX + arena_off);
        if (arena_off + frame_bytes > ARENA_MAX)
            break;      // VRAM agotada: los frames restantes no se dibujan
        dmaCopy(s->data + i * frame_bytes, dst, frame_bytes);
        frame_gfx[sheet][i] = dst;
        arena_off += frame_bytes;
    }
    sheet_loaded[sheet] = true;
}

void spr_preload(int sheet)
{
    spr_preload_max(sheet, MAX_FRAMES);
}

void spr_portrait(int sheet, int frame)
{
    int key = sheet * 256 + frame;
    if (key == portrait_cur)
        return;
    portrait_cur = key;
    const SheetDef *s = &sheets[sheet];
    u32 frame_bytes = (u32)s->fw * s->fh;
    dmaCopy(s->data + frame * frame_bytes, PORTRAIT_SLOT, frame_bytes);
}

void spr_draw_portrait(int x, int y)
{
    if (oam_next >= 128 || portrait_cur < 0)
        return;
    oamSet(&oamMain, oam_next++, x, y, 0, 0,
           SpriteSize_32x32, SpriteColorFormat_256Color, PORTRAIT_SLOT,
           -1, false, false, false, false, false);
}

void spr_begin(void)
{
    oam_next = 0;
}

void spr_draw(int sheet, int frame, int x, int y, bool hflip, int bgpri)
{
    if (oam_next >= 128)
        return;
    const SheetDef *s = &sheets[sheet];
    u16 *gfx = frame_gfx[sheet][frame];
    if (!gfx || !sheet_loaded[sheet])
        return;
    // fuera de pantalla del todo: ni lo mandes
    if (x <= -s->fw || x >= 256 || y <= -s->fh || y >= 192)
        return;
    oamSet(&oamMain, oam_next++, x, y, bgpri, 0,
           s->osize, SpriteColorFormat_256Color, gfx, -1,
           false, false, hflip, false, false);
}

void spr_end(void)
{
    for (int i = oam_next; i < 128; i++)
        oamSetHidden(&oamMain, i, true);
}
