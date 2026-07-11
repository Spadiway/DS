#!/usr/bin/env python3
"""Elementos de interfaz y efectos: partículas, dígitos de daño, iconos,
cursor, sombra, punto de guardado, banner ¡EXCELENTE!, retratos."""

from pixelkit import Canvas, from_ascii


# ---------------------------------------------------------------------------
# Partículas y efectos (16x16)
# ---------------------------------------------------------------------------

def star(step=0):
    c = Canvas(16, 16)
    r = 5 - step * 2
    c.vline(8, 8 - r, 8 + r, '*')
    c.hline(8 - r, 8 + r, 8, '*')
    if step == 0:
        for d in (-2, 2):
            c.set(8 + d, 8 + d, ';')
            c.set(8 + d, 8 - d, ';')
    c.set(8, 8, 'w')
    return c


def heart(step=0):
    c = Canvas(16, 16)
    art = """
.ff.ff.
fffffff
fffffff
.fffff.
..fff..
...f...
"""
    c.stamp_ascii(art, 4, 5 - step)
    c.set(9, 6 - step, 'w')
    return c


def puff(step=0):
    """Nube de gas (para el puzzle de gases y polvo de carrera)."""
    c = Canvas(16, 16)
    r = 3 + step * 2
    c.ellipse(8, 8, r, r - 1, '!')
    c.ellipse(8 - r + 2, 9, 2, 2, '!')
    c.ellipse(8 + r - 2, 9, 2, 2, '!')
    if step < 2:
        c.ellipse(8, 8, r - 2, r - 3 if r > 3 else 1, 'w')
    c.outline('=', over=False)
    return c


def sparkle(step=0):
    c = Canvas(16, 16)
    if step == 0:
        c.set(8, 8, 'w')
        c.set(7, 8, '*')
        c.set(9, 8, '*')
        c.set(8, 7, '*')
        c.set(8, 9, '*')
    else:
        c.vline(8, 5, 11, '*')
        c.hline(5, 11, 8, '*')
        c.set(8, 8, 'w')
    return c


def exclamation():
    """Globo de ! sobre enemigos que te ven."""
    c = Canvas(16, 16)
    c.ellipse(8, 7, 6, 7, 'w')
    c.rect(7, 2, 3, 7, '^')
    c.rect(7, 11, 3, 3, '^')
    c.outline('k')
    return c


def sweat():
    c = Canvas(16, 16)
    art = """
..v..
.vvv.
vvvvv
vVVv.
.vv..
"""
    c.stamp_ascii(art, 5, 5)
    c.outline('x')
    return c


def shadow_blob():
    """Sombra elíptica bajo los personajes (16x8 en 16x16)."""
    c = Canvas(16, 16)
    for y in range(3):
        w = (12, 10, 6)[y]
        for x in range(w):
            if (x + y) % 2 == 0:
                c.set(8 - w // 2 + x, 11 + y, 'K')
    return c


# ---------------------------------------------------------------------------
# Dígitos de daño (8x16, saltarines): blanco (daño) y verde (curación)
# ---------------------------------------------------------------------------

DIGITS = {
    '0': ["###", "#.#", "#.#", "#.#", "###"],
    '1': [".#.", "##.", ".#.", ".#.", "###"],
    '2': ["###", "..#", "###", "#..", "###"],
    '3': ["###", "..#", ".##", "..#", "###"],
    '4': ["#.#", "#.#", "###", "..#", "..#"],
    '5': ["###", "#..", "###", "..#", "###"],
    '6': ["###", "#..", "###", "#.#", "###"],
    '7': ["###", "..#", ".#.", ".#.", ".#."],
    '8': ["###", "#.#", "###", "#.#", "###"],
    '9': ["###", "#.#", "###", "..#", "###"],
}


def damage_digit(ch, color='w'):
    """Dígito gordo 2x con contorno para números de daño."""
    c = Canvas(16, 16)
    rows = DIGITS[ch]
    for y, row in enumerate(rows):
        for x, v in enumerate(row):
            if v == '#':
                c.rect(2 + x * 3, 2 + y * 2, 3, 2, color)
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Iconos de botones (16x16)
# ---------------------------------------------------------------------------

def button_icon(letter):
    c = Canvas(16, 16)
    col = {'A': '^', 'B': 'F', 'X': ':', 'Y': '~'}[letter]
    c.ellipse(8, 8, 7, 7, col)
    c.ellipse(6, 6, 3, 2, 'w')
    glyphs = {
        'A': ["..#..", ".#.#.", ".###.", "#...#", "#...#"],
        'B': ["###..", "#..#.", "###..", "#..#.", "###.."],
        'X': ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
        'Y': ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
    }
    for y, row in enumerate(glyphs[letter]):
        for x, v in enumerate(row):
            if v == '#':
                c.set(5 + x, 5 + y, 'k')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Cursor de pata (16x16) y flecha de diálogo (8x8 en 16x16)
# ---------------------------------------------------------------------------

def paw_cursor(step=0):
    c = Canvas(16, 16)
    o = step  # palpita
    c.ellipse(8, 10, 5, 4, 'w')
    for dx, dy in ((-4, -6), (0, -7), (4, -6)):
        c.ellipse(8 + dx, 10 + dy + o, 1, 2, 'w')
    c.ellipse(8, 10, 3, 2, 'p')
    c.outline('k')
    return c


def dialog_arrow(step=0):
    c = Canvas(16, 16)
    y0 = 5 + step
    for i in range(4):
        c.hline(4 + i, 11 - i, y0 + i, '^' if i < 3 else 'q')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Punto de guardado: bola de pelo brillante (exterior) / sinapsis (interior)
# ---------------------------------------------------------------------------

def save_hairball(step=0):
    c = Canvas(16, 16)
    c.ellipse_shaded(8, 9, 6, 5, 'C', 'c', 's')
    # pelillos
    for dx, dy in ((-6, -3), (-3, -6), (2, -6), (5, -4), (6, 0)):
        c.set(8 + dx, 9 + dy, 'c')
    # brillo palpitante
    if step == 0:
        c.set(5, 6, 'w')
        c.set(6, 6, 'w')
        c.set(5, 7, 'w')
    else:
        c.set(5, 6, '*')
        c.set(11, 11, '*')
        c.set(8, 4, 'w')
    c.outline('k')
    return c


def save_synapse(step=0):
    c = Canvas(16, 16)
    c.ellipse_shaded(8, 8, 5, 5, ':', 'v', '-')
    for dx, dy in ((-7, -5), (7, -5), (-7, 5), (7, 5)):
        c.line(8, 8, 8 + dx, 8 + dy, 'v')
    if step:
        c.set(8, 8, 'w')
        c.set(7, 7, 'w')
    else:
        c.ellipse(7, 7, 2, 2, 'w')
    c.outline('_')
    return c


# ---------------------------------------------------------------------------
# Iconos de objetos (16x16)
# ---------------------------------------------------------------------------

def icon_croqueta():
    c = Canvas(16, 16)
    c.ellipse_shaded(8, 9, 6, 4, '9', '8', '0')
    c.set(6, 8, '8')
    c.set(10, 9, '0')
    c.outline('k')
    return c


def icon_croqueton():
    c = Canvas(16, 16)
    c.ellipse_shaded(8, 8, 7, 5, '9', '8', '0')
    c.ellipse(6, 7, 2, 1, '*')
    c.outline('k')
    return c


def icon_atun():
    """Lata de atún (revivir)."""
    c = Canvas(16, 16)
    c.ellipse(8, 10, 7, 4, 'l')
    c.ellipse(8, 8, 7, 4, 'w')
    c.ellipse(8, 8, 5, 2, 'v')
    c.ellipse(9, 8, 2, 1, 'V')  # pescadito asomando
    c.outline('k')
    return c


def icon_hierba():
    """Hierba gatera (sube FUE en combate)."""
    c = Canvas(16, 16)
    for i, (dx, tip) in enumerate(((-4, -7), (0, -9), (4, -7), (-2, -8),
                                   (2, -8))):
        c.line(8 + dx // 2, 13, 8 + dx, 13 + tip, '2')
        c.set(8 + dx, 13 + tip - 1, '1')
    c.outline('4')
    return c


def icon_pelota():
    """Pelotita (restaura PE)."""
    c = Canvas(16, 16)
    c.ellipse_shaded(8, 9, 6, 6, 'f', ';', 'q')
    c.line(2, 9, 14, 9, 'w')
    c.set(4, 5, 'w')
    c.outline('k')
    return c


def icon_collar():
    c = Canvas(16, 16)
    for a in range(-6, 7):
        y = 8 + (a * a) // 8
        c.set(8 + a, y, '^')
        c.set(8 + a, y + 1, 'q')
    c.ellipse(8, 12, 2, 2, '*')
    c.set(8, 12, '+')
    c.outline('k')
    return c


def icon_chapa():
    """Chapa (moneda del juego), con giro de 4 frames."""
    frames = []
    for w in (6, 4, 1, 4):
        c = Canvas(16, 16)
        c.ellipse_shaded(8, 8, w, 6, '*', '#', '+')
        if w > 3:
            c.ellipse(8, 8, w - 2, 4, '*')
            c.set(7, 6, '#')
        c.outline('k')
        frames.append(c)
    return frames


# ---------------------------------------------------------------------------
# Banner ¡EXCELENTE! / ¡BIEN! / ratings de combate (64x16)
# ---------------------------------------------------------------------------

def _mini_text(c, text, x, y, col='w'):
    """Letras 3x5 compactas para banners."""
    F = {
        'A': ["###", "#.#", "###", "#.#", "#.#"],
        'B': ["##.", "#.#", "##.", "#.#", "##."],
        'C': ["###", "#..", "#..", "#..", "###"],
        'D': ["##.", "#.#", "#.#", "#.#", "##."],
        'E': ["###", "#..", "##.", "#..", "###"],
        'I': ["#", "#", "#", "#", "#"],
        'L': ["#..", "#..", "#..", "#..", "###"],
        'N': ["#.#", "###", "###", "#.#", "#.#"],
        'T': ["###", ".#.", ".#.", ".#.", ".#."],
        'X': ["#.#", "#.#", ".#.", "#.#", "#.#"],
        '!': ["#", "#", "#", ".", "#"],
        '¡': ["#", ".", "#", "#", "#"],
        ' ': ["..", "..", "..", "..", ".."],
    }
    cx = x
    for ch in text:
        rows = F.get(ch)
        if rows is None:
            continue
        for yy, row in enumerate(rows):
            for xx, v in enumerate(row):
                if v == '#':
                    c.set(cx + xx, y + yy, col)
        cx += len(rows[0]) + 1
    return cx


def banner_excelente():
    c = Canvas(64, 16)
    end = _mini_text(c, '¡EXCELENTE!', 3, 5, '*')
    _ = end
    c.outline('k')
    return c


def banner_bien():
    c = Canvas(64, 16)
    _mini_text(c, '¡BIEN!', 17, 5, 'w')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Ensamblado de hojas
# ---------------------------------------------------------------------------

def build_all():
    out = {}

    fr, order = [], []

    def add(name, f):
        order.append((name, len(fr)))
        fr.append(f)

    for st in (0, 1):
        add(f'star{st}', star(st))
    for st in (0, 1):
        add(f'heart{st}', heart(st))
    for st in (0, 1, 2):
        add(f'puff{st}', puff(st))
    for st in (0, 1):
        add(f'sparkle{st}', sparkle(st))
    add('excl', exclamation())
    add('sweat', sweat())
    add('shadow', shadow_blob())
    for st in (0, 1):
        add(f'paw{st}', paw_cursor(st))
    for st in (0, 1):
        add(f'arrow{st}', dialog_arrow(st))
    for st in (0, 1):
        add(f'hairball{st}', save_hairball(st))
    for st in (0, 1):
        add(f'synapse{st}', save_synapse(st))
    for d in '0123456789':
        add(f'dmg{d}', damage_digit(d, 'w'))
    for d in '0123456789':
        add(f'heal{d}', damage_digit(d, '~'))
    for b in 'ABXY':
        add(f'btn{b}', button_icon(b))
    add('icon_croqueta', icon_croqueta())
    add('icon_croqueton', icon_croqueton())
    add('icon_atun', icon_atun())
    add('icon_hierba', icon_hierba())
    add('icon_pelota', icon_pelota())
    add('icon_collar', icon_collar())
    for i, f in enumerate(icon_chapa()):
        add(f'chapa{i}', f)
    out['fx16'] = (fr, 16, order)

    fr, order = [], []
    add('excelente', banner_excelente())
    add('bien', banner_bien())
    out['banners'] = (fr, (64, 16), order)

    return out
