/** HUD de juego: energía, vidas, minimapa, contador y selector de artefactos. */
import { useEffect, useRef, useState } from 'react';
import { on, type HudState, type MinimapState } from '../core/events';
import { GADGETS, type GadgetId } from '../content/gadgets';
import { t } from '../core/i18n';
import { getSettings } from '../core/settings';

type Toast = { id: number; text: string; icon?: string };

export default function Hud({ showBanner }: { showBanner: { world: string; level: string } | null }) {
  const [hud, setHud] = useState<HudState | null>(null);
  const [map, setMap] = useState<MinimapState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [boss, setBoss] = useState<{ name: string; hp: number; max: number; phase: number } | null>(null);
  const [fps, setFps] = useState(0);
  const [hurt, setHurt] = useState(0);
  const toastId = useRef(0);
  const lastHealth = useRef(100);

  useEffect(() => {
    const offs = [
      on('hud', (h) => {
        if (h.health < lastHealth.current - 0.5) setHurt((v) => v + 1);
        lastHealth.current = h.health;
        setHud(h);
      }),
      on('minimap', setMap),
      on('bossHealth', setBoss),
      on('fps', setFps),
      on('toast', (t0) => {
        const id = ++toastId.current;
        setToasts((prev) => [...prev.slice(-3), { id, text: t(t0.key, t0.params), icon: t0.icon }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 1900);
      }),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  if (!hud) return null;
  const s = getSettings();
  const scale = s.bigIcons ? 1.35 : 1;

  return (
    <div className="hud" style={{ ['--hud-scale' as string]: scale }}>
      <div className="vignette" />
      {hurt > 0 && <div className="hurt-flash" key={hurt} />}

      <div className="hud-topleft">
        <div className="lives">{'🐾'.repeat(Math.max(0, hud.lives))}</div>
        <div className="meter health">
          <div className="fill" style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }} />
        </div>
        <div className="meter energy">
          <div className="fill" style={{ width: `${(hud.energy / hud.maxEnergy) * 100}%` }} />
        </div>
        {hud.timeFrozen > 0 && <div className="badge cyan">⏱ {hud.timeFrozen.toFixed(1)}s</div>}
        {hud.radarActive && <div className="badge green">📡 RADAR</div>}
        {hud.firstPerson && <div className="badge purple">🎯 1ª PERSONA</div>}
      </div>

      <div className="hud-topright">
        <div className="pet-counter">
          🕸️ {hud.petsCaught}/{hud.petsTotal}
          <small>
            {t('hud.pets')} · {hud.petsRequired} min
          </small>
        </div>
        <Minimap map={map} />
        <div className="pet-counter" style={{ fontSize: 13, borderColor: '#40e0ff' }}>
          🪙 {hud.coins}
        </div>
      </div>

      {boss && (
        <div className="boss-bar">
          <div className="name">{boss.name}</div>
          <div className="track">
            <div className="fill" style={{ width: `${(boss.hp / boss.max) * 100}%` }} />
          </div>
          <div className="phase">FASE {boss.phase}</div>
        </div>
      )}

      <div className="toasts">
        {toasts.map((x) => (
          <div className="toast" key={x.id}>
            {x.icon} {x.text}
          </div>
        ))}
      </div>

      <div className="hud-bottom">
        {hud.gadgets.map((g, i) => (
          <div className={`gadget-slot ${g === hud.gadget ? 'active' : ''}`} key={g} title={t(`gadget.${g}`)}>
            {GADGETS[g as GadgetId]?.icon ?? '❔'}
            <span className="key">{i + 1}</span>
          </div>
        ))}
      </div>

      {showBanner && (
        <div className="level-banner">
          <div className="world">{showBanner.world}</div>
          <div className="name">{showBanner.level}</div>
        </div>
      )}

      <div className="fps">{fps} FPS</div>
    </div>
  );
}

function Minimap({ map }: { map: MinimapState | null }) {
  if (!map) return <div className="minimap" />;
  const colors: Record<string, string> = {
    coin: '#ffd23f',
    cookie: '#d9a05a',
    exit: '#40e0ff',
    boss: '#ff2a4a',
  };
  const alertColors = ['#40a0ff', '#ffd23f', '#ff3a3a'];

  return (
    <div className="minimap">
      {map.blips.map((b, i) => {
        // Proyección al espacio de la cámara: "arriba" es siempre hacia delante.
        // Adelante en el mundo es (sin yaw, cos yaw); la derecha, (cos yaw, -sin yaw).
        const dx = b.x - map.px;
        const dz = b.z - map.pz;
        const c = Math.cos(map.pyaw);
        const s = Math.sin(map.pyaw);
        const right = dx * c - dz * s;
        const fwd = dx * s + dz * c;
        const scale = 46 / map.radius;
        const px = 50 + right * scale;
        const py = 50 - fwd * scale;
        if (px < 3 || px > 97 || py < 3 || py > 97) return null;
        const color = b.kind === 'pet' ? alertColors[b.alert ?? 0] : colors[b.kind] ?? '#fff';
        return (
          <span
            key={i}
            className={`blip ${b.kind}`}
            style={{ left: `${px}%`, top: `${py}%`, color }}
          />
        );
      })}
      <div className="self" />
    </div>
  );
}
