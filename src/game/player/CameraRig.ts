import * as THREE from 'three';
import type { VehicleState } from '../../kit/vehicles/dynamics';
import type { CameraMode, GamePhase, VehicleId } from '../types';

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _localPos = new THREE.Vector3();
const _localLook = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * 4-Mode Camera Rig (3 TPS + 1 detailed FPV) + Live Title Flyover.
 * Exponential damping, speed-sensitive FOV, motorbike banking, road vibration,
 * Z/X or right-mouse head-turn for blind-spot checking, and collision trauma shake.
 */
export class CameraRig {
  mode: CameraMode = 0;
  lookOffsetRad = 0; // + = look left, - = look right
  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private trauma = 0;
  private initialized = false;
  private titleAngle = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  addTrauma(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  reset() {
    this.initialized = false;
    this.lookOffsetRad = 0;
    this.trauma = 0;
  }

  cycle(delta: 1 | -1): CameraMode {
    this.mode = (((this.mode + delta) % 4) + 4) % 4 as CameraMode;
    return this.mode;
  }

  update(
    dt: number,
    elapsedSec: number,
    phase: GamePhase,
    state: VehicleState,
    elevationY: number,
    vehicle: VehicleId,
    targetLookInput: number, // -1 right, 0 center, +1 left
    mapCenter: { x: number; z: number },
  ) {
    if (phase === 'title') {
      // Live Vietnamese city flyover camera tour — elevated above rooftops looking across the central roundabout & wide boulevard
      this.titleAngle += dt * 0.14;
      const radius = 36;
      const cx = mapCenter.x + Math.sin(this.titleAngle) * radius;
      const cz = mapCenter.z + Math.cos(this.titleAngle) * radius;
      this.camera.position.set(cx, 30 + Math.sin(this.titleAngle * 1.2) * 2.5, cz);
      this.camera.lookAt(mapCenter.x, 2, mapCenter.z - 6);
      if (this.camera.fov !== 54) {
        this.camera.fov = 54;
        this.camera.updateProjectionMatrix();
      }
      this.initialized = false;
      return;
    }

    // Smooth look-left / look-right (Z/X or right-mouse drag)
    const lookTarget = THREE.MathUtils.clamp(targetLookInput, -1, 1) * 0.95;
    this.lookOffsetRad += (lookTarget - this.lookOffsetRad) * (1 - Math.exp(-10 * dt));

    // Decay collision shake
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const shake = this.trauma * this.trauma;
    const shakeX = (Math.sin(elapsedSec * 47) * 0.18) * shake;
    const shakeY = (Math.cos(elapsedSec * 53) * 0.14) * shake;

    const isCar = vehicle === 'sedan';
    const speedKmh = Math.abs(state.speed) * 3.6;

    const targetNear = this.mode === 3 ? 0.1 : 0.28;
    if (Math.abs(this.camera.near - targetNear) > 0.01) {
      this.camera.near = targetNear;
      this.camera.updateProjectionMatrix();
    }

    if (this.mode === 3) {
      // FPV (First-Person View) — locked to cockpit with banking, road vibration, and blind-spot head turn
      const roadVib = Math.min(1, speedKmh / 40) * Math.sin(elapsedSec * 28) * 0.004;
      if (isCar) {
        // Left-hand driver seat: local (+0.38, 1.24, 0.04)
        _localPos.set(0.38, 1.24 + roadVib, 0.04);
      } else {
        // Motorbike rider eye height ~1.45m
        _localPos.set(0, 1.45 + roadVib, -0.02);
      }

      const yaw = this.lookOffsetRad;
      _localLook.set(_localPos.x + Math.sin(yaw) * 14, _localPos.y - 0.55, _localPos.z + Math.cos(yaw) * 14);

      _euler.set(state.pitch, state.heading, state.lean * (isCar ? 0.14 : 0.28));
      _quat.setFromEuler(_euler);

      _localPos.applyQuaternion(_quat);
      _localLook.applyQuaternion(_quat);

      this.camera.position.set(state.x + _localPos.x + shakeX, elevationY + _localPos.y + shakeY, state.z + _localPos.z);
      _desiredLook.set(state.x + _localLook.x, elevationY + _localLook.y, state.z + _localLook.z);
      this.camera.up.set(-Math.sin(state.lean * (isCar ? 0.06 : 0.2)) * Math.cos(state.heading), 1, Math.sin(state.lean * (isCar ? 0.06 : 0.2)) * Math.sin(state.heading)).normalize();
      this.camera.lookAt(_desiredLook);

      const targetFov = isCar ? 72 + Math.min(8, speedKmh * 0.1) : 76 + Math.min(9, speedKmh * 0.14);
      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-6 * dt));
        this.camera.updateProjectionMatrix();
      }
      this.currentPos.copy(this.camera.position);
      this.currentLook.copy(_desiredLook);
      this.initialized = true;
      return;
    }

    // 3 Third-Person Camera Modes
    this.camera.up.set(0, 1, 0);
    const fx = Math.sin(state.heading + this.lookOffsetRad * 0.75);
    const fz = Math.cos(state.heading + this.lookOffsetRad * 0.75);
    const rx = -Math.cos(state.heading);
    const rz = Math.sin(state.heading);

    let backDist = 4.6;
    let height = 2.3;
    let sideOffset = 0;
    let lookAhead = 7;
    let targetFov = 62;

    if (this.mode === 0) {
      // TPS Near (gần sau lưng)
      backDist = isCar ? 5.8 : 3.8;
      height = isCar ? 2.45 : 1.95;
      lookAhead = 8;
      targetFov = 62 + Math.min(8, speedKmh * 0.11);
    } else if (this.mode === 1) {
      // TPS Far (xa cao hơn, thấy giao lộ)
      backDist = isCar ? 9.5 : 7.4;
      height = isCar ? 4.8 : 4.1;
      lookAhead = 12;
      targetFov = 58;
    } else {
      // TPS High Diagonal (chéo trên cao — kiểu drone quan sát toàn cảnh)
      backDist = 14.5;
      height = 14.0;
      sideOffset = 5.5;
      lookAhead = 6;
      targetFov = 52;
    }

    _desiredPos.set(
      state.x - fx * backDist + rx * sideOffset + shakeX,
      elevationY + height + shakeY,
      state.z - fz * backDist + rz * sideOffset,
    );
    _desiredLook.set(state.x + fx * lookAhead, elevationY + 1.15, state.z + fz * lookAhead);

    if (!this.initialized) {
      this.currentPos.copy(_desiredPos);
      this.currentLook.copy(_desiredLook);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-9.8 * dt);
      this.currentPos.lerp(_desiredPos, k);
      this.currentLook.lerp(_desiredLook, k);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
