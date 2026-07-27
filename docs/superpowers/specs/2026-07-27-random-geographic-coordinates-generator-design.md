# Random Geographic Coordinates Generator Design

## Goal

Build a responsive, static, GitHub Pages-ready tool that generates reproducible random geographic coordinates in six modes and exports results without a backend.

## Product scope

The first release includes Worldwide, Land Only, By Country, Around a Point, Bounding Box, and Draw Polygon modes. Users can set quantity, decimal precision, coordinate order, an optional seed, and unique-points behavior. Results appear on a local SVG vector map, in a five-row preview table, and can be copied or downloaded as CSV, JSON, or GeoJSON.

## Architecture

A zero-dependency Node build script copies a static HTML/CSS/JavaScript application into `dist/`. Pure generator and exporter ES modules remain independent from the DOM so they can be tested with Node's test runner. A project-owned SVG map handles display, pan, zoom and polygon drawing; pure JavaScript modules handle spherical sampling and point-in-polygon checks; local Natural Earth GeoJSON provides land and country boundaries.

## PWA

`manifest.webmanifest` and `sw.js` are served from the project root. The service worker pre-caches the complete local app shell and local geographic data. Subsequent requests use a network-first strategy and fall back to cached responses. The map and all geographic data are local assets, so the complete production application is available from cache after the first successful visit.

## SEO and URLs

Canonical URL: `https://yeshan-jun.github.io/random-geographic-coordinates-generator/`.
Repository URL: `https://github.com/yeshan-jun/random-geographic-coordinates-generator` with `rel="nofollow"`.
The title directly targets “random geographic coordinates generator”; description emphasizes worldwide, land, country, radius, polygon, bulk export, and speed. Nine requested VARIABLE comments appear immediately before `</head>`.

## Responsive behavior

Desktop uses a two-column control/map layout. Tablet reduces column width and rearranges result content. Mobile switches to a single column with large touch targets, horizontally scrollable mode controls when needed, a shorter map, and stacked actions. Errors and confirmations use inline status areas and non-blocking toasts; browser `alert()` is not used.

## Visual system and icons

The interface follows the approved light blue geographic-tool mockup. Project-owned SVG and PNG icons are generated for favicon, PWA 192/512 icons, maskable icons, and Apple touch icon. UI controls use inline SVG icons so no external icon font is required.

## Validation and error handling

Quantities are limited to 1–50,000; precision to 0–10; latitude/longitude/radius/bounding-box inputs are validated. Polygon mode requires a valid drawn polygon. Rejection sampling has an attempt cap and returns a friendly actionable message when a requested region is too small for the selected unique precision and quantity.

## Testing

Node tests cover deterministic seeds, spherical global distribution bounds, radius containment, bounding-box containment, uniqueness, coordinate formatting, CSV/JSON/GeoJSON export order, and PWA/SEO source requirements. A production static build and local HTTP smoke test complete verification.
