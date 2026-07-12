#include "npc.h"
#include "dialog.h"
#include "game.h"
#include "sprites.h"
#include "items.h"
#include "audio.h"
#include "fx.h"
#include "overworld.h"

// Cada NPC tiene varios diálogos; se elige el primero cuya condición
// se cumpla. '|' = salto de página.

typedef struct {
    u8 flag;            // 255 = incondicional
    u8 flag_value;
    const char *text;
} NpcLine;

// ---- Doña Baba, caracola cotilla ----
static const NpcLine baba[] = {
    { FL_JEFE_TAPON, 1,
      "¿Que habéis estado DENTRO de Deedee? ¡Qué barbaridad más "
      "maravillosa!| No se lo contaré a nadie. Bueno, quizá al seto. "
      "Y al estanque. Y a las hormigas del solsticio…" },
    { FL_INTRO, 1,
      "¿Sabéis lo que se dice? Que la lengua de Deedee ya ha lamido "
      "TRES colmenas y el sombrero de Don Croac.| Yo lo vi todo. Iba a "
      "avisar, pero a mi velocidad las noticias llegan… maduras.|"
      "Dicen los abejorros que la única entrada segura es… ejem… "
      "la puerta de atrás del perro. Yo de vosotros llevaba pinza "
      "para la nariz." },
    { 255, 0,
      "Soy Doña Baba, cronista oficial del jardín. Lo sé todo, "
      "pero con dos semanas de retraso." },
};

// ---- Rufo, petirrojo gruñón ----
static const NpcLine rufo[] = {
    { FL_JEFE_TAPON, 1,
      "¿Desatascasteis al chucho por dentro? Hmpf. No está mal… "
      "para ser gatos.| ¡Pero que no se acostumbre! Mi nido no se "
      "relame, ¿estamos?" },
    { FL_INTRO, 1,
      "¡PÍO! ¡Ese chucho baboso me ha lamido el nido DOS veces! "
      "¡DOS!| ¿Sabéis lo que cuesta secar plumón de primera? "
      "¡Haced algo o me mudo al buzón!" },
    { 255, 0,
      "Hmpf. Gatos. Al menos vosotros no laméis lo que no es vuestro." },
};

// ---- Nuez, ardilla nerviosa ----
static const NpcLine nuez[] = {
    { FL_PUZLE_JARDIN, 1,
      "¡Abristeis el recinto de las baldosas! Yo escondía ahí mis "
      "nueces de emergencia…| …que ya no están. Vale. Respira, Nuez. "
      "RESPIRA." },
    { FL_INTRO, 1,
      "¿Un secreto? Vale, vale, vale: junto a las flores hay TRES "
      "baldosas de piedra.| Písalas todas y la puertecita del rincón "
      "se abre. ¡Lo vi mientras enterraba… cosas! ¡No preguntes qué "
      "cosas!" },
    { 255, 0,
      "¡Ah! ¡Un gato! ¡Dos gatos! ¡DOS! Tranquila, Nuez, son de los "
      "buenos… ¿verdad? ¿VERDAD?" },
};

// ---- Don Croac, rana filósofa ----
static const NpcLine croac[] = {
    { FL_JEFE_TAPON, 1,
      "Croac. Habéis mirado dentro de otro ser y habéis vuelto. "
      "Eso os cambia.| Sobre todo el olfato. Croac." },
    { FL_INTRO, 1,
      "El estanque refleja el cielo, y la lengua de Deedee lo lame "
      "todo. Croac.| ¿Es el perro quien lame el mundo, o el mundo el "
      "que se deja lamer?| …Era una mosca rara, la que se tragó. "
      "Tenía risa de tormenta. Cuidado ahí dentro, gatitos." },
    { 255, 0,
      "Croac. La paciencia es una mosca que se posa sola. Aunque "
      "algunas moscas mejor dejarlas pasar." },
};

// ---- Abejorro Anciano ----
static const NpcLine anciano[] = {
    { FL_JEFE_TAPON, 1,
      "¡Zzzum! ¡El Gran Tapón vencido! El colon del buen Deedee "
      "vuelve a fluir con alegría.| Pero ojo: Terelu sigue arriba, "
      "riéndose en el cerebro. El consejo prepara el siguiente paso. "
      "Descansad, héroes. Guardad la partida. Comed croquetas." },
    { FL_INTRO, 1,
      "El consejo os lo agradece, valientes. Recordad el plan: "
      "subir órgano a órgano hasta el cerebro.| Deedee duerme junto a "
      "su caseta. La entrada es… la que es. Nadie dijo que ser héroe "
      "fuera glamuroso.| ¡Comprad provisiones al tendero! Aceptamos "
      "reclamaciones, pero no devoluciones." },
    { 255, 0,
      "Zzzum… Bienvenidos, gatitos. Soy el abejorro más viejo del "
      "jardín. Tengo miel hasta en las ideas." },
};

typedef struct {
    const NpcLine *lines;
    int n;
    int portrait;
    const char *name;
} NpcDef;

static const NpcDef npcs[] = {
    [NPC_BABA] = { baba, 3, SPRF_PORTRAITS_BABA_NORMAL, "Doña Baba" },
    [NPC_RUFO] = { rufo, 3, SPRF_PORTRAITS_RUFO_NORMAL, "Rufo" },
    [NPC_NUEZ] = { nuez, 3, SPRF_PORTRAITS_NUEZ_NORMAL, "Nuez" },
    [NPC_CROAC] = { croac, 3, SPRF_PORTRAITS_CROAC_NORMAL, "Don Croac" },
    [NPC_ANCIANO] = { anciano, 3, SPRF_PORTRAITS_ANCIANO_NORMAL,
                      "Abejorro Anciano" },
};

void npc_talk(int npc_id)
{
    if (npc_id >= NPC_TENDERO)
        return;
    const NpcDef *d = &npcs[npc_id];
    for (int i = 0; i < d->n; i++) {
        if (d->lines[i].flag == 255 ||
            game_flag(d->lines[i].flag) == d->lines[i].flag_value) {
            dialog_open(d->portrait, d->name, d->lines[i].text);
            return;
        }
    }
}
