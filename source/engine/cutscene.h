// Motor de cinemáticas in-engine: actores (sprites), diálogo, música,
// escenas en la pantalla superior, fundidos y sacudidas, todo dirigido
// por guiones declarativos (arrays de CsCmd).
#ifndef CUTSCENE_H__
#define CUTSCENE_H__

#include "common.h"

enum {
    CS_END = 0,
    CS_SAY,        // str=texto, a=retrato, b=id de nombre (cs_names)
    CS_SCENE,      // a=id de escena superior (game_show_scene)
    CS_MUSIC,      // a=MUS_*
    CS_SFX,        // a=SND_*
    CS_WAIT,       // a=frames
    CS_SPAWN,      // a=actor, b=hoja, c,d=x,y (píxeles de mundo)
    CS_MOVE,       // a=actor, b,c=x,y destino, d=velocidad (px/frame x16)
    CS_ANIM,       // a=actor, b=frame base, c=nº frames, d=periodo
    CS_FRAME,      // a=actor, b=frame fijo
    CS_FLIP,       // a=actor, b=hflip
    CS_HIDE,       // a=actor
    CS_SHAKE,      // a=frames, b=fuerza
    CS_FADE,       // a=0 fuera, 1 dentro; b=frames
    CS_FLAG,       // a=índice de flag, b=valor
    CS_CALL,       // a=id de callback registrado por el juego, b=arg
    CS_PARTY_WARP, // a,b = x,y en metatiles (recoloca a los gatos)
};

typedef struct {
    u8 op;
    s16 a, b, c, d;
    const char *str;
} CsCmd;

typedef void (*CsCallback)(int arg);

void cutscene_register(int id, CsCallback fn);
void cutscene_start(const CsCmd *script);
bool cutscene_active(void);
void cutscene_update(void);
void cutscene_draw(int camx, int camy);   // dibuja actores

extern const char *const cs_names[];      // tabla de nombres de hablantes

#endif
