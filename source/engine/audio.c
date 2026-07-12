#include <maxmod9.h>
#include "audio.h"
#include "soundbank.h"
#include "soundbank_bin.h"

static int current_music = MUS_NADA;

static const u16 mus_table[MUS_COUNT] = {
    [MUS_NADA] = 0xFFFF,
    [MUS_JARDIN] = MOD_JARDIN,
    [MUS_COMBATE] = MOD_COMBATE,
    [MUS_INTERIOR] = MOD_INTERIOR,
    [MUS_JEFE] = MOD_JEFE,
    [MUS_TERELU] = MOD_TERELU,
    [MUS_VICTORIA] = MOD_VICTORIA,
    [MUS_DEEDEE] = MOD_DEEDEE,
};

static const u16 sfx_table[SND_COUNT] = {
    [SND_SALTO] = SFX_SALTO,
    [SND_GOLPE] = SFX_GOLPE,
    [SND_EXCELENTE] = SFX_EXCELENTE,
    [SND_BIEN] = SFX_BIEN,
    [SND_LENGUA] = SFX_LENGUA,
    [SND_MENU] = SFX_MENU,
    [SND_OK] = SFX_OK,
    [SND_CANCEL] = SFX_CANCEL,
    [SND_DANO] = SFX_DANO,
    [SND_CURAR] = SFX_CURAR,
    [SND_CHAPA] = SFX_CHAPA,
    [SND_GUARDAR] = SFX_GUARDAR,
    [SND_ESQUIVA] = SFX_ESQUIVA,
    [SND_KO] = SFX_KO,
    [SND_NIVEL] = SFX_NIVEL,
    [SND_ZUMBIDO] = SFX_ZUMBIDO,
    [SND_GAS] = SFX_GAS,
    [SND_TRAGAR] = SFX_TRAGAR,
};

void audio_init(void)
{
    mmInitDefaultMem((mm_addr)soundbank_bin);
    for (int i = 0; i < SND_COUNT; i++)
        mmLoadEffect(sfx_table[i]);
    soundEnable();
}

void music_play(int mus_id)
{
    if (mus_id == current_music)
        return;
    if (current_music != MUS_NADA) {
        mmStop();
        mmUnload(mus_table[current_music]);
    }
    current_music = mus_id;
    if (mus_id != MUS_NADA) {
        mmLoad(mus_table[mus_id]);
        mmStart(mus_table[mus_id],
                mus_id == MUS_VICTORIA ? MM_PLAY_ONCE : MM_PLAY_LOOP);
    }
}

void music_stop(void)
{
    music_play(MUS_NADA);
}

int music_current(void)
{
    return current_music;
}

void sfx(int snd_id)
{
    mmEffect(sfx_table[snd_id]);
}
