# Kingdoms of Amalur: Re-Reckoning — Vortex extension

Vortex game support for the Windows PC remaster, **Re-Reckoning**, including
Fatesworn installations. Requires Vortex **1.9 or newer**. This extension is a
tested installer implementation; **live Vortex and in-game validation is still
pending**. It does not support the original 2012 Reckoning.

## Install the extension

1. Download the extension ZIP from a CI artifact, or build it using the commands below.
2. In Vortex, open **Extensions** and drop `game-kingdomsofamalurrereckoning-0.1.0.zip`
   onto the **Drop File(s)** area. This is an extension, so do not install it in the Mods tab.
3. Restart Vortex. Open **Games**, search for **Kingdoms of Amalur: Re-Reckoning**, and manage it.
4. Automatic discovery checks Steam, GOG, then Epic. If discovery fails, manually
   select the game folder containing `koa.exe` and `data/initial_0.pak`.
5. Use a staging folder on the same drive as the game and Vortex's **Hardlink Deployment**.
   Import a supported mod archive in the Mods tab, enable it, and deploy.

Discovery IDs are Steam `1041720`, GOG `1077045575`, and Epic
`b8aa8afb7da84da3a978425ec4b8e5cd`. Store discovery is tested against API doubles;
these stores and live installations are not present in the development environment.
The original game's Steam ID `102500` is deliberately excluded.

## Supported mod layouts

An archive can wrap its payload in one or more folders. The installer removes
the wrapper only when its intended game-relative layout is unambiguous.
Slash and backslash archive paths and capitalized `Data`/`Mods` folders are accepted.

| Archive content | Deployed relative to the game folder | Notes |
| --- | --- | --- |
| `patch_0.pak` | `data/patch_0.pak` | Filename is preserved; no invented PAK load order. |
| `My Mod/data/patch_0.pak` | `data/patch_0.pak` | Replacement game archives, including `initial_0.pak`. |
| `data/videos/intro.bik` | `data/videos/intro.bik` | Video and other explicitly packaged data replacements. |
| `mods/example.json`, `mods/example.lua` | Same paths | Requires the appropriate Mod Framework version. |
| `example.json`, `example.lua` | `mods/example.json`, `mods/example.lua` | Bare JSON must contain a `scripts` or `patches` array. |
| `Gems.lua`, `Smith.lua` | `mods/Gems.lua`, `mods/Smith.lua` | Console scripts still need the author's console/framework dependency. |
| `dinput8.dll`, `re_mod.dll`, `mods/...`, `scripts/...` | Same paths | Framework distribution: preserve all accompanying runtime files. |
| `DINPUT8.dll`, `AmalurCoop/config.ini` | Same paths | Loader and accompanying configuration; does not supply a multiplayer mod. |
| `Pure Amalur.ini` | `Pure Amalur.ini` | Identified by ReShade preset keys, not filename alone. |
| `dxgi.dll`, `ReShade.ini`, `reshade-shaders/...` | Same paths | Preserves shader/texture directories and accompanying presets. |

Install [Mod Framework](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/9)
before dependent framework mods. The framework scans JSON and DLL plugins directly
inside `mods/`; nested manifest/plugin folders are rejected instead of installing
files the framework will not load. Bare Lua scripts do not run automatically.
For bare manifests, bundled Lua scripts are installed at the game-relative paths
declared in the JSON (for example `mods/example.lua` or `scripts/example.lua`).
The installer does not rewrite the JSON. Ambiguous script matches are refused.
References to scripts absent from the archive are left for the author's separately
installed dependencies. Explicit game-relative packages preserve their paths.

Install ReShade separately following the preset author's instructions, then select
the deployed preset in the ReShade overlay. Installing a preset does not install
ReShade or download missing shader dependencies. Injector DLLs recognized as root
markers are `dinput8.dll`, `re_mod.dll`, `dxgi.dll`, `d3d11.dll`, and `d3d9.dll`.

## Conflicts, disabling, and game updates

Vortex manages staging, deployment, backups of replaced files, and purge. The
extension only returns installation instructions; it does not edit game archives
or copy files directly into the game. Back up files you modified manually before
first deployment, and resolve any Vortex **external changes** prompt deliberately.

Two mods replacing `data/patch_0.pak` conflict as **whole files**. Pick a winner in
Vortex's conflict rules. The extension does not merge their internal assets:
choosing one means the other's changes inside that PAK are not applied.
The same applies to different mods supplying `dinput8.dll` or other shared targets.
To combine such mods, use an author-provided compatibility package or their manual
merging instructions. Optional variants in one archive are rejected; select one
variant and repackage its game-relative payload before import.

Disable a mod and deploy to remove it. **Purge Mods** removes deployed files and
lets Vortex restore its originals. Purge before updating the game or verifying its
files in a store, then reinstall compatible mods and deploy again. A replacement
PAK must match your game's version/DLC; the extension cannot verify that compatibility.

## Manual-only and delegated formats

- Standalone save editors, trainers, save-game downloads, patching programs,
  and executable installers are refused. Install/use these manually as instructed.
- Raw DDS/BIN assets without a game-relative `data/` layout need the author's
  PAK rebuilding procedure. The extension does not execute `pakfilebuilder.exe`.
- Original-game `bigs/` packages are not remaster packages.
- Unrecognized archives are refused rather than handed to Vortex's generic copy
  installer. Use a game-relative `data/` or `mods/` package when its location is known.
- Scripted FOMOD packages are delegated to Vortex's FOMOD installer. Their script,
  dependencies, and paths remain the mod author's responsibility. This route has
  not been validated with a published Re-Reckoning FOMOD archive.

Documentation, screenshots, and common archive metadata are excluded from mod
deployment. The extension validates paths and rejects traversal, drive/UNC paths,
Windows reserved filenames, and destination collisions before returning copy instructions.
Full root-loader packages preserve their companions, but packages containing
executables or scripts that require manual execution are refused.

## Development and CI

Use Node.js **22 or 24** and npm. Vortex supplies `vortex-api` at runtime; it must
not be installed or bundled from npm. The sole development dependency, `fflate`,
creates ZIP distributions and is pinned in `package-lock.json`.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
```

The ZIP is written to `dist/` with `index.js` and `info.json` at its top level.
It includes the local installer/discovery modules, README, license, and an original
SVG fallback tile. It includes no mod/game assets or development dependencies.
Packaging is deterministic and checks a byte-for-byte ZIP round trip.

GitHub Actions runs syntax/metadata checks, tests, and packaging on Windows and
Linux with Node 22 and 24, and uploads the installable ZIP as an artifact.
Regular CI does not publish releases. The manually triggered **Publish prerelease**
workflow validates and builds the selected commit, then publishes its ZIP to a
GitHub prerelease using the corresponding notes in `docs/releases/`.
Neither workflow uploads anything to Nexus Mods.

Tests exercise the actual entry point with a small Vortex API double, the real
installer/discovery modules, extracted-file reads, temporary staging files,
conflict targets, a simulated host deployment/purge lifecycle, and the packaged
ZIP. Test payloads are synthetic and follow the published layouts; they are not
downloaded third-party mod archives. See [research notes](docs/research.md) for
sources and [the live validation checklist](docs/live-validation.md) before release.
