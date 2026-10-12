'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { createSaveEditorActions, findSaveEditorDownload, validateLayout } = require('../lib/saveEditor');
const { createHealthChecks } = require('../lib/health');
const GAME = 'kingdomsofamalurrereckoning';

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amalur-tool-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const entries = options.entries || { 'release/KoAR.SaveEditor.exe': 'exe', 'release/KoAR.SaveEditor.dll': 'dll', 'release/KoAR.SaveEditor.runtimeconfig.json': '{}', 'release/en/Strings.resources.dll': 'locale', 'release/README.md': 'documentation' };
  const dispatched = [];
  const state = { settings: { gameMode: { discovered: { [GAME]: { path: root } } } }, persistent: { downloads: { files: { tool: { state: 'finished', game: [GAME], localPath: 'save-editor.zip', modInfo: { nexus: { ids: { modId: 8, fileId: 88 } } } } } } } };
  const api = { events: new EventEmitter(), store: { getState: () => state, dispatch: (action) => {
    dispatched.push(action);
    if (action.type === 'tool') state.settings.gameMode.discovered[GAME].tools = { 'amalur-save-editor': action.result };
  } }, ext: { nexusGetModFiles: async () => [{ file_id: 88, category_id: 1, version: options.version || '3.0.498' }] } };
  class SevenZip {
    async list(filename, opts, progress) { assert.equal(filename, path.join(root, 'save-editor.zip')); progress(Object.keys(entries).map((name) => ({ name, attr: '....A' }))); }
    async extractFull(filename, destination) {
      if (options.fail) return { code: 2, errors: ['Corrupt archive'] };
      for (const [name, content] of Object.entries(entries)) {
        if (name === options.omit) continue;
        const target = path.join(destination, ...name.split('/'));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
      }
      return { code: 0, errors: [] };
    }
  }
  const actions = { addDiscoveredTool: (game, id, result, manual) => ({ type: 'tool', game, id, result, manual }), setToolVisible: (game, id, visible) => ({ type: 'visible', game, id, visible }) };
  const tool = createSaveEditorActions(api, { downloadPathForGame: () => root }, actions, { SevenZip });
  return { root, entries, state, api, dispatched, tool };
}

test('standalone installation preserves the full app and links the executable and working directory', async (t) => {
  const { root, tool, state, api, dispatched, entries } = await fixture(t);
  assert.equal(findSaveEditorDownload(state), 'tool');
  const result = await tool.installDownloaded('tool');
  const target = path.join(root, 'tools', 'KoAR.SaveEditor');
  assert.equal(result.path, target);
  for (const [name, content] of Object.entries(entries)) assert.equal(await fs.readFile(path.join(target, ...name.split('/').slice(1)), 'utf8'), content);
  assert.equal(dispatched[0].result.path, path.join(target, 'KoAR.SaveEditor.exe'));
  assert.equal(dispatched[0].result.workingDirectory, target);
  assert.equal(dispatched[1].visible, true);
  assert.equal(state.persistent.mods, undefined);
  const health = createHealthChecks({ statAsync: fs.stat }, {});
  assert.equal((await health[1].check(api)).status, 'passed');
  assert.equal((await fs.readdir(path.join(root, 'tools'))).length, 1);
});

test('standalone update preserves the previous tool including user settings in a backup', async (t) => {
  const { root, tool } = await fixture(t);
  const target = path.join(root, 'tools', 'KoAR.SaveEditor');
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'KoAR.SaveEditor.exe'), 'old');
  await fs.writeFile(path.join(target, 'user-settings.json'), 'personal settings');
  const result = await tool.installDownloaded('tool');
  assert.equal(await fs.readFile(path.join(result.backup, 'user-settings.json'), 'utf8'), 'personal settings');
  assert.equal(await fs.readFile(path.join(result.backup, 'KoAR.SaveEditor.exe'), 'utf8'), 'old');
  assert.equal(await fs.readFile(path.join(target, 'KoAR.SaveEditor.exe'), 'utf8'), 'exe');
});

for (const options of [{ fail: true }, { omit: 'release/KoAR.SaveEditor.dll' }, { entries: { 'KoAR.SaveEditor.exe': '' } }]) {
  test(`failed or incomplete extraction keeps the old tool and does not register success: ${JSON.stringify(options)}`, async (t) => {
    const { root, tool, dispatched } = await fixture(t, options);
    const target = path.join(root, 'tools', 'KoAR.SaveEditor');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'KoAR.SaveEditor.exe'), 'old');
    await assert.rejects(tool.installDownloaded('tool'), /extraction|executable is empty/);
    assert.equal(await fs.readFile(path.join(target, 'KoAR.SaveEditor.exe'), 'utf8'), 'old');
    assert.equal(dispatched.length, 0);
    assert.deepEqual(await fs.readdir(path.join(root, 'tools')), ['KoAR.SaveEditor']);
  });
}

test('wrong game, another Nexus mod, unfinished downloads and legacy editor versions are rejected', async (t) => {
  const { tool, state } = await fixture(t, { version: '2.1.189' });
  await assert.rejects(tool.installDownloaded('tool'), /remaster Save Editor 3.x/);
  const download = state.persistent.downloads.files.tool;
  download.modInfo.nexus.ids.modId = 9;
  assert.equal(findSaveEditorDownload(state), undefined);
  await assert.rejects(tool.installDownloaded('tool'), /completed Re-Reckoning/);
  download.modInfo.nexus.ids.modId = 8;
  download.state = 'started';
  await assert.rejects(tool.installDownloaded('tool'), /completed Re-Reckoning/);
  download.state = 'finished'; download.game = ['other'];
  await assert.rejects(tool.installDownloaded('tool'), /completed Re-Reckoning/);
});

test('layout validation rejects unsafe paths, multiple apps, case collisions and unrelated roots', () => {
  for (const files of [['KoAR.SaveEditor.exe', '../escape.dll'], ['a/KoAR.SaveEditor.exe', 'b/KoAR.SaveEditor.exe'], ['KoAR.SaveEditor.exe', 'KOAR.SAVEEDITOR.EXE'], ['app/KoAR.SaveEditor.exe', 'elsewhere/file.dll']]) assert.throws(() => validateLayout(files));
  assert.deepEqual(validateLayout(['KoAR.SaveEditor.exe', 'locale/resources.dll']).prefix, []);
});

test('a previously completed Nexus download with flat metadata is offered for installation', async (t) => {
  const { tool, state } = await fixture(t);
  state.persistent.downloads.files.tool.modInfo = { 'nexus.ids.modId': 8, 'nexus.ids.fileId': 88 };
  assert.equal(findSaveEditorDownload(state), 'tool');
  await tool.installDownloaded('tool');
});

test('Download & install waits for the completed archive before creating the tool', async (t) => {
  const { tool, api, dispatched } = await fixture(t);
  api.events.on('start-download', (...args) => { assert.equal(dispatched.length, 0); assert.equal(args[5].allowInstall, false); args[3](null, 'tool'); });
  assert.equal(await tool.downloadAndInstall(), 'tool');
  assert.equal(dispatched[0].type, 'tool');
});

test('Essentials offers installation of an existing download and reports the linked tool', async (t) => {
  const React = require('react');
  const renderer = require('react-test-renderer');
  const { createHealthPage } = require('../lib/healthPage');
  const { tool, api } = await fixture(t);
  const checks = createHealthChecks({ statAsync: fs.stat }, {}, tool);
  const Page = createHealthPage(checks, api);
  let view;
  try {
    await renderer.act(async () => { view = renderer.create(React.createElement(Page, { active: true })); });
    await renderer.act(async () => { await view.root.findAllByType('button')[0].props.onClick(); });
    const button = view.root.findByProps({ 'aria-label': 'Install downloaded Save Editor' });
    await renderer.act(async () => { await button.props.onClick(); });
    await renderer.act(async () => { await view.root.findAllByType('button')[0].props.onClick(); });
    assert.match(view.root.findAllByProps({ role: 'status' })[0].children.join(''), /installed.*linked/);
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Install downloaded Save Editor' }).length, 0);
    const editor = view.root.findAllByType('article').find((card) => card.findByType('h4').children.join('') === 'Save Editor');
    assert.match(editor.findByProps({ role: 'status' }).children.join(''), /available/);
  } finally { if (view) renderer.act(() => view.unmount()); }
});

test('concurrent installation requests share one operation', async (t) => {
  const { tool, dispatched } = await fixture(t);
  const first = tool.installDownloaded('tool');
  assert.equal(tool.installDownloaded('tool'), first);
  await first;
  assert.equal(dispatched.filter((action) => action.type === 'tool').length, 1);
});

test('a failed final folder move restores the previous tool', async (t) => {
  const { root, tool, dispatched } = await fixture(t);
  const target = path.join(root, 'tools', 'KoAR.SaveEditor');
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'KoAR.SaveEditor.exe'), 'old');
  const rename = fs.rename;
  fs.rename = async (source, destination) => {
    if (source.includes('.KoAR.SaveEditor-install-') && destination === target) throw Object.assign(new Error('Injected promotion failure'), { code: 'EACCES' });
    return rename(source, destination);
  };
  try {
    await assert.rejects(tool.installDownloaded('tool'), /promotion failure/);
    assert.equal(await fs.readFile(path.join(target, 'KoAR.SaveEditor.exe'), 'utf8'), 'old');
    assert.deepEqual(await fs.readdir(path.join(root, 'tools')), ['KoAR.SaveEditor']);
    assert.equal(dispatched.length, 0);
  } finally { fs.rename = rename; }
});

test('an existing linked tools folder is not written through', async (t) => {
  const { root, tool } = await fixture(t);
  const other = path.join(root, 'other-folder');
  await fs.mkdir(other);
  await fs.symlink(other, path.join(root, 'tools'), 'junction');
  await assert.rejects(tool.installDownloaded('tool'), /regular directory/);
  assert.deepEqual(await fs.readdir(other), []);
});
