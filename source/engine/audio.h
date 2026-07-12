// Música (maxmod, módulos .mod) y efectos de sonido.
#ifndef AUDIO_H__
#define AUDIO_H__

#include "common.h"
#include "audio_ids.h"

// ids de SFX lógicos (mapeados a SFX_* del soundbank)
enum {
    SND_SALTO, SND_GOLPE, SND_EXCELENTE, SND_BIEN, SND_LENGUA,
    SND_MENU, SND_OK, SND_CANCEL, SND_DANO, SND_CURAR, SND_CHAPA,
    SND_GUARDAR, SND_ESQUIVA, SND_KO, SND_NIVEL, SND_ZUMBIDO,
    SND_GAS, SND_TRAGAR,
    SND_COUNT
};

void audio_init(void);
void music_play(int mus_id);       // cambia si es distinto del actual
void music_stop(void);
int  music_current(void);
void sfx(int snd_id);

#endif
