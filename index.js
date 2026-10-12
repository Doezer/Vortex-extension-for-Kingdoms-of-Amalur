'use strict';

const path = require('path');
const { fs, util, log, selectors, MainPage, actions } = require('vortex-api');
const { planInstall, isFomod, readEntries } = require('./lib/installer');
const { findGame } = require('./lib/discovery');
const { withFrameworkRequirement, saveEditorTool, duplicateExtensionRecords } = require('./lib/integration');
const { createHealthChecks } = require('./lib/health');
const { createHealthPage } = require('./lib/healthPage');
const { createSaveEditorActions } = require('./lib/saveEditor');
const info = require('./info.json');

const GAME_ID = 'kingdomsofamalurrereckoning';
// Vortex can retain multiple extension records pointing at this same module
// after ZIP upgrades. Its require cache is shared, but it calls main per record.
let initialized = false;

function main(context) {
  if (initialized) return true;
  context.requireVersion('>=1.9.0');
  const checks = createHealthChecks(fs, util, createSaveEditorActions(context.api, selectors, actions, util));
  for (const check of checks) context.optional.registerHealthCheck(check);
  context.registerMainPage('health-check', 'Amalur Essentials', createHealthPage(checks, context.api, MainPage), {
    id: 'amalur-health-checks',
    group: 'per-game',
    priority: 61,
    visible: () => context.api.store !== undefined && selectors.activeGameId(context.api.store.getState()) === GAME_ID,
  });
  context.once(() => {
    // Drag-and-drop installs get random saved-state keys even when info.id and
    // the destination folder are stable. Forget only redundant records; the
    // removeExtension action would also schedule deletion of our shared folder.
    if (typeof actions?.forgetExtension === 'function') {
      const duplicates = duplicateExtensionRecords(context.api.store.getState(), info, __dirname);
      for (const key of duplicates) context.api.store.dispatch(actions.forgetExtension(key));
      if (duplicates.length > 0) log('info', '[amalur] Cleared duplicate extension records', { count: duplicates.length });
    }
    for (const id of ['amalur-mod-framework-required', 'amalur-save-editor-suggestion', 'amalur-recommended-mods']) context.api.dismissNotification(id);
    const refresh = () => { context.api.events.emit('amalur-health-refresh'); };
    for (const event of ['gamemode-activated', 'profile-did-change', 'did-install-mod', 'mod-enabled', 'mod-disabled', 'did-remove-mod']) context.api.events.on(event, refresh);
    for (const event of ['did-deploy', 'did-purge']) context.api.onAsync(event, async () => { refresh(); });
  });
  context.registerGame({
    id: GAME_ID,
    name: 'Kingdoms of Amalur: Re-Reckoning',
    shortName: 'KOA: RR',
    logo: 'gameart.svg',
    executable: () => 'koa.exe',
    requiredFiles: ['koa.exe', path.join('data', 'initial_0.pak')],
    queryPath: () => findGame(util.GameStoreHelper),
    requiresLauncher: (gamePath, store) => Promise.resolve(
      store === 'steam' ? { launcher: 'steam' }
        : store === 'epic' ? { launcher: 'epic', addInfo: 'b8aa8afb7da84da3a978425ec4b8e5cd' }
          : undefined,
    ),
    queryModPath: () => '.',
    mergeMods: true,
    contributed: 'Doezer',
    final: false,
    version: info.version,
    supportedTools: [saveEditorTool(context.api, fs)],
    details: {
      steamAppId: 1041720,
      gogAppId: '1077045575',
      nexusPageId: GAME_ID,
      stopPatterns: ['(^|/)data/', '(^|/)mods/', '(^|/)reshade-shaders/', '\\.(pak|dll|ini)$'],
    },
    // Do not patch game archives or launch external tools during activation.
    setup: (discovery) => fs.ensureDirWritableAsync(discovery.path, () => Promise.resolve()),
  });

  context.registerInstaller(
    `${GAME_ID}-content`,
    25,
    async (files, gameId) => ({
      // Claim unknown packages too: letting the generic installer handle them
      // could put saves, tools, or variant directories in the game root.
      supported: gameId === GAME_ID && !isFomod(files),
      requiredFiles: [],
    }),
    async (files, destinationPath, gameId) => {
      if (gameId !== GAME_ID) {
        throw new util.ProcessCanceled('This installer only supports Kingdoms of Amalur: Re-Reckoning.');
      }
      try {
        const result = await planInstall(files, async (source) => {
          const entry = readEntries([source])[0];
          return fs.readFileAsync(path.join(destinationPath, ...entry.parts), 'utf8');
        });
        return withFrameworkRequirement(result);
      } catch (error) {
        if (error.name === 'ArchiveLayoutError') {
          log('warn', '[amalur] Mod archive rejected', { reason: error.message });
          context.api.showErrorNotification('Cannot install this Amalur mod', error, { allowReport: false });
          throw new util.ProcessCanceled(error.message);
        }
        throw error;
      }
    },
  );
  initialized = true;
  return true;
}

module.exports = { default: main };
