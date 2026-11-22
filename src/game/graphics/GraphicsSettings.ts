export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type MirrorQuality = 'off' | 'low' | 'high';
export type DetailLevel = 'low' | 'medium' | 'high';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  /** Internal render scale multiplier relative to native pixel ratio (0.65..1.25) */
  resolutionScale: number;
  shadows: ShadowQuality;
  /** Camera far plane & fog / actor culling distance in meters */
  drawDistance: number;
  mirrorQuality: MirrorQuality;
  detailLevel: DetailLevel;
  showFps: boolean;
  /** Automatically step down internal render scale if FPS dips below target so gameplay stays smooth */
  autoFpsGuard: boolean;
}

export const GRAPHICS_PRESETS: Record<GraphicsPreset, Omit<GraphicsSettings, 'showFps' | 'autoFpsGuard'>> = {
  low: {
    preset: 'low',
    resolutionScale: 0.7,
    shadows: 'off',
    drawDistance: 150,
    mirrorQuality: 'off',
    detailLevel: 'low',
  },
  medium: {
    preset: 'medium',
    resolutionScale: 0.85,
    shadows: 'low',
    drawDistance: 230,
    mirrorQuality: 'low',
    detailLevel: 'medium',
  },
  high: {
    preset: 'high',
    resolutionScale: 1.0,
    shadows: 'medium',
    drawDistance: 320,
    mirrorQuality: 'high',
    detailLevel: 'high',
  },
  ultra: {
    preset: 'ultra',
    resolutionScale: 1.25,
    shadows: 'high',
    drawDistance: 440,
    mirrorQuality: 'high',
    detailLevel: 'high',
  },
};

export const GRAPHICS_PRESET_LABELS: Record<GraphicsPreset, { name: string; desc: string }> = {
  low: { name: 'Thấp', desc: 'Tối đa FPS cho máy yếu' },
  medium: { name: 'Trung bình', desc: 'Cân bằng hình ảnh & mượt' },
  high: { name: 'Cao', desc: 'Bóng đổ sắc nét, gương rõ' },
  ultra: { name: 'Siêu nét', desc: 'Độ phân giải cao & tầm nhìn xa' },
};

export const SHADOW_MAP_SIZES: Record<ShadowQuality, number> = {
  off: 0,
  low: 512,
  medium: 1024,
  high: 2048,
};

export const MIRROR_RESOLUTIONS: Record<MirrorQuality, { width: number; height: number; intervalGpu: number; intervalSw: number }> = {
  off: { width: 0, height: 0, intervalGpu: 999, intervalSw: 999 },
  low: { width: 160, height: 80, intervalGpu: 3, intervalSw: 4 },
  high: { width: 320, height: 160, intervalGpu: 2, intervalSw: 3 },
};

const STORAGE_KEY = 'traffic-time-graphics-v1';

export function defaultGraphicsSettings(isSoftwareGl = false): GraphicsSettings {
  const base = isSoftwareGl ? GRAPHICS_PRESETS.medium : GRAPHICS_PRESETS.high;
  return { ...base, showFps: false, autoFpsGuard: true };
}

export function applyGraphicsPreset(
  preset: GraphicsPreset,
  currentShowFps: boolean,
  currentAutoFpsGuard = true,
): GraphicsSettings {
  return { ...GRAPHICS_PRESETS[preset], showFps: currentShowFps, autoFpsGuard: currentAutoFpsGuard };
}

export function sanitizeGraphicsSettings(raw: Partial<GraphicsSettings> | null | undefined, fallback: GraphicsSettings): GraphicsSettings {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const preset: GraphicsPreset =
    raw.preset === 'low' || raw.preset === 'medium' || raw.preset === 'high' || raw.preset === 'ultra'
      ? raw.preset
      : fallback.preset;
  const shadows: ShadowQuality =
    raw.shadows === 'off' || raw.shadows === 'low' || raw.shadows === 'medium' || raw.shadows === 'high'
      ? raw.shadows
      : fallback.shadows;
  const mirrorQuality: MirrorQuality =
    raw.mirrorQuality === 'off' || raw.mirrorQuality === 'low' || raw.mirrorQuality === 'high'
      ? raw.mirrorQuality
      : fallback.mirrorQuality;
  const detailLevel: DetailLevel =
    raw.detailLevel === 'low' || raw.detailLevel === 'medium' || raw.detailLevel === 'high'
      ? raw.detailLevel
      : fallback.detailLevel;
  const resolutionScale =
    typeof raw.resolutionScale === 'number' && Number.isFinite(raw.resolutionScale)
      ? Math.max(0.55, Math.min(1.5, raw.resolutionScale))
      : fallback.resolutionScale;
  const drawDistance =
    typeof raw.drawDistance === 'number' && Number.isFinite(raw.drawDistance)
      ? Math.max(120, Math.min(500, Math.round(raw.drawDistance)))
      : fallback.drawDistance;
  const showFps = typeof raw.showFps === 'boolean' ? raw.showFps : fallback.showFps;
  const autoFpsGuard = typeof raw.autoFpsGuard === 'boolean' ? raw.autoFpsGuard : fallback.autoFpsGuard;
  return { preset, resolutionScale, shadows, drawDistance, mirrorQuality, detailLevel, showFps, autoFpsGuard };
}

export function loadSavedGraphicsSettings(isSoftwareGl = false): GraphicsSettings {
  const fallback = defaultGraphicsSettings(isSoftwareGl);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return sanitizeGraphicsSettings(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function saveGraphicsSettings(settings: GraphicsSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore private-mode storage restrictions
  }
}

export function computeEffectivePixelRatio(settings: GraphicsSettings, devicePixelRatio: number, isSoftwareGl: boolean): number {
  if (isSoftwareGl) {
    // Keep software WebGL fast while still honoring lower resolution scales
    return Math.max(0.6, Math.min(1.0, settings.resolutionScale));
  }
  const baseDpr = Math.min(Math.max(1, devicePixelRatio || 1), 2);
  return Math.max(0.6, Math.min(2.2, baseDpr * settings.resolutionScale));
}
