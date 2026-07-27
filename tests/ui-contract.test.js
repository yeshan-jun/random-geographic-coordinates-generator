import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('generator markup includes all modes, controls, results, and accessible status', async () => {
  const html = await read('index.html');
  for (const mode of ['worldwide', 'land', 'country', 'radius', 'bbox', 'polygon']) {
    assert.match(html, new RegExp(`data-mode="${mode}"`));
  }
  for (const id of [
    'quantity',
    'precision',
    'coordinate-order',
    'seed',
    'unique-points',
    'generate-button',
    'copy-button',
    'download-format',
    'download-button',
    'world-map',
    'results-body',
    'generator-status',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="generator-status"[^>]*aria-live="polite"/);
  assert.match(html, /<table[^>]*aria-label="Generated coordinate preview"/);
  assert.match(html, /id="polygon-controls"/);
});

test('SEO support sections contain useful copy and FAQ answers in HTML', async () => {
  const html = await read('index.html');
  assert.match(html, /id="how-it-works"[\s\S]*Generate[\s\S]*Preview[\s\S]*Export/i);
  assert.match(html, /id="use-cases"[\s\S]*Software testing[\s\S]*GIS[\s\S]*Logistics/i);
  assert.match(html, /id="faq"[\s\S]*<details[\s\S]*GeoJSON/i);
});

test('responsive stylesheet defines desktop grid, mobile stacking, and touch targets', async () => {
  const css = await read('assets/style.css');
  assert.match(css, /\.generator-layout\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.generator-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('application wires worker, detailed map, automatic area focus, PWA, and friendly toast without alert', async () => {
  const app = await read('assets/app.js');
  assert.match(app, /new\s+Worker/);
  assert.match(app, /createInteractiveMap/);
  assert.match(app, /focusGenerationArea/);
  assert.match(app, /serviceWorker\.register/);
  assert.match(app, /showToast/);
  assert.doesNotMatch(app, /alert\s*\(/);
});
