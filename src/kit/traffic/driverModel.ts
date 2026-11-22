/**
 * Mô hình lái xe cho xe NPC — đủ thật để người mới tập lái gặp đúng các tình huống ngoài đời.
 *
 * 1. IDM (Intelligent Driver Model, Treiber 2000) cho tăng/giảm tốc dọc theo làn.
 * 2. Quyết định gặp đèn vàng (vùng lưỡng lự / dilemma zone).
 * 3. Chấp nhận khoảng trống (gap acceptance) khi rẽ trái cắt hướng, nhập làn, đi qua ngã ba/ngã tư không đèn.
 * 4. Xe máy KHÔNG đi theo làn cứng: có "vị trí ngang" (lateral offset) trôi tự do trong phần đường,
 *    luồn lách vào khe trống — đặc trưng giao thông VN (xem pickLateralOffset).
 * 5. Tính cách tài xế (profile) → tạo ra hành vi đa dạng, thỉnh thoảng vi phạm như ngoài đời.
 */

export interface IDMParams {
  v0: number;    // vận tốc mong muốn (m/s)
  T: number;     // khoảng thời gian an toàn (s)
  s0: number;    // khoảng cách tối thiểu khi dừng (m)
  a: number;     // gia tốc tối đa (m/s²)
  b: number;     // giảm tốc thoải mái (m/s²)
  delta: number; // số mũ (thường 4)
  length: number;// chiều dài xe (m)
  width: number; // chiều rộng xe (m)
}

const kmh = (x: number) => x / 3.6;

export const VEHICLE_PRESETS: Record<'motorbike' | 'scooter' | 'car' | 'taxi' | 'bus' | 'truck' | 'bicycle', IDMParams> = {
  motorbike: { v0: kmh(40), T: 0.8, s0: 0.8, a: 2.2, b: 3.0, delta: 4, length: 1.9, width: 0.7 },
  scooter:   { v0: kmh(38), T: 0.9, s0: 0.8, a: 2.0, b: 3.0, delta: 4, length: 1.85, width: 0.7 },
  car:       { v0: kmh(45), T: 1.4, s0: 2.0, a: 1.6, b: 2.5, delta: 4, length: 4.5, width: 1.8 },
  taxi:      { v0: kmh(48), T: 1.2, s0: 1.8, a: 1.8, b: 2.8, delta: 4, length: 4.4, width: 1.75 },
  bus:       { v0: kmh(38), T: 1.8, s0: 3.0, a: 0.9, b: 1.8, delta: 4, length: 11, width: 2.5 },
  truck:     { v0: kmh(40), T: 1.9, s0: 3.0, a: 0.8, b: 1.8, delta: 4, length: 8, width: 2.4 },
  bicycle:   { v0: kmh(13), T: 1.0, s0: 0.6, a: 0.8, b: 2.0, delta: 4, length: 1.7, width: 0.6 },
};

/** Gia tốc IDM. gap = khoảng cách tới đuôi xe trước (m), dv = v - vTrước. gap = Infinity nếu đường trống. */
export function idmAccel(v: number, gap: number, dv: number, p: IDMParams, vLimit = Infinity): number {
  const v0 = Math.min(p.v0, vLimit);
  const free = 1 - Math.pow(Math.max(v, 0) / Math.max(v0, 0.1), p.delta);
  if (!isFinite(gap)) return p.a * free;
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  return p.a * (free - Math.pow(sStar / Math.max(gap, 0.1), 2));
}

/** Coi vạch dừng như một "xe đứng yên" để IDM tự phanh đúng chỗ. */
export function idmStopAt(v: number, distToStopLine: number, p: IDMParams) {
  return idmAccel(v, Math.max(distToStopLine, 0.05), v, p);
}

/**
 * Đèn vàng: đi tiếp hay dừng? Nếu không thể dừng với mức phanh hợp lý trước vạch → đi tiếp.
 * aggression 0..1: tài xế liều sẽ chấp nhận phanh ít hơn và cố vượt cả khi đáng lẽ dừng được.
 */
export function yellowDecision(v: number, distToStopLine: number, yellowLeft: number, p: IDMParams, aggression = 0.2): 'stop' | 'go' {
  const needDecel = (v * v) / (2 * Math.max(distToStopLine, 0.1));
  const canClear = v * yellowLeft >= distToStopLine + p.length;
  if (needDecel > p.b * 1.6) return 'go';
  if (aggression > 0.7 && canClear) return 'go';
  if (aggression > 0.5 && needDecel > p.b * (1.2 - aggression * 0.5)) return 'go';
  return 'stop';
}

/**
 * Chấp nhận khoảng trống: rẽ trái qua dòng xe ngược chiều / nhập vào đường chính.
 * tGapNeeded thường ~4.5 s (ô tô) — xe máy VN chấp nhận khe ngắn hơn nhiều (~2–2.5 s).
 */
export function acceptGap(timeToArrivalOfConflict: number, kind: keyof typeof VEHICLE_PRESETS, aggression = 0.2) {
  const base = kind === 'motorbike' || kind === 'scooter' || kind === 'bicycle' ? 2.6 : kind === 'bus' || kind === 'truck' ? 5.5 : 4.5;
  return timeToArrivalOfConflict > base * (1 - 0.45 * aggression);
}

/**
 * Xe máy chọn vị trí ngang trong phần đường (từ mép phải, đơn vị m).
 * neighbors: các xe phía trước gần (≤ 12 m) với vị trí ngang & bề rộng của chúng.
 * Thuật toán: chia phần đường thành các "khe", chấm điểm khe theo (rộng, gần vị trí hiện tại, ưu tiên bên phải).
 */
export function pickLateralOffset(current: number, roadWidth: number, myWidth: number, neighbors: { offset: number; width: number; dist: number }[], keepRight = 0.6) {
  const margin = 0.35;
  const occupied = neighbors.filter(n => n.dist < 12).map(n => [n.offset - n.width / 2 - margin, n.offset + n.width / 2 + margin] as [number, number]).sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = []; let cursor = 0.4;
  for (const [s, e] of occupied) { if (s - cursor > myWidth) gaps.push([cursor, s]); cursor = Math.max(cursor, e); }
  if (roadWidth - 0.3 - cursor > myWidth) gaps.push([cursor, roadWidth - 0.3]);
  if (!gaps.length) return current; // kẹt → giữ nguyên, IDM sẽ phanh
  let best = current, bestScore = -Infinity;
  for (const [s, e] of gaps) {
    const center = Math.min(Math.max(current, s + myWidth / 2), e - myWidth / 2);
    const score = (e - s) * 0.5 - Math.abs(center - current) * 1.2 - center * keepRight * 0.15;
    if (score > bestScore) { bestScore = score; best = center; }
  }
  return best;
}

/** Tính cách tài xế NPC. Trộn ngẫu nhiên theo trọng số để phố "sống" như thật. */
export interface DriverProfile {
  name: string; weight: number;
  aggression: number;      // 0..1 — vượt đèn vàng, chen, bóp còi nhiều
  speedFactor: number;     // nhân với v0
  hornRate: number;        // số lần bấm còi / phút khi bị cản
  signalUse: number;       // xác suất bật xi-nhan trước khi rẽ (ngoài đời thấp!)
  violations: Partial<Record<'redLightRun' | 'wrongWaySidewalk' | 'suddenUTurn' | 'cutIn' | 'stopSuddenly' | 'noHelmet' | 'phoneWhileRiding', number>>;
}

export const DRIVER_PROFILES: DriverProfile[] = [
  { name: 'Người lái chuẩn mực', weight: 45, aggression: 0.1, speedFactor: 0.95, hornRate: 0.5, signalUse: 0.9, violations: {} },
  { name: 'Đi làm vội giờ cao điểm', weight: 25, aggression: 0.55, speedFactor: 1.1, hornRate: 4, signalUse: 0.5, violations: { cutIn: 0.15, redLightRun: 0.03 } },
  { name: 'Shipper / xe ôm công nghệ', weight: 12, aggression: 0.65, speedFactor: 1.05, hornRate: 3, signalUse: 0.4, violations: { stopSuddenly: 0.12, suddenUTurn: 0.05, phoneWhileRiding: 0.2, cutIn: 0.2 } },
  { name: 'Người lớn tuổi đi chậm', weight: 8, aggression: 0.05, speedFactor: 0.65, hornRate: 0.1, signalUse: 0.6, violations: { suddenUTurn: 0.03 } },
  { name: 'Thanh niên liều', weight: 5, aggression: 0.95, speedFactor: 1.3, hornRate: 6, signalUse: 0.15, violations: { redLightRun: 0.15, cutIn: 0.35, wrongWaySidewalk: 0.05, noHelmet: 0.2 } },
  { name: 'Người bán hàng rong / chở hàng cồng kềnh', weight: 5, aggression: 0.2, speedFactor: 0.6, hornRate: 0.3, signalUse: 0.2, violations: { wrongWaySidewalk: 0.2, stopSuddenly: 0.2 } },
];

export function pickProfile(rand = Math.random): DriverProfile {
  const total = DRIVER_PROFILES.reduce((s, p) => s + p.weight, 0);
  let r = rand() * total;
  for (const p of DRIVER_PROFILES) { if ((r -= p.weight) <= 0) return p; }
  return DRIVER_PROFILES[0];
}

/** Tỉ lệ loại phương tiện trong phố VN (gần đúng thực tế đô thị: ~80% xe hai bánh). */
export const VEHICLE_MIX: [keyof typeof VEHICLE_PRESETS, number][] = [
  ['motorbike', 46], ['scooter', 30], ['car', 11], ['taxi', 4], ['bus', 2], ['truck', 3], ['bicycle', 4],
];
