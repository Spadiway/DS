// Núcleo del combate por turnos con comandos de acción (estilo BIS).
//
// PORTABLE: sin dependencias de libnds; se compila también en el host
// para los tests. El renderizador de la DS lo dirige frame a frame con
// battle_tick() y consume la cola de eventos para animar/sonar.
#ifndef BATTLE_CORE_H__
#define BATTLE_CORE_H__

#include <stdint.h>
#include <stdbool.h>
#include "player.h"
#include "items.h"

// botones abstractos
#define BK_A     0x01
#define BK_B     0x02
#define BK_UP    0x04
#define BK_DOWN  0x08
#define BK_LEFT  0x10
#define BK_RIGHT 0x20

// especies (coinciden con EN_* de los mapas)
enum {
    SP_PULGON, SP_SEMILLA, SP_BACTERIOLO, SP_GUSANILLO, SP_TAPON,
    SP_COUNT
};

typedef struct {
    const char *name;
    int16_t hp;
    uint8_t fue, def, vel;
    uint16_t exp, chapas;
    uint8_t big;            // sprite de 64x64
    uint8_t atk_impact;     // frame del impacto de su ataque
    uint8_t pattern;        // 0 embestida, 1 salto, 2 rebote x2,
                            // 3 latigazo con finta, 4 jefe
} SpeciesDef;

extern const SpeciesDef species_defs[SP_COUNT];

// fases
enum {
    BF_INTRO, BF_MENU, BF_ITEMS, BF_TARGET, BF_PLAYER_ACT, BF_SPECIAL,
    BF_ENEMY_TELE, BF_ENEMY_ACT, BF_VICTORY, BF_ROULETTE, BF_DEFEAT,
    BF_DONE
};

// acciones del menú
enum { ACT_SALTO, ACT_ZARPAZO, ACT_ESPECIAL, ACT_OBJETOS, ACT_HUIR,
       ACT_MENU_N };

// valoraciones de comando de acción
enum { RT_FALLO, RT_REGULAR, RT_BIEN, RT_EXCELENTE };

// eventos para el renderizador
enum {
    BE_MSG,          // str
    BE_DMG_ENEMY,    // a=idx, b=daño
    BE_DMG_CAT,      // a=cat, b=daño
    BE_HEAL_CAT,     // a=cat, b=cantidad (PV) / b<0: PE
    BE_RATING,       // a=RT_*, b=cat
    BE_SFX,          // a=id abstracto BSFX_*
    BE_SHAKE,
    BE_ENEMY_DIE,    // a=idx
    BE_CAT_KO,       // a=cat
    BE_COUNTER,      // a=cat que contraataca, b=enemigo
    BE_EXP,          // a=exp por gato
    BE_LEVELUP,      // a=cat, b=nivel nuevo
    BE_BONUS,        // a=stat, b=cantidad (resultado ruleta)
    BE_CHAPAS,       // a=cantidad
    BE_ITEM_DROP,    // a=item
    BE_FLEE_FAIL,
    BE_DODGE,        // a=cat
};

// sfx abstractos (el render los mapea a SND_*)
enum { BSFX_SALTO, BSFX_GOLPE, BSFX_EXCELENTE, BSFX_BIEN, BSFX_DANO,
       BSFX_MENU, BSFX_OK, BSFX_CANCEL, BSFX_CURAR, BSFX_ESQUIVA,
       BSFX_KO, BSFX_NIVEL, BSFX_CHAPA };

typedef struct {
    uint8_t type;
    int16_t a, b;
    const char *str;
} BtlEvent;

typedef struct {
    uint8_t species;
    int16_t hp, hpmax;
    uint8_t fue, def, vel;
    bool alive;
} BEnemy;

typedef struct {
    BEnemy en[3];
    int n_en;
    bool is_boss;

    uint8_t phase;
    int t;                  // frames en la fase actual
    int actor;              // gato actuando (0/1) o índice enemigo
    uint8_t action;

    // menú
    int menu_sel, item_sel, target_sel;

    // acción del jugador
    int impact_t;           // frame de impacto de la anim actual
    int rating;
    bool pressed;           // ya pulsó en esta acción
    bool bounce;            // segundo bote del salto
    uint8_t hierba[2];      // buff de FUE activo (x1.5)

    // especial (Bola de Pelo Gemela)
    int mash, last_btn;

    // turno enemigo
    int en_cur;             // enemigo actuando
    int atk_target;         // gato objetivo
    int hits_left;          // para patrones multigolpe
    int next_impact;        // frame del siguiente impacto
    bool dodged;            // esquiva del golpe actual
    bool feint;             // finta (gusanillo)
    uint8_t boss_move;

    // victoria / ruleta
    uint32_t exp_each;
    int lv_pending[2];      // subidas pendientes de ruleta
    int lv_cat;
    int wheel_pos;          // 0-4 stat resaltado
    int wheel_t;

    uint16_t drop_chapas;
    int drop_item;

    // cola de eventos
    BtlEvent ev[24];
    int ev_head, ev_tail;

    uint32_t rngs;
    uint8_t result;         // 0 en curso, 1 victoria, 2 derrota, 3 huida
} Battle;

void battle_init(Battle *b, const uint8_t formation[3], uint32_t seed,
                 bool boss);
void battle_tick(Battle *b, uint16_t kdown, uint16_t kheld);
bool battle_pop_event(Battle *b, BtlEvent *out);

#endif
