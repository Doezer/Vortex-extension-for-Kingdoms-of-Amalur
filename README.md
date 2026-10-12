# Kingdoms of Amalur: Re-Reckoning — Vortex extension

Vortex game support for the Windows PC remaster, **Re-Reckoning**, including
Fatesworn installations. Requires Vortex **1.9 or newer**. This extension is a
tested installer implementation; **live Vortex and in-game validation is still
pending**. It does not support the original 2012 Reckoning.

## Install the extension

1. Download the extension ZIP from a CI artifact, or build it using the commands below.
2. In Vortex, open **Extensions** and drop `game-kingdomsofamalurrereckoning-0.1.3.zip`
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
before dependent framework mods.

Starting with extension 0.1.2, installing a package with a `mods/` payload adds a
Vortex **requires** rule for Mod Framework 1.4 or newer. The reference points to
Nexus mod 9, main file 39 (1.4); a newer installed framework can satisfy the version
range. Vortex handles dependency resolution and its normal download/login flow.
The framework distribution itself is exempt to avoid a circular dependency.
PAK replacements, video replacements, and ReShade packages do not require it.
Reinstall framework-based mods installed using an older extension once to attach
the dependency rule. Install and enable the framework through Vortex, rather than
only copying its DLLs manually, so the managed dependency can be recognized.

The framework scans JSON and DLL plugins directly
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

## Optional tools and recommendations

Open **Amalur health checks** in Vortex's sidebar while managing Re-Reckoning.
All setup checks and optional recommendations appear here, without startup or
setup notifications. The page refreshes on profile/mod changes and after deployment
or purge; **Refresh checks** also reruns it after changes made outside Vortex.

**Mod Framework** appears under **Required for framework mods**. Its check verifies
that `dinput8.dll` and `re_mod.dll` are files with nonzero size in the game folder.
For a managed Nexus mod 9 installation, it also checks whether the mod is enabled
in the active profile and whether a recognized version is below 1.4. Filesystem
access errors are reported as errors, not as a missing mod. These checks do not
execute DLLs or establish in-game compatibility.

The **Optional suggestions** section contains:

- [Save Editor (mod 8)](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/8):
  an optional standalone tool. Download the remaster **3.x** release separately and
  extract its complete distribution into `<game>/tools/KoAR.SaveEditor/`, with
  `KoAR.SaveEditor.exe` directly in that folder. The extension detects this location
  for Vortex's Dashboard tools. For another location, configure the executable in
  **Dashboard > Tools**. It remains optional and never replaces the game launcher.
  The binary is not bundled: the Nexus author prohibits reuploads. Follow the
  author's save-editing instructions and back up the save you intend to edit.
- [F2 Console (mod 14)](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/14):
  recommended, optional in-game console. F2 Console itself needs Mod Framework.
- [No Logos (mod 4)](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/4):
  recommended, optional intro-video replacements.

Each unfulfilled check has an **Open … page** action for its author's Nexus page.
Optional items do not block modding and are never installed or run automatically.
The editor check validates the configured or portable executable; the F2 Console
and No Logos checks inspect managed mods enabled in the active profile. Manually
installed copies of those recommended mods cannot be identified by their metadata.

The checks also register with Vortex's native health-check engine when its API is
available. The inspected built-in **Health check** view only renders its own
dependency-report providers, so this extension supplies **Amalur health checks**
to make all four custom checks visible. Mod Framework's separate required-dependency
rule remains in place for framework mods. Updating from 0.1.2 dismisses the old setup
notification cards.

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
Named documentation may have a mod-name prefix, such as `KOA_Reforged_README.md`.
Rejected layouts display the reason in a **Cannot install this Amalur mod** error
notification and log it in `vortex.log` under `[amalur] Mod archive rejected`.
Full root-loader packages preserve their companions, but packages containing
executables or scripts that require manual execution are refused.

## Development and CI

Use Node.js **22 or 24** and npm. Vortex supplies `vortex-api` at runtime; it must
not be installed or bundled from npm. Vortex also supplies React for the health
page. Development dependencies are pinned in `package-lock.json`: `fflate` creates
ZIP distributions, while React and its test renderer exercise the health page.
Neither React nor any development dependencies are included in the ZIP.

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
The KOA Reforged regression fixture contains only filenames from the user-supplied
1.3.5 archive, with no third-party scripts or assets. That archive was also checked
locally for complete staging without altering its 35 payload files.
