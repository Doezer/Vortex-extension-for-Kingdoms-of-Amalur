# Research and implementation decisions

Sources checked on 2026-10-12. Findings establish installation locations and API
contracts, not live game compatibility or the absence of every private extension.

## Existing Vortex support

- [Nexus-Mods/vortex-games](https://github.com/Nexus-Mods/vortex-games/tree/18bbee9baf1fefb2bf1f9d28ae0e39fb8266974e)
  has no Amalur/Reckoning extension. Its README says distribution is now through
  Nexus Mods rather than new pull requests to this repository.
- [Current Vortex source](https://github.com/Nexus-Mods/Vortex/tree/04daf64faafccf2eccaa53cc2359552c308505f4)
  contains no Amalur/Reckoning game-specific implementation in the inspected checkout.
- [Vortex game-support request #9779](https://github.com/Nexus-Mods/Vortex/issues/9779)
  requested Re-Reckoning support in 2021 and is closed. This is historical evidence,
  not a current supported-games catalog.
- [GitHub repository search for Amalur + Vortex](https://github.com/search?q=amalur+vortex&type=repositories)
  returned this otherwise-empty project as its only result at inspection time.
  No existing public implementation was found in the sources accessible here.
- Nexus's site-wide listing is rendered by JavaScript and the fetched server page
  did not provide extension search results. Therefore a complete Nexus extension
  catalog search was **not** established. Google searches were rate-limited.

## Game identity and mod ecosystem

| Source | Finding used |
| --- | --- |
| [SteamDB app configuration](https://steamdb.info/app/1041720/config/) | Steam app `1041720`; executable `koa.exe`. |
| [Nexus Re-Reckoning section](https://www.nexusmods.com/kingdomsofamalurrereckoning) | Separate remaster domain `kingdomsofamalurrereckoning`, game number `3428` in page metadata. |
| [Nexus original-game section](https://www.nexusmods.com/kingdomsofamalurreckoning) | Separate original domain, number `2447`; do not confuse it with the remaster. Some older remaster tools were uploaded there. |
| [Amalur community reference](https://github.com/thunderer/Amalur/blob/master/README.md) | Steam original/remaster distinction and [GOG product](https://www.gogdb.org/product/1077045575) identifier `1077045575`. |
| [GameFinder issue #68](https://github.com/erri120/GameFinder/issues/68), [Heroic issue #3465](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher/issues/3465) | GameFinder explains Vortex uses AppName, not CatalogItemId or namespace. Heroic's game list associates `b8aa8afb7da84da3a978425ec4b8e5cd` with Re-Reckoning. This was not verified against a local Epic install. |
| [No Logos, mod 4](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/4) | Author instructs copying `data/` into the executable folder, replacing video files. |
| [Clean Menu, mod 20](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/20) | Author instructs replacing `data/patch_0.pak` and using only one download variant. |
| [Mod Framework, mod 9](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/9) | Extract into the folder with `koa.exe`; mods live under `mods/`; original-game framework mods are incompatible. |
| [Dynamic Difficulty, mod 80](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/80) | Requires Mod Framework; extract into `mods`. |
| [Unfair Difficulty, mod 11](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/11) | Requires framework 1.3 or later; examples include Lua scripts and JSON manifest patches. |
| [Blacksmith scripts, mod 30](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/30) | Requires F2 Console; author invokes `run('mods\\Gems.lua')` and `run('mods\\Smith.lua')`. |
| [Pure Amalur ReShade, mod 6](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/6) | Install ReShade separately; place preset in the executable folder and select it in the overlay. |
| [Enhanced ReShade, mod 5](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/5) | Same executable-folder preset placement, with shader dependencies and optional presets. |
| [Customer Service save, mod 40](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/40) | Saves go under Steam `userdata/.../1041720/remote`, not in the game install. Refuse generic deployment. |
| [Save editor, mod 8](https://www.nexusmods.com/kingdomsofamalurrereckoning/mods/8) | A separate utility, not a game file replacement mod. |

Primary-source implementation checks:

- [KoaModFramework source](https://github.com/DevCortez/KoaModFramework/blob/master/re_mod/dllmain.cpp)
  enumerates `./mods/` without recursion. `LoadMod` handles JSON `scripts` and
  `patches` arrays, loads DLL plugins, and passes script paths to `luaL_loadfile`.
  The [dinput8 proxy](https://github.com/DevCortez/KoaModFramework/blob/master/dinput8/dllmain.cpp)
  loads `re_mod.dll`. Preserve full runtime package paths; do not invent per-mod folders.
- [ClothingMod source](https://github.com/mburbea/ClothingMod/blob/master/ClothingMod/Program.cs)
  runs `pakfileunpacker.exe` / `pakfilebuilder.exe` from `modding/`, works with
  `data/initial_0.pak`, and rebuilds `data/patch_0.pak`. Installing its executable
  is not equivalent to installing its output. Do not automatically execute it.
- [AmalurCoop instructions](https://github.com/hardkiller2565123123/Kingdoms-of-Amalur-Re-Reckoning-coop-mod/blob/12a04915efc4b740dc8f7c6cc6741daa963fd1b3/AmalurCoop/README.md)
  place `DINPUT8.dll` beside the executable; `Paths.cpp` uses `AmalurCoop/config.ini`.
  The extension handles deployment locations, not the experimental mod's compatibility.

## Vortex API and distribution

The implementation follows Vortex's actual types and loader rather than adding
a guessed executable or assuming PAKs belong in a generic `mods` folder:

- [IGame](https://github.com/Nexus-Mods/Vortex/blob/04daf64faafccf2eccaa53cc2359552c308505f4/src/renderer/src/types/IGame.ts):
  `queryModPath: () => '.'` deploys relative to the game directory;
  `mergeMods: true` avoids inserting a mod-name folder; setup validates root writability.
- [Installer registration](https://github.com/Nexus-Mods/Vortex/blob/04daf64faafccf2eccaa53cc2359552c308505f4/src/renderer/src/types/IExtensionContext.ts):
  smaller priorities win; scripted FOMODs use priority 20. The game-specific
  installer uses 25 and deliberately claims unknown non-FOMOD packages to avoid
  blind generic installation. Errors become Vortex `ProcessCanceled` messages.
- [InstallFunc](https://github.com/Nexus-Mods/Vortex/blob/04daf64faafccf2eccaa53cc2359552c308505f4/src/renderer/src/extensions/mod_management/types/InstallFunc.ts):
  receives archive file paths, extraction path, and game ID; returns a PromiseLike
  installation result. Copy instructions preserve the original source path.
- [GameStoreHelper](https://github.com/Nexus-Mods/Vortex/blob/04daf64faafccf2eccaa53cc2359552c308505f4/src/renderer/src/util/GameStoreHelper.ts):
  store-scoped app-ID lookups return entries with `gamePath` and reject on misses.
- [Extension metadata](https://github.com/Nexus-Mods/Vortex/blob/04daf64faafccf2eccaa53cc2359552c308505f4/src/renderer/src/extensions/extension_manager/extensionInfo.ts)
  requires name/version; author/description/id are supported.
- [Extension installer](https://github.com/Nexus-Mods/Vortex/blob/04daf64faafccf2eccaa53cc2359552c308505f4/src/renderer/src/extensions/extension_manager/installExtension.ts)
  requires `index.js` and `info.json` at the top level of the extension payload.
- [Official distribution guide](https://modding.wiki/en/vortex/developer/packaging-extensions)
  is linked by Nexus's extension repository. The guide and older wiki tutorial
  were blocked from this environment; loader source supplied the verified ZIP contract.

No archive merging, PAK repacking, filename renaming, loader chaining, or game
load-order algorithm was inferred. Those require further game-specific evidence.
Real third-party archive downloads require Nexus authentication and were not used;
attempted public content-preview metadata was blocked. Fixtures reflect author
descriptions and source behavior and are explicitly synthetic.

## KOA Reforged installation report (0.1.1)

The user supplied a Vortex log and KOA Reforged 1.3.5 ZIP (Nexus mod 89, file 259).
The log showed successful extraction followed immediately by cancellation in this
extension's installer. Running the supplied archive's file list through version
0.1.0 reproduced an `ArchiveLayoutError` for `KOA_Reforged_README.md`.
The documentation detector only recognized names beginning with README/CHANGELOG,
so it incorrectly treated the mod-prefixed Markdown documents as runtime payloads.

Version 0.1.1 recognizes labelled documentation with a mod-name prefix. Validation
against the supplied ZIP confirmed that all 35 files in `mods/` stage at their
original relative paths without changing their contents or JSON script references.
The fixture saved in the repository contains filenames only; neither the mod's
code nor the user's log is redistributed. Manifest examples use `.\\mods\\...`
references, so the bare-manifest route now accepts safe leading dot-relative
prefixes too. Rejected layouts are logged and shown in a Vortex error notification
before installation is canceled. In-game loading remains unverified here.

## Dependency and optional-tool setup (0.1.2)

The user requested Mod Framework (mod 9) as a prerequisite, Save Editor (mod 8)
as an optional tool, and F2 Console (mod 14)/No Logos (mod 4) as recommendations.
The framework's current Files page lists main file 39, version 1.4. Vortex's
`IModRule` and `IModReference` types support a `requires` rule with Nexus repository,
game/mod/file IDs, and a fuzzy semantic version range. Its reference matcher accepts
another installed file from the same mod page when that version range is satisfied.
Installation instructions emit that rule for `mods/` payloads, except a package
already supplying both framework runtime DLLs. Other archive types are independent.
Existing mods need one reinstall to obtain the new rule.

Mod 14's description identifies it as **F2 Console**, which itself requires Mod
Framework. Mod 8's page identifies the remaster-compatible editor as **3.x** and
prohibits uploads elsewhere. The author's `KoAR.SaveEditor.csproj` has the default
assembly name `KoAR.SaveEditor`, so the executable is `KoAR.SaveEditor.exe`.
The extension registers a standalone Vortex tool and a download/setup suggestion;
it does not redistribute that executable. Detection checks the documented portable
directory and can be overridden through Vortex's tool configuration.
All optional suggestions are dismissible links, never runtime dependency rules.

Tests cover emitted rules, framework self-dependency exclusion, independent mods,
runtime-file setup hints, tool discovery and optional recommendation actions.
Live Vortex dependency downloading and in-game framework initialization remain
unverified in the cloud workspace.

## Health checks instead of setup notifications (0.1.3)

The user requested Mod Framework health validation and moved all four setup items
out of notifications. Vortex's `IHealthCheck` API supports game-scoped descriptors,
startup/game/profile/mod/manual triggers, categorized results, and optional action
callbacks. Registration uses `context.optional.registerHealthCheck` so the extension
can still load on older Vortex versions with no native custom-check API.

The inspected `HealthCheckPage.tsx` gets displayed entries through a fixed
`healthCheckContent` provider registry; it does not render arbitrary registered
custom-check results. An existing Witcher extension explicitly notes that limitation.
Using only native registration would therefore leave these items invisible. The
extension registers a game-scoped **Amalur health checks** page using the supported
`registerMainPage` API. It uses the same checks and refreshes on mod/profile changes,
deployment/purge, and a manual button, with no notification mirroring.

Framework validation examines both runtime files without executing them, along
with managed profile enablement and recognized version metadata. Optional tool/mod
checks report informational suggestions; browser actions never mark an installation
healthy by themselves. Tests exercise real temporary filesystem changes and the
React page's refresh, action, and subscription cleanup behavior. React is supplied
by Vortex at runtime; test dependencies are not redistributed in the extension ZIP.

## Duplicate initialization and custom page revision (0.1.4)

The supplied October 12 Vortex log shows the same extension path initialized once
with 0.1.0, twice after 0.1.1, three times after 0.1.2, and four times after 0.1.3.
Only one module-load log precedes those repeated calls. This accounts for the four
sidebar entries; it does not independently prove the cause of the navigation freeze.
The network log reports unrelated Nexus requests, not an Amalur page failure.

Vortex v2.8.1 ExtensionManager loads persisted extension records before directory
scanning. Each record can resolve to the same cached module. initExtensions then
calls its default initializer for every record. The extension now guards its entire
initializer, rather than only the page: repeated calls must not register duplicate
games, installers, checks, or event handlers either. A test exercises four calls
with separate contexts to the same module and checks registration counts.

Source references:
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/ExtensionManager.ts
- https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Adding-a-main-page
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/views/MainPage.tsx

The page uses the documented legacy MainPage shell within Vortex's page container,
with an explicit body scroll area. Hidden pages unsubscribe from refresh events;
request generations discard results after navigation/unmount. Optional suggestions
remain visible without notifications and detailed diagnostics are collapsed.

## Manual ZIP upgrade records (0.1.5)

In Vortex v2.8.1, installExtension.ts replaces the directory based on info.json.id,
but calls removeOldVersion only when installation data includes a catalogEntry.
Manual drag-and-drop installation has none. app.ts addExtension always assigns a
fresh shortid. Stable metadata therefore replaces files but does not deduplicate
saved records. Renaming the ZIP or changing extension IDs cannot fix this safely.

Startup cleanup uses the exported actions.forgetExtension, which removes a record
without marking its directory for deletion. It only removes records matching both
this infoJsonId and this module directory, and retains a live entry matching this
installed version. actions.removeExtension is unsuitable: all versions share a
folder, and removal could delete the current installed files on restart.

- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/extensions/extension_manager/installExtension.ts
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/reducers/app.ts
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/actions/app.ts

## Essentials downloads through Vortex (0.1.6)

The custom page is named Amalur Essentials to distinguish it from Vortex's native
Health check. Public registerHealthCheck descriptors and stable IDs are retained.

Vortex's existing script-extender downloader and Stardew Valley SMAPI downloader
use api.ext.ensureLoggedIn, api.ext.nexusGetModFiles(gameId, modId), then
start-download with an nxm:// game/mod/file URL and allowInstall:false. Essentials
uses the same flow, with current main-file selection and a native dialog for
ambiguous releases. Save Editor candidates must have a remaster 3.x version.

NxmProtocol handles account membership and the author's direct_download_enabled
flag. Keyless links for free accounts can require website authorization; the
extension delegates this to Vortex and does not promise a browser-free flow for
every Nexus account. Tools are downloaded without automatic mod installation.

- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/extensions/script-extender-installer/src/nexusModsDownloader.ts
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/extensions/games/game-stardewvalley/src/smapi/download.ts
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/extensions/nexus_integration/nxmProtocol.ts
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/extensions/nexus_integration/eventHandlers.ts

## Standalone Save Editor installation (0.1.7)

The user's explicit Save Editor install action downloads or reuses a completed
Nexus mod 8 archive, verifies its file ID against remaster 3.x metadata, and installs
it under the discovered game's tools/KoAR.SaveEditor folder. This is a standalone
tool workflow, not a mod installer/deployment side effect. The default mod archive
installer still rejects unrelated executables.

Vortex's public selectors.downloadPathForGame resolves custom download locations.
Its exported util.SevenZip uses the Nexus-Mods/node-7z fork: list reports entries
through the progress callback; extractFull resolves a code/errors result. The
installer validates paths before extraction, checks the extracted tree and full
file list, then promotes the prepared folder. Updates retain the old folder in a
sibling backup; a failed promotion attempts to restore it. No author binary is
bundled or redistributed.

Public actions.addDiscoveredTool and setToolVisible register the executable and
working directory. The supported-tool definition still discovers manual installs.
No primary-tool action, mod enablement, or deployment is triggered.

- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/extensions/download_management/selectors.ts
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/extensions/gamemode_management/actions/settings.ts
- https://github.com/Nexus-Mods/node-7z/blob/b75def8d0d7d81a03f4526c52b8ada9a34a06479/lib/index.d.ts

## Archive compatibility fixes (1.0.2)

The uploaded EnemySpawnRateXPDurability v5 archive contains eight loose framework
files. EnemySpawnMultiplier_Combat.json has a trailing comma after its vars object;
all other five JSON files parse. The user explicitly requested that the extension
not repair this author error. Strict JSON parsing remains in place, and a regression
test confirms the malformed combat manifest remains rejected. No mod payload is
rewritten. The framework source calls RapidJSON Document.Parse without relaxed
flags; runtime compatibility of the supplied malformed file cannot be assumed.

The uploaded No-Intro Fix archive contains seven main logo videos and eleven
optional opening videos. A native Vortex checkbox dialog selects explicitly named
optional roots alongside a main root; alternative A/B packages remain rejected.
Selected roots are stripped before routing and destination collisions are checked.
No optional group is selected by default. Installation.txt and tutorial.png are
recognized as documentation; textures inside data/mods/reshade-shaders are retained.

Local validation uses the actual entry point against the uploaded No-Intro ZIP,
staging 7 main videos or 18 files with the addon. Copy payloads and the original
archive remain unchanged. Repository fixtures contain filenames and synthetic
manifest examples only, not third-party mod payloads.

Sources:
- https://github.com/DevCortez/KoaModFramework/blob/master/re_mod/dllmain.cpp
- https://github.com/Nexus-Mods/Vortex/blob/v2.8.1/src/renderer/src/types/IDialog.ts

## Adjacent documentation (1.0.4)

PACKAGE-STATUS.txt exposed the limits of recognizing documents by filename alone.
The installer now classifies common text/document and image extensions outside
explicit data/mods/reshade-shaders payload folders. Filtering happens before root
and common-wrapper detection, so sidecars beside or outside a wrapped payload do
not create spurious roots or prevent bare framework/preset recognition.

Path validation still precedes filtering. Explicit payload folders retain their
resources, including documentation-looking names and text files. Root DLL/loader
packages retain unlabelled companion text and image resources in their runtime
tree; known documentation names and folders are still omitted there. Unknown
configuration, executable, binary and malformed JSON files are not discarded to
force an otherwise unsupported installation to succeed. Source archives are never
modified. Regression tests cover PACKAGE-STATUS.txt, arbitrary documents/images,
wrapper placement, optional addons, runtime companions, preserved payload assets,
unsafe sidecars, invalid JSON and alternative roots.
