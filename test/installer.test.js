'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { planInstall, isFomod } = require('../lib/installer');

const framework = JSON.stringify({ patches: [] });
const textFor = async (filename) => /\.json$/i.test(filename) ? framework : 'Techniques=AdaptiveSharpen\n';
const cases = [
  ['flat replacement PAK', ['patch_0.pak'], ['data/patch_0.pak']],
  ['multiple flat PAKs keep original names', ['patch_0.pak', 'initial_0.pak'], ['data/patch_0.pak', 'data/initial_0.pak']],
  ['wrapped PAK and documentation', ['Clean Menu/patch_0.pak', 'Clean Menu/README.txt'], ['data/patch_0.pak']],
  ['explicit data folder', ['data/patch_0.pak'], ['data/patch_0.pak']],
  ['game folder wrapper', ['Kingdoms of Amalur Re-Reckoning/data/patch_0.pak'], ['data/patch_0.pak']],
  ['No Logos video replacements', ['No Logos/data/videos/intro.bik', 'No Logos/data/videos/logo.bik'], ['data/videos/intro.bik', 'data/videos/logo.bik']],
  ['Windows separators', ['Package\\Data\\videos\\intro.bik', 'Package\\Data\\PATCH_0.PAK'], ['data/videos/intro.bik', 'data/PATCH_0.PAK']],
  ['mixed separators', ['Package\\data/videos\\intro.bik'], ['data/videos/intro.bik']],
  ['directory entries', ['data/', 'data/videos/', 'data/videos/logo.bik'], ['data/videos/logo.bik']],
  ['Mac metadata ignored', ['__MACOSX/._patch_0.pak', '.DS_Store', 'patch_0.pak'], ['data/patch_0.pak']],
  ['explicit framework manifest and scripts', ['mods/test.json', 'mods/test.lua'], ['mods/test.json', 'mods/test.lua']],
  ['flat framework manifest and script', ['test.json', 'test.lua'], ['mods/test.json', 'mods/test.lua']],
  ['wrapped loose framework content', ['Difficulty/test.json', 'Difficulty/scripts/test.lua'], ['mods/test.json', 'mods/scripts/test.lua']],
  ['standalone Lua console scripts', ['Gems.lua', 'Smith.lua'], ['mods/Gems.lua', 'mods/Smith.lua']],
  ['explicit framework DLL plugin', ['mods/console.dll'], ['mods/console.dll']],
  ['framework distribution', ['Release/dinput8.dll', 'Release/re_mod.dll', 'Release/mods/sample.json', 'Release/scripts/sample.lua'], ['dinput8.dll', 're_mod.dll', 'mods/sample.json', 'scripts/sample.lua']],
  ['coop loader and config', ['AmalurCoop/DINPUT8.dll', 'AmalurCoop/AmalurCoop/config.ini'], ['DINPUT8.dll', 'AmalurCoop/config.ini']],
  ['ReShade preset', ['Pure Amalur.ini'], ['Pure Amalur.ini']],
  ['ReShade multiple presets', ['Presets/Dark.ini', 'Presets/Light.ini'], ['Dark.ini', 'Light.ini']],
  ['ReShade with injector and shaders', ['Pack/dxgi.dll', 'Pack/ReShade.ini', 'Pack/reshade-shaders/Shaders/test.fx', 'Pack/reshade-shaders/Textures/test.png', 'Pack/Dark.ini'], ['dxgi.dll', 'ReShade.ini', 'reshade-shaders/Shaders/test.fx', 'reshade-shaders/Textures/test.png', 'Dark.ini']],
  ['shader-only package preserves shader tree', ['reshade-shaders/Shaders/test.fx'], ['reshade-shaders/Shaders/test.fx']],
  ['combined data and framework package', ['Pack/data/patch_0.pak', 'Pack/mods/test.json'], ['data/patch_0.pak', 'mods/test.json']],
  ['framework mod with game-root scripts folder', ['Pack/mods/test.json', 'Pack/scripts/test.lua'], ['mods/test.json', 'scripts/test.lua']],
  ['documentation outside wrapper', ['README.md', 'Pack/data/patch_0.pak'], ['data/patch_0.pak']],
];

for (const [name, files, expected] of cases) {
  test(name, async () => {
    const result = await planInstall(files, textFor);
    assert.deepEqual(result.instructions.map((instruction) => instruction.destination), expected.map((file) => path.join(...file.split('/'))));
    for (const instruction of result.instructions) {
      assert.equal(instruction.type, 'copy');
      assert.ok(files.includes(instruction.source), 'Source must be an actual archive entry');
      assert.equal(path.isAbsolute(instruction.destination), false);
    }
  });
}

const rejections = [
  ['empty archive', [], /no installable/],
  ['docs only', ['README.txt', 'screenshots/mod.png'], /no installable/],
  ['PAK variants', ['A/patch_0.pak', 'B/patch_0.pak'], /multiple mod roots/],
  ['explicit variants', ['A/data/patch_0.pak', 'B/data/patch_0.pak'], /multiple mod roots/],
  ['case-insensitive target collision', ['data/patch_0.pak', 'DATA/PATCH_0.PAK'], /Multiple files target/],
  ['flat and explicit PAK collision', ['patch_0.pak', 'data/patch_0.pak'], /Multiple files target/],
  ['file-directory collision', ['data/videos', 'data/videos/intro.bik'], /file and a directory/],
  ['file outside wrapper', ['Pack/data/patch_0.pak', 'Alternative/config.bin'], /outside the selected/],
  ['unknown root config alongside data', ['data/patch_0.pak', 'config.bin'], /Cannot determine/],
  ['unidentified DLL', ['plugin.dll'], /Unrecognized/],
  ['raw assets requiring repacking', ['texture.dds', 'simtype_init.bin'], /Unrecognized/],
  ['original game assets', ['bigs/001/Patches/test.big'], /Unrecognized/],
  ['patching executable', ['ClothingMod.exe', 'data/patch_0.pak'], /manual installation/],
  ['game executable', ['koa.exe', 'data/patch_0.pak'], /manual installation/],
  ['save with extension', ['save.sav'], /manual installation/],
  ['Steam save', ['5.123456'], /manual installation/],
  ['nested framework manifests', ['mods/OptionA/test.json', 'mods/OptionB/test.json'], /does not scan nested/],
  ['INI variants in directories', ['A/one.ini', 'B/two.ini'], /multiple subfolders/],
  ['scripted FOMOD delegated', ['fomod/ModuleConfig.xml', 'data/patch_0.pak'], /FOMOD installer/],
];
for (const [name, files, expected] of rejections) {
  test(`reject ${name}`, async () => {
    await assert.rejects(planInstall(files, textFor), (error) => error.name === 'ArchiveLayoutError' && expected.test(error.message));
  });
}

for (const filename of ['../patch_0.pak', 'data/../patch_0.pak', '..\\patch_0.pak', '/data/patch_0.pak', '\\server\\share\\patch_0.pak', 'C:\\data\\patch_0.pak', 'data/evil:stream.pak', 'data/NUL.pak', 'data/CON', 'data/COM1.txt', 'data/patch_0.pak.', 'data /patch_0.pak', 'data//patch_0.pak', 'data/./patch_0.pak', 'data/evil\u0000.pak']) {
  test(`reject unsafe path ${JSON.stringify(filename)}`, async () => {
    await assert.rejects(planInstall([filename], textFor), { name: 'ArchiveLayoutError' });
  });
}

test('FOMOD detection is case-insensitive and separator-independent', () => {
  assert.equal(isFomod(['Pack\\FOMOD\\ModuleConfig.XML']), true);
  assert.equal(isFomod(['Pack/fomod/ModuleConfig.xml']), true);
  assert.equal(isFomod(['mods/ModuleConfig.xml']), false);
});
test('bare unrelated JSON is not installed as a framework mod', async () => {
  await assert.rejects(planInstall(['settings.json'], async () => '{"window":true}'), /not a recognized/);
});
test('malformed JSON provides a useful error', async () => {
  await assert.rejects(planInstall(['mod.json'], async () => '{'), /Invalid framework JSON/);
});
test('patch-only framework manifest is accepted', async () => {
  const result = await planInstall(['patch.json'], async () => '{"patches":[]}');
  assert.equal(result.instructions[0].destination, path.join('mods', 'patch.json'));
});
test('unrelated INI is not mistaken for a ReShade preset', async () => {
  await assert.rejects(planInstall(['personal.ini'], async () => '[Graphics]\nquality=2'), /not a recognized ReShade/);
});
test('archive read failures remain visible', async () => {
  const error = Object.assign(new Error('Access denied'), { code: 'EACCES' });
  await assert.rejects(planInstall(['preset.ini'], async () => { throw error; }), (result) => result === error);
});

test('bare framework package honors luaL_loadfile game-root script references', async () => {
  const result = await planInstall(['Package/mod.json', 'Package/scripts/test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: 'scripts/test.lua' }] }));
  assert.deepEqual(result.instructions.map((instruction) => instruction.destination), [path.join('mods', 'mod.json'), path.join('scripts', 'test.lua')]);
});
test('bare framework package locates a uniquely named bundled script', async () => {
  const result = await planInstall(['mod.json', 'test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: 'mods/scripts/test.lua' }] }));
  assert.equal(result.instructions[1].destination, path.join('mods', 'scripts', 'test.lua'));
});
test('framework references cannot escape the game directory', async () => {
  await assert.rejects(planInstall(['mod.json', 'test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: '../test.lua' }] })), /Unsafe/);
});
test('framework references cannot introduce absolute drive paths', async () => {
  await assert.rejects(planInstall(['mod.json', 'test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: 'C:\\test.lua' }] })), /Unsafe/);
});
test('reject ambiguous bundled script references', async () => {
  await assert.rejects(planInstall(['mod.json', 'a/test.lua', 'b/test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: 'mods/test.lua' }] })), /More than one bundled script/);
});
test('reject a script referenced at two distinct destinations', async () => {
  await assert.rejects(planInstall(['mod.json', 'test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: 'mods/test.lua' }, { trigger: 'test', path: 'scripts/test.lua' }] })), /multiple locations/);
});
test('missing framework script may be supplied by a documented external dependency', async () => {
  const result = await planInstall(['mod.json'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: 'mods/dependency.lua' }] }));
  assert.equal(result.instructions.length, 1);
});
test('UTF-8 BOM in framework JSON is accepted', async () => {
  const result = await planInstall(['mod.json'], async () => '\uFEFF{"patches":[]}');
  assert.equal(result.instructions.length, 1);
});
test('malformed script array is an explanatory archive error', async () => {
  await assert.rejects(planInstall(['mod.json'], async () => '{"patches":[],"scripts":{}}'), /not a recognized/);
});
test('script entries must have the trigger required by the framework', async () => {
  await assert.rejects(planInstall(['mod.json', 'test.lua'], async () => '{"scripts":[{"path":"mods/test.lua"}]}'), /Invalid script reference/);
});
test('bare framework manifests accept leading dot-backslash game-relative script paths', async () => {
  const result = await planInstall(['mod.json', 'test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: '.\\mods\\test.lua' }] }));
  assert.equal(result.instructions[1].destination, path.join('mods', 'test.lua'));
});
test('leading dot-slash in script references cannot disguise traversal', async () => {
  await assert.rejects(planInstall(['mod.json', 'test.lua'], async () => JSON.stringify({ scripts: [{ trigger: 'test', path: './..\\test.lua' }] })), /Unsafe/);
});
test('prefixed documentation is excluded while similarly named Lua payloads remain', async () => {
  const files = ['mods/test.json', 'mods/Reforged/readme_settings.lua', 'KOA_Reforged_README.md', 'KOA_Reforged_CHANGELOG.md', 'ELITE_ENEMIES_REFORGED_CHANGELOG.md'];
  const result = await planInstall(files, textFor);
  assert.deepEqual(result.instructions.map((instruction) => instruction.source), files.slice(0, 2));
});
test('KOA Reforged 1.3.5 uploaded archive file list installs its complete mods tree', async () => {
  const files = require('./fixtures/koa-reforged-1.3.5-files.json');
  const result = await planInstall(files, async () => { throw new Error('Explicit mods layout does not require manifest rewriting'); });
  const payload = files.filter((filename) => filename.startsWith('mods/') && !filename.endsWith('/'));
  assert.equal(payload.length, 35);
  assert.deepEqual(result.instructions.map((instruction) => instruction.source), payload);
  for (const instruction of result.instructions) {
    assert.equal(instruction.destination, path.join(...instruction.source.split('/')));
  }
});
