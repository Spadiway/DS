#!/usr/bin/env python3
"""Tilesets del juego: jardín (exterior) e interior de Deedee.

Cada metatile es 16x16 px (2x2 tiles hardware de 8x8). El empaquetador
deduplica los tiles de 8x8 y emite:
  assets/gfx/tileset_<n>.png   tira de tiles únicos
  (los datos de metatiles van en source/data/tiles_data.h vía gen_all)

Flags de colisión por metatile (deben coincidir con map.h):
  SOLID=1, PLATFORM=2 (solo desde arriba), HAZARD=4, WATER=8, OVERLAY=16
"""

from pixelkit import Canvas

F_NONE, F_SOLID, F_PLATFORM, F_HAZARD, F_WATER, F_OVERLAY = 0, 1, 2, 4, 8, 16


def _noise(x, y, salt=0):
    """Ruido determinista barato para motear texturas."""
    n = (x * 374761393 + y * 668265263 + salt * 987643213) & 0xffffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0xffffffff
    return (n >> 16) & 0xffff


def _speckle(c, chars, density, salt=0):
    for y in range(c.h):
        for x in range(c.w):
            r = _noise(x, y, salt)
            if r % 1000 < density:
                c.set(x, y, chars[r % len(chars)])


# ---------------------------------------------------------------------------
# Metatiles del JARDÍN
# ---------------------------------------------------------------------------

def mt_grass(variant=0):
    c = Canvas(16, 16, '2')
    _speckle(c, ['1', '3'], 90, salt=variant)
    if variant == 1:
        # briznas
        for x, y in ((3, 4), (11, 9), (7, 13)):
            c.set(x, y, '1')
            c.set(x, y - 1, '1')
    return c


def mt_grass_dark():
    c = Canvas(16, 16, '3')
    _speckle(c, ['2', '4'], 110, salt=7)
    return c


def mt_flowers(color):
    c = mt_grass(0)
    pts = ((3, 3), (11, 5), (6, 10), (12, 12))
    for i, (x, y) in enumerate(pts):
        if i == 3 and color != 'f':
            continue
        c.set(x, y - 1, color)
        c.set(x - 1, y, color)
        c.set(x + 1, y, color)
        c.set(x, y + 1, color)
        c.set(x, y, 'F' if color != 'F' else ';')
        c.set(x - 1, y + 2, '1')
        c.set(x + 1, y + 2, '1')
    return c


def mt_tallgrass():
    c = mt_grass(2)
    for i, x in enumerate((1, 4, 7, 10, 13)):
        h = 9 + (i * 3) % 4
        c.line(x, 15, x + 1, 15 - h, '3')
        c.line(x + 1, 15, x + 2, 15 - h + 2, '2')
        c.set(x + 1, 15 - h - 1, '1')
    return c


def mt_dirt():
    c = Canvas(16, 16, '6')
    _speckle(c, ['5', '7'], 80, salt=3)
    return c


def mt_dirt_edge_n():
    c = mt_dirt()
    for x in range(16):
        c.set(x, 0, '2')
        if _noise(x, 1, 9) % 3:
            c.set(x, 1, '3')
        if _noise(x, 2, 9) % 3 == 0:
            c.set(x, 2, '7')
    return c


def mt_stone():
    c = Canvas(16, 16, 'N')
    _speckle(c, ['n', 'Q'], 70, salt=5)
    c.hline(0, 15, 0, 'n')
    c.vline(0, 0, 15, 'n')
    c.hline(0, 15, 15, 'Q')
    c.vline(15, 0, 15, 'Q')
    return c


def mt_hedge():
    c = Canvas(16, 16, '4')
    _speckle(c, ['3', '2'], 160, salt=11)
    # copete redondeado
    c.hline(0, 15, 0, '3')
    for x in range(0, 16, 4):
        c.set(x, 0, '2')
        c.set(x + 1, 1, '3')
    c.hline(0, 15, 15, 'k')
    return c


def mt_fence():
    c = mt_grass(3)
    # travesaño doble
    c.rect(0, 4, 16, 3, '9')
    c.hline(0, 15, 4, '8')
    c.rect(0, 10, 16, 2, '9')
    # postes
    for x in (2, 12):
        c.rect(x, 2, 3, 12, '9')
        c.vline(x, 2, 13, '8')
        c.hline(x, x + 2, 2, '8')
        c.vline(x + 2, 3, 13, '0')
    return c


def mt_trunk():
    c = mt_grass(4)
    c.rect(4, 0, 8, 16, '9')
    c.vline(4, 0, 15, '8')
    c.vline(5, 0, 15, '8')
    c.vline(11, 0, 15, '0')
    c.vline(8, 2, 13, '0')  # veta
    c.rect(2, 12, 4, 4, '9')  # raíz
    c.rect(10, 13, 4, 3, '9')
    return c


def mt_canopy(variant=0):
    c = Canvas(16, 16, '4')
    _speckle(c, ['3', '2'], 150, salt=20 + variant)
    if variant == 0:  # borde inferior con racimos
        for x in range(0, 16, 5):
            c.ellipse(x + 2, 14, 2, 2, '3')
    return c


def mt_water(step=0):
    c = Canvas(16, 16, 'V')
    _speckle(c, ['v', 'x'], 60, salt=30 + step)
    # destellos
    for x, y in ((3, 3), (10, 8), (6, 13)):
        c.hline(x, x + 2 + step, y, 'v')
    return c


def mt_water_edge_n():
    c = mt_water()
    c.hline(0, 15, 0, '1')
    c.hline(0, 15, 1, '2')
    c.hline(0, 15, 2, 'v')
    c.hline(0, 15, 3, 'w')
    return c


def mt_rock():
    c = mt_grass(5)
    c.ellipse_shaded(8, 9, 6, 5, 'N', 'n', 'Q')
    c.set(6, 7, 'w')
    c.hline(4, 6, 12, 'Q')
    c.outline('k')
    return c


def mt_bush():
    c = mt_grass(6)
    c.ellipse_shaded(8, 9, 7, 6, '2', '1', '3')
    for x, y in ((5, 7), (10, 9), (7, 12)):
        c.set(x, y, 'f')
        c.set(x + 1, y, ';')
    c.outline('k')
    return c


def mt_sign():
    c = mt_grass(7)
    c.rect(7, 6, 2, 9, '9')
    c.rect(2, 2, 12, 6, '8')
    c.hline(2, 13, 2, '5')
    c.rect(3, 4, 10, 1, '0')
    c.rect(3, 6, 7, 1, '0')
    c.outline('k')
    return c


# --- casita de Deedee (prop 4x3 metatiles = 64x48) ---

def prop_doghouse():
    P = Canvas(64, 48)
    # tejado
    for i in range(12):
        w = 20 + i * 4
        c0 = 'q' if i % 2 else 'R'
        P.hline(32 - w // 2, 32 + w // 2, i, c0)
    P.hline(32 - 30, 32 + 30, 12, 'q')
    # cuerpo
    P.rect(6, 13, 52, 35, '8')
    for y in range(13, 48, 5):
        P.hline(6, 57, y, '9')
    P.vline(6, 13, 47, '5')
    P.vline(57, 13, 47, '0')
    # entrada en arco
    P.ellipse(32, 40, 11, 14, 'k')
    P.rect(21, 40, 23, 8, 'k')
    P.ellipse(32, 41, 9, 11, 'K')
    P.rect(23, 43, 19, 5, 'K')
    # letrero DEEDEE
    P.rect(20, 16, 25, 7, '#')
    for i, x in enumerate(range(22, 43, 4)):
        P.rect(x, 18, 3, 3, 'k' if i % 2 == 0 else '_')
    P.outline('k')
    return P


# ---------------------------------------------------------------------------
# Metatiles del INTERIOR (Recto/Colon) — vista lateral
# ---------------------------------------------------------------------------

def mt_flesh_bg(variant=0):
    """Fondo de cavidad: carne oscura con vetas."""
    c = Canvas(16, 16, '%')
    _speckle(c, ['L'], 50, salt=40 + variant)
    if variant == 1:
        # vena serpenteante
        for y in range(16):
            x = 8 + ((y * 5 + 3) % 5) - 2
            c.set(x, y, 'L')
            c.set(x + 1, y, '$')
    return c


def mt_flesh_wall():
    """Pared/suelo sólido de carne rosada."""
    c = Canvas(16, 16, 'G')
    _speckle(c, ['D', 'L'], 90, salt=50)
    # burbujitas orgánicas
    c.ellipse(4, 5, 2, 1, 'D')
    c.ellipse(11, 11, 2, 1, 'L')
    return c


def mt_flesh_floor():
    """Superficie superior (donde se pisa): brillo mucoso."""
    c = mt_flesh_wall()
    c.hline(0, 15, 0, 'D')
    c.hline(0, 15, 1, 'D')
    for x in range(0, 16, 3):
        c.set(x, 0, 'w' if _noise(x, 0, 60) % 4 else 'D')
    c.hline(0, 15, 2, 'G')
    return c


def mt_membrane():
    """Plataforma de membrana (se puede saltar desde abajo)."""
    c = Canvas(16, 16)
    for x in range(16):
        y = 3 + (1 if 3 < x < 12 else 0)
        c.set(x, y, '&')
        c.set(x, y + 1, '@')
        c.set(x, y + 2, '@')
        c.set(x, y + 3, '$')
    c.set(0, 3, '$')
    c.set(15, 3, '$')
    # gotitas colgando
    c.set(4, 8, '$')
    c.set(11, 8, '$')
    c.outline('k', over=False)
    return c


def mt_acid(step=0):
    c = Canvas(16, 16, '=')
    _speckle(c, ['!', '?'], 90, salt=70 + step)
    # burbujas
    for x, y in ((4, 4), (11, 9)):
        c.ellipse(x + step, y, 2, 1, '!')
    return c


def mt_acid_surface(step=0):
    c = mt_acid(step)
    c.hline(0, 15, 0, '!')
    for x in range(step, 16, 4):
        c.set(x, 0, 'w')
        c.set(x, 1, '!')
    return c


def mt_polyp():
    c = mt_flesh_bg(0)
    c.ellipse_shaded(8, 10, 4, 5, '@', '&', '$')
    c.ellipse(7, 8, 1, 1, 'w')
    c.rect(6, 15, 5, 1, '$')
    return c


def mt_rib():
    """Costilla/pliegue vertical de fondo."""
    c = mt_flesh_bg(0)
    c.rect(5, 0, 5, 16, 'L')
    c.vline(5, 0, 15, 'D')
    c.vline(9, 0, 15, '%')
    return c


def mt_sphincter_closed():
    """Puerta esfínter cerrada (sólida)."""
    c = Canvas(16, 16, 'L')
    c.ellipse_shaded(8, 8, 7, 7, 'G', 'D', 'L')
    # pliegues radiales
    for dx, dy in ((-5, -5), (5, -5), (-5, 5), (5, 5), (0, -7), (0, 7),
                   (-7, 0), (7, 0)):
        c.line(8, 8, 8 + dx, 8 + dy, '%')
    c.ellipse(8, 8, 2, 2, '%')
    c.outline('k')
    return c


def mt_sphincter_open():
    c = Canvas(16, 16, '%')
    c.ellipse(8, 8, 7, 7, 'K')
    c.ellipse(8, 8, 5, 5, 'k')
    for dx, dy in ((-6, -6), (6, -6), (-6, 6), (6, 6)):
        c.line(8 + dx, 8 + dy, 8 + dx // 2, 8 + dy // 2, 'G')
    return c


def mt_gas_vent():
    """Boca de gas en el suelo de carne."""
    c = mt_flesh_floor()
    c.ellipse(8, 4, 5, 3, '%')
    c.ellipse(8, 4, 3, 2, 'k')
    c.set(6, 3, '?')
    c.set(10, 5, '?')
    return c


def mt_block():
    """Bloque empujable (bola de comida compactada)."""
    c = Canvas(16, 16)
    c.ellipse_shaded(8, 8, 7, 7, '9', '8', '0')
    c.hline(4, 11, 5, '0')
    c.hline(3, 12, 9, '0')
    c.set(5, 4, '5')
    c.set(6, 4, '5')
    c.outline('k')
    return c


def mt_switch(pressed):
    c = mt_flesh_floor()
    if pressed:
        c.rect(4, 2, 8, 3, '+')
        c.hline(4, 11, 2, '*')
    else:
        c.rect(4, 0, 8, 5, '*')
        c.hline(4, 11, 0, '#')
        c.vline(4, 0, 4, '#')
        c.hline(4, 11, 4, '+')
    return c


# ---------------------------------------------------------------------------
# Empaquetador: metatiles -> tiles únicos de 8x8 + tablas
# ---------------------------------------------------------------------------

class TilePacker:
    def __init__(self):
        self.tiles = []          # lista de tuplas de 64 índices
        self.lookup = {}
        # tile 0 siempre vacío
        self.add_tile(tuple([0] * 64))

    def add_tile(self, data):
        if data in self.lookup:
            return self.lookup[data]
        idx = len(self.tiles)
        self.tiles.append(data)
        self.lookup[data] = idx
        return idx

    def add_metatile(self, canvas):
        """Devuelve (tl, tr, bl, br)."""
        ids = []
        for ty in (0, 8):
            for tx in (0, 8):
                data = tuple(canvas.px[ty + y][tx + x]
                             for y in range(8) for x in range(8))
                ids.append(self.add_tile(data))
        return tuple(ids)

    def save_png(self, path):
        n = len(self.tiles)
        c = Canvas(8 * n, 8)
        for i, t in enumerate(self.tiles):
            for y in range(8):
                for x in range(8):
                    c.px[y][i * 8 + x] = t[y * 8 + x]
        from pixelkit import save_png
        save_png(path, c)
        return n


def build_tileset(name, defs, props=None):
    """defs: lista (nombre, canvas, flags). props: dict nombre->Canvas
    (se trocean en metatiles consecutivos, por filas).
    Devuelve (packer, meta_list, prop_meta) donde meta_list[i] =
    (nombre, (tl,tr,bl,br), flags)."""
    packer = TilePacker()
    metas = []
    for mname, canvas, flags in defs:
        ids = packer.add_metatile(canvas)
        metas.append((mname, ids, flags))
    prop_meta = {}
    if props:
        for pname, (pcanvas, pflags) in props.items():
            mw, mh = pcanvas.w // 16, pcanvas.h // 16
            cells = []
            for my in range(mh):
                for mx in range(mw):
                    sub = Canvas(16, 16)
                    for y in range(16):
                        for x in range(16):
                            sub.px[y][x] = pcanvas.px[my * 16 + y][mx * 16 + x]
                    ids = packer.add_metatile(sub)
                    idx = len(metas)
                    metas.append((f'{pname}_{mx}_{my}', ids, pflags))
                    cells.append(idx)
            prop_meta[pname] = (mw, mh, cells)
    return packer, metas, prop_meta


def build_jardin():
    defs = [
        ('grass0', mt_grass(0), F_NONE),
        ('grass1', mt_grass(1), F_NONE),
        ('grass_dark', mt_grass_dark(), F_NONE),
        ('flowers_red', mt_flowers('f'), F_NONE),
        ('flowers_yellow', mt_flowers('F'), F_NONE),
        ('flowers_purple', mt_flowers('m'), F_NONE),
        ('tallgrass', mt_tallgrass(), F_NONE),
        ('dirt', mt_dirt(), F_NONE),
        ('dirt_edge_n', mt_dirt_edge_n(), F_NONE),
        ('stone', mt_stone(), F_NONE),
        ('hedge', mt_hedge(), F_SOLID),
        ('fence', mt_fence(), F_SOLID),
        ('trunk', mt_trunk(), F_SOLID),
        ('canopy0', mt_canopy(0), F_OVERLAY),
        ('canopy1', mt_canopy(1), F_OVERLAY),
        ('water0', mt_water(0), F_WATER | F_SOLID),
        ('water_edge', mt_water_edge_n(), F_WATER | F_SOLID),
        ('rock', mt_rock(), F_SOLID),
        ('bush', mt_bush(), F_SOLID),
        ('sign', mt_sign(), F_SOLID),
    ]
    props = {'doghouse': (prop_doghouse(), F_SOLID)}
    return build_tileset('jardin', defs, props)


def build_colon():
    defs = [
        ('bg0', mt_flesh_bg(0), F_NONE),
        ('bg1', mt_flesh_bg(1), F_NONE),
        ('wall', mt_flesh_wall(), F_SOLID),
        ('floor', mt_flesh_floor(), F_SOLID),
        ('membrane', mt_membrane(), F_PLATFORM),
        ('acid', mt_acid(0), F_HAZARD),
        ('acid_surface', mt_acid_surface(0), F_HAZARD),
        ('polyp', mt_polyp(), F_NONE),
        ('rib', mt_rib(), F_NONE),
        ('sphincter_closed', mt_sphincter_closed(), F_SOLID),
        ('sphincter_open', mt_sphincter_open(), F_NONE),
        ('gas_vent', mt_gas_vent(), F_SOLID),
        ('block', mt_block(), F_SOLID),
        ('switch_off', mt_switch(False), F_NONE),
        ('switch_on', mt_switch(True), F_NONE),
    ]
    return build_tileset('colon', defs)
