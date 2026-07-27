import { createRandomSource } from './random.js';

const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function normalizeLongitude(longitude) {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function roundedKey(point, precision) {
  return `${point.latitude.toFixed(precision)},${point.longitude.toFixed(precision)}`;
}

function collectPoints({ count, precision = 6, unique = false, createPoint, maxAttempts }) {
  const points = [];
  const keys = unique ? new Set() : null;
  const attemptLimit = maxAttempts ?? Math.max(10_000, count * 100);
  let attempts = 0;

  while (points.length < count && attempts < attemptLimit) {
    attempts += 1;
    const point = createPoint();
    if (!point) continue;

    if (keys) {
      const key = roundedKey(point, precision);
      if (keys.has(key)) continue;
      keys.add(key);
    }

    points.push(point);
  }

  if (points.length !== count) {
    throw new Error(
      `Generated ${points.length.toLocaleString()} of ${count.toLocaleString()} requested points. Increase decimal precision, reduce quantity, or choose a larger area.`,
    );
  }

  return points;
}

export function generateWorldwide({ count, seed = '', precision = 6, unique = false }) {
  const random = createRandomSource(seed);
  return collectPoints({
    count,
    precision,
    unique,
    createPoint: () => ({
      latitude: Math.asin(2 * random() - 1) * RAD_TO_DEG,
      longitude: 360 * random() - 180,
    }),
  });
}

function createPointWithinBounds(random, bounds) {
  const south = Math.min(bounds.south, bounds.north);
  const north = Math.max(bounds.south, bounds.north);
  const sinSouth = Math.sin(south * DEG_TO_RAD);
  const sinNorth = Math.sin(north * DEG_TO_RAD);
  const latitude = Math.asin(sinSouth + random() * (sinNorth - sinSouth)) * RAD_TO_DEG;

  const west = normalizeLongitude(bounds.west);
  const east = normalizeLongitude(bounds.east);
  const longitudeSpan = east >= west ? east - west : 360 - west + east;
  const longitude = normalizeLongitude(west + random() * longitudeSpan);

  return { latitude, longitude };
}

export function generateWithinBoundingBox({
  count,
  bounds,
  seed = '',
  precision = 6,
  unique = false,
}) {
  const random = createRandomSource(seed);
  return collectPoints({
    count,
    precision,
    unique,
    createPoint: () => createPointWithinBounds(random, bounds),
  });
}

export function generateWithinRadius({
  count,
  center,
  radiusKm,
  seed = '',
  precision = 6,
  unique = false,
}) {
  const random = createRandomSource(seed);
  const centerLatitude = center.latitude * DEG_TO_RAD;
  const centerLongitude = center.longitude * DEG_TO_RAD;
  const maximumAngularDistance = Math.min(Math.PI, radiusKm / EARTH_RADIUS_KM);
  const minimumCosine = Math.cos(maximumAngularDistance);

  return collectPoints({
    count,
    precision,
    unique,
    createPoint: () => {
      const angularDistance = Math.acos(1 - random() * (1 - minimumCosine));
      const bearing = random() * Math.PI * 2;
      const sinCenterLatitude = Math.sin(centerLatitude);
      const cosCenterLatitude = Math.cos(centerLatitude);
      const sinDistance = Math.sin(angularDistance);
      const cosDistance = Math.cos(angularDistance);

      const latitude = Math.asin(
        sinCenterLatitude * cosDistance
          + cosCenterLatitude * sinDistance * Math.cos(bearing),
      );
      const longitude = centerLongitude + Math.atan2(
        Math.sin(bearing) * sinDistance * cosCenterLatitude,
        cosDistance - sinCenterLatitude * Math.sin(latitude),
      );

      return {
        latitude: latitude * RAD_TO_DEG,
        longitude: normalizeLongitude(longitude * RAD_TO_DEG),
      };
    },
  });
}

export function haversineDistanceKm(first, second) {
  const firstLatitude = first.latitude * DEG_TO_RAD;
  const secondLatitude = second.latitude * DEG_TO_RAD;
  const latitudeDelta = (second.latitude - first.latitude) * DEG_TO_RAD;
  const longitudeDelta = (second.longitude - first.longitude) * DEG_TO_RAD;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function pointOnSegment(x, y, x1, y1, x2, y2) {
  const squaredLength = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (squaredLength === 0) {
    return Math.abs(x - x1) <= 1e-10 && Math.abs(y - y1) <= 1e-10;
  }

  const cross = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
  if (Math.abs(cross) > 1e-10) return false;
  const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dot < 0) return false;
  return dot <= squaredLength;
}

function pointInRing(longitude, latitude, ring) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];

    if (pointOnSegment(
      longitude,
      latitude,
      previousLongitude,
      previousLatitude,
      currentLongitude,
      currentLatitude,
    )) return true;

    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
      && longitude < (previousLongitude - currentLongitude)
        * (latitude - currentLatitude)
        / (previousLatitude - currentLatitude)
        + currentLongitude;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygonCoordinates(point, coordinates) {
  if (!coordinates.length) return false;
  if (!pointInRing(point.longitude, point.latitude, coordinates[0])) return false;
  return !coordinates.slice(1).some((hole) => pointInRing(point.longitude, point.latitude, hole));
}

function unwrapGeometry(input) {
  if (!input) return null;
  if (input.type === 'Feature') return input.geometry;
  return input;
}

export function pointInGeometry(point, input) {
  const geometry = unwrapGeometry(input);
  if (!geometry) return false;

  if (geometry.type === 'Polygon') {
    return pointInPolygonCoordinates(point, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygonCoordinates(point, polygon));
  }
  return false;
}

function collectCoordinatePairs(coordinates, output) {
  if (!Array.isArray(coordinates)) return;
  if (
    coordinates.length >= 2
    && typeof coordinates[0] === 'number'
    && typeof coordinates[1] === 'number'
  ) {
    output.push(coordinates);
    return;
  }
  for (const child of coordinates) collectCoordinatePairs(child, output);
}

export function geometryBounds(input) {
  const geometry = unwrapGeometry(input);
  if (!geometry) throw new Error('A polygon geometry is required.');
  const pairs = [];
  collectCoordinatePairs(geometry.coordinates, pairs);
  if (!pairs.length) throw new Error('The polygon geometry does not contain coordinates.');

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of pairs) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  return { west, south, east, north };
}

function boundingBoxSurfaceWeight(bounds) {
  const south = Math.min(bounds.south, bounds.north) * DEG_TO_RAD;
  const north = Math.max(bounds.south, bounds.north) * DEG_TO_RAD;
  const west = normalizeLongitude(bounds.west);
  const east = normalizeLongitude(bounds.east);
  const longitudeSpan = (east >= west ? east - west : 360 - west + east) * DEG_TO_RAD;
  return Math.max(Number.EPSILON, longitudeSpan * (Math.sin(north) - Math.sin(south)));
}

function createSamplingRegions(input, preferredBounds = null) {
  const geometry = unwrapGeometry(input);
  if (!geometry) throw new Error('A polygon geometry is required.');

  if (geometry.type === 'Polygon') {
    const region = { type: 'Polygon', coordinates: geometry.coordinates };
    const regionBounds = preferredBounds ?? geometryBounds(region);
    return [{ geometry: region, bounds: regionBounds, weight: boundingBoxSurfaceWeight(regionBounds) }];
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((coordinates) => {
      const region = { type: 'Polygon', coordinates };
      const regionBounds = geometryBounds(region);
      return {
        geometry: region,
        bounds: regionBounds,
        weight: boundingBoxSurfaceWeight(regionBounds),
      };
    });
  }

  throw new Error('Only Polygon and MultiPolygon geometries are supported.');
}

function chooseSamplingRegion(random, regions, totalWeight) {
  let target = random() * totalWeight;
  for (const region of regions) {
    target -= region.weight;
    if (target <= 0) return region;
  }
  return regions.at(-1);
}

export function generateWithinGeometry({
  count,
  geometry,
  seed = '',
  precision = 6,
  unique = false,
  bounds = null,
}) {
  const random = createRandomSource(seed);
  const regions = createSamplingRegions(geometry, bounds);
  const totalWeight = regions.reduce((sum, region) => sum + region.weight, 0);

  return collectPoints({
    count,
    precision,
    unique,
    maxAttempts: Math.max(20_000, count * 1000),
    createPoint: () => {
      const region = chooseSamplingRegion(random, regions, totalWeight);
      const candidate = createPointWithinBounds(random, region.bounds);
      return pointInGeometry(candidate, region.geometry) ? candidate : null;
    },
  });
}
