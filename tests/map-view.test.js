import assert from 'node:assert/strict';
import test from 'node:test';

import {
  boundsFromGeometry,
  boundsFromRadius,
  boundsFromPoints,
  boundsFromEdges,
  viewForBounds,
} from '../assets/map/map-view.js';

test('geometry bounds choose the narrow antimeridian-spanning interval', () => {
  const fijiLike = {
    type: 'MultiPolygon',
    coordinates: [
      [[[[178.1, -18.2], [179.7, -18.2], [179.7, -16.1], [178.1, -16.1], [178.1, -18.2]]]],
      [[[[-179.9, -17.4], [-179.2, -17.4], [-179.2, -16.2], [-179.9, -16.2], [-179.9, -17.4]]]],
    ],
  };

  const bounds = boundsFromGeometry(fijiLike);
  assert.ok(bounds);
  assert.equal(bounds.crossesAntimeridian, true);
  assert.ok(bounds.longitudeSpan < 4, `expected narrow longitude span, got ${bounds.longitudeSpan}`);
  assert.equal(bounds.south, -18.2);
  assert.equal(bounds.north, -16.1);
});

test('radius bounds stay focused on the selected city-scale area', () => {
  const bounds = boundsFromRadius({ latitude: 1.3521, longitude: 103.8198 }, 25);
  assert.ok(bounds.latitudeSpan < 1);
  assert.ok(bounds.longitudeSpan < 1);
  assert.ok(bounds.south < 1.3521 && bounds.north > 1.3521);
  assert.ok(bounds.west < 103.8198 && bounds.east > 103.8198);
});

test('point bounds ignore invalid coordinates and retain valid points', () => {
  const bounds = boundsFromPoints([
    { latitude: 1.3, longitude: 103.7 },
    { latitude: Number.NaN, longitude: 0 },
    { latitude: 1.5, longitude: 104.1 },
  ]);
  assert.deepEqual(
    {
      south: bounds.south,
      north: bounds.north,
      west: bounds.west,
      east: bounds.east,
    },
    { south: 1.3, north: 1.5, west: 103.7, east: 104.1 },
  );
});


test('edge bounds preserve regular and antimeridian selection spans', () => {
  const regular = boundsFromEdges({ north: 10, south: -10, west: 100, east: 120 });
  assert.equal(regular.longitudeSpan, 20);
  assert.equal(regular.crossesAntimeridian, false);

  const crossing = boundsFromEdges({ north: 20, south: -20, west: 170, east: -170 });
  assert.equal(crossing.longitudeSpan, 20);
  assert.equal(crossing.crossesAntimeridian, true);
});


test('viewport fitting zooms city-scale selections instead of keeping the world view', () => {
  const cityBounds = boundsFromRadius({ latitude: 1.3521, longitude: 103.8198 }, 25);
  const view = viewForBounds(cityBounds, { width: 900, height: 430 }, {
    minimumZoom: 2,
    maximumZoom: 15,
    padding: 58,
  });
  assert.ok(view.zoom >= 9, `expected city zoom, got ${view.zoom}`);
  assert.ok(Math.abs(view.center.latitude - 1.3521) < 0.1);
  assert.ok(Math.abs(view.center.longitude - 103.8198) < 0.1);
});
