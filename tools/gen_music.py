#!/usr/bin/env python3
"""Compositor chiptune: genera módulos ProTracker .mod originales
(4 canales) que maxmod reproduce en la DS.

Temas: jardín, combate, interior, jefe, Terelu, victoria, Deedee.
"""

import math
import struct

# ---------------------------------------------------------------------------
# Tabla de periodos ProTracker (finetune 0), octavas 1-3
# ---------------------------------------------------------------------------

_NOTES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-',
          'A#', 'B-']
_PERIODS = [856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453]

PERIOD = {}
for octv in (1, 2, 3):
    for i, nm in enumerate(_NOTES):
        PERIOD[f'{nm}{octv}'] = _PERIODS[i] >> (octv - 1)


def note_period(name):
    return PERIOD[name]


# ---------------------------------------------------------------------------
# Síntesis de samples (8 bits con signo)
# ---------------------------------------------------------------------------

def _clamp(v):
    return max(-128, min(127, int(v)))


def square(cycle=32, duty=0.5, vol=100):
    return bytes((_clamp(vol if (i / cycle) % 1.0 < duty else -vol) & 0xff)
                 for i in range(cycle))


def triangle(cycle=64, vol=110):
    out = []
    for i in range(cycle):
        t = (i / cycle) % 1.0
        v = 4 * abs(t - 0.5) - 1          # -1..1
        out.append(_clamp(-v * vol) & 0xff)
    return bytes(out)


def saw(cycle=32, vol=90):
    return bytes(_clamp((((i / cycle) % 1.0) * 2 - 1) * vol) & 0xff
                 for i in range(cycle))


def sine(cycle=32, vol=100):
    return bytes(_clamp(math.sin(2 * math.pi * i / cycle) * vol) & 0xff
                 for i in range(cycle))


def buzz(cycle=128, vol=80):
    """Par de sierras desafinadas: el zumbido de Terelu."""
    out = []
    for i in range(cycle):
        a = ((i / 32.0) % 1.0) * 2 - 1
        b = ((i / 33.7) % 1.0) * 2 - 1
        out.append(_clamp((a + b) * 0.5 * vol) & 0xff)
    return bytes(out)


def _rng(seed):
    s = seed

    def nxt():
        nonlocal s
        s = (s * 1103515245 + 12345) & 0x7fffffff
        return (s >> 8) & 0xff

    return nxt


def kick(length=700):
    out = []
    r = _rng(1)
    phase = 0.0
    for i in range(length):
        f = 130.0 * math.exp(-i / 180.0) + 35.0
        phase += 2 * math.pi * f / 8363.0
        env = math.exp(-i / 260.0)
        v = math.sin(phase) * 120 * env
        if i < 30:
            v += (r() - 128) * 0.4 * (1 - i / 30.0)
        out.append(_clamp(v) & 0xff)
    return bytes(out)


def snare(length=600):
    out = []
    r = _rng(2)
    for i in range(length):
        env = math.exp(-i / 150.0)
        tone = math.sin(2 * math.pi * 180 * i / 8363.0) * 40
        v = ((r() - 128) * 0.9 + tone * 0.5) * env
        out.append(_clamp(v) & 0xff)
    return bytes(out)


def hat(length=140):
    out = []
    r = _rng(3)
    prev = 0
    for i in range(length):
        env = math.exp(-i / 45.0)
        n = (r() - 128)
        v = (n - prev) * 0.8 * env       # diferenciado = más brillante
        prev = n
        out.append(_clamp(v) & 0xff)
    return bytes(out)


def pluck(length=500, cycle=32):
    """Cuadrada con caída rápida para arpegios staccato."""
    out = []
    for i in range(length):
        env = math.exp(-i / 160.0)
        v = (100 if (i / cycle) % 1.0 < 0.5 else -100) * env
        out.append(_clamp(v) & 0xff)
    return bytes(out)


# ---------------------------------------------------------------------------
# Escritor de MOD
# ---------------------------------------------------------------------------

class Sample:
    def __init__(self, name, data, volume=48, loop=True):
        self.name = name
        self.data = data
        self.volume = volume
        self.loop = loop


class Pattern:
    def __init__(self):
        # [fila][canal] = (periodo, sample, efecto, parametro)
        self.rows = [[(0, 0, 0, 0)] * 4 for _ in range(64)]

    def put(self, row, ch, note=None, sample=0, fx=0, param=0):
        if row < 0 or row > 63:
            return
        period = note_period(note) if note else 0
        self.rows[row][ch] = (period, sample, fx, param)


class Mod:
    def __init__(self, title, samples):
        self.title = title
        self.samples = samples        # lista de Sample (máx 31)
        self.patterns = []
        self.order = []

    def pattern(self):
        p = Pattern()
        self.patterns.append(p)
        return p

    def write(self, path):
        f = bytearray()
        f += self.title.encode('ascii')[:20].ljust(20, b'\0')
        for i in range(31):
            if i < len(self.samples):
                s = self.samples[i]
                data = s.data
                if len(data) % 2:
                    data += b'\0'
                f += s.name.encode('ascii')[:22].ljust(22, b'\0')
                f += struct.pack('>H', len(data) // 2)
                f += bytes([0, s.volume])
                if s.loop:
                    f += struct.pack('>HH', 0, len(data) // 2)
                else:
                    f += struct.pack('>HH', 0, 1)
            else:
                f += b'\0' * 22 + struct.pack('>H', 0) + bytes([0, 0])
                f += struct.pack('>HH', 0, 1)
        f += bytes([len(self.order), 0])
        f += bytes(self.order).ljust(128, b'\0')
        f += b'M.K.'
        for p in self.patterns:
            for row in p.rows:
                for (period, sample, fx, param) in row:
                    b0 = (sample & 0xF0) | ((period >> 8) & 0x0F)
                    b1 = period & 0xFF
                    b2 = ((sample & 0x0F) << 4) | (fx & 0x0F)
                    f += bytes([b0, b1, b2, param & 0xFF])
        for i in range(len(self.samples)):
            s = self.samples[i]
            data = s.data
            if len(data) % 2:
                data += b'\0'
            f += data
        with open(path, 'wb') as fh:
            fh.write(f)


# Kit de samples estándar (mismos índices en todos los temas)
# ¡OJO! En MOD los samples se numeran desde 1.
S_SQ50, S_SQ25, S_TRI, S_SAW, S_SINE, S_KICK, S_SNARE, S_HAT, \
    S_PLUCK, S_BUZZ = range(1, 11)


def std_samples():
    return [
        Sample('cuadrada50', square(32, 0.5), 40),
        Sample('cuadrada25', square(32, 0.25), 40),
        Sample('triangulo', triangle(64), 52),
        Sample('sierra', saw(32), 36),
        Sample('seno', sine(32), 48),
        Sample('bombo', kick(), 60, loop=False),
        Sample('caja', snare(), 46, loop=False),
        Sample('charles', hat(), 34, loop=False),
        Sample('pua', pluck(), 44, loop=False),
        Sample('zumbido', buzz(), 40),
    ]


def drums(p, kicks=(0, 16, 32, 48), snares=(8, 24, 40, 56), hats=2,
          ch=3):
    for r in kicks:
        p.put(r, ch, 'C-2', S_KICK)
    for r in snares:
        p.put(r, ch, 'C-2', S_SNARE)
    for r in range(0, 64, hats and 4 or 64):
        if hats and p.rows[r][ch] == (0, 0, 0, 0):
            p.put(r, ch, 'C-3', S_HAT)


def melody(p, ch, sample, seq, vol=None):
    """seq: lista de (fila, nota) o (fila, nota, fx, param)."""
    for ev in seq:
        row, note = ev[0], ev[1]
        fx, param = (ev[2], ev[3]) if len(ev) > 2 else (0, 0)
        if vol is not None and fx == 0:
            fx, param = 0xC, vol
        p.put(row, ch, note, sample, fx, param)


def bassline(p, ch, notes_per_bar, sample=S_TRI):
    """notes_per_bar: 4 listas de (offset, nota) por compás de 16 filas."""
    for bar, evs in enumerate(notes_per_bar):
        for off, note in evs:
            p.put(bar * 16 + off, ch, note, sample, 0xC, 44)


# ---------------------------------------------------------------------------
# TEMA: El Jardín (alegre, saltarín, FA mayor)
# ---------------------------------------------------------------------------

def build_jardin(path):
    m = Mod('jardin', std_samples())
    walk = [
        [(0, 'F-1'), (8, 'C-2')], [(0, 'A#1'), (8, 'F-1')],
        [(0, 'C-2'), (8, 'G-1')], [(0, 'C-2'), (8, 'C-2')],
    ]
    # patrón A: melodía principal
    a = m.pattern()
    drums(a)
    bassline(a, 2, walk)
    melody(a, 0, S_SQ50, [
        (0, 'F-2'), (4, 'A-2'), (8, 'C-3'), (12, 'A-2'),
        (16, 'A#2'), (20, 'A-2'), (24, 'G-2'), (28, 'E-2'),
        (32, 'F-2'), (36, 'A-2'), (40, 'C-3'), (44, 'F-3'),
        (48, 'E-3'), (52, 'C-3'), (56, 'G-2'), (60, 'A#2'),
    ], vol=44)
    melody(a, 1, S_PLUCK, [
        (2, 'F-2'), (6, 'A-2'), (10, 'C-3'), (18, 'F-2'), (22, 'A#2'),
        (26, 'C-3'), (34, 'F-2'), (38, 'A-2'), (42, 'C-3'),
        (50, 'C-2'), (54, 'E-2'), (58, 'G-2'),
    ], vol=26)
    # patrón B: respuesta juguetona
    b = m.pattern()
    drums(b)
    bassline(b, 2, [
        [(0, 'D-2'), (8, 'A-1')], [(0, 'A#1'), (8, 'F-1')],
        [(0, 'G-1'), (8, 'C-2')], [(0, 'F-1'), (8, 'C-2')],
    ])
    melody(b, 0, S_SQ50, [
        (0, 'D-3'), (4, 'C-3'), (8, 'A-2'), (12, 'D-3'),
        (16, 'C-3'), (20, 'A#2'), (24, 'A-2'), (28, 'F-2'),
        (32, 'G-2'), (36, 'A-2'), (40, 'A#2'), (44, 'C-3'),
        (48, 'A-2', 0x4, 0x33), (56, 'F-2'),
    ], vol=44)
    melody(b, 1, S_PLUCK, [
        (2, 'D-2'), (6, 'F-2'), (10, 'A-2'), (18, 'D-2'), (22, 'F-2'),
        (34, 'C-2'), (38, 'E-2'), (42, 'G-2'), (50, 'F-2'), (54, 'A-2'),
    ], vol=26)
    # velocidad en la primera fila
    a.put(0, 3, 'C-2', S_KICK, 0xF, 6)
    m.order = [0, 0, 1, 0]
    m.write(path)


# ---------------------------------------------------------------------------
# TEMA: ¡Combate! (enérgico, LA menor)
# ---------------------------------------------------------------------------

def build_combate(path):
    m = Mod('combate', std_samples())
    a = m.pattern()
    a.put(0, 3, 'C-2', S_KICK, 0xF, 4)   # speed 4: rápido
    drums(a, kicks=(0, 12, 16, 28, 32, 44, 48, 60),
          snares=(8, 24, 40, 56), hats=2)
    bassline(a, 2, [
        [(0, 'A-1'), (4, 'A-1'), (8, 'E-1'), (12, 'A-1')],
        [(0, 'F-1'), (4, 'F-1'), (8, 'C-2'), (12, 'F-1')],
        [(0, 'G-1'), (4, 'G-1'), (8, 'D-2'), (12, 'G-1')],
        [(0, 'E-1'), (4, 'E-1'), (8, 'B-1'), (12, 'E-1')],
    ])
    melody(a, 0, S_SQ25, [
        (0, 'A-2'), (2, 'C-3'), (4, 'E-3'), (8, 'D-3'), (12, 'C-3'),
        (16, 'C-3'), (18, 'D-3'), (20, 'F-3'), (24, 'E-3'), (28, 'C-3'),
        (32, 'B-2'), (34, 'D-3'), (36, 'G-3'), (40, 'F-3'), (44, 'D-3'),
        (48, 'E-3'), (52, 'B-2'), (56, 'E-2'), (60, 'G#2'),
    ], vol=42)
    melody(a, 1, S_PLUCK, [
        (2, 'A-2'), (6, 'E-2'), (10, 'A-2'), (14, 'E-2'),
        (18, 'F-2'), (22, 'C-2'), (26, 'F-2'), (30, 'C-2'),
        (34, 'G-2'), (38, 'D-2'), (42, 'G-2'), (46, 'D-2'),
        (50, 'E-2'), (54, 'B-1'), (58, 'E-2'), (62, 'G#2'),
    ], vol=28)
    b = m.pattern()
    drums(b, kicks=(0, 12, 16, 28, 32, 44, 48, 52, 56, 60),
          snares=(8, 24, 40), hats=2)
    bassline(b, 2, [
        [(0, 'D-2'), (4, 'D-2'), (8, 'A-1'), (12, 'D-2')],
        [(0, 'F-1'), (4, 'F-1'), (8, 'C-2'), (12, 'F-1')],
        [(0, 'E-1'), (4, 'E-1'), (8, 'E-2'), (12, 'E-1')],
        [(0, 'E-1'), (4, 'G#1'), (8, 'B-1'), (12, 'E-2')],
    ])
    melody(b, 0, S_SQ25, [
        (0, 'F-3'), (4, 'E-3'), (8, 'D-3'), (12, 'F-3'),
        (16, 'E-3'), (20, 'C-3'), (24, 'A-2'), (28, 'C-3'),
        (32, 'B-2'), (36, 'E-3'), (40, 'G#2'), (44, 'B-2'),
        (48, 'A-2'), (50, 'B-2'), (52, 'C-3'), (54, 'D-3'),
        (56, 'E-3'), (60, 'G#3'),
    ], vol=42)
    m.order = [0, 1]
    m.write(path)


# ---------------------------------------------------------------------------
# TEMA: Interior de Deedee (misterioso y groovy, RE dórico)
# ---------------------------------------------------------------------------

def build_interior(path):
    m = Mod('interior', std_samples())
    a = m.pattern()
    a.put(0, 3, 'C-2', S_KICK, 0xF, 6)
    drums(a, kicks=(0, 10, 16, 26, 32, 42, 48, 58), snares=(8, 24, 40, 56),
          hats=0)
    bassline(a, 2, [
        [(0, 'D-1'), (6, 'D-1'), (10, 'A-1')],
        [(0, 'C-1'), (6, 'C-1'), (10, 'G-1')],
        [(0, 'D-1'), (6, 'D-1'), (10, 'A-1')],
        [(0, 'F-1'), (6, 'E-1'), (10, 'C-1')],
    ])
    melody(a, 0, S_SINE, [
        (0, 'D-3', 0x4, 0x22), (12, 'F-3'), (16, 'E-3', 0x4, 0x22),
        (28, 'C-3'), (32, 'D-3', 0x4, 0x22), (44, 'A-2'),
        (48, 'B-2'), (52, 'C-3'), (56, 'A-2'), (60, 'F-2'),
    ], vol=36)
    melody(a, 1, S_PLUCK, [
        (4, 'D-2'), (12, 'F-2'), (20, 'C-2'), (28, 'E-2'),
        (36, 'D-2'), (44, 'F-2'), (52, 'E-2'), (60, 'A-2'),
    ], vol=22)
    b = m.pattern()
    drums(b, kicks=(0, 10, 16, 26, 32, 42, 48, 58), snares=(8, 24, 40, 56),
          hats=0)
    bassline(b, 2, [
        [(0, 'G-1'), (6, 'G-1'), (10, 'D-2')],
        [(0, 'F-1'), (6, 'F-1'), (10, 'C-2')],
        [(0, 'A#1'), (6, 'A#1'), (10, 'F-1')],
        [(0, 'A-1'), (6, 'A-1'), (10, 'E-1')],
    ])
    melody(b, 0, S_SINE, [
        (0, 'G-3', 0x4, 0x22), (12, 'F-3'), (16, 'D-3'),
        (24, 'F-3'), (32, 'D-3', 0x4, 0x33), (48, 'E-3'),
        (56, 'C#3'),
    ], vol=36)
    m.order = [0, 0, 1, 0]
    m.write(path)


# ---------------------------------------------------------------------------
# TEMA: Jefe (pesado, DO menor)
# ---------------------------------------------------------------------------

def build_jefe(path):
    m = Mod('jefe', std_samples())
    a = m.pattern()
    a.put(0, 3, 'C-2', S_KICK, 0xF, 4)
    drums(a, kicks=(0, 6, 16, 22, 32, 38, 48, 54),
          snares=(8, 24, 40, 56, 60), hats=2)
    riff = [
        [(0, 'C-1'), (4, 'C-1'), (6, 'D#1'), (8, 'C-1'), (12, 'F-1')],
        [(0, 'C-1'), (4, 'C-1'), (6, 'G-1'), (8, 'F#1'), (12, 'F-1')],
        [(0, 'C-1'), (4, 'C-1'), (6, 'D#1'), (8, 'C-1'), (12, 'G#1')],
        [(0, 'G-1'), (4, 'F#1'), (8, 'F-1'), (12, 'D#1')],
    ]
    bassline(a, 2, riff, sample=S_SAW)
    melody(a, 0, S_SQ25, [
        (0, 'C-3'), (6, 'D#3'), (8, 'C-3'), (12, 'G-2'),
        (16, 'C-3'), (22, 'F#3'), (24, 'F-3'), (28, 'D#3'),
        (32, 'C-3'), (38, 'D#3'), (40, 'G-3'), (44, 'F-3'),
        (48, 'G-3'), (52, 'F#3'), (56, 'D#3'), (60, 'D-3'),
    ], vol=44)
    melody(a, 1, S_TRI, [
        (0, 'C-2'), (8, 'C-2'), (16, 'C-2'), (24, 'C-2'),
        (32, 'C-2'), (40, 'G#1'), (48, 'G-1'), (56, 'B-1'),
    ], vol=30)
    m.order = [0]
    m.write(path)


# ---------------------------------------------------------------------------
# TEMA: Terelu (vals caótico y zumbón)
# ---------------------------------------------------------------------------

def build_terelu(path):
    m = Mod('terelu', std_samples())
    a = m.pattern()
    a.put(0, 3, 'C-2', S_KICK, 0xF, 5)
    # vals: BUM-cha-cha (compases de 12 filas)
    for bar in range(5):
        base = bar * 12
        if base > 52:
            break
        a.put(base, 3, 'C-2', S_KICK)
        a.put(base + 4, 3, 'C-3', S_HAT)
        a.put(base + 8, 3, 'C-3', S_HAT)
    seq_bass = ['E-1', 'F-1', 'E-1', 'D#1', 'E-1']
    for bar, n in enumerate(seq_bass):
        a.put(bar * 12, 2, n, S_TRI, 0xC, 42)
        a.put(bar * 12 + 4, 2, 'B-1', S_PLUCK, 0xC, 24)
        a.put(bar * 12 + 8, 2, 'B-1', S_PLUCK, 0xC, 24)
    # el ZUMBIDO: melodía cromática nerviosa
    melody(a, 0, S_BUZZ, [
        (0, 'E-3'), (6, 'F-3'), (10, 'E-3'),
        (12, 'D#3'), (18, 'E-3'), (22, 'G-3'),
        (24, 'F-3'), (30, 'E-3'), (34, 'D#3'),
        (36, 'F-3', 0x4, 0x44), (48, 'G#3'), (52, 'G-3'), (56, 'F#3'),
        (60, 'B-2'),
    ], vol=38)
    # risas de flauta desquiciada
    melody(a, 1, S_SQ25, [
        (2, 'B-3'), (4, 'G#3'), (14, 'A-3'), (16, 'F-3'),
        (26, 'B-3'), (28, 'G#3'), (38, 'C-3'), (40, 'E-3'),
        (50, 'D#3'), (54, 'B-2'), (58, 'E-3'), (62, 'F-3'),
    ], vol=24)
    m.order = [0]
    m.write(path)


# ---------------------------------------------------------------------------
# TEMA: Victoria (fanfarria corta, no en bucle)
# ---------------------------------------------------------------------------

def build_victoria(path):
    m = Mod('victoria', std_samples())
    a = m.pattern()
    a.put(0, 3, 'C-2', S_KICK, 0xF, 4)
    melody(a, 0, S_SQ50, [
        (0, 'C-3'), (3, 'C-3'), (6, 'C-3'), (9, 'C-3'),
        (14, 'G#2'), (18, 'A#2'), (22, 'C-3'), (26, 'A#2'),
        (28, 'C-3', 0x4, 0x44),
    ], vol=46)
    melody(a, 1, S_PLUCK, [
        (0, 'C-2'), (3, 'E-2'), (6, 'G-2'), (9, 'C-2'),
        (14, 'C-2'), (18, 'D#2'), (22, 'E-2'), (26, 'F-2'),
        (28, 'E-2'),
    ], vol=30)
    bassline(a, 2, [
        [(0, 'C-1'), (6, 'C-1'), (9, 'C-1'), (14, 'G#1')],
        [(0, 'A#1'), (6, 'C-1'), (12, 'C-1')],
        [], [],
    ])
    a.put(0, 3, 'C-2', S_KICK)
    a.put(6, 3, 'C-2', S_KICK)
    a.put(9, 3, 'C-2', S_SNARE)
    a.put(28, 3, 'C-2', S_SNARE)
    # cortar el sonido al final
    for ch in range(3):
        a.put(44, ch, None, 0, 0xC, 0)
    a.put(63, 3, None, 0, 0xF, 6)
    m.order = [0]
    m.write(path)


# ---------------------------------------------------------------------------
# TEMA: Deedee (torpe y entrañable, tuba y silbido)
# ---------------------------------------------------------------------------

def build_deedee(path):
    m = Mod('deedee', std_samples())
    a = m.pattern()
    a.put(0, 3, 'C-2', S_KICK, 0xF, 7)
    drums(a, kicks=(0, 16, 32, 48), snares=(12, 28, 44, 60), hats=0)
    # tuba torpona
    bassline(a, 2, [
        [(0, 'A#1'), (4, 'A#1'), (8, 'F-1'), (12, 'A#1')],
        [(0, 'D#1'), (4, 'D#1'), (8, 'A#1'), (12, 'D#1')],
        [(0, 'F-1'), (4, 'F-1'), (8, 'C-2'), (12, 'F-1')],
        [(0, 'A#1'), (4, 'F-1'), (8, 'A#1'), (12, 'F-1')],
    ])
    # silbido despistado
    melody(a, 0, S_SINE, [
        (0, 'A#2'), (4, 'D-3'), (8, 'F-3', 0x4, 0x22), (14, 'D-3'),
        (16, 'D#3'), (20, 'G-3'), (24, 'A#2'), (30, 'C-3'),
        (32, 'F-3'), (36, 'D-3'), (40, 'A#2', 0x4, 0x33),
        (48, 'C-3'), (52, 'D-3'), (56, 'D#3'), (60, 'E-3'),
    ], vol=34)
    melody(a, 1, S_PLUCK, [
        (2, 'A#2'), (6, 'D-2'), (10, 'F-2'), (18, 'D#2'), (22, 'G-2'),
        (34, 'F-2'), (38, 'A#2'), (50, 'F-2'), (54, 'A-2'), (58, 'A#2'),
    ], vol=22)
    m.order = [0]
    m.write(path)


def build_all(outdir):
    import os
    build_jardin(os.path.join(outdir, 'jardin.mod'))
    build_combate(os.path.join(outdir, 'combate.mod'))
    build_interior(os.path.join(outdir, 'interior.mod'))
    build_jefe(os.path.join(outdir, 'jefe.mod'))
    build_terelu(os.path.join(outdir, 'terelu.mod'))
    build_victoria(os.path.join(outdir, 'victoria.mod'))
    build_deedee(os.path.join(outdir, 'deedee.mod'))
    print('música: 7 módulos .mod')


if __name__ == '__main__':
    import os
    build_all(os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), 'assets/audio'))
