'use strict';

const fs = require('fs').promises;
const path = require('path');
const { randomBytes } = require('crypto');
const { readEntries } = require('./installer');
const { downloadEssential } = require('./integration');
const GAME = 'kingdomsofamalurrereckoning';
const TOOL = 'amalur-save-editor';
const EXE = 'KoAR.SaveEditor.exe';

function isSaveEditorDownload(download) {
  const info = download?.modInfo || {};
  const modId = info.nexus?.ids?.modId ?? info['nexus.ids.modId'] ?? info.modId;
  return download?.state === 'finished' && download.game?.includes(GAME)
    && String(modId) === '8' && typeof download.localPath === 'string';
}

function findSaveEditorDownload(state) {
  return Object.entries(state.persistent?.downloads?.files || {})
    .filter(([, download]) => isSaveEditorDownload(download))
    .sort(([, a], [, b]) => Number(b.fileTime || 0) - Number(a.fileTime || 0))[0]?.[0];
}

function validateLayout(files) {
  const entries = readEntries(files);
  const seen = new Set();
  for (const entry of entries) {
    const key = entry.parts.join('/').toLowerCase();
    if (seen.has(key)) throw new Error('Save Editor archive contains duplicate paths.');
    seen.add(key);
  }
  const executables = entries.filter((entry) => !entry.directory && entry.parts.at(-1).toLowerCase() === EXE.toLowerCase());
  if (executables.length !== 1) throw new Error('Save Editor archive must contain exactly one KoAR.SaveEditor.exe.');
  const prefix = executables[0].parts.slice(0, -1);
  if (entries.some((entry) => !entry.directory && !prefix.every((part, index) => part.toLowerCase() === entry.parts[index]?.toLowerCase()))) {
    throw new Error('Save Editor archive contains files outside its application folder.');
  }
  return { prefix, executable: executables[0].parts.at(-1) };
}

async function inspectTree(directory, files = [], prefix = []) {
  for (const name of await fs.readdir(directory)) {
    const filename = path.join(directory, name);
    const stat = await fs.lstat(filename);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error('Save Editor archive contains a link or special file.');
    const parts = [...prefix, name];
    files.push(parts.join('/') + (stat.isDirectory() ? '/' : ''));
    if (stat.isDirectory()) await inspectTree(filename, files, parts);
  }
  return files;
}

async function optionalStat(filename) {
  try { return await fs.lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

function createSaveEditorActions(api, selectors, actions, util) {
  let pending;
  const install = async (downloadId) => {
    const state = api.store.getState();
    const download = state.persistent?.downloads?.files?.[downloadId];
    if (!isSaveEditorDownload(download)) throw new Error('Choose a completed Re-Reckoning Save Editor download in Vortex.');
    const gamePath = state.settings?.gameMode?.discovered?.[GAME]?.path;
    if (!gamePath) throw new Error('Select the Re-Reckoning game folder before installing Save Editor.');
    const info = download.modInfo || {};
    const fileId = info.nexus?.ids?.fileId ?? info['nexus.ids.fileId'] ?? info.fileId;
    // Verify the actual downloaded file, including downloads initiated on Nexus.
    // Do not infer remaster compatibility from the archive filename.
    if (typeof api.ext?.nexusGetModFiles !== 'function') throw new Error('Nexus integration is needed to verify the Save Editor version.');
    const files = await api.ext.nexusGetModFiles(GAME, 8);
    const file = files.find((candidate) => String(candidate.file_id) === String(fileId));
    if (!file || !/^3\./.test(String(file.version))) throw new Error('Only the remaster Save Editor 3.x can be installed here. Download its current main file.');
    if (typeof actions.addDiscoveredTool !== 'function' || typeof selectors.downloadPathForGame !== 'function' || typeof util?.SevenZip !== 'function') throw new Error('This Vortex version cannot install standalone tools.');
    const archiveEntry = readEntries([download.localPath])[0];
    if (archiveEntry.directory || archiveEntry.parts.length !== 1) throw new Error('The Save Editor download has an invalid archive filename.');
    const archivePath = path.join(selectors.downloadPathForGame(state, GAME), download.localPath);
    const archive = new util.SevenZip();
    const listed = [];
    await archive.list(archivePath, { ssc: false }, (entries) => {
      for (const entry of entries) listed.push(entry.name.replace(/\\/g, '/') + (entry.attr?.includes('D') && !/[\\/]$/.test(entry.name) ? '/' : ''));
    });
    validateLayout(listed);
    const tools = path.join(gamePath, 'tools');
    const toolsStat = await optionalStat(tools);
    if (toolsStat && (!toolsStat.isDirectory() || toolsStat.isSymbolicLink())) throw new Error('The game tools folder must be a regular directory.');
    await fs.mkdir(tools, { recursive: true });
    const target = path.join(tools, 'KoAR.SaveEditor');
    const targetStat = await optionalStat(target);
    if (targetStat && (!targetStat.isDirectory() || targetStat.isSymbolicLink())) throw new Error('The existing Save Editor folder must be a regular directory.');
    const stage = await fs.mkdtemp(path.join(tools, '.KoAR.SaveEditor-install-'));
    let backup;
    try {
      const result = await archive.extractFull(archivePath, stage, { ssc: false });
      if ((result?.code ?? 0) !== 0 || result?.errors?.length > 0) throw new Error(`Save Editor extraction failed: ${result?.errors?.join('; ') || result?.code}.`);
      const actual = await inspectTree(stage);
      const expectedFiles = listed.filter((name) => !name.endsWith('/')).map((name) => name.toLowerCase()).sort();
      const actualFiles = actual.filter((name) => !name.endsWith('/')).map((name) => name.toLowerCase()).sort();
      if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) throw new Error('Save Editor extraction did not produce the complete archive.');
      const layout = validateLayout(actual);
      const application = path.join(stage, ...layout.prefix);
      const exeStat = await fs.stat(path.join(application, layout.executable));
      if (exeStat.size === 0) throw new Error('The Save Editor executable is empty.');
      if (targetStat) {
        backup = path.join(tools, `.KoAR.SaveEditor-backup-${randomBytes(8).toString('hex')}`);
        await fs.rename(target, backup);
      }
      try { await fs.rename(application, target); }
      catch (error) {
        if (backup) {
          try { await fs.rename(backup, target); }
          catch (restoreError) { throw new Error(`Save Editor installation failed and could not restore its folder. The previous installation remains at ${backup}: ${restoreError.message}`); }
        }
        throw error;
      }
      const old = state.settings.gameMode.discovered[GAME].tools?.[TOOL] || {};
      api.store.dispatch(actions.addDiscoveredTool(GAME, TOOL, {
        ...old, id: TOOL, name: 'Amalur Save Editor (optional)',
        path: path.join(target, layout.executable), workingDirectory: target,
        requiredFiles: [EXE], hidden: false, custom: false, exclusive: true,
      }, false));
      if (typeof actions.setToolVisible === 'function') api.store.dispatch(actions.setToolVisible(GAME, TOOL, true));
      api.events.emit('amalur-health-refresh');
      return { path: target, backup };
    } finally {
      await fs.rm(stage, { recursive: true, force: true });
      // An update's old folder remains as a backup, including user configuration.
      // It is never deleted as part of installation or profile changes.
    }
  };
  const installDownloaded = (id) => {
    if (!pending) pending = install(id).finally(() => { pending = undefined; });
    return pending;
  };
  return {
    installDownloaded,
    downloadAndInstall: async () => {
      const id = await downloadEssential(api, { name: 'Save Editor', modId: 8 });
      if (!id) return undefined;
      await installDownloaded(id);
      return id;
    },
  };
}

module.exports = { createSaveEditorActions, findSaveEditorDownload, validateLayout };
