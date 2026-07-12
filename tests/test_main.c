// Tests de la lógica de combate y progresión, ejecutables en PC.
//
//   make -C tests run
//
// Simulan combates completos accionando battle_tick() con secuencias de
// botones y comprueban invariantes: daño con timing, subidas de nivel,
// ruleta, objetos, huida, KO, jefe.
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "battle_core.h"
#include "player.h"
#include "items.h"

static int tests_run, tests_failed;

#define CHECK(cond, msg) do { \
    tests_run++; \
    if (!(cond)) { \
        tests_failed++; \
        printf("  FALLO: %s  (%s:%d)\n", msg, __FILE__, __LINE__); \
    } \
} while (0)

// avanza el combate N frames con botones fijos, drenando eventos
static void run_frames(Battle *b, int n, uint16_t down, uint16_t held)
{
    for (int i = 0; i < n; i++) {
        battle_tick(b, i == 0 ? down : 0, held);
        BtlEvent e;
        while (battle_pop_event(b, &e)) { /* descartar */ }
    }
}

// avanza hasta que el combate esté en una fase dada o se agoten los frames
static int run_until_phase(Battle *b, int phase, int maxframes)
{
    for (int i = 0; i < maxframes; i++) {
        if (b->phase == phase)
            return 1;
        battle_tick(b, 0, 0);
        BtlEvent e;
        while (battle_pop_event(b, &e)) {}
    }
    return b->phase == phase;
}

// ---------------------------------------------------------------------------

static void test_player_progression(void)
{
    printf("test_player_progression\n");
    player_init_new();
    CHECK(party[0].level == 1, "Benito empieza a nivel 1");
    CHECK(party[0].hp == party[0].hpmax, "Benito con PV llenos");
    CHECK(party[1].hpmax > 0, "Silva con PV máx > 0");
    CHECK(party[0].hpmax > party[1].hpmax, "Benito más tanque que Silva");
    CHECK(party[1].vel > party[0].vel, "Silva más rápida que Benito");

    uint16_t hp0 = party[0].hpmax;
    int ups = player_grant_exp(0, exp_to_next(1));
    CHECK(ups == 1, "sube exactamente 1 nivel con la exp justa");
    CHECK(party[0].level == 2, "Benito a nivel 2");
    CHECK(party[0].hpmax > hp0, "los PV máx crecen al subir");

    // gran cantidad de exp: varias subidas pero tope en 33
    player_grant_exp(0, 9999999);
    CHECK(party[0].level == MAX_LEVEL, "no pasa del nivel 33");

    // bonus de ruleta
    player_init_new();
    int f0 = party[0].fue;
    player_apply_bonus(0, 2, 3);       // FUE +3
    CHECK(party[0].fue == f0 + 3, "bonus de FUE aplicado");
    int hpm = party[0].hpmax;
    player_apply_bonus(0, 0, 2);       // PV bonus rinde doble => +4
    CHECK(party[0].hpmax == hpm + 4, "bonus de PV rinde el doble");
}

static void test_items(void)
{
    printf("test_items\n");
    memset(inventory, 0, sizeof(inventory));
    chapas = 0;
    CHECK(item_give(IT_CROQUETA, 3), "dar 3 croquetas");
    CHECK(inventory[IT_CROQUETA] == 3, "hay 3 croquetas");
    CHECK(!item_give(IT_CROQUETA, 8), "no caben más de 9");
    CHECK(item_take(IT_CROQUETA), "usar una croqueta");
    CHECK(inventory[IT_CROQUETA] == 2, "quedan 2");
    memset(inventory, 0, sizeof(inventory));
    CHECK(!item_take(IT_ATUN), "no se puede usar lo que no hay");
}

// juega un turno de "Salto" con timing perfecto contra el enemigo 0
static void play_perfect_attack(Battle *b)
{
    // en BF_MENU: elegir Salto (menu_sel arranca en 0 = ACT_SALTO)
    CHECK(b->phase == BF_MENU, "en menú al empezar turno");
    battle_tick(b, BK_A, 0);           // confirma Salto -> BF_TARGET
    BtlEvent e; while (battle_pop_event(b, &e)) {}
    CHECK(b->phase == BF_TARGET, "pasa a selección de objetivo");
    battle_tick(b, BK_A, 0);           // confirma objetivo -> BF_PLAYER_ACT
    while (battle_pop_event(b, &e)) {}
    CHECK(b->phase == BF_PLAYER_ACT, "pasa a ejecutar ataque");
    // pulsar el botón del gato justo en el frame de impacto
    int impact = b->impact_t;
    uint16_t mybtn = (b->actor == 0) ? BK_A : BK_B;
    for (int t = 1; t < impact + 60; t++) {
        uint16_t d = (t == impact) ? mybtn : 0;
        battle_tick(b, d, 0);
        while (battle_pop_event(b, &e)) {}
        if (b->phase != BF_PLAYER_ACT)
            break;
    }
}

static void test_action_command_damage(void)
{
    printf("test_action_command_damage\n");
    player_init_new();
    memset(inventory, 0, sizeof(inventory));
    // un solo enemigo débil
    uint8_t form[3] = { SP_SEMILLA, 255, 255 };
    Battle b;
    battle_init(&b, form, 12345, false);
    run_until_phase(&b, BF_MENU, 200);

    int hp_before = b.en[0].hp;
    play_perfect_attack(&b);
    int dmg_perfect = hp_before - b.en[0].hp;
    CHECK(dmg_perfect > 0, "el ataque hace daño");

    // ahora un ataque sin pulsar (fallo de timing)
    // reinicia con el mismo enemigo lleno
    battle_init(&b, form, 12345, false);
    run_until_phase(&b, BF_MENU, 200);
    battle_tick(&b, BK_A, 0);          // Salto
    BtlEvent e; while (battle_pop_event(&b, &e)) {}
    battle_tick(&b, BK_A, 0);          // objetivo
    while (battle_pop_event(&b, &e)) {}
    int hp2 = b.en[0].hp;
    run_frames(&b, b.impact_t + 60, 0, 0);   // no pulsar nunca
    int dmg_miss = hp2 - b.en[0].hp;
    CHECK(dmg_miss > 0, "aun fallando el timing hace algo de daño");
    CHECK(dmg_perfect > dmg_miss,
          "el timing perfecto pega más que el fallo");
}

static void test_full_battle_victory(void)
{
    printf("test_full_battle_victory\n");
    player_init_new();
    memset(inventory, 0, sizeof(inventory));
    chapas = 0;
    uint32_t exp0 = party[0].exp;
    uint8_t form[3] = { SP_SEMILLA, 255, 255 };
    Battle b;
    battle_init(&b, form, 999, false);

    int guard = 0;
    while (b.result == 0 && guard++ < 20000) {
        // política sencilla: en menú, Salto; en objetivo, confirmar;
        // en ataque, pulsar en impacto; en ruleta, elegir; resto, avanzar
        uint16_t d = 0;
        if (b.phase == BF_MENU) {
            b.menu_sel = ACT_SALTO;
            d = BK_A;
        } else if (b.phase == BF_TARGET) {
            d = BK_A;
        } else if (b.phase == BF_PLAYER_ACT) {
            uint16_t mybtn = (b.actor == 0) ? BK_A : BK_B;
            d = (b.t == b.impact_t) ? mybtn : 0;
        } else if (b.phase == BF_ROULETTE) {
            d = BK_A;
        }
        battle_tick(&b, d, 0);
        BtlEvent e; while (battle_pop_event(&b, &e)) {}
    }
    CHECK(b.result == 1, "el combate acaba en victoria");
    CHECK(b.en[0].alive == false, "el enemigo queda derrotado");
    CHECK(party[0].exp > exp0, "Benito ha ganado experiencia");
    CHECK(chapas > 0, "se han ganado chapas");
}

static void test_flee(void)
{
    printf("test_flee\n");
    player_init_new();
    uint8_t form[3] = { SP_PULGON, 255, 255 };
    // busca una semilla que permita huir (VEL alta ayuda)
    int fled = 0;
    for (uint32_t seed = 1; seed < 200 && !fled; seed++) {
        Battle b;
        battle_init(&b, form, seed, false);
        run_until_phase(&b, BF_MENU, 200);
        b.menu_sel = ACT_HUIR;
        for (int i = 0; i < 6; i++) {
            battle_tick(&b, i == 0 ? BK_A : 0, 0);
            BtlEvent e; while (battle_pop_event(&b, &e)) {}
        }
        if (b.result == 3)
            fled = 1;
    }
    CHECK(fled, "es posible huir de un combate normal");

    // de un jefe NO se puede huir
    uint8_t bform[3] = { SP_TAPON, 255, 255 };
    Battle b;
    battle_init(&b, bform, 5, true);
    run_until_phase(&b, BF_MENU, 200);
    b.menu_sel = ACT_HUIR;
    battle_tick(&b, BK_A, 0);
    CHECK(b.result == 0, "no se puede huir de un jefe");
}

static void test_defeat(void)
{
    printf("test_defeat\n");
    player_init_new();
    // debilita a los gatos al mínimo
    party[0].hp = 1;
    party[1].hp = 1;
    uint8_t form[3] = { SP_PULGON, SP_PULGON, SP_PULGON };
    Battle b;
    battle_init(&b, form, 7, false);
    int guard = 0;
    // no defenderse nunca: los gatos caen
    while (b.result == 0 && guard++ < 20000) {
        // solo avanzar por los menús con "Salto" fallado, sin esquivar
        uint16_t d = 0;
        if (b.phase == BF_MENU) { b.menu_sel = ACT_SALTO; d = BK_A; }
        else if (b.phase == BF_TARGET) d = BK_A;
        battle_tick(&b, d, 0);
        BtlEvent e; while (battle_pop_event(&b, &e)) {}
    }
    CHECK(b.result == 2, "los gatos son derrotados");
}

static void test_dodge_counter(void)
{
    printf("test_dodge_counter\n");
    player_init_new();
    uint8_t form[3] = { SP_PULGON, 255, 255 };
    Battle b;
    battle_init(&b, form, 42, false);
    // pasar el turno del jugador sin atacar (huir fallará a veces); en su
    // lugar, forzamos: elegir objetos y salir para ceder el turno
    run_until_phase(&b, BF_MENU, 200);
    // gastar el turno de ambos gatos con un objeto inútil no disponible ->
    // en su lugar atacamos flojo para llegar al turno enemigo
    b.menu_sel = ACT_SALTO;
    battle_tick(&b, BK_A, 0);
    BtlEvent e; while (battle_pop_event(&b, &e)) {}
    battle_tick(&b, BK_A, 0);           // objetivo
    while (battle_pop_event(&b, &e)) {}
    run_frames(&b, b.impact_t + 40, 0, 0);   // ataque flojo de Benito
    // turno de Silva: igual
    if (b.phase == BF_MENU) {
        b.menu_sel = ACT_SALTO;
        battle_tick(&b, BK_A, 0);
        while (battle_pop_event(&b, &e)) {}
        battle_tick(&b, BK_A, 0);
        while (battle_pop_event(&b, &e)) {}
        run_frames(&b, b.impact_t + 40, 0, 0);
    }
    // ahora debería venir el turno enemigo (telegraph -> act)
    int reached = run_until_phase(&b, BF_ENEMY_ACT, 400);
    CHECK(reached, "se alcanza el turno de ataque enemigo");
    if (reached) {
        int cat = b.atk_target;
        int hp_before = party[cat].hp;
        uint16_t mybtn = (cat == 0) ? BK_A : BK_B;
        // esquivar en el frame justo antes del impacto
        int target_frame = b.next_impact - 2;
        for (int t = b.t; t < b.next_impact + 40; t++) {
            uint16_t d = (t == target_frame) ? mybtn : 0;
            battle_tick(&b, d, 0);
            while (battle_pop_event(&b, &e)) {}
            if (b.phase != BF_ENEMY_ACT)
                break;
        }
        CHECK(party[cat].hp == hp_before,
              "esquivar a tiempo evita todo el daño");
    }
}

static void test_boss_is_tough(void)
{
    printf("test_boss_is_tough\n");
    player_init_new();
    uint8_t bform[3] = { SP_TAPON, 255, 255 };
    Battle b;
    battle_init(&b, bform, 3, true);
    CHECK(b.en[0].hpmax >= 60, "el jefe tiene mucha vida");
    CHECK(b.is_boss, "marcado como jefe");
    // un solo ataque perfecto no lo mata
    run_until_phase(&b, BF_MENU, 200);
    play_perfect_attack(&b);
    CHECK(b.en[0].alive, "el jefe sobrevive a un golpe");
}

static void test_special_needs_pe(void)
{
    printf("test_special_needs_pe\n");
    player_init_new();
    party[0].pe = 0;    // sin PE
    party[1].pe = 0;
    uint8_t form[3] = { SP_SEMILLA, 255, 255 };
    Battle b;
    battle_init(&b, form, 8, false);
    run_until_phase(&b, BF_MENU, 200);
    b.menu_sel = ACT_ESPECIAL;
    battle_tick(&b, BK_A, 0);
    CHECK(b.phase == BF_MENU, "sin PE no se entra al especial");
    // con PE suficiente sí
    party[0].pe = 10;
    party[1].pe = 10;
    b.menu_sel = ACT_ESPECIAL;
    battle_tick(&b, BK_A, 0);
    CHECK(b.phase == BF_SPECIAL, "con PE se activa el especial");
    CHECK(party[0].pe == 6 && party[1].pe == 6, "cuesta 4 PE a cada uno");
}

int main(void)
{
    printf("== Tests de Benito & Silva (lógica de host) ==\n\n");
    test_player_progression();
    test_items();
    test_action_command_damage();
    test_full_battle_victory();
    test_flee();
    test_defeat();
    test_dodge_counter();
    test_boss_is_tough();
    test_special_needs_pe();

    printf("\n== %d comprobaciones, %d fallos ==\n",
           tests_run, tests_failed);
    return tests_failed ? 1 : 0;
}
