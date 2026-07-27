import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('index contains required SEO, variable placeholders, and repository link', async () => {
  const html = await read('index.html');

  assert.match(html, /<title>Random Geographic Coordinates Generator[^<]*<\/title>/);
  assert.match(html, /name="description" content="[^"]*random[^"]*coordinates[^"]*"/i);
  assert.match(
    html,
    /rel="canonical"\s+href="https:\/\/yeshan-jun\.github\.io\/random-geographic-coordinates-generator\/"/,
  );

  for (let index = 1; index <= 9; index += 1) {
    assert.match(html, new RegExp(`<!-- VARIABLE${index} -->`));
  }

  const variableNinePosition = html.indexOf('<!-- VARIABLE9 -->');
  const closingHeadPosition = html.indexOf('</head>');
  assert.ok(variableNinePosition > -1 && variableNinePosition < closingHeadPosition);
  assert.match(
    html,
    /href="https:\/\/github\.com\/yeshan-jun\/random-geographic-coordinates-generator"[^>]*rel="nofollow(?: noopener noreferrer)?"/,
  );
  assert.doesNotMatch(html, /alert\s*\(/);
});

test('footer contains copyright and no extra navigation', async () => {
  const html = await read('index.html');
  const footer = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? '';
  assert.match(footer, /©\s*2026/);
  assert.doesNotMatch(footer, /<a\b/i);
  assert.doesNotMatch(footer, /<nav\b/i);
});

test('manifest defines installable app metadata and icons', async () => {
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  assert.equal(manifest.name, 'Random Geographic Coordinates Generator');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose?.includes('maskable')));
});

test('service worker uses network first and pre-caches all local app assets', async () => {
  const worker = await read('public/sw.js');
  for (const requiredAsset of [
    'index.html',
    'manifest.webmanifest',
    'assets/app.js',
    'assets/style.css',
    'data/countries-110m.json',
    'icons/icon-192.png',
    'icons/icon-512.png',
  ]) {
    assert.match(worker, new RegExp(requiredAsset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(worker, /await\s+fetch\s*\(/);
  assert.match(worker, /catch\s*\([^)]*\)\s*\{[\s\S]*caches\.match/);
  assert.match(worker, /new URL\(event\.request\.url\)\.origin !== self\.location\.origin/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
});

test('country dataset uses unique non-placeholder selector codes', async () => {
  const dataset = JSON.parse(await read('public/data/countries-110m.json'));
  const codes = dataset.countries.map((country) => country.isoA3);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.every((code) => /^[A-Z0-9]{3}$/.test(code)));
});
