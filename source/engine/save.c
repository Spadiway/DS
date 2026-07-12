#include <stdio.h>
#include <string.h>
#include <fat.h>
#include "save.h"

static int backend = SAVE_NONE;
static SaveData ram_copy;
static bool ram_valid = false;

#define SAVE_PATH "/benito_silva.sav"
#define GBA_SRAM ((vu8 *)0x0A000000)

static u32 calc_checksum(const SaveData *d)
{
    const u8 *p = (const u8 *)d;
    u32 sum = 0x9E3779B9;
    for (u32 i = 8; i < sizeof(SaveData); i++)
        sum = (sum ^ p[i]) * 16777619u;
    return sum;
}

static bool sram_probe(void)
{
    sysSetCartOwner(BUS_OWNER_ARM9);
    u8 old0 = GBA_SRAM[0], old1 = GBA_SRAM[1];
    GBA_SRAM[0] = 0x5A;
    GBA_SRAM[1] = 0xC3;
    swiDelay(100);
    bool ok = (GBA_SRAM[0] == 0x5A && GBA_SRAM[1] == 0xC3);
    GBA_SRAM[0] = old0;
    GBA_SRAM[1] = old1;
    return ok;
}

void save_init(void)
{
    if (fatInitDefault()) {
        backend = SAVE_FAT;
        return;
    }
    if (sram_probe()) {
        backend = SAVE_SRAM;
        return;
    }
    backend = SAVE_NONE;
}

int save_backend(void)
{
    return backend;
}

bool save_exists(void)
{
    SaveData tmp;
    return save_read(&tmp);
}

bool save_write(const SaveData *d_in)
{
    SaveData d = *d_in;
    d.magic = SAVE_MAGIC;
    d.checksum = calc_checksum(&d);

    ram_copy = d;
    ram_valid = true;

    if (backend == SAVE_FAT) {
        FILE *f = fopen(SAVE_PATH, "wb");
        if (!f)
            return false;
        size_t n = fwrite(&d, 1, sizeof(d), f);
        fclose(f);
        return n == sizeof(d);
    }
    if (backend == SAVE_SRAM) {
        const u8 *src = (const u8 *)&d;
        for (u32 i = 0; i < sizeof(d); i++)
            GBA_SRAM[i] = src[i];
        // verificación
        for (u32 i = 0; i < sizeof(d); i++)
            if (GBA_SRAM[i] != src[i])
                return false;
        return true;
    }
    return true;    // solo memoria: "guardado" hasta apagar
}

bool save_read(SaveData *d)
{
    if (backend == SAVE_FAT) {
        FILE *f = fopen(SAVE_PATH, "rb");
        if (!f)
            goto ram;
        size_t n = fread(d, 1, sizeof(*d), f);
        fclose(f);
        if (n != sizeof(*d))
            goto ram;
    } else if (backend == SAVE_SRAM) {
        u8 *dst = (u8 *)d;
        for (u32 i = 0; i < sizeof(*d); i++)
            dst[i] = GBA_SRAM[i];
    } else {
        goto ram;
    }
    if (d->magic == SAVE_MAGIC && d->checksum == calc_checksum(d))
        return true;
ram:
    if (ram_valid) {
        *d = ram_copy;
        return true;
    }
    return false;
}
