// Estado global del juego y máquina de estados principal.
#ifndef GAME_H__
#define GAME_H__

#include "common.h"
#include "rooms_data.h"

enum { GS_TITLE, GS_OVERWORLD, GS_BATTLE, GS_GAMEOVER, GS_ENDING };

// flags de progreso (persisten en el guardado)
enum {
    FL_INTRO,            // intro vista
    FL_TUTO_INTERIOR,    // tutorial del interior visto
    FL_PUZLE_JARDIN,     // puerta del recinto del jardín abierta
    FL_COFRE_JARDIN,
    FL_COFRE_RECTO,
    FL_PUERTA_RECTO,     // esfínter de recto_b abierto
    FL_JEFE_TAPON,       // jefe vencido
    FL_HITO1,            // final del hito 1 visto
    FL_HABLO_ANCIANO,
    FL_PLACA0, FL_PLACA1, FL_PLACA2,
    FL_COUNT
};

// escenas de la pantalla superior
enum {
    SCN_JARDIN, SCN_CAOS, SCN_CONSEJO, SCN_COLON, SCN_CEREBRO,
    SCN_TITLE, SCN_STATUS,
};

int  game_flag(int idx);
void game_set_flag(int idx, int val);
void game_show_scene(int id);

// peticiones diferidas (se aplican al final del frame)
void game_request_room(int room, int mx, int my);
void game_request_battle(const u8 formation[3], bool boss);
void game_request_state(int state);

int  game_current_room(void);
void game_party_warp(int mx, int my);

// HUD de la pantalla superior
void hud_refresh(void);

void game_new(void);            // partida nueva (con intro)
void game_new_skip_intro(void); // acceso de desarrollo
bool game_load(void);           // carga del guardado
bool game_save(void);           // vuelca el estado al backend

#endif
