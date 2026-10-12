'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { unzipSync } = require('fflate');
const { loadExtension } = require('./helpers');

test('distribution ZIP is repeatable, self-contained, and loadable by the host', async (t) => {
  const root = path.resolve(__dirname, '..');
  const metadata = require('../info.json');
  const archivePath = path.join(root, 'dist', `${metadata.id}-${metadata.version}.zip`);
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: root });
  const first = await fs.readFile(archivePath);
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: root });
  assert.deepEqual(await fs.readFile(archivePath), first);
  const entries = unzipSync(first);
  assert.deepEqual(Object.keys(entries).sort(), ['CHANGELOG.md', 'LICENSE', 'README.md', 'gameart.png', 'index.js', 'info.json', 'lib/discovery.js', 'lib/installer.js', 'lib/integration.js', 'lib/health.js', 'lib/healthPage.js', 'lib/saveEditor.js'].sort());
  const packagedInfo = JSON.parse(Buffer.from(entries['info.json']).toString('utf8'));
  for (const field of ['name', 'author', 'version', 'description']) assert.ok(typeof packagedInfo[field] === 'string' && packagedInfo[field].trim());
  assert.match(packagedInfo.version, /^\d+\.\d+\.\d+$/);
  const artwork = Buffer.from(entries['gameart.png']);
  assert.deepEqual(artwork.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(artwork.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(artwork.readUInt32BE(16), 640);
  assert.equal(artwork.readUInt32BE(20), 360);
  assert.ok(artwork.length <= 1024 * 1024);
  const extracted = await fs.mkdtemp(path.join(os.tmpdir(), 'amalur-package-'));
  t.after(() => fs.rm(extracted, { recursive: true, force: true }));
  for (const [filename, content] of Object.entries(entries)) {
    const target = path.join(extracted, filename);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
    assert.deepEqual(Buffer.from(content), await fs.readFile(path.join(root, filename)));
  }
  const loaded = loadExtension(extracted);
  assert.equal(loaded.loaded, true);
  assert.equal(loaded.game.version, metadata.version);
  assert.equal(packagedInfo.name, loaded.game.name);
  assert.equal(loaded.game.logo, 'gameart.png');
  const result = await loaded.installer.install(['Wrap\\patch_0.pak'], extracted, loaded.game.id);
  assert.equal(result.instructions[0].destination, path.join('data', 'patch_0.pak'));
});
