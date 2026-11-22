import type { GraphicsSettings } from './graphics/GraphicsSettings';

export type VehicleId = 'wave110' | 'vision110' | 'sedan';
export type MapId = 'boulevard' | 'oldquarter' | 'residential' | 'highway';
export type GameMode = 'free' | 'scenario' | 'rushhour';
export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'night';
export type WeatherKind = 'clear' | 'rain';
export type TrafficDensity = 'low' | 'medium' | 'high';
export type CameraMode = 0 | 1 | 2 | 3; // 0: TPS gần, 1: TPS xa, 2: TPS chéo cao, 3: FPV
export type HeadlightMode = 0 | 1 | 2; // 0: tắt, 1: cốt, 2: pha
export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export const CAMERA_LABELS: Record<CameraMode, string> = {
  0: 'Góc nhìn 3 (Gần)',
  1: 'Góc nhìn 3 (Xa)',
  2: 'Góc nhìn 3 (Trên cao)',
  3: 'Góc nhìn thứ nhất (Buồng lái)',
};

export const VEHICLE_LABELS: Record<VehicleId, { name: string; subtitle: string }> = {
  wave110: { name: 'Xe số Wave 110', subtitle: '4 số · Gọn nhẹ, dễ luồn lách' },
  vision110: { name: 'Tay ga Vision 110', subtitle: 'CVT mượt · Phổ biến nội đô' },
  sedan: { name: 'Ô tô Sedan hạng B', subtitle: 'Tay lái trái · Gương thật + cột A' },
};

export const MAP_LABELS: Record<MapId, { name: string; subtitle: string }> = {
  boulevard: { name: 'Đại lộ Trung tâm', subtitle: '4–6 làn · Làn xe máy riêng · Vòng xuyến lớn' },
  oldquarter: { name: 'Phố cổ Hà Nội', subtitle: 'Đường hẹp 1 chiều · Ngã tư không đèn · 30 km/h' },
  residential: { name: 'Khu dân cư & Hẻm', subtitle: 'Ngã ba khuất · Gương cầu lồi · Cổng trường' },
  highway: { name: 'Ngoại ô & Quốc lộ', subtitle: 'Cầu dốc · Đường ray tàu hỏa · Xe tải & quay đầu' },
};

export const TIME_LABELS: Record<TimeOfDay, { name: string; short: string }> = {
  morning: { name: 'Sáng sớm', short: 'Sáng' },
  noon: { name: 'Trưa nắng', short: 'Trưa' },
  afternoon: { name: 'Chiều tan tầm', short: 'Chiều' },
  night: { name: 'Ban đêm', short: 'Đêm' },
};

export interface GameConfig {
  vehicle: VehicleId;
  map: MapId;
  mode: GameMode;
  scenarioId: number; // 1..17 when mode === 'scenario'
  timeOfDay: TimeOfDay;
  weather: WeatherKind;
  density: TrafficDensity;
  volume: number; // 0..1
  muted: boolean;
  graphics: GraphicsSettings;
}

export type ViolationCode =
  | 'RED_LIGHT'
  | 'RIGHT_ON_RED_FORBIDDEN'
  | 'WRONG_WAY'
  | 'SPEEDING'
  | 'WRONG_LANE'
  | 'NO_SIGNAL'
  | 'PEDESTRIAN_YIELD'
  | 'SIDEWALK'
  | 'COLLISION'
  | 'NO_HEADLIGHT_NIGHT'
  | 'RAILWAY_BARRIER'
  | 'NO_STOP_SIGN';

export interface ViolationEvent {
  id: number;
  code: ViolationCode;
  points: number;
  title: string;
  detail: string;
  tip: string;
  timestamp: number;
}

export interface ScenarioObjective {
  id: number;
  title: string;
  summary: string;
  map: MapId;
  recommendedVehicle: VehicleId;
  timeOfDay: TimeOfDay;
  weather: WeatherKind;
  density: TrafficDensity;
  spawn: { x: number; z: number; heading: number };
  waypoints: { x: number; z: number; radius: number; label: string; requireStop?: boolean; requireSignal?: 'left' | 'right'; requireHorn?: boolean }[];
  timeLimitSec: number;
  maxViolations: number;
  hint: string;
  debriefTip: string;
  specialEvent?: 'yellowDilemma' | 'ambulance' | 'surpriseHazard' | 'trainCrossing' | 'parking';
}

export interface HudSnapshot {
  phase: GamePhase;
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number; // -1 = R, 0 = N, 1..4
  vehicle: VehicleId;
  map: MapId;
  mode: GameMode;
  cameraMode: CameraMode;
  headlight: HeadlightMode;
  signalLeft: boolean;
  signalRight: boolean;
  hazard: boolean;
  hornActive: boolean;
  speedLimitKmh: number;
  currentRoadName: string;
  laneNote: string;
  gplxPoints: number;
  maxGplxPoints: number;
  violations: ViolationEvent[];
  latestViolation: ViolationEvent | null;
  distanceKm: number;
  elapsedSec: number;
  minimapExpanded: boolean;
  // Scenario tracking
  scenarioTitle: string | null;
  scenarioHint: string | null;
  scenarioStepText: string | null;
  scenarioProgress: number; // 0..1
  scenarioDistanceM: number;
  scenarioPassed: boolean | null;
  scenarioEndReason: string | null;
  scenarioDebrief: string | null;
  // Active warning
  nearSignalState: 'green' | 'yellow' | 'red' | 'flashing' | 'none';
  nearSignalCountdown: number;
  nearRightOnRedAllowed: boolean;
  ambulanceNearby: boolean;
  trainComing: boolean;
  lookAngle: number; // -1 left, 0 center, +1 right
  // Performance telemetry (shown only when user enables showFps in Graphics Settings)
  fps: number;
  drawCalls: number;
}
