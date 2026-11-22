import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleChecker, type RuleEvalContext } from './RuleChecker';
import { SCENARIOS } from './scenarios';
import { createMapData } from '../maps/mapDefs';
import { RoadGraph } from '../world/RoadGraph';

function baseCtx(overrides: Partial<RuleEvalContext> = {}): RuleEvalContext {
  return {
    dt: 0.5,
    elapsedSec: 10,
    vehicle: 'wave110',
    speedKmh: 35,
    speedMs: 35 / 3.6,
    heading: Math.PI,
    yawRate: 0,
    signalLeft: false,
    signalRight: false,
    headlight: 0,
    timeOfDay: 'noon',
    projection: null,
    crossedRedLight: false,
    crossedRightOnRedAllowed: false,
    isTurningRight: false,
    crossedClosedRailway: false,
    collided: false,
    pedestrianNearMiss: false,
    ...overrides,
  };
}

test('GPLX starts at 12 points and deducts 4 for running red light', () => {
  const rc = new RuleChecker();
  assert.equal(rc.points, 12);
  const fired = rc.evaluate(baseCtx({ crossedRedLight: true, isTurningRight: false }));
  assert.equal(fired.length, 1);
  assert.equal(fired[0].code, 'RED_LIGHT');
  assert.equal(rc.points, 8);
});

test('Right turn on red is allowed ONLY when S.RIGHT_ON_RED sign permits it', () => {
  const rc = new RuleChecker();
  // Allowed with auxiliary sign
  const ok = rc.evaluate(baseCtx({ crossedRedLight: true, isTurningRight: true, crossedRightOnRedAllowed: true }));
  assert.equal(ok.length, 0);
  assert.equal(rc.points, 12);

  // Forbidden without auxiliary sign
  const bad = rc.evaluate(baseCtx({ elapsedSec: 20, crossedRedLight: true, isTurningRight: true, crossedRightOnRedAllowed: false }));
  assert.equal(bad.length, 1);
  assert.equal(bad[0].code, 'RIGHT_ON_RED_FORBIDDEN');
  assert.equal(rc.points, 8);
});

test('Speeding & wrong-way violations trigger after sustained duration on boulevard', () => {
  const graph = new RoadGraph(createMapData('boulevard'));
  const rc = new RuleChecker();
  const projOk = graph.projectPoint(8.2, 180, Math.PI);
  assert.ok(projOk);
  assert.equal(projOk.isWrongWay, false);

  // Sustained speeding > 65 km/h on 60 km/h boulevard
  for (let i = 0; i < 4; i++) {
    rc.evaluate(baseCtx({ dt: 0.5, elapsedSec: 10 + i * 0.5, speedKmh: 76, projection: projOk }));
  }
  assert.ok(rc.violations.some((v) => v.code === 'SPEEDING'));

  // Wrong-way on opposite side of median (x = -8.2 heading North PI)
  const projWrong = graph.projectPoint(-8.2, 180, Math.PI);
  assert.ok(projWrong);
  assert.equal(projWrong.isWrongWay, true);
  for (let i = 0; i < 4; i++) {
    rc.evaluate(baseCtx({ dt: 0.5, elapsedSec: 25 + i * 0.5, speedKmh: 30, projection: projWrong }));
  }
  assert.ok(rc.violations.some((v) => v.code === 'WRONG_WAY'));
});

test('All 17 training scenarios have valid maps and non-empty waypoints', () => {
  assert.equal(SCENARIOS.length, 17);
  for (let i = 0; i < 17; i++) {
    const sc = SCENARIOS[i];
    assert.equal(sc.id, i + 1);
    assert.ok(sc.waypoints.length >= 1, `Scenario ${sc.id} missing waypoints`);
    const mapData = createMapData(sc.map);
    assert.equal(mapData.id, sc.map);
  }
});
