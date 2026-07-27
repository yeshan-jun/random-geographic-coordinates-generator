import { formatPoints, roundedNumber } from './format.js';

export function toCSV(points, { precision = 6, order = 'lat-lng' } = {}) {
  const formatted = formatPoints(points, { precision, order });
  const headers = order === 'lng-lat'
    ? ['longitude', 'latitude']
    : ['latitude', 'longitude'];
  return [
    headers.join(','),
    ...formatted.map((point) => `${point.first},${point.second}`),
  ].join('\n');
}

export function toJSON(points, { precision = 6, order = 'lat-lng' } = {}) {
  const output = points.map((point) => {
    const latitude = roundedNumber(point.latitude, precision);
    const longitude = roundedNumber(point.longitude, precision);
    return order === 'lng-lat'
      ? { longitude, latitude }
      : { latitude, longitude };
  });
  return JSON.stringify(output, null, 2);
}

export function toGeoJSON(points, { precision = 6 } = {}) {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: points.map((point, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          roundedNumber(point.longitude, precision),
          roundedNumber(point.latitude, precision),
        ],
      },
      properties: { index: index + 1 },
    })),
  }, null, 2);
}
