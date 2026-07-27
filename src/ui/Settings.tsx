/** Ajustes: gráficos, audio, idioma, accesibilidad y remapeo de controles. */
import { useEffect, useState } from 'react';
import { t } from '../core/i18n';
import {
  DEFAULT_BINDINGS,
  getSettings,
  resetBindings,
  setSettings,
  type Bindings,
  type Lang,
  type Quality,
} from '../core/settings';
import { captureNextKey, keyLabel } from '../core/input';
import { sfx } from '../core/audio';

const BIND_LABELS: Record<keyof Bindings, { es: string; en: string }> = {
  forward: { es: 'Adelante', en: 'Forward' },
  back: { es: 'Atrás', en: 'Back' },
  left: { es: 'Izquierda', en: 'Left' },
  right: { es: 'Derecha', en: 'Right' },
  jump: { es: 'Saltar', en: 'Jump' },
  attack: { es: 'Usar artefacto', en: 'Use gadget' },
  sneak: { es: 'Agacharse', en: 'Crouch' },
  aim: { es: 'Puntería 1ª persona', en: 'First-person aim' },
  gadgetNext: { es: 'Artefacto siguiente', en: 'Next gadget' },
  gadgetPrev: { es: 'Artefacto anterior', en: 'Previous gadget' },
  camLeft: { es: 'Cámara izquierda', en: 'Camera left' },
  camRight: { es: 'Cámara derecha', en: 'Camera right' },
  camUp: { es: 'Cámara arriba', en: 'Camera up' },
  camDown: { es: 'Cámara abajo', en: 'Camera down' },
  pause: { es: 'Pausa', en: 'Pause' },
  radar: { es: 'Radar', en: 'Radar' },
};

export default function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState(getSettings());
  const [listening, setListening] = useState<keyof Bindings | null>(null);
  const [tab, setTab] = useState<'graphics' | 'audio' | 'controls' | 'access'>('graphics');

  const patch = (p: Parameters<typeof setSettings>[0]) => {
    setS(setSettings(p));
    sfx('uiMove');
  };

  useEffect(() => {
    if (!listening) return;
    const cancel = captureNextKey((code) => {
      const next: Bindings = { ...getSettings().bindings, [listening]: [code] };
      setS(setSettings({ bindings: next }));
      setListening(null);
      sfx('uiConfirm');
    });
    return cancel;
  }, [listening]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className="screen">
      <div className="panel">
        <h2 className="section">{t('settings.title')}</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          {(['graphics', 'audio', 'controls', 'access'] as const).map((k) => (
            <button
              key={k}
              className={`btn small ${tab === k ? 'primary' : 'ghost'}`}
              onClick={() => {
                sfx('uiMove');
                setTab(k);
              }}
            >
              {k === 'graphics'
                ? `🖥 ${t('settings.graphics')}`
                : k === 'audio'
                  ? `🔊 ${t('settings.audio')}`
                  : k === 'controls'
                    ? `🎮 ${t('settings.controls')}`
                    : `♿ ${t('settings.accessibility')}`}
            </button>
          ))}
        </div>

        <div className="scroll">
          {tab === 'graphics' && (
            <>
              <div className="setting">
                <label>{t('settings.quality')}</label>
                <div className="seg">
                  {(['low', 'medium', 'high'] as Quality[]).map((q) => (
                    <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => patch({ quality: q })}>
                      {t(`settings.${q}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting">
                <label>{t('settings.fullscreen')}</label>
                <button className="btn small" onClick={toggleFullscreen}>
                  ⛶
                </button>
              </div>
              <div className="setting">
                <label>{t('settings.language')}</label>
                <div className="seg">
                  {(['es', 'en'] as Lang[]).map((l) => (
                    <button key={l} className={s.lang === l ? 'on' : ''} onClick={() => patch({ lang: l })}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting">
                <label>{t('settings.subtitles')}</label>
                <Toggle value={s.subtitles} onChange={(v) => patch({ subtitles: v })} />
              </div>
              <p className="dim">
                {s.quality === 'low'
                  ? 'Sin sombras ni contornos, menor densidad de vegetación. Recomendado en móvil.'
                  : s.quality === 'medium'
                    ? 'Sombras activas, contornos de dibujo animado y densidad media.'
                    : 'Sombras suaves, contornos, vegetación completa y mayor resolución.'}
              </p>
            </>
          )}

          {tab === 'audio' && (
            <>
              <div className="setting">
                <label>{t('settings.music')}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={s.musicVolume}
                  onChange={(e) => setS(setSettings({ musicVolume: Number(e.target.value) }))}
                />
              </div>
              <div className="setting">
                <label>{t('settings.sfx')}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={s.sfxVolume}
                  onChange={(e) => {
                    setS(setSettings({ sfxVolume: Number(e.target.value) }));
                    sfx('uiMove');
                  }}
                />
              </div>
            </>
          )}

          {tab === 'controls' && (
            <>
              <div className="setting">
                <label>{t('settings.sensitivity')}</label>
                <input
                  type="range"
                  min={0.3}
                  max={2.5}
                  step={0.1}
                  value={s.camSensitivity}
                  onChange={(e) => setS(setSettings({ camSensitivity: Number(e.target.value) }))}
                />
              </div>
              <div className="setting">
                <label>{t('settings.invertY')}</label>
                <Toggle value={s.invertY} onChange={(v) => patch({ invertY: v })} />
              </div>
              <div className="setting">
                <label>{t('settings.touch')}</label>
                <div className="seg">
                  {(['auto', 'on', 'off'] as const).map((v) => (
                    <button key={v} className={s.touchControls === v ? 'on' : ''} onClick={() => patch({ touchControls: v })}>
                      {v.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {(Object.keys(DEFAULT_BINDINGS) as (keyof Bindings)[]).map((k) => (
                <div className="keybind" key={k}>
                  <span>{BIND_LABELS[k][s.lang]}</span>
                  <button
                    className={`keycap ${listening === k ? 'listening' : ''}`}
                    onClick={() => setListening(k)}
                  >
                    {listening === k ? t('settings.rebind') : s.bindings[k].map(keyLabel).join(' / ')}
                  </button>
                </div>
              ))}
              <button
                className="btn small ghost"
                onClick={() => {
                  resetBindings();
                  setS(getSettings());
                  sfx('uiBack');
                }}
              >
                ↺ {t('settings.reset')}
              </button>
            </>
          )}

          {tab === 'access' && (
            <>
              <div className="setting">
                <label>{t('settings.bigIcons')}</label>
                <Toggle value={s.bigIcons} onChange={(v) => patch({ bigIcons: v })} />
              </div>
              <div className="setting">
                <label>{t('settings.colorBlind')}</label>
                <Toggle value={s.colorBlindSafe} onChange={(v) => patch({ colorBlindSafe: v })} />
              </div>
              <div className="setting">
                <label>{t('settings.shake')}</label>
                <Toggle value={s.screenShake} onChange={(v) => patch({ screenShake: v })} />
              </div>
              <p className="dim">
                {s.colorBlindSafe
                  ? 'Las luces de casco usan azul / blanco / magenta en lugar de azul / amarillo / rojo.'
                  : 'Las luces de casco usan la escala azul → amarillo → rojo.'}
              </p>
            </>
          )}
        </div>

        <button className="btn ghost" onClick={() => { sfx('uiBack'); onBack(); }}>
          ← {t('common.back')}
        </button>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="seg">
      <button className={value ? 'on' : ''} onClick={() => onChange(true)}>
        {t('common.on')}
      </button>
      <button className={!value ? 'on' : ''} onClick={() => onChange(false)}>
        {t('common.off')}
      </button>
    </div>
  );
}
