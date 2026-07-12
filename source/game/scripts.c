#include "scripts.h"
#include "dialog.h"
#include "sprites.h"
#include "audio.h"
#include "game.h"
#include "player.h"
#include "save.h"
#include "fx.h"
#include "overworld.h"
#include "battle_core.h"

// nombres de hablantes para CS_SAY (índice b)
const char *const cs_names[] = {
    NULL, "Benito", "Silva", "Deedee", "Terelu", "Abejorro Anciano",
    "¿¿¿???", "El Gran Tapón",
};
enum { N_NARR = 0, N_BEN, N_SIL, N_DEE, N_TER, N_ANC, N_MIST, N_TAP };

#define P_BEN  SPRF_PORTRAITS_BENITO_NORMAL
#define P_BENF SPRF_PORTRAITS_BENITO_FELIZ
#define P_BENS SPRF_PORTRAITS_BENITO_SUSTO
#define P_SIL  SPRF_PORTRAITS_SILVA_NORMAL
#define P_SILF SPRF_PORTRAITS_SILVA_FELIZ
#define P_SILS SPRF_PORTRAITS_SILVA_SUSTO
#define P_DEE  SPRF_PORTRAITS_DEEDEE_NORMAL
#define P_DEEF SPRF_PORTRAITS_DEEDEE_FELIZ
#define P_TER  SPRF_PORTRAITS_TERELU_NORMAL
#define P_TERR SPRF_PORTRAITS_TERELU_RISA
#define P_ANC  SPRF_PORTRAITS_ANCIANO_NORMAL
#define P_NONE (-1)

// actores
enum { A_DEEDEE = 0, A_TERELU = 1 };

// ---------------------------------------------------------------------------
// INTRO: día tranquilo -> Terelu tragada -> caos -> consejo -> entrada
// (se reproduce en el Césped Central)
// ---------------------------------------------------------------------------

const CsCmd sc_intro[] = {
    { CS_SCENE, SCN_JARDIN, 0, 0, 0, NULL },
    { CS_MUSIC, MUS_JARDIN, 0, 0, 0, NULL },
    { CS_FADE, 1, 20, 0, 0, NULL },
    { CS_SAY, P_NONE, N_NARR, 0, 0,
      "Un día perfectamente tranquilo en el jardín.|El sol brilla, "
      "los abejorros zumban, y Deedee, el chihuahua de la casa, "
      "caza bichos con su arma favorita: la lengua." },

    // Deedee juguetea delante de su caseta
    { CS_SPAWN, A_DEEDEE, SH_DEEDEE, 252, 116, NULL },
    { CS_ANIM, A_DEEDEE, SPRF_DEEDEE_IDLE0, 2, 16, NULL },
    { CS_WAIT, 40, 0, 0, 0, NULL },
    { CS_ANIM, A_DEEDEE, SPRF_DEEDEE_LICK0, 2, 8, NULL },
    { CS_SFX, SND_LENGUA, 0, 0, 0, NULL },
    { CS_WAIT, 40, 0, 0, 0, NULL },
    { CS_SAY, P_DEEF, N_DEE, 0, 0,
      "¡Bichos! ¡Bichos ricos! ¡Deedee es el MEJOR cazador de "
      "bichos del universo conocido y del jardín!" },

    // llega Terelu zumbando
    { CS_SFX, SND_ZUMBIDO, 0, 0, 0, NULL },
    { CS_SPAWN, A_TERELU, SH_TERELU, 360, 70, NULL },
    { CS_ANIM, A_TERELU, SPRF_TERELU_HOVER0, 2, 6, NULL },
    { CS_MOVE, A_TERELU, 280, 95, 24, NULL },
    { CS_SAY, P_TER, N_TER, 0, 0,
      "¡Jiji-zzz! ¡Terelu ha llegado con el zumbido de mil "
      "meriendas!| Este jardín pronto será el mantel donde Terelu "
      "unta su TIRANÍA. ¡La mermelada del caos se avecina!" },
    { CS_SAY, P_SILS, N_SIL, 0, 0,
      "…¿Esa mosca acaba de anunciar su plan maligno EN VOZ ALTA?" },
    { CS_SAY, P_BEN, N_BEN, 0, 0,
      "Chist, Silva. Deedee la está mirando con ojos de merienda." },

    // el lengüetazo fatal
    { CS_MOVE, A_TERELU, 265, 100, 20, NULL },
    { CS_ANIM, A_DEEDEE, SPRF_DEEDEE_LICK0, 2, 5, NULL },
    { CS_SFX, SND_LENGUA, 0, 0, 0, NULL },
    { CS_WAIT, 20, 0, 0, 0, NULL },
    { CS_HIDE, A_TERELU, 0, 0, 0, NULL },
    { CS_SFX, SND_TRAGAR, 0, 0, 0, NULL },
    { CS_SHAKE, 12, 2, 0, 0, NULL },
    { CS_SAY, P_DEEF, N_DEE, 0, 0,
      "¡ÑAM! …Uy. Esta crujía raro. Sabía a… ¿planes malvados?" },
    { CS_WAIT, 30, 0, 0, 0, NULL },

    // Terelu no muere: sube al cerebro
    { CS_SAY, P_TERR, N_TER, 0, 0,
      "¡JI JI JI-ZZZUM! ¡Error de cálculo TUYO, perro salchicha "
      "de feria!| ¡Terelu no acaba en tripa! ¡Terelu ASCIENDE! "
      "¡Al ático de tu cabeza, donde guardas las tres ideas que "
      "tienes!| ¡Desde hoy tu lengua trabaja para MÍ! ¡Que "
      "comience el GRAN LAMETÓN!" },
    { CS_MUSIC, MUS_TERELU, 0, 0, 0, NULL },
    { CS_SCENE, SCN_CAOS, 0, 0, 0, NULL },
    { CS_ANIM, A_DEEDEE, SPRF_DEEDEE_LICK0, 2, 4, NULL },
    { CS_SFX, SND_LENGUA, 0, 0, 0, NULL },
    { CS_SHAKE, 20, 2, 0, 0, NULL },
    { CS_SAY, P_NONE, N_NARR, 0, 0,
      "Y así empezó el desastre.|Lametones a las flores. Lametones "
      "a las colmenas. Lametones al gato del vecino, al buzón, al "
      "cartero y al concepto mismo de la dignidad.|El reino animal "
      "del jardín, aterrorizado, convocó a su consejo de sabios." },

    // el consejo
    { CS_SCENE, SCN_CONSEJO, 0, 0, 0, NULL },
    { CS_MUSIC, MUS_JARDIN, 0, 0, 0, NULL },
    { CS_HIDE, A_DEEDEE, 0, 0, 0, NULL },
    { CS_SAY, P_ANC, N_ANC, 0, 0,
      "¡Zzzum! Orden en la colmena. La situación es grave: esa "
      "mosca, Terelu, gobierna la lengua de Deedee desde su "
      "cerebro.| Ningún abejorro puede entrar ahí: demasiado "
      "grandes, demasiado peludos, demasiado deliciosos.| Solo hay "
      "dos criaturas en este jardín lo bastante pequeñas, valientes "
      "y con las siete vidas necesarias…" },
    { CS_SAY, P_BENS, N_BEN, 0, 0,
      "…¿Por qué nos mira todo el mundo? Silva, ¿por qué nos "
      "miran?" },
    { CS_SAY, P_SIL, N_SIL, 0, 0,
      "Porque somos los héroes, Benito. Es lo que pasa por dormir "
      "en las reuniones del consejo." },
    { CS_SAY, P_ANC, N_ANC, 0, 0,
      "¡Benito! ¡Silva! El plan es sencillo: entrar en Deedee, "
      "subir órgano a órgano, y desalojar a esa okupa zumbona del "
      "cerebro.| El único acceso seguro es… ejem… la puerta de "
      "servicio. La de atrás. La que no tiene timbre." },
    { CS_SAY, P_BENS, N_BEN, 0, 0,
      "La de… atrás. Atrás atrás. ¿ESA de atrás?|¿No hay una "
      "ventana? ¿Una gatera? ¡¿UN FORMULARIO?!" },
    { CS_SAY, P_SILF, N_SIL, 0, 0,
      "Siete vidas, hermanito. Con esta nos quedarán seis y media." },

    // la entrada
    { CS_SCENE, SCN_JARDIN, 0, 0, 0, NULL },
    { CS_SPAWN, A_DEEDEE, SH_DEEDEE, 252, 116, NULL },
    { CS_ANIM, A_DEEDEE, SPRF_DEEDEE_IDLE0, 2, 20, NULL },
    { CS_SAY, P_NONE, N_NARR, 0, 0,
      "Y así, con la dignidad en modo ahorro de energía, los "
      "hermanos se acercaron al chihuahua dormido…" },
    { CS_PARTY_WARP, 16, 7, 0, 0, NULL },
    { CS_WAIT, 30, 0, 0, 0, NULL },
    { CS_SAY, P_BEN, N_BEN, 0, 0, "Silva." },
    { CS_SAY, P_SIL, N_SIL, 0, 0, "Benito." },
    { CS_SAY, P_BEN, N_BEN, 0, 0, "Si salimos de esta…" },
    { CS_SAY, P_SILF, N_SIL, 0, 0,
      "No se lo contaremos JAMÁS a nadie. Trato hecho. ¡Adentro!" },
    { CS_FADE, 0, 30, 0, 0, NULL },
    { CS_SFX, SND_GAS, 0, 0, 0, NULL },
    { CS_FLAG, FL_INTRO, 1, 0, 0, NULL },
    { CS_CALL, CB_IR_A_SALA, 1, 0, 0, NULL },   // ROOM_RECTO_A
    { CS_END, 0, 0, 0, 0, NULL },
};

// ---------------------------------------------------------------------------
// Tutorial del interior (al caer en el recto)
// ---------------------------------------------------------------------------

const CsCmd sc_tutorial_interior[] = {
    { CS_SCENE, SCN_COLON, 0, 0, 0, NULL },
    { CS_SAY, P_BENS, N_BEN, 0, 0,
      "Puaj. Puaj. PUAJ. Estamos… dentro. Huele a perro por "
      "TODAS partes. Bueno, técnicamente ES perro por todas "
      "partes." },
    { CS_SAY, P_SIL, N_SIL, 0, 0,
      "Bienvenido al Recto de Deedee, hermanito. Próxima parada: "
      "todo lo demás.| Muévete con la cruceta y salta con A. "
      "Con B se habla y se toquetea lo que parezca interesante." },
    { CS_SAY, P_SILF, N_SIL, 0, 0,
      "¿Ves esos agujeros del suelo? Sueltan gases que empujan "
      "hacia arriba. Nada de risitas: son nuestro ascensor.| Y "
      "cuidado con los charcos verdes. El ácido pica más que "
      "Rufo un lunes." },
    { CS_SAY, P_BENF, N_BEN, 0, 0,
      "Entendido: saltar en los pedos, no nadar en la sopa "
      "verde. Mamá estaría orgullosísima." },
    { CS_END, 0, 0, 0, 0, NULL },
};

// ---------------------------------------------------------------------------
// Jefe: El Gran Tapón
// ---------------------------------------------------------------------------

const CsCmd sc_jefe_tapon[] = {
    { CS_MUSIC, MUS_NADA, 0, 0, 0, NULL },
    { CS_SHAKE, 20, 2, 0, 0, NULL },
    { CS_SFX, SND_GOLPE, 0, 0, 0, NULL },
    { CS_SAY, P_NONE, N_TAP, 0, 0,
      "¿QUIÉN osa pasear por MI colon?" },
    { CS_SAY, P_BENS, N_BEN, 0, 0,
      "¡¿El pasillo habla?! Silva, ¡el pasillo habla!" },
    { CS_SAY, P_NONE, N_TAP, 0, 0,
      "¡Soy El Gran Tapón! ¡Guardián del atasco! ¡Rey del "
      "estreñimiento!| La señora mosca me dio un trabajo: NADA "
      "sube por aquí. Ni la comida, ni la esperanza, ni DOS GATOS "
      "DE ALQUILER." },
    { CS_SAY, P_SIL, N_SIL, 0, 0,
      "Técnicamente somos gatos de compañía. Y técnicamente… "
      "vas a apartarte." },
    { CS_SAY, P_NONE, N_TAP, 0, 0,
      "¡JA! ¡Venid a por mí, bolas de pelo! ¡Os voy a COMPACTAR!" },
    { CS_CALL, CB_BATALLA_JEFE, 0, 0, 0, NULL },
    { CS_END, 0, 0, 0, 0, NULL },
};

const CsCmd sc_tapon_derrotado[] = {
    { CS_MUSIC, MUS_INTERIOR, 0, 0, 0, NULL },
    { CS_SHAKE, 24, 3, 0, 0, NULL },
    { CS_SFX, SND_GAS, 0, 0, 0, NULL },
    { CS_SAY, P_NONE, N_TAP, 0, 0,
      "¡NOOO! ¡Mi atasco perfecto! ¡Desatascado por GATOS!|"
      "*plof*… decidle a la mosca… que lo intenté…" },
    { CS_SAY, P_BENF, N_BEN, 0, 0,
      "¡Victoria! ¿Has oído eso, Deedee? ¡Por dentro también "
      "somos tus héroes!" },
    { CS_SAY, P_SILF, N_SIL, 0, 0,
      "El camino hacia los intestinos está abierto. Arriba "
      "esperan más órganos, más parásitos raros… y una mosca "
      "con complejo de emperatriz.| Pero eso, hermanito, es otra "
      "historia. Guardemos la partida." },
    { CS_SAY, P_NONE, N_NARR, 0, 0,
      "¡Fin del primer capítulo!|La aventura de Benito y Silva "
      "continuará órgano a órgano… ¡Gracias por jugar esta "
      "primera entrega!" },
    { CS_FLAG, FL_JEFE_TAPON, 1, 0, 0, NULL },
    { CS_FLAG, FL_HITO1, 1, 0, 0, NULL },
    { CS_CALL, CB_CURAR_TODO, 0, 0, 0, NULL },
    { CS_END, 0, 0, 0, 0, NULL },
};

// ---------------------------------------------------------------------------
// callbacks y secuencias interactivas
// ---------------------------------------------------------------------------

static void cb_batalla_jefe(int arg)
{
    (void)arg;
    static const u8 form[3] = { SP_TAPON, 255, 255 };
    game_request_battle(form, true);
}

static void cb_ir_a_sala(int room)
{
    const u8 entry[][2] = { { 16, 9 }, { 3, 6 }, { 1, 18 }, { 2, 18 } };
    game_request_room(room, entry[room][0], entry[room][1]);
}

static void cb_curar_todo(int arg)
{
    (void)arg;
    party[0].hp = party[0].hpmax;
    party[1].hp = party[1].hpmax;
    party[0].pe = party[0].pemax;
    party[1].pe = party[1].pemax;
    hud_refresh();
}

void scripts_init(void)
{
    cutscene_register(CB_BATALLA_JEFE, cb_batalla_jefe);
    cutscene_register(CB_IR_A_SALA, cb_ir_a_sala);
    cutscene_register(CB_CURAR_TODO, cb_curar_todo);
}

// ---- punto de guardado / entrada a Deedee (mini-máquinas de estado) ----

static int pending;     // 1 = guardar, 2 = entrar en deedee

void script_savepoint(void)
{
    sfx(SND_OK);
    party[0].hp = party[0].hpmax;
    party[1].hp = party[1].hpmax;
    party[0].pe = party[0].pemax;
    party[1].pe = party[1].pemax;
    hud_refresh();
    dialog_open_choice(P_NONE, NULL,
                       "El pelaje os brilla y las heridas se cierran. "
                       "¡Grupo restaurado!|¿Guardar la partida?",
                       "Sí", "No");
    pending = 1;
}

void script_enter_deedee(void)
{
    if (!game_flag(FL_INTRO))
        return;
    dialog_open_choice(P_DEE, "Deedee",
                       "Zzz… zzz… *lametón dormido*|Deedee duerme como "
                       "un tronco con orejas. La… «entrada» está "
                       "despejada.|¿Entrar en Deedee?",
                       "Sí", "Ni loco");
    pending = 2;
}

void scripts_poll(void)
{
    if (!pending || dialog_active())
        goto check_done;
    if (pending == 1) {
        pending = 0;
        if (dialog_result() == 0) {
            if (game_save()) {
                sfx(SND_GUARDAR);
                dialog_open(P_NONE, NULL, "¡Partida guardada!");
            } else {
                dialog_open(P_NONE, NULL,
                            "No se pudo guardar (sin tarjeta SD ni "
                            "SRAM). La partida seguirá en memoria "
                            "mientras no apagues.");
            }
        }
    } else if (pending == 2) {
        pending = 0;
        if (dialog_result() == 0) {
            sfx(SND_GAS);
            cb_ir_a_sala(1);    // ROOM_RECTO_A
        } else {
            dialog_open(P_SILF, "Silva",
                        "Muy digno, Benito. El destino del jardín "
                        "puede esperar a que reúnas valor.");
        }
    }
check_done:
    return;
}
