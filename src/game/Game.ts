import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Controls, type Action } from '../kit/input/controls';
import { createState, SPECS, stepVehicle, toKmh, type VehicleState } from '../kit/vehicles/dynamics';
import { AudioEngine } from './audio/AudioEngine';
import {
  computeEffectivePixelRatio,
  SHADOW_MAP_SIZES,
  type GraphicsSettings,
} from './graphics/GraphicsSettings';
import { createMapData } from './maps/mapDefs';
import { HumanAssetPool } from './models/HumanBuilder';
import { VehicleAssetPool } from './models/VehicleBuilder';
import { CameraRig } from './player/CameraRig';
import { PlayerVehicle } from './player/PlayerVehicle';
import { RuleChecker } from './rules/RuleChecker';
import { getScenarioById } from './rules/scenarios';
import { TrafficManager } from './traffic/TrafficManager';
import type {
  CameraMode,
  GameConfig,
  GamePhase,
  HeadlightMode,
  HudSnapshot,
  ScenarioObjective,
  TimeOfDay,
  VehicleId,
  ViolationEvent,
} from './types';
import { drawMinimap } from './ui/Minimap';
import { RoadGraph, type RoadProjection } from './world/RoadGraph';
import { buildWorld, updateLivingWorld, updateRailway, type BuiltWorld } from './world/WorldBuilder';

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

const SKY_THEMES: Record<
  TimeOfDay,
  { bg: number; fogNear: number; fogFar: number; sunColor: number; sunInt: number; sunPos: [number, number, number]; hemiSky: number; hemiGround: number; hemiInt: number }
> = {
  morning:   { bg: 0xb4d7f0, fogNear: 175, fogFar: 690, sunColor: 0xffe0ad, sunInt: 2.65, sunPos: [72, 56, 48], hemiSky: 0x9ec9ee, hemiGround: 0x353c48, hemiInt: 0.52 },
  noon:      { bg: 0x92c5eb, fogNear: 195, fogFar: 760, sunColor: 0xfff5e0, sunInt: 2.85, sunPos: [56, 78, 44], hemiSky: 0xa4d0f2, hemiGround: 0x2d3544, hemiInt: 0.56 },
  afternoon: { bg: 0xdcb288, fogNear: 160, fogFar: 640, sunColor: 0xffab4c, sunInt: 2.62, sunPos: [-78, 36, 46], hemiSky: 0xe5be92, hemiGround: 0x332b26, hemiInt: 0.48 },
  night:     { bg: 0x101724, fogNear: 72,  fogFar: 360, sunColor: 0x7ea2d4, sunInt: 0.44, sunPos: [-30, 50, -30], hemiSky: 0x22324a, hemiGround: 0x10141a, hemiInt: 0.36 },
};

/**
 * Core 3D Game Engine for Traffic Time.
 * Runs pure Three.js loop decoupled from React UI, with software-WebGL pacing.
 */
export class Game {
  readonly isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraRig: CameraRig;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private envTex: THREE.Texture;

  private controls: Controls;
  private audio = new AudioEngine();
  private rules = new RuleChecker();
  private vehiclePool: VehicleAssetPool;
  private humanPool: HumanAssetPool;

  private config: GameConfig;
  private phase: GamePhase = 'title';
  private graph!: RoadGraph;
  private world: BuiltWorld | null = null;
  private traffic: TrafficManager | null = null;
  private playerMesh: PlayerVehicle | null = null;
  private playerState: VehicleState = createState();
  private currentShadowSize = 1024;

  // Lighting & signaling state
  private headlight: HeadlightMode = 0;
  private signalLeft = false;
  private signalRight = false;
  private hazard = false;
  private minimapExpanded = false;
  private minimapCanvas: HTMLCanvasElement | null = null;

  // Look left/right (Z/X keys or right mouse drag)
  private lookKeyLeft = false;
  private lookKeyRight = false;
  private mouseLook = 0;
  private rightMouseDown = false;
  private lastMouseX = 0;

  // Timers & performance tracking
  private elapsedSec = 0;
  private distanceM = 0;
  private lastFrameMs = 0;
  private lastHudPush = 0;
  private lastMinimapDraw = 0;
  private frameCounter = 0;
  private frameId = 0;
  private disposed = false;
  private latestViolation: ViolationEvent | null = null;
  private latestViolationTimer = 0;
  private fpsEma = 60;
  private lastDrawCalls = 0;
  private adaptiveScaleMult = 1.0;
  private lowFpsSec = 0;
  private highFpsSec = 0;
  private lastSunSnapX = Number.NaN;
  private lastSunSnapZ = Number.NaN;
  private lastProjection: RoadProjection | null = null;
  private camDirScratch = new THREE.Vector3();

  // Pooled blocky tire dust / rain-spray particles (1 single InstancedMesh draw call, zero GC!)
  private sprayMesh: THREE.InstancedMesh;
  private sprayMat: THREE.MeshBasicMaterial;
  private sprayPool: { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }[] = [];
  private sprayCursor = 0;
  private sprayCooldown = 0;
  private sprayDummy = new THREE.Object3D();

  // Red-light & railway state tracking
  private prevStopStates = new Map<string, boolean>();
  private prevRailwaySide = 0;
  private hornHonkedRecently = 0;

  // Scenario state
  private activeScenario: ScenarioObjective | null = null;
  private waypointIdx = 0;
  private scenarioPassed: boolean | null = null;
  private scenarioEndReason: string | null = null;
  private scenarioEventTriggered = false;

  private onHudUpdate: (snap: HudSnapshot) => void;

  constructor(private container: HTMLElement, initialConfig: GameConfig, onHudUpdate: (snap: HudSnapshot) => void) {
    this.config = { ...initialConfig, graphics: { ...initialConfig.graphics } };
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareGl();

    // Shared geometry & material pools (created once, zero duplicate allocations across NPCs)
    this.vehiclePool = new VehicleAssetPool(this.config.graphics.detailLevel);
    this.humanPool = new HumanAssetPool();

    // Renderer setup (NO bloom, NO UnrealBloomPass, ACESFilmicToneMapping, logarithmicDepthBuffer eliminates Z-fighting!)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // PRO OPTIMIZATION: Manually refresh shadows at 30Hz (or on sun grid step) to cut GPU shadow pass cost ~50%!
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Scene & Subtle Studio Environment Reflection (dialed down to 0.24 so shadows & colors stay crisp and high-contrast!)
    this.scene = new THREE.Scene();

    // Pooled blocky tire dust / rain spray particles (24 instances, 1 draw call, zero GC!)
    const sprayGeo = new THREE.BoxGeometry(0.22, 0.16, 0.22);
    this.sprayMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.55 });
    this.sprayMesh = new THREE.InstancedMesh(sprayGeo, this.sprayMat, 24);
    this.sprayMesh.frustumCulled = false;
    for (let i = 0; i < 24; i++) {
      this.sprayPool.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, age: 9, life: 0.4 });
      this.sprayDummy.position.set(0, -10, 0);
      this.sprayDummy.scale.set(0.001, 0.001, 0.001);
      this.sprayDummy.updateMatrix();
      this.sprayMesh.setMatrixAt(i, this.sprayDummy.matrix);
    }
    this.scene.add(this.sprayMesh);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.24;
    pmrem.dispose();

    // Camera (0.28m near plane gives strong depth precision; CameraRig tightens to 0.10m only in FPV)
    this.camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || 1280) / Math.max(1, container.clientHeight || 720),
      0.28,
      this.config.graphics.drawDistance + 80,
    );
    this.cameraRig = new CameraRig(this.camera);

    // Warm Punchy Directional Sunlight + Deep Cool Hemisphere Shadow Fill (high visual contrast!)
    this.hemiLight = new THREE.HemisphereLight(0xa6cff0, 0x2f3745, 0.54);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3db, 2.75);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 230;
    const d = 75;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.03;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Input controls
    this.controls = new Controls(window);
    this.controls.onPressed(this.handleActionPressed);
    window.addEventListener('keydown', this.handleExtraKeyDown);
    window.addEventListener('keyup', this.handleExtraKeyUp);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('blur', this.handleBlur);
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.renderer.domElement.addEventListener('contextmenu', this.handleContextMenu);

    // Apply initial graphics settings, build world & vehicle, then render Frame 0 immediately
    this.applyGraphicsSettings(this.config.graphics, false);
    this.rebuildSession(false);
    this.cameraRig.update(0.016, 0, this.phase, this.playerState, 0, this.config.vehicle, 0, { x: 0, z: 0 });
    this.renderer.render(this.scene, this.camera);
    this.lastDrawCalls = this.renderer.info.render.calls;
    this.pushHud(true);

    // Start loop
    this.lastFrameMs = performance.now();
    this.scheduleNextTick();
  }

  setMinimapCanvas(canvas: HTMLCanvasElement | null) {
    this.minimapCanvas = canvas;
  }

  getConfig(): GameConfig {
    return { ...this.config, graphics: { ...this.config.graphics } };
  }

  private getTargetAnisotropy(detailLevel: GraphicsSettings['detailLevel']): number {
    if (detailLevel === 'low') return 1;
    const maxA = this.renderer.capabilities.getMaxAnisotropy();
    return detailLevel === 'medium' ? Math.min(4, maxA) : Math.min(8, maxA);
  }

  private getEffectiveShadowSize(settings: GraphicsSettings): number {
    const requested = SHADOW_MAP_SIZES[settings.shadows];
    if (requested <= 0) return 0;
    if (this.isSoftwareGl) {
      // Keep software WebGL responsive while still allowing low/medium shadows when enabled
      return Math.min(requested, 1024);
    }
    return requested;
  }

  applyGraphicsSettings(settings: GraphicsSettings, renderImmediate = true) {
    const prevDetail = this.config.graphics.detailLevel;
    this.config.graphics = { ...settings };
    this.adaptiveScaleMult = 1.0;
    this.lowFpsSec = 0;
    this.highFpsSec = 0;

    // 1. Resolution scale & pixel ratio
    const dpr = computeEffectivePixelRatio(settings, window.devicePixelRatio, this.isSoftwareGl);
    this.renderer.setPixelRatio(dpr);
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h, false);

    // 2. Shadow map quality
    const shadowPx = this.getEffectiveShadowSize(settings);
    const shadowsEnabled = shadowPx > 0;
    this.renderer.shadowMap.enabled = shadowsEnabled;
    this.sunLight.castShadow = shadowsEnabled;
    if (shadowsEnabled && shadowPx !== this.currentShadowSize) {
      this.currentShadowSize = shadowPx;
      this.sunLight.shadow.mapSize.set(shadowPx, shadowPx);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = true;

    if (this.world) {
      for (const caster of this.world.shadowCasters) {
        caster.castShadow = shadowsEnabled;
      }
      const aniso = this.getTargetAnisotropy(settings.detailLevel);
      for (const tex of this.world.textures) {
        if (tex.anisotropy !== aniso) {
          tex.anisotropy = aniso;
          tex.needsUpdate = true;
        }
      }
    }

    // 3. Draw distance (keep distant horizon skyline cleanly visible in atmospheric haze while culling close NPCs!)
    this.camera.far = Math.max(settings.drawDistance + 440, 820);
    this.camera.updateProjectionMatrix();
    this.traffic?.setCullingDistance(settings.drawDistance);

    // 4. Mirror render-target quality
    this.playerMesh?.setMirrorQuality(settings.mirrorQuality);

    // 5. Vehicle clearcoat / material detail level
    this.vehiclePool.setDetailLevel(settings.detailLevel);

    // 6. Update fog far plane to match drawDistance
    if (this.world) {
      this.applyAtmosphere();
    }

    // If detail level changed on title screen, refresh NPC caps subtly without resetting active driving progress
    if (prevDetail !== settings.detailLevel && this.phase === 'title' && this.world) {
      this.rebuildSession(false);
    }

    if (renderImmediate && this.world) {
      this.renderer.render(this.scene, this.camera);
      this.lastDrawCalls = this.renderer.info.render.calls;
    }
  }

  updateConfig(partial: Partial<GameConfig>, rebuildWorldIfNeeded = false) {
    const prevMap = this.config.map;
    const prevVehicle = this.config.vehicle;
    const prevDensity = this.config.density;
    const prevTime = this.config.timeOfDay;
    const prevWeather = this.config.weather;
    const nextGraphics = partial.graphics ? { ...partial.graphics } : this.config.graphics;
    const graphicsChanged = Boolean(partial.graphics);
    this.config = { ...this.config, ...partial, graphics: nextGraphics };
    this.audio.setVolume(this.config.volume, this.config.muted);

    if (graphicsChanged) {
      this.applyGraphicsSettings(this.config.graphics, false);
    }
    if (prevTime !== this.config.timeOfDay || prevWeather !== this.config.weather) {
      this.applyAtmosphere();
    }
    if (prevVehicle !== this.config.vehicle) {
      this.spawnPlayerMesh(this.config.vehicle);
      this.audio.setVehicle(this.config.vehicle);
    }
    if (rebuildWorldIfNeeded || prevMap !== this.config.map || prevDensity !== this.config.density) {
      this.rebuildSession(this.phase === 'playing');
    } else if (graphicsChanged && this.world) {
      this.renderer.render(this.scene, this.camera);
      this.lastDrawCalls = this.renderer.info.render.calls;
    }
    this.pushHud(true);
  }

  startGame(overrideConfig?: Partial<GameConfig>, fromUserGesture = true) {
    if (overrideConfig) {
      this.config = { ...this.config, ...overrideConfig };
    }
    // If scenario mode, adopt scenario's map/weather/time/density!
    if (this.config.mode === 'scenario') {
      const sc = getScenarioById(this.config.scenarioId);
      this.activeScenario = sc;
      this.config.map = sc.map;
      this.config.timeOfDay = sc.timeOfDay;
      this.config.weather = sc.weather;
      this.config.density = sc.density;
    } else if (this.config.mode === 'rushhour') {
      this.activeScenario = null;
      this.config.density = 'high';
      this.config.timeOfDay = 'afternoon';
    } else {
      this.activeScenario = null;
    }

    if (fromUserGesture) {
      this.audio.unlock();
      this.audio.setVolume(this.config.volume, this.config.muted);
      this.audio.setVehicle(this.config.vehicle);
    }
    this.setPhase('playing');
    this.rebuildSession(true);
    this.pushHud(true);
  }

  restartRun() {
    this.audio.unlock();
    this.setPhase('playing');
    this.rebuildSession(true);
    this.pushHud(true);
  }

  resumeGame() {
    if (this.phase === 'paused') {
      this.setPhase('playing');
      this.lastFrameMs = performance.now();
      this.pushHud(true);
    }
  }

  pauseGame() {
    if (this.phase === 'playing') {
      this.setPhase('paused');
      this.pushHud(true);
    }
  }

  returnToTitle() {
    this.setPhase('title');
    this.cameraRig.reset();
    this.pushHud(true);
  }

  cycleCamera(dir: 1 | -1 = 1) {
    const mode = this.cameraRig.cycle(dir);
    this.playerMesh?.setFpvMode(mode === 3);
    this.pushHud(true);
  }

  setCameraMode(mode: CameraMode) {
    this.cameraRig.mode = mode;
    this.playerMesh?.setFpvMode(mode === 3);
    this.pushHud(true);
  }

  toggleMinimap() {
    this.minimapExpanded = !this.minimapExpanded;
    this.pushHud(true);
  }

  toggleMute() {
    this.config.muted = !this.config.muted;
    this.audio.setVolume(this.config.volume, this.config.muted);
    this.pushHud(true);
  }

  /** Cho phép xoá nhật ký lỗi trong chế độ Lái tự do mà không phải chạy lại từ đầu. */
  resetFreeDriveViolations() {
    this.rules.reset();
    this.latestViolation = null;
    this.latestViolationTimer = 0;
    this.pushHud(true);
  }

  private setPhase(p: GamePhase) {
    this.phase = p;
    document.body.dataset.state = p;
  }

  private rebuildSession(forActivePlay: boolean) {
    // Cleanup old world & traffic
    if (this.world) {
      this.scene.remove(this.world.root);
      this.world.dispose();
      this.world = null;
    }
    if (this.traffic) {
      this.scene.remove(this.traffic.root);
      this.traffic.dispose();
      this.traffic = null;
    }

    const mapData = createMapData(this.config.map);
    this.graph = new RoadGraph(mapData);
    const castShadows = this.getEffectiveShadowSize(this.config.graphics) > 0;
    const anisotropy = this.getTargetAnisotropy(this.config.graphics.detailLevel);
    this.world = buildWorld(this.graph, this.config.timeOfDay, this.config.weather, castShadows, anisotropy);
    this.scene.add(this.world.root);

    this.traffic = new TrafficManager(
      this.graph,
      this.world.signals,
      this.world.crosswalks,
      this.vehiclePool,
      this.humanPool,
      this.config.density,
      this.config.graphics.detailLevel,
      this.config.graphics.drawDistance,
      this.isSoftwareGl,
    );
    this.scene.add(this.traffic.root);

    this.spawnPlayerMesh(this.config.vehicle);

    // Reset state
    const spawn = this.activeScenario && forActivePlay ? this.activeScenario.spawn : mapData.defaultSpawn;
    this.playerState = createState(spawn.x, spawn.z, spawn.heading);
    this.rules.reset();
    this.elapsedSec = 0;
    this.distanceM = 0;
    this.latestViolation = null;
    this.latestViolationTimer = 0;
    this.headlight = this.config.timeOfDay === 'night' && this.activeScenario?.id !== 15 ? 1 : 0;
    this.signalLeft = false;
    this.signalRight = false;
    this.hazard = false;
    this.waypointIdx = 0;
    this.scenarioPassed = null;
    this.scenarioEndReason = null;
    this.scenarioEventTriggered = false;
    this.prevStopStates.clear();
    this.prevRailwaySide = 0;
    this.cameraRig.reset();

    // If Scenario 9 (FPV lane change), switch directly to FPV!
    if (forActivePlay && this.activeScenario?.id === 9) {
      this.cameraRig.mode = 3;
      this.playerMesh?.setFpvMode(true);
    }

    // Trigger immediate scenario actors if needed
    if (forActivePlay && this.activeScenario?.specialEvent === 'ambulance') {
      this.traffic.spawnScenarioAmbulance(spawn.x, spawn.z);
    }
    if (forActivePlay && this.activeScenario?.specialEvent === 'surpriseHazard') {
      this.traffic.spawnSurpriseDog(1.5, 32);
    }

    this.applyAtmosphere();
    this.updateWaypointVisual();
  }

  private spawnPlayerMesh(v: VehicleId) {
    if (this.playerMesh) {
      this.scene.remove(this.playerMesh.root);
      this.playerMesh.dispose();
    }
    const castShadows = this.getEffectiveShadowSize(this.config.graphics) > 0;
    this.playerMesh = new PlayerVehicle(
      v,
      this.vehiclePool,
      this.humanPool,
      castShadows,
      this.config.graphics.mirrorQuality,
      this.config.graphics.detailLevel,
    );
    this.playerMesh.setFpvMode(this.cameraRig.mode === 3);
    this.scene.add(this.playerMesh.root);
  }

  private applyAtmosphere() {
    const t = SKY_THEMES[this.config.timeOfDay];
    const isRain = this.config.weather === 'rain';
    const bgHex = isRain ? (this.config.timeOfDay === 'night' ? 0x121821 : 0x8f9ca6) : t.bg;
    this.scene.background = new THREE.Color(bgHex);
    const drawFar = this.config.graphics.drawDistance;
    // Let distant skyline fade smoothly into atmospheric haze beyond drawDistance instead of popping or washing out!
    const baseFar = Math.max(t.fogFar, drawFar + 260);
    const fogFar = isRain ? baseFar * 0.68 : baseFar;
    const fogNear = Math.min(fogFar * 0.42, isRain ? t.fogNear * 0.62 : t.fogNear);
    this.scene.fog = new THREE.Fog(bgHex, fogNear, fogFar);

    this.sunLight.color.setHex(t.sunColor);
    this.sunLight.intensity = isRain ? t.sunInt * 0.55 : t.sunInt;
    this.hemiLight.color.setHex(t.hemiSky);
    this.hemiLight.groundColor.setHex(t.hemiGround);
    this.hemiLight.intensity = isRain ? t.hemiInt * 0.85 : t.hemiInt;

    if (this.world) {
      const isNight = this.config.timeOfDay === 'night';
      for (const m of this.world.asphaltMaterials) {
        m.roughness = isRain ? 0.34 : 0.86;
        m.metalness = isRain ? 0.14 : 0.02;
      }
      for (const w of this.world.windowMaterials) {
        w.emissiveIntensity = isNight ? 0.85 : 0;
      }
      for (const b of this.world.streetLampBulbs) {
        b.emissiveIntensity = isNight ? 2.4 : 0;
      }
      for (const pl of this.world.streetLampLights) {
        pl.intensity = isNight ? 16 : 0;
      }
      if (this.world.rainPoints) {
        this.world.rainPoints.visible = isRain;
      }
      this.world.living.cloudMat.color.setHex(
        isRain ? (isNight ? 0x1c2533 : 0x7e8a96) : isNight ? 0x1f2b3d : this.config.timeOfDay === 'afternoon' ? 0xf8e2c8 : 0xf8fafc,
      );
      this.world.living.cloudMat.emissive.setHex(
        isRain ? 0x3b444e : isNight ? 0x0b1220 : this.config.timeOfDay === 'afternoon' ? 0xf5d4b0 : 0xffffff,
      );
      this.world.living.cloudMat.emissiveIntensity = isNight ? 0.08 : isRain ? 0.12 : 0.34;
      this.sprayMat.color.setHex(isRain ? 0xe2eef8 : 0xb8b2a6);
      this.sprayMat.opacity = isRain ? 0.65 : 0.42;
      this.lastSunSnapX = Number.NaN;
      this.lastSunSnapZ = Number.NaN;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  private handleActionPressed = (action: Action) => {
    this.audio.unlock();
    if (action === 'pause') {
      if (this.phase === 'playing') this.pauseGame();
      else if (this.phase === 'paused') this.resumeGame();
      return;
    }
    if (this.phase !== 'playing') return;

    switch (action) {
      case 'headlight':
        this.headlight = ((this.headlight + 1) % 3) as HeadlightMode;
        break;
      case 'signalLeft':
        this.hazard = false;
        this.signalLeft = !this.signalLeft;
        if (this.signalLeft) this.signalRight = false;
        break;
      case 'signalRight':
        this.hazard = false;
        this.signalRight = !this.signalRight;
        if (this.signalRight) this.signalLeft = false;
        break;
      case 'hazard':
        this.hazard = !this.hazard;
        this.signalLeft = this.hazard;
        this.signalRight = this.hazard;
        break;
      case 'cameraNext':
        this.cycleCamera(1);
        break;
      case 'cameraPrev':
        this.cycleCamera(-1);
        break;
      case 'minimap':
        this.toggleMinimap();
        break;
      case 'vehicleBike':
        if (Math.abs(this.playerState.speed) < 1.2) {
          this.updateConfig({ vehicle: this.config.vehicle === 'wave110' ? 'vision110' : 'wave110' });
        }
        break;
      case 'vehicleCar':
        if (Math.abs(this.playerState.speed) < 1.2) {
          this.updateConfig({ vehicle: 'sedan' });
        }
        break;
      case 'horn':
        this.hornHonkedRecently = 2.0;
        break;
    }
    this.pushHud(true);
  };

  private handleExtraKeyDown = (e: KeyboardEvent) => {
    if (this.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag !== 'SELECT' && tag !== 'INPUT') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }
    if (e.code === 'KeyZ') this.lookKeyLeft = true;
    if (e.code === 'KeyX') this.lookKeyRight = true;
  };

  private handleExtraKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'KeyZ') this.lookKeyLeft = false;
    if (e.code === 'KeyX') this.lookKeyRight = false;
  };

  private handleBlur = () => {
    this.lookKeyLeft = false;
    this.lookKeyRight = false;
    this.rightMouseDown = false;
    this.mouseLook = 0;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 2) {
      this.rightMouseDown = true;
      this.lastMouseX = e.clientX;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.rightMouseDown) return;
    const dx = e.clientX - this.lastMouseX;
    this.lastMouseX = e.clientX;
    this.mouseLook = THREE.MathUtils.clamp(this.mouseLook - dx * 0.008, -1, 1);
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 2) {
      this.rightMouseDown = false;
      this.mouseLook = 0;
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  };

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (sync) gl.flush();
    const startMs = performance.now();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED && performance.now() - startMs < 220) {
        gl.flush();
        this.frameId = window.setTimeout(poll, 10);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 48);
      }
    };
    this.frameId = window.setTimeout(poll, 10);
  }

  private tick() {
    if (this.disposed) return;
    this.frameCounter++;
    const now = performance.now();
    const rawDt = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    if (rawDt > 0.001 && rawDt < 2.5) {
      const instFps = Math.min(120, 1 / rawDt);
      this.fpsEma = this.fpsEma * 0.88 + instFps * 0.12;
      this.updateAutoFpsGuard(rawDt);
    }
    const totalDt = Math.min(Math.max(rawDt, 0.001), 0.14);

    if (this.phase === 'title') {
      // Animate city traffic, clouds, birds, flags & lights smoothly behind the title menu!
      this.elapsedSec += totalDt;
      this.stepWorldSignalsAndTraffic(Math.min(totalDt, 0.05), false);
      const center = { x: 0, z: 0 };
      this.cameraRig.update(Math.min(totalDt, 0.05), this.elapsedSec, 'title', this.playerState, 0, this.config.vehicle, 0, center);
      this.updateSunFollow(center.x, center.z);
    } else if (this.phase === 'playing') {
      // Substep physics in <= 0.05s slices so software WebGL & low-FPS devices stay responsive and tunnel-free
      const steps = Math.max(1, Math.ceil(totalDt / 0.05));
      const subDt = totalDt / steps;
      for (let s = 0; s < steps; s++) {
        this.elapsedSec += subDt;
        this.stepGameplay(subDt);
        if (this.phase !== 'playing') break;
      }
      this.updateTireSpray(totalDt);
    }

    // Smart throttled shadow map refresh (30Hz on GPU, 15Hz on SW, plus immediate on 4m grid change!)
    if (this.renderer.shadowMap.enabled) {
      const interval = this.isSoftwareGl ? 4 : 2;
      if (this.frameCounter % interval === 0) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }

    // Render real FPV mirrors (immediately on entry, then alternating)
    if (this.playerMesh && this.phase === 'playing') {
      this.playerMesh.renderMirrors(this.renderer, this.scene, this.cameraRig.mode === 3, this.isSoftwareGl);
    }

    this.renderer.render(this.scene, this.camera);
    this.lastDrawCalls = this.renderer.info.render.calls;

    // Throttle Canvas 2D Minimap to 20Hz (50ms) — visually fluid while eliminating 40 redundant 2D redraws/sec!
    if (this.minimapCanvas && this.phase === 'playing' && this.world && this.traffic && now - this.lastMinimapDraw >= 50) {
      this.lastMinimapDraw = now;
      const wp = this.getCurrentWaypoint();
      drawMinimap(
        this.minimapCanvas,
        this.graph,
        this.world.signals,
        this.traffic.npcs,
        this.playerState.x,
        this.playerState.z,
        this.playerState.heading,
        wp ? { x: wp.x, z: wp.z } : null,
        this.minimapExpanded,
      );
    }

    if (this.phase === 'playing' && now - this.lastHudPush > 90) {
      this.lastHudPush = now;
      this.pushHud(false);
    }

    this.scheduleNextTick();
  }

  private updateAutoFpsGuard(dt: number) {
    if (this.isSoftwareGl || !this.config.graphics.autoFpsGuard || this.phase !== 'playing') return;
    if (this.fpsEma < 44) {
      this.lowFpsSec += dt;
      this.highFpsSec = 0;
      if (this.lowFpsSec >= 2.2 && this.adaptiveScaleMult > 0.65) {
        this.lowFpsSec = 0;
        this.adaptiveScaleMult = Math.max(0.65, Math.round((this.adaptiveScaleMult - 0.1) * 100) / 100);
        const baseDpr = computeEffectivePixelRatio(this.config.graphics, window.devicePixelRatio, false);
        this.renderer.setPixelRatio(Math.max(0.6, baseDpr * this.adaptiveScaleMult));
      }
    } else if (this.fpsEma >= 57 && this.adaptiveScaleMult < 1.0) {
      this.highFpsSec += dt;
      this.lowFpsSec = 0;
      if (this.highFpsSec >= 4.0) {
        this.highFpsSec = 0;
        this.adaptiveScaleMult = Math.min(1.0, Math.round((this.adaptiveScaleMult + 0.05) * 100) / 100);
        const baseDpr = computeEffectivePixelRatio(this.config.graphics, window.devicePixelRatio, false);
        this.renderer.setPixelRatio(Math.max(0.6, baseDpr * this.adaptiveScaleMult));
      }
    } else {
      this.lowFpsSec = Math.max(0, this.lowFpsSec - dt * 0.5);
    }
  }

  private updateTireSpray(dt: number) {
    const speedAbs = Math.abs(this.playerState.speed);
    const isRain = this.config.weather === 'rain';
    const shouldEmit =
      (isRain && speedAbs > 3.2) ||
      (!isRain && ((this.playerState.braking && speedAbs > 5.5) || (this.controls.input.throttle > 0.6 && speedAbs > 2 && speedAbs < 11)));

    this.sprayCooldown -= dt;
    if (shouldEmit && this.sprayCooldown <= 0) {
      this.sprayCooldown = isRain ? 0.045 : 0.065;
      const p = this.sprayPool[this.sprayCursor];
      this.sprayCursor = (this.sprayCursor + 1) % this.sprayPool.length;
      const fx = Math.sin(this.playerState.heading);
      const fz = Math.cos(this.playerState.heading);
      const rx = -Math.cos(this.playerState.heading);
      const rz = Math.sin(this.playerState.heading);
      const isCar = this.config.vehicle === 'sedan';
      const side = isCar ? (this.sprayCursor % 2 === 0 ? 0.68 : -0.68) : (Math.random() - 0.5) * 0.14;
      const back = isCar ? 1.55 : 0.82;
      const elev = this.lastProjection ? this.lastProjection.elevationY : 0;
      p.x = this.playerState.x - fx * back + rx * side;
      p.y = elev + 0.14;
      p.z = this.playerState.z - fz * back + rz * side;
      p.vx = -fx * (1.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 0.8;
      p.vy = (isRain ? 1.5 : 0.9) + Math.random() * 0.7;
      p.vz = -fz * (1.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 0.8;
      p.age = 0;
      p.life = isRain ? 0.36 : 0.44;
    }

    let anyActive = false;
    for (let i = 0; i < this.sprayPool.length; i++) {
      const p = this.sprayPool[i];
      if (p.age < p.life) {
        anyActive = true;
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 3.2 * dt;
        const u = p.age / p.life;
        const sc = Math.max(0.01, (1 - u) * (0.7 + u * 0.9));
        this.sprayDummy.position.set(p.x, Math.max(0.08, p.y), p.z);
        this.sprayDummy.scale.setScalar(sc);
        this.sprayDummy.updateMatrix();
        this.sprayMesh.setMatrixAt(i, this.sprayDummy.matrix);
      } else if (p.y > -5) {
        p.y = -10;
        this.sprayDummy.position.set(0, -10, 0);
        this.sprayDummy.scale.setScalar(0.001);
        this.sprayDummy.updateMatrix();
        this.sprayMesh.setMatrixAt(i, this.sprayDummy.matrix);
        anyActive = true;
      }
    }
    if (anyActive) this.sprayMesh.instanceMatrix.needsUpdate = true;
  }

  private stepWorldSignalsAndTraffic(dt: number, activePlayer: boolean) {
    if (!this.world || !this.traffic) return;

    const cullX = activePlayer ? this.playerState.x : 0;
    const cullZ = activePlayer ? this.playerState.z : 0;
    this.camera.getWorldDirection(this.camDirScratch);
    const allowRearCull = activePlayer && this.cameraRig.mode !== 3;
    const sigMaxDist = Math.min(this.config.graphics.drawDistance, 210);
    const sigCullSq = sigMaxDist * sigMaxDist;

    // Update traffic lights + distance & behind-camera culling (slashes ~300+ off-screen signal draw calls!)
    for (let i = 0; i < this.world.signals.length; i++) {
      const sig = this.world.signals[i];
      sig.controller.update(dt);
      const sdx = sig.node.x - cullX;
      const sdz = sig.node.z - cullZ;
      const dSq = sdx * sdx + sdz * sdz;
      let vis = dSq < sigCullSq;
      if (vis && allowRearCull && dSq > 784) {
        if (sdx * this.camDirScratch.x + sdz * this.camDirScratch.z < -22) vis = false;
      }
      for (let g = 0; g < sig.poleGroups.length; g++) {
        sig.poleGroups[g].visible = vis;
      }
      if (!vis) continue;
      for (const [app, heads] of sig.approachHeads.entries()) {
        const light = sig.controller.lightFor(app);
        const cd = sig.controller.countdownFor(app);
        for (let h = 0; h < heads.length; h++) heads[h].set(light, cd);
      }
    }

    // Animate drifting clouds, circling city birds, swaying VN flags & waypoint pulse
    updateLivingWorld(this.world, dt, this.elapsedSec);

    // Update railway level crossing & train
    if (this.world.railway) {
      updateRailway(this.world.railway, dt);
    }

    // Rain particle drop
    if (this.world.rainPoints && this.world.rainPoints.visible) {
      const pos = this.world.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const anchorX = activePlayer ? this.playerState.x : 0;
      const anchorZ = activePlayer ? this.playerState.z : 0;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= 22 * dt;
        if (arr[i + 1] < 0) {
          arr[i] = anchorX + (Math.random() - 0.5) * 70;
          arr[i + 1] = 24 + Math.random() * 4;
          arr[i + 2] = anchorZ + (Math.random() - 0.5) * 70;
        }
      }
      pos.needsUpdate = true;
    }

    // Update NPC vehicles & pedestrians (with spatial distance + behind-camera culling!)
    const playerRad = this.config.vehicle === 'sedan' ? 1.55 : 0.68;
    const res = this.traffic.update(
      dt,
      activePlayer ? this.playerState.x : 9999,
      activePlayer ? this.playerState.z : 9999,
      this.playerState.heading,
      this.playerState.speed,
      playerRad,
      this.world.railway,
      cullX,
      cullZ,
      activePlayer ? (d) => this.audio.playNpcHonk(d) : undefined,
      this.camDirScratch.x,
      this.camDirScratch.z,
      allowRearCull,
    );

    return res;
  }

  private stepGameplay(dt: number) {
    if (!this.world || !this.traffic || !this.playerMesh) return;

    this.controls.update(dt);
    if (this.controls.input.horn) this.hornHonkedRecently = 2.0;
    else this.hornHonkedRecently = Math.max(0, this.hornHonkedRecently - dt);

    // Rain reduces effective braking grip by ~32% (longer stopping distance!)
    const baseSpec = SPECS[this.config.vehicle];
    const effectiveSpec =
      this.config.weather === 'rain' ? { ...baseSpec, brakeForce: baseSpec.brakeForce * 0.68 } : baseSpec;

    const prevX = this.playerState.x;
    const prevZ = this.playerState.z;
    stepVehicle(this.playerState, effectiveSpec, this.controls.input, dt);

    // Keep player within map bounds gracefully
    const b = this.graph.data.bounds;
    this.playerState.x = THREE.MathUtils.clamp(this.playerState.x, b.minX + 8, b.maxX - 8);
    this.playerState.z = THREE.MathUtils.clamp(this.playerState.z, b.minZ + 8, b.maxZ - 8);

    const moved = Math.hypot(this.playerState.x - prevX, this.playerState.z - prevZ);
    this.distanceM += moved;

    const trafficRes = this.stepWorldSignalsAndTraffic(dt, true);
    let collided = Boolean(trafficRes?.collided);

    if (trafficRes && (trafficRes.pushX !== 0 || trafficRes.pushZ !== 0)) {
      this.playerState.x += trafficRes.pushX;
      this.playerState.z += trafficRes.pushZ;
      this.playerState.speed *= 0.25;
      this.cameraRig.addTrauma(0.55);
      this.audio.playCrash(this.elapsedSec);
    }

    // Project player onto road network (and cache for HUD so pushHud never recomputes!)
    const proj = this.graph.projectPoint(this.playerState.x, this.playerState.z, this.playerState.heading);
    this.lastProjection = proj;
    const elevationY = proj ? proj.elevationY : 0;

    // Soft wall boundary if player drives far beyond sidewalk into buildings
    if (proj && proj.offAsphaltDist > proj.edge.edge.sidewalkWidth + 0.85) {
      this.playerState.x = prevX;
      this.playerState.z = prevZ;
      this.playerState.speed *= -0.15;
      collided = true;
      this.cameraRig.addTrauma(0.35);
      this.audio.playCrash(this.elapsedSec);
    }

    // Scenario 2 special event: yellow light dilemma when player nears intersection S
    if (this.activeScenario?.specialEvent === 'yellowDilemma' && !this.scenarioEventTriggered) {
      const distS = Math.hypot(this.playerState.x - 0, this.playerState.z - 120);
      if (distS < 34) {
        this.scenarioEventTriggered = true;
        const sigS = this.world.signals.find((s) => s.node.id === 'S');
        if (sigS) {
          // Jump timer right into yellow stage for N+S group (group 0, green=10 -> set time=10.1!)
          sigS.controller.time = sigS.controller.timing.green + 0.1;
          sigS.controller.update(0.01);
        }
      }
    }

    // Check Red-Light Crossing!
    let crossedRedLight = false;
    let crossedRightOnRedAllowed = false;
    const isTurningRight = this.signalRight || this.playerState.yawRate > 0.28;
    const fx = Math.sin(this.playerState.heading);
    const fz = Math.cos(this.playerState.heading);

    for (const sig of this.world.signals) {
      const dx = sig.node.x - this.playerState.x;
      const dz = sig.node.z - this.playerState.z;
      const dist = Math.hypot(dx, dz);
      const approaching = dist > 0.1 && (dx * fx + dz * fz) / dist > 0.45;
      const insideStop = dist < sig.stopDistance - 1.2;
      const wasOutside = this.prevStopStates.get(sig.node.id) ?? false;

      if (wasOutside && insideStop && approaching && this.playerState.speed > 1.8) {
        const app = RoadGraph.approachIdFromVector(fx, fz);
        const light = sig.controller.lightFor(app);
        if (light === 'red') {
          crossedRedLight = true;
          crossedRightOnRedAllowed = Boolean(sig.node.rightOnRed?.[app]);
        }
      }
      this.prevStopStates.set(sig.node.id, !insideStop && dist < sig.stopDistance + 14 && approaching);
    }

    // Check Railway Crossing while barrier closed!
    let crossedClosedRailway = false;
    if (this.world.railway) {
      const r = this.world.railway;
      const dRail = Math.hypot(this.playerState.x - r.x, this.playerState.z - r.z);
      const side = Math.sign(this.playerState.z - r.z);
      if (dRail < 14 && this.prevRailwaySide !== 0 && side !== 0 && side !== this.prevRailwaySide && r.gateClosed) {
        crossedClosedRailway = true;
        this.cameraRig.addTrauma(0.6);
      }
      if (dRail < 22 && side !== 0) this.prevRailwaySide = side;
    }

    // Evaluate VN Traffic Law Rules (12-point GPLX)
    const speedKmh = toKmh(Math.abs(this.playerState.speed));
    const newViolations = this.rules.evaluate({
      dt,
      elapsedSec: this.elapsedSec,
      vehicle: this.config.vehicle,
      speedKmh,
      speedMs: this.playerState.speed,
      heading: this.playerState.heading,
      yawRate: this.playerState.yawRate,
      signalLeft: this.signalLeft,
      signalRight: this.signalRight,
      headlight: this.headlight,
      timeOfDay: this.config.timeOfDay,
      projection: proj,
      crossedRedLight,
      crossedRightOnRedAllowed,
      isTurningRight,
      crossedClosedRailway,
      collided,
      pedestrianNearMiss: Boolean(trafficRes?.pedNearMiss),
    });

    if (newViolations.length > 0) {
      this.latestViolation = newViolations[0];
      this.latestViolationTimer = 5.5;
      this.pushHud(true);
    } else if (this.latestViolationTimer > 0) {
      this.latestViolationTimer -= dt;
      if (this.latestViolationTimer <= 0) this.latestViolation = null;
    }

    // Check GPLX Out of Points (0/12 -> Game Over ONLY in Scenario / Rush Hour! Free Drive is truly ENDLESS!)
    if (this.config.mode !== 'free' && this.rules.points <= 0) {
      this.scenarioPassed = false;
      this.scenarioEndReason = 'Bạn đã bị trừ hết 12/12 điểm Giấy phép lái xe (Luật 2024). Hãy xem lại các lỗi và luyện tập lại!';
      this.setPhase('gameover');
      this.pushHud(true);
      return;
    }

    // Scenario Waypoint Progression
    if (this.activeScenario) {
      this.stepScenarioProgress(speedKmh);
    }

    // Update Player 3D Mesh, Camera & Sun
    this.playerMesh.update(
      this.playerState,
      elevationY,
      this.headlight,
      this.signalLeft,
      this.signalRight,
      this.config.weather === 'rain',
      this.elapsedSec,
      this.cameraRig.mode === 3,
    );

    const lookInput = (this.lookKeyLeft ? 1 : 0) - (this.lookKeyRight ? 1 : 0) + this.mouseLook;
    this.cameraRig.update(
      dt,
      this.elapsedSec,
      'playing',
      this.playerState,
      elevationY,
      this.config.vehicle,
      lookInput,
      { x: 0, z: 0 },
    );
    this.updateSunFollow(this.playerState.x, this.playerState.z);

    // Update Audio
    const blinkOn = (this.signalLeft || this.signalRight) && Math.floor(this.elapsedSec * 3.2) % 2 === 0;
    this.audio.update(
      dt,
      true,
      this.playerState.rpm,
      baseSpec.redlineRpm,
      speedKmh,
      this.playerState.braking,
      this.controls.input.horn,
      blinkOn,
      Boolean(trafficRes?.ambulanceNearby),
      this.elapsedSec,
    );
  }

  private getCurrentWaypoint() {
    if (!this.activeScenario) return null;
    return this.activeScenario.waypoints[this.waypointIdx] ?? null;
  }

  private updateWaypointVisual() {
    if (!this.world) return;
    const wp = this.getCurrentWaypoint();
    if (!wp) {
      this.world.waypointMarker.visible = false;
      return;
    }
    this.world.waypointMarker.visible = true;
    const y = this.graph.elevationAt(wp.x, wp.z);
    this.world.waypointMarker.position.set(wp.x, y, wp.z);
  }

  private stepScenarioProgress(speedKmh: number) {
    const sc = this.activeScenario;
    if (!sc) return;

    if (this.elapsedSec > sc.timeLimitSec) {
      this.scenarioPassed = false;
      this.scenarioEndReason = `Hết thời gian bài tập (${sc.timeLimitSec} giây). Hãy giữ nhịp độ ổn định và thử lại!`;
      this.setPhase('gameover');
      this.pushHud(true);
      return;
    }

    const wp = this.getCurrentWaypoint();
    if (!wp) return;

    const dist = Math.hypot(this.playerState.x - wp.x, this.playerState.z - wp.z);
    if (dist <= wp.radius) {
      const stopOk = !wp.requireStop || speedKmh < 2.2;
      const sigOk = !wp.requireSignal || (wp.requireSignal === 'left' ? this.signalLeft : this.signalRight);
      const hornOk = !wp.requireHorn || this.hornHonkedRecently > 0;

      if (stopOk && sigOk && hornOk) {
        this.waypointIdx++;
        if (this.waypointIdx >= sc.waypoints.length) {
          const passed = this.rules.violations.length <= sc.maxViolations && this.rules.points > 0;
          this.scenarioPassed = passed;
          this.scenarioEndReason = passed
            ? `Hoàn thành xuất sắc "${sc.title}" với ${this.rules.points}/12 điểm GPLX!`
            : `Bạn đã về đích nhưng mắc ${this.rules.violations.length} lỗi (cho phép tối đa ${sc.maxViolations} lỗi).`;
          this.setPhase('gameover');
          this.pushHud(true);
        } else {
          this.updateWaypointVisual();
          this.pushHud(true);
        }
      }
    }
  }

  private updateSunFollow(x: number, z: number) {
    const t = SKY_THEMES[this.config.timeOfDay];
    // Snap shadow camera center to a 4m world grid to completely eliminate shadow-edge flickering/swimming while driving!
    const snapX = Math.round(x / 4) * 4;
    const snapZ = Math.round(z / 4) * 4;
    if (snapX !== this.lastSunSnapX || snapZ !== this.lastSunSnapZ) {
      this.lastSunSnapX = snapX;
      this.lastSunSnapZ = snapZ;
      this.sunLight.position.set(snapX + t.sunPos[0], t.sunPos[1], snapZ + t.sunPos[2]);
      this.sunLight.target.position.set(snapX, 0, snapZ);
      this.sunLight.target.updateMatrixWorld();
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
  }

  private getNearestSignalHud(): { state: HudSnapshot['nearSignalState']; countdown: number; rightOnRed: boolean } {
    if (!this.world) return { state: 'none', countdown: 0, rightOnRed: false };
    const fx = Math.sin(this.playerState.heading);
    const fz = Math.cos(this.playerState.heading);
    let bestDist = 48;
    let res: { state: HudSnapshot['nearSignalState']; countdown: number; rightOnRed: boolean } = { state: 'none', countdown: 0, rightOnRed: false };

    for (const sig of this.world.signals) {
      const dx = sig.node.x - this.playerState.x;
      const dz = sig.node.z - this.playerState.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestDist || dist < 6) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot < 0.5) continue;
      bestDist = dist;
      const app = RoadGraph.approachIdFromVector(fx, fz);
      const light = sig.controller.lightFor(app);
      res = {
        state: light === 'off' ? 'flashing' : light,
        countdown: sig.controller.countdownFor(app),
        rightOnRed: Boolean(sig.node.rightOnRed?.[app]),
      };
    }
    return res;
  }

  private pushHud(force: boolean) {
    const spec = SPECS[this.config.vehicle];
    const proj = force || !this.lastProjection
      ? this.graph.projectPoint(this.playerState.x, this.playerState.z, this.playerState.heading)
      : this.lastProjection;
    const nearSig = this.getNearestSignalHud();
    const wp = this.getCurrentWaypoint();
    const sc = this.activeScenario;

    let laneNote = 'Đi bên phải đúng làn';
    if (proj) {
      if (proj.isWrongWay) laneNote = 'Cảnh báo: Đang đi ngược chiều!';
      else if (proj.onSidewalk) laneNote = 'Cảnh báo: Đang chạy lên vỉa hè!';
      else if (proj.edge.edge.hasMotorbikeLane) {
        laneNote = proj.inMotorbikeLane ? 'Làn xe máy (R.412)' : 'Làn ô tô / hỗn hợp';
      } else if (proj.edge.edge.lanesBackward === 0) {
        laneNote = 'Đường một chiều (I.407a)';
      }
    }

    const ambulanceNearby = Boolean(
      this.traffic?.npcs.some((n) => n.kind === 'ambulance' && Math.hypot(n.x - this.playerState.x, n.z - this.playerState.z) < 55),
    );
    const trainComing = Boolean(
      this.world?.railway &&
        this.world.railway.warningActive &&
        Math.hypot(this.world.railway.x - this.playerState.x, this.world.railway.z - this.playerState.z) < 65,
    );

    const snap: HudSnapshot = {
      phase: this.phase,
      speedKmh: Math.round(toKmh(Math.abs(this.playerState.speed))),
      rpm: Math.round(this.playerState.rpm),
      maxRpm: spec.redlineRpm,
      gear: this.playerState.gear,
      vehicle: this.config.vehicle,
      map: this.config.map,
      mode: this.config.mode,
      cameraMode: this.cameraRig.mode,
      headlight: this.headlight,
      signalLeft: this.signalLeft,
      signalRight: this.signalRight,
      hazard: this.hazard,
      hornActive: this.controls.input.horn,
      speedLimitKmh: proj ? proj.edge.edge.speedLimitKmh : 50,
      currentRoadName: proj ? proj.edge.edge.name : this.graph.data.name,
      laneNote,
      gplxPoints: this.rules.points,
      maxGplxPoints: this.rules.maxPoints,
      violations: [...this.rules.violations],
      latestViolation: this.latestViolation,
      distanceKm: this.distanceM / 1000,
      elapsedSec: this.elapsedSec,
      minimapExpanded: this.minimapExpanded,
      scenarioTitle: sc ? sc.title : null,
      scenarioHint: sc ? sc.hint : null,
      scenarioStepText: wp ? wp.label : null,
      scenarioProgress: sc ? this.waypointIdx / Math.max(1, sc.waypoints.length) : 0,
      scenarioDistanceM: wp ? Math.round(Math.hypot(wp.x - this.playerState.x, wp.z - this.playerState.z)) : 0,
      scenarioPassed: this.scenarioPassed,
      scenarioEndReason: this.scenarioEndReason,
      scenarioDebrief: sc ? sc.debriefTip : null,
      nearSignalState: nearSig.state,
      nearSignalCountdown: nearSig.countdown,
      nearRightOnRedAllowed: nearSig.rightOnRed,
      ambulanceNearby,
      trainComing,
      lookAngle: this.cameraRig.lookOffsetRad,
      fps: Math.max(1, Math.round(this.fpsEma)),
      drawCalls: this.lastDrawCalls,
    };
    this.onHudUpdate(snap);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.controls.dispose();
    this.audio.dispose();
    window.removeEventListener('keydown', this.handleExtraKeyDown);
    window.removeEventListener('keyup', this.handleExtraKeyUp);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleBlur);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.renderer.domElement.removeEventListener('contextmenu', this.handleContextMenu);
    this.world?.dispose();
    this.traffic?.dispose();
    this.playerMesh?.dispose();
    this.sprayMesh.geometry.dispose();
    this.sprayMat.dispose();
    this.vehiclePool.dispose();
    this.humanPool.dispose();
    this.envTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
