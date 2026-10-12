'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadExtension } = require('./helpers');

const GAME_ID = 'kingdomsofamalurrereckoning';

test('entry point registers remaster discovery, root deployment, and installer', async () => {
  const extension = loadExtension(undefined, { findByAppId: async () => ({ gamePath: '/installed/game' }) });
  assert.equal(extension.loaded, true);
  assert.equal(extension.range, '>=1.9.0');
  assert.equal(extension.game.id, GAME_ID);
  assert.equal(extension.game.details.nexusPageId, GAME_ID);
  assert.equal(extension.game.details.steamAppId, 1041720);
  assert.equal(extension.game.queryModPath('/installed/game'), '.');
  assert.equal(extension.game.executable(), 'koa.exe');
  assert.deepEqual(Array.from(extension.game.requiredFiles), ['koa.exe', path.join('data', 'initial_0.pak')]);
  assert.equal(extension.game.mergeMods, true);
  assert.equal(extension.game.final, false, 'Do not claim in-game validation');
  assert.equal(await extension.game.queryPath(), '/installed/game');
  assert.equal((await extension.game.requiresLauncher('/installed/game', 'steam')).launcher, 'steam');
  const epic = await extension.game.requiresLauncher('/installed/game', 'epic');
  assert.equal(epic.launcher, 'epic');
  assert.equal(epic.addInfo, 'b8aa8afb7da84da3a978425ec4b8e5cd');
  assert.equal(await extension.game.requiresLauncher('/installed/game', 'gog'), undefined);
  assert.equal(extension.installer.priority, 25);
});

test('installer claims only this game and leaves scripted FOMODs to Vortex', async () => {
  const { installer } = loadExtension();
  assert.equal((await installer.test(['patch_0.pak'], GAME_ID)).supported, true);
  assert.equal((await installer.test(['unknown.bin'], GAME_ID)).supported, true);
  assert.equal((await installer.test(['patch_0.pak'], 'kingdomsofamalurreckoning')).supported, false);
  assert.equal((await installer.test(['FOMOD\\ModuleConfig.xml', 'data/patch_0.pak'], GAME_ID)).supported, false);
  await assert.rejects(installer.install(['patch_0.pak'], '/tmp', 'other-game'), { name: 'ProcessCanceled' });
});

test('unsupported archives fail as a user-facing cancellation, never fall back to blind copy', async () => {
  const { installer, notifications, logs } = loadExtension();
  await assert.rejects(installer.install(['save.sav'], '/tmp', GAME_ID), (error) => error.name === 'ProcessCanceled' && /manual installation/.test(error.message));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, 'Cannot install this Amalur mod');
  assert.match(notifications[0].error.message, /manual installation/);
  assert.equal(notifications[0].options.allowReport, false);
  assert.equal(logs[0].level, 'warn');
  assert.match(logs[0].metadata.reason, /manual installation/);
});

async function write(directory, relative, content) {
  const filename = path.join(directory, ...relative.split(/[\\/]/));
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
}

test('real file staging and simulated host deployment: conflict, disable, and restore original PAK', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amalur-lifecycle-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const game = path.join(root, 'game');
  const stagingA = path.join(root, 'staging-a');
  const stagingB = path.join(root, 'staging-b');
  await write(game, 'koa.exe', 'synthetic executable marker');
  await write(game, 'data/initial_0.pak', 'synthetic initial marker');
  await write(game, 'data/patch_0.pak', 'original game data');
  const { installer, game: registration } = loadExtension();
  await registration.setup({ path: game });

  const payloads = [
    ['A', { 'Clean Menu/patch_0.pak': 'mod A data', 'Clean Menu/README.txt': 'documentation' }, stagingA],
    ['B', { 'data/patch_0.pak': 'mod B data', 'mods/test.json': '{"patches":[]}', 'mods/test.lua': '-- synthetic script' }, stagingB],
  ];
  const plans = [];
  for (const [label, payload, staging] of payloads) {
    const extracted = path.join(root, `extracted-${label}`);
    for (const [filename, content] of Object.entries(payload)) await write(extracted, filename, content);
    const plan = await installer.install(Object.keys(payload), extracted, GAME_ID);
    for (const instruction of plan.instructions) {
      const destination = path.join(staging, instruction.destination);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(extracted, ...instruction.source.split(/[\\/]/)), destination);
    }
    plans.push(plan);
  }
  // Installation must only stage: original game files are not touched.
  assert.equal(await fs.readFile(path.join(game, 'data/patch_0.pak'), 'utf8'), 'original game data');
  assert.equal(plans[0].instructions[0].destination, plans[1].instructions[0].destination, 'Vortex must see the shared target as a conflict');
  assert.equal(await fs.readFile(path.join(stagingA, 'data/patch_0.pak'), 'utf8'), 'mod A data');

  // Model the host's hardlink deployment and original-file backup. This is a
  // contract test for our paths, not execution of Vortex's deployment internals.
  const target = path.join(game, 'data/patch_0.pak');
  const backup = target + '.original-test-backup';
  await fs.rename(target, backup);
  await fs.link(path.join(stagingA, 'data/patch_0.pak'), target);
  assert.equal(await fs.readFile(target, 'utf8'), 'mod A data');
  await fs.unlink(target);
  await fs.link(path.join(stagingB, 'data/patch_0.pak'), target);
  assert.equal(await fs.readFile(target, 'utf8'), 'mod B data');
  await fs.unlink(target);
  await fs.link(path.join(stagingA, 'data/patch_0.pak'), target);
  assert.equal(await fs.readFile(target, 'utf8'), 'mod A data', 'Disabling winner exposes the other mod');
  await fs.unlink(target);
  await fs.rename(backup, target);
  assert.equal(await fs.readFile(target, 'utf8'), 'original game data', 'Purging restores the untouched original');
});

test('entry point reads extracted framework JSON and ReShade presets', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amalur-extracted-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { installer } = loadExtension();
  await write(root, 'Difficulty/test.json', '{"scripts":[{"trigger":"test","path":"mods/test.lua"}]}');
  await write(root, 'Difficulty/test.lua', '-- synthetic lua');
  const framework = await installer.install(['Difficulty\\test.json', 'Difficulty\\test.lua'], root, GAME_ID);
  assert.equal(framework.instructions[0].destination, path.join('mods', 'test.json'));
  await write(root, 'Pure Amalur.ini', 'Techniques=AdaptiveSharpen\n');
  assert.equal((await installer.install(['Pure Amalur.ini'], root, GAME_ID)).instructions[0].destination, 'Pure Amalur.ini');
  await write(root, 'settings.json', '{"unrelated":true}');
  await assert.rejects(installer.install(['settings.json'], root, GAME_ID), { name: 'ProcessCanceled' });
});
