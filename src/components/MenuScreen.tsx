import React, { useState } from 'react';
import {
  applyGraphicsPreset,
  GRAPHICS_PRESET_LABELS,
  type DetailLevel,
  type GraphicsPreset,
  type GraphicsSettings,
  type MirrorQuality,
  type ShadowQuality,
} from '../game/graphics/GraphicsSettings';
import { SCENARIOS } from '../game/rules/scenarios';
import {
  MAP_LABELS,
  TIME_LABELS,
  type GameConfig,
  type GameMode,
  type MapId,
  type TimeOfDay,
  type TrafficDensity,
  type VehicleId,
} from '../game/types';
import {
  BikeIcon,
  CarIcon,
  InfinityIcon,
  KeyboardIcon,
  PlayIcon,
  SlidersIcon,
  TrafficLightIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from './UiIcons';

interface MenuScreenProps {
  config: GameConfig;
  onChange: (partial: Partial<GameConfig>) => void;
  onStart: () => void;
  onShowControls: () => void;
}

const VEHICLES: {
  id: VehicleId;
  plateTop: string;
  plateBottom: string;
  name: string;
  spec: string;
  icon: 'bike' | 'car';
}[] = [
  { id: 'wave110', plateTop: '59-D1', plateBottom: '682.45', name: 'Wave 110', spec: 'Xe số · 4 cấp', icon: 'bike' },
  { id: 'vision110', plateTop: '59-X3', plateBottom: '419.08', name: 'Vision 110', spec: 'Tay ga · CVT', icon: 'bike' },
  { id: 'sedan', plateTop: '30K', plateBottom: '862.19', name: 'Sedan B', spec: 'Ô tô · Tay lái trái', icon: 'car' },
];

const MAPS: { id: MapId; limit: number; tag: string }[] = [
  { id: 'boulevard', limit: 60, tag: 'Vòng xuyến · Làn xe máy' },
  { id: 'oldquarter', limit: 30, tag: 'Một chiều · Phố hẹp' },
  { id: 'residential', limit: 40, tag: 'Ngã ba khuất · Cổng trường' },
  { id: 'highway', limit: 70, tag: 'Cầu dốc · Đường ray tàu' },
];

const MODES: { id: GameMode; label: string; note: string }[] = [
  { id: 'free', label: 'Lái tự do', note: 'VÔ TẬN' },
  { id: 'scenario', label: '17 Bài tập', note: 'GPLX' },
  { id: 'rushhour', label: 'Cao điểm', note: 'ĐÔNG XE' },
];

const TIMES: TimeOfDay[] = ['morning', 'noon', 'afternoon', 'night'];
const DENSITIES: { id: TrafficDensity; label: string }[] = [
  { id: 'low', label: 'Thưa' },
  { id: 'medium', label: 'Vừa' },
  { id: 'high', label: 'Đông' },
];
const PRESETS: GraphicsPreset[] = ['low', 'medium', 'high', 'ultra'];
const SHADOW_OPTS: { id: ShadowQuality; label: string }[] = [
  { id: 'off', label: 'Tắt' },
  { id: 'low', label: 'Thấp' },
  { id: 'medium', label: 'Vừa' },
  { id: 'high', label: 'Cao' },
];
const MIRROR_OPTS: { id: MirrorQuality; label: string }[] = [
  { id: 'off', label: 'Tắt' },
  { id: 'low', label: 'Thấp' },
  { id: 'high', label: 'Rõ' },
];
const DETAIL_OPTS: { id: DetailLevel; label: string }[] = [
  { id: 'low', label: 'Thấp' },
  { id: 'medium', label: 'Vừa' },
  { id: 'high', label: 'Cao' },
];

export const MenuScreen: React.FC<MenuScreenProps> = ({ config, onChange, onStart, onShowControls }) => {
  const [showGraphics, setShowGraphics] = useState(false);
  const selectedScenario = SCENARIOS.find((s) => s.id === config.scenarioId) ?? SCENARIOS[0];
  const gfx = config.graphics;

  const updateGfx = (partial: Partial<GraphicsSettings>) => {
    onChange({ graphics: { ...gfx, ...partial } });
  };

  const selectPreset = (preset: GraphicsPreset) => {
    onChange({ graphics: applyGraphicsPreset(preset, gfx.showFps, gfx.autoFpsGuard) });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 20px',
      }}
    >
      {/* Main Row: Left Saigon Modernist Studio + Right Minimal Street Signpost */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        {/* Left Bespoke Saigon Modernist Studio Panel */}
        <div
          className="saigon-panel flat-scroll"
          style={{
            pointerEvents: 'auto',
            width: 'min(454px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 76px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Carbon-Ink Editorial Masthead */}
          <div
            style={{
              backgroundColor: '#141820',
              color: '#f4efe4',
              padding: '13px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              borderBottom: '3px solid #d92d20',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: '#eab308',
                  color: '#141820',
                  border: '2px solid #f4efe4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TrafficLightIcon size={22} color="#141820" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    TRAFFIC TIME
                  </h1>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                      color: '#eab308',
                    }}
                  >
                    VN
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#b7c0ce', marginTop: 3 }}>
                  Mô phỏng giao thông Việt Nam thực tế
                </div>
              </div>
            </div>

            {/* Compact Header Utility Icons */}
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                type="button"
                onClick={onShowControls}
                title="Bảng phím điều khiển"
                style={{
                  padding: '6px 9px',
                  backgroundColor: '#232a37',
                  color: '#f4efe4',
                  border: '1.5px solid #445066',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <KeyboardIcon size={13} color="#eab308" />
                Phím
              </button>
              <button
                type="button"
                onClick={() => setShowGraphics((v) => !v)}
                aria-expanded={showGraphics}
                title="Cài đặt đồ hoạ & hiệu năng"
                style={{
                  padding: '6px 9px',
                  backgroundColor: showGraphics ? '#eab308' : '#232a37',
                  color: showGraphics ? '#141820' : '#f4efe4',
                  border: showGraphics ? '1.5px solid #ffffff' : '1.5px solid #445066',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <SlidersIcon size={13} color={showGraphics ? '#141820' : '#f4efe4'} />
                Đồ hoạ
              </button>
              <button
                type="button"
                onClick={() => onChange({ muted: !config.muted })}
                title={config.muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                aria-label={config.muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                style={{
                  padding: '6px 8px',
                  backgroundColor: config.muted ? '#d92d20' : '#232a37',
                  color: '#ffffff',
                  border: '1.5px solid #445066',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {config.muted ? <VolumeOffIcon size={14} color="#ffffff" /> : <VolumeOnIcon size={14} color="#eab308" />}
              </button>
            </div>
          </div>

          {/* Studio Body */}
          <div style={{ padding: '14px 16px 15px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {/* Collapsible Graphics Drawer */}
            {showGraphics && (
              <div
                style={{
                  backgroundColor: '#e8e0cf',
                  border: '2px solid #141820',
                  padding: '10px 11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.05em', color: '#141820' }}>
                    CẤU HÌNH ĐỒ HOẠ & HIỆU NĂNG
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0c4da2' }}>
                    {GRAPHICS_PRESET_LABELS[gfx.preset].name}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {PRESETS.map((p) => {
                    const active = gfx.preset === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => selectPreset(p)}
                        style={{
                          padding: '6px 4px',
                          backgroundColor: active ? '#141820' : '#f4efe4',
                          color: active ? '#eab308' : '#141820',
                          border: '1.5px solid #141820',
                          fontSize: 11,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {GRAPHICS_PRESET_LABELS[p].name}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#525d6e', marginBottom: 4 }}>BÓNG ĐỔ 3D</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                      {SHADOW_OPTS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updateGfx({ shadows: s.id })}
                          style={{
                            padding: '5px 2px',
                            backgroundColor: gfx.shadows === s.id ? '#0c4da2' : '#f4efe4',
                            color: gfx.shadows === s.id ? '#ffffff' : '#141820',
                            border: '1px solid #141820',
                            fontSize: 10.5,
                            fontWeight: 800,
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#525d6e', marginBottom: 4 }}>GƯƠNG CHIẾU HẬU</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                      {MIRROR_OPTS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateGfx({ mirrorQuality: m.id })}
                          style={{
                            padding: '5px 2px',
                            backgroundColor: gfx.mirrorQuality === m.id ? '#0c4da2' : '#f4efe4',
                            color: gfx.mirrorQuality === m.id ? '#ffffff' : '#141820',
                            border: '1px solid #141820',
                            fontSize: 10.5,
                            fontWeight: 800,
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 800 }}>
                      <span>Độ phân giải</span>
                      <span className="tabular" style={{ color: '#0c4da2' }}>{Math.round(gfx.resolutionScale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.25}
                      step={0.05}
                      value={gfx.resolutionScale}
                      onChange={(e) => updateGfx({ resolutionScale: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#141820' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 800 }}>
                      <span>Tầm nhìn</span>
                      <span className="tabular" style={{ color: '#0c4da2' }}>{gfx.drawDistance} m</span>
                    </div>
                    <input
                      type="range"
                      min={110}
                      max={280}
                      step={10}
                      value={gfx.drawDistance}
                      onChange={(e) => updateGfx({ drawDistance: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: '#141820' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 5, alignItems: 'center' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                    {DETAIL_OPTS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => updateGfx({ detailLevel: d.id })}
                        style={{
                          padding: '5px 2px',
                          backgroundColor: gfx.detailLevel === d.id ? '#141820' : '#f4efe4',
                          color: gfx.detailLevel === d.id ? '#ffffff' : '#141820',
                          border: '1px solid #141820',
                          fontSize: 10.5,
                          fontWeight: 800,
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => updateGfx({ autoFpsGuard: !gfx.autoFpsGuard })}
                    style={{
                      padding: '5px 8px',
                      backgroundColor: gfx.autoFpsGuard ? '#15803d' : '#f4efe4',
                      color: gfx.autoFpsGuard ? '#ffffff' : '#141820',
                      border: '1px solid #141820',
                      fontSize: 10.5,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Giữ FPS: {gfx.autoFpsGuard ? 'Bật' : 'Tắt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGfx({ showFps: !gfx.showFps })}
                    style={{
                      padding: '5px 8px',
                      backgroundColor: gfx.showFps ? '#0c4da2' : '#f4efe4',
                      color: gfx.showFps ? '#ffffff' : '#141820',
                      border: '1px solid #141820',
                      fontSize: 10.5,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    FPS
                  </button>
                </div>
              </div>
            )}

            {/* 1. Mode Switcher (Zero pills — architectural ink tabs) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.07em', color: '#525d6e' }}>
                  01 · CHẾ ĐỘ LÁI
                </span>
                {config.mode === 'free' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10.5,
                      fontWeight: 800,
                      color: '#15803d',
                    }}
                  >
                    <InfinityIcon size={14} color="#15803d" />
                    Không giới hạn thời gian & điểm
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {MODES.map((m) => {
                  const active = config.mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChange({ mode: m.id })}
                      style={{
                        padding: '9px 8px',
                        backgroundColor: active ? '#141820' : '#e8e0cf',
                        color: active ? '#f4efe4' : '#141820',
                        border: '2px solid #141820',
                        boxShadow: active ? '3px 3px 0 #d92d20' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 900, whiteSpace: 'nowrap' }}>{m.label}</span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: active ? '#eab308' : '#525d6e',
                        }}
                      >
                        {m.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scenario Selector (only when mode === 'scenario') */}
            {config.mode === 'scenario' && (
              <div
                style={{
                  backgroundColor: '#e8e0cf',
                  border: '2px solid #141820',
                  padding: '9px 11px',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', color: '#0c4da2', marginBottom: 5 }}>
                  CHỌN TÌNH HUỐNG LUYỆN LÁI ({selectedScenario.id}/17)
                </div>
                <select
                  aria-label="Chọn bài tập giao thông"
                  value={config.scenarioId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const sc = SCENARIOS.find((s) => s.id === id);
                    onChange({
                      scenarioId: id,
                      ...(sc ? { map: sc.map, vehicle: sc.recommendedVehicle, timeOfDay: sc.timeOfDay, weather: sc.weather } : {}),
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 8px',
                    backgroundColor: '#ffffff',
                    color: '#141820',
                    border: '2px solid #141820',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 800,
                  }}
                >
                  {SCENARIOS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      #{sc.id} — {sc.title}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: '#2b3442', marginTop: 6, lineHeight: 1.4, fontWeight: 500 }}>
                  {selectedScenario.summary}
                </div>
              </div>
            )}

            {/* 2. Authentic Vietnamese License-Plate Vehicle Selector */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.07em', color: '#525d6e', marginBottom: 6 }}>
                02 · CHỌN PHƯƠNG TIỆN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                {VEHICLES.map((v) => {
                  const active = config.vehicle === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onChange({ vehicle: v.id })}
                      className={active ? 'vn-plate-active' : 'vn-plate'}
                      style={{
                        padding: '8px 7px 7px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        textAlign: 'center',
                      }}
                    >
                      {/* Top mini plate stamp */}
                      <div
                        className="tabular"
                        style={{
                          width: '100%',
                          paddingBottom: 4,
                          borderBottom: `1.5px dashed ${active ? '#465266' : '#c6beae'}`,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 10.5,
                          fontWeight: 900,
                          letterSpacing: '0.04em',
                          color: active ? '#eab308' : '#141820',
                        }}
                      >
                        {v.icon === 'bike' ? (
                          <BikeIcon size={13} color={active ? '#eab308' : '#0c4da2'} />
                        ) : (
                          <CarIcon size={13} color={active ? '#eab308' : '#0c4da2'} />
                        )}
                        <span>{v.plateTop}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 900, marginTop: 2, whiteSpace: 'nowrap' }}>{v.name}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: active ? '#cbd5e1' : '#525d6e', whiteSpace: 'nowrap' }}>
                        {v.spec}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Vietnamese Street-Sign Map Selector (hidden in Scenario mode since scenario picks map) */}
            {config.mode !== 'scenario' && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.07em', color: '#525d6e', marginBottom: 6 }}>
                  03 · TUYẾN ĐƯỜNG & BẢN ĐỒ
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {MAPS.map((m) => {
                    const active = config.map === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onChange({ map: m.id })}
                        style={{
                          padding: '8px 9px',
                          backgroundColor: active ? '#0c4da2' : '#ffffff',
                          color: active ? '#ffffff' : '#141820',
                          border: '2px solid #141820',
                          boxShadow: active ? '3px 3px 0 #eab308' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 900, lineHeight: 1.2 }}>{MAP_LABELS[m.id].name}</div>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: active ? '#d4e6ff' : '#525d6e',
                              marginTop: 2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {m.tag}
                          </div>
                        </div>
                        <span
                          className="qcvn-speed-sign"
                          style={{ width: 28, height: 28, borderWidth: 3, fontSize: 11 }}
                        >
                          {m.limit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Environment Controls (Time · Weather · Density) */}
            {config.mode !== 'scenario' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '0.07em', color: '#525d6e' }}>
                  04 · THỜI ĐIỂM, THỜI TIẾT & MẬT ĐỘ XE
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {TIMES.map((t) => {
                    const active = config.timeOfDay === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onChange({ timeOfDay: t })}
                        style={{
                          flex: 1,
                          padding: '6px 4px',
                          backgroundColor: active ? '#eab308' : '#e8e0cf',
                          color: '#141820',
                          border: '1.5px solid #141820',
                          fontSize: 11.5,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {TIME_LABELS[t].short}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => onChange({ weather: config.weather === 'rain' ? 'clear' : 'rain' })}
                    style={{
                      padding: '6px 11px',
                      backgroundColor: config.weather === 'rain' ? '#0c4da2' : '#e8e0cf',
                      color: config.weather === 'rain' ? '#ffffff' : '#141820',
                      border: '1.5px solid #141820',
                      fontSize: 11.5,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {config.weather === 'rain' ? 'Trời mưa' : 'Trời nắng'}
                  </button>
                </div>

                {config.mode === 'free' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: '#525d6e', paddingRight: 4, whiteSpace: 'nowrap' }}>
                      Mật độ:
                    </span>
                    {DENSITIES.map((d) => {
                      const active = config.density === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => onChange({ density: d.id })}
                          style={{
                            padding: '5px 4px',
                            backgroundColor: active ? '#141820' : '#e8e0cf',
                            color: active ? '#f4efe4' : '#141820',
                            border: '1.5px solid #141820',
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Primary Launch CTA */}
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              style={{
                width: '100%',
                padding: '13px 16px',
                backgroundColor: '#d92d20',
                color: '#ffffff',
                border: '2px solid #141820',
                boxShadow: '4px 4px 0 #141820',
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 2,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                <PlayIcon size={16} color="#ffffff" />
                {config.mode === 'scenario'
                  ? `BẮT ĐẦU BÀI #${config.scenarioId}`
                  : config.mode === 'rushhour'
                  ? 'VÀO GIỜ CAO ĐIỂM'
                  : 'LÊN XE — LÁI TỰ DO'}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  backgroundColor: '#141820',
                  color: '#eab308',
                  padding: '3px 7px',
                  letterSpacing: '0.06em',
                }}
              >
                ENTER
              </span>
            </button>
          </div>
        </div>

        {/* Top-Right Authentic QCVN Vietnamese Street Signpost (minimal, leaves 3D roundabout open!) */}
        <div
          className="vn-street-sign"
          style={{
            padding: '9px 14px',
            textAlign: 'right',
            maxWidth: 280,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#dbeafe' }}>
            {config.mode === 'free'
              ? 'CHẾ ĐỘ VÔ TẬN · KHÔNG KẾT THÚC'
              : config.mode === 'rushhour'
              ? 'THỬ THÁCH GIỜ CAO ĐIỂM'
              : `BÀI TẬP GPLX #${config.scenarioId}`}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, marginTop: 2, letterSpacing: '-0.01em' }}>
            {MAP_LABELS[config.map].name.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#e0edff', marginTop: 2 }}>
            {TIME_LABELS[config.timeOfDay].name} · {config.weather === 'rain' ? 'Mưa rào' : 'Trời quang'}
          </div>
        </div>
      </div>

      {/* Bottom Slim Ink Keycap Bar */}
      <div
        style={{
          alignSelf: 'flex-end',
          backgroundColor: '#141820',
          color: '#f4efe4',
          border: '2px solid #f4efe4',
          boxShadow: '4px 4px 0 #141820',
          padding: '6px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 14px',
          fontSize: 11.5,
          fontWeight: 700,
        }}
      >
        <span><kbd className="kbd-chip-dark">W/↑/K</kbd> Ga</span>
        <span><kbd className="kbd-chip-dark">A/D</kbd> Lái</span>
        <span><kbd className="kbd-chip-dark">Space/L</kbd> Phanh</span>
        <span><kbd className="kbd-chip-dark">Q/R</kbd> Xi-nhan</span>
        <span><kbd className="kbd-chip-dark">E/F</kbd> Còi</span>
        <span><kbd className="kbd-chip-dark">T</kbd> Đèn</span>
        <span><kbd className="kbd-chip-dark">C</kbd> 4 Góc nhìn</span>
      </div>
    </div>
  );
};
