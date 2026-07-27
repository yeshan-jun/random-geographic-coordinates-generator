import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const execFileAsync = promisify(execFile);

test('package uses zero dependencies and static build scripts', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.deepEqual(packageJson.dependencies ?? {}, {});
  assert.deepEqual(packageJson.devDependencies ?? {}, {});
  assert.equal(packageJson.scripts.build, 'node scripts/build.js');
  assert.match(packageJson.scripts.dev, /scripts\/serve\.js/);
  assert.match(packageJson.scripts.preview, /scripts\/serve\.js dist/);
});

test('SEO discovery files point at the formal GitHub Pages URL', async () => {
  const [robots, sitemap] = await Promise.all([
    read('public/robots.txt'),
    read('public/sitemap.xml'),
  ]);
  const siteUrl = 'https://yeshan-jun.github.io/random-geographic-coordinates-generator/';
  assert.match(robots, new RegExp(`${siteUrl.replaceAll('.', '\\.') }sitemap\\.xml`));
  assert.match(sitemap, new RegExp(`<loc>${siteUrl.replaceAll('.', '\\.')}</loc>`));
});

test('GitHub Pages workflow verifies, builds, and deploys dist', async () => {
  const workflow = await read('.github/workflows/deploy.yml');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /path:\s*dist/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});


test('README follows the required documentation structure and contains at least 600 words', async () => {
  const readme = await read('README.md');
  const requiredSections = [
    'Project Introduction',
    'What It Does',
    'How To Use',
    'Supported Formats',
    'Technical Details',
    'Project Structure',
    'Deployment',
    'Repository',
    '## Privacy',
    '## License',
  ];

  for (const section of requiredSections) {
    assert.match(readme, new RegExp(`^#{1,2} ${section.replace(/^## /, '')}$`, 'm'));
  }

  const wordCount = readme
    .replace(/```[\s\S]*?```/g, ' ')
    .match(/[A-Za-z0-9][A-Za-z0-9'’+./-]*/g)?.length ?? 0;
  assert.ok(wordCount >= 600, `README contains ${wordCount} words; expected at least 600`);
  assert.match(readme, /> This project is released under the MIT License\./);
});

test('repo.config.json contains the required public repository metadata', async () => {
  const config = JSON.parse(await read('repo.config.json'));
  assert.deepEqual(config, {
    repo_name: 'random-geographic-coordinates-generator',
    description: 'Generate reproducible random geographic coordinates worldwide, on land, by country, around a point, inside a bounding box, or within a custom polygon.',
    visibility: 'public',
    homepage: 'https://yeshan-jun.github.io/random-geographic-coordinates-generator/',
    topics: [
      'random-coordinates-generator',
      'geographic-coordinates',
      'latitude-longitude',
      'gps-coordinates',
      'geojson',
      'gis-tools',
      'map-tools',
      'pwa',
      'github-pages',
    ],
    default_branch: 'main',
    create_readme: false,
    source_stack: 'HTML + CSS + JavaScript',
    pages_stack: 'Static HTML/CSS/JavaScript built with Node.js',
  });
});

test('build copies README.md and the existing .github directory into dist', async () => {
  await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
  await execFileAsync(process.execPath, ['scripts/build.js'], { cwd: new URL('../', import.meta.url) });

  const [readme, workflow] = await Promise.all([
    read('dist/README.md'),
    read('dist/.github/workflows/deploy.yml'),
  ]);
  assert.match(readme, /^# Random Geographic Coordinates Generator/m);
  assert.match(workflow, /name: Deploy GitHub Pages/);
});
