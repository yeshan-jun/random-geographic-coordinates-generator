import {
  generateWorldwide,
  generateWithinBoundingBox,
  generateWithinGeometry,
  generateWithinRadius,
} from '../core/generators.js';

self.addEventListener('message', (event) => {
  const { id, mode, options } = event.data;
  try {
    let points;
    if (mode === 'worldwide') points = generateWorldwide(options);
    else if (mode === 'radius') points = generateWithinRadius(options);
    else if (mode === 'bbox') points = generateWithinBoundingBox(options);
    else if (['land', 'country', 'polygon'].includes(mode)) points = generateWithinGeometry(options);
    else throw new Error('Choose a coordinate generation mode.');

    self.postMessage({ id, type: 'complete', points });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Coordinate generation stopped.',
    });
  }
});
