'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { downloadEssential } = require('../lib/integration');
const { createHealthChecks } = require('../lib/health');
const { createHealthPage } = require('../lib/healthPage');
const React = require('react');
const renderer = require('react-test-renderer');
const GAME = 'kingdomsofamalurrereckoning';

function fixture(files) {
  const events = new EventEmitter();
  const requests = [];
  const calls = [];
  const api = {
    events,
    ext: {
      ensureLoggedIn: async () => { calls.push('login'); },
      nexusGetModFiles: async (game, modId) => { calls.push([game, modId]); return files; },
    },
    showDialog: async () => ({ action: 'Download', input: { 22: true } }),
  };
  events.on('start-download', (...args) => { requests.push(args); args[3](null, 'download-id'); });
  return { api, requests, calls };
}

const main = (file_id, extra = {}) => ({ file_id, category_id: 1, name: 'Main release', version: '1.4', ...extra });

test('Essentials requests a Nexus download through Vortex with metadata and no automatic installation', async () => {
  const { api, requests, calls } = fixture([main(39, { is_primary: true }), main(40), main(5, { category_id: 4 })]);
  assert.equal(await downloadEssential(api, { name: 'Mod Framework', modId: 9 }), 'download-id');
  assert.deepEqual(calls, ['login', [GAME, 9]]);
  assert.deepEqual(requests[0][0], [`nxm://${GAME}/mods/9/files/39`]);
  assert.deepEqual(requests[0][1], { game: GAME, name: 'Mod Framework', modId: 9, fileId: 39 });
  assert.deepEqual(requests[0][5], { allowInstall: false });
});

test('Save Editor downloads only remaster 3.x main files and never installs them as mods', async () => {
  const { api, requests } = fixture([main(1, { version: '2.1.189', is_primary: true }), main(88, { version: '3.0.498' })]);
  await downloadEssential(api, { name: 'Save Editor', modId: 8 });
  assert.deepEqual(requests[0][0], [`nxm://${GAME}/mods/8/files/88`]);
  assert.deepEqual(requests[0][5], { allowInstall: false });
});

test('ambiguous main files require a choice in Vortex and cancellation queues nothing', async () => {
  const { api, requests } = fixture([main(21), main(22)]);
  let choices;
  api.showDialog = async (type, title, content) => { choices = content.choices; return { action: 'Cancel' }; };
  assert.equal(await downloadEssential(api, { name: 'No Logos', modId: 4 }), undefined);
  assert.equal(requests.length, 0);
  assert.deepEqual(choices.map((choice) => choice.id), ['21', '22']);
  api.showDialog = async () => ({ action: 'Download', input: { 22: true } });
  await downloadEssential(api, { name: 'No Logos', modId: 4 });
  assert.deepEqual(requests[0][0], [`nxm://${GAME}/mods/4/files/22`]);
});

test('unavailable APIs, missing compatible files, and download failures never report success', async () => {
  await assert.rejects(downloadEssential({ ext: {} }, { name: 'No Logos', modId: 4 }), /Nexus downloads are unavailable/);
  const { api, requests } = fixture([main(1, { version: '2.1.189' })]);
  await assert.rejects(downloadEssential(api, { name: 'Save Editor', modId: 8 }), /No suitable main file/);
  assert.equal(requests.length, 0);
  api.ext.nexusGetModFiles = async () => [main(39)];
  api.events.removeAllListeners('start-download');
  await assert.rejects(downloadEssential(api, { name: 'Mod Framework', modId: 9 }), /download manager is unavailable/);
  api.events.on('start-download', (...args) => args[3](new Error('Nexus authorization failed')));
  await assert.rejects(downloadEssential(api, { name: 'Mod Framework', modId: 9 }), /Nexus authorization failed/);
  api.ext.ensureLoggedIn = async () => { throw new Error('Login canceled'); };
  await assert.rejects(downloadEssential(api, { name: 'Mod Framework', modId: 9 }), /Login canceled/);
});

test('Essentials download button queues one request, reports completion, and retains the author-page action', async () => {
  const { api, requests } = fixture([main(88, { version: '3.0.498' })]);
  api.store = { getState: () => ({ settings: { gameMode: { discovered: { [GAME]: { path: '/game' } } } } }) };
  const checks = createHealthChecks({ statAsync: async () => { throw Object.assign(new Error('Missing'), { code: 'ENOENT' }); } }, { opn: async () => {} });
  let finish;
  api.events.removeAllListeners('start-download');
  api.events.on('start-download', (...args) => { requests.push(args); finish = args[3]; });
  const Page = createHealthPage(checks, api);
  let view;
  try {
    await renderer.act(async () => { view = renderer.create(React.createElement(Page, { active: true })); });
    assert.equal(view.root.findByType('h2').children.join(''), 'Amalur Essentials');
    const action = view.root.findByProps({ 'aria-label': 'Download Save Editor with Vortex' });
    let pending;
    await renderer.act(async () => { pending = action.props.onClick(); });
    assert.equal(action.props.disabled, true);
    await renderer.act(async () => { await action.props.onClick(); });
    assert.equal(requests.length, 1);
    await renderer.act(async () => { finish(null, 'tool-download'); await pending; });
    assert.equal(action.props.disabled, false);
    assert.match(view.root.findAllByProps({ role: 'status' })[0].children.join(''), /Save Editor downloaded.*Extract/);
    assert.ok(view.root.findByProps({ 'aria-label': 'Open Save Editor page' }));
    assert.equal(view.root.findAllByType('article').length, 4);
  } finally { if (view) renderer.act(() => view.unmount()); }
});
