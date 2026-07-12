// Guardado de partida.
//
// Backend principal: FAT (tarjeta SD del flashcart / DLDI). Crea
// benito_silva.sav en la raíz. Si no hay FAT disponible se intenta la
// SRAM de la ranura GBA y, en último término, solo memoria (se avisa).
#ifndef SAVE_H__
#define SAVE_H__

#include "common.h"

#define SAVE_MAGIC   0x42535631   // "BSV1"
#define SAVE_NFLAGS  64
#define SAVE_NITEMS  8

typedef struct {
    u32 magic;
    u32 checksum;
    // grupo por gato: nivel, exp, stats actuales
    struct {
        u8 level;
        u8 fue, def, vel;
        u16 hp, hpmax, pe, pemax;
        u32 exp;
        u8 bonus_fue, bonus_def, bonus_vel, bonus_hp, bonus_pe;
    } cat[2];
    u16 chapas;
    u8 inventory[SAVE_NITEMS];
    u8 flags[SAVE_NFLAGS];
    u8 room;
    u16 px, py;
    u8 reserved[16];
} SaveData;

// SAVE_BACKEND_*: cómo se consiguió guardar
enum { SAVE_NONE, SAVE_FAT, SAVE_SRAM };

void save_init(void);           // detecta backend disponible
int  save_backend(void);
bool save_exists(void);
bool save_write(const SaveData *d);
bool save_read(SaveData *d);

#endif
