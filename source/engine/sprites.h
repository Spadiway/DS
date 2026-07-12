// Gestión de hojas de sprites y OAM en modo inmediato.
//
// Cada frame: spr_begin(); spr_draw(...) en orden (primero = encima);
// spr_end(). Las hojas se precargan a VRAM con spr_preload() tras
// spr_arena_reset() (al cambiar de sala o de estado).
#ifndef SPRITES_H__
#define SPRITES_H__

#include "common.h"
#include "sprites_meta.h"

enum {
    SH_BENITO, SH_SILVA, SH_DEEDEE, SH_TERELU, SH_ABEJORRO, SH_NPCS,
    SH_PULGON, SH_SEMILLA, SH_BACTERIOLO, SH_GUSANILLO, SH_TAPON,
    SH_FX, SH_PORTRAITS, SH_BANNERS,
    SH_COUNT
};

void spr_init(void);
void spr_arena_reset(void);
void spr_preload(int sheet);
// carga solo los primeros n frames (para ahorrar VRAM)
void spr_preload_max(int sheet, int maxframes);

// retrato de diálogo: slot dedicado de VRAM (no requiere precarga)
void spr_portrait(int sheet, int frame);
void spr_draw_portrait(int x, int y);

void spr_begin(void);
// prioridad 0-3 relativa a los fondos (0 = encima de todo)
void spr_draw(int sheet, int frame, int x, int y, bool hflip, int bgpri);
void spr_end(void);

#endif
