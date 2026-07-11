#!/usr/bin/env python3
"""pixelkit — kit de dibujo pixel art para Benito & Silva.

Toda la gráfica del juego comparte una PALETA MAESTRA de 256 colores
(la DS con sprites/fondos de 8bpp usa una sola paleta de 256 entradas).
Cada carácter de los grids ASCII referencia un color de la paleta.

El índice 0 es SIEMPRE transparente.
"""

from PIL import Image

# ---------------------------------------------------------------------------
# PALETA MAESTRA
# key: carácter usado en grids ASCII  ->  (r, g, b)
# El orden de esta lista define el índice de paleta (empezando en 1).
# ---------------------------------------------------------------------------

_PALETTE_DEF = [
    # -- contornos y neutros --
    ('k', (24, 16, 32)),      # contorno oscuro universal
    ('K', (58, 42, 74)),      # sombra suave violácea
    ('w', (248, 248, 248)),   # blanco
    ('W', (224, 222, 216)),   # blanco roto
    ('l', (188, 188, 196)),   # gris claro
    ('g', (140, 140, 152)),   # gris medio
    ('d', (96, 94, 110)),     # gris oscuro
    # -- gatos (Benito y Silva) --
    ('c', (198, 202, 214)),   # pelaje luz
    ('C', (160, 164, 180)),   # pelaje base
    ('s', (110, 114, 134)),   # raya / sombra pelaje
    ('S', (78, 80, 100)),     # raya oscura
    ('b', (242, 242, 238)),   # barriga blanca
    ('B', (206, 206, 202)),   # barriga sombra
    ('p', (234, 148, 168)),   # rosa nariz/orejas
    ('P', (190, 100, 126)),   # rosa oscuro
    ('e', (122, 202, 82)),    # ojo verde (Benito)
    ('E', (70, 150, 50)),     # ojo verde oscuro
    ('a', (242, 182, 66)),    # ojo ámbar (Silva)
    ('A', (198, 130, 34)),    # ámbar oscuro
    # -- Deedee --
    ('t', (240, 198, 142)),   # canela luz
    ('T', (218, 162, 98)),    # canela base
    ('u', (178, 118, 66)),    # canela sombra
    ('U', (130, 80, 46)),     # canela oscuro
    # -- lengua / rojos --
    ('r', (246, 122, 130)),   # lengua luz
    ('R', (218, 74, 94)),     # lengua base
    ('q', (166, 42, 68)),     # lengua sombra / rojo capa
    # -- Terelu (mosca) --
    ('i', (122, 230, 214)),   # iridiscente teal luz
    ('I', (58, 182, 174)),    # iridiscente teal
    ('j', (150, 106, 214)),   # iridiscente violeta
    ('J', (98, 62, 154)),     # iridiscente violeta osc.
    ('z', (94, 128, 100)),    # cuerpo mosca verde
    ('Z', (56, 80, 66)),      # cuerpo mosca oscuro
    ('y', (198, 226, 242)),   # ala pálida
    ('Y', (152, 184, 210)),   # ala sombra
    # -- abejorros --
    ('h', (252, 218, 98)),    # miel luz
    ('H', (242, 178, 50)),    # miel base
    ('o', (122, 82, 42)),     # marrón abeja
    ('O', (82, 54, 30)),      # marrón abeja oscuro
    # -- jardín --
    ('1', (142, 210, 86)),    # hierba luz
    ('2', (106, 182, 62)),    # hierba base
    ('3', (74, 146, 50)),     # hierba sombra
    ('4', (46, 110, 46)),     # follaje oscuro
    ('5', (218, 178, 122)),   # tierra luz
    ('6', (186, 142, 90)),    # tierra base
    ('7', (146, 106, 62)),    # tierra sombra
    ('8', (198, 146, 86)),    # madera luz
    ('9', (162, 110, 58)),    # madera base
    ('0', (118, 74, 38)),     # madera oscura
    ('f', (234, 82, 74)),     # flor roja
    ('F', (250, 210, 74)),    # flor amarilla
    ('m', (190, 114, 222)),   # flor morada
    ('v', (142, 210, 234)),   # agua luz
    ('V', (86, 162, 218)),    # agua base
    ('x', (50, 114, 186)),    # agua profunda
    ('X', (170, 222, 250)),   # cielo claro
    ('n', (178, 178, 170)),   # piedra luz
    ('N', (138, 138, 130)),   # piedra base
    ('Q', (98, 98, 94)),      # piedra oscura
    # -- interior de Deedee --
    ('D', (250, 170, 170)),   # carne luz
    ('G', (226, 122, 134)),   # carne base
    ('L', (182, 78, 106)),    # carne profunda
    ('%', (130, 50, 86)),     # carne oscurísima
    ('&', (202, 142, 218)),   # membrana violeta luz
    ('@', (154, 94, 182)),    # membrana violeta
    ('$', (106, 58, 138)),    # membrana profunda
    ('!', (202, 242, 98)),    # ácido luz
    ('=', (154, 210, 58)),    # ácido base
    ('?', (106, 162, 42)),    # ácido profundo
    # -- interfaz --
    ('#', (252, 242, 210)),   # crema UI
    ('*', (250, 202, 66)),    # dorado
    ('+', (194, 142, 34)),    # dorado oscuro
    ('-', (74, 98, 170)),     # azul UI
    ('_', (42, 58, 114)),     # azul UI oscuro
    ('~', (98, 226, 98)),     # barra PV verde
    ('^', (234, 66, 66)),     # rojo daño / barra baja
    (':', (98, 162, 250)),    # azul PE
    (';', (255, 150, 40)),    # naranja aviso/chispa
]

# char -> índice de paleta
IDX = {'.': 0, ' ': 0}
PALETTE = [(255, 0, 255)]  # índice 0: transparente (magenta de control)
for _ch, _rgb in _PALETTE_DEF:
    IDX[_ch] = len(PALETTE)
    PALETTE.append(_rgb)

# relleno hasta 256
while len(PALETTE) < 256:
    PALETTE.append((0, 0, 0))

# índices útiles exportados
I_TRANSP = 0
I_OUTLINE = IDX['k']


def rgb_of(ch):
    return PALETTE[IDX[ch]]


# ---------------------------------------------------------------------------
# Canvas: rejilla de índices de paleta
# ---------------------------------------------------------------------------

class Canvas:
    def __init__(self, w, h, fill='.'):
        self.w = w
        self.h = h
        self.px = [[IDX[fill]] * w for _ in range(h)]

    # -- acceso básico --
    def set(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = IDX[ch] if isinstance(ch, str) else ch

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return 0

    def copy(self):
        c = Canvas(self.w, self.h)
        c.px = [row[:] for row in self.px]
        return c

    # -- primitivas --
    def rect(self, x0, y0, w, h, ch):
        i = IDX[ch] if isinstance(ch, str) else ch
        for y in range(max(0, y0), min(self.h, y0 + h)):
            for x in range(max(0, x0), min(self.w, x0 + w)):
                self.px[y][x] = i

    def hline(self, x0, x1, y, ch):
        for x in range(x0, x1 + 1):
            self.set(x, y, ch)

    def vline(self, x, y0, y1, ch):
        for y in range(y0, y1 + 1):
            self.set(x, y, ch)

    def line(self, x0, y0, x1, y1, ch):
        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.set(x0, y0, ch)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def ellipse(self, cx, cy, rx, ry, ch):
        """Elipse rellena (centro flotante permitido)."""
        i = IDX[ch] if isinstance(ch, str) else ch
        for y in range(self.h):
            for x in range(self.w):
                nx = (x - cx) / max(rx, 0.001)
                ny = (y - cy) / max(ry, 0.001)
                if nx * nx + ny * ny <= 1.0:
                    self.px[y][x] = i

    def ellipse_shaded(self, cx, cy, rx, ry, base, light, shade,
                       lx=-0.4, ly=-0.55, dither=True):
        """Elipse con volumen: luz arriba-izda, sombra abajo-dcha,
        con banda de dither entre zonas (estilo era DS)."""
        ib, il, ish = IDX[base], IDX[light], IDX[shade]
        for y in range(self.h):
            for x in range(self.w):
                nx = (x - cx) / max(rx, 0.001)
                ny = (y - cy) / max(ry, 0.001)
                d2 = nx * nx + ny * ny
                if d2 > 1.0:
                    continue
                # producto escalar con la dirección de la luz
                lum = -(nx * lx + ny * ly) * 0.5 + (1.0 - d2) * 0.55
                if lum > 0.52:
                    self.px[y][x] = il
                elif lum > 0.44 and dither and (x + y) % 2 == 0:
                    self.px[y][x] = il
                elif lum < 0.12:
                    self.px[y][x] = ish
                elif lum < 0.2 and dither and (x + y) % 2 == 0:
                    self.px[y][x] = ish
                else:
                    self.px[y][x] = ib

    def outline(self, ch='k', over=False):
        """Contorno de 1px alrededor de todo píxel no transparente.
        over=True: pinta el contorno ENCIMA del borde del cuerpo;
        over=False: lo pinta en los píxeles transparentes vecinos."""
        i = IDX[ch]
        if over:
            marks = []
            for y in range(self.h):
                for x in range(self.w):
                    if self.px[y][x] == 0:
                        continue
                    edge = False
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        if self.get(x + dx, y + dy) == 0:
                            edge = True
                    if edge:
                        marks.append((x, y))
            for x, y in marks:
                self.px[y][x] = i
        else:
            marks = []
            for y in range(self.h):
                for x in range(self.w):
                    if self.px[y][x] != 0:
                        continue
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        n = self.get(x + dx, y + dy)
                        if n != 0 and n != i:
                            marks.append((x, y))
                            break
            for x, y in marks:
                self.px[y][x] = i

    # -- composición --
    def blit(self, src, ox, oy, mirror=False, flip=False):
        for y in range(src.h):
            for x in range(src.w):
                sx = src.w - 1 - x if mirror else x
                sy = src.h - 1 - y if flip else y
                v = src.px[sy][sx]
                if v != 0:
                    self.set(ox + x, oy + y, v)

    def stamp_ascii(self, art, ox=0, oy=0):
        """Pinta un grid ASCII multilinea en (ox, oy)."""
        lines = [ln for ln in art.split('\n') if ln.strip('\n') != '']
        # quitar líneas totalmente vacías al principio/fin
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        for y, ln in enumerate(lines):
            for x, ch in enumerate(ln):
                if ch not in ('.', ' '):
                    self.set(ox + x, oy + y, ch)

    def scaled(self, nw, nh):
        """Escala vecino-más-próximo (para squash & stretch)."""
        c = Canvas(nw, nh)
        for y in range(nh):
            for x in range(nw):
                c.px[y][x] = self.px[y * self.h // nh][x * self.w // nw]
        return c

    def shifted_rows(self, offsets):
        """Desplaza cada fila y píxeles (para ondular colas, etc.)."""
        c = Canvas(self.w, self.h)
        for y in range(self.h):
            off = offsets[y % len(offsets)]
            for x in range(self.w):
                v = self.px[y][x]
                if v != 0:
                    c.set(x + off, y, v)
        return c


def from_ascii(art):
    lines = [ln for ln in art.split('\n')]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    w = max(len(ln) for ln in lines)
    c = Canvas(w, len(lines))
    c.stamp_ascii('\n'.join(lines))
    return c


# ---------------------------------------------------------------------------
# Exportación PNG indexado con la paleta maestra
# ---------------------------------------------------------------------------

def _flat_palette():
    flat = []
    for (r, g, b) in PALETTE:
        flat += [r, g, b]
    return flat


def save_png(path, canvas):
    img = Image.new('P', (canvas.w, canvas.h))
    img.putpalette(_flat_palette())
    img.putdata([v for row in canvas.px for v in row])
    img.save(path, optimize=False)


def save_sheet(path, frames, fw=None, fh=None):
    """Guarda una lista de Canvas como tira horizontal."""
    fw = fw or frames[0].w
    fh = fh or frames[0].h
    sheet = Canvas(fw * len(frames), fh)
    for i, f in enumerate(frames):
        sheet.blit(f, i * fw, 0)
    save_png(path, sheet)


def save_master_palette(path):
    """PNG 16x16 con los 256 colores en orden (para exportar la paleta)."""
    c = Canvas(16, 16)
    for i in range(256):
        c.px[i // 16][i % 16] = i
    save_png(path, c)
