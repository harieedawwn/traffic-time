import React from 'react';
import {
  applyGraphicsPreset,
  GRAPHICS_PRESET_LABELS,
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
  type HudSnapshot,
  type MapId,
  type TimeOfDay,
  type VehicleId,
} from '../game/types';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  HomeIcon,
  InfinityIcon,
  KeyboardIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  ShieldIcon,
} from './UiIcons';

interface PauseModalProps {
  config: GameConfig;
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onResetViolations: () => void;
  onReturnTitle: () => void;
  onUpdateConfig: (partial: Partial<GameConfig>) => void;
}

const PRESETS: GraphicsPreset[] = ['low', 'medium', 'high', 'ultra'];

export const PauseModal: React.FC<PauseModalProps> = ({
  config,
  hud,
  onResume,
  onRestart,
  onResetViolations,
  onReturnTitle,
  onUpdateConfig,
}) => {
  const gfx = config.graphics;
  const isFree = hud.mode === 'free';
  const patchGfx = (partial: Partial<GraphicsSettings>) => {
    onUpdateConfig({ graphics: { ...gfx, ...partial } });
  };

  const nextShadow = (cur: ShadowQuality): ShadowQuality => {
    const order: ShadowQuality[] = ['off', 'low', 'medium', 'high'];
    return order[(order.indexOf(cur) + 1) % order.length];
  };
  const shadowLabel: Record<ShadowQuality, string> = { off: 'Tắt', low: 'Thấp', medium: 'Vừa', high: 'Cao' };

  const nextMirror = (cur: MirrorQuality): MirrorQuality => {
    const order: MirrorQuality[] = ['off', 'low', 'high'];
    return order[(order.indexOf(cur) + 1) % order.length];
  };
  const mirrorLabel: Record<MirrorQuality, string> = { off: 'Tắt', low: 'Thấp', high: 'Rõ' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tạm dừng trò chơi"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        backgroundColor: 'rgba(14, 18, 26, 0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="saigon-panel flat-scroll"
        style={{
          width: 'min(516px, 100%)',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Ink Header */}
        <div
          style={{
            backgroundColor: '#141820',
            color: '#f4efe4',
            padding: '13px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            borderBottom: '3px solid #eab308',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '0.02em' }}>
            <PauseIcon size={16} color="#eab308" />
            TẠM DỪNG
          </h2>
          <span className="tabular" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#eab308', fontWeight: 800 }}>
            {isFree ? (
              <>
                <InfinityIcon size={15} color="#4ade80" />
                Lái tự do · {hud.distanceKm.toFixed(2)} km
              </>
            ) : (
              <>
                <ShieldIcon size={14} color="#eab308" />
                {hud.gplxPoints}/12 điểm · {hud.distanceKm.toFixed(2)} km
              </>
            )}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '15px 18px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Quick Vehicle Switch */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 900, color: '#525d6e', marginBottom: 6, letterSpacing: '0.06em' }}>
              ĐỔI XE NHANH
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {(['wave110', 'vision110', 'sedan'] as VehicleId[]).map((v) => {
                const active = config.vehicle === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdateConfig({ vehicle: v })}
                    style={{
                      padding: '8px 6px',
                      backgroundColor: active ? '#141820' : '#e8e0cf',
                      color: active ? '#eab308' : '#141820',
                      border: '2px solid #141820',
                      boxShadow: active ? '2px 2px 0 #d92d20' : 'none',
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v === 'wave110' ? 'Wave 110' : v === 'vision110' ? 'Vision 110' : 'Sedan'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Map Switch */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 900, color: '#525d6e', marginBottom: 6, letterSpacing: '0.06em' }}>
              ĐỔI BẢN ĐỒ (CHẾ ĐỘ VÔ TẬN)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['boulevard', 'oldquarter', 'residential', 'highway'] as MapId[]).map((m) => {
                const active = config.map === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onUpdateConfig({ map: m, mode: 'free' })}
                    style={{
                      padding: '7px 10px',
                      backgroundColor: active ? '#0c4da2' : '#ffffff',
                      color: active ? '#ffffff' : '#141820',
                      border: '2px solid #141820',
                      fontSize: 12,
                      fontWeight: 800,
                      textAlign: 'left',
                    }}
                  >
                    {MAP_LABELS[m].name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Time & Weather Switch */}
          <div style={{ display: 'flex', gap: 5 }}>
            {(['morning', 'noon', 'afternoon', 'night'] as TimeOfDay[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onUpdateConfig({ timeOfDay: t })}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  backgroundColor: config.timeOfDay === t ? '#eab308' : '#e8e0cf',
                  color: '#141820',
                  border: '1.5px solid #141820',
                  fontSize: 11.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {TIME_LABELS[t].short}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onUpdateConfig({ weather: config.weather === 'rain' ? 'clear' : 'rain' })}
              style={{
                padding: '7px 12px',
                backgroundColor: config.weather === 'rain' ? '#0c4da2' : '#e8e0cf',
                color: config.weather === 'rain' ? '#ffffff' : '#141820',
                border: '1.5px solid #141820',
                fontSize: 11.5,
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              {config.weather === 'rain' ? 'Mưa' : 'Nắng'}
            </button>
          </div>

          {/* Live Graphics & Performance Controls */}
          <div
            style={{
              backgroundColor: '#e8e0cf',
              border: '2px solid #141820',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10.5, fontWeight: 900, color: '#141820', letterSpacing: '0.05em' }}>
                ĐỒ HOẠ & TỐI ƯU FPS TRỰC TIẾP
              </span>
              <span className="tabular" style={{ fontSize: 11, fontWeight: 900, color: '#0c4da2' }}>
                {hud.fps} FPS · {hud.drawCalls} DC
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
              {PRESETS.map((p) => {
                const active = gfx.preset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdateConfig({ graphics: applyGraphicsPreset(p, gfx.showFps, gfx.autoFpsGuard) })}
                    style={{
                      padding: '6px 4px',
                      backgroundColor: active ? '#141820' : '#f4efe4',
                      color: active ? '#eab308' : '#141820',
                      border: '1.5px solid #141820',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {GRAPHICS_PRESET_LABELS[p].name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
              <button
                type="button"
                onClick={() => patchGfx({ shadows: nextShadow(gfx.shadows) })}
                style={{
                  padding: '6px 4px',
                  backgroundColor: '#f4efe4',
                  color: '#141820',
                  border: '1.5px solid #141820',
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                Bóng: {shadowLabel[gfx.shadows]}
              </button>
              <button
                type="button"
                onClick={() => patchGfx({ mirrorQuality: nextMirror(gfx.mirrorQuality) })}
                style={{
                  padding: '6px 4px',
                  backgroundColor: '#f4efe4',
                  color: '#141820',
                  border: '1.5px solid #141820',
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                Gương: {mirrorLabel[gfx.mirrorQuality]}
              </button>
              <button
                type="button"
                onClick={() => patchGfx({ autoFpsGuard: !gfx.autoFpsGuard })}
                style={{
                  padding: '6px 4px',
                  backgroundColor: gfx.autoFpsGuard ? '#15803d' : '#f4efe4',
                  color: gfx.autoFpsGuard ? '#ffffff' : '#141820',
                  border: '1.5px solid #141820',
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                Giữ FPS: {gfx.autoFpsGuard ? 'Bật' : 'Tắt'}
              </button>
              <button
                type="button"
                onClick={() => patchGfx({ showFps: !gfx.showFps })}
                style={{
                  padding: '6px 4px',
                  backgroundColor: gfx.showFps ? '#0c4da2' : '#f4efe4',
                  color: gfx.showFps ? '#ffffff' : '#141820',
                  border: '1.5px solid #141820',
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                FPS: {gfx.showFps ? 'Hiện' : 'Ẩn'}
              </button>
            </div>
          </div>

          {/* Free Drive Violation Reset Helper */}
          {isFree && hud.violations.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                border: '1.5px solid #141820',
                padding: '7px 10px',
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#141820' }}>
                Đang ghi nhận {hud.violations.length} nhắc lỗi trong lượt tự do này.
              </span>
              <button
                type="button"
                onClick={onResetViolations}
                style={{
                  padding: '4px 9px',
                  backgroundColor: '#141820',
                  color: '#eab308',
                  fontSize: 11,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                Xoá nhật ký lỗi
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
            <button
              type="button"
              onClick={onResume}
              style={{
                gridColumn: '1 / -1',
                padding: '12px',
                backgroundColor: '#15803d',
                border: '2px solid #141820',
                boxShadow: '4px 4px 0 #141820',
                color: '#ffffff',
                fontSize: 14.5,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <PlayIcon size={15} color="#ffffff" />
              TIẾP TỤC LÁI
            </button>
            <button
              type="button"
              onClick={onRestart}
              style={{
                padding: '10px',
                backgroundColor: '#e8e0cf',
                color: '#141820',
                border: '2px solid #141820',
                fontSize: 12.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <RefreshIcon size={14} color="#141820" />
              Đặt lại vị trí
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              style={{
                padding: '10px',
                backgroundColor: '#141820',
                color: '#f4efe4',
                border: '2px solid #141820',
                fontSize: 12.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <HomeIcon size={14} color="#eab308" />
              Về Menu chính
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ResultModalProps {
  hud: HudSnapshot;
  scenarioId: number;
  onRetry: () => void;
  onNextScenario: () => void;
  onReturnTitle: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ hud, scenarioId, onRetry, onNextScenario, onReturnTitle }) => {
  const passed = Boolean(hud.scenarioPassed);
  const hasNext = hud.mode === 'scenario' && scenarioId < SCENARIOS.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kết quả bài tập"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 35,
        backgroundColor: 'rgba(14, 18, 26, 0.84)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="saigon-panel flat-scroll"
        style={{
          width: 'min(540px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Result Band */}
        <div
          style={{
            backgroundColor: passed ? '#15803d' : '#d92d20',
            color: '#ffffff',
            padding: '15px 20px',
            borderBottom: '2px solid #141820',
            display: 'flex',
            alignItems: 'center',
            gap: 13,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#141820',
              border: '2px solid #ffffff',
              flexShrink: 0,
            }}
          >
            {passed ? <CheckIcon size={21} color="#4ade80" /> : <AlertIcon size={21} color="#fde047" />}
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, letterSpacing: '0.01em' }}>
              {passed ? 'ĐẠT YÊU CẦU BÀI TẬP' : 'CHƯA ĐẠT — CẦN LUYỆN THÊM'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#f4efe4', fontWeight: 600 }}>
              {hud.scenarioEndReason}
            </p>
          </div>
        </div>

        <div style={{ padding: '16px 20px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ backgroundColor: '#ffffff', border: '2px solid #141820', padding: '10px' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#525d6e', letterSpacing: '0.05em' }}>ĐIỂM GPLX</div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 900, color: '#141820', marginTop: 2 }}>
                {hud.gplxPoints}/12
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '2px solid #141820', padding: '10px' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#525d6e', letterSpacing: '0.05em' }}>SỐ LỖI</div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 900, color: hud.violations.length ? '#d92d20' : '#15803d', marginTop: 2 }}>
                {hud.violations.length}
              </div>
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '2px solid #141820', padding: '10px' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#525d6e', letterSpacing: '0.05em' }}>THỜI GIAN</div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 900, color: '#0c4da2', marginTop: 2 }}>
                {Math.round(hud.elapsedSec)}s
              </div>
            </div>
          </div>

          {/* Educational Debrief Tip */}
          {hud.scenarioDebrief && (
            <div style={{ backgroundColor: '#e8e0cf', border: '2px solid #141820', padding: '10px 12px', fontSize: 12.5, color: '#141820' }}>
              <strong style={{ color: '#0c4da2' }}>Mẹo lái xe thực tế:</strong> {hud.scenarioDebrief}
            </div>
          )}

          {/* Violations History */}
          {hud.violations.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 900, color: '#525d6e', marginBottom: 6, letterSpacing: '0.05em' }}>
                CHI TIẾT CÁC LỖI ĐÃ MẮC
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {hud.violations.slice(0, 6).map((v) => (
                  <div key={v.id} style={{ backgroundColor: '#ffffff', border: '2px solid #141820', padding: '8px 10px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: '#d92d20' }}>
                      {v.title} (−{v.points} điểm)
                    </div>
                    <div style={{ fontSize: 12, color: '#141820', marginTop: 2 }}>{v.detail}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0c4da2', marginTop: 2 }}>Khắc phục: {v.tip}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button
              type="button"
              data-start="true"
              onClick={onRetry}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#0c4da2',
                border: '2px solid #141820',
                boxShadow: '3px 3px 0 #141820',
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <RefreshIcon size={14} color="#ffffff" />
              Luyện lại bài này
            </button>
            {passed && hasNext && (
              <button
                type="button"
                onClick={onNextScenario}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#15803d',
                  border: '2px solid #141820',
                  boxShadow: '3px 3px 0 #141820',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Bài tiếp theo
                <ArrowRightIcon size={13} color="#ffffff" />
              </button>
            )}
            <button
              type="button"
              onClick={onReturnTitle}
              style={{
                padding: '12px 14px',
                backgroundColor: '#141820',
                color: '#f4efe4',
                border: '2px solid #141820',
                fontSize: 13,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <HomeIcon size={14} color="#eab308" />
              Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ControlsModalProps {
  onClose: () => void;
}

const KEY_ROWS: [string, string][] = [
  ['W / ↑ / K', 'Ga / tiến tới'],
  ['S / ↓', 'Lùi (khi đứng yên) / phanh nhẹ khi đang chạy'],
  ['A / ← · D / →', 'Đánh lái trái / phải'],
  ['Space / L', 'Phanh (thắng)'],
  ['E / F', 'Bấm còi'],
  ['T', 'Đèn pha (Tắt → Cốt → Pha)'],
  ['Q / R', 'Bật/tắt xi-nhan trái / phải'],
  ['H', 'Đèn khẩn cấp (Hazard)'],
  ['C / V', 'Đổi 4 góc nhìn (3 góc thứ 3 + 1 buồng lái FPV)'],
  ['Z / X hoặc Chuột phải', 'Liếc nhìn trái / phải kiểm tra điểm mù'],
  ['M', 'Phóng to / thu nhỏ Minimap'],
  ['1 / 2', 'Đổi nhanh xe máy / ô tô (khi dừng xe)'],
  ['P / Esc', 'Tạm dừng'],
];

export const ControlsModal: React.FC<ControlsModalProps> = ({ onClose }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Hướng dẫn phím điều khiển"
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 40,
      backgroundColor: 'rgba(14, 18, 26, 0.82)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}
  >
    <div
      className="saigon-panel"
      style={{
        width: 'min(500px, 100%)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#141820',
          color: '#f4efe4',
          padding: '13px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '3px solid #eab308',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <KeyboardIcon size={17} color="#eab308" />
          BẢNG PHÍM ĐIỀU KHIỂN
        </h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            backgroundColor: '#d92d20',
            color: '#ffffff',
            border: '1.5px solid #ffffff',
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 900,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <CloseIcon size={12} color="#ffffff" />
          Đóng
        </button>
      </div>
      <div style={{ padding: '12px 16px 15px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {KEY_ROWS.map(([k, desc]) => (
          <div
            key={k}
            style={{
              backgroundColor: '#ffffff',
              border: '1.5px solid #141820',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '6px 9px',
              fontSize: 12,
            }}
          >
            <kbd className="kbd-chip">{k}</kbd>
            <span style={{ color: '#141820', fontWeight: 700, textAlign: 'right' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
