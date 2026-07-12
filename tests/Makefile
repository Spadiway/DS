# Tests de lógica en el host (PC). Compila el núcleo portable del juego
# (combate, progresión, objetos) con gcc nativo y ejecuta aserciones.
CC      ?= cc
CFLAGS  := -std=c99 -Wall -Wextra -O2 -I../source/game -I. -DHOST_TEST
SRC     := ../source/game/battle_core.c ../source/game/player.c \
           ../source/game/items.c test_main.c

run: test_battle
	./test_battle

test_battle: $(SRC) nds_stub.h
	$(CC) $(CFLAGS) -o $@ $(SRC)

clean:
	rm -f test_battle

.PHONY: run clean
