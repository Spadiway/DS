/** Pausa, resultados de nivel, fin de partida, comunicador y controles táctiles. */
import { useEffect, useRef, useState } from 'react';
import { formatTime, t, currentLang } from '../core/i18n';
import { GADGETS, type GadgetId } from '../content/gadgets';
import { sfx, speak } from '../core/audio';
import { COMMS } from '../content/story';
import { getSettings } from '../core/settings';
import { touch } from '../core/input';

export function PauseMenu({
  onResume,
  onRestart,
  onSettings,
  onSave,
  onQuit,
  gadgets,
}: {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onSave: () => void;
  onQuit: () => void;
  gadgets: string[];
}) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="overlay">
      <div className="panel narrow">
        <h2 className="section">⏸ {t('pause.title')}</h2>
        <button className="btn primary" onClick={() => { sfx('uiConfirm'); onResume(); }}>
          ▶ {t('pause.resume')}
        </button>
        <button className="btn" onClick={() => { sfx('uiConfirm'); onRestart(); }}>
          ↺ {t('pause.restart')}
        </button>
        <button className="btn" onClick={() => { sfx('uiConfirm'); onSettings(); }}>
          ⚙️ {t('menu.settings')}
        </button>
        <button
          className="btn"
          onClick={() => {
            sfx('unlock');
            onSave();
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1600);
          }}
        >
          💾 {saved ? t('pause.saved') : t('pause.save')}
        </button>
        <button className="btn ghost" onClick={() => { sfx('uiBack'); onQuit(); }}>
          ← {t('pause.quit')}
        </button>

        <h2 className="section" style={{ marginTop: 16 }}>
          {t('pause.gadgets')}
        </h2>
        <div className="scroll" style={{ maxHeight: 200 }}>
          {gadgets.map((g) => (
            <div className="level-row" key={g} style={{ cursor: 'default' }}>
              <span className="idx">{GADGETS[g as GadgetId]?.icon}</span>
              <span className="meta">
                <div className="lname">{t(`gadget.${g}`)}</div>
                <div className="lstat">{t(`gadget.${g}.desc`)}</div>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Results({
  caught,
  total,
  coins,
  time,
  gadgetUnlocked,
  onNext,
}: {
  caught: number;
  total: number;
  coins: number;
  time: number;
  gadgetUnlocked?: string;
  onNext: () => void;
}) {
  useEffect(() => {
    sfx('unlock');
  }, []);
  return (
    <div className="overlay">
      <div className="panel narrow">
        <h2 className="section">🏆 {t('results.title')}</h2>
        <div className="result-line">
          <span>🕸️ {t('results.caught')}</span>
          <b>
            {caught} / {total}
          </b>
        </div>
        <div className="result-line">
          <span>🪙 {t('results.coins')}</span>
          <b>{coins}</b>
        </div>
        <div className="result-line">
          <span>⏱ {t('results.time')}</span>
          <b>{formatTime(time)}</b>
        </div>

        {gadgetUnlocked && (
          <div className="gadget-reveal">
            <div className="icon">{GADGETS[gadgetUnlocked as GadgetId]?.icon}</div>
            <div className="subtitle">{t('results.newGadget')}</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{t(`gadget.${gadgetUnlocked}`)}</div>
            <div className="dim">{t(`gadget.${gadgetUnlocked}.desc`)}</div>
          </div>
        )}

        <button className="btn primary" onClick={() => { sfx('uiConfirm'); onNext(); }}>
          ▶ {t('results.next')}
        </button>
      </div>
    </div>
  );
}

export function GameOver({ onRetry, onQuit }: { onRetry: () => void; onQuit: () => void }) {
  useEffect(() => {
    speak('deedee', 8);
  }, []);
  return (
    <div className="overlay">
      <div className="panel narrow" style={{ textAlign: 'center', borderColor: 'var(--ui-red)' }}>
        <h1 className="title" style={{ fontSize: 'clamp(30px, 7vw, 56px)' }}>
          {t('gameover.title')}
        </h1>
        <p className="dim">😈 {t('gameover.text')}</p>
        <button className="btn primary" onClick={() => { sfx('uiConfirm'); onRetry(); }}>
          ↺ {t('gameover.retry')}
        </button>
        <button className="btn ghost" onClick={() => { sfx('uiBack'); onQuit(); }}>
          ← {t('gameover.quit')}
        </button>
      </div>
    </div>
  );
}

const SPEAKER_ICON: Record<string, string> = {
  benito: '🐱',
  deedee: '🐶',
  silva: '😼',
  professor: '🥽',
  narrator: '📖',
};

const SPEAKER_NAME: Record<string, { es: string; en: string }> = {
  benito: { es: 'Benito', en: 'Benito' },
  deedee: { es: 'Deedee', en: 'Deedee' },
  silva: { es: 'Silva', en: 'Silva' },
  professor: { es: 'Dr. Pelomántiz', en: 'Dr. Furmantis' },
  narrator: { es: '', en: '' },
};

/** Ventana del comunicador del Profesor durante el juego. */
export function Comms({ commsKey }: { commsKey: string | null }) {
  const [visible, setVisible] = useState<string | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    if (!commsKey) return;
    const entry = COMMS[commsKey];
    if (!entry) return;
    setVisible(commsKey);
    speak(entry.speaker, 6);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(null), 4200);
    return () => window.clearTimeout(timer.current);
  }, [commsKey]);

  if (!visible || !getSettings().subtitles) return null;
  const entry = COMMS[visible];
  if (!entry) return null;
  const lang = currentLang();

  return (
    <div className="comms">
      <div className="portrait">{SPEAKER_ICON[entry.speaker]}</div>
      <div className="who">{SPEAKER_NAME[entry.speaker][lang]}</div>
      <div className="line">{lang === 'en' ? entry.en : entry.es}</div>
    </div>
  );
}

/** Joystick virtual + botones para tableta y móvil. */
export function TouchControls() {
  const stickRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookPrev = useRef({ x: 0, y: 0 });

  useEffect(() => {
    touch.active = true;
    return () => {
      touch.active = false;
      touch.moveX = 0;
      touch.moveY = 0;
      touch.lookX = 0;
      touch.lookY = 0;
      touch.jump = false;
      touch.attack = false;
      touch.sneak = false;
      touch.aim = false;
    };
  }, []);

  const onStickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    const el = stickRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setKnob({ x: dx * 34, y: dy * 34 });
    touch.moveX = dx;
    touch.moveY = -dy;
  };

  const endStick = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    touch.moveX = 0;
    touch.moveY = 0;
  };

  const hold = (key: 'jump' | 'attack' | 'sneak' | 'aim', v: boolean) => () => {
    touch[key] = v;
  };

  return (
    <div className="touch-layer">
      <div
        className="touch-look"
        onPointerDown={(e) => {
          lookId.current = e.pointerId;
          lookPrev.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (lookId.current !== e.pointerId) return;
          touch.lookX = (e.clientX - lookPrev.current.x) * 0.012;
          touch.lookY = (e.clientY - lookPrev.current.y) * 0.008;
          lookPrev.current = { x: e.clientX, y: e.clientY };
          window.setTimeout(() => {
            touch.lookX = 0;
            touch.lookY = 0;
          }, 60);
        }}
        onPointerUp={() => {
          lookId.current = null;
          touch.lookX = 0;
          touch.lookY = 0;
        }}
      />
      <div
        className="touch-stick"
        ref={stickRef}
        onPointerDown={(e) => {
          stickId.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          onStickMove(e);
        }}
        onPointerMove={onStickMove}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        <button className="touch-btn" onPointerDown={hold('sneak', true)} onPointerUp={hold('sneak', false)} onPointerLeave={hold('sneak', false)}>
          🐾
        </button>
        <button className="touch-btn" onPointerDown={hold('attack', true)} onPointerUp={hold('attack', false)} onPointerLeave={hold('attack', false)}>
          🕸️
        </button>
        <button className="touch-btn" onPointerDown={hold('aim', true)} onPointerUp={hold('aim', false)} onPointerLeave={hold('aim', false)}>
          🎯
        </button>
        <button className="touch-btn" onPointerDown={hold('jump', true)} onPointerUp={hold('jump', false)} onPointerLeave={hold('jump', false)}>
          ⤴
        </button>
      </div>
    </div>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setP((v) => Math.min(96, v + 3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="loading">
      <div className="spin-cat">🐱</div>
      <div className="subtitle">{label}</div>
      <div className="bar">
        <div style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
