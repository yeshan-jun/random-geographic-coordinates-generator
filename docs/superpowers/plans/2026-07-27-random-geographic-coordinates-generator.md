# Random Geographic Coordinates Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive, SEO-ready, offline-capable random geographic coordinates generator for GitHub Pages.

**Architecture:** A zero-dependency Node script builds a static HTML/CSS/JavaScript application. Pure ES modules implement random generation, validation, export and geometry; browser modules handle the local SVG map, polygon drawing, UI, PWA registration and local Natural Earth data.

**Tech Stack:** HTML, CSS, Vanilla JavaScript, SVG, Web Worker, local Natural Earth GeoJSON, Node test runner, GitHub Actions, GitHub Pages.

## Global Constraints

- Mobile and desktop layouts must both be usable with touch-friendly controls.
- Add project-owned favicon and PWA icon assets.
- PWA requests must prefer the network and use cache only on network failure.
- Pre-cache every local production asset and local data file.
- Add VARIABLE1 through VARIABLE9 comments immediately before `</head>`.
- Canonical must be `https://yeshan-jun.github.io/random-geographic-coordinates-generator/`.
- Header GitHub link must use `rel="nofollow"` and target the project repository.
- Footer contains copyright only.
- Do not use `alert()`.

---

### Task 1: Project shell and source-contract tests

**Files:** Create `package.json`, `scripts/build.js`, `scripts/serve.js`, `tests/source-contract.test.js`, `index.html`, `public/manifest.webmanifest`, `public/sw.js`, icon assets, and deployment workflow.

**Interfaces:** Produces a stable static entry, deterministic output layout, canonical/source contract, and service-worker registration targets.

- [ ] Write source-contract tests for SEO tags, nine VARIABLE comments, nofollow GitHub URL, manifest, service-worker network-first implementation, and footer content.
- [ ] Run the tests and verify they fail because files do not exist.
- [ ] Create the minimal project shell and PWA metadata to satisfy the tests.
- [ ] Run tests and verify they pass.

### Task 2: Coordinate generation core

**Files:** Create `assets/core/random.js`, `src/core/generators.js`, `src/core/validation.js`, and `tests/generators.test.js`.

**Interfaces:** Produces `createRandomSource`, `generateWorldwide`, `generateWithinRadius`, `generateWithinBoundingBox`, `generateWithinGeometry`, `validateGenerationOptions`.

- [ ] Write failing tests for deterministic output, global bounds, radius containment, bounding-box containment, geometry rejection sampling, uniqueness, and validation.
- [ ] Run and confirm expected failures.
- [ ] Implement the smallest pure functions that pass.
- [ ] Re-run all tests.

### Task 3: Export and formatting core

**Files:** Create `assets/core/format.js`, `src/core/exporters.js`, and `tests/exporters.test.js`.

**Interfaces:** Produces `formatPoints`, `toCSV`, `toJSON`, and `toGeoJSON`.

- [ ] Write failing tests for precision, coordinate order, CSV header/order, JSON output, and GeoJSON longitude-latitude order.
- [ ] Run and confirm expected failures.
- [ ] Implement formatters and exporters.
- [ ] Re-run all tests.

### Task 4: Responsive UI and map integration

**Files:** Create `assets/app.js`, `assets/style.css`, `assets/map/*`, `assets/workers/generator.worker.js`, and local geographic data files.

**Interfaces:** Consumes core generators/exporters; produces all six interactive modes, table preview, copy/download, map rendering, polygon drawing, and friendly status/toast behavior.

- [ ] Add DOM contract tests for required controls and labels.
- [ ] Run and confirm failures.
- [ ] Build the desktop and mobile UI from the approved mockup.
- [ ] Connect mode-specific inputs, Web Worker generation, map drawing, sample table, copy, and download.
- [ ] Re-run tests and build.

### Task 5: PWA cache completeness and deployment

**Files:** Modify `public/sw.js`, `public/manifest.webmanifest`; create `.github/workflows/deploy.yml`, `public/robots.txt`, `public/sitemap.xml`.

**Interfaces:** Produces a GitHub Pages artifact whose local files are pre-cached and whose fetch strategy is network-first.

- [ ] Add tests that compare the service-worker app-shell list with the expected built/local assets.
- [ ] Run and confirm failures.
- [ ] Complete cache lists, network-first fallback, install/update lifecycle, and Pages workflow.
- [ ] Run tests, production build, and local HTTP smoke checks.

### Task 6: Final verification and packaging

**Files:** Create `README.md`; package the project ZIP.

- [ ] Inspect responsive HTML/CSS and generated build output.
- [ ] Run `npm test` and `npm run build` fresh.
- [ ] Serve `dist`, request the app shell, manifest, service worker, icons, and data; verify HTTP 200.
- [ ] Check no forbidden uncertainty/negative wording appears in title or meta description.
- [ ] Create the deliverable ZIP excluding `node_modules`, `.git`, and `dist` only if source delivery is desired; include `dist` in a separate deploy ZIP.
