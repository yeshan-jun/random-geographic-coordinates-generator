import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPoints } from '../assets/core/format.js';
import { toCSV, toGeoJSON, toJSON } from '../assets/core/exporters.js';

const points = [
  { latitude: 1.3520834, longitude: 103.8198361 },
  { latitude: -33.8688197, longitude: 151.2092955 },
];

test('formatPoints applies precision and selected coordinate order', () => {
  assert.deepEqual(formatPoints(points, { precision: 4, order: 'lat-lng' }), [
    { index: 1, latitude: '1.3521', longitude: '103.8198', first: '1.3521', second: '103.8198' },
    { index: 2, latitude: '-33.8688', longitude: '151.2093', first: '-33.8688', second: '151.2093' },
  ]);
  assert.deepEqual(formatPoints(points.slice(0, 1), { precision: 2, order: 'lng-lat' }), [
    { index: 1, latitude: '1.35', longitude: '103.82', first: '103.82', second: '1.35' },
  ]);
});

test('CSV uses the selected order in headers and values', () => {
  assert.equal(
    toCSV(points, { precision: 3, order: 'lat-lng' }),
    'latitude,longitude\n1.352,103.820\n-33.869,151.209',
  );
  assert.equal(
    toCSV(points.slice(0, 1), { precision: 2, order: 'lng-lat' }),
    'longitude,latitude\n103.82,1.35',
  );
});

test('JSON preserves user-selected property order', () => {
  const json = toJSON(points.slice(0, 1), { precision: 3, order: 'lng-lat' });
  assert.equal(json, '[\n  {\n    "longitude": 103.82,\n    "latitude": 1.352\n  }\n]');
});

test('GeoJSON always follows longitude latitude coordinate order', () => {
  const geojson = JSON.parse(toGeoJSON(points.slice(0, 1), { precision: 4 }));
  assert.equal(geojson.type, 'FeatureCollection');
  assert.deepEqual(geojson.features[0].geometry.coordinates, [103.8198, 1.3521]);
  assert.equal(geojson.features[0].properties.index, 1);
});
