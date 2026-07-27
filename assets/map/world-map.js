const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function project(longitude, latitude) {
  return {
    x: ((longitude + 180) / 360) * MAP_WIDTH,
    y: ((90 - latitude) / 180) * MAP_HEIGHT,
  };
}

function unproject(x, y) {
  return {
    longitude: (x / MAP_WIDTH) * 360 - 180,
    latitude: 90 - (y / MAP_HEIGHT) * 180,
  };
}

function ringToPath(ring) {
  if (!ring?.length) return '';
  const paths = [];
  let segment = [];
  let previousLongitude = null;

  const flush = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }
    paths.push(`${segment.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} Z`);
    segment = [];
  };

  for (const [longitude, latitude] of ring) {
    if (previousLongitude !== null && Math.abs(longitude - previousLongitude) > 180) flush();
    segment.push(project(longitude, latitude));
    previousLongitude = longitude;
  }
  flush();
  return paths.join(' ');
}

export function geometryToPath(input) {
  const geometry = input?.type === 'Feature' ? input.geometry : input;
  if (!geometry) return '';
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringToPath).join(' ');
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => polygon.map(ringToPath)).join(' ');
  }
  return '';
}

function pointFromEvent(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function createWorldMap(svg, countries, options = {}) {
  const baseLayer = createSvgElement('g', { class: 'map-base-layer' });
  const highlightLayer = createSvgElement('g', { class: 'map-highlight-layer' });
  const pointLayer = createSvgElement('g', { class: 'map-point-layer' });
  const polygonLayer = createSvgElement('g', { class: 'map-polygon-layer' });
  svg.replaceChildren(baseLayer, highlightLayer, pointLayer, polygonLayer);

  for (const country of countries) {
    const pathData = geometryToPath(country.geometry);
    if (!pathData) continue;
    const path = createSvgElement('path', {
      d: pathData,
      class: 'country-shape',
      'fill-rule': 'evenodd',
    });
    const title = createSvgElement('title');
    title.textContent = country.name;
    path.append(title);
    baseLayer.append(path);
  }

  let drawingEnabled = false;
  let drawingFinished = false;
  let polygonPoints = [];
  let viewBox = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };
  let dragState = null;

  const applyViewBox = () => {
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
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

    const projected = polygonPoints.map((point) => project(point.longitude, point.latitude));
    const pathData = projected.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ')
      + (drawingFinished && projected.length >= 3 ? ' Z' : '');
    polygonLayer.append(createSvgElement('path', {
      d: pathData,
      class: drawingFinished ? 'drawn-polygon is-finished' : 'drawn-polygon',
    }));

    for (const [index, point] of projected.entries()) {
      polygonLayer.append(createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: Math.max(3.5, viewBox.width / 230),
        class: 'polygon-vertex',
        'data-index': index,
      }));
    }
  };

  const getPolygon = () => {
    if (!drawingFinished || polygonPoints.length < 3) return null;
    const ring = polygonPoints.map((point) => [point.longitude, point.latitude]);
    ring.push([...ring[0]]);
    return { type: 'Polygon', coordinates: [ring] };
  };

  const setPoints = (points) => {
    pointLayer.replaceChildren();
    if (!points?.length) return;
    const displayLimit = 2000;
    const step = Math.max(1, Math.ceil(points.length / displayLimit));
    for (let index = 0; index < points.length; index += step) {
      const point = points[index];
      const projected = project(point.longitude, point.latitude);
      const circle = createSvgElement('circle', {
        cx: projected.x,
        cy: projected.y,
        r: Math.max(2.2, viewBox.width / 330),
        class: 'coordinate-point',
        tabindex: '0',
        role: 'button',
        'aria-label': `Latitude ${point.latitude.toFixed(6)}, longitude ${point.longitude.toFixed(6)}`,
      });
      const title = createSvgElement('title');
      title.textContent = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
      circle.append(title);
      circle.addEventListener('click', () => options.onPointSelect?.(point));
      pointLayer.append(circle);
    }
  };

  const setHighlightedGeometry = (geometry) => {
    highlightLayer.replaceChildren();
    const pathData = geometryToPath(geometry);
    if (!pathData) return;
    highlightLayer.append(createSvgElement('path', {
      d: pathData,
      class: 'highlighted-geometry',
      'fill-rule': 'evenodd',
    }));
  };

  const zoom = (factor) => {
    const nextWidth = Math.min(MAP_WIDTH, Math.max(120, viewBox.width * factor));
    const nextHeight = nextWidth / 2;
    const centerX = viewBox.x + viewBox.width / 2;
    const centerY = viewBox.y + viewBox.height / 2;
    viewBox = {
      x: Math.max(0, Math.min(MAP_WIDTH - nextWidth, centerX - nextWidth / 2)),
      y: Math.max(0, Math.min(MAP_HEIGHT - nextHeight, centerY - nextHeight / 2)),
      width: nextWidth,
      height: nextHeight,
    };
    applyViewBox();
    renderPolygon();
  };

  svg.addEventListener('click', (event) => {
    if (!drawingEnabled || drawingFinished || dragState?.moved) return;
    const point = pointFromEvent(svg, event);
    if (!point) return;
    const coordinate = unproject(point.x, point.y);
    polygonPoints.push(coordinate);
    renderPolygon();
    notifyPolygon();
  });

  svg.addEventListener('dblclick', (event) => {
    if (!drawingEnabled || drawingFinished) return;
    event.preventDefault();
    if (polygonPoints.length >= 3) {
      drawingFinished = true;
      renderPolygon();
      notifyPolygon();
    }
  });

  svg.addEventListener('pointerdown', (event) => {
    if (drawingEnabled || event.button !== 0) return;
    const point = pointFromEvent(svg, event);
    if (!point) return;
    dragState = { point, initial: { ...viewBox }, moved: false };
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    const point = pointFromEvent(svg, event);
    if (!point) return;
    const deltaX = point.x - dragState.point.x;
    const deltaY = point.y - dragState.point.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 1) dragState.moved = true;
    viewBox.x = Math.max(0, Math.min(MAP_WIDTH - viewBox.width, dragState.initial.x - deltaX));
    viewBox.y = Math.max(0, Math.min(MAP_HEIGHT - viewBox.height, dragState.initial.y - deltaY));
    applyViewBox();
  });

  svg.addEventListener('pointerup', (event) => {
    if (!dragState) return;
    svg.releasePointerCapture(event.pointerId);
    dragState = null;
  });

  applyViewBox();

  return {
    setPoints,
    setHighlightedGeometry,
    startDrawing() {
      drawingEnabled = true;
      drawingFinished = false;
      polygonPoints = [];
      svg.classList.add('is-drawing');
      renderPolygon();
      notifyPolygon();
    },
    stopDrawing() {
      drawingEnabled = false;
      svg.classList.remove('is-drawing');
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
    zoomIn() { zoom(0.72); },
    zoomOut() { zoom(1.38); },
    resetView() {
      viewBox = { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };
      applyViewBox();
      renderPolygon();
    },
  };
}
