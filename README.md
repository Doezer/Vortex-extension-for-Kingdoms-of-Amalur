# Kingdoms of Amalur: Re-Reckoning for Vortex

Install and manage mods for the Windows remaster with Vortex 1.9 or newer.
Supports Steam, GOG and Epic installations, including Fatesworn.
The original 2012 Reckoning is not supported.

## Installation

1. [Download the latest extension ZIP](https://github.com/Doezer/Vortex-extension-for-Kingdoms-of-Amalur/releases/latest/download/game-kingdomsofamalurrereckoning.zip).
2. Drop it onto **Extensions → Drop File(s)** in Vortex, then restart Vortex.
3. Find **Kingdoms of Amalur: Re-Reckoning** in **Games** and click **Manage**.
4. If the game isn't found, select the folder containing `koa.exe` and `data/initial_0.pak`.

Keep your mod staging folder on the same drive as the game and use **Hardlink Deployment**.
Install mods in Vortex, enable them, then deploy.

To update the extension, drop the new ZIP into Extensions and restart.
Duplicate entries for the same installation folder are cleaned up automatically.

## Supported mods

- Replacement PAKs, installed into `data/`.
- Packages containing `data/`, including video replacements.
- Mod Framework packages, JSON manifests and Lua scripts.
- ReShade presets and packages with their shaders and textures.
- Wrapped archives such as KOA Reforged.

Framework mods require [Mod Framework 1.4 or newer](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/9).
Vortex adds that dependency when installing them. PAK replacements, video mods and ReShade do not need it.
For ReShade presets, install ReShade separately as directed by the mod author.

If two mods replace the same PAK or DLL, choose a winner using Vortex's conflict rules.
PAK contents aren't merged. For archives with a main payload and labelled optional folders, Vortex asks which extras to install.
Packages containing only alternative variants still need one variant selected and repackaged.
Installation guides and tutorial images are skipped. Invalid framework JSON needs to be
corrected by the mod author.
Saves, trainers and unrelated executable installers need manual installation.

## Amalur Essentials

Open **Amalur Essentials** in the sidebar to check Mod Framework and download optional additions:

- **Save Editor:** installs the remaster 3.x version into `<game>/tools/KoAR.SaveEditor/` and links it in **Dashboard → Tools**. Use **Install downloaded copy** if its archive is already in Vortex. Updates keep the previous folder as a backup.
- **F2 Console:** an optional in-game console that also needs Mod Framework.
- **No Logos:** an optional mod to skip the startup logos.

Mod downloads still need installation, enablement and deployment through Vortex.
Save Editor is a standalone tool and doesn't need deployment.
Nexus may require browser authorization for downloads on free accounts.

## Troubleshooting

Use **Refresh status** in Essentials after making changes outside Vortex.
An archive rejected by the installer shows its reason in Vortex; details are also logged in `vortex.log`.
Purge mods before a game update or store repair, then redeploy compatible versions.
Back up your saves before editing them.

## Development

Use Node.js 22 or 24:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
```

The installable ZIP is written to `dist/`. CI runs on Windows and Linux.
See the [changelog](CHANGELOG.md), [guide verification](docs/verification.md), and [Windows testing checklist](docs/live-validation.md).

The game thumbnail is an [official Steam screenshot](docs/artwork.md).
Game imagery belongs to its respective rights holders; the extension code is MIT licensed.
