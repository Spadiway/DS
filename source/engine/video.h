// Configuración de pantallas, VRAM y capas.
//
// Motor principal -> PANTALLA INFERIOR (juego). Motor sub -> SUPERIOR.
//
// VRAM A (BG principal):
//   0x00000 tiles fuente/UI (base de tiles 0)
//   0x04000 mapa BG0 texto 32x32   (base de mapa 8)
//   0x04800 mapa BG1 overlay 64x64 (bases 9-12)
//   0x06800 mapa BG2 mapa 64x64    (bases 13-16)
//   0x08800 mapa BG3 fondo 32x32   (base 17)
//   0x0C000 tiles del tileset de sala (base de tiles 3)
//   0x10000 bitmap de combate (Modo 5, base 4) / tiles BG3 (base 4)
//
// VRAM C (BG sub): igual estructura: fuente + mapa BG0 + bitmap escena.
#ifndef VIDEO_H__
#define VIDEO_H__

#include "common.h"

#define TILEBASE_FONT   0
#define MAPBASE_TEXT    8
#define MAPBASE_OVERLAY 9
#define MAPBASE_MAP     13
#define MAPBASE_BACK    17
#define TILEBASE_SET    3
#define TILEBASE_BACK   4
#define BMPBASE_MAIN    4      // bitmap modo 5 en 0x10000

extern int bg_text, bg_overlay, bg_map, bg_back;      // ids libnds (main)
extern int sub_text, sub_scene;                       // ids libnds (sub)

// Modos de la pantalla principal
void video_init(void);
void video_mode_map(void);      // Modo 0: BG0 texto + BG1/2 mapa + BG3 fondo
void video_mode_battle(void);   // Modo 5: BG0 texto + BG3 bitmap
void video_show_scene(const u8 *scn);   // bitmap 256x192 en pantalla SUPERIOR
void video_battle_bitmap(const u8 *scn); // bitmap combate pantalla inferior

// mapas de texto (u16*) para el motor de texto
u16 *video_text_map_main(void);
u16 *video_text_map_sub(void);

// scroll de cámara del mapa
void video_scroll(int x, int y);

// fundidos (bloquean N frames)
void fade_out(int frames);
void fade_in(int frames);

void video_vblank(void);        // actualizar OAM etc. tras swiWaitForVBlank

#endif
