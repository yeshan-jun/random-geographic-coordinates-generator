import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
await cp(path.join(root, 'README.md'), path.join(output, 'README.md'));
await cp(path.join(root, '.github'), path.join(output, '.github'), { recursive: true });

console.log(`Built static site in ${output}`);
