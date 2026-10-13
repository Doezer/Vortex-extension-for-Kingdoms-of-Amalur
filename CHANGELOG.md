# Changelog

## 1.0.3 — Nexus listing metadata

- Add numerical Nexus game ID `3428` to `info.json`, as required by the updated extension listing process.
- Validate that the ID is included in the packaged extension and update Nexus upload instructions. GitHub review requests are no longer required.

## 1.0.2 — Mod archive compatibility

- Offer optional-component selection for archives with main files and clearly named optional folders, including No-Intro Fix's Optional Openings Removal.
- Skip installation/instruction documents and tutorial images outside game payload folders, while preserving data and shader textures.
- Add regression tests for No-Intro Fix and documentation filtering. Invalid framework JSON remains rejected for the mod author to fix.

## 1.0.1 — Packaging compliance

- Use an official Steam screenshot as the required text-free 640×360 `gameart.png` thumbnail.
- Match `info.json.name` to the game's display name.
- Shorten the README to installation, supported mods, Essentials and troubleshooting.
- Verify the published ZIP against the official packaging and testing guides.

## 1.0.0 — Initial release

Vortex support for **Kingdoms of Amalur: Re-Reckoning** on Windows, including Fatesworn installations.

- Discover Steam, GOG and Epic installations, with manual game-folder selection when needed.
- Install replacement PAKs, data and video replacements, Mod Framework packages, Lua scripts, and ReShade presets while preserving their intended game-relative paths.
- Support wrapped archives and KOA Reforged packages; handle framework script references without rewriting manifests.
- Require Mod Framework 1.4 or newer for framework mods. Independent PAK, video and ReShade packages remain independent of the framework.
- Provide **Amalur Essentials** for framework runtime checks and optional Save Editor, F2 Console and No Logos recommendations, with status badges, expandable details and automatic refresh after relevant changes.
- Download current Nexus files through Vortex, with an in-app file picker when needed. Nexus account and author permissions determine whether browser authorization is required.
- Install user-downloaded remaster Save Editor 3.x as a standalone tool in `<game>/tools/KoAR.SaveEditor/`, preserve its companion files, link it in Dashboard > Tools, and retain a backup when updating.
- Handle duplicate saved extension entries from manual ZIP upgrades without deleting the shared installation folder.
- Reject unsafe paths, ambiguous variants, incompatible packages and unrelated executable/save archives. Delegate scripted FOMOD packages to Vortex.
- Use Vortex staging, conflict rules, deployment and purge for mods. PAK conflicts are resolved as whole files; internal assets are not merged.

### Installation

Requires **Vortex 1.9 or newer** and the PC remaster; the original 2012 Reckoning is not supported.

Drop `game-kingdomsofamalurrereckoning-1.0.1.zip` into **Extensions**, restart Vortex, then manage Re-Reckoning from **Games**. Use **Amalur Essentials** to review the setup and download optional additions.

Mod Framework, Save Editor and recommended mods are downloaded separately from their authors. No third-party mod, tool or game binaries are bundled.

### Validation

136 automated tests cover archive installation, dependencies, runtime checks, downloads, standalone tool installation, backups and rollback, page actions, and the packaged extension. GitHub Actions validates and builds on Windows and Linux with Node.js 22 and 24.
