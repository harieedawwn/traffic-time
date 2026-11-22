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
  // Xe số 110 cc kiểu Honda Wave — 4 số, ly hợp tự động, lái đầm & dễ giữ thẳng làn
  wave110: { kind: 'motorbike', mass: 97 + 65, wheelBase: 1.28, maxSteer: 0.44, steerAtSpeed: 0.11, enginePower: 5800, maxForce: 820, brakeForce: 1700, drag: 0.34, rolling: 19, gearRatios: [3.3, 2.0, 1.45, 1.15], idleRpm: 1400, redlineRpm: 9000, wheelRadius: 0.29, topSpeed: 26 },
  // Xe tay ga kiểu Honda Vision — CVT êm ái, ổn định trong phố đông
  vision110: { kind: 'motorbike', mass: 99 + 65, wheelBase: 1.28, maxSteer: 0.43, steerAtSpeed: 0.11, enginePower: 6000, maxForce: 780, brakeForce: 1750, drag: 0.35, rolling: 19, gearRatios: [], idleRpm: 1600, redlineRpm: 8500, wheelRadius: 0.27, topSpeed: 25 },
  // Sedan hạng B (Vios/Accent) — số tự động 4 cấp, tay lái bên trái, vô-lăng đầm chắc
  sedan: { kind: 'car', mass: 1150, wheelBase: 2.58, maxSteer: 0.48, steerAtSpeed: 0.16, enginePower: 76000, maxForce: 4900, brakeForce: 12000, drag: 0.43, rolling: 145, gearRatios: [3.6, 2.1, 1.4, 1.0], idleRpm: 750, redlineRpm: 6200, wheelRadius: 0.31, topSpeed: 48 },
};

export function createState(x = 0, z = 0, heading = 0): VehicleState {
  return { x, z, heading, speed: 0, steerAngle: 0, yawRate: 0, lean: 0, pitch: 0, rpm: 800, gear: 1, wheelSpin: 0, braking: false };
}

const G = 9.81;

/** Góc nghiêng tối đa của xe máy phổ thông (~12.6°) — tự nhiên, không bao giờ nghiêng quá đà. */
export const MAX_BIKE_LEAN_RAD = 0.22;

export function stepVehicle(s: VehicleState, spec: VehicleSpec, input: DriveInput, dt: number, speedLimitMs = Infinity) {
  const v = s.speed;
  const absV = Math.abs(v);

  // --- Lái: giảm mượt theo tốc độ + hồi thẳng nhanh khi nhả phím A/D
  const speedFrac = Math.min(absV / 15.5, 1);
  const easeSpeed = Math.pow(speedFrac, 0.72);
  const maxSteer = spec.maxSteer * (1 - easeSpeed) + spec.steerAtSpeed * easeSpeed;
  const targetSteer = input.steer * maxSteer;
  const returningToCenter =
    Math.abs(targetSteer) < Math.abs(s.steerAngle) || targetSteer * s.steerAngle < 0;
  const steerRate = returningToCenter ? 11.5 : spec.kind === 'car' ? 5.2 : 6.0;
  s.steerAngle += (targetSteer - s.steerAngle) * Math.min(1, dt * steerRate);

  // --- Lực dọc (khởi hành mượt hơn ở tốc độ thấp để dễ căn trong phố)
  let force = 0;
  const wantsReverse = input.reverse && absV < 0.5 && input.throttle < 0.1;
  if (input.reverse && v > 0.5) force -= spec.brakeForce * 0.52; // S khi đang chạy = phanh nhẹ
  if (input.throttle > 0 && v >= -0.2) {
    const launchEase = absV < 3.5 ? 0.82 + 0.18 * (absV / 3.5) : 1.0;
    const pLimited = spec.enginePower / Math.max(absV, 2.6);
    force += input.throttle * launchEase * Math.min(spec.maxForce, pLimited);
  }
  if (wantsReverse || (input.reverse && v <= 0)) force -= spec.maxForce * 0.35 * (spec.kind === 'car' ? 1 : 0.25); // xe máy: dắt lùi chậm
  const braking = input.brake > 0.05;
  if (braking) force -= Math.sign(v || 1) * input.brake * spec.brakeForce;
  force -= Math.sign(v) * (spec.rolling + spec.drag * v * v);

  let acc = force / spec.mass;
  if (braking && Math.abs(v) < Math.abs(acc * dt)) { acc = 0; s.speed = 0; }
  s.speed += acc * dt;
  s.speed = Math.max(-4, Math.min(s.speed, Math.min(spec.topSpeed, speedLimitMs)));
  if (!braking && input.throttle === 0 && !input.reverse && Math.abs(s.speed) < 0.06) s.speed = 0;
  s.braking = braking;

  // --- Quay đầu: mô hình xe đạp có giới hạn tốc độ xoay để cua êm & dễ kiểm soát
  const rawYaw = (s.speed / spec.wheelBase) * Math.tan(s.steerAngle);
  const maxYaw = spec.kind === 'car' ? 1.45 : 1.75;
  s.yawRate = Math.max(-maxYaw, Math.min(maxYaw, rawYaw));
  s.heading -= s.yawRate * dt; // steer dương = rẽ phải = heading giảm (theo quy ước right = (-cos,0,sin))
  s.x += Math.sin(s.heading) * s.speed * dt;
  s.z += Math.cos(s.heading) * s.speed * dt;

  // --- Nghiêng (xe máy): nghiêng nhẹ tự nhiên (tối đa ~12.6°), đứng thẳng khi đi chậm, tự hồi thẳng rất nhanh
  const speedFade = Math.max(0, Math.min(1, (absV - 1.0) / 3.6));
  if (spec.kind === 'motorbike') {
    const rawLean = Math.atan((s.speed * s.yawRate) / (G * 2.65)) * speedFade;
    const clampedLean = Math.max(-MAX_BIKE_LEAN_RAD, Math.min(MAX_BIKE_LEAN_RAD, rawLean));
    const uprighting = Math.abs(clampedLean) < Math.abs(s.lean);
    const leanRate = uprighting ? 11.0 : 5.5;
    s.lean += (clampedLean - s.lean) * Math.min(1, dt * leanRate);
  } else {
    const rawRoll = -Math.atan((s.speed * s.yawRate) / (G * 2.6)) * 0.05 * speedFade;
    const clampedRoll = Math.max(-0.032, Math.min(0.032, rawRoll));
    s.lean += (clampedRoll - s.lean) * Math.min(1, dt * 7.5);
  }
  s.pitch += ((braking ? 0.02 * input.brake : 0) - (input.throttle * 0.008) - s.pitch) * Math.min(1, dt * 6);

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
