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
