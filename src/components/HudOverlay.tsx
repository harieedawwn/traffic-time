import React, { useEffect, useRef } from 'react';
import { CAMERA_LABELS, type HudSnapshot } from '../game/types';
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CameraIcon,
  HeadlightIcon,
  HornIcon,
  InfinityIcon,
  KeyboardIcon,
  MapGridIcon,
  PauseIcon,
  ShieldIcon,
  TargetIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from './UiIcons';

interface HudOverlayProps {
  hud: HudSnapshot;
  muted: boolean;
  showFps: boolean;
  onBindMinimap: (canvas: HTMLCanvasElement | null) => void;
  onCycleCamera: () => void;
  onToggleMinimap: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onShowControls: () => void;
}

const RPM_BAR_COUNT = 18;

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  muted,
  showFps,
  onBindMinimap,
  onCycleCamera,
  onToggleMinimap,
  onToggleMute,
  onPause,
  onShowControls,
}) => {
  const minimapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    onBindMinimap(minimapRef.current);
    return () => onBindMinimap(null);
  }, [onBindMinimap]);

  const isFree = hud.mode === 'free';
  const speeding = hud.speedKmh > hud.speedLimitKmh + 5;
  const rpmRatio = Math.min(1, Math.max(0, hud.rpm / Math.max(1, hud.maxRpm)));
  const activeBars = Math.round(rpmRatio * RPM_BAR_COUNT);

  const gearLabel =
    hud.gear === -1
      ? 'R'
      : hud.gear === 0
      ? 'N'
      : hud.vehicle === 'vision110'
      ? 'CVT'
      : hud.vehicle === 'sedan'
      ? `D${hud.gear}`
      : `SỐ ${hud.gear}`;

  const headlightLabel = hud.headlight === 0 ? 'Tắt' : hud.headlight === 1 ? 'Cốt' : 'Pha';
  const blinkPhase = Math.floor(hud.elapsedSec * 3.2) % 2 === 0;
  const mapSize = hud.minimapExpanded ? 248 : 158;
  const laneDanger = hud.laneNote.startsWith('Cảnh báo');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 15,
        pointerEvents: 'none',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {/* Top-Left: Authentic QCVN Street Plate + Endless/GPLX Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 332 }}>
          {/* Authentic QCVN Cobalt Street Sign */}
          <div className="vn-street-sign" style={{ padding: '7px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.01em', lineHeight: 1.2 }}>
              {hud.currentRoadName}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: laneDanger ? '#fde047' : '#dbeafe',
                marginTop: 2,
              }}
            >
              {hud.laneNote}
            </div>
          </div>

          {/* Mode Telemetry: Free Drive Endless Plate OR 12-Point GPLX Bar */}
          {isFree ? (
            <div
              className="saigon-panel"
              style={{
                padding: '7px 11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                boxShadow: '4px 4px 0 #141820',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #141820',
                    flexShrink: 0,
                  }}
                >
                  <InfinityIcon size={14} color="#ffffff" />
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.04em', lineHeight: 1.15 }}>
                    LÁI TỰ DO · VÔ TẬN
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#525d6e', marginTop: 1 }}>
                    Không giới hạn · Tự do luyện tập
                  </div>
                </div>
              </div>
              <div className="tabular" style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#141820' }}>{hud.distanceKm.toFixed(2)} km</div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: hud.violations.length > 0 ? '#d92d20' : '#15803d',
                  }}
                >
                  {hud.violations.length} lỗi ghi nhận
                </div>
              </div>
            </div>
          ) : (
            <div
              className="saigon-panel"
              style={{
                padding: '8px 11px',
                boxShadow: '4px 4px 0 #141820',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 900, letterSpacing: '0.05em' }}>
                  <ShieldIcon size={13} color={hud.gplxPoints <= 4 ? '#d92d20' : '#0c4da2'} />
                  ĐIỂM GPLX
                </span>
                <span
                  className="tabular"
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: hud.gplxPoints <= 4 ? '#d92d20' : hud.gplxPoints <= 8 ? '#a16207' : '#15803d',
                  }}
                >
                  {hud.gplxPoints}/{hud.maxGplxPoints}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2.5, marginTop: 6 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 7,
                      backgroundColor:
                        i < hud.gplxPoints
                          ? hud.gplxPoints <= 4
                            ? '#d92d20'
                            : hud.gplxPoints <= 8
                            ? '#eab308'
                            : '#15803d'
                          : '#d6cebe',
                      border: '1px solid #141820',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Scenario Objective Card */}
          {hud.scenarioTitle && (
            <div
              className="saigon-panel-dark"
              style={{
                padding: '9px 11px',
                borderColor: '#eab308',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 900, color: '#eab308', letterSpacing: '0.04em' }}>
                  <TargetIcon size={13} color="#eab308" />
                  MỤC TIÊU BÀI TẬP
                </span>
                <span className="tabular" style={{ fontSize: 11, fontWeight: 900, color: '#ffffff' }}>
                  {hud.scenarioDistanceM} m
                </span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#f4efe4', marginTop: 4 }}>
                {hud.scenarioStepText}
              </div>
              <div style={{ fontSize: 11, color: '#b7c0ce', marginTop: 3, lineHeight: 1.35 }}>
                {hud.scenarioHint}
              </div>
            </div>
          )}
        </div>

        {/* Top-Center: Overhead Signal Visor & Violation / Hazard Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: 420 }}>
          {hud.nearSignalState !== 'none' && (
            <div
              style={{
                backgroundColor: '#141820',
                color: '#f4efe4',
                border: '2px solid #f4efe4',
                boxShadow: '4px 4px 0 #141820',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
              }}
            >
              {/* 3-Lens Traffic Signal Strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: hud.nearSignalState === 'red' ? '#ef4444' : '#332325',
                    border: '1.5px solid #090b0f',
                  }}
                />
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor:
                      hud.nearSignalState === 'yellow' || hud.nearSignalState === 'flashing' ? '#eab308' : '#332f1e',
                    border: '1.5px solid #090b0f',
                  }}
                />
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: hud.nearSignalState === 'green' ? '#22c55e' : '#1b3324',
                    border: '1.5px solid #090b0f',
                  }}
                />
              </div>
              <span
                className="tabular"
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color:
                    hud.nearSignalState === 'red'
                      ? '#f87171'
                      : hud.nearSignalState === 'green'
                      ? '#4ade80'
                      : '#fde047',
                }}
              >
                {hud.nearSignalState === 'flashing' ? 'NHÁY' : `${String(hud.nearSignalCountdown).padStart(2, '0')}s`}
              </span>
              {hud.nearSignalState === 'red' && hud.nearRightOnRedAllowed && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 900,
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    padding: '3px 7px',
                    letterSpacing: '0.03em',
                  }}
                >
                  RẼ PHẢI ĐƯỢC PHÉP
                </span>
              )}
            </div>
          )}

          {hud.ambulanceNearby && (
            <div
              style={{
                backgroundColor: '#d92d20',
                color: '#ffffff',
                border: '2px solid #141820',
                boxShadow: '4px 4px 0 #141820',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <AlertIcon size={15} color="#fde047" />
              XE CỨU THƯƠNG ĐANG ĐẾN — GIẢM TỐC & TẤP SÁT LỀ PHẢI
            </div>
          )}

          {hud.trainComing && (
            <div
              style={{
                backgroundColor: '#eab308',
                color: '#141820',
                border: '2px solid #141820',
                boxShadow: '4px 4px 0 #141820',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <AlertIcon size={15} color="#d92d20" />
              CHUÔNG TÀU HỎA — DỪNG TRƯỚC BARIE CÁCH TỐI THIỂU 5M
            </div>
          )}

          {hud.latestViolation && (
            <div
              className="saigon-panel"
              style={{
                width: '100%',
                borderColor: '#141820',
                boxShadow: '5px 5px 0 #141820',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  backgroundColor: '#d92d20',
                  color: '#ffffff',
                  padding: '5px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 900 }}>
                  <AlertIcon size={14} color="#ffffff" />
                  {hud.latestViolation.title}
                </span>
                <span className="tabular" style={{ fontSize: 11, fontWeight: 900, color: '#fde047', whiteSpace: 'nowrap' }}>
                  {isFree ? 'NHẮC LỖI' : `−${hud.latestViolation.points} ĐIỂM`}
                </span>
              </div>
              <div style={{ padding: '7px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#141820' }}>{hud.latestViolation.detail}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0c4da2', marginTop: 3 }}>
                  Mẹo: {hud.latestViolation.tip}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Crisp Saigon Utility Dock */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              type="button"
              onClick={onCycleCamera}
              title="Đổi góc nhìn (C / V)"
              style={{
                padding: '7px 11px',
                backgroundColor: '#f4efe4',
                color: '#141820',
                border: '2px solid #141820',
                boxShadow: '3px 3px 0 #141820',
                fontSize: 11.5,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <CameraIcon size={14} color="#0c4da2" />
              {CAMERA_LABELS[hud.cameraMode]}
              <span style={{ fontSize: 10, fontWeight: 900, backgroundColor: '#141820', color: '#eab308', padding: '1px 5px' }}>C</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title="Bật/tắt âm thanh"
              aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              style={{
                padding: '7px 9px',
                backgroundColor: muted ? '#d92d20' : '#f4efe4',
                color: muted ? '#ffffff' : '#141820',
                border: '2px solid #141820',
                boxShadow: '3px 3px 0 #141820',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {muted ? <VolumeOffIcon size={15} color="#ffffff" /> : <VolumeOnIcon size={15} color="#141820" />}
            </button>
            <button
              type="button"
              onClick={onShowControls}
              title="Hướng dẫn phím"
              aria-label="Hướng dẫn phím"
              style={{
                padding: '7px 9px',
                backgroundColor: '#f4efe4',
                color: '#141820',
                border: '2px solid #141820',
                boxShadow: '3px 3px 0 #141820',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <KeyboardIcon size={15} color="#141820" />
            </button>
            <button
              type="button"
              onClick={onPause}
              title="Tạm dừng (P / Esc)"
              style={{
                padding: '7px 11px',
                backgroundColor: '#141820',
                color: '#eab308',
                border: '2px solid #141820',
                boxShadow: '3px 3px 0 #d92d20',
                fontSize: 11.5,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              <PauseIcon size={13} color="#eab308" />
              Dừng
            </button>
          </div>

          {showFps && (
            <div
              className="tabular"
              style={{
                backgroundColor: '#141820',
                color: '#f4efe4',
                border: '2px solid #f4efe4',
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: hud.fps >= 50 ? '#4ade80' : hud.fps >= 30 ? '#eab308' : '#f87171' }}>
                {hud.fps} FPS
              </span>
              <span style={{ color: '#9aa6b4' }}>{hud.drawCalls} DC</span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
        {/* Bottom-Left: Bespoke Saigon Cockpit Speedometer & 18-Bar Stepped Digital Tachometer */}
        <div className="chamfer-shell">
          <div
            className="chamfer-box"
            style={{
              backgroundColor: '#141820',
              color: '#f4efe4',
              border: '2px solid #f4efe4',
              padding: '11px 14px 10px',
              minWidth: 274,
            }}
          >
            {/* Upper Instrument Row: Giant Speed + Gear + Circular QCVN Limit Sign */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  className="tabular"
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    lineHeight: 0.92,
                    letterSpacing: '-0.03em',
                    color: speeding ? '#f87171' : '#f4efe4',
                  }}
                >
                  {String(hud.speedKmh).padStart(2, '0')}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#9aa6b4', letterSpacing: '0.06em' }}>KM/H</span>
                  <span
                    className="tabular"
                    style={{
                      backgroundColor: '#eab308',
                      color: '#141820',
                      padding: '1px 6px',
                      fontSize: 11,
                      fontWeight: 900,
                      textAlign: 'center',
                    }}
                  >
                    {gearLabel}
                  </span>
                </div>
              </div>

              {/* Authentic QCVN P.127 Speed Limit Sign */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span
                  className="qcvn-speed-sign"
                  style={{
                    width: 44,
                    height: 44,
                    borderWidth: 5,
                    fontSize: 16,
                    backgroundColor: speeding ? '#fef2f2' : '#ffffff',
                  }}
                >
                  {hud.speedLimitKmh}
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, color: speeding ? '#f87171' : '#9aa6b4', letterSpacing: '0.06em' }}>
                  {speeding ? 'QUÁ TỐC!' : 'TỐI ĐA'}
                </span>
              </div>
            </div>

            {/* Signature 18-Bar Stepped Ascending Digital Tachometer */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${RPM_BAR_COUNT}, 1fr)`,
                gap: 3,
                alignItems: 'end',
                height: 20,
                marginTop: 9,
              }}
            >
              {Array.from({ length: RPM_BAR_COUNT }).map((_, idx) => {
                const lit = idx < activeBars;
                const heightPx = 6 + Math.round((idx / (RPM_BAR_COUNT - 1)) * 14);
                const litColor = idx >= 14 ? '#ef4444' : idx >= 10 ? '#eab308' : '#22c55e';
                return (
                  <div
                    key={idx}
                    style={{
                      height: heightPx,
                      backgroundColor: lit ? litColor : '#252e3c',
                    }}
                  />
                );
              })}
            </div>

            {/* Bottom Automotive Telltale Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                marginTop: 9,
                paddingTop: 7,
                borderTop: '1px solid #2b3545',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    padding: '2px 5px',
                    backgroundColor: hud.signalLeft && blinkPhase ? '#eab308' : '#232c3a',
                    color: hud.signalLeft && blinkPhase ? '#141820' : '#7b8798',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <ArrowLeftIcon size={11} color={hud.signalLeft && blinkPhase ? '#141820' : '#7b8798'} />
                  Q
                </span>
                <span
                  style={{
                    padding: '2px 5px',
                    backgroundColor: hud.hazard && blinkPhase ? '#d92d20' : '#232c3a',
                    color: hud.hazard && blinkPhase ? '#ffffff' : '#7b8798',
                  }}
                >
                  H
                </span>
                <span
                  style={{
                    padding: '2px 5px',
                    backgroundColor: hud.signalRight && blinkPhase ? '#eab308' : '#232c3a',
                    color: hud.signalRight && blinkPhase ? '#141820' : '#7b8798',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  R
                  <ArrowRightIcon size={11} color={hud.signalRight && blinkPhase ? '#141820' : '#7b8798'} />
                </span>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: hud.headlight === 2 ? '#60a5fa' : hud.headlight === 1 ? '#fde047' : '#8d99a8',
                }}
              >
                <HeadlightIcon size={13} color={hud.headlight === 2 ? '#60a5fa' : hud.headlight === 1 ? '#fde047' : '#8d99a8'} />
                {headlightLabel}
              </span>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  color: hud.hornActive ? '#eab308' : '#8d99a8',
                }}
              >
                <HornIcon size={13} color={hud.hornActive ? '#eab308' : '#8d99a8'} />
                E/F
              </span>

              <span className="tabular" style={{ color: '#cbd5e1', fontSize: 10.5 }}>
                {hud.distanceKm.toFixed(2)} km
              </span>
            </div>
          </div>
        </div>

        {/* Bottom-Right: Compass-Bezel Saigon Minimap */}
        <div
          className="saigon-panel"
          style={{
            pointerEvents: 'auto',
            padding: 0,
            overflow: 'hidden',
            boxShadow: '5px 5px 0 #141820',
          }}
        >
          <div
            style={{
              backgroundColor: '#141820',
              color: '#f4efe4',
              padding: '5px 9px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 900, letterSpacing: '0.06em' }}>
              <MapGridIcon size={12} color="#eab308" />
              BẢN ĐỒ
            </span>
            <button
              type="button"
              onClick={onToggleMinimap}
              style={{
                padding: '2px 7px',
                backgroundColor: '#eab308',
                color: '#141820',
                fontSize: 10,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              {hud.minimapExpanded ? 'Thu [M]' : 'Mở [M]'}
            </button>
          </div>
          <div style={{ position: 'relative', padding: 5, backgroundColor: '#141820' }}>
            <canvas
              ref={minimapRef}
              width={mapSize}
              height={mapSize}
              style={{ width: mapSize, height: mapSize, display: 'block', border: '1.5px solid #3c4657' }}
            />
            <span
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#141820',
                color: '#eab308',
                fontSize: 9,
                fontWeight: 900,
                padding: '0 4px',
                pointerEvents: 'none',
              }}
            >
              B
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
