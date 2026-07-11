#!/usr/bin/env python3
"""Escenas a pantalla completa (256x192): panorámicas de la pantalla
superior, fondos de combate y título. Compuestas con la paleta maestra
y reutilizando los constructores de sprites (los personajes aparecen
en las escenas)."""

from pixelkit import Canvas
from gen_tiles import _noise
import sprites_cats
import sprites_npcs

W, H = 256, 192


def _sky(c, horizon, dark=False):
    cols = ('x', 'V', 'v', 'X') if not dark else ('$', '@', '&', '&')
    for y in range(horizon):
        t = y * 4 // max(horizon, 1)
        c.hline(0, W - 1, y, cols[min(t, 3)])
        # dither entre bandas
        if t < 3:
            nxt = cols[min(t + 1, 3)]
            for x in range(0, W, 2):
                if _noise(x, y, 1) % 3 == 0:
                    c.set(x, y, nxt)


def _sun(c, x, y):
    c.ellipse(x, y, 11, 11, 'F')
    c.ellipse(x - 2, y - 2, 7, 7, '#')
    for i, (dx, dy) in enumerate(((14, 0), (-14, 0), (0, 14), (0, -14),
                                  (10, 10), (-10, 10), (10, -10),
                                  (-10, -10))):
        c.line(x + dx, y + dy, x + dx * 5 // 4, y + dy * 5 // 4, 'F')


def _cloud(c, x, y, s):
    c.ellipse(x, y, 10 * s // 2, 4 * s // 2, 'w')
    c.ellipse(x - 6 * s // 2, y + 2, 6 * s // 2, 3 * s // 2, 'w')
    c.ellipse(x + 7 * s // 2, y + 2, 7 * s // 2, 3 * s // 2, 'W')


def _grass_field(c, y0, y1):
    for y in range(y0, y1):
        t = (y - y0) * 3 // max(y1 - y0, 1)
        col = ('1', '2', '3')[min(t, 2)]
        c.hline(0, W - 1, y, col)
    for i in range(260):
        x = _noise(i, 0, 2) % W
        y = y0 + _noise(i, 1, 2) % max(y1 - y0, 1)
        c.set(x, y, ('2', '3', '1')[_noise(x, y, 3) % 3])


def _flowers_row(c, y, n, salt):
    for i in range(n):
        x = 8 + (_noise(i, salt, 4) % (W - 16))
        col = ('f', 'F', 'm', 'w')[_noise(i, salt, 5) % 4]
        c.set(x, y - 1, col)
        c.set(x - 1, y, col)
        c.set(x + 1, y, col)
        c.set(x, y + 1, col)
        c.set(x, y, 'F' if col != 'F' else ';')
        c.vline(x, y + 2, y + 4, '3')


def _fence_row(c, y):
    c.rect(0, y + 3, W, 3, '9')
    c.hline(0, W - 1, y + 3, '8')
    c.rect(0, y + 9, W, 2, '9')
    for x in range(4, W, 20):
        c.rect(x, y, 4, 14, '9')
        c.vline(x, y, y + 13, '8')
        c.vline(x + 3, y + 1, y + 13, '0')
        c.hline(x, x + 3, y, '8')


def scene_jardin():
    """Panorámica del jardín en paz (intro / pantalla superior)."""
    c = Canvas(W, H)
    _sky(c, 96)
    _sun(c, 218, 30)
    _cloud(c, 60, 30, 2)
    _cloud(c, 150, 18, 1)
    _cloud(c, 110, 52, 1)
    # seto al fondo
    for y in range(84, 100):
        c.hline(0, W - 1, y, '4')
    for i in range(160):
        x = _noise(i, 0, 6) % W
        y = 84 + _noise(i, 1, 6) % 16
        c.set(x, y, ('3', '2')[_noise(x, y, 7) % 2])
    for x in range(0, W, 7):
        c.set(x, 84, '2')
        c.set(x + 3, 85, '3')
    _grass_field(c, 100, H)
    _fence_row(c, 104)
    _flowers_row(c, 140, 18, 8)
    _flowers_row(c, 165, 14, 9)
    # casita de Deedee a la derecha
    from gen_tiles import prop_doghouse
    c.blit(prop_doghouse(), 186, 118)
    # Deedee dormitando delante
    dd = sprites_cats.build_deedee_frame('idle', 0)
    c.blit(dd, 130, 120)
    # abejorros volando
    bee = sprites_npcs.build_bee_frame(0)
    c.blit(bee, 30, 58)
    bee2 = sprites_npcs.build_bee_frame(1)
    c.blit(bee2, 70, 72)
    return c


def scene_caos():
    """El jardín arrasado por los lametones compulsivos."""
    c = Canvas(W, H)
    _sky(c, 96, dark=False)
    # nubes de tormenta
    _cloud(c, 60, 26, 2)
    c.ellipse(60, 26, 16, 6, 'g')
    _cloud(c, 180, 40, 2)
    c.ellipse(180, 40, 16, 6, 'g')
    for y in range(84, 100):
        c.hline(0, W - 1, y, '4')
    _grass_field(c, 100, H)
    # regueros de babas por todas partes
    for i in range(7):
        x0 = _noise(i, 0, 11) % W
        y0 = 104 + _noise(i, 1, 11) % 70
        for t in range(30):
            x = x0 + t * 3
            y = y0 + ((t * t) % 7) - 3
            if x < W:
                c.set(x, y, 'r' if t % 3 else 'R')
                c.set(x, y + 1, 'R')
    # flores tronchadas
    for i in range(12):
        x = 10 + (_noise(i, 2, 12) % (W - 20))
        y = 120 + _noise(i, 3, 12) % 60
        c.line(x, y, x + 4, y + 3, '3')
        c.set(x + 5, y + 4, 'f')
    # valla rota
    _fence_row(c, 104)
    for x in range(40, 200, 60):
        c.rect(x, 104, 12, 14, '2')          # hueco en la valla
        c.line(x, 112, x + 10, 106, '9')     # tablón caído
        c.line(x + 1, 113, x + 11, 107, '0')
    # Deedee al fondo con lengua desatada
    dd = sprites_cats.build_deedee_frame('lick', 1)
    c.blit(dd, 90, 110)
    # abejorros huyendo
    bee = sprites_npcs.build_bee_frame(0)
    c.blit(bee, 20, 50, mirror=True)
    c.blit(bee, 200, 66)
    return c


def scene_consejo():
    """Sala del consejo: interior de colmena dorada."""
    c = Canvas(W, H)
    # fondo panal
    for y in range(H):
        c.hline(0, W - 1, y, 'H' if y % 3 else '+')
    # celdas hexagonales (rejilla)
    for cy in range(0, H + 16, 14):
        for cx in range(0, W + 16, 16):
            off = 8 if (cy // 14) % 2 else 0
            x, y = cx + off, cy
            for i in range(6):
                pts = [(-5, -2), (0, -5), (5, -2), (5, 3), (0, 6), (-5, 3)]
                x0, y0 = pts[i]
                x1, y1 = pts[(i + 1) % 6]
                c.line(x + x0, y + y0, x + x1, y + y1, '+')
    # tarima central iluminada
    c.ellipse(128, 150, 90, 26, 'h')
    c.ellipse(128, 148, 80, 22, '#')
    # el gran abejorro anciano en el centro
    elder = sprites_npcs.build_bee_frame(0, elder=True)
    big = elder.scaled(48, 48)
    c.blit(big, 104, 96)
    # abejorros del consejo alrededor
    for i, (x, y) in enumerate(((40, 120), (190, 118), (70, 145),
                                (160, 148))):
        bee = sprites_npcs.build_bee_frame(i % 2)
        c.blit(bee, x, y)
    # velas/faroles
    for x in (20, 236):
        c.rect(x - 2, 40, 4, 10, '9')
        c.ellipse(x, 36, 3, 4, 'F')
        c.set(x, 34, ';')
    return c


def scene_colon():
    """Vista del interior: túnel de carne descendente."""
    c = Canvas(W, H)
    for y in range(H):
        t = min(3, y * 4 // H)
        c.hline(0, W - 1, y, ('%', 'L', 'G', 'G')[t])
    # anillos del túnel en perspectiva
    for i, r in enumerate((110, 85, 62, 44, 30, 20)):
        col = ('L', '%', 'L', '%', 'k', 'k')[i]
        cx, cy = 128 + i * 6, 96 + i * 2
        for a in range(0, 360, 2):
            import math
            x = int(cx + r * math.cos(a * 3.1416 / 180))
            y = int(cy + r * 0.72 * math.sin(a * 3.1416 / 180))
            if 0 <= x < W and 0 <= y < H:
                c.set(x, y, col)
                c.set(x + 1, y, col)
    c.ellipse(158, 106, 16, 11, 'k')
    # pólipos y burbujas
    for i in range(9):
        x = _noise(i, 4, 14) % W
        y = 150 + _noise(i, 5, 14) % 40
        c.ellipse(x, y, 3, 4, '@')
        c.set(x - 1, y - 2, '&')
    # gotitas brillantes
    for i in range(30):
        x = _noise(i, 6, 15) % W
        y = _noise(i, 7, 15) % H
        c.set(x, y, 'D')
    return c


def scene_cerebro():
    """La guarida de Terelu en el cerebro (para más adelante)."""
    c = Canvas(W, H)
    for y in range(H):
        t = min(3, y * 4 // H)
        c.hline(0, W - 1, y, ('$', '@', '$', '%')[t])
    # nubes de neuronas
    for i in range(14):
        x = _noise(i, 8, 16) % W
        y = _noise(i, 9, 16) % H
        c.ellipse(x, y, 4, 3, '&')
        for dx, dy in ((-6, -4), (6, -4), (0, 6), (-7, 3), (7, 3)):
            c.line(x, y, x + dx, y + dy, '@')
        c.set(x, y, 'w')
    # chispas eléctricas
    for i in range(8):
        x = _noise(i, 10, 17) % W
        y = _noise(i, 11, 17) % H
        c.line(x, y, x + 3, y + 4, ':')
        c.line(x + 3, y + 4, x + 1, y + 8, 'v')
    # Terelu reinando en el centro
    t = sprites_npcs.build_terelu_frame('laugh', 0)
    big = t.scaled(64, 64)
    c.blit(big, 96, 60)
    return c


def bg_battle_jardin():
    """Fondo de combate exterior (los sprites van encima)."""
    c = Canvas(W, H)
    _sky(c, 80)
    _sun(c, 224, 24)
    _cloud(c, 70, 30, 2)
    _cloud(c, 170, 46, 1)
    for y in range(72, 88):
        c.hline(0, W - 1, y, '4')
    for x in range(0, W, 6):
        c.set(x, 72, '2')
        c.set(x + 3, 73, '3')
    _grass_field(c, 88, H)
    _fence_row(c, 92)
    _flowers_row(c, 120, 10, 20)
    # línea de suelo del combate despejada (y=120..168)
    return c


def bg_battle_colon():
    c = Canvas(W, H)
    for y in range(H):
        t = min(3, y * 4 // H)
        c.hline(0, W - 1, y, ('%', 'L', 'G', 'D')[t])
    # costillas de fondo
    for x in range(10, W, 42):
        c.rect(x, 0, 8, 110, 'L')
        c.vline(x, 0, 109, 'D')
        c.vline(x + 7, 0, 109, '%')
    # suelo mucoso
    for y in range(120, H):
        c.hline(0, W - 1, y, 'G' if y % 2 else 'L')
    c.hline(0, W - 1, 120, 'D')
    for x in range(0, W, 3):
        if _noise(x, 0, 21) % 4 == 0:
            c.set(x, 120, 'w')
    # charquitos de ácido decorativos
    for x, w in ((30, 22), (180, 30)):
        c.ellipse(x + w // 2, 176, w // 2, 4, '=')
        c.hline(x + 2, x + w - 2, 173, '!')
    return c


def _draw_logo(c, y0):
    """Logo del título con letras grandes."""
    import gen_font
    def draw_text(text, y, scale, col, shadow):
        total = 0
        for ch in text:
            total += 8
        x0 = (W - total * scale) // 2
        for i, ch in enumerate(text):
            rows = gen_font.G.get(ch)
            if rows is None:
                continue
            for yy, row in enumerate(rows):
                for xx, v in enumerate(row):
                    if v == '#':
                        c.rect(x0 + (i * 8 + xx) * scale + scale,
                               y + yy * scale + scale, scale, scale, shadow)
        for i, ch in enumerate(text):
            rows = gen_font.G.get(ch)
            if rows is None:
                continue
            for yy, row in enumerate(rows):
                for xx, v in enumerate(row):
                    if v == '#':
                        c.rect(x0 + (i * 8 + xx) * scale,
                               y + yy * scale, scale, scale, col)
    draw_text('BENITO', y0, 3, '#', '_')
    draw_text('&', y0 + 22, 2, '*', '_')
    draw_text('SILVA', y0 + 40, 3, '#', '_')


def scene_title():
    c = scene_jardin()
    # oscurecer un pelín el centro superior para el logo
    _draw_logo(c, 18)
    # subtítulo
    import gen_font
    sub = 'Dentro de Deedee'
    x0 = (W - len(sub) * 8) // 2
    for i, ch in enumerate(sub):
        rows = gen_font.G.get(ch)
        if rows is None:
            continue
        for yy, row in enumerate(rows):
            for xx, v in enumerate(row):
                if v == '#':
                    c.set(x0 + i * 8 + xx + 1, 101 + yy + 1, 'k')
                    c.set(x0 + i * 8 + xx, 101 + yy, 'w')
    # los gatos en primer plano
    ben = sprites_cats.build_cat_frame(False, 'down', 'idle', 0)
    sil = sprites_cats.build_cat_frame(True, 'down', 'idle', 0)
    c.blit(ben.scaled(48, 48), 52, 138)
    c.blit(sil.scaled(48, 48), 156, 138)
    return c


def scene_status():
    """Fondo de la pantalla superior durante el juego (marco HUD)."""
    c = Canvas(W, H)
    for y in range(H):
        c.hline(0, W - 1, y, '_')
    # marco con cenefa de huellas
    c.rect(2, 2, W - 4, H - 4, '-')
    c.rect(6, 6, W - 12, H - 12, '_')
    for x in range(14, W - 14, 24):
        # huellita
        c.ellipse(x, 11, 3, 2, '-')
        for dx in (-3, 0, 3):
            c.set(x + dx, 7, '-')
        c.ellipse(x, H - 12, 3, 2, '-')
        for dx in (-3, 0, 3):
            c.set(x + dx, H - 16, '-')
    # línea divisoria central
    c.hline(12, W - 13, 96, '-')
    return c


def build_all():
    return {
        'scene_jardin': scene_jardin(),
        'scene_caos': scene_caos(),
        'scene_consejo': scene_consejo(),
        'scene_colon': scene_colon(),
        'scene_cerebro': scene_cerebro(),
        'scene_title': scene_title(),
        'scene_status': scene_status(),
        'bg_battle_jardin': bg_battle_jardin(),
        'bg_battle_colon': bg_battle_colon(),
    }
