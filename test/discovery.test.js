'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { findGame, STORE_IDS } = require('../lib/discovery');

const miss = () => Object.assign(new Error('Game entry not found'), { name: 'GameEntryNotFound' });
for (const [store, id] of STORE_IDS) {
  test(`discover ${store} using its exact remaster ID`, async () => {
    const calls = [];
    const helper = { findByAppId: async (appId, storeId) => {
      calls.push([storeId, appId]);
      if (storeId !== store) throw miss();
      assert.equal(appId, id);
      return { gamePath: '/game' };
    } };
    assert.equal(await findGame(helper), '/game');
    assert.equal(calls.at(-1)[0], store);
    assert.ok(calls.every(([, appId]) => appId !== '102500'));
  });
}
test('all-store miss allows Vortex manual discovery', async () => {
  await assert.rejects(findGame({ findByAppId: async () => { throw miss(); } }), { name: 'GameEntryNotFound' });
});
test('do not swallow store permission failures', async () => {
  const failure = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
  await assert.rejects(findGame({ findByAppId: async () => { throw failure; } }), (error) => error === failure);
});
test('do not accept malformed store entries', async () => {
  await assert.rejects(findGame({ findByAppId: async () => ({}) }), /Select the folder/);
});
