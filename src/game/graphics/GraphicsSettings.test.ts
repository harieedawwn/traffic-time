import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyGraphicsPreset,
  computeEffectivePixelRatio,
  defaultGraphicsSettings,
  GRAPHICS_PRESETS,
  sanitizeGraphicsSettings,
  SHADOW_MAP_SIZES,
} from './GraphicsSettings';

test('Graphics presets scale monotonically in resolution, draw distance, and shadow size', () => {
  const order = ['low', 'medium', 'high', 'ultra'] as const;
  for (let i = 1; i < order.length; i++) {
    const prev = GRAPHICS_PRESETS[order[i - 1]];
    const curr = GRAPHICS_PRESETS[order[i]];
    assert.ok(curr.resolutionScale >= prev.resolutionScale, 'resolutionScale should increase');
    assert.ok(curr.drawDistance > prev.drawDistance, 'drawDistance should increase');
    assert.ok(SHADOW_MAP_SIZES[curr.shadows] >= SHADOW_MAP_SIZES[prev.shadows], 'shadow size should increase');
  }
});

test('sanitizeGraphicsSettings clamps out-of-range values and falls back cleanly', () => {
  const def = defaultGraphicsSettings(false);
  const cleaned = sanitizeGraphicsSettings(
    {
      preset: 'ultra',
      resolutionScale: 99,
      drawDistance: 10,
      shadows: 'high',
      mirrorQuality: 'high',
      detailLevel: 'high',
      showFps: true,
      autoFpsGuard: false,
    },
    def,
  );
  assert.equal(cleaned.resolutionScale, 1.5);
  assert.equal(cleaned.drawDistance, 120);
  assert.equal(cleaned.showFps, true);
  assert.equal(cleaned.autoFpsGuard, false);
  assert.equal(def.autoFpsGuard, true);

  const presetApplied = applyGraphicsPreset('low', true, false);
  assert.equal(presetApplied.shadows, 'off');
  assert.equal(presetApplied.mirrorQuality, 'off');
  assert.equal(presetApplied.showFps, true);
  assert.equal(presetApplied.autoFpsGuard, false);
});

test('computeEffectivePixelRatio respects software WebGL ceiling and GPU DPR', () => {
  const ultra = applyGraphicsPreset('ultra', false);
  assert.equal(computeEffectivePixelRatio(ultra, 2, true), 1.0);
  assert.ok(computeEffectivePixelRatio(ultra, 2, false) <= 2.2);
  const low = applyGraphicsPreset('low', false);
  assert.equal(computeEffectivePixelRatio(low, 1, true), 0.7);
});
