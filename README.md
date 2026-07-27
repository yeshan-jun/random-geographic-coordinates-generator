# Random Geographic Coordinates Generator

## Project Introduction

Random Geographic Coordinates Generator is a lightweight, browser-based tool for creating random latitude and longitude data for mapping, software testing, GIS experiments, education, logistics research, and location-based product development. The project is designed to work as a fast static website that can be hosted on GitHub Pages without a backend, database, account system, or paid API.

The generator supports several geographic constraints instead of producing only unrestricted global coordinates. Users can create points across the entire Earth, restrict results to land, select a country, generate points around a known center, define a bounding box, or draw a custom polygon directly on the map. The generated dataset can be previewed, copied, and exported immediately.

The live website is available at:

https://yeshan-jun.github.io/random-geographic-coordinates-generator/

The interface is responsive and works on desktop computers, tablets, and mobile devices. It is also configured as a Progressive Web App, so the application can be installed and reopened using cached local resources. The Service Worker follows a network-first strategy: each visit requests the latest files from the server first and falls back to the cache when the network request fails.

## What It Does

The application provides six coordinate generation modes:

1. **Worldwide** generates points across the surface of the Earth using spherical sampling rather than a simple linear latitude calculation. This produces a more geographically balanced distribution.
2. **Land Only** creates points inside locally stored land polygons and rejects ocean locations.
3. **By Country** lets the user select a country or territory and generates coordinates inside its geographic boundaries.
4. **Around a Point** generates coordinates within a specified radius of a center latitude and longitude. The map automatically focuses on the chosen area.
5. **Bounding Box** generates points between minimum and maximum latitude and longitude values, including ranges that cross the international date line.
6. **Draw Polygon** allows the user to create a custom area on the map and generate points inside that polygon.

Users can choose the number of coordinates, decimal precision, coordinate order, and an optional seed. A seed makes the result reproducible: the same mode, settings, and seed produce the same sequence of coordinates. The unique-points option prevents duplicate formatted coordinate pairs. Generation runs in a Web Worker, keeping the page responsive during larger operations.

The map automatically adjusts its center and zoom level to match the active geographic scope. Country generation focuses on the selected country, radius generation focuses on the center and distance, bounding-box generation fits the specified rectangle, and a completed custom polygon becomes the active map view. Generated locations are shown with readable point markers, while large result sets use a lighter display strategy to preserve performance.

## How To Use

Open the website and choose a generation mode from the control panel. The fields shown below the mode selector change according to the selected method.

For unrestricted points, select **Worldwide**, enter the required quantity, and press **Generate Coordinates**. For land points, select **Land Only**. For country-specific results, select **By Country** and choose a country from the dropdown. For local testing, select **Around a Point**, enter the center latitude, center longitude, radius, and distance unit. For a rectangular study area, use **Bounding Box** and enter the minimum and maximum coordinates. For an irregular area, choose **Draw Polygon**, create the shape on the map, and then generate the dataset.

The general settings apply to every mode:

- **Quantity** controls how many coordinate pairs are created, up to 50,000 per operation.
- **Decimal Precision** controls the number of digits after the decimal point.
- **Coordinate Order** changes whether copied values are written as latitude then longitude or longitude then latitude.
- **Seed** creates a repeatable sequence for testing, demonstrations, and research.
- **Unique Points Only** removes repeated formatted coordinate pairs.

After generation, inspect the sample table and select map points to view their coordinates. Use **Copy All** to place the formatted result on the clipboard. Use the download menu to save the complete dataset as CSV, JSON, or GeoJSON. All rows remain available in the exported file even when the map displays a reduced visual sample for performance.

## Supported Formats

The project supports three downloadable formats:

- **CSV** provides a simple tabular file with latitude and longitude columns. It is suitable for spreadsheets, databases, Python scripts, R, data pipelines, and many GIS applications.
- **JSON** provides an array of structured coordinate objects. It is convenient for JavaScript projects, test fixtures, mock APIs, automated QA workflows, and general application development.
- **GeoJSON** provides a standards-based `FeatureCollection` containing Point geometries. GeoJSON coordinates use longitude first and latitude second, following the GeoJSON specification. This format works well with GIS software and web mapping libraries.

The copy action follows the coordinate order selected in the interface. Exporters preserve the selected decimal precision and generate files entirely in the browser using native Blob and object URL APIs.

## Technical Details

The source stack is HTML, CSS, and modern JavaScript modules. The project has no runtime dependencies and does not require a frontend framework. A small Node.js build script copies the static application into the `dist` directory. The same script also copies the root `README.md` and the existing `.github` directory into the build output as repository documentation and workflow metadata.

Coordinate generation is separated into focused modules for random number creation, validation, geographic sampling, formatting, exporting, map control, and worker communication. Seeded generation uses an internal deterministic random-number implementation. Worldwide coordinates are sampled across a sphere. Radius points are calculated with spherical destination formulas. Polygon and country modes use point-in-polygon checks, polygon bounding boxes, and partition-aware sampling for multi-polygon regions and islands.

The country dataset is stored locally under the root-level `data` directory. It is based on Natural Earth low-resolution public-domain geographic boundaries and is prepared for efficient browser use. Detailed online map tiles are displayed when available, while the locally stored vector geometry provides geographic context and supports generation without a remote geocoding service.

The PWA manifest defines the application name, appearance, start URL, scope, and installable icons. The Service Worker precaches all same-origin production assets. Navigation and static asset requests use network-first behavior, so updated files are preferred whenever the server is reachable. Cached files provide a fallback for offline access or temporary network failure. Cross-origin map tile traffic is not added to the application cache.

Automated tests use the built-in Node.js test runner. They cover generators, seed reproducibility, validation, export formats, map view calculations, UI contracts, SEO metadata, PWA caching rules, repository metadata, and production build contents.

## Project Structure

```text
random-geographic-coordinates-generator/
├── .github/                  Existing GitHub Pages workflow
├── assets/                   Application styles and JavaScript modules
│   ├── core/                 Random, geographic, validation, and export logic
│   ├── map/                  Map rendering and automatic viewport control
│   └── workers/              Background coordinate generation
├── docs/                     Design and implementation documentation
├── data/                     Local geographic boundary dataset
├── icons/                    PWA and browser icons
├── manifest.webmanifest      Installable PWA metadata
├── sw.js                     Network-first Service Worker
├── scripts/                  Static development server and production build script
├── tests/                    Automated Node.js tests
├── index.html                SEO content and application interface
├── README.md                 Project documentation
├── repo.config.json          Repository creation and configuration metadata
└── package.json              Commands and project metadata
```

Run `npm install` to validate the lockfile and prepare the local project. The application has no external package dependencies. Start the development server with:

```bash
npm run dev
```

Then open `http://127.0.0.1:4173` in a browser.

Run all automated checks with:

```bash
npm test
```

Create the production output with:

```bash
npm run build
```

The generated static website is written to `dist/`. Preview that directory locally with:

```bash
npm run preview
```

## Deployment

The production output can be deployed to any static hosting service. For GitHub Pages, create a public repository named `random-geographic-coordinates-generator`, push the source files to the `main` branch, and configure Pages to deploy through GitHub Actions. The existing workflow installs the project metadata, runs the automated tests, builds the website, uploads the `dist` directory, and deploys the artifact.

The canonical production URL is:

https://yeshan-jun.github.io/random-geographic-coordinates-generator/

The repository name and homepage must remain consistent with the canonical URL, sitemap, robots file, manifest scope, and asset paths. When the source changes, run `npm run check` locally before pushing. This command runs the complete test suite and then produces a clean build.

Because the site is static, it can also be deployed by uploading the contents of `dist/` to another host. When using a different public domain or repository path, update the canonical link, sitemap, robots file, manifest settings, repository link, and Service Worker asset paths together.

## Repository

Repository URL:

https://github.com/yeshan-jun/random-geographic-coordinates-generator

The root `repo.config.json` contains the repository name, English description, public visibility, homepage, relevant topics, default branch, README creation preference, source stack, and Pages stack. It is intended to be copied into an automated repository-creation workflow or used as a reliable checklist when configuring the repository manually.

Contributions should preserve the project’s main goals: immediate browser use, no account requirement, no backend dependency, responsive behavior, clear geographic controls, reproducible output, useful export formats, and strong static-page SEO. Changes to geographic logic should include focused automated tests before implementation. Changes to offline behavior should verify that current server files remain preferred while cached local files remain available as fallback resources.

## Privacy

Coordinate generation, formatting, uniqueness checks, preview preparation, and file export run locally in the user’s browser. The project does not require registration and does not send generated coordinate datasets to an application server. Seed values and generated results are held in the current page session unless the user copies or downloads them.

The online background map requests visible tiles from the configured tile provider when a network connection is available. Those map requests are separate from coordinate generation. The application Service Worker caches only same-origin project assets and does not precache cross-origin map tiles. Users can continue using the locally cached interface, country geometry, generation logic, and export tools when the external map layer is unavailable.

## License

> This project is released under the MIT License.
