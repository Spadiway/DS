#!/usr/bin/env python3
"""Salas del juego. Cada sala es una rejilla de metatiles (16x16 px)
de hasta 32x32, más una lista de entidades (NPCs, enemigos, puertas,
puzzles, salidas...).

Genera source/data/rooms_data.c/h (vía gen_all).
"""

# Tipos de entidad — deben coincidir con entity.h
E_NPC, E_ENEMY, E_SAVE, E_EXIT, E_TRIGGER, E_PLATE, E_GATE, E_CHEST, \
    E_BLOCK, E_SWITCH, E_DOOR, E_VENT, E_BOSS, E_SHOP = range(14)

# NPCs — deben coincidir con npc.h
NPC_BABA, NPC_RUFO, NPC_NUEZ, NPC_CROAC, NPC_ANCIANO, NPC_TENDERO = range(6)

# Especies de enemigo — deben coincidir con battle.h
EN_PULGON, EN_SEMILLA, EN_BACTERIOLO, EN_GUSANILLO, EN_TAPON = range(5)

MODE_TOPDOWN, MODE_SIDE = 0, 1


class Grid:
    def __init__(self, w, h, fill, legend):
        self.w, self.h = w, h
        self.legend = legend       # char -> nombre de metatile
        self.cells = [[fill] * w for _ in range(h)]
        self.entities = []
        self.props = []            # (nombre_prop, mx, my)

    def set(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.cells[y][x] = ch

    def rect(self, x0, y0, w, h, ch):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.set(x, y, ch)

    def row(self, y, x0, x1, ch):
        for x in range(x0, x1 + 1):
            self.set(x, y, ch)

    def col(self, x, y0, y1, ch):
        for y in range(y0, y1 + 1):
            self.set(x, y, ch)

    def border(self, ch):
        self.row(0, 0, self.w - 1, ch)
        self.row(self.h - 1, 0, self.w - 1, ch)
        self.col(0, 0, self.h - 1, ch)
        self.col(self.w - 1, 0, self.h - 1, ch)

    def prop(self, name, mx, my):
        self.props.append((name, mx, my))

    def ent(self, etype, mx, my, a=0, b=0, c=0, d=0):
        """Coordenadas en metatiles; se guardan en píxeles (centro)."""
        self.entities.append((etype, mx * 16 + 8, my * 16 + 8, a, b, c, d))


# ---------------------------------------------------------------------------
# CÉSPED CENTRAL (hub exterior, vista superior)
# ---------------------------------------------------------------------------

JARDIN_LEGEND = {
    ' ': 'grass0', '.': 'grass1', ',': 'grass_dark',
    'f': 'flowers_red', 'F': 'flowers_yellow', 'm': 'flowers_purple',
    't': 'tallgrass', 'D': 'dirt', 'd': 'dirt_edge_n', 'S': 'stone',
    'H': 'hedge', 'W': 'fence', 'T': 'trunk', 'C': 'canopy0',
    'c': 'canopy1', '~': 'water0', '%': 'water_edge', 'R': 'rock',
    'B': 'bush', 'G': 'sign',
}


def room_cesped():
    g = Grid(32, 24, ' ', JARDIN_LEGEND)
    import random
    rnd = random.Random(42)
    # texturizado del césped
    for y in range(24):
        for x in range(32):
            r = rnd.random()
            if r < 0.18:
                g.set(x, y, '.')
            elif r < 0.24:
                g.set(x, y, ',')
    g.border('H')
    # doble seto arriba
    g.row(1, 0, 31, 'H')

    # árboles en las esquinas (tronco + copa encima)
    for tx, ty in ((2, 4), (28, 4), (2, 19), (27, 19)):
        g.set(tx, ty, 'T')
        g.set(tx, ty - 1, 'C')
        g.set(tx + 1, ty - 1, 'c')

    # camino de tierra en cruz
    g.rect(14, 6, 4, 16, 'D')
    g.row(6, 14, 17, 'd')
    g.rect(6, 12, 22, 3, 'D')
    g.row(12, 6, 27, 'd')

    # casita de Deedee arriba al centro (prop 4x3)
    g.prop('doghouse', 14, 2)
    # Deedee duerme delante de la casita: trigger de entrada al interior
    g.ent(E_TRIGGER, 15, 6, 0)      # a=0: script "entrar en Deedee"

    # estanque abajo-derecha
    g.rect(24, 19, 6, 4, '~')
    g.row(19, 24, 29, '%')
    g.set(23, 20, '~')

    # macizos de flores
    for x, y, ch in ((5, 8, 'f'), (6, 8, 'F'), (5, 9, 'm'), (25, 8, 'F'),
                     (26, 8, 'f'), (26, 9, 'm'), (9, 17, 'f'),
                     (10, 17, 'm'), (20, 17, 'F')):
        g.set(x, y, ch)
    # hierba alta a la derecha (zona de enemigos)
    g.rect(22, 3, 5, 3, 't')
    g.rect(7, 19, 4, 2, 't')

    # rocas y arbustos decorativos
    g.set(11, 9, 'R')
    g.set(21, 15, 'B')
    g.set(8, 5, 'B')

    # cartel de bienvenida junto al camino
    g.set(13, 14, 'G')
    g.ent(E_TRIGGER, 13, 14, 1)     # a=1: leer cartel

    # vallado del rincón del puzle (abajo-izquierda) con puerta
    g.row(18, 2, 7, 'W')
    g.col(7, 19, 22, 'W')
    g.set(7, 20, ' ')               # hueco = puerta
    g.ent(E_GATE, 7, 20, 0)         # puerta del puzle (id 0)
    # las tres baldosas-interruptor del puzle
    g.ent(E_PLATE, 10, 8, 0)
    g.ent(E_PLATE, 19, 9, 1)
    g.ent(E_PLATE, 23, 13, 2)
    # cofre premio dentro del recinto
    g.ent(E_CHEST, 4, 21, 0)        # a=0: collar sencillo + chapas

    # NPCs
    g.ent(E_NPC, 8, 9, NPC_BABA)
    g.ent(E_NPC, 24, 16, NPC_RUFO)
    g.ent(E_NPC, 3, 5, NPC_NUEZ)
    g.ent(E_NPC, 26, 20, NPC_CROAC)
    g.ent(E_NPC, 13, 4, NPC_ANCIANO)
    g.ent(E_SHOP, 5, 13, NPC_TENDERO)

    # punto de guardado: bola de pelo junto al cruce
    g.ent(E_SAVE, 18, 13, 0)

    # enemigos en la hierba alta
    g.ent(E_ENEMY, 24, 4, EN_PULGON, EN_PULGON, EN_SEMILLA)
    g.ent(E_ENEMY, 25, 5, EN_SEMILLA, EN_SEMILLA, 255)
    g.ent(E_ENEMY, 9, 20, EN_PULGON, EN_SEMILLA, 255)

    return ('cesped', MODE_TOPDOWN, 'jardin', 'MOD_JARDIN', g, 16, 9)


# ---------------------------------------------------------------------------
# INTERIOR: RECTO/COLON (vista lateral con gravedad)
# ---------------------------------------------------------------------------

COLON_LEGEND = {
    ' ': 'bg0', ',': 'bg1', '#': 'wall', '=': 'floor', '-': 'membrane',
    'a': 'acid', 'A': 'acid_surface', 'p': 'polyp', 'r': 'rib',
    'O': 'sphincter_closed', 'o': 'sphincter_open', 'V': 'gas_vent',
    'K': 'block', 's': 'switch_off',
}


def _colon_base(w, h):
    g = Grid(w, h, ' ', COLON_LEGEND)
    import random
    rnd = random.Random(7)
    for y in range(h):
        for x in range(w):
            if rnd.random() < 0.14:
                g.set(x, y, ',')
    g.border('#')
    g.row(1, 0, w - 1, '#')
    return g


def _floor(g, y, x0, x1):
    g.row(y, x0, x1, '=')
    for yy in range(y + 1, g.h):
        g.row(yy, x0, x1, '#')


def room_recto_a():
    """Tutorial interior: gases que impulsan + membranas."""
    g = _colon_base(32, 24)
    # decoración de fondo
    for x, y in ((5, 8), (18, 5), (27, 9)):
        g.set(x, y, 'p')
    for x in (9, 22):
        g.col(x, 3, 6, 'r')

    # suelo principal con foso de ácido en el centro
    _floor(g, 20, 0, 9)
    _floor(g, 20, 16, 31)
    # foso de ácido
    g.row(21, 10, 15, 'A')
    g.rect(10, 22, 6, 2, 'a')
    # membranas para cruzar el foso
    g.row(17, 11, 13, '-')
    # repisa alta a la izquierda con la entrada (culo de Deedee)
    _floor(g, 8, 0, 4)
    g.set(1, 5, 'o')                 # esfínter de entrada (abierto)
    # respiradero de gas: impulsa hasta la repisa
    g.set(6, 20, 'V')
    g.ent(E_VENT, 6, 19, 0)
    # repisa alta derecha con cofre
    _floor(g, 12, 25, 31)
    g.set(28, 11, 'p')
    g.ent(E_CHEST, 29, 11, 1)        # a=1: croquetas
    # vent para subir a la repisa derecha
    g.set(22, 20, 'V')
    g.ent(E_VENT, 22, 19, 1)
    # membrana intermedia
    g.row(16, 19, 21, '-')

    # punto de guardado al inicio
    g.ent(E_SAVE, 3, 7, 1)           # b/estilo sinapsis

    # enemigos
    g.ent(E_ENEMY, 12, 16, EN_BACTERIOLO, EN_BACTERIOLO, 255)
    g.ent(E_ENEMY, 26, 19, EN_BACTERIOLO, EN_GUSANILLO, 255)

    # salidas
    g.set(31, 19, 'o')
    g.ent(E_EXIT, 31, 19, 2, 1, 18)  # a=sala recto_b, b,c=x,y destino
    g.ent(E_EXIT, 1, 6, 0, 15, 7)    # volver al jardín (tras el hito)

    # trigger tutorial al caer dentro
    g.ent(E_TRIGGER, 3, 6, 2)        # a=2: script tutorial interior

    return ('recto_a', MODE_SIDE, 'colon', 'MOD_INTERIOR', g, 3, 6)


def room_recto_b():
    """Puzle clásico: bloque + interruptor abre el esfínter."""
    g = _colon_base(32, 24)
    for x, y in ((4, 6), (15, 4), (26, 6)):
        g.set(x, y, 'p')
    g.col(12, 3, 7, 'r')
    g.col(24, 8, 12, 'r')

    # terreno escalonado
    _floor(g, 20, 0, 7)
    _floor(g, 22, 8, 14)             # bajada
    g.row(23, 8, 14, '#')
    _floor(g, 18, 15, 22)
    _floor(g, 20, 23, 31)

    # ácido bajo las membranas del tramo central
    g.row(21, 8, 14, 'A')
    g.rect(8, 22, 7, 2, 'a')
    g.row(19, 9, 10, '-')
    g.row(16, 12, 13, '-')

    # bloque empujable sobre la plataforma alta
    g.ent(E_BLOCK, 17, 17, 0)
    # interruptor en el suelo bajo
    g.ent(E_SWITCH, 27, 19, 0)
    # esfínter de salida (cerrado hasta pisar el interruptor)
    g.set(31, 19, 'O')
    g.ent(E_DOOR, 31, 19, 0)
    g.ent(E_EXIT, 31, 19, 3, 1, 18)  # a=sala recto_c

    # enemigos
    g.ent(E_ENEMY, 10, 17, EN_GUSANILLO, EN_BACTERIOLO, 255)
    g.ent(E_ENEMY, 27, 18, EN_BACTERIOLO, EN_BACTERIOLO, EN_GUSANILLO)

    # vuelta a recto_a
    g.set(0, 19, 'o')
    g.ent(E_EXIT, 0, 19, 1, 30, 18)

    return ('recto_b', MODE_SIDE, 'colon', 'MOD_INTERIOR', g, 2, 18)


def room_recto_c():
    """Antesala + arena del jefe: El Gran Tapón."""
    g = _colon_base(32, 24)
    for x, y in ((5, 5), (24, 4), (27, 8)):
        g.set(x, y, 'p')
    g.col(8, 3, 8, 'r')
    g.col(20, 3, 8, 'r')

    # arena amplia
    _floor(g, 20, 0, 31)
    # tapón gigante bloqueando la salida derecha (lo dibuja el jefe)
    g.rect(28, 14, 3, 6, 'O')

    # sinapsis de guardado antes del jefe
    g.ent(E_SAVE, 4, 19, 1)

    # trigger de la cinemática del jefe
    g.ent(E_TRIGGER, 14, 19, 3)      # a=3: script jefe Tapón
    g.ent(E_BOSS, 24, 18, EN_TAPON)

    # vuelta a recto_b
    g.set(0, 19, 'o')
    g.ent(E_EXIT, 0, 19, 2, 30, 17)

    return ('recto_c', MODE_SIDE, 'colon', 'MOD_JEFE', g, 2, 18)


def build_all():
    return [room_cesped(), room_recto_a(), room_recto_b(), room_recto_c()]
