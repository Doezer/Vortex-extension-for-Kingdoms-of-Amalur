'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const React = require('react');
const renderer = require('react-test-renderer');
const { loadExtension } = require('./helpers');
const { createHealthChecks } = require('../lib/health');
const { createHealthPage } = require('../lib/healthPage');

const GAME = 'kingdomsofamalurrereckoning';
async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amalur-health-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const extension = loadExtension();
  extension.state.settings.gameMode.discovered[GAME] = { path: root };
  extension.state.settings.gameMode.activeGameId = GAME;
  extension.state.settings.profiles = { activeProfileId: 'profile' };
  extension.state.persistent = { mods: { [GAME]: {} }, profiles: { profile: { gameId: GAME, modState: {} } } };
  return { root, extension, framework: extension.checks[0] };
}
async function runtime(root) {
  await fs.writeFile(path.join(root, 'dinput8.dll'), 'synthetic proxy');
  await fs.writeFile(path.join(root, 're_mod.dll'), 'synthetic framework');
}
function mod(extension, id, nexusId, enabled, version = '1.4') {
  extension.state.persistent.mods[GAME][id] = { id, state: 'installed', attributes: { modId: nexusId, source: 'nexus', version } };
  extension.state.persistent.profiles.profile.modState[id] = { enabled };
}

test('all four items register native checks and a game-scoped health page', () => {
  const extension = loadExtension();
  assert.deepEqual(extension.checks.map((check) => check.name), ['Mod Framework', 'Save Editor', 'F2 Console', 'No Logos']);
  for (const check of extension.checks) {
    assert.equal(check.gameId, GAME);
    assert.ok(check.triggers.includes('manual'));
    assert.ok(check.triggers.includes('profile-changed'));
    assert.ok(check.triggers.includes('mods-changed'));
    assert.equal(check.cacheDuration, 0);
  }
  assert.equal(extension.page.title, 'Amalur health checks');
  assert.equal(extension.page.options.visible(), false);
  extension.state.settings.gameMode.activeGameId = GAME;
  assert.equal(extension.page.options.visible(), true);
  extension.state.settings.gameMode.activeGameId = 'other-game';
  assert.equal(extension.page.options.visible(), false);
  assert.equal(extension.notifications.length, 0);
});

test('missing framework reports both missing DLLs', async (t) => {
  const { extension, framework } = await setup(t);
  const result = await framework.check(extension.api);
  assert.equal(result.status, 'failed');
  assert.match(result.details, /dinput8.dll/);
  assert.match(result.details, /re_mod.dll/);
  assert.equal(result.severity, 'error');
});
test('a different dinput8 loader alone is not a healthy framework', async (t) => {
  const { root, extension, framework } = await setup(t);
  await fs.writeFile(path.join(root, 'dinput8.dll'), 'another loader');
  const result = await framework.check(extension.api);
  assert.equal(result.status, 'failed');
  assert.match(result.details, /re_mod.dll/);
});
test('complete nonempty runtime passes, then rechecks after file removal', async (t) => {
  const { root, extension, framework } = await setup(t);
  await runtime(root);
  assert.equal((await framework.check(extension.api)).status, 'passed');
  await fs.unlink(path.join(root, 're_mod.dll'));
  assert.equal((await framework.check(extension.api)).status, 'failed');
  assert.equal(extension.notifications.length, 0);
});
test('empty DLL and directory named as a DLL both fail', async (t) => {
  const { root, extension, framework } = await setup(t);
  await fs.writeFile(path.join(root, 'dinput8.dll'), '');
  await fs.mkdir(path.join(root, 're_mod.dll'));
  assert.equal((await framework.check(extension.api)).status, 'failed');
});
test('disabled framework is unhealthy even when stale DLLs remain', async (t) => {
  const { root, extension, framework } = await setup(t);
  await runtime(root);
  mod(extension, 'framework', 9, false);
  assert.match((await framework.check(extension.api)).message, /disabled/);
  extension.state.persistent.profiles.profile.modState.framework.enabled = true;
  assert.equal((await framework.check(extension.api)).status, 'passed');
});
test('known older framework version fails the minimum-version check', async (t) => {
  const { root, extension, framework } = await setup(t);
  await runtime(root);
  mod(extension, 'framework', 9, true, '1.3');
  assert.match((await framework.check(extension.api)).message, /1.4 or newer/);
});
test('filesystem access failures are reported as errors, not missing installations', async () => {
  const checks = createHealthChecks({ statAsync: async () => { throw Object.assign(new Error('Access denied'), { code: 'EACCES' }); } }, {});
  const api = { store: { getState: () => ({ settings: { gameMode: { discovered: { [GAME]: { path: '/game' } } } } }) } };
  const result = await checks[0].check(api);
  assert.equal(result.status, 'error');
  assert.match(result.details, /EACCES/);
});
test('optional missing items are informational suggestions with explicit author-page actions', async (t) => {
  const { extension } = await setup(t);
  for (const [index, modId] of [[1, 8], [2, 14], [3, 4]]) {
    const check = extension.checks[index];
    const result = await check.check(extension.api);
    assert.equal(check.optional, true);
    assert.equal(result.status, 'warning');
    assert.equal(result.severity, 'info');
    assert.match(result.message, /Optional/);
    await check.fix(extension.api);
    assert.equal(extension.opened.at(-1), `https://www.nexusmods.com/${GAME}/mods/${modId}`);
  }
  assert.equal(extension.notifications.length, 0);
});
test('save editor health validates portable and manually configured executables', async (t) => {
  const { root, extension } = await setup(t);
  const check = extension.checks[1];
  const portable = path.join(root, 'tools', 'KoAR.SaveEditor');
  await fs.mkdir(portable, { recursive: true });
  await fs.writeFile(path.join(portable, 'KoAR.SaveEditor.exe'), 'synthetic exe');
  assert.equal((await check.check(extension.api)).status, 'passed');
  extension.state.settings.gameMode.discovered[GAME].tools = { 'amalur-save-editor': { path: path.join(root, 'missing.exe') } };
  assert.equal((await check.check(extension.api)).status, 'warning');
  const custom = path.join(root, 'custom.exe');
  await fs.writeFile(custom, 'synthetic exe');
  extension.state.settings.gameMode.discovered[GAME].tools['amalur-save-editor'].path = custom;
  assert.equal((await check.check(extension.api)).status, 'passed');
});
test('optional recommendations distinguish installed, enabled, and disabled mods', async (t) => {
  const { extension } = await setup(t);
  mod(extension, 'console', 14, false);
  mod(extension, 'logos', 4, true);
  assert.match((await extension.checks[2].check(extension.api)).message, /enable F2 Console/);
  assert.equal((await extension.checks[3].check(extension.api)).status, 'passed');
  extension.state.persistent.profiles.profile.modState.console.enabled = true;
  assert.equal((await extension.checks[2].check(extension.api)).status, 'passed');
});
test('deployment and purge refresh the health page without notifications', async () => {
  const extension = loadExtension();
  let refreshed = 0;
  extension.api.events.on('amalur-health-refresh', () => { refreshed += 1; });
  await extension.asyncHandlers['did-deploy']();
  await extension.asyncHandlers['did-purge']();
  assert.equal(refreshed, 2);
  assert.equal(extension.notifications.length, 0);
});

test('health page renders all items, opens a selected author page, and refreshes status', async () => {
  const extension = loadExtension();
  extension.state.settings.gameMode.discovered[GAME] = { path: '/game' };
  const present = new Set();
  const checks = createHealthChecks({ statAsync: async (filename) => {
    if (!present.has(path.basename(filename))) throw Object.assign(new Error('Missing'), { code: 'ENOENT' });
    return { isFile: () => true, size: 1 };
  } }, { opn: async (url) => { extension.opened.push(url); } });
  const Page = createHealthPage(checks, extension.api);
  let view;
  try {
    await renderer.act(async () => { view = renderer.create(React.createElement(Page, { active: true })); });
    assert.equal(view.root.findAllByType('article').length, 4);
    assert.match(view.root.findAllByProps({ role: 'status' })[0].children.join(''), /missing/);
    const editorAction = view.root.findByProps({ 'aria-label': 'Open Save Editor page' });
    await renderer.act(async () => { await editorAction.props.onClick(); });
    assert.equal(extension.opened.at(-1), `https://www.nexusmods.com/${GAME}/mods/8`);
    present.add('dinput8.dll');
    present.add('re_mod.dll');
    await renderer.act(async () => { await view.root.findAllByType('button')[0].props.onClick(); });
    assert.match(view.root.findAllByProps({ role: 'status' })[0].children.join(''), /runtime files are present/);
    present.delete('re_mod.dll');
    await renderer.act(async () => { extension.api.events.emit('amalur-health-refresh'); });
    assert.match(view.root.findAllByProps({ role: 'status' })[0].children.join(''), /missing/);
    assert.equal(extension.notifications.length, 0);
  } finally {
    if (view) renderer.act(() => view.unmount());
  }
  assert.equal(extension.api.events.listenerCount('amalur-health-refresh'), 0);
});

test('four persisted records for one cached module register only one page and one set of handlers', async () => {
  const extension = loadExtension();
  for (let i = 0; i < 3; i += 1) assert.equal(extension.initializeAgain(), true);
  assert.equal(extension.pages.length, 1);
  assert.equal(extension.games.length, 1);
  assert.equal(extension.installers.length, 1);
  assert.equal(extension.checks.length, 4);
  assert.equal(extension.api.events.listenerCount('mod-enabled'), 1);
  let refreshed = 0;
  extension.api.events.on('amalur-health-refresh', () => { refreshed += 1; });
  extension.api.events.emit('mod-enabled');
  assert.equal(refreshed, 1);
});

test('leaving and reopening the page removes hidden listeners and refreshes once on return', async () => {
  const extension = loadExtension();
  let calls = 0;
  const checks = [{ id: 'test', name: 'Test', optional: false, check: async () => {
    calls += 1;
    return { status: 'passed', message: 'Ready', details: 'Diagnostic information' };
  } }];
  const Page = createHealthPage(checks, extension.api);
  let view;
  try {
    await renderer.act(async () => { view = renderer.create(React.createElement(Page, { active: true })); });
    assert.equal(calls, 1);
    assert.equal(view.root.findByType('details').props.open, undefined);
    await renderer.act(async () => { view.update(React.createElement(Page, { active: false })); });
    assert.equal(extension.api.events.listenerCount('amalur-health-refresh'), 0);
    await renderer.act(async () => { extension.api.events.emit('amalur-health-refresh'); });
    assert.equal(calls, 1);
    await renderer.act(async () => { view.update(React.createElement(Page, { active: true })); });
    assert.equal(calls, 2);
    assert.equal(extension.api.events.listenerCount('amalur-health-refresh'), 1);
  } finally {
    if (view) renderer.act(() => view.unmount());
  }
});

test('a slow scan from the previous page visit cannot overwrite the new result', async () => {
  const extension = loadExtension();
  let resolveOld;
  let calls = 0;
  const checks = [{ id: 'test', name: 'Test', optional: false, check: () => {
    calls += 1;
    return calls === 1 ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ status: 'passed', message: 'Current result' });
  } }];
  const Page = createHealthPage(checks, extension.api);
  let view;
  try {
    await renderer.act(async () => { view = renderer.create(React.createElement(Page, { active: true })); });
    await renderer.act(async () => { view.update(React.createElement(Page, { active: false })); });
    await renderer.act(async () => { view.update(React.createElement(Page, { active: true })); });
    await renderer.act(async () => { resolveOld({ status: 'failed', message: 'Stale result' }); });
    assert.equal(view.root.findByProps({ role: 'status' }).children.join(''), 'Current result');
  } finally {
    if (view) renderer.act(() => view.unmount());
  }
});
