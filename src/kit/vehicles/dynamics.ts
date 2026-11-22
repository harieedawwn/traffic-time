import type { DriveInput } from '../input/controls';

/**
 * Động lực học xe người chơi — "bicycle model" bán-thực tế, ổn định, dễ chỉnh.
 * Quy ước: Y hướng lên, heading = góc quay quanh Y, hướng tiến = (sin h, 0, cos h). Đơn vị mét, giây.
 * Lái xe bên PHẢI đường (VN). Vector bên phải của xe = (-cos h, 0, sin h).
 *
 * Không phụ thuộc engine vật lý: va chạm do lớp game xử lý (AABB/OBB hoặc Rapier).
 */
export interface VehicleState {
  x: number; z: number; heading: number;
  speed: number;        // m/s, âm = lùi
  steerAngle: number;   // rad, góc bánh trước
  yawRate: number;
  lean: number;         // rad, nghiêng (chỉ xe máy) — dương = nghiêng phải
  pitch: number;        // rad, chúi đầu khi phanh / ngóc khi ga (hiệu ứng)
  rpm: number;
  gear: number;         // 0 = N, -1 = R, 1..n
  wheelSpin: number;    // rad tích luỹ để quay bánh xe
  braking: boolean;
}

export interface VehicleSpec {
  kind: 'motorbike' | 'car';
  mass: number; wheelBase: number;
  maxSteer: number;            // rad ở tốc độ thấp
  steerAtSpeed: number;        // rad ở 60 km/h (xe máy chủ yếu rẽ bằng nghiêng)
  enginePower: number;         // W (gần đúng)
  maxForce: number;            // N lực kéo tối đa ở bánh
  brakeForce: number;          // N
  drag: number; rolling: number;
  gearRatios: number[];        // số tiến, rpm = speed * ratio * k
  idleRpm: number; redlineRpm: number;
  wheelRadius: number;
  topSpeed: number;            // m/s
}

export const SPECS: Record<'wave110' | 'vision110' | 'sedan', VehicleSpec> = {
  // Xe số 110 cc kiểu Honda Wave — 4 số, ly hợp tự động (sang số tự động trong game)
  wave110: { kind: 'motorbike', mass: 97 + 65, wheelBase: 1.23, maxSteer: 0.6, steerAtSpeed: 0.08, enginePower: 6000, maxForce: 900, brakeForce: 1500, drag: 0.32, rolling: 18, gearRatios: [3.3, 2.0, 1.45, 1.15], idleRpm: 1400, redlineRpm: 9000, wheelRadius: 0.29, topSpeed: 27 },
  // Xe tay ga kiểu Honda Vision — CVT, rpm tăng mượt
  vision110: { kind: 'motorbike', mass: 99 + 65, wheelBase: 1.26, maxSteer: 0.6, steerAtSpeed: 0.08, enginePower: 6300, maxForce: 850, brakeForce: 1550, drag: 0.33, rolling: 18, gearRatios: [], idleRpm: 1600, redlineRpm: 8500, wheelRadius: 0.27, topSpeed: 26 },
  // Sedan hạng B (Vios/Accent) — số tự động 4 cấp, tay lái bên trái
  sedan: { kind: 'car', mass: 1150, wheelBase: 2.55, maxSteer: 0.6, steerAtSpeed: 0.22, enginePower: 78000, maxForce: 5200, brakeForce: 11000, drag: 0.42, rolling: 140, gearRatios: [3.6, 2.1, 1.4, 1.0], idleRpm: 750, redlineRpm: 6200, wheelRadius: 0.31, topSpeed: 50 },
};

export function createState(x = 0, z = 0, heading = 0): VehicleState {
  return { x, z, heading, speed: 0, steerAngle: 0, yawRate: 0, lean: 0, pitch: 0, rpm: 800, gear: 1, wheelSpin: 0, braking: false };
}

const G = 9.81;

export function stepVehicle(s: VehicleState, spec: VehicleSpec, input: DriveInput, dt: number, speedLimitMs = Infinity) {
  const v = s.speed;
  const absV = Math.abs(v);

  // --- Lái: góc tối đa giảm dần theo tốc độ (giống người thật đánh lái nhẹ khi chạy nhanh)
  const t = Math.min(absV / 16.7, 1);
  const maxSteer = spec.maxSteer * (1 - t) + spec.steerAtSpeed * t;
  s.steerAngle += (input.steer * maxSteer - s.steerAngle) * Math.min(1, dt * (spec.kind === 'car' ? 6 : 8));

  // --- Lực dọc
  let force = 0;
  const wantsReverse = input.reverse && absV < 0.5 && input.throttle < 0.1;
  if (input.reverse && v > 0.5) force -= spec.brakeForce * 0.5; // S khi đang chạy = phanh nhẹ
  if (input.throttle > 0 && v >= -0.2) {
    const pLimited = spec.enginePower / Math.max(absV, 2.5);
    force += input.throttle * Math.min(spec.maxForce, pLimited);
  }
  if (wantsReverse || (input.reverse && v <= 0)) force -= spec.maxForce * 0.35 * (spec.kind === 'car' ? 1 : 0.25); // xe máy: dắt lùi chậm
  const braking = input.brake > 0.05;
  if (braking) force -= Math.sign(v || 1) * input.brake * spec.brakeForce;
  force -= Math.sign(v) * (spec.rolling + spec.drag * v * v);

  let acc = force / spec.mass;
  if (braking && Math.abs(v) < Math.abs(acc * dt)) { acc = 0; s.speed = 0; }
  s.speed += acc * dt;
  s.speed = Math.max(-4, Math.min(s.speed, Math.min(spec.topSpeed, speedLimitMs)));
  if (!braking && input.throttle === 0 && !input.reverse && Math.abs(s.speed) < 0.05) s.speed = 0;
  s.braking = braking;

  // --- Quay đầu: mô hình xe đạp
  s.yawRate = (s.speed / spec.wheelBase) * Math.tan(s.steerAngle);
  s.heading -= s.yawRate * dt; // steer dương = rẽ phải = heading giảm (theo quy ước right = (-cos,0,sin))
  s.x += Math.sin(s.heading) * s.speed * dt;
  s.z += Math.cos(s.heading) * s.speed * dt;

  // --- Nghiêng (xe máy) = atan(v·ω / g), làm mượt; ô tô thì nghiêng thân nhẹ ngược chiều (body roll)
  const targetLean = Math.atan((s.speed * s.yawRate) / G);
  if (spec.kind === 'motorbike') s.lean += (Math.max(-0.75, Math.min(0.75, targetLean)) - s.lean) * Math.min(1, dt * 5);
  else s.lean += (-targetLean * 0.08 - s.lean) * Math.min(1, dt * 4);
  s.pitch += ((braking ? 0.025 * input.brake : 0) - (input.throttle * 0.01) - s.pitch) * Math.min(1, dt * 6);

  // --- Vòng tua & số
  s.wheelSpin += (s.speed / spec.wheelRadius) * dt;
  const wheelRpm = (Math.abs(s.speed) / spec.wheelRadius) * 60 / (2 * Math.PI);
  if (spec.gearRatios.length) {
    if (s.speed < -0.1) s.gear = -1;
    else {
      if (s.gear < 1) s.gear = 1;
      const rpmIn = (g: number) => wheelRpm * spec.gearRatios[g - 1] * (spec.kind === 'car' ? 3.9 : 9.5);
      if (rpmIn(s.gear) > spec.redlineRpm * 0.78 && s.gear < spec.gearRatios.length) s.gear++;
      if (s.gear > 1 && rpmIn(s.gear - 1) < spec.redlineRpm * 0.5) s.gear--;
    }
    const target = Math.max(spec.idleRpm + input.throttle * 900 * (absV < 1 ? 1 : 0), wheelRpm * spec.gearRatios[Math.max(1, s.gear) - 1] * (spec.kind === 'car' ? 3.9 : 9.5));
    s.rpm += (Math.min(target, spec.redlineRpm) - s.rpm) * Math.min(1, dt * 8);
  } else { // CVT: vòng tua bám theo ga, tăng nhẹ theo tốc độ
    const target = spec.idleRpm + input.throttle * (spec.redlineRpm * 0.55) + absV / spec.topSpeed * spec.redlineRpm * 0.35;
    s.rpm += (Math.min(target, spec.redlineRpm) - s.rpm) * Math.min(1, dt * 4);
    s.gear = s.speed < -0.1 ? -1 : 1;
  }
  return s;
}

export const toKmh = (ms: number) => ms * 3.6;
