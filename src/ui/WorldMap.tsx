/** Mapa de la Máquina Temporal de Patas: selección de mundo y nivel. */
import { useState } from 'react';
import { currentLang, formatTime, t } from '../core/i18n';
import { levelPetTotal, WORLDS, type LevelSpec } from '../content/worlds';
import { totalCaught, type SaveData } from '../core/save';
import { sfx } from '../core/audio';
import { GADGETS, type GadgetId } from '../content/gadgets';

export default function WorldMap({
  save,
  onPlay,
  onSettings,
  onQuit,
}: {
  save: SaveData;
  onPlay: (level: LevelSpec) => void;
  onSettings: () => void;
  onQuit: () => void;
}) {
  const lang = currentLang();
  const caught = totalCaught(save);
  const [openWorld, setOpenWorld] = useState<number>(save.worldId);

  const world = WORLDS.find((w) => w.id === openWorld) ?? WORLDS[0];
  const unlockedWorlds = WORLDS.filter((w) => caught >= w.unlockAt || w.id === 1);

  return (
    <div className="screen">
      <div className="panel">
        <div className="spread">
          <div>
            <h2 className="section" style={{ border: 'none', marginBottom: 0 }}>
              {t('map.title')}
            </h2>
            <div className="dim">
              🕸️ {caught} · 🪙 {save.coins} · {formatTime(save.playTime)}
            </div>
          </div>
          <div className="row">
            {save.gadgets.map((g) => (
              <span key={g} className="badge cyan" title={t(`gadget.${g}`)}>
                {GADGETS[g as GadgetId]?.icon} {t(`gadget.${g}`)}
              </span>
            ))}
          </div>
        </div>

        <div className="scroll">
          <h2 className="section">{t('map.select')}</h2>
          <div className="world-grid">
            {WORLDS.map((w) => {
              const locked = caught < w.unlockAt && w.id !== 1;
              return (
                <button
                  key={w.id}
                  className={`world-card ${locked ? 'locked' : ''} ${w.id === openWorld ? '' : ''}`}
                  disabled={locked}
                  onClick={() => {
                    sfx('uiMove');
                    setOpenWorld(w.id);
                  }}
                  style={w.id === openWorld ? { borderColor: 'var(--ui-gold)' } : undefined}
                >
                  <div
                    className="swatch"
                    style={{
                      background: `linear-gradient(160deg, #${w.color.toString(16).padStart(6, '0')}, #14183a)`,
                    }}
                  />
                  <div className="wname">
                    {w.id}. {w.name[lang]}
                  </div>
                  <div className="wsub">{w.subtitle[lang]}</div>
                  {locked && (
                    <div className="dim" style={{ marginTop: 6 }}>
                      🔒 {t('map.needPets', { n: w.unlockAt - caught })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <h2 className="section">
            {world.id}. {world.name[lang]}
          </h2>
          <div className="level-list">
            {world.levels.map((lv, i) => {
              const rec = save.levels[lv.id];
              const total = levelPetTotal(lv);
              const prevLevel = i > 0 ? world.levels[i - 1] : null;
              const locked =
                (caught < world.unlockAt && world.id !== 1) ||
                (prevLevel ? !(save.levels[prevLevel.id]?.cleared ?? false) : false);
              return (
                <button
                  key={lv.id}
                  className="level-row"
                  disabled={locked}
                  onClick={() => {
                    sfx('uiConfirm');
                    onPlay(lv);
                  }}
                >
                  <span className="idx">{lv.id}</span>
                  <span className="meta">
                    <div className="lname">
                      {lv.name[lang]} {lv.boss ? '👹' : ''}
                    </div>
                    <div className="lstat">
                      🕸️ {rec?.caught ?? 0}/{total} · 🪙 {rec?.coins ?? 0}/{lv.coins}
                      {rec?.bestTime ? ` · ⏱ ${formatTime(rec.bestTime)}` : ''}
                    </div>
                  </span>
                  {lv.gadgetUnlock && !save.gadgets.includes(lv.gadgetUnlock) && (
                    <span className="badge gold">
                      {GADGETS[lv.gadgetUnlock as GadgetId]?.icon} {t('map.gadget')}
                    </span>
                  )}
                  {rec?.cleared && <span className="badge green">✓ {t('map.cleared')}</span>}
                  {locked && <span className="badge">🔒</span>}
                </button>
              );
            })}
          </div>

          {unlockedWorlds.length < WORLDS.length && (
            <p className="dim" style={{ marginTop: 12 }}>
              🔒 {t('map.needPets', { n: Math.max(0, (WORLDS.find((w) => caught < w.unlockAt)?.unlockAt ?? 0) - caught) })}
            </p>
          )}
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn small" onClick={() => { sfx('uiConfirm'); onSettings(); }}>
            ⚙️ {t('menu.settings')}
          </button>
          <button className="btn small ghost" onClick={() => { sfx('uiBack'); onQuit(); }}>
            ← {t('common.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
