#!/usr/bin/env python3
"""Orquestador de assets: genera TODO el arte, música, mapas y datos.

Salidas:
  assets/bin/*.bin        gráficos en formato nativo DS (bin2c los enlaza)
  assets/audio/*.mod/.wav música y efectos (mmutil los convierte)
  assets/gfx/*.png        copias PNG para inspección humana (no se compilan)
  assets/icon.gif         icono del ROM
  source/data/*.h/.c      tablas de datos generadas

Formatos nativos:
  - paleta: 256 x u16 BGR555
  - sprites: frames consecutivos; cada frame = tiles 8x8 de 64 bytes
    en orden fila-columna (compatible con oamAllocateGfx + dmaCopy)
  - tileset: tiles 8x8 consecutivos de 64 bytes
  - escena: bitmap lineal 256x192 de índices
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pixelkit import Canvas, PALETTE, save_png
import gen_font
import sprites_cats
import sprites_npcs
import sprites_enemies
import sprites_ui
import gen_tiles
import gen_scenes
import gen_maps
import gen_music
import gen_sfx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(ROOT, 'assets/bin')
GFX = os.path.join(ROOT, 'assets/gfx')
AUDIO = os.path.join(ROOT, 'assets/audio')
DATA = os.path.join(ROOT, 'source/data')


def _bgr555(rgb):
    r, g, b = rgb
    return (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)


def pack_palette():
    out = bytearray()
    for rgb in PALETTE:
        v = _bgr555(rgb)
        out += bytes((v & 0xff, v >> 8))
    with open(os.path.join(BIN, 'pal_master.bin'), 'wb') as f:
        f.write(out)


def _frame_tiles(canvas, size):
    """Tiles 8x8 fila a fila de un frame size x size."""
    out = bytearray()
    for ty in range(0, size, 8):
        for tx in range(0, size, 8):
            for y in range(8):
                for x in range(8):
                    out.append(canvas.px[ty + y][tx + x])
    return out


def pack_sheet(fname, frames, size):
    out = bytearray()
    for fr in frames:
        out += _frame_tiles(fr, size)
    with open(os.path.join(BIN, fname), 'wb') as f:
        f.write(out)


def sheet_defines(lines, sheet, order, size, nframes):
    up = sheet.upper()
    lines.append(f'#define SPRS_{up} {size}')
    lines.append(f'#define SPRN_{up} {nframes}')
    for name, idx in order:
        lines.append(f'#define SPRF_{up}_{name.upper()} {idx}')
    lines.append('')


# ---------------------------------------------------------------------------
# Retratos para diálogos (32x32, zoom a la cara)
# ---------------------------------------------------------------------------

def _crop(canvas, x0, y0):
    c = Canvas(32, 32)
    for y in range(32):
        for x in range(32):
            c.px[y][x] = canvas.get(x0 + x, y0 + y)
    return c


def build_portraits():
    frames = []
    order = []

    def add(name, canvas):
        order.append((name, len(frames)))
        frames.append(canvas)

    for who, slim in (('benito', False), ('silva', True)):
        for pname, expr in (('normal', 'normal'), ('feliz', 'happy'),
                            ('susto', 'hurt'), ('habla', 'talk')):
            fr = sprites_cats.build_cat_frame(slim, 'down', 'idle', 0,
                                              expr=expr)
            big = fr.scaled(64, 64)
            add(f'{who}_{pname}', _crop(big, 16, 2))
    for pname, pose in (('normal', 'idle'), ('feliz', 'happy'),
                        ('susto', 'hurt')):
        fr = sprites_cats.build_deedee_frame(pose, 0)
        add(f'deedee_{pname}', _crop(fr, 4, 10))
    for pname, pose in (('normal', 'hover'), ('risa', 'laugh'),
                        ('susto', 'hurt')):
        add(f'terelu_{pname}', sprites_npcs.build_terelu_frame(pose, 0))
    add('anciano_normal', sprites_npcs.build_bee_frame(0, elder=True))
    add('tendero_normal', sprites_npcs.build_bee_frame(0, shop=True))
    add('baba_normal', sprites_npcs.build_snail_frame(0))
    add('rufo_normal', sprites_npcs.build_bird_frame(0))
    add('nuez_normal', sprites_npcs.build_squirrel_frame(0))
    add('croac_normal', sprites_npcs.build_frog_frame(0))
    return frames, 32, order


# ---------------------------------------------------------------------------
# Icono del cartucho
# ---------------------------------------------------------------------------

def build_icon():
    c = Canvas(32, 32, '2')
    fr = sprites_cats.build_cat_frame(False, 'down', 'idle', 0)
    big = fr.scaled(64, 64)
    c.blit(_crop(big, 16, 2), 0, 0)
    from PIL import Image
    img = Image.new('P', (32, 32))
    flat = []
    for (r, g, b) in PALETTE:
        flat += [r, g, b]
    img.putpalette(flat)
    img.putdata([v for row in c.px for v in row])
    img.save(os.path.join(ROOT, 'assets/icon.gif'))


# ---------------------------------------------------------------------------
# Tilesets y salas
# ---------------------------------------------------------------------------

def build_tiles_and_rooms(lines_meta):
    packer_j, metas_j, props_j = gen_tiles.build_jardin()
    packer_c, metas_c, props_c = gen_tiles.build_colon()

    with open(os.path.join(BIN, 'set_jardin.bin'), 'wb') as f:
        for t in packer_j.tiles:
            f.write(bytes(t))
    with open(os.path.join(BIN, 'set_colon.bin'), 'wb') as f:
        for t in packer_c.tiles:
            f.write(bytes(t))
    packer_j.save_png(os.path.join(GFX, 'tileset_jardin.png'))
    packer_c.save_png(os.path.join(GFX, 'tileset_colon.png'))

    # tabla de metatiles
    h = ['// Generado por tools/gen_all.py — NO editar a mano',
         '#ifndef TILES_DATA_H__', '#define TILES_DATA_H__', '',
         '#include <nds/ndstypes.h>', '']
    for tsname, metas in (('jardin', metas_j), ('colon', metas_c)):
        h.append(f'#define MT_{tsname.upper()}_COUNT {len(metas)}')
        for i, (name, ids, flags) in enumerate(metas):
            h.append(f'#define MT_{tsname.upper()}_{name.upper()} {i}')
        h.append(f'extern const u16 mt_{tsname}_tiles[{len(metas)}][4];')
        h.append(f'extern const u8 mt_{tsname}_flags[{len(metas)}];')
        h.append('')
    h.append('#endif')
    with open(os.path.join(DATA, 'tiles_data.h'), 'w') as f:
        f.write('\n'.join(h) + '\n')

    c = ['// Generado por tools/gen_all.py — NO editar a mano',
         '#include "tiles_data.h"', '']
    for tsname, metas in (('jardin', metas_j), ('colon', metas_c)):
        c.append(f'const u16 mt_{tsname}_tiles[{len(metas)}][4] = {{')
        for name, ids, flags in metas:
            c.append('    { %d, %d, %d, %d },' % ids)
        c.append('};')
        c.append(f'const u8 mt_{tsname}_flags[{len(metas)}] = {{')
        row = []
        for name, ids, flags in metas:
            row.append(str(flags))
        c.append('    ' + ', '.join(row))
        c.append('};')
        c.append('')
    with open(os.path.join(DATA, 'tiles_data.c'), 'w') as f:
        f.write('\n'.join(c) + '\n')

    # ---- salas ----
    rooms = gen_maps.build_all()
    name_to_idx = {
        'jardin': {name: i for i, (name, _, _) in enumerate(metas_j)},
        'colon': {name: i for i, (name, _, _) in enumerate(metas_c)},
    }
    props_by_ts = {'jardin': props_j, 'colon': props_c}

    h = ['// Generado por tools/gen_all.py — NO editar a mano',
         '#ifndef ROOMS_DATA_H__', '#define ROOMS_DATA_H__', '',
         '#include <nds/ndstypes.h>', '',
         '// tipos de entidad (coinciden con tools/gen_maps.py)',
         'enum {',
         '    E_NPC, E_ENEMY, E_SAVE, E_EXIT, E_TRIGGER, E_PLATE,',
         '    E_GATE, E_CHEST, E_BLOCK, E_SWITCH, E_DOOR, E_VENT,',
         '    E_BOSS, E_SHOP,',
         '};', '',
         '// NPCs',
         'enum {',
         '    NPC_BABA, NPC_RUFO, NPC_NUEZ, NPC_CROAC, NPC_ANCIANO,',
         '    NPC_TENDERO,',
         '};', '',
         'typedef struct {',
         '    u8 type;', '    u16 x, y;',
         '    u8 a, b, c, d;',
         '} EntityDef;', '',
         'typedef struct {',
         '    u8 w, h;', '    u8 mode;      // 0 vista sup, 1 lateral',
         '    u8 tileset;   // 0 jardin, 1 colon',
         '    u8 music;     // MUS_*',
         '    u8 entry_x, entry_y;   // en metatiles',
         '    const u8 *tiles;',
         '    const EntityDef *ents;',
         '    u8 n_ents;',
         '} RoomDef;', '']
    h.append(f'#define ROOM_COUNT {len(rooms)}')
    for i, (rname, mode, ts, mus, g, ex, ey) in enumerate(rooms):
        h.append(f'#define ROOM_{rname.upper()} {i}')
    h.append('')
    h.append('extern const RoomDef rooms[ROOM_COUNT];')
    h.append('')
    h.append('#endif')
    with open(os.path.join(DATA, 'rooms_data.h'), 'w') as f:
        f.write('\n'.join(h) + '\n')

    c = ['// Generado por tools/gen_all.py — NO editar a mano',
         '#include "rooms_data.h"', '#include "audio_ids.h"', '']
    for rname, mode, ts, mus, g, ex, ey in rooms:
        lut = name_to_idx[ts]
        # estampar props
        grid_idx = [[lut[g.legend[ch]] for ch in row] for row in g.cells]
        for pname, mx, my in g.props:
            mw, mh, cells = props_by_ts[ts][pname]
            for j in range(mh):
                for i in range(mw):
                    grid_idx[my + j][mx + i] = cells[j * mw + i]
        c.append(f'static const u8 tiles_{rname}[{g.w * g.h}] = {{')
        for row in grid_idx:
            c.append('    ' + ','.join(str(v) for v in row) + ',')
        c.append('};')
        c.append(f'static const EntityDef ents_{rname}[] = {{')
        for (et, x, y, a, b, cc, d) in g.entities:
            c.append(f'    {{ {et}, {x}, {y}, {a}, {b}, {cc}, {d} }},')
        c.append('};')
        c.append('')
    c.append(f'const RoomDef rooms[ROOM_COUNT] = {{')
    for rname, mode, ts, mus, g, ex, ey in rooms:
        mus_id = mus.replace('MOD_', 'MUS_')
        tsid = 0 if ts == 'jardin' else 1
        c.append(f'    {{ {g.w}, {g.h}, {mode}, {tsid}, {mus_id}, '
                 f'{ex}, {ey}, tiles_{rname}, ents_{rname}, '
                 f'{len(g.entities)} }},')
    c.append('};')
    with open(os.path.join(DATA, 'rooms_data.c'), 'w') as f:
        f.write('\n'.join(c) + '\n')

    lines_meta.append(f'// tiles: jardin {len(packer_j.tiles)} tiles, '
                      f'colon {len(packer_c.tiles)} tiles')
    print(f'tiles: jardin {len(packer_j.tiles)}, colon {len(packer_c.tiles)}')


# nombres C para índices de paleta usados por el motor
PAL_NAMES = [
    ('k', 'OUTLINE'), ('K', 'SHADOW'), ('w', 'WHITE'), ('W', 'OFFWHITE'),
    ('l', 'LGRAY'), ('g', 'MGRAY'), ('d', 'DGRAY'), ('#', 'CREAM'),
    ('*', 'GOLD'), ('+', 'GOLDDARK'), ('-', 'UIBLUE'), ('_', 'UIDARK'),
    ('~', 'HPGREEN'), ('^', 'RED'), (':', 'PEBLUE'), (';', 'ORANGE'),
    ('!', 'ACID'), ('r', 'TONGUE'), ('R', 'TONGUEDARK'),
]


def write_palette_ids():
    from pixelkit import IDX
    lines = ['// Generado por tools/gen_all.py — NO editar a mano',
             '#ifndef PALETTE_IDS_H__', '#define PALETTE_IDS_H__', '']
    for ch, name in PAL_NAMES:
        lines.append(f'#define COL_{name} {IDX[ch]}')
    lines.append('')
    lines.append('#endif')
    with open(os.path.join(DATA, 'palette_ids.h'), 'w') as f:
        f.write('\n'.join(lines) + '\n')


def main():
    for d in (BIN, GFX, AUDIO, DATA):
        os.makedirs(d, exist_ok=True)

    pack_palette()
    write_palette_ids()

    # ---- fuente ----
    gen_font.build()   # escribe assets/gfx/font.png y font_map.h
    # empaquetar la tira de la fuente como tiles
    from PIL import Image
    img = Image.open(os.path.join(GFX, 'font.png'))
    w, hgt = img.size
    data = list(img.getdata())
    out = bytearray()
    for tx in range(0, w, 8):
        for y in range(8):
            for x in range(8):
                out.append(data[y * w + tx + x])
    with open(os.path.join(BIN, 'fnt_main.bin'), 'wb') as f:
        f.write(out)

    # ---- hojas de sprites ----
    meta = ['// Generado por tools/gen_all.py — NO editar a mano',
            '#ifndef SPRITES_META_H__', '#define SPRITES_META_H__', '']

    sheets = {}
    sheets.update(sprites_cats.build_all())
    sheets.update(sprites_npcs.build_all())
    sheets.update(sprites_enemies.build_all())

    ui = sprites_ui.build_all()
    fr, size, order = ui['fx16']
    sheets['fx'] = (fr, 16, order)

    pframes, psize, porder = build_portraits()
    sheets['portraits'] = (pframes, 32, porder)

    for name, (frames, size, order) in sheets.items():
        pack_sheet(f'spr_{name}.bin', frames, size)
        sheet_defines(meta, name, order, size, len(frames))
        # PNG de inspección
        sheet = Canvas(size * len(frames), size)
        for i, f in enumerate(frames):
            sheet.blit(f, i * size, 0)
        save_png(os.path.join(GFX, f'spr_{name}.png'), sheet)

    # banners: la DS no tiene sprites de 64x16, así que van centrados
    # en frames de 64x32
    bfr, bsize, border_ = ui['banners']
    out = bytearray()
    for f in bfr:
        pad = Canvas(64, 32)
        pad.blit(f, 0, 8)
        for ty in range(0, 32, 8):
            for tx in range(0, 64, 8):
                for y in range(8):
                    for x in range(8):
                        out.append(pad.px[ty + y][tx + x])
    with open(os.path.join(BIN, 'spr_banners.bin'), 'wb') as f:
        f.write(out)
    sheet_defines(meta, 'banners', border_, 64, len(bfr))

    # ---- escenas ----
    for name, canvas in gen_scenes.build_all().items():
        out = bytearray()
        for row in canvas.px:
            out += bytes(row)
        with open(os.path.join(BIN, f'scn_{name}.bin'), 'wb') as f:
            f.write(out)
        save_png(os.path.join(GFX, f'{name}.png'), canvas)

    # ---- tiles y salas ----
    build_tiles_and_rooms(meta)

    meta.append('#endif')
    with open(os.path.join(DATA, 'sprites_meta.h'), 'w') as f:
        f.write('\n'.join(meta) + '\n')

    # ---- icono ----
    build_icon()

    # ---- audio ----
    gen_music.build_all(AUDIO)
    gen_sfx.build_all(AUDIO)

    print('assets OK')


if __name__ == '__main__':
    main()
