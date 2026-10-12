'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');

class ProcessCanceled extends Error {
  constructor(message) { super(message); this.name = 'ProcessCanceled'; }
}

// Vortex is an Electron/Windows host, not an npm runtime dependency. Execute the
// actual entry point with only the host surface mocked; installer code is real.
function loadExtension(root = path.resolve(__dirname, '..'), helper) {
  const registration = { logs: [], notifications: [], dismissed: [], opened: [], checks: [], pages: [], games: [], installers: [], asyncHandlers: {}, state: { settings: { gameMode: { discovered: {} } } } };
  const api = {
    log: (level, message, metadata) => registration.logs.push({ level, message, metadata }),
    selectors: { activeGameId: (state) => state.settings?.gameMode?.activeGameId },
    fs: {
      statAsync: fs.stat,
      readFileAsync: fs.readFile,
      ensureDirWritableAsync: async (directory) => {
        await fs.mkdir(directory, { recursive: true });
        await fs.access(directory, 2);
      },
    },
    util: { ProcessCanceled, GameStoreHelper: helper, opn: async (url) => { registration.opened.push(url); } },
    actions: { forgetExtension: (key) => ({ type: 'FORGET_EXTENSION', payload: key }) },
  };
  const filename = path.join(root, 'index.js');
  const localRequire = createRequire(filename);
  const sandbox = {
    module: { exports: {} },
    require: (id) => id === 'vortex-api' ? api : localRequire(id),
    __dirname: root,
  };
  vm.runInNewContext(require('node:fs').readFileSync(filename, 'utf8'), sandbox, { filename });
  const context = {
    api: {
      events: new EventEmitter(),
      onAsync: (event, handler) => { registration.asyncHandlers[event] = handler; },
      store: { getState: () => registration.state, dispatch: (action) => {
        if (action.type === 'FORGET_EXTENSION') delete registration.state.app.extensions[action.payload];
      } },
      sendNotification: (notification) => registration.notifications.push(notification),
      dismissNotification: (id) => registration.dismissed.push(id),
      showErrorNotification: (title, error, options) => registration.notifications.push({ title, error, options }),
    },
    requireVersion: (range) => { registration.range = range; },
    optional: { registerHealthCheck: (check) => registration.checks.push(check) },
    registerMainPage: (icon, title, component, options) => { registration.page = { icon, title, component, options }; registration.pages.push(registration.page); },
    once: (callback) => { registration.startup = callback; callback(); },
    registerGame: (game) => { registration.game = game; registration.games.push(game); },
    registerInstaller: (id, priority, test, install) => {
      registration.installer = { id, priority, test, install };
      registration.installers.push(registration.installer);
    },
  };
  registration.loaded = sandbox.module.exports.default(context);
  registration.api = context.api;
  registration.initializeAgain = () => sandbox.module.exports.default({ ...context });
  return registration;
}

module.exports = { loadExtension };
