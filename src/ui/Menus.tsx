/** Menú principal, ranuras de guardado, extras y créditos. */
import { useEffect, useState } from 'react';
import { t, formatTime } from '../core/i18n';
import { deleteSave, emptySave, listSaves, totalCaught, type SaveData } from '../core/save';
import { sfx } from '../core/audio';
import { TOTAL_COINS, TOTAL_PETS, WORLDS } from '../content/worlds';
import { currentLang } from '../core/i18n';

export function MenuBackground() {
  return (
    <div className="menu-bg">
      <div className="sun" />
      <div className="grid" />
    </div>
  );
}

export function MainMenu({
  onNewGame,
  onContinue,
  onSettings,
  onExtras,
  onCredits,
  hasSaves,
}: {
  onNewGame: () => void;
  onContinue: () => void;
  onSettings: () => void;
  onExtras: () => void;
  onCredits: () => void;
  hasSaves: boolean;
}) {
  return (
    <div className="screen">
      <div>
        <h1 className="title">
          BENITO
          <br />
          ESCAPE
        </h1>
        <p className="subtitle">{t('menu.subtitle')}</p>
      </div>
      <div className="panel narrow">
        {hasSaves && (
          <button className="btn primary" onClick={() => { sfx('uiConfirm'); onContinue(); }}>
            ▶ {t('menu.continue')}
          </button>
        )}
        <button className={`btn ${hasSaves ? '' : 'primary'}`} onClick={() => { sfx('uiConfirm'); onNewGame(); }}>
          🐾 {t('menu.newGame')}
        </button>
        <button className="btn" onClick={() => { sfx('uiConfirm'); onExtras(); }}>
          🎁 {t('menu.extras')}
        </button>
        <button className="btn" onClick={() => { sfx('uiConfirm'); onSettings(); }}>
          ⚙️ {t('menu.settings')}
        </button>
        <button className="btn ghost" onClick={() => { sfx('uiConfirm'); onCredits(); }}>
          📜 {t('menu.credits')}
        </button>
      </div>
    </div>
  );
}

export function SaveSlots({
  onPick,
  onBack,
}: {
  onPick: (save: SaveData, isNew: boolean) => void;
  onBack: () => void;
}) {
  const [saves, setSaves] = useState(listSaves());
  const [confirming, setConfirming] = useState<number | null>(null);

  const refresh = () => setSaves(listSaves());

  return (
    <div className="screen">
      <div className="panel">
        <h2 className="section">{t('slots.title')}</h2>
        <div className="scroll">
          {saves.map((s, i) => (
            <div key={i} className="spread" style={{ marginBottom: 8 }}>
              <button
                className="level-row"
                onClick={() => {
                  sfx('uiConfirm');
                  if (s) onPick(s, false);
                  else onPick(emptySave(i), true);
                }}
              >
                <span className="idx">{i + 1}</span>
                <span className="meta">
                  {s ? (
                    <>
                      <div className="lname">{s.name}</div>
                      <div className="lstat">
                        {t('slots.world')} {s.worldId} · {t('slots.pets')} {totalCaught(s)}/{TOTAL_PETS} · 🪙 {s.coins}/
                        {TOTAL_COINS} · {t('slots.playtime')} {formatTime(s.playTime)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lname">{t('slots.empty')}</div>
                      <div className="lstat">{t('slots.new')}</div>
                    </>
                  )}
                </span>
                {s && <span className="badge gold">{Math.floor((totalCaught(s) / TOTAL_PETS) * 100)}%</span>}
              </button>
              {s && (
                <button
                  className="btn small ghost"
                  onClick={() => {
                    if (confirming === i) {
                      deleteSave(i);
                      setConfirming(null);
                      refresh();
                      sfx('uiBack');
                    } else {
                      setConfirming(i);
                    }
                  }}
                >
                  {confirming === i ? t('common.yes') : '🗑'}
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="btn ghost" onClick={() => { sfx('uiBack'); onBack(); }}>
          ← {t('common.back')}
        </button>
      </div>
    </div>
  );
}

const MINIGAMES = [
  { id: 'snowRace', cost: 10, icon: '🛷', es: 'Carrera Nevada', en: 'Snow Race' },
  { id: 'boxing', cost: 20, icon: '🥊', es: 'Boxeo Deedee', en: 'Deedee Boxing' },
  { id: 'pingPong', cost: 40, icon: '🏓', es: 'Ping Pong Mascota', en: 'Pet Ping Pong' },
  { id: 'gallery', cost: 60, icon: '🖼️', es: 'Galería Arcade', en: 'Arcade Gallery' },
];

const COSTUMES = [
  { id: 'default', cost: 0, icon: '🐱', es: 'Benito clásico', en: 'Classic Benito' },
  { id: 'hero', cost: 15, icon: '🦸', es: 'Traje final', en: 'Final suit' },
  { id: 'deedee', cost: 30, icon: '👑', es: 'Deedee humano', en: 'Human Deedee' },
  { id: 'silva', cost: 45, icon: '🎩', es: 'Silva de gala', en: 'Formal Silva' },
];

export function Extras({ save, onBack, onSave }: { save: SaveData | null; onBack: () => void; onSave: (s: SaveData) => void }) {
  const lang = currentLang();
  const coins = save?.coins ?? 0;
  const unlocked = save?.unlockedMinigames ?? [];

  const buy = (id: string, cost: number) => {
    if (!save || coins < cost || unlocked.includes(id)) return;
    sfx('unlock');
    onSave({ ...save, coins: save.coins - cost, unlockedMinigames: [...unlocked, id] });
  };

  return (
    <div className="screen">
      <div className="panel">
        <div className="spread">
          <h2 className="section" style={{ flex: 1 }}>
            {t('extras.title')}
          </h2>
          <span className="badge gold">🪙 {coins}</span>
        </div>
        <div className="scroll">
          <h2 className="section">{t('extras.minigames')}</h2>
          {MINIGAMES.map((m) => {
            const has = unlocked.includes(m.id);
            return (
              <button
                key={m.id}
                className="level-row"
                disabled={!save || (!has && coins < m.cost)}
                onClick={() => buy(m.id, m.cost)}
              >
                <span className="idx">{m.icon}</span>
                <span className="meta">
                  <div className="lname">{lang === 'en' ? m.en : m.es}</div>
                  <div className="lstat">{has ? t('extras.unlocked') : t('extras.cost', { n: m.cost })}</div>
                </span>
                {has && <span className="badge green">✓</span>}
              </button>
            );
          })}

          <h2 className="section">{t('extras.costumes')}</h2>
          {COSTUMES.map((c) => {
            const has = c.cost === 0 || unlocked.includes(c.id);
            return (
              <button key={c.id} className="level-row" disabled={!save || (!has && coins < c.cost)} onClick={() => buy(c.id, c.cost)}>
                <span className="idx">{c.icon}</span>
                <span className="meta">
                  <div className="lname">{lang === 'en' ? c.en : c.es}</div>
                  <div className="lstat">{has ? t('extras.unlocked') : t('extras.cost', { n: c.cost })}</div>
                </span>
                {save?.costume === c.id && <span className="badge cyan">★</span>}
              </button>
            );
          })}

          <h2 className="section">{t('extras.gallery')}</h2>
          <div className="world-grid">
            {WORLDS.map((w) => (
              <div key={w.id} className="world-card">
                <div className="swatch" style={{ background: `#${w.color.toString(16).padStart(6, '0')}` }} />
                <div className="wname">{w.name[lang]}</div>
                <div className="wsub">{w.subtitle[lang]}</div>
              </div>
            ))}
          </div>
        </div>
        <button className="btn ghost" onClick={() => { sfx('uiBack'); onBack(); }}>
          ← {t('common.back')}
        </button>
      </div>
    </div>
  );
}

export function Credits({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <div className="panel narrow">
        <h2 className="section">{t('menu.credits')}</h2>
        <div className="scroll" style={{ lineHeight: 1.7, fontSize: 14 }}>
          <p>
            <b>BENITO ESCAPE</b>
          </p>
          <p className="dim">{t('credits.role.design')}</p>
          <p style={{ marginTop: 18 }}>
            <b>🐱 Benito</b> — {currentLang() === 'en' ? 'rogue pet hunter' : 'cazador de mascotas renegadas'}
            <br />
            <b>🐶 Deedee</b> — {currentLang() === 'en' ? 'tyrant chihuahua' : 'chihuahua tirano'}
            <br />
            <b>😼 Silva</b> — {currentLang() === 'en' ? 'loyal lieutenant' : 'lugarteniente leal'}
            <br />
            <b>🥽 Dr. Pelomántiz</b> — {currentLang() === 'en' ? 'inventor' : 'inventor'}
          </p>
          <p style={{ marginTop: 18 }} className="dim">
            {t('credits.note')}
          </p>
          <p className="dim">
            {currentLang() === 'en'
              ? 'Geometry, textures, animation, music and sound effects are generated at runtime — the game ships with no external asset files.'
              : 'Geometría, texturas, animación, música y efectos se generan en tiempo de ejecución: el juego no incluye ningún fichero de recursos externo.'}
          </p>
        </div>
        <button className="btn ghost" onClick={() => { sfx('uiBack'); onBack(); }}>
          ← {t('common.back')}
        </button>
      </div>
    </div>
  );
}

/** Pantalla de arranque con consejos rotatorios. */
export function Boot({ onStart }: { onStart: () => void }) {
  const [tip] = useState(() => `boot.tip${1 + Math.floor(Math.random() * 3)}`);
  useEffect(() => {
    const go = () => onStart();
    window.addEventListener('keydown', go, { once: true });
    return () => window.removeEventListener('keydown', go);
  }, [onStart]);
  return (
    <div className="loading" onClick={onStart}>
      <div className="spin-cat">🐱</div>
      <h1 className="title" style={{ fontSize: 'clamp(30px, 7vw, 62px)' }}>
        BENITO ESCAPE
      </h1>
      <div className="badge cyan">{t('menu.press')}</div>
      <p className="dim" style={{ maxWidth: 460, textAlign: 'center' }}>
        {t(tip)}
      </p>
    </div>
  );
}
