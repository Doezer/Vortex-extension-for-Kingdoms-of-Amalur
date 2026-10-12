'use strict';

const path = require('path');
const GAME_ID = 'kingdomsofamalurrereckoning';
const MOD_PAGE = `https://www.nexusmods.com/${GAME_ID}/mods/`;
const SAVE_EDITOR_EXE = 'KoAR.SaveEditor.exe';

function withFrameworkRequirement(result) {
  const files = result.instructions.filter((instruction) => instruction.type === 'copy')
    .map((instruction) => instruction.destination.replace(/\\/g, '/').toLowerCase());
  const containsFramework = files.includes('dinput8.dll') && files.includes('re_mod.dll');
  if (containsFramework || !files.some((file) => file.startsWith('mods/'))) return result;
  return {
    instructions: [...result.instructions, {
      type: 'rule',
      rule: {
        type: 'requires',
        reference: {
          gameId: GAME_ID,
          description: 'Mod Framework',
          versionMatch: '>=1.4.0',
          repo: { repository: 'nexus', gameId: GAME_ID, modId: '9', fileId: '39' },
        },
        extra: { name: 'Mod Framework', url: MOD_PAGE + '9' },
      },
    }],
  };
}

function saveEditorDirectory(gamePath) {
  return path.join(gamePath, 'tools', 'KoAR.SaveEditor');
}

function saveEditorTool(api, fs) {
  return {
    id: 'amalur-save-editor',
    name: 'Amalur Save Editor (optional)',
    executable: () => SAVE_EDITOR_EXE,
    requiredFiles: [SAVE_EDITOR_EXE],
    relative: false,
    exclusive: true,
    defaultPrimary: false,
    queryPath: async () => {
      const state = api.store.getState();
      const gamePath = state.settings?.gameMode?.discovered?.[GAME_ID]?.path;
      if (!gamePath) return undefined;
      const directory = saveEditorDirectory(gamePath);
      try {
        const stat = await fs.statAsync(path.join(directory, SAVE_EDITOR_EXE));
        return stat.isFile() ? directory : undefined;
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
  };
}

async function showSetupSuggestions(api, fs, util, discovery) {
  const action = (title, modId) => ({ title, action: () => util.opn(MOD_PAGE + modId) });
  const present = await Promise.all(['dinput8.dll', 're_mod.dll'].map(async (filename) => {
    try { return (await fs.statAsync(path.join(discovery.path, filename))).isFile(); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }));
  if (!present.every(Boolean)) {
    api.sendNotification({
      id: 'amalur-mod-framework-required',
      type: 'info',
      title: 'Set up Amalur Mod Framework',
      message: 'Script mods require Mod Framework (Nexus mod 9). Install and enable it through Vortex; framework mods declare it as a required dependency.',
      allowSuppress: true,
      actions: [action('Get Mod Framework', '9')],
    });
  } else {
    api.dismissNotification('amalur-mod-framework-required');
  }
  const state = api.store.getState();
  const configured = state.settings?.gameMode?.discovered?.[GAME_ID]?.tools?.['amalur-save-editor'];
  if (!configured?.path) {
    api.sendNotification({
      id: 'amalur-save-editor-suggestion',
      type: 'info',
      title: 'Optional: Amalur Save Editor',
      message: 'Download the remaster 3.x save editor separately. Extract it into tools/KoAR.SaveEditor in your game folder, or set its executable through Dashboard > Tools. It is not a runtime requirement.',
      allowSuppress: true,
      actions: [action('Get Save Editor', '8')],
    });
  }
  api.sendNotification({
    id: 'amalur-recommended-mods',
    type: 'info',
    title: 'Optional Amalur mods',
    message: 'F2 Console adds an in-game console; No Logos skips intro logos. Neither is a prerequisite. F2 Console itself requires Mod Framework.',
    allowSuppress: true,
    actions: [action('F2 Console', '14'), action('No Logos', '4')],
  });
}

module.exports = { withFrameworkRequirement, saveEditorTool, showSetupSuggestions };
