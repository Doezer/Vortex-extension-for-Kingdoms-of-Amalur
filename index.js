'use strict';

const path = require('path');
const { fs, util } = require('vortex-api');
const { planInstall, isFomod, readEntries } = require('./lib/installer');
const { findGame } = require('./lib/discovery');
const info = require('./info.json');

const GAME_ID = 'kingdomsofamalurrereckoning';

function main(context) {
  context.requireVersion('>=1.9.0');
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
        return await planInstall(files, async (source) => {
          const entry = readEntries([source])[0];
          return fs.readFileAsync(path.join(destinationPath, ...entry.parts), 'utf8');
        });
      } catch (error) {
        if (error.name === 'ArchiveLayoutError') {
          throw new util.ProcessCanceled(error.message);
        }
        throw error;
      }
    },
  );
  return true;
}

module.exports = { default: main };
