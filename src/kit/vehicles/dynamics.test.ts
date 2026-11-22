import assert from 'node:assert/strict';
import test from 'node:test';
import { createState, MAX_BIKE_LEAN_RAD, SPECS, stepVehicle } from './dynamics';

test('motorbike lean never exceeds MAX_BIKE_LEAN_RAD even under full high-speed turn', () => {
  for (const id of ['wave110', 'vision110'] as const) {
    const state = createState(0, 0, 0);
    state.speed = 16; // ~58 km/h
    const spec = SPECS[id];
    for (let i = 0; i < 120; i++) {
      stepVehicle(state, spec, { throttle: 1, brake: 0, steer: 1, reverse: false, horn: false }, 1 / 60);
      assert.ok(
        Math.abs(state.lean) <= MAX_BIKE_LEAN_RAD + 1e-4,
        `${id} lean ${state.lean} exceeded ${MAX_BIKE_LEAN_RAD}`,
      );
    }
    assert.ok(state.lean > 0.05, `${id} should still lean gently into a right turn`);
  }
});

test('motorbike and car smoothly self-center steering and upright rapidly when steer input is released', () => {
  const state = createState(0, 0, 0);
  state.speed = 12;
  const spec = SPECS.wave110;
  for (let i = 0; i < 45; i++) {
    stepVehicle(state, spec, { throttle: 0.7, brake: 0, steer: 1, reverse: false, horn: false }, 1 / 60);
  }
  const peakLean = Math.abs(state.lean);
  assert.ok(peakLean > 0.05 && peakLean <= MAX_BIKE_LEAN_RAD + 1e-4);

  // Release steering for 0.45s -> should recover almost completely upright and straight
  for (let i = 0; i < 27; i++) {
    stepVehicle(state, spec, { throttle: 0.4, brake: 0, steer: 0, reverse: false, horn: false }, 1 / 60);
  }
  assert.ok(Math.abs(state.steerAngle) < 0.015, `expected steerAngle near 0, got ${state.steerAngle}`);
  assert.ok(Math.abs(state.lean) < 0.025, `expected bike upright near 0, got ${state.lean}`);
});

test('sedan body roll remains subtle and composed during cornering', () => {
  const state = createState(0, 0, 0);
  state.speed = 18;
  for (let i = 0; i < 90; i++) {
    stepVehicle(state, SPECS.sedan, { throttle: 0.8, brake: 0, steer: -1, reverse: false, horn: false }, 1 / 60);
    assert.ok(Math.abs(state.lean) <= 0.04, `sedan body roll ${state.lean} too large`);
  }
});
