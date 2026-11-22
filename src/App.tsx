import { useCallback, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { MenuScreen } from './components/MenuScreen';
import { ControlsModal, PauseModal, ResultModal } from './components/Modals';
import { Game } from './game/Game';
import {
  loadSavedGraphicsSettings,
  saveGraphicsSettings,
} from './game/graphics/GraphicsSettings';
import { SCENARIOS } from './game/rules/scenarios';
import type { GameConfig, HudSnapshot } from './game/types';

function createInitialConfig(): GameConfig {
  return {
    vehicle: 'wave110',
    map: 'boulevard',
    mode: 'free',
    scenarioId: 1,
    timeOfDay: 'noon',
    weather: 'clear',
    density: 'medium',
    volume: 0.7,
    muted: false,
    graphics: loadSavedGraphicsSettings(),
  };
}

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  speedKmh: 0,
  rpm: 1400,
  maxRpm: 9000,
  gear: 1,
  vehicle: 'wave110',
  map: 'boulevard',
  mode: 'free',
  cameraMode: 0,
  headlight: 0,
  signalLeft: false,
  signalRight: false,
  hazard: false,
  hornActive: false,
  speedLimitKmh: 60,
  currentRoadName: 'Đại lộ Võ Văn Kiệt',
  laneNote: 'Đi bên phải đúng làn',
  gplxPoints: 12,
  maxGplxPoints: 12,
  violations: [],
  latestViolation: null,
  distanceKm: 0,
  elapsedSec: 0,
  minimapExpanded: false,
  scenarioTitle: null,
  scenarioHint: null,
  scenarioStepText: null,
  scenarioProgress: 0,
  scenarioDistanceM: 0,
  scenarioPassed: null,
  scenarioEndReason: null,
  scenarioDebrief: null,
  nearSignalState: 'none',
  nearSignalCountdown: 0,
  nearRightOnRedAllowed: false,
  ambulanceNearby: false,
  trainComing: false,
  lookAngle: 0,
  fps: 60,
  drawCalls: 0,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [config, setConfig] = useState<GameConfig>(createInitialConfig);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [showControls, setShowControls] = useState(false);

  // Mount WebGLRenderer & Game loop ONCE (never torn down on HUD state updates!)
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const initial = createInitialConfig();
    const params = new URLSearchParams(window.location.search);
    if (params.get('showfps') === '1') {
      initial.graphics = { ...initial.graphics, showFps: true };
      setConfig(initial);
    }

    const game = new Game(el, initial, (snap) => {
      setHud(snap);
    });
    gameRef.current = game;

    // Support ?autostart=1 (and optional ?vehicle=sedan&map=oldquarter&camera=3) for testing & instant launch
    if (params.get('autostart') === '1') {
      const v = params.get('vehicle');
      const m = params.get('map');
      const sc = params.get('scenario');
      const override: Partial<GameConfig> = {};
      if (v === 'wave110' || v === 'vision110' || v === 'sedan') override.vehicle = v;
      if (m === 'boulevard' || m === 'oldquarter' || m === 'residential' || m === 'highway') override.map = m;
      if (sc) {
        const id = Number(sc);
        if (id >= 1 && id <= SCENARIOS.length) {
          override.mode = 'scenario';
          override.scenarioId = id;
        }
      }
      setConfig((prev) => ({ ...prev, ...override }));
      game.startGame(override, false);
      const cam = params.get('camera');
      if (cam === '0' || cam === '1' || cam === '2' || cam === '3') {
        game.setCameraMode(Number(cam) as 0 | 1 | 2 | 3);
      }
    }

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const handleMenuChange = useCallback((partial: Partial<GameConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial, graphics: partial.graphics ? { ...partial.graphics } : prev.graphics };
      if (partial.graphics) {
        saveGraphicsSettings(next.graphics);
      }
      gameRef.current?.updateConfig(partial, false);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    setShowControls(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
    gameRef.current?.startGame(config);
  }, [config]);

  const handlePauseUpdate = useCallback((partial: Partial<GameConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial, graphics: partial.graphics ? { ...partial.graphics } : prev.graphics };
      if (partial.graphics) {
        saveGraphicsSettings(next.graphics);
      }
      return next;
    });
    gameRef.current?.updateConfig(partial, Boolean(partial.map));
  }, []);

  const handleNextScenario = useCallback(() => {
    const nextId = Math.min(SCENARIOS.length, config.scenarioId + 1);
    const sc = SCENARIOS.find((s) => s.id === nextId) ?? SCENARIOS[0];
    const nextCfg: GameConfig = {
      ...config,
      mode: 'scenario',
      scenarioId: nextId,
      map: sc.map,
      vehicle: sc.recommendedVehicle,
      timeOfDay: sc.timeOfDay,
      weather: sc.weather,
      density: sc.density,
    };
    setConfig(nextCfg);
    gameRef.current?.startGame(nextCfg);
  }, [config]);

  const handleBindMinimap = useCallback((canvas: HTMLCanvasElement | null) => {
    gameRef.current?.setMinimapCanvas(canvas);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Dedicated isolated WebGL canvas container */}
      <div ref={mountRef} data-testid="webgl-viewport" style={{ position: 'absolute', inset: 0 }} />

      {hud.phase === 'title' && (
        <MenuScreen
          config={config}
          onChange={handleMenuChange}
          onStart={handleStart}
          onShowControls={() => setShowControls(true)}
        />
      )}

      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <HudOverlay
          hud={hud}
          muted={config.muted}
          showFps={config.graphics.showFps}
          onBindMinimap={handleBindMinimap}
          onCycleCamera={() => gameRef.current?.cycleCamera(1)}
          onToggleMinimap={() => gameRef.current?.toggleMinimap()}
          onToggleMute={() => {
            setConfig((c) => ({ ...c, muted: !c.muted }));
            gameRef.current?.toggleMute();
          }}
          onPause={() => gameRef.current?.pauseGame()}
          onShowControls={() => setShowControls(true)}
        />
      )}

      {hud.phase === 'paused' && (
        <PauseModal
          config={config}
          hud={hud}
          onResume={() => gameRef.current?.resumeGame()}
          onRestart={() => gameRef.current?.restartRun()}
          onResetViolations={() => gameRef.current?.resetFreeDriveViolations()}
          onReturnTitle={() => gameRef.current?.returnToTitle()}
          onUpdateConfig={handlePauseUpdate}
        />
      )}

      {hud.phase === 'gameover' && (
        <ResultModal
          hud={hud}
          scenarioId={config.scenarioId}
          onRetry={() => gameRef.current?.restartRun()}
          onNextScenario={handleNextScenario}
          onReturnTitle={() => gameRef.current?.returnToTitle()}
        />
      )}

      {showControls && <ControlsModal onClose={() => setShowControls(false)} />}
    </div>
  );
}
