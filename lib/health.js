'use strict';

const path = require('path');
const { downloadEssential } = require('./integration');
const GAME = 'kingdomsofamalurrereckoning';
const BASE_URL = `https://www.nexusmods.com/${GAME}/mods/`;
const TRIGGERS = ['startup', 'game-changed', 'profile-changed', 'mods-changed', 'manual'];

function createHealthChecks(fs, util) {
  function definition(id, name, modId, optional, category, inspect) {
    return {
      id: `amalur-health-${id}`,
      gameId: GAME,
      name,
      description: optional ? `Optional: ${name}.` : 'Required runtime for framework-based mods.',
      category,
      severity: optional ? 'info' : 'error',
      triggers: TRIGGERS,
      cacheDuration: 0,
      timeout: 5000,
      optional,
      modId,
      download: (api) => downloadEssential(api, { name, modId }),
      check: async (api) => {
        const started = Date.now();
        const state = api.store.getState();
        const discovery = state.settings?.gameMode?.discovered?.[GAME];
        let result;
        try {
          result = discovery?.path
            ? await inspect(state, discovery)
            : { status: 'warning', message: 'Select the Re-Reckoning game folder to run this check.' };
        } catch (error) {
          result = {
            status: 'error',
            message: `Cannot check ${name}.`,
            details: `${error.code || error.name}: ${error.message}`,
          };
        }
        return {
          ...result,
          checkId: `amalur-health-${id}`,
          severity: result.status === 'passed' ? 'info' : optional ? 'info' : 'error',
          executionTime: Date.now() - started,
          timestamp: new Date(),
        };
      },
      // Open the author page; this is not an automatic filesystem repair.
      fix: () => util.opn(BASE_URL + modId),
    };
  }

  async function filePresent(filename) {
    try {
      const stat = await fs.statAsync(filename);
      return stat.isFile() && stat.size > 0;
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
      throw error;
    }
  }

  function managedMod(state, modId) {
    return Object.values(state.persistent?.mods?.[GAME] || {})
      .find((mod) => String(mod.attributes?.modId) === String(modId) && mod.attributes?.source === 'nexus' && mod.state === 'installed');
  }

  function enabled(state, mod) {
    const profileId = state.settings?.profiles?.activeProfileId;
    const profile = state.persistent?.profiles?.[profileId];
    return profile?.gameId === GAME && profile.modState?.[mod.id]?.enabled === true;
  }

  const framework = definition('framework', 'Mod Framework', 9, false, 'requirements', async (state, discovery) => {
    const missing = [];
    for (const filename of ['dinput8.dll', 're_mod.dll']) {
      if (!await filePresent(path.join(discovery.path, filename))) missing.push(filename);
    }
    const mod = managedMod(state, 9);
    if (mod && !enabled(state, mod)) return {
      status: 'failed', message: 'Mod Framework is installed but disabled in this profile.',
      details: 'Enable Mod Framework in Vortex, deploy your mods, then refresh this check.',
    };
    if (missing.length) return {
      status: 'failed', message: 'Mod Framework is missing or incompletely deployed.',
      details: `Missing, empty, or invalid files: ${missing.join(', ')}. Install Mod Framework (Nexus mod 9), enable it, and deploy. A different dinput8 loader alone does not satisfy this check.`,
    };
    const version = mod?.attributes?.version || mod?.attributes?.modVersion;
    const match = typeof version === 'string' && version.match(/(\d+)\.(\d+)/);
    if (match && (Number(match[1]) < 1 || (Number(match[1]) === 1 && Number(match[2]) < 4))) return {
      status: 'failed', message: 'Mod Framework 1.4 or newer is required.',
      details: `Vortex reports version ${version}. Update Mod Framework, deploy, then refresh.`,
    };
    return {
      status: 'passed', message: 'Mod Framework runtime files are present.',
      details: 'Both DLLs are present and nonempty. This checks installation and managed profile state; it does not execute the DLLs or verify in-game compatibility.',
    };
  });

  const editor = definition('save-editor', 'Save Editor', 8, true, 'tools', async (_state, discovery) => {
    const configured = discovery.tools?.['amalur-save-editor']?.path;
    const filename = configured || path.join(discovery.path, 'tools', 'KoAR.SaveEditor', 'KoAR.SaveEditor.exe');
    return await filePresent(filename)
      ? { status: 'passed', message: 'Save Editor is available.', details: 'Optional standalone tool; it is not a prerequisite for mods.' }
      : {
        status: 'warning', message: 'Optional: install or configure Save Editor.',
        details: 'Download the remaster 3.x release separately. Extract it to tools/KoAR.SaveEditor below the game folder, or select KoAR.SaveEditor.exe through Dashboard > Tools. This tool is optional.',
      };
  });

  const recommendation = (id, name, modId, description) => definition(id, name, modId, true, 'mods', async (state) => {
    const mod = managedMod(state, modId);
    return mod && enabled(state, mod)
      ? { status: 'passed', message: `${name} is enabled.`, details: description }
      : { status: 'warning', message: `Optional: ${mod ? 'enable' : 'install'} ${name}.`, details: `${description} It is not a prerequisite. Manually installed copies are not identified by this managed-mod check.` };
  });
  return [
    framework,
    editor,
    recommendation('f2-console', 'F2 Console', 14, 'Adds an in-game Lua console and itself requires Mod Framework.'),
    recommendation('no-logos', 'No Logos', 4, 'Skips the intro logos.'),
  ];
}

async function runHealthChecks(checks, api) {
  return Promise.all(checks.map(async (check) => ({ check, result: await check.check(api) })));
}

module.exports = { createHealthChecks, runHealthChecks };
