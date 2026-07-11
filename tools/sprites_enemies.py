#!/usr/bin/env python3
"""Enemigos originales: criaturas del jardín corrompidas por el zumbido
de Terelu (exterior) y parásitos carismáticos (interior de Deedee).

Cada enemigo tiene frames: idle x2, telegraph (aviso de ataque legible),
attack, hurt. El jefe añade ko.
"""

from pixelkit import Canvas, from_ascii
from sprites_cats import EYE_HURT


def _spiral_buzz(c, cx, cy, r):
    """Marca de corrupción: espiral de zumbido sobre la cabeza."""
    for i, (dx, dy) in enumerate([(0, -r), (2, -r - 2), (0, -r - 4),
                                  (-2, -r - 2)]):
        c.set(cx + dx, cy + dy, 'm' if i % 2 else 'j')


# ---------------------------------------------------------------------------
# Pulgón Bravucón (exterior): pulgón morado musculitos, embiste
# ---------------------------------------------------------------------------

def build_pulgon(pose='idle', step=0):
    c = Canvas(32, 32)
    bob = 1 if step % 2 else 0
    cx, cy = 16, 20 + bob
    lean = 0
    if pose == 'telegraph':
        lean = 3      # se echa atrás: aviso legible
    elif pose == 'attack':
        lean = -4     # embiste hacia delante (izquierda)

    # abdomen gordo
    c.ellipse_shaded(cx + 4 + lean // 2, cy, 9, 7, '@', '&', '$')
    # "hombros" de bravucón
    c.ellipse_shaded(cx - 4 + lean, cy - 4, 7, 6, '@', '&', '$')
    # cabeza pequeña con ceño
    hx = cx - 9 + lean
    c.ellipse_shaded(hx, cy - 5, 5, 4, '@', '&', '$')
    # cuernecillos de pulgón
    c.vline(hx - 2, cy - 12, cy - 9, '$')
    c.vline(hx + 2, cy - 12, cy - 9, '$')
    # cara
    if pose == 'hurt':
        c.blit(from_ascii(EYE_HURT), hx - 3, cy - 8)
    else:
        c.rect(hx - 3, cy - 8, 3, 3, 'w')
        c.rect(hx + 1, cy - 8, 3, 3, 'w')
        px = 0 if pose != 'attack' else -1
        c.set(hx - 2 + px, cy - 7, 'k')
        c.set(hx + 2 + px, cy - 7, 'k')
        # UNICEJA furiosa
        c.line(hx - 4, cy - 10, hx + 4, cy - 9, 'k')
        # morrito
        c.hline(hx - 1, hx + 1, cy - 3, 'k')
    # patitas
    for i, dx in enumerate((-7, -3, 1, 5, 9)):
        ly = cy + 6 + (1 if (i + step) % 2 else 0)
        c.vline(cx + dx + lean // 2, ly, ly + 3, '$')
    # marca de corrupción
    _spiral_buzz(c, cx + 4, cy - 8, 4)
    if pose == 'telegraph':
        # signo de exclamación de aviso
        c.rect(cx + 12, cy - 14, 2, 5, ';')
        c.rect(cx + 12, cy - 7, 2, 2, ';')
    if pose == 'attack':
        # líneas de velocidad
        for dy in (-4, 0, 4):
            c.hline(cx + 10, cx + 14, cy + dy, 'l')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Semilla Saltona (exterior): semilla con brote punk, salta encima
# ---------------------------------------------------------------------------

def build_semilla(pose='idle', step=0):
    c = Canvas(32, 32)
    cx, cy = 16, 21
    squash = 0
    if pose == 'telegraph':
        squash = 3    # se aplasta ANTES de saltar: telegraph clásico
    elif pose == 'attack':
        squash = -3   # estirada en el aire
        cy -= 6
    bob = 1 if step % 2 else 0

    ry = 8 - squash
    rx = 7 + squash
    # cuerpo semilla
    c.ellipse_shaded(cx, cy + bob, rx, ry, '9', '8', '0')
    # veta central
    c.vline(cx, cy - ry + 2 + bob, cy + ry - 2 + bob, '0')
    # brote punk (mohicano)
    for i, (dx, dy) in enumerate([(-3, -ry - 3), (0, -ry - 5),
                                  (3, -ry - 3)]):
        c.line(cx + dx, cy + dy + bob, cx, cy - ry + 1 + bob, '2')
        c.set(cx + dx, cy + dy - 1 + bob, '1')
    # cara: ojos entrecerrados chulescos
    if pose == 'hurt':
        c.blit(from_ascii(EYE_HURT), cx - 5, cy - 3 + bob)
    else:
        for ex in (cx - 5, cx + 1):
            c.rect(ex, cy - 3 + bob + max(0, squash // 2), 4, 2, 'w')
            c.set(ex + 1, cy - 3 + bob + max(0, squash // 2), 'k')
            c.hline(ex, ex + 3, cy - 4 + bob + max(0, squash // 2), 'k')
        # sonrisilla
        c.hline(cx - 2, cx + 2, cy + 3 + bob - squash // 2, 'k')
        c.set(cx + 3, cy + 2 + bob - squash // 2, 'k')
    _spiral_buzz(c, cx, cy - ry - 4, 2)
    if pose == 'telegraph':
        c.rect(cx + 11, cy - 12, 2, 5, ';')
        c.rect(cx + 11, cy - 5, 2, 2, ';')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Bacteriolo (interior): moco redondo con un ojazo, rebota
# ---------------------------------------------------------------------------

def build_bacteriolo(pose='idle', step=0):
    c = Canvas(32, 32)
    cx, cy = 16, 19
    wob = step % 2
    rx = 9 + wob
    ry = 9 - wob
    if pose == 'telegraph':
        rx, ry = 11, 7
    elif pose == 'attack':
        rx, ry = 7, 11

    # gelatina
    c.ellipse_shaded(cx, cy, rx, ry, '=', '!', '?')
    # burbujitas internas
    for dx, dy in ((-4, 3), (3, 4), (-2, -3)):
        c.set(cx + dx, cy + dy, '!')
        c.set(cx + dx + 1, cy + dy, '?')
    # flagelos
    for i, dx in enumerate((-rx + 1, 0, rx - 1)):
        c.vline(cx + dx, cy + ry, cy + ry + 2 + (i + step) % 2, '?')
    # UN ojazo central
    if pose == 'hurt':
        c.blit(from_ascii(EYE_HURT), cx - 3, cy - 4)
    else:
        c.ellipse(cx, cy - 2, 4, 4, 'w')
        c.rect(cx - 1, cy - 3 + (1 if pose == 'attack' else 0), 3, 3, 'k')
        c.set(cx - 2, cy - 4, 'w')
        # boca pequeña engreída
        c.hline(cx - 1, cx + 2, cy + 4, 'k')
        c.set(cx + 3, cy + 3, 'k')
    if pose == 'telegraph':
        c.rect(cx + 12, cy - 13, 2, 5, ';')
        c.rect(cx + 12, cy - 6, 2, 2, ';')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Gusanillo Ansioso (interior): lombriz nerviosa que da latigazos
# ---------------------------------------------------------------------------

def build_gusanillo(pose='idle', step=0):
    c = Canvas(32, 32)
    cx, cy = 16, 24
    sway = 1 if step % 2 else -1
    if pose == 'attack':
        sway = -4
    # segmentos en S
    segs = [(6, 0), (3, -4), (1, -8), (0, -12), (1 + sway, -16)]
    if pose == 'telegraph':
        segs = [(6, 0), (4, -4), (3, -7), (3, -10), (5, -13)]  # se enrosca
    for i, (dx, dy) in enumerate(segs):
        r = 5 - i // 2
        col = ('G', 'D', 'L') if i % 2 == 0 else ('D', 'D', 'G')
        c.ellipse_shaded(cx + dx, cy + dy, r, r - 1, *col)
    # cabeza al final
    hx, hy = cx + segs[-1][0], cy + segs[-1][1] - 3
    c.ellipse_shaded(hx, hy, 5, 4, 'G', 'D', 'L')
    if pose == 'hurt':
        c.blit(from_ascii(EYE_HURT), hx - 3, hy - 2)
    else:
        # ojos grandes preocupados
        for ex in (hx - 3, hx + 1):
            c.rect(ex, hy - 2, 3, 4, 'w')
            c.set(ex + 1, hy + sway // 4, 'k')
        # boquita de susto
        c.rect(hx - 1, hy + 3, 2, 2, 'k')
    # gotitas de sudor nervioso
    if pose in ('idle', 'telegraph'):
        c.set(hx + 5, hy - 4 + step, 'v')
        c.set(hx - 6, hy - 2 - step, 'v')
    if pose == 'telegraph':
        c.rect(hx + 8, hy - 8, 2, 5, ';')
        c.rect(hx + 8, hy - 1, 2, 2, ';')
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# JEFE: El Gran Tapón (64x64) — parásito corcho que atasca el colon
# ---------------------------------------------------------------------------

def build_tapon(pose='idle', step=0):
    c = Canvas(64, 64)
    bob = 1 if step % 2 else 0
    cx, cy = 32, 38 + bob
    lean = 0
    if pose == 'telegraph':
        lean = 4
    elif pose == 'attack':
        lean = -6

    # cuerpo masivo de corcho (cono truncado)
    for i in range(26):
        w = 30 - i // 3
        col = '9' if i % 3 else '8'
        if i > 20:
            col = '0'
        c.hline(cx - w // 2 + (lean * i // 26), cx + w // 2 + (lean * i // 26),
                cy - 14 + i, col)
    # textura de corcho (motas)
    for dx, dy in ((-9, -8), (5, -10), (-3, -2), (9, -4), (-11, 2),
                   (3, 5), (-5, 9), (10, 8)):
        c.set(cx + dx, cy + dy, '0')
        c.set(cx + dx + 1, cy + dy, '7')
    # corona de rey del atasco (chapita)
    for i, dx in enumerate((-8, -3, 2, 7)):
        c.line(cx + dx, cy - 20, cx + dx + 2, cy - 15, '*')
        c.set(cx + dx + 1, cy - 21, '*')
    c.rect(cx - 10, cy - 16, 21, 3, '*')
    c.hline(cx - 10, cx + 10, cy - 14, '+')

    # brazos regordetes
    ay = cy - 2
    if pose == 'telegraph':
        # brazos arriba: aviso de palmada
        c.rect(cx - 22, ay - 14, 6, 14, '9')
        c.rect(cx + 16, ay - 14, 6, 14, '9')
        c.ellipse(cx - 19, ay - 16, 4, 3, '8')
        c.ellipse(cx + 19, ay - 16, 4, 3, '8')
    elif pose == 'attack':
        # palmada al frente
        c.rect(cx - 26, ay + 2, 10, 5, '9')
        c.ellipse(cx - 27, ay + 4, 4, 4, '8')
        for dy in (-3, 2, 7):
            c.hline(cx - 32, cx - 29, ay + dy, 'l')
    else:
        c.rect(cx - 20, ay, 5, 10, '9')
        c.rect(cx + 15, ay, 5, 10, '9')

    # cara gruñona ENORME
    fy = cy - 6
    if pose == 'hurt' or pose == 'ko':
        e = from_ascii(EYE_HURT)
        c.blit(e, cx - 9, fy - 2)
        c.blit(e, cx + 4, fy - 2, mirror=True)
        # boca de disgusto
        c.ellipse(cx, fy + 9, 4, 3, 'k')
        c.ellipse(cx, fy + 10, 2, 1, 'q')
    else:
        # ojos pequeños y furiosos muy juntos
        for ex in (cx - 7, cx + 3):
            c.rect(ex, fy, 5, 4, 'w')
            c.set(ex + 2 + (0 if pose != 'attack' else -1), fy + 2, 'k')
            c.set(ex + 3 + (0 if pose != 'attack' else -1), fy + 2, 'k')
        # cejón continuo
        c.line(cx - 9, fy - 3, cx - 1, fy - 1, 'k')
        c.line(cx + 1, fy - 1, cx + 9, fy - 3, 'k')
        # bocaza con dientes
        c.rect(cx - 6, fy + 7, 13, 4, 'k')
        for dx in (-4, 0, 4):
            c.rect(cx + dx, fy + 7, 2, 2, 'w')
    if pose == 'ko':
        # estrellitas de mareo
        for dx, dy in ((-14, -20), (0, -24), (14, -20)):
            c.set(cx + dx, cy + dy, '*')
            c.set(cx + dx + 1, cy + dy, ';')
    if pose == 'telegraph':
        c.rect(cx + 24, cy - 24, 3, 7, ';')
        c.rect(cx + 24, cy - 14, 3, 3, ';')

    c.outline('k')
    return c


def build_all():
    out = {}

    def five(builder):
        fr, order = [], []
        for st in (0, 1):
            order.append((f'idle{st}', len(fr)))
            fr.append(builder('idle', st))
        for name in ('telegraph', 'attack', 'hurt'):
            order.append((name, len(fr)))
            fr.append(builder(name, 0))
        return fr, order

    fr, order = five(build_pulgon)
    out['pulgon'] = (fr, 32, order)
    fr, order = five(build_semilla)
    out['semilla'] = (fr, 32, order)
    fr, order = five(build_bacteriolo)
    out['bacteriolo'] = (fr, 32, order)
    fr, order = five(build_gusanillo)
    out['gusanillo'] = (fr, 32, order)

    fr, order = five(build_tapon)
    order.append(('ko', len(fr)))
    fr.append(build_tapon('ko', 0))
    out['tapon'] = (fr, 64, order)

    return out
