/**
 * Máquina de estados de pantallas y puente entre React y el motor.
 * React se ocupa de menús, HUD y cinemáticas; el motor, del mundo 3D.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './engine/game';
import { installInput } from './core/input';
import { initAudio, playMusic, resumeAudio, stopMusic } from './core/audio';
import { on } from './core/events';
import { getSettings, onSettingsChange } from './core/settings';
import { currentLang } from './core/i18n';
import { getWorld, nextLevelId, type LevelSpec } from './content/worlds';
import { recordLevel, writeSave, listSaves, type SaveData } from './core/save';
import type { GadgetId } from './content/gadgets';
import { Boot, Credits, Extras, MainMenu, MenuBackground, SaveSlots } from './ui/Menus';
import WorldMap from './ui/WorldMap';
import SettingsPanel from './ui/Settings';
import Hud from './ui/Hud';
import Cutscene from './ui/Cutscene';
import { Comms, GameOver, LoadingScreen, PauseMenu, Results, TouchControls } from './ui/Overlays';

type Screen =
  | 'boot'
  | 'menu'
  | 'slots'
  | 'settings'
  | 'extras'
  | 'credits'
  | 'map'
  | 'cutscene'
  | 'loading'
  | 'play'
  | 'results'
  | 'gameover';

type PendingResult = {
  levelId: string;
  caught: number;
  total: number;
  coins: number;
  time: number;
  gadgetUnlocked?: string;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('boot');
  const [prevScreen, setPrevScreen] = useState<Screen>('menu');
  const [save, setSave] = useState<SaveData | null>(null);
  const [cutsceneId, setCutsceneId] = useState<string | null>(null);
  const [pendingLevel, setPendingLevel] = useState<LevelSpec | null>(null);
  const [result, setResult] = useState<PendingResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [comms, setComms] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ world: string; level: string } | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const saveRef = useRef<SaveData | null>(null);
  const playStart = useRef(0);
  const commsSeq = useRef(0);

  saveRef.current = save;

  // ── Entrada y detección táctil ──
  useEffect(() => {
    const uninstall = installInput();
    const setting = getSettings().touchControls;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setIsTouch(setting === 'on' || (setting === 'auto' && coarse));
    const off = onSettingsChange((s) => {
      setIsTouch(s.touchControls === 'on' || (s.touchControls === 'auto' && coarse));
    });
    return () => {
      uninstall();
      off();
    };
  }, []);

  // ── Pausa solicitada por el motor (tecla ESC) ──
  useEffect(() => {
    return on('requestPause', () => {
      setPaused((p) => {
        const next = !p;
        gameRef.current?.setPaused(next);
        return next;
      });
    });
  }, []);

  // ── Redimensionado ──
  useEffect(() => {
    const onResize = () => gameRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Música de menús ──
  useEffect(() => {
    if (screen === 'menu' || screen === 'slots' || screen === 'extras' || screen === 'credits') {
      playMusic('menu', 0.4);
    } else if (screen === 'map') {
      playMusic('hub', 0.4);
    }
  }, [screen]);

  const persist = useCallback((next: SaveData) => {
    writeSave(next);
    setSave({ ...next });
  }, []);

  // ─────────────────────── Flujo de nivel ───────────────────────

  const startLevel = useCallback(
    (spec: LevelSpec) => {
      setPendingLevel(spec);
      setScreen('loading');
      // Un frame de respiro para que se pinte la pantalla de carga
      window.setTimeout(() => setScreen('play'), 60);
    },
    [],
  );

  const requestLevel = useCallback(
    (spec: LevelSpec) => {
      const s = saveRef.current;
      const worldCutscene = spec.worldId >= 2 ? `world${spec.worldId}` : null;
      const isFirstOfWorld = spec.id.endsWith('-1');
      if (s && worldCutscene && isFirstOfWorld && !s.seenCutscenes.includes(worldCutscene)) {
        persist({ ...s, seenCutscenes: [...s.seenCutscenes, worldCutscene] });
        setPendingLevel(spec);
        setCutsceneId(worldCutscene);
        setScreen('cutscene');
        return;
      }
      startLevel(spec);
    },
    [persist, startLevel],
  );

  // ── Creación del motor al entrar en 'play' ──
  useEffect(() => {
    if (screen !== 'play' || !pendingLevel) return;
    const canvas = canvasRef.current;
    const s = saveRef.current;
    if (!canvas || !s) return;

    resumeAudio();

    const game = new Game(canvas, {
      onLevelComplete: (r) => {
        setResult(r);
        setScreen('results');
      },
      onGameOver: () => setScreen('gameover'),
      onComms: (key) => {
        commsSeq.current++;
        setComms(`${key}#${commsSeq.current}`);
      },
    });
    gameRef.current = game;
    game.loadLevel(pendingLevel.id, s.gadgets as GadgetId[], 3);
    game.start();

    // Gancho de depuración: con ?debug en la URL se expone el motor para poder
    // inspeccionarlo y automatizar pruebas de juego desde la consola.
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { benito?: Game }).benito = game;
    }
    playStart.current = performance.now();

    const world = getWorld(pendingLevel.worldId);
    const lang = currentLang();
    setBanner({
      world: world ? world.name[lang] : '',
      level: pendingLevel.name[lang],
    });
    window.setTimeout(() => setBanner(null), 3300);

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [screen, pendingLevel]);

  // ── Tiempo jugado ──
  useEffect(() => {
    if (screen !== 'play') return;
    const id = window.setInterval(() => {
      const s = saveRef.current;
      if (!s) return;
      s.playTime += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  const finishResults = useCallback(() => {
    const s = saveRef.current;
    const r = result;
    if (!s || !r) {
      setScreen('map');
      return;
    }
    const next = { ...s, levels: { ...s.levels } };
    recordLevel(next, r.levelId, r.caught, r.total, r.coins, r.time, true);
    if (r.gadgetUnlocked && !next.gadgets.includes(r.gadgetUnlocked)) {
      next.gadgets = [...next.gadgets, r.gadgetUnlocked];
    }
    const nid = nextLevelId(r.levelId);
    if (nid) {
      next.levelId = nid;
      next.worldId = Number(nid.split('-')[0]);
    }
    persist(next);
    setResult(null);

    // El final del juego lleva al epílogo
    if (r.levelId === '8-1') {
      setCutsceneId('ending');
      setScreen('cutscene');
      setPendingLevel(null);
      return;
    }
    setScreen('map');
  }, [result, persist]);

  const quitToMap = useCallback(() => {
    const s = saveRef.current;
    const game = gameRef.current;
    if (s && game && pendingLevel) {
      const snap = game.snapshot();
      const next = { ...s, levels: { ...s.levels } };
      recordLevel(next, pendingLevel.id, snap.caught, snap.caught, snap.coins, snap.time, false);
      persist(next);
    }
    setPaused(false);
    stopMusic(0.4);
    setScreen('map');
  }, [pendingLevel, persist]);

  const restartLevel = useCallback(() => {
    if (!pendingLevel) return;
    setPaused(false);
    setScreen('loading');
    window.setTimeout(() => setScreen('play'), 80);
  }, [pendingLevel]);

  // ─────────────────────── Render ───────────────────────

  const showCanvas = screen === 'play' || screen === 'results' || screen === 'gameover';
  const showMenuBg = ['menu', 'slots', 'settings', 'extras', 'credits', 'map'].includes(screen);

  return (
    <div className="app">
      {showMenuBg && <MenuBackground />}
      {showCanvas && <canvas ref={canvasRef} className="game-canvas" />}

      {screen === 'boot' && (
        <Boot
          onStart={() => {
            initAudio();
            resumeAudio();
            setScreen('menu');
          }}
        />
      )}

      {screen === 'menu' && (
        <MainMenu
          hasSaves={listSaves().some(Boolean)}
          onNewGame={() => setScreen('slots')}
          onContinue={() => {
            const first = listSaves().find(Boolean);
            if (first) {
              setSave(first);
              setScreen('map');
            } else setScreen('slots');
          }}
          onSettings={() => {
            setPrevScreen('menu');
            setScreen('settings');
          }}
          onExtras={() => setScreen('extras')}
          onCredits={() => setScreen('credits')}
        />
      )}

      {screen === 'slots' && (
        <SaveSlots
          onBack={() => setScreen('menu')}
          onPick={(picked, isNew) => {
            writeSave(picked);
            setSave(picked);
            if (isNew) {
              persist({ ...picked, seenCutscenes: ['opening'] });
              setCutsceneId('opening');
              setPendingLevel(null);
              setScreen('cutscene');
            } else {
              setScreen('map');
            }
          }}
        />
      )}

      {screen === 'extras' && (
        <Extras save={save ?? listSaves().find(Boolean) ?? null} onBack={() => setScreen('menu')} onSave={persist} />
      )}

      {screen === 'credits' && <Credits onBack={() => setScreen('menu')} />}

      {screen === 'settings' && <SettingsPanel onBack={() => setScreen(prevScreen)} />}

      {screen === 'map' && save && (
        <WorldMap
          save={save}
          onPlay={requestLevel}
          onSettings={() => {
            setPrevScreen('map');
            setScreen('settings');
          }}
          onQuit={() => {
            const s = saveRef.current;
            if (s) writeSave(s);
            setScreen('menu');
          }}
        />
      )}

      {screen === 'cutscene' && cutsceneId && (
        <Cutscene
          id={cutsceneId}
          onDone={() => {
            setCutsceneId(null);
            if (pendingLevel) startLevel(pendingLevel);
            else setScreen('map');
          }}
        />
      )}

      {screen === 'loading' && <LoadingScreen label={pendingLevel?.name[currentLang()] ?? ''} />}

      {screen === 'play' && (
        <>
          <Hud showBanner={banner} />
          <Comms commsKey={comms ? comms.split('#')[0] : null} />
          {isTouch && !paused && <TouchControls />}
          {paused && (
            <PauseMenu
              gadgets={save?.gadgets ?? []}
              onResume={() => {
                setPaused(false);
                gameRef.current?.setPaused(false);
              }}
              onRestart={restartLevel}
              onSettings={() => {
                setPrevScreen('play');
                setScreen('settings');
              }}
              onSave={() => {
                const s = saveRef.current;
                if (s) writeSave(s);
              }}
              onQuit={quitToMap}
            />
          )}
        </>
      )}

      {screen === 'results' && result && (
        <Results
          caught={result.caught}
          total={result.total}
          coins={result.coins}
          time={result.time}
          gadgetUnlocked={result.gadgetUnlocked}
          onNext={finishResults}
        />
      )}

      {screen === 'gameover' && (
        <GameOver
          onRetry={restartLevel}
          onQuit={() => {
            setPaused(false);
            setScreen('map');
          }}
        />
      )}
    </div>
  );
}
