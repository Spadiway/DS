#include <string.h>
#include "dialog.h"
#include "text.h"
#include "video.h"
#include "sprites.h"
#include "audio.h"

// caja: filas 17-23 del layer de texto; texto en filas 18-22
#define BOX_Y 17
#define BOX_H 7
#define TEXT_X 6
#define TEXT_W 25
#define TEXT_LINES 4

static struct {
    bool active;
    const char *text;       // puntero de avance (UTF-8)
    char name[24];
    int portrait;
    int col, line;          // posición de escritura
    int cooldown;           // frames entre caracteres
    bool page_full;         // esperando A
    bool done_text;
    int blink;
    // elección
    bool has_choice;
    char opt[2][16];
    int choice_sel;
    bool choosing;
    int result;
    int talk_anim;
} dlg;

static void draw_frame_ui(void)
{
    u16 *map = video_text_map_main();
    txt_box(map, 0, BOX_Y, 32, BOX_H);
    if (dlg.name[0]) {
        int w = txt_width(dlg.name);
        txt_box(map, 0, BOX_Y - 1, w + 2, 2);
        txt_draw(map, 1, BOX_Y, dlg.name, TXT_DARK);
    }
}

void dialog_open(int portrait_frame, const char *name, const char *text)
{
    memset(&dlg, 0, sizeof(dlg));
    dlg.active = true;
    dlg.text = text;
    dlg.portrait = portrait_frame;
    if (name) {
        strncpy(dlg.name, name, sizeof(dlg.name) - 1);
    }
    dlg.has_choice = false;
    draw_frame_ui();
    if (portrait_frame >= 0)
        spr_portrait(SH_PORTRAITS, portrait_frame);
    spr_preload(SH_FX);
}

void dialog_open_choice(int portrait_frame, const char *name,
                        const char *text, const char *opt_a,
                        const char *opt_b)
{
    dialog_open(portrait_frame, name, text);
    dlg.has_choice = true;
    strncpy(dlg.opt[0], opt_a, 15);
    strncpy(dlg.opt[1], opt_b, 15);
}

bool dialog_active(void)
{
    return dlg.active;
}

int dialog_result(void)
{
    return dlg.result;
}

static void clear_text_area(void)
{
    u16 *map = video_text_map_main();
    txt_fill_box(map, TEXT_X, BOX_Y + 1, TEXT_W, TEXT_LINES + 1);
    dlg.col = 0;
    dlg.line = 0;
}

// longitud en celdas de la siguiente palabra (para el ajuste de línea)
static int word_len(const char *p)
{
    int n = 0;
    u32 cp;
    const char *q = p;
    while ((cp = utf8_next(&q)) && cp != ' ' && cp != '\n' && cp != '|')
        n++;
    return n;
}

static void put_char(u32 cp)
{
    u16 *map = video_text_map_main();
    map[(BOX_Y + 1 + dlg.line) * 32 + TEXT_X + dlg.col] =
        txt_tile(cp, TXT_DARK);
    dlg.col++;
}

// avanza un carácter de la máquina de escribir; true si sigue habiendo
static bool typewriter_step(void)
{
    if (!dlg.text || !*dlg.text)
        return false;
    const char *p = dlg.text;
    u32 cp = utf8_next(&p);
    if (cp == 0)
        return false;

    if (cp == '|') {                  // salto de página forzado
        dlg.text = p;
        dlg.page_full = true;
        return true;
    }
    if (cp == '\n') {
        dlg.text = p;
        dlg.col = 0;
        dlg.line++;
    } else if (cp == ' ') {
        dlg.text = p;
        if (dlg.col > 0) {
            // ¿cabe la siguiente palabra?
            if (dlg.col + 1 + word_len(p) > TEXT_W) {
                dlg.col = 0;
                dlg.line++;
            } else {
                put_char(' ');
            }
        }
    } else {
        if (dlg.col >= TEXT_W) {
            dlg.col = 0;
            dlg.line++;
        }
        if (dlg.line >= TEXT_LINES) {
            dlg.page_full = true;     // no consumimos el carácter
            return true;
        }
        dlg.text = p;
        put_char(cp);
    }
    if (dlg.line >= TEXT_LINES && *dlg.text) {
        dlg.page_full = true;
    }
    return true;
}

static void begin_choice(void)
{
    u16 *map = video_text_map_main();
    dlg.choosing = true;
    dlg.choice_sel = 0;
    txt_box(map, 22, BOX_Y - 4, 10, 4);
    txt_draw(map, 25, BOX_Y - 3, dlg.opt[0], TXT_DARK);
    txt_draw(map, 25, BOX_Y - 2, dlg.opt[1], TXT_DARK);
}

void dialog_update(void)
{
    if (!dlg.active)
        return;
    dlg.blink++;
    u16 down = keysDown();
    u16 held = keysHeld();

    if (dlg.choosing) {
        u16 *map = video_text_map_main();
        if (down & (KEY_UP | KEY_DOWN)) {
            dlg.choice_sel ^= 1;
            sfx(SND_MENU);
        }
        if (down & KEY_A) {
            dlg.result = dlg.choice_sel;
            sfx(SND_OK);
            txt_clear(map, 22, BOX_Y - 4, 10, 4);
            txt_clear(map, 0, BOX_Y - 1, 32, BOX_H + 1);
            dlg.active = false;
        }
        return;
    }

    if (dlg.page_full || dlg.done_text) {
        if (down & KEY_A) {
            if (dlg.done_text) {
                if (dlg.has_choice) {
                    begin_choice();
                    return;
                }
                u16 *map = video_text_map_main();
                txt_clear(map, 0, BOX_Y - 1, 32, BOX_H + 1);
                dlg.active = false;
                sfx(SND_OK);
                return;
            }
            // página siguiente
            clear_text_area();
            dlg.page_full = false;
            sfx(SND_MENU);
        }
        return;
    }

    // velocidad: 1 char cada 2 frames; con B mantenida, 3 por frame;
    // con A, la página se completa al instante
    int chars = (held & KEY_B) ? 3 : (dlg.blink & 1);
    if (down & KEY_A)
        chars = 512;
    bool any = true;
    while (chars-- > 0 && any) {
        any = typewriter_step();
        if (dlg.page_full)
            break;
        if ((dlg.blink & 7) == 0 && chars < 8)
            sfx(SND_MENU);
    }
    if (!any)
        dlg.done_text = true;

    dlg.talk_anim++;
}

void dialog_draw(void)
{
    if (!dlg.active)
        return;
    // retrato parlante: alterna normal/habla mientras escribe
    int fr = dlg.portrait;
    if (fr >= 0) {
        if (!dlg.done_text && !dlg.page_full && (dlg.talk_anim & 8) &&
            fr == SPRF_PORTRAITS_BENITO_NORMAL)
            fr = SPRF_PORTRAITS_BENITO_HABLA;
        if (!dlg.done_text && !dlg.page_full && (dlg.talk_anim & 8) &&
            fr == SPRF_PORTRAITS_SILVA_NORMAL)
            fr = SPRF_PORTRAITS_SILVA_HABLA;
        spr_portrait(SH_PORTRAITS, fr);
        spr_draw_portrait(8, 148);
    }

    // flecha de "hay más" parpadeante
    if (dlg.page_full || dlg.done_text) {
        int f = (dlg.blink & 16) ? SPRF_FX_ARROW0 : SPRF_FX_ARROW1;
        spr_draw(SH_FX, f, 240, 178, false, 0);
    }
    if (dlg.choosing) {
        spr_draw(SH_FX, (dlg.blink & 16) ? SPRF_FX_PAW0 : SPRF_FX_PAW1,
                 178, 8 * (BOX_Y - 3 + dlg.choice_sel) - 4, false, 0);
    }
}
