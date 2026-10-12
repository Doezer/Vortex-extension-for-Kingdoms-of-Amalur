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
  assert.deepEqual(Object.keys(entries).sort(), ['CHANGELOG.md', 'LICENSE', 'README.md', 'gameart.svg', 'index.js', 'info.json', 'lib/discovery.js', 'lib/installer.js', 'lib/integration.js', 'lib/health.js', 'lib/healthPage.js', 'lib/saveEditor.js'].sort());
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
  const result = await loaded.installer.install(['Wrap\\patch_0.pak'], extracted, loaded.game.id);
  assert.equal(result.instructions[0].destination, path.join('data', 'patch_0.pak'));
});
