#include "items.h"

const ItemDef item_defs[IT_COUNT] = {
    [IT_CROQUETA] = { "Croqueta", "Cura 30 PV. Crujiente.", 8, 1 },
    [IT_CROQUETON] = { "Croquetón", "Cura 80 PV. El gourmet.", 20, 1 },
    [IT_ATUN] = { "Lata de atún", "Revive a un gato KO.", 30, 1 },
    [IT_HIERBA] = { "Hierba gatera", "+FUE durante el combate.", 12, 1 },
    [IT_PELOTA] = { "Pelotita", "Recupera 10 PE. ¡Bote bote!", 10, 1 },
    [IT_COLLAR] = { "Collar sencillo", "+2 DEF. Muy elegante.", 40, 0 },
};

uint8_t inventory[IT_COUNT];
uint16_t chapas;

bool item_give(int item, int n)
{
    if (inventory[item] + n > 9)
        return false;
    inventory[item] += n;
    return true;
}

bool item_take(int item)
{
    if (inventory[item] == 0)
        return false;
    inventory[item]--;
    return true;
}
