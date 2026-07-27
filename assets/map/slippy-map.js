import {
  boundsFromGeometry,
  boundsFromPoints,
  boundsFromRadius,
  normalizeLongitude,
  viewForBounds,
} from './map-view.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;
const MAX_ZOOM = 18;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function createElement(name, className) {
  const element = document.createElement(name);
  if (className) element.className = className;
  return element;
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function latitudeToWorldY(latitude, worldSize) {
  const limited = clamp(Number(latitude), -MAX_LATITUDE, MAX_LATITUDE);
  const sine = Math.sin(limited * Math.PI / 180);
  return (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize;
}

function worldYToLatitude(y, worldSize) {
  const normalized = 0.5 - y / worldSize;
  return 90 - (360 * Math.atan(Math.exp(-normalized * 2 * Math.PI))) / Math.PI;
}

function longitudeToWorldX(longitude, worldSize) {
  return ((normalizeLongitude(longitude) + 180) / 360) * worldSize;
}

function worldXToLongitude(x, worldSize) {
  return normalizeLongitude((x / worldSize) * 360 - 180);
}

function unwrapGeometry(input) {
  if (!input) return null;
  return input.type === 'Feature' ? input.geometry : input;
}

function collectRings(input, output) {
  const geometry = unwrapGeometry(input);
  if (!geometry) return;
  if (geometry.type === 'Polygon') {
    output.push(...geometry.coordinates);
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) output.push(...polygon);
  }
}

function destinationPoint(center, distanceKm, bearingDegrees) {
  const earthRadiusKm = 6371.0088;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearing = bearingDegrees * Math.PI / 180;
  const latitude1 = center.latitude * Math.PI / 180;
  const longitude1 = center.longitude * Math.PI / 180;
  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance)
      + Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude2 = longitude1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
    Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
  );
  return {
    latitude: latitude2 * 180 / Math.PI,
    longitude: normalizeLongitude(longitude2 * 180 / Math.PI),
  };
}

function geometryPath(geometry, project) {
  const rings = [];
  collectRings(geometry, rings);
  return rings.map((ring) => {
    const points = ring
      .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
      .map(([longitude, latitude]) => project({ longitude, latitude }));
    if (points.length < 2) return '';
    return `${points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} Z`;
  }).filter(Boolean).join(' ');
}

function boundsPolygon(bounds) {
  if (!bounds) return null;
  return {
    type: 'Polygon',
    coordinates: [[
      [bounds.west, bounds.south],
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south],
    ]],
  };
}

export function createInteractiveMap(container, countries, options = {}) {
  const tilePane = createElement('div', 'map-tile-pane');
  const vectorSvg = createSvgElement('svg', {
    class: 'map-vector-pane',
    'aria-hidden': 'true',
    preserveAspectRatio: 'none',
  });
  const fallbackLayer = createSvgElement('g', { class: 'map-fallback-layer' });
  const highlightLayer = createSvgElement('g', { class: 'map-highlight-layer' });
  const scopeLayer = createSvgElement('g', { class: 'map-scope-layer' });
  const polygonLayer = createSvgElement('g', { class: 'map-polygon-layer' });
  vectorSvg.append(fallbackLayer, highlightLayer, scopeLayer, polygonLayer);
  const markerPane = createElement('div', 'map-marker-pane');
  const loadingIndicator = createElement('div', 'map-loading-indicator');
  loadingIndicator.textContent = 'Loading map details…';
  container.replaceChildren(tilePane, vectorSvg, markerPane, loadingIndicator);
  container.classList.add('interactive-map');

  let center = { latitude: 12, longitude: 0 };
  let zoom = 2;
  let minimumZoom = 1;
  let highlightedGeometry = null;
  let scope = null;
  let points = [];
  let selectedPointIndex = -1;
  let drawingEnabled = false;
  let drawingFinished = false;
  let polygonPoints = [];
  let dragState = null;
  let renderQueued = false;
  let loadedTileCount = 0;
  let tileErrorCount = 0;
  const tileElements = new Map();
  let markerElements = [];

  const dimensions = () => ({
    width: Math.max(1, container.clientWidth),
    height: Math.max(1, container.clientHeight),
  });

  const worldSize = () => TILE_SIZE * (2 ** zoom);

  const centerWorldPoint = () => {
    const size = worldSize();
    return {
      x: longitudeToWorldX(center.longitude, size),
      y: latitudeToWorldY(center.latitude, size),
    };
  };

  const pointToContainer = (point) => {
    const size = worldSize();
    const viewport = dimensions();
    const worldCenter = centerWorldPoint();
    const pointX = longitudeToWorldX(point.longitude, size);
    const pointY = latitudeToWorldY(point.latitude, size);
    let deltaX = pointX - worldCenter.x;
    if (deltaX > size / 2) deltaX -= size;
    if (deltaX < -size / 2) deltaX += size;
    return {
      x: viewport.width / 2 + deltaX,
      y: viewport.height / 2 + (pointY - worldCenter.y),
    };
  };

  const containerToPoint = (x, y) => {
    const size = worldSize();
    const viewport = dimensions();
    const worldCenter = centerWorldPoint();
    const worldX = positiveModulo(worldCenter.x + x - viewport.width / 2, size);
    const worldY = clamp(worldCenter.y + y - viewport.height / 2, 0, size);
    return {
      longitude: worldXToLongitude(worldX, size),
      latitude: worldYToLatitude(worldY, size),
    };
  };

  const renderTiles = () => {
    const viewport = dimensions();
    const size = worldSize();
    const worldCenter = centerWorldPoint();
    const left = worldCenter.x - viewport.width / 2;
    const top = worldCenter.y - viewport.height / 2;
    const tileCount = 2 ** zoom;
    const firstX = Math.floor(left / TILE_SIZE);
    const lastX = Math.floor((left + viewport.width) / TILE_SIZE);
    const firstY = Math.max(0, Math.floor(top / TILE_SIZE));
    const lastY = Math.min(tileCount - 1, Math.floor((top + viewport.height) / TILE_SIZE));
    const required = new Set();

    for (let displayX = firstX; displayX <= lastX; displayX += 1) {
      const tileX = positiveModulo(displayX, tileCount);
      for (let tileY = firstY; tileY <= lastY; tileY += 1) {
        const key = `${zoom}/${displayX}/${tileY}`;
        required.add(key);
        let image = tileElements.get(key);
        if (!image) {
          image = new Image();
          image.className = 'map-tile';
          image.alt = '';
          image.decoding = 'async';
          image.draggable = false;
          image.src = TILE_URL
            .replace('{z}', String(zoom))
            .replace('{x}', String(tileX))
            .replace('{y}', String(tileY));
          image.addEventListener('load', () => {
            loadedTileCount += 1;
            image.classList.add('is-loaded');
            loadingIndicator.hidden = true;
            container.classList.add('has-map-tiles');
          }, { once: true });
          image.addEventListener('error', () => {
            tileErrorCount += 1;
            image.remove();
            tileElements.delete(key);
            if (!loadedTileCount && tileErrorCount >= Math.max(2, required.size)) {
              loadingIndicator.textContent = 'Map details are unavailable. The geographic outline remains usable.';
              loadingIndicator.hidden = false;
            }
          }, { once: true });
          tilePane.append(image);
          tileElements.set(key, image);
        }
        image.style.left = `${Math.round(displayX * TILE_SIZE - left)}px`;
        image.style.top = `${Math.round(tileY * TILE_SIZE - top)}px`;
      }
    }

    for (const [key, image] of tileElements) {
      if (!required.has(key)) {
        image.remove();
        tileElements.delete(key);
      }
    }
  };

  const renderFallbackCountries = () => {
    fallbackLayer.replaceChildren();
    if (zoom > 5) return;
    const fragment = document.createDocumentFragment();
    for (const country of countries) {
      const pathData = geometryPath(country.geometry, pointToContainer);
      if (!pathData) continue;
      fragment.append(createSvgElement('path', {
        d: pathData,
        class: 'country-shape',
        'fill-rule': 'evenodd',
      }));
    }
    fallbackLayer.append(fragment);
  };

  const renderHighlightedGeometry = () => {
    highlightLayer.replaceChildren();
    const pathData = geometryPath(highlightedGeometry, pointToContainer);
    if (!pathData) return;
    highlightLayer.append(createSvgElement('path', {
      d: pathData,
      class: 'highlighted-geometry',
      'fill-rule': 'evenodd',
    }));
  };

  const renderScope = () => {
    scopeLayer.replaceChildren();
    if (!scope) return;

    let geometry = null;
    if (scope.type === 'bounds') geometry = boundsPolygon(scope.bounds);
    if (scope.type === 'radius') {
      const ring = [];
      for (let bearing = 0; bearing <= 360; bearing += 5) {
        const point = destinationPoint(scope.center, scope.radiusKm, bearing);
        ring.push([point.longitude, point.latitude]);
      }
      geometry = { type: 'Polygon', coordinates: [ring] };
    }
    const pathData = geometryPath(geometry, pointToContainer);
    if (pathData) {
      scopeLayer.append(createSvgElement('path', {
        d: pathData,
        class: 'scope-geometry',
      }));
    }

    if (scope.type === 'radius') {
      const centerPoint = pointToContainer(scope.center);
      scopeLayer.append(createSvgElement('circle', {
        cx: centerPoint.x,
        cy: centerPoint.y,
        r: 5,
        class: 'scope-center',
      }));
    }
  };

  const getPolygon = () => {
    if (!drawingFinished || polygonPoints.length < 3) return null;
    const ring = polygonPoints.map((point) => [point.longitude, point.latitude]);
    ring.push([...ring[0]]);
    return { type: 'Polygon', coordinates: [ring] };
  };

  const notifyPolygon = () => {
    options.onPolygonChange?.({
      points: polygonPoints.map((point) => ({ ...point })),
      finished: drawingFinished,
      geometry: getPolygon(),
    });
  };

  const renderPolygon = () => {
    polygonLayer.replaceChildren();
    if (!polygonPoints.length) return;
    const projected = polygonPoints.map(pointToContainer);
    const pathData = projected.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
      + (drawingFinished && projected.length >= 3 ? ' Z' : '');
    polygonLayer.append(createSvgElement('path', {
      d: pathData,
      class: drawingFinished ? 'drawn-polygon is-finished' : 'drawn-polygon',
    }));
    for (const [index, point] of projected.entries()) {
      polygonLayer.append(createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: 5,
        class: 'polygon-vertex',
        'data-index': index,
      }));
    }
  };

  const createMarkers = () => {
    markerPane.replaceChildren();
    markerElements = [];
    if (!points.length) return;
    const displayLimit = 2000;
    const step = Math.max(1, Math.ceil(points.length / displayLimit));
    const dense = Math.ceil(points.length / step) > 250;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < points.length; index += step) {
      const point = points[index];
      const marker = createElement('button', dense ? 'coordinate-dot' : 'coordinate-marker');
      marker.type = 'button';
      marker.dataset.pointIndex = String(index);
      marker.setAttribute('aria-label', `Latitude ${point.latitude.toFixed(6)}, longitude ${point.longitude.toFixed(6)}`);
      marker.title = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
      marker.addEventListener('pointerdown', (event) => event.stopPropagation());
      marker.addEventListener('click', (event) => {
        event.stopPropagation();
        selectedPointIndex = index;
        for (const item of markerElements) item.element.classList.toggle('is-selected', item.index === index);
        options.onPointSelect?.(point);
      });
      fragment.append(marker);
      markerElements.push({ index, point, element: marker });
    }
    markerPane.append(fragment);
  };

  const positionMarkers = () => {
    const viewport = dimensions();
    for (const marker of markerElements) {
      const projected = pointToContainer(marker.point);
      const visible = projected.x >= -30
        && projected.x <= viewport.width + 30
        && projected.y >= -30
        && projected.y <= viewport.height + 30;
      marker.element.hidden = !visible;
      if (!visible) continue;
      marker.element.style.left = `${projected.x}px`;
      marker.element.style.top = `${projected.y}px`;
      marker.element.classList.toggle('is-selected', marker.index === selectedPointIndex);
    }
  };

  const render = () => {
    renderQueued = false;
    const viewport = dimensions();
    vectorSvg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
    renderTiles();
    renderFallbackCountries();
    renderHighlightedGeometry();
    renderScope();
    renderPolygon();
    positionMarkers();
  };

  const requestRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(render);
  };

  const calculateMinimumZoom = () => {
    const { width } = dimensions();
    return clamp(Math.ceil(Math.log2(width / TILE_SIZE)), 1, 3);
  };

  const setView = (nextCenter, nextZoom) => {
    center = {
      latitude: clamp(Number(nextCenter.latitude), -MAX_LATITUDE, MAX_LATITUDE),
      longitude: normalizeLongitude(nextCenter.longitude),
    };
    zoom = clamp(Math.round(Number(nextZoom)), minimumZoom, MAX_ZOOM);
    loadingIndicator.textContent = 'Loading map details…';
    loadingIndicator.hidden = container.classList.contains('has-map-tiles');
    requestRender();
  };

  const fitBounds = (bounds, fitOptions = {}) => {
    const view = viewForBounds(bounds, dimensions(), {
      tileSize: TILE_SIZE,
      minimumZoom,
      maximumZoom: clamp(Number(fitOptions.maxZoom ?? 13), minimumZoom, MAX_ZOOM),
      padding: Number(fitOptions.padding ?? 46),
    });
    if (view) setView(view.center, view.zoom);
  };

  const resetView = () => {
    minimumZoom = calculateMinimumZoom();
    setView({ latitude: 10, longitude: 0 }, minimumZoom);
  };

  const zoomAround = (nextZoom, anchorX, anchorY) => {
    const clampedZoom = clamp(nextZoom, minimumZoom, MAX_ZOOM);
    if (clampedZoom === zoom) return;
    const viewport = dimensions();
    const oldSize = worldSize();
    const oldCenter = centerWorldPoint();
    const anchorWorldX = oldCenter.x + anchorX - viewport.width / 2;
    const anchorWorldY = oldCenter.y + anchorY - viewport.height / 2;
    const scale = 2 ** (clampedZoom - zoom);
    const newSize = TILE_SIZE * (2 ** clampedZoom);
    const newCenterX = anchorWorldX * scale - anchorX + viewport.width / 2;
    const newCenterY = anchorWorldY * scale - anchorY + viewport.height / 2;
    zoom = clampedZoom;
    center = {
      longitude: worldXToLongitude(positiveModulo(newCenterX, newSize), newSize),
      latitude: worldYToLatitude(clamp(newCenterY, 0, newSize), newSize),
    };
    requestRender();
  };

  container.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rectangle = container.getBoundingClientRect();
    zoomAround(zoom + (event.deltaY < 0 ? 1 : -1), event.clientX - rectangle.left, event.clientY - rectangle.top);
  }, { passive: false });

  container.addEventListener('dblclick', (event) => {
    event.preventDefault();
    if (drawingEnabled && !drawingFinished) {
      if (polygonPoints.length >= 3) {
        drawingFinished = true;
        renderPolygon();
        notifyPolygon();
      }
      return;
    }
    const rectangle = container.getBoundingClientRect();
    zoomAround(zoom + 1, event.clientX - rectangle.left, event.clientY - rectangle.top);
  });

  container.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rectangle = container.getBoundingClientRect();
    if (drawingEnabled && !drawingFinished) {
      dragState = {
        drawingClick: true,
        startX: event.clientX,
        startY: event.clientY,
        localX: event.clientX - rectangle.left,
        localY: event.clientY - rectangle.top,
        moved: false,
      };
      container.setPointerCapture(event.pointerId);
      return;
    }
    const worldCenter = centerWorldPoint();
    dragState = {
      drawingClick: false,
      startX: event.clientX,
      startY: event.clientY,
      centerX: worldCenter.x,
      centerY: worldCenter.y,
      moved: false,
    };
    container.classList.add('is-dragging');
    container.setPointerCapture(event.pointerId);
  });

  container.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) dragState.moved = true;
    if (dragState.drawingClick) return;
    const size = worldSize();
    const nextCenterX = positiveModulo(dragState.centerX - deltaX, size);
    const nextCenterY = clamp(dragState.centerY - deltaY, 0, size);
    center = {
      longitude: worldXToLongitude(nextCenterX, size),
      latitude: worldYToLatitude(nextCenterY, size),
    };
    requestRender();
  });

  const finishPointer = (event) => {
    if (!dragState) return;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    if (dragState.drawingClick && !dragState.moved && drawingEnabled && !drawingFinished) {
      polygonPoints.push(containerToPoint(dragState.localX, dragState.localY));
      renderPolygon();
      notifyPolygon();
    }
    dragState = null;
    container.classList.remove('is-dragging');
  };

  container.addEventListener('pointerup', finishPointer);
  container.addEventListener('pointercancel', finishPointer);

  const resizeObserver = new ResizeObserver(() => {
    const nextMinimumZoom = calculateMinimumZoom();
    minimumZoom = nextMinimumZoom;
    if (zoom < minimumZoom) zoom = minimumZoom;
    requestRender();
  });
  resizeObserver.observe(container);

  resetView();

  return {
    setPoints(nextPoints) {
      points = Array.isArray(nextPoints) ? nextPoints : [];
      selectedPointIndex = -1;
      createMarkers();
      requestRender();
    },
    setHighlightedGeometry(geometry) {
      highlightedGeometry = geometry;
      requestRender();
    },
    setRadiusScope(nextCenter, radiusKm) {
      scope = { type: 'radius', center: { ...nextCenter }, radiusKm: Number(radiusKm) };
      requestRender();
    },
    setBoundsScope(bounds) {
      scope = bounds ? { type: 'bounds', bounds: { ...bounds } } : null;
      requestRender();
    },
    clearScope() {
      scope = null;
      requestRender();
    },
    focusBounds: fitBounds,
    focusGeometry(geometry, fitOptions = {}) {
      fitBounds(boundsFromGeometry(geometry), fitOptions);
    },
    focusRadius(nextCenter, radiusKm, fitOptions = {}) {
      fitBounds(boundsFromRadius(nextCenter, radiusKm), { maxZoom: 15, ...fitOptions });
    },
    focusPoints(nextPoints, fitOptions = {}) {
      fitBounds(boundsFromPoints(nextPoints), fitOptions);
    },
    startDrawing() {
      drawingEnabled = true;
      drawingFinished = false;
      polygonPoints = [];
      scope = null;
      container.classList.add('is-drawing');
      renderPolygon();
      notifyPolygon();
    },
    stopDrawing() {
      drawingEnabled = false;
      container.classList.remove('is-drawing');
    },
    undoVertex() {
      if (drawingFinished) drawingFinished = false;
      polygonPoints.pop();
      renderPolygon();
      notifyPolygon();
    },
    finishPolygon() {
      if (polygonPoints.length < 3) return null;
      drawingFinished = true;
      renderPolygon();
      notifyPolygon();
      return getPolygon();
    },
    clearPolygon() {
      polygonPoints = [];
      drawingFinished = false;
      renderPolygon();
      notifyPolygon();
    },
    getPolygon,
    zoomIn() {
      const viewport = dimensions();
      zoomAround(zoom + 1, viewport.width / 2, viewport.height / 2);
    },
    zoomOut() {
      const viewport = dimensions();
      zoomAround(zoom - 1, viewport.width / 2, viewport.height / 2);
    },
    resetView,
    destroy() {
      resizeObserver.disconnect();
      tileElements.clear();
      markerElements = [];
      container.replaceChildren();
    },
  };
}
