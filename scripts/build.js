'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { zipSync, unzipSync } = require('fflate');

const root = path.resolve(__dirname, '..');
const info = JSON.parse(fs.readFileSync(path.join(root, 'info.json')));
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
if (info.version !== packageInfo.version || info.id !== packageInfo.name) {
  throw new Error('Run npm run check and correct the extension metadata before packaging.');
}
// Keep dev dependencies, tests, and CI configuration out of the distributed extension.
const FILES = ['index.js', 'info.json', 'gameart.svg', 'lib/discovery.js', 'lib/installer.js', 'lib/integration.js', 'lib/health.js', 'lib/healthPage.js', 'lib/saveEditor.js', 'README.md', 'CHANGELOG.md', 'LICENSE'];
const content = Object.fromEntries(FILES.map((filename) => [
  filename,
  [new Uint8Array(fs.readFileSync(path.join(root, filename))), { mtime: new Date('2020-01-01T00:00:00Z') }],
]));
const archive = zipSync(content, { level: 9 });
const packed = unzipSync(archive);
for (const filename of FILES) {
  if (!Buffer.from(packed[filename]).equals(fs.readFileSync(path.join(root, filename)))) {
    throw new Error(`ZIP round-trip failed for ${filename}`);
  }
}
const outputDirectory = path.join(root, 'dist');
fs.mkdirSync(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, `${info.id}-${info.version}.zip`);
fs.writeFileSync(output, archive);
console.log(`Built ${path.relative(root, output)} (${archive.length} bytes).`);

module.exports = { FILES };
