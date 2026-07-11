#!/usr/bin/env python3
"""Efectos de sonido sintetizados (WAV 8 bits mono 11025 Hz) para maxmod."""

import math
import os
import struct

RATE = 11025


def _rng(seed):
    s = seed

    def nxt():
        nonlocal s
        s = (s * 1103515245 + 12345) & 0x7fffffff
        return ((s >> 8) & 0xff) - 128

    return nxt


def write_wav(path, samples):
    """samples: lista de floats -1..1."""
    data = bytes(max(0, min(255, int((v + 1.0) * 127.5))) for v in samples)
    with open(path, 'wb') as f:
        f.write(b'RIFF')
        f.write(struct.pack('<I', 36 + len(data)))
        f.write(b'WAVEfmt ')
        f.write(struct.pack('<IHHIIHH', 16, 1, 1, RATE, RATE, 1, 8))
        f.write(b'data')
        f.write(struct.pack('<I', len(data)))
        f.write(data)


def square_sweep(dur, f0, f1, vol=0.6, duty=0.5, decay=None):
    n = int(dur * RATE)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        phase += f / RATE
        env = vol * (math.exp(-i / (decay * RATE)) if decay else (1 - t))
        out.append(env if (phase % 1.0) < duty else -env)
    return out


def noise_burst(dur, vol=0.5, decay=0.05, lowpass=0.0):
    n = int(dur * RATE)
    r = _rng(7)
    out = []
    prev = 0.0
    for i in range(n):
        env = vol * math.exp(-i / (decay * RATE))
        v = r() / 128.0
        if lowpass > 0:
            v = prev + (v - prev) * (1 - lowpass)
            prev = v
        out.append(v * env)
    return out


def chime(freqs, dur_each, vol=0.5, overlap=True):
    total = int(dur_each * RATE * (len(freqs) if not overlap
                else (len(freqs) * 0.6 + 0.8)))
    out = [0.0] * total
    for k, f in enumerate(freqs):
        start = int(k * dur_each * RATE * (1.0 if not overlap else 0.6))
        n = int(dur_each * RATE)
        for i in range(n):
            if start + i >= total:
                break
            env = vol * math.exp(-i / (0.12 * RATE))
            out[start + i] += math.sin(2 * math.pi * f * i / RATE) * env
    return [max(-1, min(1, v)) for v in out]


def slurp(dur=0.35):
    """Lengüetazo: ruido húmedo con barrido + gotita final."""
    n = int(dur * RATE)
    r = _rng(3)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / n
        lp = 0.55 + 0.4 * math.sin(math.pi * t)      # filtro que se abre
        v = r() / 128.0
        v = prev + (v - prev) * (1 - lp)
        prev = v
        wob = math.sin(2 * math.pi * (300 - 180 * t) * i / RATE) * 0.25
        env = 0.7 * math.sin(math.pi * min(1.0, t * 1.2))
        out.append((v * 0.8 + wob) * env)
    out += chime([880], 0.06, vol=0.3)
    return out


def buzz_fly(dur=0.6):
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / n
        f = 190 + 40 * math.sin(2 * math.pi * 3 * t)
        a = ((i * f / RATE) % 1.0) * 2 - 1
        b = ((i * (f * 1.04) / RATE) % 1.0) * 2 - 1
        env = 0.5 * (1 - t * 0.3)
        out.append((a + b) * 0.4 * env)
    return out


def build_all(outdir):
    write_wav(os.path.join(outdir, 'sfx_salto.wav'),
              square_sweep(0.14, 300, 900, vol=0.5, duty=0.4))
    write_wav(os.path.join(outdir, 'sfx_golpe.wav'),
              noise_burst(0.15, vol=0.8, decay=0.03, lowpass=0.6) +
              square_sweep(0.08, 160, 60, vol=0.5))
    write_wav(os.path.join(outdir, 'sfx_excelente.wav'),
              chime([523, 659, 784, 1047], 0.09, vol=0.5))
    write_wav(os.path.join(outdir, 'sfx_bien.wav'),
              chime([523, 784], 0.08, vol=0.45))
    write_wav(os.path.join(outdir, 'sfx_lengua.wav'), slurp())
    write_wav(os.path.join(outdir, 'sfx_menu.wav'),
              square_sweep(0.05, 700, 900, vol=0.3))
    write_wav(os.path.join(outdir, 'sfx_ok.wav'),
              chime([660, 990], 0.06, vol=0.4))
    write_wav(os.path.join(outdir, 'sfx_cancel.wav'),
              square_sweep(0.08, 500, 250, vol=0.35))
    write_wav(os.path.join(outdir, 'sfx_dano.wav'),
              noise_burst(0.12, vol=0.7, decay=0.025) +
              square_sweep(0.1, 220, 90, vol=0.45, duty=0.3))
    write_wav(os.path.join(outdir, 'sfx_curar.wav'),
              chime([784, 1047, 1319], 0.1, vol=0.45))
    write_wav(os.path.join(outdir, 'sfx_chapa.wav'),
              chime([1319, 1760], 0.07, vol=0.4))
    write_wav(os.path.join(outdir, 'sfx_guardar.wav'),
              chime([523, 659, 1047], 0.12, vol=0.45))
    write_wav(os.path.join(outdir, 'sfx_esquiva.wav'),
              noise_burst(0.16, vol=0.35, decay=0.06, lowpass=0.85))
    write_wav(os.path.join(outdir, 'sfx_ko.wav'),
              square_sweep(0.5, 400, 80, vol=0.5, duty=0.5))
    write_wav(os.path.join(outdir, 'sfx_nivel.wav'),
              chime([523, 659, 784, 1047, 1319], 0.09, vol=0.5))
    write_wav(os.path.join(outdir, 'sfx_zumbido.wav'), buzz_fly())
    write_wav(os.path.join(outdir, 'sfx_gas.wav'),
              noise_burst(0.3, vol=0.4, decay=0.12, lowpass=0.9))
    write_wav(os.path.join(outdir, 'sfx_tragar.wav'),
              square_sweep(0.25, 400, 100, vol=0.4, duty=0.6) +
              noise_burst(0.1, vol=0.3, decay=0.05, lowpass=0.8))
    print('sfx: 18 efectos')


if __name__ == '__main__':
    build_all(os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), 'assets/audio'))
