function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function coordinateError(label, value, minimum, maximum) {
  if (!isFiniteNumber(value) || Number(value) < minimum || Number(value) > maximum) {
    return `${label} must be between ${minimum} and ${maximum}.`;
  }
  return null;
}

export function validateGenerationOptions(options) {
  const count = Number(options.count);
  const precision = Number(options.precision);

  if (!Number.isInteger(count) || count < 1 || count > 50_000) {
    return { valid: false, message: 'Quantity must be between 1 and 50,000.' };
  }
  if (!Number.isInteger(precision) || precision < 0 || precision > 10) {
    return { valid: false, message: 'Decimal precision must be between 0 and 10.' };
  }

  if (options.mode === 'radius') {
    const latitudeError = coordinateError('Center latitude', options.center?.latitude, -90, 90);
    if (latitudeError) return { valid: false, message: latitudeError };
    const longitudeError = coordinateError('Center longitude', options.center?.longitude, -180, 180);
    if (longitudeError) return { valid: false, message: longitudeError };
    const radiusKm = Number(options.radiusKm);
    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 20_015) {
      return { valid: false, message: 'Radius must be greater than 0 and no more than 20,015 km.' };
    }
  }

  if (options.mode === 'bbox') {
    const fields = [
      ['South latitude', options.bounds?.south, -90, 90],
      ['North latitude', options.bounds?.north, -90, 90],
      ['West longitude', options.bounds?.west, -180, 180],
      ['East longitude', options.bounds?.east, -180, 180],
    ];
    for (const [label, value, minimum, maximum] of fields) {
      const error = coordinateError(label, value, minimum, maximum);
      if (error) return { valid: false, message: error };
    }
    if (Number(options.bounds.north) <= Number(options.bounds.south)) {
      return { valid: false, message: 'North latitude must be greater than south latitude.' };
    }
  }

  return { valid: true, message: '' };
}
