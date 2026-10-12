'use strict';

const path = require('path');
const { fs, util, log, selectors } = require('vortex-api');
const { planInstall, isFomod, readEntries } = require('./lib/installer');
const { findGame } = require('./lib/discovery');
const { withFrameworkRequirement, saveEditorTool } = require('./lib/integration');
const { createHealthChecks } = require('./lib/health');
const { createHealthPage } = require('./lib/healthPage');
const info = require('./info.json');

const GAME_ID = 'kingdomsofamalurrereckoning';

function main(context) {
  context.requireVersion('>=1.9.0');
  const checks = createHealthChecks(fs, util);
  for (const check of checks) context.optional.registerHealthCheck(check);
  context.registerMainPage('health-check', 'Amalur health checks', createHealthPage(checks, context.api), {
    id: 'amalur-health-checks',
    group: 'per-game',
    priority: 61,
    visible: () => selectors.activeGameId(context.api.store.getState()) === GAME_ID,
  });
  context.once(() => {
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
  return true;
}

module.exports = { default: main };
