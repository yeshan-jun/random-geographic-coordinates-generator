import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateWorldwide,
  generateWithinBoundingBox,
  generateWithinGeometry,
  generateWithinRadius,
  haversineDistanceKm,
  pointInGeometry,
} from '../assets/core/generators.js';
import { createRandomSource } from '../assets/core/random.js';
import { validateGenerationOptions } from '../assets/core/validation.js';

test('seeded random source is deterministic and remains in [0, 1)', () => {
  const first = createRandomSource('repeatable-seed');
  const second = createRandomSource('repeatable-seed');
  const valuesA = Array.from({ length: 20 }, () => first());
  const valuesB = Array.from({ length: 20 }, () => second());

  assert.deepEqual(valuesA, valuesB);
  assert.ok(valuesA.every((value) => value >= 0 && value < 1));
});

test('worldwide generation is deterministic, bounded, and uniform by surface area', () => {
  const first = generateWorldwide({ count: 5000, seed: 'world' });
  const second = generateWorldwide({ count: 5000, seed: 'world' });

  assert.deepEqual(first, second);
  assert.ok(first.every(({ latitude, longitude }) => (
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
  )));

  const meanSinLatitude = first.reduce(
    (sum, point) => sum + Math.sin(point.latitude * Math.PI / 180),
    0,
  ) / first.length;
  assert.ok(Math.abs(meanSinLatitude) < 0.03);
});

test('radius generation keeps every point within the requested distance', () => {
  const center = { latitude: 1.3521, longitude: 103.8198 };
  const points = generateWithinRadius({
    count: 1000,
    center,
    radiusKm: 75,
    seed: 'singapore-radius',
  });

  assert.equal(points.length, 1000);
  for (const point of points) {
    assert.ok(haversineDistanceKm(center, point) <= 75.000001);
  }
});

test('bounding box generation supports regular and antimeridian boxes', () => {
  const regular = generateWithinBoundingBox({
    count: 500,
    bounds: { south: -10, west: 100, north: 10, east: 120 },
    seed: 'regular-box',
  });
  assert.ok(regular.every((point) => (
    point.latitude >= -10 && point.latitude <= 10
      && point.longitude >= 100 && point.longitude <= 120
  )));

  const crossing = generateWithinBoundingBox({
    count: 500,
    bounds: { south: -20, west: 170, north: 20, east: -170 },
    seed: 'crossing-box',
  });
  assert.ok(crossing.every((point) => (
    point.latitude >= -20 && point.latitude <= 20
      && (point.longitude >= 170 || point.longitude <= -170)
  )));
});

test('point in geometry respects polygon holes and multipolygons', () => {
  const polygonWithHole = {
    type: 'Polygon',
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ],
  };
  const multiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [[[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]]],
      [[[30, 30], [32, 30], [32, 32], [30, 32], [30, 30]]],
    ],
  };

  assert.equal(pointInGeometry({ latitude: 2, longitude: 2 }, polygonWithHole), true);
  assert.equal(pointInGeometry({ latitude: 5, longitude: 5 }, polygonWithHole), false);
  assert.equal(pointInGeometry({ latitude: 21, longitude: 21 }, multiPolygon), true);
  assert.equal(pointInGeometry({ latitude: 25, longitude: 25 }, multiPolygon), false);
});

test('geometry generation returns unique points inside the polygon', () => {
  const geometry = {
    type: 'Polygon',
    coordinates: [[[-2, -2], [2, -2], [2, 2], [-2, 2], [-2, -2]]],
  };
  const points = generateWithinGeometry({
    count: 300,
    geometry,
    precision: 4,
    unique: true,
    seed: 'polygon',
  });

  assert.equal(points.length, 300);
  assert.ok(points.every((point) => pointInGeometry(point, geometry)));
  assert.equal(
    new Set(points.map((point) => `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`)).size,
    300,
  );
});

test('validation returns actionable errors for invalid generation options', () => {
  assert.deepEqual(validateGenerationOptions({ count: 0, precision: 6 }), {
    valid: false,
    message: 'Quantity must be between 1 and 50,000.',
  });
  assert.deepEqual(validateGenerationOptions({ count: 10, precision: 11 }), {
    valid: false,
    message: 'Decimal precision must be between 0 and 10.',
  });
  assert.deepEqual(validateGenerationOptions({
    count: 10,
    precision: 6,
    mode: 'radius',
    center: { latitude: 100, longitude: 10 },
    radiusKm: 1,
  }), {
    valid: false,
    message: 'Center latitude must be between -90 and 90.',
  });
  assert.equal(validateGenerationOptions({ count: 10, precision: 6 }).valid, true);
});

test('multipolygon generation efficiently samples tiny regions separated across the globe', () => {
  const geometry = {
    type: 'MultiPolygon',
    coordinates: [
      [[[-170, 10], [-169.9, 10], [-169.9, 10.1], [-170, 10.1], [-170, 10]]],
      [[[169.9, -10.1], [170, -10.1], [170, -10], [169.9, -10], [169.9, -10.1]]],
    ],
  };

  const points = generateWithinGeometry({
    count: 250,
    geometry,
    seed: 'tiny-islands',
    precision: 8,
    unique: true,
  });

  assert.equal(points.length, 250);
  assert.ok(points.every((point) => pointInGeometry(point, geometry)));
});
