# Benito & Silva: Dentro de Deedee
# Juego homebrew para Nintendo DS construido con BlocksDS (libnds).
#
# `make` produce benito_silva.nds directamente.
# Requiere BlocksDS instalado (por defecto en /opt/blocksds/core o
# /opt/wonderful/thirdparty/blocksds/core). Ver README.md.

ifneq ($(wildcard /opt/blocksds/core/sys),)
BLOCKSDS	?= /opt/blocksds/core
else
BLOCKSDS	?= /opt/wonderful/thirdparty/blocksds/core
endif
export BLOCKSDS

# Config del juego
# ----------------

NAME		:= benito_silva

GAME_TITLE	:= Benito & Silva
GAME_SUBTITLE	:= Dentro de Deedee
GAME_AUTHOR	:= RPG homebrew original
GAME_ICON	:= assets/icon.gif

# Rutas
# -----
# assets/gfx contiene PNGs solo para inspección humana; lo que se
# compila son los .bin nativos de assets/bin (via bin2c).

SOURCEDIRS	:= source
INCLUDEDIRS	:= source source/engine source/game source/data
BINDIRS		:= assets/bin
AUDIODIRS	:= assets/audio

# Bibliotecas
# -----------

LIBS		:= -lnds9 -lmm9
LIBDIRS		:= $(BLOCKSDS)/libs/maxmod

include $(BLOCKSDS)/sys/default_makefiles/rom_arm9/Makefile

# Tests de lógica en el host (PC)
# -------------------------------

.PHONY: test regen-assets

test:
	$(MAKE) -C tests run

# Regenera todos los assets (pixel art, música, mapas) desde tools/.
# Los assets generados están versionados: solo hace falta si se cambian
# los generadores. Requiere python3 + Pillow.
regen-assets:
	python3 tools/gen_all.py
