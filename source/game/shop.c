#include <stdio.h>
#include "shop.h"
#include "text.h"
#include "video.h"
#include "sprites.h"
#include "audio.h"
#include "items.h"
#include "game.h"
#include "dialog.h"
#include "player.h"

static bool active;
static int sel;
static int greet_done;

static const int stock[] = { IT_CROQUETA, IT_CROQUETON, IT_ATUN,
                             IT_HIERBA, IT_PELOTA, IT_COLLAR };
#define STOCK_N ((int)(sizeof(stock) / sizeof(stock[0])))

static void draw_ui(void)
{
    u16 *map = video_text_map_main();
    txt_fill_screen(map);
    txt_box(map, 1, 1, 30, 17);
    txt_draw(map, 3, 2, "Tienda del Zzzum-Mercado", TXT_DARK);
    char buf[48];
    snprintf(buf, sizeof(buf), "Chapas: %d", chapas);
    txt_draw(map, 20, 2, buf, TXT_DARK);
    for (int i = 0; i < STOCK_N; i++) {
        const ItemDef *d = &item_defs[stock[i]];
        snprintf(buf, sizeof(buf), "%s%-16s %3d ch ×%d",
                 i == sel ? "→" : " ", d->name, d->price,
                 inventory[stock[i]]);
        txt_draw(map, 3, 4 + i * 2, buf, TXT_DARK);
    }
    txt_fill_box(map, 2, 16, 28, 1);
    txt_draw(map, 3, 16, item_defs[stock[sel]].desc, TXT_DARK);
    txt_draw(map, 3, 22, "A: comprar   B: salir", TXT_LIGHT);
}

void shop_open(void)
{
    active = true;
    sel = 0;
    if (!greet_done) {
        greet_done = 1;
        dialog_open(SPRF_PORTRAITS_TENDERO_NORMAL, "Tendero",
                    "¡Zzzum! Bienvenidos al Zzzum-Mercado. Todo "
                    "polinizado a mano.| Si algo os pica, es la "
                    "calidad.");
    }
    draw_ui();
}

bool shop_active(void)
{
    return active;
}

void shop_update(void)
{
    if (dialog_active()) {
        dialog_update();
        if (!dialog_active())
            draw_ui();
        return;
    }
    u16 down = keysDown();
    if (down & KEY_B) {
        active = false;
        txt_fill_screen(video_text_map_main());
        sfx(SND_CANCEL);
        return;
    }
    if (down & KEY_UP) {
        sel = (sel + STOCK_N - 1) % STOCK_N;
        sfx(SND_MENU);
        draw_ui();
    }
    if (down & KEY_DOWN) {
        sel = (sel + 1) % STOCK_N;
        sfx(SND_MENU);
        draw_ui();
    }
    if (down & KEY_A) {
        int it = stock[sel];
        const ItemDef *d = &item_defs[it];
        if (chapas < d->price) {
            sfx(SND_CANCEL);
            dialog_open(SPRF_PORTRAITS_TENDERO_NORMAL, "Tendero",
                        "Zzz… chapas insuficientes. La miel no crece "
                        "en los árboles. Bueno, sí, pero ya me "
                        "entendéis.");
            return;
        }
        if (it == IT_COLLAR) {
            if (party[0].collar && party[1].collar) {
                sfx(SND_CANCEL);
                dialog_open(SPRF_PORTRAITS_TENDERO_NORMAL, "Tendero",
                            "¡Ya lleváis collar los dos! Más collares "
                            "sería… un exceso de bisutería.");
                return;
            }
            chapas -= d->price;
            if (!party[0].collar)
                party[0].collar = true;
            else
                party[1].collar = true;
            sfx(SND_CHAPA);
        } else {
            if (!item_give(it, 1)) {
                sfx(SND_CANCEL);
                dialog_open(SPRF_PORTRAITS_TENDERO_NORMAL, "Tendero",
                            "¡No os caben más! Ni con la barriga de "
                            "Benito de almacén.");
                return;
            }
            chapas -= d->price;
            sfx(SND_CHAPA);
        }
        hud_refresh();
        draw_ui();
    }
}

void shop_draw(void)
{
    if (!active)
        return;
    dialog_draw();
}
