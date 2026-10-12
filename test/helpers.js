'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

class ProcessCanceled extends Error {
  constructor(message) { super(message); this.name = 'ProcessCanceled'; }
}

// Vortex is an Electron/Windows host, not an npm runtime dependency. Execute the
// actual entry point with only the host surface mocked; installer code is real.
function loadExtension(root = path.resolve(__dirname, '..'), helper) {
  const registration = { logs: [], notifications: [] };
  const api = {
    log: (level, message, metadata) => registration.logs.push({ level, message, metadata }),
    fs: {
      readFileAsync: fs.readFile,
      ensureDirWritableAsync: async (directory) => {
        await fs.mkdir(directory, { recursive: true });
        await fs.access(directory, 2);
      },
    },
    util: { ProcessCanceled, GameStoreHelper: helper },
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
      showErrorNotification: (title, error, options) => registration.notifications.push({ title, error, options }),
    },
    requireVersion: (range) => { registration.range = range; },
    registerGame: (game) => { registration.game = game; },
    registerInstaller: (id, priority, test, install) => {
      registration.installer = { id, priority, test, install };
    },
  };
  registration.loaded = sandbox.module.exports.default(context);
  return registration;
}

module.exports = { loadExtension };
