import { toCSV, toGeoJSON, toJSON } from './core/exporters.js';
import { formatPoints } from './core/format.js';
import { validateGenerationOptions } from './core/validation.js';
import { createInteractiveMap } from './map/slippy-map.js';
import { boundsFromEdges } from './map/map-view.js';

const modeDescriptions = {
  worldwide: "Generate random coordinates worldwide. Points are distributed uniformly across the Earth's surface.",
  land: 'Generate random points within the local Natural Earth land geometry.',
  country: 'Choose a country or territory and generate points inside its represented boundary.',
  radius: 'Generate points within a selected radius around a latitude and longitude.',
  bbox: 'Generate points inside a latitude and longitude bounding box, including boxes across the date line.',
  polygon: 'Draw a custom polygon on the map and generate random points inside it.',
};

const state = {
  mode: 'worldwide',
  points: [],
  dataset: null,
  map: null,
  polygon: null,
  requestId: 0,
  toastTimer: null,
};

const elements = {
  modeButtons: [...document.querySelectorAll('.mode-button')],
  modeFields: [...document.querySelectorAll('.mode-fields[data-fields]')],
  modeDescription: document.querySelector('#mode-description'),
  countrySelect: document.querySelector('#country-select'),
  quantity: document.querySelector('#quantity'),
  precision: document.querySelector('#precision'),
  coordinateOrder: document.querySelector('#coordinate-order'),
  seed: document.querySelector('#seed'),
  unique: document.querySelector('#unique-points'),
  centerLatitude: document.querySelector('#center-latitude'),
  centerLongitude: document.querySelector('#center-longitude'),
  radiusValue: document.querySelector('#radius-value'),
  radiusUnit: document.querySelector('#radius-unit'),
  bboxNorth: document.querySelector('#bbox-north'),
  bboxSouth: document.querySelector('#bbox-south'),
  bboxWest: document.querySelector('#bbox-west'),
  bboxEast: document.querySelector('#bbox-east'),
  generateButton: document.querySelector('#generate-button'),
  copyButton: document.querySelector('#copy-button'),
  downloadButton: document.querySelector('#download-button'),
  downloadFormat: document.querySelector('#download-format'),
  status: document.querySelector('#generator-status'),
  resultsBody: document.querySelector('#results-body'),
  resultSummary: document.querySelector('#result-summary'),
  mapSampleNote: document.querySelector('#map-sample-note'),
  firstHeading: document.querySelector('#first-coordinate-heading'),
  secondHeading: document.querySelector('#second-coordinate-heading'),
  worldMap: document.querySelector('#world-map'),
  mapReadout: document.querySelector('#map-coordinate-readout'),
  polygonUndo: document.querySelector('#polygon-undo'),
  polygonFinish: document.querySelector('#polygon-finish'),
  polygonClear: document.querySelector('#polygon-clear'),
  toast: document.querySelector('#toast'),
};

const worker = new Worker(new URL('./workers/generator.worker.js', import.meta.url), { type: 'module' });

function showToast(message, type = 'success') {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle('is-error', type === 'error');
  elements.toast.classList.add('is-visible');
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2600);
}

function setStatus(message, type = 'info') {
  elements.status.textContent = message;
  elements.status.classList.toggle('is-error', type === 'error');
  elements.status.classList.toggle('is-success', type === 'success');
}

function setGenerating(active) {
  elements.generateButton.disabled = active;
  elements.generateButton.innerHTML = active
    ? '<span aria-hidden="true">↻</span>Generating…'
    : '<span aria-hidden="true">✦</span>Generate Coordinates';
}

function selectedCountry() {
  return state.dataset?.countries.find((country) => country.isoA3 === elements.countrySelect.value) ?? null;
}

function updateMapHighlight() {
  if (!state.map) return;
  state.map.setHighlightedGeometry(state.mode === 'country' ? selectedCountry()?.geometry ?? null : null);
}

function focusGenerationArea(options = generationOptions()) {
  if (!state.map) return;

  if (state.mode === 'worldwide' || state.mode === 'land') {
    state.map.clearScope();
    state.map.resetView();
    return;
  }

  if (state.mode === 'country') {
    state.map.clearScope();
    if (options.geometry) state.map.focusGeometry(options.geometry, { padding: 52, maxZoom: 9 });
    return;
  }

  if (state.mode === 'radius') {
    const { center, radiusKm } = options;
    if (!Number.isFinite(center?.latitude) || !Number.isFinite(center?.longitude) || !Number.isFinite(radiusKm) || radiusKm <= 0) return;
    state.map.setRadiusScope(center, radiusKm);
    state.map.focusRadius(center, radiusKm, { padding: 58, maxZoom: 15 });
    return;
  }

  if (state.mode === 'bbox') {
    const bounds = boundsFromEdges(options.bounds);
    if (!bounds) return;
    state.map.setBoundsScope(bounds);
    state.map.focusBounds(bounds, { padding: 54, maxZoom: 15 });
    return;
  }

  if (state.mode === 'polygon') {
    state.map.clearScope();
    if (options.geometry) state.map.focusGeometry(options.geometry, { padding: 56, maxZoom: 15 });
  }
}

function changeMode(mode) {
  state.mode = mode;
  for (const button of elements.modeButtons) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const fields of elements.modeFields) fields.hidden = fields.dataset.fields !== mode;
  elements.modeDescription.textContent = modeDescriptions[mode];

  if (mode === 'polygon') {
    state.map?.startDrawing();
    state.polygon = null;
    setStatus('Click the map to add polygon vertices, then finish the polygon.');
  } else {
    state.map?.stopDrawing();
    setStatus(`Ready to generate coordinates in ${mode === 'bbox' ? 'the bounding box' : modeDescriptions[mode].split('.')[0].toLowerCase()}.`);
  }
  updateMapHighlight();
  focusGenerationArea();
}

function generationOptions() {
  const count = Number(elements.quantity.value);
  const precision = Number(elements.precision.value);
  const base = {
    count,
    precision,
    seed: elements.seed.value,
    unique: elements.unique.checked,
  };

  if (state.mode === 'radius') {
    const unitMultiplier = elements.radiusUnit.value === 'mi' ? 1.609344 : 1;
    return {
      ...base,
      mode: 'radius',
      center: {
        latitude: Number(elements.centerLatitude.value),
        longitude: Number(elements.centerLongitude.value),
      },
      radiusKm: Number(elements.radiusValue.value) * unitMultiplier,
    };
  }
  if (state.mode === 'bbox') {
    return {
      ...base,
      mode: 'bbox',
      bounds: {
        north: Number(elements.bboxNorth.value),
        south: Number(elements.bboxSouth.value),
        west: Number(elements.bboxWest.value),
        east: Number(elements.bboxEast.value),
      },
    };
  }
  if (state.mode === 'land') {
    return { ...base, mode: 'land', geometry: state.dataset?.land };
  }
  if (state.mode === 'country') {
    const country = selectedCountry();
    return {
      ...base,
      mode: 'country',
      geometry: country?.geometry,
      bounds: country ? {
        west: country.bbox[0], south: country.bbox[1], east: country.bbox[2], north: country.bbox[3],
      } : null,
    };
  }
  if (state.mode === 'polygon') {
    return { ...base, mode: 'polygon', geometry: state.polygon };
  }
  return { ...base, mode: 'worldwide' };
}

function validateMode(options) {
  const commonValidation = validateGenerationOptions(options);
  if (!commonValidation.valid) return commonValidation;
  if (state.mode === 'country' && !options.geometry) return { valid: false, message: 'Choose a country or territory.' };
  if (state.mode === 'land' && !options.geometry) return { valid: false, message: 'Land boundary data is still loading.' };
  if (state.mode === 'polygon' && !options.geometry) return { valid: false, message: 'Finish a polygon with at least three vertices.' };
  return { valid: true, message: '' };
}

function generateCoordinates() {
  const options = generationOptions();
  const validation = validateMode(options);
  if (!validation.valid) {
    setStatus(validation.message, 'error');
    showToast(validation.message, 'error');
    return;
  }

  focusGenerationArea(options);
  state.requestId += 1;
  setGenerating(true);
  setStatus(`Generating ${options.count.toLocaleString()} coordinates…`);
  worker.postMessage({ id: state.requestId, mode: state.mode, options });
}

function updateResults() {
  const precision = Number(elements.precision.value);
  const order = elements.coordinateOrder.value;
  const formatted = formatPoints(state.points.slice(0, 5), { precision, order });
  const latFirst = order === 'lat-lng';
  elements.firstHeading.textContent = latFirst ? 'Latitude' : 'Longitude';
  elements.secondHeading.textContent = latFirst ? 'Longitude' : 'Latitude';
  elements.resultsBody.replaceChildren();

  if (!formatted.length) {
    const row = document.createElement('tr');
    row.className = 'empty-row';
    row.innerHTML = '<td colspan="3">No coordinates generated yet.</td>';
    elements.resultsBody.append(row);
  } else {
    for (const point of formatted) {
      const row = document.createElement('tr');
      for (const value of [point.index, point.first, point.second]) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.append(cell);
      }
      elements.resultsBody.append(row);
    }
  }

  elements.resultSummary.textContent = state.points.length
    ? `Showing the first ${Math.min(5, state.points.length).toLocaleString()} of ${state.points.length.toLocaleString()} generated points.`
    : 'Generate coordinates to see a preview.';
  elements.mapSampleNote.textContent = state.points.length > 2000
    ? `Map displays a sample of 2,000 points.`
    : '';
  elements.copyButton.disabled = !state.points.length;
  elements.downloadButton.disabled = !state.points.length;
  state.map?.setPoints(state.points);
}

worker.addEventListener('message', (event) => {
  if (event.data.id !== state.requestId) return;
  setGenerating(false);
  if (event.data.type === 'error') {
    setStatus(event.data.message, 'error');
    showToast(event.data.message, 'error');
    return;
  }
  state.points = event.data.points;
  updateResults();
  setStatus(`${state.points.length.toLocaleString()} coordinates generated and ready to copy or download.`, 'success');
  showToast(`${state.points.length.toLocaleString()} coordinates generated.`);
});

function textForCopy() {
  const precision = Number(elements.precision.value);
  const order = elements.coordinateOrder.value;
  return formatPoints(state.points, { precision, order }).map((point) => `${point.first}, ${point.second}`).join('\n');
}

async function copyAll() {
  const content = textForCopy();
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  showToast(`${state.points.length.toLocaleString()} coordinates copied.`);
}

function downloadResults() {
  const precision = Number(elements.precision.value);
  const order = elements.coordinateOrder.value;
  const format = elements.downloadFormat.value;
  let content;
  let type;
  if (format === 'csv') {
    content = toCSV(state.points, { precision, order });
    type = 'text/csv;charset=utf-8';
  } else if (format === 'json') {
    content = toJSON(state.points, { precision, order });
    type = 'application/json;charset=utf-8';
  } else {
    content = toGeoJSON(state.points, { precision });
    type = 'application/geo+json;charset=utf-8';
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `random-geographic-coordinates.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${format.toUpperCase()} download created.`);
}

function populateCountries() {
  elements.countrySelect.replaceChildren();
  for (const country of state.dataset.countries) {
    const option = document.createElement('option');
    option.value = country.isoA3;
    option.textContent = `${country.name} (${country.isoA3})`;
    elements.countrySelect.append(option);
  }
  elements.countrySelect.value = state.dataset.countries.find((country) => country.isoA3 === 'USA')?.isoA3
    ?? state.dataset.countries[0]?.isoA3
    ?? '';
}

async function initialize() {
  try {
    const response = await fetch(new URL('../data/countries-110m.json', import.meta.url));
    if (!response.ok) throw new Error(`Geographic data returned ${response.status}.`);
    state.dataset = await response.json();
    populateCountries();
    state.map = createInteractiveMap(elements.worldMap, state.dataset.countries, {
      onPointSelect(point) {
        elements.mapReadout.textContent = `Latitude ${point.latitude.toFixed(6)}, Longitude ${point.longitude.toFixed(6)}`;
      },
      onPolygonChange({ points, finished, geometry }) {
        state.polygon = geometry;
        if (state.mode !== 'polygon') return;
        if (finished) {
          setStatus(`Polygon ready with ${points.length} vertices. Select Generate Coordinates.`, 'success');
          state.map?.focusGeometry(geometry, { padding: 56, maxZoom: 15 });
        }
        else setStatus(`${points.length} polygon ${points.length === 1 ? 'vertex' : 'vertices'} added. Add at least three and finish the polygon.`);
      },
    });
    changeMode('worldwide');
    generateCoordinates();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Geographic data did not load.';
    setStatus(`Map data could not be prepared: ${message}`, 'error');
    showToast('Geographic data did not load.', 'error');
  }
}

for (const button of elements.modeButtons) button.addEventListener('click', () => changeMode(button.dataset.mode));
elements.generateButton.addEventListener('click', generateCoordinates);
elements.copyButton.addEventListener('click', copyAll);
elements.downloadButton.addEventListener('click', downloadResults);
elements.coordinateOrder.addEventListener('change', updateResults);
elements.precision.addEventListener('change', updateResults);
elements.countrySelect.addEventListener('change', () => {
  updateMapHighlight();
  focusGenerationArea();
});
elements.polygonUndo.addEventListener('click', () => state.map?.undoVertex());
elements.polygonFinish.addEventListener('click', () => {
  const polygon = state.map?.finishPolygon();
  if (!polygon) showToast('Add at least three polygon vertices.', 'error');
});
elements.polygonClear.addEventListener('click', () => state.map?.clearPolygon());

for (const input of [
  elements.centerLatitude,
  elements.centerLongitude,
  elements.radiusValue,
  elements.radiusUnit,
  elements.bboxNorth,
  elements.bboxSouth,
  elements.bboxWest,
  elements.bboxEast,
]) {
  input.addEventListener('change', () => focusGenerationArea());
}
document.querySelector('#map-zoom-in').addEventListener('click', () => state.map?.zoomIn());
document.querySelector('#map-zoom-out').addEventListener('click', () => state.map?.zoomOut());
document.querySelector('#map-reset').addEventListener('click', () => focusGenerationArea());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {
      setStatus('The generator is available online. Offline installation will be enabled after a secure deployment.');
    });
  });
}

initialize();
