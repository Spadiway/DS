// Generado por tools/gen_all.py — NO editar a mano
#ifndef ROOMS_DATA_H__
#define ROOMS_DATA_H__

#include <nds/ndstypes.h>

// tipos de entidad (coinciden con tools/gen_maps.py)
enum {
    E_NPC, E_ENEMY, E_SAVE, E_EXIT, E_TRIGGER, E_PLATE,
    E_GATE, E_CHEST, E_BLOCK, E_SWITCH, E_DOOR, E_VENT,
    E_BOSS, E_SHOP,
};

// NPCs
enum {
    NPC_BABA, NPC_RUFO, NPC_NUEZ, NPC_CROAC, NPC_ANCIANO,
    NPC_TENDERO,
};

typedef struct {
    u8 type;
    u16 x, y;
    u8 a, b, c, d;
} EntityDef;

typedef struct {
    u8 w, h;
    u8 mode;      // 0 vista sup, 1 lateral
    u8 tileset;   // 0 jardin, 1 colon
    u8 music;     // MUS_*
    u8 entry_x, entry_y;   // en metatiles
    const u8 *tiles;
    const EntityDef *ents;
    u8 n_ents;
} RoomDef;

#define ROOM_COUNT 4
#define ROOM_CESPED 0
#define ROOM_RECTO_A 1
#define ROOM_RECTO_B 2
#define ROOM_RECTO_C 3

extern const RoomDef rooms[ROOM_COUNT];

#endif
