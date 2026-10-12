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

function duplicateExtensionRecords(state, info, extensionPath) {
  const normalize = (value) => /^[a-z]:[\\/]|^\\\\/i.test(value)
    ? path.win32.normalize(value).toLowerCase() : path.resolve(value);
  const installedPath = normalize(extensionPath);
  const records = Object.entries(state.app?.extensions || {}).filter(([, entry]) =>
    entry.infoJsonId === info.id && typeof entry.path === 'string'
    && normalize(entry.path) === installedPath);
  // Keep a live record for this exact installed version. If it cannot be
  // identified, leave state alone rather than guess which entry to retain.
  const current = records.find(([, entry]) => entry.version === info.version
    && entry.enabled !== false && entry.remove !== true);
  return current ? records.filter(([key]) => key !== current[0]).map(([key]) => key) : [];
}

async function downloadEssential(api, item) {
  if (typeof api.ext?.nexusGetModFiles !== 'function') {
    throw new Error('Nexus downloads are unavailable. Enable the Nexus integration in Vortex, or use the mod page link.');
  }
  if (typeof api.ext.ensureLoggedIn === 'function') await api.ext.ensureLoggedIn();
  const files = await api.ext.nexusGetModFiles(GAME_ID, item.modId);
  const candidates = (Array.isArray(files) ? files : []).filter((file) =>
    Number(file.category_id) === 1 && Number.isSafeInteger(Number(file.file_id)) && Number(file.file_id) > 0
    && (item.modId !== 8 || /^3\./.test(String(file.version))));
  if (candidates.length === 0) {
    throw new Error(`No suitable main file was found for ${item.name}. Use the mod page link to review its files.`);
  }
  const primary = candidates.filter((file) => file.is_primary === true);
  let file = primary.length === 1 ? primary[0] : candidates.length === 1 ? candidates[0] : undefined;
  if (!file) {
    const result = await api.showDialog('question', `Download ${item.name}`, {
      text: 'Choose the file to download with Vortex.',
      choices: candidates.map((candidate, index) => ({
        id: String(candidate.file_id), text: `${candidate.name || candidate.file_name || item.name} (${candidate.version || 'version unspecified'})`, value: index === 0,
      })),
    }, [{ label: 'Cancel' }, { label: 'Download' }]);
    if (result.action !== 'Download') return undefined;
    const selected = candidates.filter((candidate) => result.input?.[String(candidate.file_id)] === true);
    if (selected.length !== 1) throw new Error('Select one file to download.');
    file = selected[0];
  }
  const url = `nxm://${GAME_ID}/mods/${item.modId}/files/${file.file_id}`;
  // Let Vortex handle membership, author permissions, website authorization for
  // free accounts, and download metadata. Tools must never be installed as mods.
  return new Promise((resolve, reject) => {
    const handled = api.events.emit('start-download', [url], {
      game: GAME_ID, name: item.name, modId: item.modId, fileId: Number(file.file_id),
    }, undefined, (error, downloadId) => {
      if (error) reject(error);
      else if (!downloadId) reject(new Error('Vortex did not return a download ID.'));
      else resolve(downloadId);
    }, undefined, { allowInstall: false });
    if (!handled) reject(new Error('Vortex download manager is unavailable. Use the mod page link.'));
  });
}

module.exports = { withFrameworkRequirement, saveEditorTool, duplicateExtensionRecords, downloadEssential };
