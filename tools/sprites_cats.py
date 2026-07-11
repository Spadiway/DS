#!/usr/bin/env python3
"""Sprites de Benito, Silva y Deedee.

Técnica: volúmenes base con elipses sombreadas (2-3 tonos + dither) y
rasgos faciales/detalles colocados a mano píxel a píxel; contorno oscuro
automático al final. Animación por composición de partes con offsets,
más squash & stretch en saltos y golpes.
"""

from pixelkit import Canvas, from_ascii


# ---------------------------------------------------------------------------
# Piezas faciales de gato (ASCII a mano)
# ---------------------------------------------------------------------------

# Ojo grande frontal de Benito (5x7), estilo saltón BIS
EYE_BIG = """
.www.
wwEww
wekew
wekew
weeew
.EEE.
"""
# versión feliz (^ ^)
EYE_HAPPY = """
.....
.kkk.
kk.kk
.....
.....
"""
# ojo dolorido (>_<)
EYE_HURT = """
kk.kk
.kkk.
kk.kk
.....
"""
# Ojo almendrado de Silva (5x6)
EYE_SLIM = """
.kkk.
wAaew
wakaw
.aaa.
.kkk.
"""
EYE_SLIM_L = """
kkk..
wAaw.
wakw.
.aa..
.kk..
"""

# Hocico blanco con nariz rosa y boquita :3 (11x6)
MUZZLE = """
....ppp....
...bpPpb...
.bbbbkbbbb.
.bbkbbbkbb.
..bbkkkbb..
"""
MUZZLE_OPEN = """
....ppp....
...bpPpb...
.bbbbkbbbb.
.bbkkkkkbb.
..bkrrrkb..
...kkkkk...
"""

# oreja (7x6): triángulo con interior rosa; se refleja para la derecha
EAR = """
kk.....
kSk....
kpSk...
kppSk..
kpppCk.
kSCCCk.
"""


def _mk(art):
    return from_ascii(art)


def _cat_head(c, cx, cy, slim=False, facing='down', expr='normal',
              eye='e'):
    """Dibuja la cabeza de un gato centrada en (cx, cy)."""
    rx, ry = (9, 7) if not slim else (8, 6)
    fur = ('C', 'c', 's')

    # orejas primero (quedan detrás del cráneo)
    ear = _mk(EAR)
    if facing == 'down' or facing == 'up':
        c.blit(ear, cx - rx - 1, cy - ry - 4)
        c.blit(ear, cx + rx - 6, cy - ry - 4, mirror=True)
    elif facing == 'side':
        c.blit(ear, cx - rx + 1, cy - ry - 4)
        c.blit(ear, cx + rx - 8, cy - ry - 4, mirror=True)

    # cráneo
    c.ellipse_shaded(cx, cy, rx, ry, fur[0], fur[1], fur[2])

    # rayas del pelaje en lo alto de la cabeza
    if facing != 'up':
        c.hline(cx - 1, cx + 1, cy - ry + 1, 'S')
        c.hline(cx - 3, cx - 2, cy - ry + 2, 'S')
        c.hline(cx + 2, cx + 3, cy - ry + 2, 'S')
    else:
        # nuca: más rayas visibles
        for i, (dx0, dx1, dy) in enumerate([(-1, 1, 1), (-4, -2, 2),
                                            (2, 4, 2), (-1, 1, 3)]):
            c.hline(cx + dx0, cx + dx1, cy - ry + dy, 'S')
        c.hline(cx - 2, cx + 2, cy - 1, 'S')

    if facing == 'up':
        return

    # cara
    if facing == 'down':
        if expr == 'normal' or expr == 'talk':
            e = _mk(EYE_BIG if not slim else EYE_SLIM)
            c.blit(e, cx - 7, cy - 4)
            c.blit(e, cx + 3, cy - 4, mirror=True)
        elif expr == 'happy':
            e = _mk(EYE_HAPPY)
            c.blit(e, cx - 7, cy - 3)
            c.blit(e, cx + 3, cy - 3, mirror=True)
        elif expr == 'hurt':
            e = _mk(EYE_HURT)
            c.blit(e, cx - 7, cy - 3)
            c.blit(e, cx + 3, cy - 3, mirror=True)
        muz = _mk(MUZZLE if expr != 'talk' else MUZZLE_OPEN)
        c.blit(muz, cx - 5, cy + 1)
        # bigotes
        for wy in (cy + 2, cy + 4):
            c.hline(cx - rx - 2, cx - rx, wy, 'K')
            c.hline(cx + rx, cx + rx + 2, wy, 'K')
    elif facing == 'side':
        # perfil mirando a la izquierda
        if expr == 'hurt':
            e = _mk(EYE_HURT)
            c.blit(e, cx - 6, cy - 3)
        elif expr == 'happy':
            e = _mk(EYE_HAPPY)
            c.blit(e, cx - 6, cy - 3)
        else:
            e = _mk(EYE_BIG if not slim else EYE_SLIM_L)
            c.blit(e, cx - 6, cy - 4)
        # hocico lateral
        c.rect(cx - rx - 1, cy + 1, 4, 3, 'b')
        c.set(cx - rx - 1, cy + 1, 'p')
        c.set(cx - rx, cy + 1, 'p')
        c.hline(cx - rx - 1, cx - rx + 1, cy + 4, 'k')
        for wy in (cy + 2, cy + 4):
            c.hline(cx - rx - 4, cx - rx - 3, wy, 'K')


def _cat_tail(c, x, y, phase=0, slim=False):
    """Cola con curva; phase mueve la punta."""
    pts = [(0, 0), (2, -1), (4, -3), (5, -5), (4 + phase, -8),
           (2 + phase * 2, -10)]
    prev = None
    for (dx, dy) in pts:
        if prev is not None:
            c.line(x + prev[0], y + prev[1], x + dx, y + dy, 'C')
            c.line(x + prev[0] + 1, y + prev[1], x + dx + 1, y + dy, 'C')
        prev = (dx, dy)
    # punta oscura
    c.set(x + pts[-1][0], y + pts[-1][1], 'S')
    c.set(x + pts[-1][0] + 1, y + pts[-1][1], 'S')
    c.set(x + pts[-1][0], y + pts[-1][1] + 1, 'S')


def build_cat_frame(slim=False, facing='down', pose='idle', step=0,
                    expr='normal'):
    """Un frame de gato 32x32. pose: idle/walk/jump/fall/attack_jump/
    attack_claw/hurt/ko/victory/defend. step: fase de animación."""
    c = Canvas(32, 32)
    cx = 16
    fat_rx, fat_ry = (7, 6) if not slim else (5, 5)
    head_cy = 11 if not slim else 10
    body_cy = 23 if not slim else 22

    bob = 0
    leg_a = 0
    leg_b = 0
    if pose == 'idle':
        bob = 1 if step % 2 == 1 else 0
    elif pose == 'walk':
        seq = [(0, 0, -2), (1, -2, 0), (0, 0, -2), (1, -2, 0)]
        # (bob, pata_izda, pata_dcha) alternando
        bob = (0, 1, 0, 1)[step % 4]
        leg_a = (0, -2, 0, 2)[step % 4]
        leg_b = (0, 2, 0, -2)[step % 4]
        _ = seq

    if pose in ('jump', 'fall'):
        # estirado en el aire (stretch)
        body = Canvas(32, 32)
        body.ellipse_shaded(cx, body_cy - 6, fat_rx - 1, fat_ry + 2,
                            'C', 'c', 's')
        body.rect(cx - 2, body_cy - 6, 5, fat_ry + 1, 'b')
        c.blit(body, 0, 0)
        _cat_tail(c, cx + fat_rx - 2, body_cy - 4,
                  phase=-1 if pose == 'jump' else 1, slim=slim)
        # patas recogidas / extendidas
        dy = -2 if pose == 'jump' else 1
        c.rect(cx - 5, body_cy + dy, 3, 3, 'C')
        c.rect(cx + 2, body_cy + dy, 3, 3, 'C')
        _cat_head(c, cx, head_cy - 3 if pose == 'jump' else head_cy - 1,
                  slim=slim, facing=facing,
                  expr='happy' if pose == 'jump' else 'normal')
        c.outline('k')
        return c

    if pose == 'ko':
        # tumbado, ojos X
        c.ellipse_shaded(cx, 26, fat_ry + 3, fat_rx - 2, 'C', 'c', 's')
        _cat_head(c, cx - 6, 22, slim=slim, facing='down', expr='hurt')
        c.outline('k')
        return c

    if pose == 'attack_claw':
        # zarpazo: inclinado adelante, arco de garras
        c.ellipse_shaded(cx + 2, body_cy, fat_rx + 1, fat_ry - 1,
                         'C', 'c', 's')
        _cat_tail(c, cx + fat_rx + 1, body_cy - 2, phase=1, slim=slim)
        c.rect(cx - 1, body_cy + 4, 3, 4, 'C')
        c.rect(cx + 4, body_cy + 4, 3, 4, 'C')
        _cat_head(c, cx - 2, head_cy + 2, slim=slim, facing='side',
                  expr='normal')
        if step == 1:
            # arco de garras
            for i, (dx, dy) in enumerate([(-13, 2), (-14, 5), (-13, 8),
                                          (-11, 11)]):
                c.set(cx + dx, head_cy + dy, 'w')
                c.set(cx + dx + 1, head_cy + dy + 1, 'w')
                c.set(cx + dx + 2, head_cy + dy + 1, 'l')
            # pata extendida
            c.rect(cx - 10, head_cy + 6, 5, 3, 'C')
            c.rect(cx - 11, head_cy + 6, 2, 3, 'b')
        c.outline('k')
        return c

    if pose == 'victory':
        c.ellipse_shaded(cx, body_cy, fat_rx, fat_ry, 'C', 'c', 's')
        c.rect(cx - 2, body_cy - 2, 5, fat_ry + 1, 'b')
        _cat_tail(c, cx + fat_rx - 1, body_cy - 2, phase=step, slim=slim)
        c.rect(cx - 5, body_cy + 4, 3, 4, 'C')
        c.rect(cx + 3, body_cy + 4, 3, 4, 'C')
        # pata alzada
        if step == 0:
            c.rect(cx + 6, body_cy - 8, 3, 6, 'C')
            c.rect(cx + 6, body_cy - 9, 3, 2, 'b')
        else:
            c.rect(cx + 7, body_cy - 10, 3, 8, 'C')
            c.rect(cx + 7, body_cy - 11, 3, 2, 'b')
        _cat_head(c, cx - 1, head_cy, slim=slim, facing='down',
                  expr='happy')
        c.outline('k')
        return c

    if pose == 'hurt':
        c.ellipse_shaded(cx + 1, body_cy + 1, fat_rx + 1, fat_ry - 1,
                         'C', 'c', 's')
        _cat_tail(c, cx + fat_rx, body_cy - 3, phase=-2, slim=slim)
        c.rect(cx - 4, body_cy + 3, 3, 4, 'C')
        c.rect(cx + 3, body_cy + 3, 3, 4, 'C')
        _cat_head(c, cx - 1, head_cy + 2, slim=slim, facing='down',
                  expr='hurt')
        c.outline('k')
        return c

    if pose == 'defend':
        # agachado, orejas gachas
        c.ellipse_shaded(cx, body_cy + 2, fat_rx + 1, fat_ry - 1,
                         'C', 'c', 's')
        _cat_head(c, cx, head_cy + 4, slim=slim, facing='down',
                  expr='normal')
        c.outline('k')
        return c

    # ---- idle / walk ----
    # cuerpo
    body_y = body_cy + bob
    if facing == 'side':
        c.ellipse_shaded(cx, body_y, fat_rx + 1, fat_ry, 'C', 'c', 's')
        _cat_tail(c, cx + fat_rx, body_y - 3,
                  phase=(1 if step % 2 else 0), slim=slim)
        # patas (lado): dos visibles
        c.rect(cx - 4 + leg_a // 2, body_y + fat_ry - 2, 3, 4, 'C')
        c.rect(cx + 2 + leg_b // 2, body_y + fat_ry - 2, 3, 4, 'C')
        # barriga
        c.rect(cx - 3, body_y + 1, 6, fat_ry - 2, 'b')
    else:
        c.ellipse_shaded(cx, body_y, fat_rx, fat_ry, 'C', 'c', 's')
        if facing == 'down':
            c.rect(cx - 2, body_y - 2, 5, fat_ry + 2, 'b')
            c.set(cx - 3, body_y, 'b')
            c.set(cx + 3, body_y, 'b')
        else:
            # rayas de la espalda
            c.hline(cx - 1, cx + 1, body_y - 2, 'S')
            c.hline(cx - 2, cx + 2, body_y, 'S')
            _cat_tail(c, cx + 2, body_y + 2,
                      phase=(1 if step % 2 else 0), slim=slim)
        # patas frontal/espalda
        c.rect(cx - 5, body_y + fat_ry - 2 + leg_a // 2, 3, 4, 'C')
        c.rect(cx + 3, body_y + fat_ry - 2 + leg_b // 2, 3, 4, 'C')

    head_y = head_cy + (bob if pose == 'walk' else 0)
    _cat_head(c, cx, head_y, slim=slim, facing=facing, expr=expr)
    c.outline('k')
    return c


# ---------------------------------------------------------------------------
# Deedee, el chihuahua (frames 64x64, dibujado ~52px)
# ---------------------------------------------------------------------------

# Ojo saltón de Deedee (7x8), redondo y expresivo
DD_EYE = """
..www..
.wwwww.
wwwkkww
wwkkkkw
wwkkkkw
.wwkkw.
..www..
"""

# Oreja de chihuahua (12x14), grande y abierta, interior rosa
DD_EAR = """
.T..........
.TT.........
.TTT........
.TTTT.......
.TpTTT......
.TppTTT.....
.TpppTTT....
.TppppTTT...
.TpppppTTT..
.TTppppTTTT.
..TTppTTTT..
...TTTTTT...
....TTTT....
"""


def build_deedee_frame(pose='idle', step=0):
    """Deedee de perfil (mirando a la izquierda), lengua SIEMPRE fuera.
    Cabeza enorme superpuesta al cuerpo, ojos saltones, orejas radar."""
    c = Canvas(64, 64)

    bob = 1 if (pose in ('idle', 'walk') and step % 2 == 1) else 0
    if pose == 'happy':
        bob = -3 if step % 2 else 0

    cx, cy = 38, 42 + bob    # centro del cuerpo
    hx, hy = 24, 30 + bob    # centro de la cabeza
    if pose == 'pounce':
        cy += 2
        hy += 5
        hx -= 3

    # cola en espiral (detrás)
    for i, (dx, dy) in enumerate([(12, -4), (14, -7), (14, -10),
                                  (11, -12), (8, -10), (9, -7)]):
        c.rect(cx + dx, cy + dy, 3, 3, 'T' if i % 2 == 0 else 't')
        c.set(cx + dx + 1, cy + dy + 1, 'u')

    # patas traseras (detrás del cuerpo)
    walk = pose == 'walk'
    lift_a = 2 if (walk and step % 2 == 0) else 0
    lift_b = 2 if (walk and step % 2 == 1) else 0
    if pose == 'pounce':
        lift_a, lift_b = 0, 0
    c.rect(cx + 6, cy + 6 - lift_b, 5, 12 + lift_b, 'u')

    # cuerpo rechoncho
    c.ellipse_shaded(cx, cy, 14, 10, 'T', 't', 'u')
    # pecho claro
    c.ellipse(cx - 8, cy + 3, 5, 5, 't')

    # patas delanteras y trasera visible
    c.rect(cx - 12, cy + 5 - lift_a, 5, 13 + lift_a, 'T')
    c.rect(cx - 4, cy + 6 - lift_b, 5, 12 + lift_b, 'T')
    c.rect(cx + 8, cy + 6 - lift_a, 5, 12 + lift_a, 'T')
    for lx in (cx - 12, cx - 4, cx + 8):
        c.rect(lx, cy + 16, 5, 2, 'u')

    # ---- cabeza enorme ----
    ear = _mk(DD_EAR)
    c.blit(ear, hx - 15, hy - 24)                 # oreja izquierda
    c.blit(ear, hx + 3, hy - 24, mirror=True)     # oreja derecha
    c.ellipse_shaded(hx, hy - 6, 12, 11, 'T', 't', 'u')

    # hocico corto
    mzx, mzy = hx - 11, hy - 1
    c.ellipse_shaded(mzx, mzy, 6, 4, 't', 't', 'u')
    c.rect(mzx - 6, mzy - 3, 4, 3, 'k')           # nariz negra
    c.set(mzx - 5, mzy - 3, 'g')                  # brillo nariz
    c.hline(mzx - 3, mzx + 2, mzy + 1, 'K')       # línea de la boca

    # LENGUA SIEMPRE FUERA (rasgo central del personaje)
    lick = pose == 'lick'
    tlen = 12 if (lick and step == 1) else 8
    tx0 = mzx - 4
    for i in range(tlen):
        w = 5 if i < tlen - 2 else 3
        col = 'r' if i < 2 else 'R'
        c.rect(tx0 + (5 - w) // 2, mzy + 2 + i, w, 1, col)
    c.vline(tx0 + 2, mzy + 3, mzy + tlen - 1, 'q')  # surco central
    if lick and step == 1:
        # estela del lengüetazo
        for dx, dy in ((-20, -10), (-23, -4), (-22, 3), (-18, 9)):
            c.set(hx + dx, hy + dy, 'r')
            c.set(hx + dx + 1, hy + dy, 'w')
            c.set(hx + dx, hy + dy + 1, 'w')

    # ojos saltones ENORMES
    if pose == 'hurt':
        e = _mk(EYE_HURT)
        c.blit(e, hx - 9, hy - 12)
        c.blit(e, hx + 3, hy - 12, mirror=True)
    elif pose == 'happy':
        e = _mk(EYE_HAPPY)
        c.blit(e, hx - 9, hy - 12)
        c.blit(e, hx + 3, hy - 12, mirror=True)
    else:
        e = _mk(DD_EYE)
        c.blit(e, hx - 11, hy - 14)
        c.blit(e, hx + 2, hy - 14)
        c.set(hx - 9, hy - 12, 'w')   # brillo
        c.set(hx + 4, hy - 12, 'w')
        # cejas expresivas
        c.hline(hx - 10, hx - 6, hy - 17, 'u')
        c.hline(hx + 3, hx + 7, hy - 17, 'u')

    c.outline('k')
    return c


def build_all():
    """Devuelve dict: nombre_hoja -> (lista de frames, tamaño)."""
    out = {}

    for who, slim in (('benito', False), ('silva', True)):
        frames = []
        order = []

        def add(name, fr):
            order.append((name, len(frames)))
            frames.append(fr)

        for st in (0, 1):
            add(f'idle_down{st}', build_cat_frame(slim, 'down', 'idle', st))
        for st in (0, 1):
            add(f'idle_up{st}', build_cat_frame(slim, 'up', 'idle', st))
        for st in (0, 1):
            add(f'idle_side{st}', build_cat_frame(slim, 'side', 'idle', st))
        for st in range(4):
            add(f'walk_down{st}', build_cat_frame(slim, 'down', 'walk', st))
        for st in range(4):
            add(f'walk_up{st}', build_cat_frame(slim, 'up', 'walk', st))
        for st in range(4):
            add(f'walk_side{st}', build_cat_frame(slim, 'side', 'walk', st))
        add('jump', build_cat_frame(slim, 'side', 'jump'))
        add('fall', build_cat_frame(slim, 'side', 'fall'))
        add('atk_claw0', build_cat_frame(slim, 'side', 'attack_claw', 0))
        add('atk_claw1', build_cat_frame(slim, 'side', 'attack_claw', 1))
        add('hurt', build_cat_frame(slim, 'side', 'hurt'))
        add('ko', build_cat_frame(slim, 'side', 'ko'))
        add('victory0', build_cat_frame(slim, 'side', 'victory', 0))
        add('victory1', build_cat_frame(slim, 'side', 'victory', 1))
        add('defend', build_cat_frame(slim, 'side', 'defend'))
        add('talk', build_cat_frame(slim, 'down', 'idle', 0, expr='talk'))
        out[who] = (frames, 32, order)

    dd = []
    dd_order = []

    def addd(name, fr):
        dd_order.append((name, len(dd)))
        dd.append(fr)

    for st in (0, 1):
        addd(f'idle{st}', build_deedee_frame('idle', st))
    for st in (0, 1):
        addd(f'walk{st}', build_deedee_frame('walk', st))
    for st in (0, 1):
        addd(f'lick{st}', build_deedee_frame('lick', st))
    addd('pounce', build_deedee_frame('pounce'))
    addd('hurt', build_deedee_frame('hurt'))
    for st in (0, 1):
        addd(f'happy{st}', build_deedee_frame('happy', st))
    out['deedee'] = (dd, 64, dd_order)

    return out
