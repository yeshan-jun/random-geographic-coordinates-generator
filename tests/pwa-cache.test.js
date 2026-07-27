import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

test('service worker pre-cache list contains every local production file', async () => {
  const root = new URL('../', import.meta.url);
  const worker = await readFile(new URL('public/sw.js', root), 'utf8');
  const assetFiles = await listFiles(fileURLToPath(new URL('assets', root)));
  const publicFiles = (await listFiles(fileURLToPath(new URL('public', root))))
    .filter((file) => file !== 'sw.js');
  const expected = [
    'index.html',
    'sw.js',
    ...assetFiles,
    ...publicFiles,
  ];

  for (const file of expected) {
    assert.match(worker, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Missing ${file}`);
  }
});

test('service worker always attempts network before cache fallback', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const fetchPosition = worker.indexOf('await fetch(event.request)');
  const cacheFallbackPosition = worker.indexOf('caches.match(event.request');
  assert.ok(fetchPosition > -1);
  assert.ok(cacheFallbackPosition > fetchPosition);
});


test('service worker leaves cross-origin map tiles to the browser HTTP cache', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /new URL\(event\.request\.url\)\.origin !== self\.location\.origin/);
  assert.match(worker, /return;/);
});
