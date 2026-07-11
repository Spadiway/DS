#!/usr/bin/env python3
"""Terelu, abejorros y NPCs animales del jardín."""

from pixelkit import Canvas, from_ascii


# ---------------------------------------------------------------------------
# Terelu, la mosca megalómana (32x32)
# ---------------------------------------------------------------------------

# Ojo compuesto iridiscente (8x9): dither teal/violeta
TERELU_EYE = """
.jjjjj..
jjiijjj.
jiIjIjj.
jIjijIj.
jjIjIjj.
jjjIjjj.
.jjjjj..
"""

# Sonrisa inquietante (9x4)
TERELU_GRIN = """
kkkkkkkkk
kwkwkwkwk
.kkkkkkk.
"""


def build_terelu_frame(pose='hover', step=0):
    c = Canvas(32, 32)
    bob = -1 if step % 2 else 0
    cx, cy = 16, 17 + bob

    # alas (detrás), aletean
    wing_up = step % 2 == 0
    for mirror, wx in ((False, cx - 15), (True, cx + 3)):
        w = Canvas(12, 10)
        if wing_up:
            w.ellipse(6, 4, 5, 3, 'y')
            w.ellipse(6, 4, 3, 2, 'Y')
        else:
            w.ellipse(6, 6, 5, 4, 'y')
            w.ellipse(6, 6, 3, 2, 'Y')
        c.blit(w, wx, cy - 12 if wing_up else cy - 9, mirror=mirror)

    # capita roja
    if pose != 'hurt':
        for i in range(7):
            ww = 4 + i
            c.hline(cx - ww // 2, cx - ww // 2 + ww, cy + i - 2,
                    'R' if i % 2 == 0 else 'q')

    # cuerpo verde metálico
    c.ellipse_shaded(cx, cy, 7, 8, 'z', 'i', 'Z')

    # cabeza
    hy = cy - 9
    c.ellipse_shaded(cx, hy, 7, 6, 'z', 'i', 'Z')

    # antenitas
    c.vline(cx - 3, hy - 8, hy - 6, 'Z')
    c.vline(cx + 3, hy - 8, hy - 6, 'Z')
    c.set(cx - 4, hy - 9, 'j')
    c.set(cx + 4, hy - 9, 'j')

    # ojos compuestos ENORMES
    e = from_ascii(TERELU_EYE)
    if pose == 'hurt':
        from sprites_cats import EYE_HURT
        eh = from_ascii(EYE_HURT)
        c.blit(eh, cx - 8, hy - 3)
        c.blit(eh, cx + 3, hy - 3, mirror=True)
    else:
        c.blit(e, cx - 9, hy - 4)
        c.blit(e, cx + 2, hy - 4, mirror=True)

    # sonrisa inquietante
    if pose == 'laugh':
        g = Canvas(9, 5)
        g.rect(0, 0, 9, 4, 'k')
        for x in range(0, 9, 2):
            g.set(x, 0, 'w')
            g.set(x, 3, 'w')
        g.rect(2, 1, 5, 2, 'q')
        c.blit(g, cx - 4, hy + 3)
    elif pose != 'hurt':
        c.blit(from_ascii(TERELU_GRIN), cx - 4, hy + 3)

    # patitas
    for i, dx in enumerate((-6, -2, 2, 6)):
        c.vline(cx + dx, cy + 7, cy + 9 + (i % 2), 'Z')

    # aura de zumbido al atacar
    if pose == 'attack':
        for dx, dy in ((-13, -6), (-14, 0), (-13, 6), (13, -6),
                       (14, 0), (13, 6), (0, -16), (0, 14)):
            c.set(cx + dx, cy + dy, ';')
            c.set(cx + dx, cy + dy - 1, '*')

    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Abejorro (24x24 dentro de 32x32): bolita peluda adorable
# ---------------------------------------------------------------------------

def build_bee_frame(step=0, elder=False, shop=False):
    c = Canvas(32, 32)
    bob = -1 if step % 2 else 0
    cx, cy = 16, 18 + bob

    # alitas
    wing_up = step % 2 == 0
    for mirror, wx in ((False, cx - 12), (True, cx + 3)):
        w = Canvas(9, 8)
        w.ellipse(4, 4 if wing_up else 5, 4, 3, 'y')
        w.ellipse(4, 4 if wing_up else 5, 2, 1, 'w')
        c.blit(w, wx, cy - 12, mirror=mirror)

    # cuerpo peludo redondo con rayas
    c.ellipse_shaded(cx, cy, 9, 8, 'H', 'h', 'o')
    # rayas
    for band in (-3, 2):
        for x in range(-8, 9):
            yy = cy + band + (abs(x) // 4)
            if (x - cx) ** 2 < 999:
                nx = x / 9.0
                if nx * nx <= 0.95:
                    c.set(cx + x, yy, 'o')
                    c.set(cx + x, yy + 1, 'O')
    # pelillos (flequillo despeinado)
    for dx in (-7, -4, 0, 4, 7):
        c.set(cx + dx, cy - 9, 'h')
        c.set(cx + dx + 1, cy - 10, 'h')

    # carita: ojos grandes juntos + sonrisa
    for ex in (cx - 4, cx + 2):
        c.rect(ex, cy - 4, 3, 4, 'k')
        c.set(ex + 1, cy - 3, 'w')
    c.hline(cx - 1, cx + 1, cy + 2, 'k')
    c.set(cx - 2, cy + 1, 'k')
    c.set(cx + 2, cy + 1, 'k')

    if elder:
        # cejas blancas pobladas y bastoncito
        c.rect(cx - 6, cy - 6, 4, 2, 'w')
        c.rect(cx + 2, cy - 6, 4, 2, 'w')
        c.vline(cx + 11, cy - 2, cy + 8, '9')
        c.set(cx + 11, cy - 3, '8')
    if shop:
        # delantal de tendero
        for i in range(5):
            c.hline(cx - 4 + i // 2, cx + 4 - i // 2, cy + 3 + i, 'w')
        c.hline(cx - 2, cx + 2, cy + 4, 'V')

    # antenitas
    c.vline(cx - 3, cy - 12, cy - 9, 'O')
    c.vline(cx + 3, cy - 12, cy - 9, 'O')
    c.set(cx - 4, cy - 13, 'o')
    c.set(cx + 4, cy - 13, 'o')

    # patitas colgando
    c.vline(cx - 4, cy + 7, cy + 9, 'O')
    c.vline(cx + 4, cy + 7, cy + 9, 'O')

    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# NPCs del jardín (32x32)
# ---------------------------------------------------------------------------

def build_snail_frame(step=0):
    """Doña Baba, caracola cotilla."""
    c = Canvas(32, 32)
    stretch = step % 2
    # concha en espiral
    c.ellipse_shaded(19, 18, 9, 9, 'm', '&', 'J')
    for i, (dx, dy) in enumerate([(3, -4), (5, 0), (3, 4), (-1, 5),
                                  (-4, 2), (-3, -2), (0, -3), (1, 0)]):
        c.set(19 + dx, 18 + dy, 'J' if i % 2 else '$')
    # cuerpo
    body_x = 6 - stretch
    c.ellipse_shaded(11, 26, 9, 4, '1', '!', '3')
    c.rect(body_x, 15, 4, 12, '1')
    c.ellipse(body_x + 2, 14, 3, 3, '1')
    # ojos en tallo
    for dx in (0, 4):
        c.vline(body_x + dx, 8, 12, '3')
        c.rect(body_x + dx - 1, 5, 3, 4, 'w')
        c.set(body_x + dx, 6, 'k')
    # boca
    c.set(body_x - 1, 16, 'k')
    c.set(body_x, 17, 'k')
    c.outline('k')
    return c


def build_bird_frame(step=0):
    """Rufo, petirrojo gruñón."""
    c = Canvas(32, 32)
    hop = -2 if step % 2 else 0
    cx, cy = 16, 19 + hop
    # cola
    for i in range(4):
        c.hline(cx + 7 + i, cx + 10 + i, cy - 3 + i, 'd')
    # cuerpo regordete
    c.ellipse_shaded(cx, cy, 8, 7, 'd', 'g', 'K')
    # pechuga roja
    c.ellipse(cx - 4, cy + 2, 4, 4, 'f')
    c.ellipse(cx - 4, cy + 1, 3, 2, ';')
    # cabeza
    c.ellipse_shaded(cx - 3, cy - 7, 6, 5, 'd', 'g', 'K')
    # pico
    c.rect(cx - 12, cy - 8, 4, 2, 'F')
    c.set(cx - 12, cy - 6, '+')
    # ojo con ceja gruñona
    c.rect(cx - 7, cy - 10, 3, 3, 'w')
    c.set(cx - 6, cy - 9, 'k')
    c.line(cx - 9, cy - 12, cx - 5, cy - 11, 'k')
    # alita
    c.ellipse(cx + 2, cy, 4, 3, 'K')
    # patas palillo
    c.vline(cx - 2, cy + 7, cy + 10 - hop, '+')
    c.vline(cx + 2, cy + 7, cy + 10 - hop, '+')
    c.outline('k')
    return c


def build_squirrel_frame(step=0):
    """Nuez, ardilla nerviosa."""
    c = Canvas(32, 32)
    tw = step % 2
    cx, cy = 14, 20
    # COLA enorme esponjosa
    tail = Canvas(14, 20)
    tail.ellipse_shaded(7, 13, 5, 6, '9', '8', '0')
    tail.ellipse_shaded(6 + tw, 5, 5, 5, '9', '8', '0')
    c.blit(tail, cx + 4, 2)
    # cuerpo
    c.ellipse_shaded(cx, cy + 2, 6, 6, '8', '5', '9')
    c.ellipse(cx - 1, cy + 4, 3, 3, '5')
    # cabeza
    c.ellipse_shaded(cx - 2, cy - 6, 6, 5, '8', '5', '9')
    # orejitas
    c.rect(cx - 7, cy - 12, 2, 3, '8')
    c.rect(cx + 1, cy - 12, 2, 3, '8')
    # ojos grandes nerviosos
    for ex in (cx - 6, cx - 1):
        c.rect(ex, cy - 8, 3, 4, 'w')
        c.set(ex + 1, cy - 7 + tw, 'k')
    # dientecillos
    c.rect(cx - 4, cy - 2, 2, 2, 'w')
    # nuez entre las patas
    c.ellipse(cx - 1, cy + 7, 2, 2, '0')
    c.outline('k')
    return c


def build_frog_frame(step=0):
    """Don Croac, rana filósofa del estanque."""
    c = Canvas(32, 32)
    puff = step % 2
    cx, cy = 16, 20
    # cuerpo
    c.ellipse_shaded(cx, cy, 10, 8 + puff, '2', '1', '3')
    # panza
    c.ellipse(cx, cy + 3, 6, 4 + puff, '!')
    # ojos en lo alto
    for ex in (cx - 6, cx + 6):
        c.ellipse(ex, cy - 8, 3, 3, '2')
        c.rect(ex - 1, cy - 10, 3, 4, 'w')
        c.set(ex, cy - 8, 'k')
    # boca ancha serena
    c.hline(cx - 6, cx + 6, cy - 1, 'k')
    c.set(cx - 7, cy - 2, 'k')
    c.set(cx + 7, cy - 2, 'k')
    # papada al hablar
    if puff:
        c.ellipse(cx, cy + 1, 4, 3, '!')
    # patas
    c.rect(cx - 9, cy + 6, 4, 3, '2')
    c.rect(cx + 5, cy + 6, 4, 3, '2')
    c.outline('k')
    return c


def build_all():
    out = {}
    fr, order = [], []

    def add(lst, olist, name, f):
        olist.append((name, len(lst)))
        lst.append(f)

    # Terelu
    for st in (0, 1):
        add(fr, order, f'hover{st}', build_terelu_frame('hover', st))
    for st in (0, 1):
        add(fr, order, f'laugh{st}', build_terelu_frame('laugh', st))
    for st in (0, 1):
        add(fr, order, f'attack{st}', build_terelu_frame('attack', st))
    add(fr, order, 'hurt', build_terelu_frame('hurt'))
    out['terelu'] = (fr, 32, order)

    # Abejorros: normal, anciano, tendero
    fr, order = [], []
    for st in (0, 1):
        add(fr, order, f'idle{st}', build_bee_frame(st))
    for st in (0, 1):
        add(fr, order, f'elder{st}', build_bee_frame(st, elder=True))
    for st in (0, 1):
        add(fr, order, f'shop{st}', build_bee_frame(st, shop=True))
    out['abejorro'] = (fr, 32, order)

    # NPCs
    fr, order = [], []
    for st in (0, 1):
        add(fr, order, f'snail{st}', build_snail_frame(st))
    for st in (0, 1):
        add(fr, order, f'bird{st}', build_bird_frame(st))
    for st in (0, 1):
        add(fr, order, f'squirrel{st}', build_squirrel_frame(st))
    for st in (0, 1):
        add(fr, order, f'frog{st}', build_frog_frame(st))
    out['npcs'] = (fr, 32, order)

    return out
