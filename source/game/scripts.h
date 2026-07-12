// Guiones de cinemáticas y secuencias interactivas del hito 1.
#ifndef SCRIPTS_H__
#define SCRIPTS_H__

#include "common.h"
#include "cutscene.h"

extern const CsCmd sc_intro[];
extern const CsCmd sc_tutorial_interior[];
extern const CsCmd sc_jefe_tapon[];
extern const CsCmd sc_tapon_derrotado[];

// callbacks de cutscene registrados por scripts_init()
enum { CB_BATALLA_JEFE = 0, CB_IR_A_SALA, CB_CURAR_TODO };

void scripts_init(void);
void script_savepoint(void);        // diálogo de guardar
void script_enter_deedee(void);     // entrada al interior
void scripts_poll(void);            // llamar cada frame desde overworld

#endif
