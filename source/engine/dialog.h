// Cajas de diálogo estilo BIS: retrato animado, nombre, máquina de
// escribir, avance con A, acelerado con B, y elecciones Sí/No.
//
// Uso: dialog_open(...); cada frame dialog_update() y dialog_draw()
// entre spr_begin/spr_end. Cuando dialog_active() sea false, terminó.
// El separador '|' en el texto fuerza salto de página.
#ifndef DIALOG_H__
#define DIALOG_H__

#include "common.h"

// ids de retrato = SPRF_PORTRAITS_* (frame base "normal" del hablante)
void dialog_open(int portrait_frame, const char *name, const char *text);
// con elección al final: devuelve el resultado en dialog_result()
void dialog_open_choice(int portrait_frame, const char *name,
                        const char *text, const char *opt_a,
                        const char *opt_b);
bool dialog_active(void);
void dialog_update(void);
void dialog_draw(void);
int  dialog_result(void);       // 0 = primera opción, 1 = segunda

#endif
