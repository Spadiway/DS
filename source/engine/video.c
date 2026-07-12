#include <string.h>
#include "video.h"
#include "pal_master_bin.h"

int bg_text = -1, bg_overlay = -1, bg_map = -1, bg_back = -1;
int sub_text = -1, sub_scene = -1;

static void load_palettes(void)
{
    dmaCopy(pal_master_bin, BG_PALETTE, 512);
    dmaCopy(pal_master_bin, BG_PALETTE_SUB, 512);
    dmaCopy(pal_master_bin, SPRITE_PALETTE, 512);
    dmaCopy(pal_master_bin, SPRITE_PALETTE_SUB, 512);
    // el índice 0 (transparente) del fondo se ve como color de borde:
    BG_PALETTE[0] = RGB15(2, 2, 4);
    BG_PALETTE_SUB[0] = RGB15(2, 2, 4);
}

void video_init(void)
{
    videoSetMode(MODE_0_2D);
    videoSetModeSub(MODE_5_2D);
    vramSetPrimaryBanks(VRAM_A_MAIN_BG, VRAM_B_MAIN_SPRITE,
                        VRAM_C_SUB_BG, VRAM_D_SUB_SPRITE);
    lcdMainOnBottom();      // el juego se juega en la pantalla táctil

    load_palettes();

    oamInit(&oamMain, SpriteMapping_1D_128, false);
    oamInit(&oamSub, SpriteMapping_1D_128, false);

    // Sub: BG0 texto encima del bitmap de escena (BG2)
    sub_text = bgInitSub(0, BgType_Text8bpp, BgSize_T_256x256,
                         MAPBASE_TEXT, TILEBASE_FONT);
    bgSetPriority(sub_text, 0);
    sub_scene = bgInitSub(2, BgType_Bmp8, BgSize_B8_256x256, BMPBASE_MAIN, 0);
    bgSetPriority(sub_scene, 3);

    video_mode_map();
}

void video_mode_map(void)
{
    videoSetMode(MODE_0_2D | DISPLAY_SPR_ACTIVE | DISPLAY_SPR_1D |
                 DISPLAY_SPR_1D_SIZE_128);
    bg_text = bgInit(0, BgType_Text8bpp, BgSize_T_256x256,
                     MAPBASE_TEXT, TILEBASE_FONT);
    bgSetPriority(bg_text, 0);
    bg_overlay = bgInit(1, BgType_Text8bpp, BgSize_T_512x512,
                        MAPBASE_OVERLAY, TILEBASE_SET);
    bgSetPriority(bg_overlay, 1);
    bg_map = bgInit(2, BgType_Text8bpp, BgSize_T_512x512,
                    MAPBASE_MAP, TILEBASE_SET);
    bgSetPriority(bg_map, 2);
    bg_back = bgInit(3, BgType_Text8bpp, BgSize_T_256x256,
                     MAPBASE_BACK, TILEBASE_BACK);
    bgSetPriority(bg_back, 3);
}

void video_mode_battle(void)
{
    videoSetMode(MODE_5_2D | DISPLAY_SPR_ACTIVE | DISPLAY_SPR_1D |
                 DISPLAY_SPR_1D_SIZE_128);
    bg_text = bgInit(0, BgType_Text8bpp, BgSize_T_256x256,
                     MAPBASE_TEXT, TILEBASE_FONT);
    bgSetPriority(bg_text, 0);
    bg_back = bgInit(3, BgType_Bmp8, BgSize_B8_256x256, BMPBASE_MAIN, 0);
    bgSetPriority(bg_back, 3);
    bg_overlay = -1;
    bg_map = -1;
}

void video_show_scene(const u8 *scn)
{
    // bitmap 256x192 -> VRAM C offset 0x10000
    dmaCopy(scn, bgGetGfxPtr(sub_scene), 256 * 192);
}

void video_battle_bitmap(const u8 *scn)
{
    dmaCopy(scn, bgGetGfxPtr(bg_back), 256 * 192);
}

u16 *video_text_map_main(void)
{
    return (u16 *)(BG_MAP_RAM(MAPBASE_TEXT));
}

u16 *video_text_map_sub(void)
{
    return (u16 *)(BG_MAP_RAM_SUB(MAPBASE_TEXT));
}

void video_scroll(int x, int y)
{
    if (bg_map >= 0) {
        bgSetScroll(bg_map, x, y);
        bgSetScroll(bg_overlay, x, y);
    }
    if (bg_back >= 0 && bg_map >= 0)
        bgSetScroll(bg_back, x / 2, y / 2);
}

void video_vblank(void)
{
    swiWaitForVBlank();
    oamUpdate(&oamMain);
    oamUpdate(&oamSub);
    bgUpdate();
}

void fade_out(int frames)
{
    for (int i = 0; i <= frames; i++) {
        int v = -(i * 16) / frames;
        setBrightness(3, v);        // ambas pantallas
        video_vblank();
    }
}

void fade_in(int frames)
{
    for (int i = 0; i <= frames; i++) {
        int v = -16 + (i * 16) / frames;
        setBrightness(3, v);
        video_vblank();
    }
}
