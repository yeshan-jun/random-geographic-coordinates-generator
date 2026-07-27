export function formatPoints(points, { precision = 6, order = 'lat-lng' } = {}) {
  return points.map((point, index) => {
    const latitude = Number(point.latitude).toFixed(precision);
    const longitude = Number(point.longitude).toFixed(precision);
    const [first, second] = order === 'lng-lat'
      ? [longitude, latitude]
      : [latitude, longitude];

    return {
      index: index + 1,
      latitude,
      longitude,
      first,
      second,
    };
  });
}

export function roundedNumber(value, precision) {
  return Number(Number(value).toFixed(precision));
}
