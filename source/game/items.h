// Objetos e inventario. Portable (también en tests de host).
#ifndef ITEMS_H__
#define ITEMS_H__

#include <stdint.h>
#include <stdbool.h>

enum {
    IT_CROQUETA,     // cura 30 PV
    IT_CROQUETON,    // cura 80 PV
    IT_ATUN,         // revive con 50% PV
    IT_HIERBA,       // +50% FUE este combate
    IT_PELOTA,       // +10 PE
    IT_COLLAR,       // equipo: +2 DEF (se equipa al comprar/encontrar)
    IT_COUNT
};

typedef struct {
    const char *name;
    const char *desc;
    uint16_t price;
    uint8_t battle_usable;
} ItemDef;

extern const ItemDef item_defs[IT_COUNT];
extern uint8_t inventory[IT_COUNT];
extern uint16_t chapas;

bool item_give(int item, int n);      // false si inventario lleno (>9)
bool item_take(int item);             // false si no hay

#endif
