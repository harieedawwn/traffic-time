import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapData } from '../maps/mapDefs';
import { RoadGraph } from './RoadGraph';
import type { MapId } from '../types';

const ALL_MAPS: MapId[] = ['boulevard', 'oldquarter', 'residential', 'highway'];

test('All 4 Vietnamese maps build valid connected RoadGraphs and spawn on legal right-hand asphalt', () => {
  for (const id of ALL_MAPS) {
    const data = createMapData(id);
    const graph = new RoadGraph(data);
    assert.ok(graph.computedEdges.length >= 8, `${id} should have >= 8 road edges`);

    const sp = data.defaultSpawn;
    const proj = graph.projectPoint(sp.x, sp.z, sp.heading);
    assert.ok(proj, `${id} spawn must project onto a road`);
    assert.equal(proj.onSidewalk, false, `${id} spawn must not be on sidewalk`);
    assert.equal(proj.isWrongWay, false, `${id} spawn must face legal traffic direction`);
    assert.equal(proj.offAsphaltDist, 0, `${id} spawn must be on road asphalt`);
  }
});

test('Highway overpass bridge computes smooth elevated Y profile above 0', () => {
  const graph = new RoadGraph(createMapData('highway'));
  // Bridge spans H2 (-60, 80) to H3 (80, 80), midpoint is (10, 80)
  const midY = graph.elevationAt(10, 85);
  const flatY = graph.elevationAt(-140, 85);
  assert.ok(midY > 4.5, `Expected bridge crest > 4.5m, got ${midY}`);
  assert.equal(flatY, 0);
});

test('Old Quarter one-way street flags reverse travel as wrong-way', () => {
  const graph = new RoadGraph(createMapData('oldquarter'));
  // Phố Hàng Đào runs South->North (heading PI)
  const legal = graph.projectPoint(1.5, 50, Math.PI);
  const illegal = graph.projectPoint(1.5, 50, 0);
  assert.ok(legal && illegal);
  assert.equal(legal.isWrongWay, false);
  assert.equal(illegal.isWrongWay, true);
});
