'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadExtension } = require('./helpers');

const GAME = 'kingdomsofamalurrereckoning';
const URL = `https://www.nexusmods.com/${GAME}/mods/`;

test('KOA Reforged declares Mod Framework as a required Nexus dependency', async () => {
  const extension = loadExtension();
  const files = require('./fixtures/koa-reforged-1.3.5-files.json');
  const result = await extension.installer.install(files, '/unused', GAME);
  assert.equal(result.instructions.filter((instruction) => instruction.type === 'copy').length, 35);
  const rules = result.instructions.filter((instruction) => instruction.type === 'rule');
  assert.equal(rules.length, 1);
  const rule = rules[0].rule;
  assert.equal(rule.type, 'requires');
  assert.equal(rule.reference.gameId, GAME);
  assert.equal(rule.reference.repo.repository, 'nexus');
  assert.equal(rule.reference.repo.gameId, GAME);
  assert.equal(rule.reference.repo.modId, '9');
  assert.equal(rule.reference.repo.fileId, '39');
  assert.equal(rule.reference.versionMatch, '>=1.4.0');
});

test('Mod Framework installation never requires itself', async () => {
  const { installer } = loadExtension();
  const result = await installer.install(['Pack/DINPUT8.DLL', 'Pack/re_mod.dll', 'Pack/mods/sample.json'], '/unused', GAME);
  assert.equal(result.instructions.filter((instruction) => instruction.type === 'rule').length, 0);
});

for (const files of [['patch_0.pak'], ['data/videos/intro.bik'], ['dxgi.dll', 'ReShade.ini']]) {
  test(`independent package ${files[0]} does not require Mod Framework`, async () => {
    const { installer } = loadExtension();
    const result = await installer.install(files, '/unused', GAME);
    assert.equal(result.instructions.filter((instruction) => instruction.type === 'rule').length, 0);
  });
}

async function temporaryGame(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'amalur-setup-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('game setup has no framework, tool, or recommendation notifications', async (t) => {
  const directory = await temporaryGame(t);
  const extension = loadExtension();
  await extension.game.setup({ path: directory });
  assert.equal(extension.notifications.length, 0);
  assert.equal(extension.opened.length, 0);
  assert.deepEqual(extension.dismissed, ['amalur-mod-framework-required', 'amalur-save-editor-suggestion', 'amalur-recommended-mods']);
});

test('complete framework runtime has no setup notifications', async (t) => {
  const directory = await temporaryGame(t);
  await fs.writeFile(path.join(directory, 'dinput8.dll'), 'synthetic proxy');
  await fs.writeFile(path.join(directory, 're_mod.dll'), 'synthetic framework');
  const extension = loadExtension();
  await extension.game.setup({ path: directory });
  assert.ok(extension.dismissed.includes('amalur-mod-framework-required'));
  assert.ok(!extension.notifications.some((notification) => notification.id === 'amalur-mod-framework-required'));
});

test('a missing framework does not create a setup notification', async (t) => {
  const directory = await temporaryGame(t);
  await fs.writeFile(path.join(directory, 'dinput8.dll'), 'synthetic unrelated loader');
  const extension = loadExtension();
  await extension.game.setup({ path: directory });
  assert.equal(extension.notifications.length, 0);
});

test('save editor is discovered at its documented portable location and remains optional', async (t) => {
  const directory = await temporaryGame(t);
  const extension = loadExtension();
  const tool = extension.game.supportedTools[0];
  assert.equal(tool.executable(), 'KoAR.SaveEditor.exe');
  assert.equal(tool.defaultPrimary, false);
  assert.equal(await tool.queryPath(), undefined);
  extension.state.settings.gameMode.discovered[GAME] = { path: directory };
  assert.equal(await tool.queryPath(), undefined);
  const editorDirectory = path.join(directory, 'tools', 'KoAR.SaveEditor');
  await fs.mkdir(editorDirectory, { recursive: true });
  await fs.writeFile(path.join(editorDirectory, 'KoAR.SaveEditor.exe'), 'synthetic tool marker');
  assert.equal(await tool.queryPath(), editorDirectory);
});

test('a configured save editor does not receive another installation suggestion', async (t) => {
  const directory = await temporaryGame(t);
  const extension = loadExtension();
  extension.state.settings.gameMode.discovered[GAME] = { path: directory, tools: { 'amalur-save-editor': { path: 'C:\\Tools\\KoAR.SaveEditor.exe' } } };
  await extension.game.setup({ path: directory });
  assert.ok(!extension.notifications.some((notification) => notification.id === 'amalur-save-editor-suggestion'));
});

test('manual ZIP upgrade forgets duplicate state records without deleting the shared folder', async () => {
  const { duplicateExtensionRecords } = require('../lib/integration');
  const info = require('../info.json');
  const folder = path.resolve(__dirname, '..');
  const extension = loadExtension();
  const entry = (version, extra = {}) => ({ infoJsonId: info.id, path: folder, version, enabled: true, ...extra });
  extension.state.app = { extensions: {
    old: entry('0.1.0'),
    disabled: entry('0.1.3', { enabled: false }),
    pendingRemoval: entry('0.1.4', { remove: true }),
    current: entry(info.version),
    anotherCopy: entry('0.1.3', { path: path.join(folder, 'other') }),
    unrelated: entry('0.1.0', { infoJsonId: 'another-extension' }),
  } };
  assert.deepEqual(duplicateExtensionRecords(extension.state, info, folder), ['old', 'disabled', 'pendingRemoval']);
  extension.startup();
  assert.deepEqual(Object.keys(extension.state.app.extensions), ['current', 'anotherCopy', 'unrelated']);
  assert.equal(extension.state.app.extensions.current.remove, undefined);
  assert.ok((await fs.stat(path.join(folder, 'index.js'))).isFile());
  extension.startup();
  assert.deepEqual(Object.keys(extension.state.app.extensions), ['current', 'anotherCopy', 'unrelated']);
});

test('duplicate record cleanup requires a live current version and matches Windows paths case-insensitively', () => {
  const { duplicateExtensionRecords } = require('../lib/integration');
  const info = require('../info.json');
  const state = { app: { extensions: {
    old: { infoJsonId: info.id, path: 'C:\\Vortex\\plugins\\amalur', version: '0.1.0' },
    new: { infoJsonId: info.id, path: 'c:/vortex/plugins/AMALUR', version: info.version, enabled: false },
  } } };
  assert.deepEqual(duplicateExtensionRecords(state, info, 'C:\\Vortex\\plugins\\amalur'), []);
  state.app.extensions.new.enabled = true;
  assert.deepEqual(duplicateExtensionRecords(state, info, 'C:\\Vortex\\plugins\\amalur'), ['old']);
  assert.deepEqual(duplicateExtensionRecords({}, info, 'C:\\Vortex\\plugins\\amalur'), []);
});

test('host optional-components dialog supports main-only, addons, and cancellation', async () => {
  const files = require('./fixtures/no-intro-fix-files.json');
  const extension = loadExtension();
  const dialogs = [];
  extension.api.showDialog = async (...args) => { dialogs.push(args); return { action: 'Install', input: {} }; };
  assert.equal((await extension.installer.install(files, '/unused', GAME)).instructions.length, 7);
  assert.equal(dialogs[0][2].checkboxes[0].value, false);
  extension.api.showDialog = async () => ({ action: 'Install', input: { 0: true } });
  assert.equal((await extension.installer.install(files, '/unused', GAME)).instructions.length, 18);
  extension.api.showDialog = async () => ({ action: 'Cancel' });
  await assert.rejects(extension.installer.install(files, '/unused', GAME), { name: 'ProcessCanceled' });
  assert.equal(extension.notifications.length, 0);
});
