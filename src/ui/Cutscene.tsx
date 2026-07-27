/**
 * Reproductor de cinemáticas: escena 3D propia con los personajes reales,
 * planos de cámara por línea, texto escrito letra a letra y voces sintetizadas.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CUTSCENES, beatText, type Beat, type Shot } from '../content/story';
import { currentLang, t } from '../core/i18n';
import { playMusic, speak, stopMusic } from '../core/audio';
import { buildBenito, buildDeedee, buildProfessor, buildSilva } from '../engine/models';
import { createSkyDome, tickCelMaterials, updateCelLighting } from '../engine/celMaterial';
import { createAnimState, updateAnim } from '../engine/anim';

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
  narrator: { es: 'Narrador', en: 'Narrator' },
};

export default function Cutscene({ id, onDone }: { id: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const sceneRef = useRef<{ setShot: (s: Shot) => void; dispose: () => void } | null>(null);

  const scene = CUTSCENES[id];
  const lang = currentLang();
  const beat: Beat | undefined = scene?.beats[index];

  // ── Escena 3D ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scene) return;
    const ctl = buildCutsceneScene(canvas);
    sceneRef.current = ctl;
    playMusic(scene.music, 0.35);
    return () => {
      ctl.dispose();
      stopMusic(0.4);
    };
  }, [id, scene]);

  // ── Plano de cámara por línea ──
  useEffect(() => {
    if (beat && sceneRef.current) sceneRef.current.setShot(beat.shot);
  }, [beat]);

  // ── Texto escrito progresivamente ──
  useEffect(() => {
    if (!beat) return;
    const full = beatText(beat, lang);
    setTyped('');
    let i = 0;
    speak(beat.speaker, Math.min(10, full.length / 8));
    const timer = window.setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(timer);
    }, 22);
    return () => window.clearInterval(timer);
  }, [beat, lang]);

  const advance = () => {
    if (!scene) return onDone();
    const full = beat ? beatText(beat, lang) : '';
    if (typed.length < full.length) {
      setTyped(full);
      return;
    }
    if (index + 1 >= scene.beats.length) onDone();
    else setIndex(index + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ') {
        e.preventDefault();
        advance();
      }
      if (e.code === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!scene || !beat) return null;

  return (
    <div className="cutscene" onClick={advance}>
      <canvas ref={canvasRef} />
      <div className="bars" />
      <button
        className="btn small ghost skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        {t('common.skip')} ⏭
      </button>
      <div className="dialogue">
        <div className="speaker">
          {SPEAKER_ICON[beat.speaker]} {SPEAKER_NAME[beat.speaker][lang]}
        </div>
        <div className="text">{typed}</div>
        <div className="hint">
          ▶ {index + 1}/{scene.beats.length}
        </div>
      </div>
    </div>
  );
}

/** Construye la escena 3D de las cinemáticas con todos los personajes. */
function buildCutsceneScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 400);

  const sky = createSkyDome(0x3a2a7a, 0x0a0a1e, 300);
  scene.add(sky);
  scene.fog = new THREE.FogExp2(0x14163a, 0.012);
  updateCelLighting(new THREE.Vector3(0.4, 0.8, 0.5), new THREE.Color(0xfff0d0), new THREE.Color(0x6a6a9a), 1.5);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(8, 14, 10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x221133, 0.7));

  // Suelo del plató
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x1a1f42 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 32), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  const benito = buildBenito(true);
  const deedee = buildDeedee(true);
  const silva = buildSilva(true);
  const prof = buildProfessor();

  benito.root.position.set(-2.2, 0, 0);
  deedee.root.position.set(2.4, 0, 0.6);
  silva.root.position.set(4.6, 0, -1.2);
  prof.root.position.set(-4.6, 0, -1);
  deedee.root.rotation.y = -0.5;
  silva.root.rotation.y = -0.7;
  benito.root.rotation.y = 0.5;
  prof.root.rotation.y = 0.7;

  for (const r of [benito, deedee, silva, prof]) scene.add(r.root);

  const anims = [createAnimState(), createAnimState(), createAnimState(), createAnimState()];
  const rigs = [benito, deedee, silva, prof];

  const target = { pos: new THREE.Vector3(0, 2.4, 9), look: new THREE.Vector3(0, 1.4, 0), fov: 48 };
  camera.position.set(0, 2.4, 9);

  const setShot = (shot: Shot) => {
    switch (shot) {
      case 'benitoClose':
        target.pos.set(-1.2, 1.9, 2.6);
        target.look.set(-2.2, 1.45, 0);
        target.fov = 40;
        break;
      case 'deedeeClose':
        target.pos.set(3.3, 1.35, 2.6);
        target.look.set(2.4, 0.95, 0.6);
        target.fov = 36;
        break;
      case 'silvaClose':
        target.pos.set(5.6, 1.9, 1.6);
        target.look.set(4.6, 1.4, -1.2);
        target.fov = 38;
        break;
      case 'professorClose':
        target.pos.set(-3.7, 1.9, 1.8);
        target.look.set(-4.6, 1.4, -1);
        target.fov = 40;
        break;
      case 'lab':
        target.pos.set(-3, 3.4, 7);
        target.look.set(-2, 1.4, 0);
        target.fov = 50;
        break;
      case 'tower':
      case 'throne':
        target.pos.set(3, 4.6, 8.5);
        target.look.set(2.4, 1.6, 0.6);
        target.fov = 46;
        break;
      case 'timeMachine':
        target.pos.set(0, 6.5, 11);
        target.look.set(0, 1.2, 0);
        target.fov = 58;
        break;
      case 'park':
        target.pos.set(1.5, 2.2, 8);
        target.look.set(1.5, 1.1, 0);
        target.fov = 52;
        break;
      case 'sky':
        target.pos.set(0, 12, 16);
        target.look.set(0, 4, 0);
        target.fov = 60;
        break;
      case 'wide':
      default:
        target.pos.set(0, 3.2, 11);
        target.look.set(0, 1.5, 0);
        target.fov = 52;
        break;
    }
  };

  let raf = 0;
  let time = 0;
  const clock = new THREE.Clock();
  const lookAt = new THREE.Vector3(0, 1.4, 0);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    time += dt;
    tickCelMaterials(time);

    rigs.forEach((rig, i) => {
      updateAnim(rig, anims[i], {
        dt,
        speed: 0,
        maxSpeed: 8,
        onGround: true,
        verticalVel: 0,
        crouching: false,
        swimming: false,
      });
    });
    // La lengua de Deedee siempre se mueve un poco: rasgo constante del personaje
    const tongue = deedee.extras.tongue as THREE.Object3D | undefined;
    if (tongue) tongue.rotation.x = Math.sin(time * 3) * 0.12;

    camera.position.lerp(target.pos, Math.min(1, dt * 2.6));
    lookAt.lerp(target.look, Math.min(1, dt * 3.4));
    camera.lookAt(lookAt);
    camera.fov += (target.fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
    // Deriva lenta: evita el plano completamente estático
    camera.position.x += Math.sin(time * 0.4) * 0.004;

    renderer.render(scene, camera);
  };
  loop();

  return {
    setShot,
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
