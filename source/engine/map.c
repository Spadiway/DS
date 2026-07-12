#include <string.h>
#include "map.h"
#include "video.h"
#include "tiles_data.h"
#include "set_jardin_bin.h"
#include "set_colon_bin.h"
#include "pal_master_bin.h"
#include "palette_ids.h"

static const RoomDef *cur;
static u8 grid[32 * 32];                // copia editable de metatiles
static const u16 (*mt_tiles)[4];
static const u8 *mt_flags;

static void write_metatile_maps(int mx, int my, int mt)
{
    // BG2 (base) y BG1 (overlay). Mapas de 64x64 tiles (4 screenblocks).
    u16 *base = (u16 *)BG_MAP_RAM(MAPBASE_MAP);
    u16 *over = (u16 *)BG_MAP_RAM(MAPBASE_OVERLAY);
    bool overlay = mt_flags[mt] & MF_OVERLAY;
    const u16 *t = mt_tiles[mt];
    const u16 *t0 = mt_tiles[0];
    for (int j = 0; j < 2; j++) {
        for (int i = 0; i < 2; i++) {
            int tx = mx * 2 + i, ty = my * 2 + j;
            int sb = (ty / 32) * 2 + (tx / 32);
            int off = sb * 1024 + (ty % 32) * 32 + (tx % 32);
            u16 tile = t[j * 2 + i];
            if (overlay) {
                over[off] = tile;
                base[off] = t0[j * 2 + i];   // suelo básico debajo
            } else {
                over[off] = 0;
                base[off] = tile;
            }
        }
    }
}

void map_load_room(const RoomDef *room)
{
    cur = room;
    if (room->tileset == 0) {
        dmaCopy(set_jardin_bin, (u8 *)BG_TILE_RAM(TILEBASE_SET),
                set_jardin_bin_size);
        mt_tiles = mt_jardin_tiles;
        mt_flags = mt_jardin_flags;
    } else {
        dmaCopy(set_colon_bin, (u8 *)BG_TILE_RAM(TILEBASE_SET),
                set_colon_bin_size);
        mt_tiles = mt_colon_tiles;
        mt_flags = mt_colon_flags;
    }
    memcpy(grid, room->tiles, room->w * room->h);

    // limpiar mapas por completo (bordes fuera de sala = tile 0)
    u16 *base = (u16 *)BG_MAP_RAM(MAPBASE_MAP);
    u16 *over = (u16 *)BG_MAP_RAM(MAPBASE_OVERLAY);
    for (int i = 0; i < 64 * 64; i++) {
        base[i] = 0;
        over[i] = 0;
    }
    for (int y = 0; y < room->h; y++)
        for (int x = 0; x < room->w; x++)
            write_metatile_maps(x, y, grid[y * room->w + x]);
}

void map_tick(void)
{
    // brillo del agua y del ácido: ciclo de paleta suave
    static int t;
    t++;
    const u16 *pal = (const u16 *)pal_master_bin;
    if ((t & 31) == 0) {
        int ph = (t >> 5) & 1;
        // agua: intercambia luz/base
        BG_PALETTE[52] = pal[ph ? 53 : 52];
        BG_PALETTE[53] = pal[ph ? 52 : 53];
        // ácido: parpadeo de la luz
        BG_PALETTE[COL_ACID] = pal[ph ? 67 : COL_ACID];
    }
}

int map_w_px(void)
{
    return cur ? cur->w * 16 : 256;
}

int map_h_px(void)
{
    return cur ? cur->h * 16 : 192;
}

int map_metatile(int mx, int my)
{
    if (!cur || mx < 0 || my < 0 || mx >= cur->w || my >= cur->h)
        return -1;
    return grid[my * cur->w + mx];
}

u8 map_flags_mt(int mx, int my)
{
    int mt = map_metatile(mx, my);
    if (mt < 0)
        return MF_SOLID;      // fuera de la sala = sólido
    return mt_flags[mt];
}

u8 map_flags_at(int px, int py)
{
    return map_flags_mt(px >> 4, py >> 4);
}

void map_set_metatile(int mx, int my, int mt)
{
    if (!cur || mx < 0 || my < 0 || mx >= cur->w || my >= cur->h)
        return;
    grid[my * cur->w + mx] = mt;
    write_metatile_maps(mx, my, mt);
}
