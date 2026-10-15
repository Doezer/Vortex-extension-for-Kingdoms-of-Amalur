'use strict';

const path = require('path');

const ROOT_FOLDERS = new Set(['data', 'mods', 'reshade-shaders']);
const ROOT_DLLS = new Set(['dinput8.dll', 're_mod.dll', 'dxgi.dll', 'd3d11.dll', 'd3d9.dll']);
const MANUAL_EXTENSIONS = new Set(['.exe', '.msi', '.bat', '.cmd', '.ps1', '.sh', '.ct', '.sav']);
const DOCUMENT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.rst', '.rtf', '.pdf', '.htm', '.html', '.nfo', '.url', '.webloc']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);
const HELP = 'See README for supported layouts. Select one variant and repackage it, or follow the mod author\'s manual instructions.';

class ArchiveLayoutError extends Error {
  constructor(message) {
    super(`${message} ${HELP}`);
    this.name = 'ArchiveLayoutError';
  }
}

function readEntries(files) {
  return files.map((source) => {
    if (typeof source !== 'string' || !source || /^[\\/]/.test(source)) {
      throw new ArchiveLayoutError('The archive contains an empty or absolute path.');
    }
    const directory = /[\\/]$/.test(source);
    const normalized = source.replace(/\\/g, '/').replace(/\/$/, '');
    const parts = normalized.split('/');
    for (const part of parts) {
      if (!part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f\x7f]/.test(part)
          || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) {
        throw new ArchiveLayoutError(`Unsafe or Windows-incompatible archive path: ${source}.`);
      }
    }
    return { source, parts, directory };
  });
}

function isFomod(files) {
  return files.some((file) => typeof file === 'string'
    && /(^|[\\/])fomod[\\/]moduleconfig\.xml$/i.test(file));
}

function isDocumentation(entry, runtimeRoots) {
  const filename = entry.parts.at(-1);
  const folders = entry.parts.slice(0, -1).map((part) => part.toLowerCase());
  if (folders.some((part) => ['__macosx', '.git'].includes(part))
      || /^\._/.test(filename) || filename.toLowerCase() === '.ds_store') return true;
  // Explicit payload paths take precedence over documentation-looking names.
  if (folders.some((part) => ROOT_FOLDERS.has(part))) return false;
  if (folders.some((part) => ['docs', 'documentation', 'screenshots'].includes(part))) return true;
  const labelledDocument = /(?:^|[ ._-])(readme|changelog|changes|license|licence|credits|install(?:ation)?|instructions?|tutorial|how[ _-]?to)(?:[ ._-]|$)/i.test(filename)
    && /\.(md|txt|rst|pdf|html?)$/i.test(filename);
  const labelledImage = /(?:^|[ ._-])(tutorial|instructions|installation|how[ _-]?to|screenshots?|preview)(?:[ ._-]|$)/i.test(filename)
    && /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename)
    && !entry.parts.slice(0, -1).some((part) => ROOT_FOLDERS.has(part.toLowerCase()));
  if (labelledDocument
    || labelledImage
    || /^(readme|changelog|changes|license|licence|credits)$/i.test(filename)) return true;
  // Root DLL packages can load companion text/image resources. Keep their
  // runtime tree, while allowing unrelated documents outside the wrapper.
  if (runtimeRoots.some((root) => hasPrefix(entry.parts, root))) return false;
  const extension = path.posix.extname(filename).toLowerCase();
  return DOCUMENT_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension);
}

function commonParent(entries) {
  const prefix = entries[0].parts.slice(0, -1);
  for (const entry of entries.slice(1)) {
    let length = 0;
    while (length < prefix.length && length < entry.parts.length - 1
        && prefix[length].toLowerCase() === entry.parts[length].toLowerCase()) length += 1;
    prefix.length = length;
  }
  return prefix;
}

function sameParts(left, right) {
  return left.length === right.length && left.every((part, i) => part.toLowerCase() === right[i].toLowerCase());
}

function hasPrefix(parts, prefix) {
  return parts.length > prefix.length && sameParts(parts.slice(0, prefix.length), prefix);
}

async function planInstall(files, readText, options = {}) {
  const validated = readEntries(files).filter((entry) => !entry.directory);
  const runtimeRoots = validated.filter((entry) => ROOT_DLLS.has(entry.parts.at(-1).toLowerCase())
    || entry.parts.at(-1).toLowerCase() === 'reshade.ini').map((entry) => entry.parts.slice(0, -1));
  let entries = validated.filter((entry) => !isDocumentation(entry, runtimeRoots));
  const scriptTargets = new Map();
  let optionalRoots = [];
  if (entries.length === 0) throw new ArchiveLayoutError('The archive contains no installable mod files.');
  if (isFomod(files)) throw new ArchiveLayoutError('Scripted FOMOD packages must use Vortex\'s FOMOD installer.');
  for (const entry of entries) {
    const extension = path.posix.extname(entry.parts.at(-1)).toLowerCase();
    if (MANUAL_EXTENSIONS.has(extension) || /^\d+\.\d+$/.test(entry.parts.at(-1))) {
      throw new ArchiveLayoutError(`This package contains a tool, executable, or save (${entry.source}) requiring manual installation.`);
    }
  }

  const roots = [];
  for (const entry of entries) {
    const folder = entry.parts.slice(0, -1).findIndex((part) => ROOT_FOLDERS.has(part.toLowerCase()));
    if (folder !== -1) roots.push(entry.parts.slice(0, folder));
    else if (ROOT_DLLS.has(entry.parts.at(-1).toLowerCase())
        || entry.parts.at(-1).toLowerCase() === 'reshade.ini'
        || /\.pak$/i.test(entry.parts.at(-1))) roots.push(entry.parts.slice(0, -1));
  }

  let prefix;
  let mode;
  if (roots.length) {
    prefix = roots.reduce((shortest, root) => root.length < shortest.length ? root : shortest);
    if (roots.some((root) => !sameParts(root, prefix))) {
      const extraRoots = roots.filter((root) => !sameParts(root, prefix));
      if (extraRoots.some((root) => !hasPrefix(root, prefix) || !/^optional(?:[ _-]|$)/i.test(root[prefix.length]))) {
        throw new ArchiveLayoutError('The archive contains multiple mod roots or optional variants; installing all of them would be ambiguous.');
      }
      optionalRoots = extraRoots.filter((root, index) => extraRoots.findIndex((other) => sameParts(root, other)) === index);
      if (optionalRoots.some((root) => optionalRoots.some((other) => hasPrefix(root, other)))) {
        throw new ArchiveLayoutError('Nested optional variants are ambiguous; select one variant and repackage it.');
      }
      const groups = optionalRoots.map((root, index) => ({ id: String(index), name: root.slice(prefix.length).join(' / ') }));
      const selected = options.chooseOptionalFolders ? await options.chooseOptionalFolders(groups) : [];
      if (!Array.isArray(selected) || selected.some((id) => !groups.some((group) => group.id === id))) throw new ArchiveLayoutError('Invalid optional component selection.');
      entries = entries.filter((entry) => {
        const index = optionalRoots.findIndex((root) => hasPrefix(entry.parts, root));
        return index === -1 || selected.includes(String(index));
      });
    }
    mode = 'layout';
  } else {
    prefix = commonParent(entries);
    const extensions = entries.map((entry) => path.posix.extname(entry.parts.at(-1)).toLowerCase());
    if (extensions.every((extension) => ['.json', '.lua'].includes(extension))) mode = 'scripts';
    else if (extensions.every((extension) => extension === '.ini')) mode = 'preset';
    else throw new ArchiveLayoutError('Unrecognized mod layout. Loose PAKs, data/, mods/, framework loaders, and ReShade presets are supported.');
  }

  if (entries.some((entry) => !hasPrefix(entry.parts, prefix))) {
    throw new ArchiveLayoutError('Files outside the selected mod root may be alternatives or require a different installation location.');
  }

  // Bare JSON could be an unrelated tool configuration. Check the published
  // Mod Framework's manifest keys instead of blindly routing every JSON to mods/.
  if (mode === 'scripts') {
    for (const entry of entries.filter((file) => /\.json$/i.test(file.source))) {
      let manifest;
      try { manifest = JSON.parse((await readText(entry.source)).replace(/^\uFEFF/, '')); }
      catch (error) {
        if (error instanceof SyntaxError) throw new ArchiveLayoutError(`Invalid framework JSON: ${entry.source}.`);
        throw error;
      }
      if (!manifest || typeof manifest !== 'object'
          || !['scripts', 'patches'].some((key) => Array.isArray(manifest[key]))
          || ['scripts', 'patches'].some((key) => manifest[key] !== undefined && !Array.isArray(manifest[key]))) {
        throw new ArchiveLayoutError(`${entry.source} is not a recognized Mod Framework manifest. Put verified framework payloads in an explicit mods/ folder.`);
      }
      for (const script of manifest.scripts || []) {
        if (!script || typeof script.path !== 'string' || typeof script.trigger !== 'string') {
          throw new ArchiveLayoutError(`Invalid script reference in ${entry.source}.`);
        }
        // Framework manifests commonly use .\\mods\\... relative to koa.exe.
        // Accept that harmless leading prefix, but keep traversal checks intact.
        const reference = readEntries([script.path.replace(/^(?:\.[\\/])+/, '')])[0];
        if (reference.directory || !/\.lua$/i.test(reference.parts.at(-1))) {
          throw new ArchiveLayoutError(`Unsupported script reference in ${entry.source}: ${script.path}.`);
        }
        // luaL_loadfile resolves against the game directory. Route a bundled
        // script to the manifest's declared location, without rewriting JSON.
        const lua = entries.filter((file) => /\.lua$/i.test(file.source));
        let matches = lua.filter((file) => {
          const relative = file.parts.slice(prefix.length);
          return sameParts(relative, reference.parts)
            || sameParts(['mods', ...relative], reference.parts);
        });
        if (!matches.length) matches = lua.filter((file) => file.parts.at(-1).toLowerCase() === reference.parts.at(-1).toLowerCase());
        if (matches.length > 1) {
          throw new ArchiveLayoutError(`More than one bundled script could satisfy ${script.path}.`);
        }
        if (matches.length === 1) {
          const previous = scriptTargets.get(matches[0].source);
          if (previous && !sameParts(previous, reference.parts)) {
            throw new ArchiveLayoutError(`One script is referenced at multiple locations: ${matches[0].source}. Use an explicit game-relative package.`);
          }
          scriptTargets.set(matches[0].source, reference.parts);
        }
        // An absent script may be provided by a separate dependency; do not
        // download it or rewrite its reference as part of installing this mod.
      }
    }
    // The framework scans JSON/DLL entries directly in mods/, not recursively.
    if (entries.some((entry) => /\.json$/i.test(entry.source) && entry.parts.length !== prefix.length + 1)) {
      throw new ArchiveLayoutError('Framework manifests must be directly inside mods/, not in nested variant folders.');
    }
  }

  if (mode === 'preset') {
    if (entries.some((entry) => entry.parts.length !== prefix.length + 1)) {
      throw new ArchiveLayoutError('ReShade presets in multiple subfolders may be optional variants.');
    }
    for (const entry of entries) {
      const content = await readText(entry.source);
      if (!/^\s*(Techniques|TechniqueSorting|PreprocessorDefinitions)\s*=/mi.test(content)) {
        throw new ArchiveLayoutError(`${entry.source} is not a recognized ReShade preset. Do not deploy arbitrary INI configuration files.`);
      }
    }
  }

  const relative = entries.map((entry) => ({ entry, parts: entry.parts.slice(
    (optionalRoots.find((root) => hasPrefix(entry.parts, root)) || prefix).length,
  ) }));
  const rootRuntime = relative.some(({ parts }) => parts.length === 1
    && (ROOT_DLLS.has(parts[0].toLowerCase()) || parts[0].toLowerCase() === 'reshade.ini'));
  const frameworkLayout = relative.some(({ parts }) => parts[0].toLowerCase() === 'mods');
  const destinations = new Set();
  const instructions = relative.map(({ entry, parts }) => {
    let output = parts.slice();
    const root = output[0].toLowerCase();
    if (mode === 'scripts') output = scriptTargets.get(entry.source) || ['mods', ...output];
    else if (mode === 'preset') { /* Preset filenames are kept unchanged. */ }
    else if (ROOT_FOLDERS.has(root)) output[0] = root;
    else if (frameworkLayout && root === 'scripts' && /\.lua$/i.test(output.at(-1))) output[0] = root;
    else if (output.length === 1 && /\.pak$/i.test(output[0])) output.unshift('data');
    else if (!rootRuntime) {
      throw new ArchiveLayoutError(`Cannot determine the deployment location for ${entry.source}. Put it in the author's intended game-relative folder.`);
    }

    if (output[0] === 'mods' && output.length > 2 && /\.(json|dll)$/i.test(output.at(-1))) {
      throw new ArchiveLayoutError(`The framework does not scan nested manifests or DLLs: ${entry.source}. Select one mod variant and put its manifest directly inside mods/.`);
    }
    const destination = path.join(...output);
    const key = destination.toLowerCase();
    if (destinations.has(key)) throw new ArchiveLayoutError(`Multiple files target ${destination}; choose one variant.`);
    if ([...destinations].some((existing) => existing.startsWith(key + path.sep) || key.startsWith(existing + path.sep))) {
      throw new ArchiveLayoutError(`A file and a directory target the same path: ${destination}.`);
    }
    destinations.add(key);
    return { type: 'copy', source: entry.source, destination };
  });
  // Vortex stages and deploys these instructions; never write to the game here.
  return { instructions };
}

module.exports = { planInstall, readEntries, isFomod, ArchiveLayoutError };
