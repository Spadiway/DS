// Benito & Silva: Dentro de Deedee
// RPG homebrew original para Nintendo DS.
#include <nds.h>
#include "video.h"
#include "text.h"
#include "audio.h"
#include "save.h"
#include "sprites.h"
#include "fx.h"

void game_init(void);
void game_frame(void);

int main(void)
{
    video_init();
    text_init();
    audio_init();
    save_init();
    spr_init();
    fx_clear();

    game_init();

    while (1) {
        scanKeys();
        game_frame();
        video_vblank();
    }
    return 0;
}
