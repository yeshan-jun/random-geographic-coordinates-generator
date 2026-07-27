const EARTH_RADIUS_KM = 6371.0088;
const cleanNumber = (value) => Number(Number(value).toFixed(12));

export function normalizeLongitude(longitude) {
  const normalized = ((Number(longitude) + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : cleanNumber(normalized);
}

function collectCoordinatePairs(input, output) {
  if (!Array.isArray(input)) return;
  if (
    input.length >= 2
    && Number.isFinite(Number(input[0]))
    && Number.isFinite(Number(input[1]))
  ) {
    output.push([Number(input[0]), Number(input[1])]);
    return;
  }
  for (const child of input) collectCoordinatePairs(child, output);
}

function unwrapGeometry(input) {
  if (!input) return null;
  if (input.type === 'Feature') return input.geometry ?? null;
  return input;
}

function longitudeInterval(longitudes) {
  if (!longitudes.length) return null;
  const sorted = longitudes
    .map((longitude) => ((normalizeLongitude(longitude) % 360) + 360) % 360)
    .sort((a, b) => a - b);

  if (sorted.length === 1) {
    const only = normalizeLongitude(sorted[0]);
    return {
      west: only,
      east: only,
      longitudeSpan: 0,
      crossesAntimeridian: false,
    };
  }

  let largestGap = -1;
  let largestGapIndex = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const next = index === sorted.length - 1 ? sorted[0] + 360 : sorted[index + 1];
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const start = sorted[(largestGapIndex + 1) % sorted.length];
  const span = Math.max(0, 360 - largestGap);
  const end = start + span;
  const west = normalizeLongitude(start);
  const east = normalizeLongitude(end);

  return {
    west,
    east,
    longitudeSpan: cleanNumber(span),
    crossesAntimeridian: span > 0 && west > east,
  };
}

function createBounds(pairs) {
  const validPairs = pairs.filter(([longitude, latitude]) => (
    Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
  ));
  if (!validPairs.length) return null;

  const latitudes = validPairs.map(([, latitude]) => latitude);
  const interval = longitudeInterval(validPairs.map(([longitude]) => longitude));
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);

  return {
    south,
    north,
    west: interval.west,
    east: interval.east,
    latitudeSpan: cleanNumber(north - south),
    longitudeSpan: interval.longitudeSpan,
    crossesAntimeridian: interval.crossesAntimeridian,
  };
}

export function boundsFromGeometry(input) {
  const geometry = unwrapGeometry(input);
  if (!geometry?.coordinates) return null;
  const pairs = [];
  collectCoordinatePairs(geometry.coordinates, pairs);
  return createBounds(pairs);
}

export function boundsFromPoints(points = []) {
  return createBounds(points.map((point) => [Number(point.longitude), Number(point.latitude)]));
}

export function boundsFromRadius(center, radiusKm) {
  const latitude = Number(center?.latitude);
  const longitude = Number(center?.longitude);
  const radius = Number(radiusKm);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || !Number.isFinite(radius)
    || radius < 0
    || latitude < -90
    || latitude > 90
  ) return null;

  const angularDistance = radius / EARTH_RADIUS_KM;
  const latitudeDelta = angularDistance * (180 / Math.PI);
  const south = Math.max(-90, latitude - latitudeDelta);
  const north = Math.min(90, latitude + latitudeDelta);
  const cosine = Math.cos(latitude * Math.PI / 180);
  const longitudeDelta = Math.abs(cosine) < 1e-9
    ? 180
    : Math.min(180, latitudeDelta / Math.abs(cosine));
  const west = normalizeLongitude(longitude - longitudeDelta);
  const east = normalizeLongitude(longitude + longitudeDelta);
  const longitudeSpan = Math.min(360, longitudeDelta * 2);

  return {
    south,
    north,
    west,
    east,
    latitudeSpan: cleanNumber(north - south),
    longitudeSpan: cleanNumber(longitudeSpan),
    crossesAntimeridian: longitudeSpan < 360 && west > east,
  };
}

export function boundsFromEdges(input) {
  const north = Number(input?.north);
  const south = Number(input?.south);
  const west = normalizeLongitude(input?.west);
  const east = normalizeLongitude(input?.east);
  if (
    !Number.isFinite(north)
    || !Number.isFinite(south)
    || !Number.isFinite(west)
    || !Number.isFinite(east)
    || north < south
    || north > 90
    || south < -90
  ) return null;

  const crossesAntimeridian = west > east;
  const longitudeSpan = crossesAntimeridian ? (180 - west) + (east + 180) : east - west;
  return {
    south,
    north,
    west,
    east,
    latitudeSpan: cleanNumber(north - south),
    longitudeSpan: cleanNumber(Math.max(0, longitudeSpan)),
    crossesAntimeridian,
  };
}

function latitudeToNormalizedY(latitude) {
  const limited = Math.min(85.05112878, Math.max(-85.05112878, Number(latitude)));
  const sine = Math.sin(limited * Math.PI / 180);
  return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
}

function normalizedYToLatitude(y) {
  const normalized = 0.5 - Number(y);
  return 90 - (360 * Math.atan(Math.exp(-normalized * 2 * Math.PI))) / Math.PI;
}

export function viewForBounds(bounds, viewport, options = {}) {
  if (!bounds) return null;
  const width = Math.max(1, Number(viewport?.width));
  const height = Math.max(1, Number(viewport?.height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const tileSize = Number(options.tileSize ?? 256);
  const minimumZoom = Number(options.minimumZoom ?? 1);
  const maximumZoom = Number(options.maximumZoom ?? 18);
  const padding = Math.max(0, Number(options.padding ?? 46));
  const availableWidth = Math.max(64, width - padding * 2);
  const availableHeight = Math.max(64, height - padding * 2);
  const longitudeSpan = Math.max(Number(bounds.longitudeSpan ?? 0), 0.00001);
  const northY = latitudeToNormalizedY(bounds.north);
  const southY = latitudeToNormalizedY(bounds.south);
  const latitudeSpan = Math.max(Math.abs(southY - northY), 0.00001);
  const longitudeWorldSpan = longitudeSpan / 360;
  const zoomX = Math.log2(availableWidth / (tileSize * longitudeWorldSpan));
  const zoomY = Math.log2(availableHeight / (tileSize * latitudeSpan));
  const zoom = Math.min(maximumZoom, Math.max(minimumZoom, Math.floor(Math.min(zoomX, zoomY))));
  const eastUnwrapped = bounds.crossesAntimeridian || bounds.west > bounds.east
    ? bounds.east + 360
    : bounds.east;
  const longitude = normalizeLongitude(bounds.west + (eastUnwrapped - bounds.west) / 2);
  const latitude = normalizedYToLatitude((northY + southY) / 2);

  return {
    center: { latitude, longitude },
    zoom,
  };
}
