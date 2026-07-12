#include <string.h>
#include "text.h"
#include "video.h"
#include "fnt_main_bin.h"
#include "font_map.h"
#include "palette_ids.h"

// La tira de fuente: [tile 0 en blanco][glifos oscuros][glifos claros].
// Tras ellos colocamos los tiles de caja y barras.
#define T_GLYPH0   1
#define T_BOX      (1 + FONT_NUM_GLYPHS * 2)  // esquina, borde h, relleno, borde v
#define T_BAR      (T_BOX + 4)                // barras: por color: vacío+8 niveles

static u8 tile_buf[64];

static void put_tile(int index, const u8 *data)
{
    dmaCopy(data, (u8 *)BG_TILE_RAM(TILEBASE_FONT) + index * 64, 64);
    dmaCopy(data, (u8 *)BG_TILE_RAM_SUB(TILEBASE_FONT) + index * 64, 64);
}

static void make_box_tiles(void)
{
    // esquina superior izquierda redondeada
    memset(tile_buf, 0, 64);
    for (int y = 0; y < 8; y++) {
        for (int x = 0; x < 8; x++) {
            int inside = (x + y >= 4);
            int border = inside && (x + y <= 5 || (y == 7 && 0) ||
                                    (x == 7 && 0));
            u8 c = 0;
            if (inside)
                c = border ? COL_UIDARK : COL_CREAM;
            tile_buf[y * 8 + x] = c;
        }
    }
    put_tile(T_BOX, tile_buf);
    // borde superior
    for (int y = 0; y < 8; y++)
        for (int x = 0; x < 8; x++)
            tile_buf[y * 8 + x] = (y <= 1) ? COL_UIDARK : COL_CREAM;
    put_tile(T_BOX + 1, tile_buf);
    // relleno
    memset(tile_buf, COL_CREAM, 64);
    put_tile(T_BOX + 2, tile_buf);
    // borde izquierdo
    for (int y = 0; y < 8; y++)
        for (int x = 0; x < 8; x++)
            tile_buf[y * 8 + x] = (x <= 1) ? COL_UIDARK : COL_CREAM;
    put_tile(T_BOX + 3, tile_buf);
}

static const u8 bar_colors[3] = { COL_HPGREEN, COL_PEBLUE, COL_GOLD };

static void make_bar_tiles(void)
{
    for (int c = 0; c < 3; c++) {
        for (int lvl = 0; lvl <= 8; lvl++) {   // 0=vacío .. 8=lleno
            for (int y = 0; y < 8; y++) {
                for (int x = 0; x < 8; x++) {
                    u8 v;
                    if (y == 0 || y == 7)
                        v = COL_UIDARK;
                    else if (x < lvl)
                        v = (y == 1) ? COL_WHITE : bar_colors[c];
                    else
                        v = COL_SHADOW;
                    tile_buf[y * 8 + x] = v;
                }
            }
            put_tile(T_BAR + c * 9 + lvl, tile_buf);
        }
    }
}

void text_init(void)
{
    dmaCopy(fnt_main_bin, BG_TILE_RAM(TILEBASE_FONT), fnt_main_bin_size);
    dmaCopy(fnt_main_bin, BG_TILE_RAM_SUB(TILEBASE_FONT), fnt_main_bin_size);
    // el tile 0 del mapa de texto debe ser transparente: es el último +1;
    // en su lugar usamos el glifo de espacio (índice 0 de la fuente) que
    // ya es transparente.
    make_box_tiles();
    make_bar_tiles();
}

u32 utf8_next(const char **p)
{
    const u8 *s = (const u8 *)*p;
    u32 cp = *s;
    if (cp == 0)
        return 0;
    int extra = 0;
    if (cp >= 0xF0) { cp &= 0x07; extra = 3; }
    else if (cp >= 0xE0) { cp &= 0x0F; extra = 2; }
    else if (cp >= 0xC0) { cp &= 0x1F; extra = 1; }
    s++;
    while (extra-- && (*s & 0xC0) == 0x80)
        cp = (cp << 6) | (*s++ & 0x3F);
    *p = (const char *)s;
    return cp;
}

int txt_glyph(u32 cp)
{
    int lo = 0, hi = (int)(sizeof(font_map) / sizeof(font_map[0])) - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (font_map[mid].cp == cp)
            return font_map[mid].glyph;
        if (font_map[mid].cp < cp)
            lo = mid + 1;
        else
            hi = mid - 1;
    }
    return 0;
}

int txt_tile(u32 cp, int variant)
{
    return T_GLYPH0 + txt_glyph(cp) + (variant ? FONT_NUM_GLYPHS : 0);
}

int txt_width(const char *utf8)
{
    int n = 0;
    const char *p = utf8;
    while (utf8_next(&p))
        n++;
    return n;
}

int txt_draw(u16 *map, int x, int y, const char *utf8, int variant)
{
    const char *p = utf8;
    int cx = x;
    u32 cp;
    while ((cp = utf8_next(&p))) {
        if (cp == '\n') {
            y++;
            cx = x;
            continue;
        }
        int gl = T_GLYPH0 + txt_glyph(cp) + (variant ? FONT_NUM_GLYPHS : 0);
        if (cx >= 0 && cx < 32 && y >= 0 && y < 24)
            map[y * 32 + cx] = gl;
        cx++;
    }
    return cx - x;
}

void txt_clear(u16 *map, int x, int y, int w, int h)
{
    for (int j = y; j < y + h; j++)
        for (int i = x; i < x + w; i++)
            if (i >= 0 && i < 32 && j >= 0 && j < 24)
                map[j * 32 + i] = 0;
}

void txt_fill_screen(u16 *map)
{
    for (int i = 0; i < 32 * 24; i++)
        map[i] = 0;
}

void txt_box(u16 *map, int x, int y, int w, int h)
{
    const u16 HF = BIT(10), VF = BIT(11);
    for (int j = 0; j < h; j++) {
        for (int i = 0; i < w; i++) {
            u16 t;
            int right = (i == w - 1), bottom = (j == h - 1);
            if (i == 0 && j == 0)             t = T_BOX;
            else if (right && j == 0)         t = T_BOX | HF;
            else if (i == 0 && bottom)        t = T_BOX | VF;
            else if (right && bottom)         t = T_BOX | HF | VF;
            else if (j == 0)                  t = T_BOX + 1;
            else if (bottom)                  t = (T_BOX + 1) | VF;
            else if (i == 0)                  t = T_BOX + 3;
            else if (right)                   t = (T_BOX + 3) | HF;
            else                              t = T_BOX + 2;
            int xx = x + i, yy = y + j;
            if (xx >= 0 && xx < 32 && yy >= 0 && yy < 24)
                map[yy * 32 + xx] = t;
        }
    }
}

void txt_fill_box(u16 *map, int x, int y, int w, int h)
{
    for (int j = y; j < y + h; j++)
        for (int i = x; i < x + w; i++)
            if (i >= 0 && i < 32 && j >= 0 && j < 24)
                map[j * 32 + i] = T_BOX + 2;
}

void txt_bar(u16 *map, int x, int y, int cells, int val, int max, int color)
{
    if (max <= 0)
        max = 1;
    if (val < 0)
        val = 0;
    if (val > max)
        val = max;
    int px = val * cells * 8 / max;
    if (val > 0 && px == 0)
        px = 1;
    for (int i = 0; i < cells; i++) {
        int lvl = clampi(px - i * 8, 0, 8);
        int xx = x + i;
        if (xx >= 0 && xx < 32 && y >= 0 && y < 24)
            map[y * 32 + xx] = T_BAR + color * 9 + lvl;
    }
}
