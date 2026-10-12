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

module.exports = { withFrameworkRequirement, saveEditorTool };
