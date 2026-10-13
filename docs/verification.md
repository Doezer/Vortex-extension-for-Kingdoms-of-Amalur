# Official guide verification

Reviewed against the Nexus Mods guides on 13 October 2026:

- [How to package a game extension](https://github.com/Nexus-Mods/Vortex/wiki/How-to-package-a-game-extension)
- [How to test a game extension](https://github.com/Nexus-Mods/Vortex/wiki/How-to-test-a-game-extension)

## Packaging

The original 1.0.0 ZIP used a portrait SVG with text and metadata named
“Kingdoms of Amalur: Re-Reckoning Support”. Version 1.0.1 corrects both issues using an actual screenshot from the official Steam listing.

| Requirement | Result | Evidence |
| --- | --- | --- |
| Required files at archive root; no enclosing folder | Pass | Packaged `index.js`, `info.json`, `gameart.png`; exact ZIP contents checked by `test/package.test.js`. |
| Mandatory metadata fields | Pass | Nonempty `name`, `author`, `version`, `description` and numerical `gameId: 3428` validated from the packaged JSON. |
| Name matches Nexus game display name; no version suffix | Pass | `Kingdoms of Amalur: Re-Reckoning`, matching Nexus's game title. Stable `info.json.id` retained for upgrades. |
| Semantic version | Pass | `1.0.3` in info.json, package.json, package-lock.json and ZIP filename. Upload to Nexus using the same version. |
| PNG artwork, 640×360, at most 1 MB | Pass | Official Steam screenshot resized to 640×360. PNG decoding, signature, dimensions and file size verified. |
| Artwork without text, visible against dark UI | Pass | Official Steam screenshot visually inspected; no overlaid title or UI text. See [artwork source](artwork.md). |
| Extra modules in subdirectories | Pass | All runtime lib modules included and byte-checked. Packaged entry point loads with the host API double. |
| No development dependencies or third-party binaries | Pass | Explicit packaging whitelist; no node_modules, game files, mods or Save Editor binaries. |

The ZIP is built twice in the packaging test to verify repeatability, extracted,
compared byte-for-byte with source files, then used to load and run the extension.

## Testing

148 automated tests cover runtime behavior and the corrected package. CI runs those checks and ZIP builds on Windows
and Linux with Node.js 22 and 24. These exercise the extension with a Vortex API
double, not the actual Windows Vortex application.

| Guide recommendation | Status | Evidence and remaining work |
| --- | --- | --- |
| Popular-mod coverage (80/20) | Partial; percentage not established | Research and tests cover PAK replacements, videos, framework distributions/manifests/Lua, and loader companions. The uploaded KOA Reforged archive has a filename regression fixture and was checked for 35 intact payload files. Most other tests use synthetic layouts based on author instructions. A ranked set of real popular mod archives still needs installation and in-game testing. |
| Clean game installation | Automated folder tests; live test pending | Tests use fresh temporary game/staging folders and exercise setup, staging, conflicts, simulated hardlink deployment/purge and restoration. They do not replace a clean Windows game install. |
| Multiple game stores | API tests; live test pending | Steam/GOG/Epic identifiers and discovery fallback logic are tested with API doubles. No live installs from all three stores are available here. |
| Another user's computer | User feedback available; independent machine matrix pending | The user has confirmed extension installation, the Essentials page and download flow in Vortex. A separately recorded second Windows machine/store test is not available. |
| Relative paths | Pass for code and archive instructions | Mod destinations are game-relative; game and standalone tool paths derive from discovered folders. No fixed developer game/download directory is shipped. |
| Required folders exist | Pass for defined paths | `queryModPath` is the existing game root, ensured writable during setup. The standalone tool installer creates its tools/staging folders before use. No additional mod-type target folder is registered. |
| Dependency guidance | Pass | Framework mods receive a Mod Framework >=1.4 dependency rule; Essentials validates the runtime/profile state and provides download actions. User-requested guidance is on that page rather than notifications. |
| Standalone editor launch and runtime mod compatibility | Live test pending | Filesystem installation, companion preservation, tool registration, updates and rollback are tested. The cloud environment does not launch Save Editor or the Windows game or execute mod DLLs. |

Use [the live Windows checklist](live-validation.md) to record Vortex/game/store
versions, actual mod archives and results. `final: false` remains appropriate until
support has been fully tested; publishing a stable ZIP does not substitute for
those runtime checks.

## Nexus upload and listing

The updated packaging guide requires uploading to **Nexus Mods → site → Modding
Tools → Vortex Extensions**, with **one Main File**, and a version matching
`info.json` (currently **1.0.3**). `info.json.gameId` must be the numerical Nexus
ID, **3428** for Re-Reckoning. This was confirmed against the public
[games list](https://data.nexusmods.com/file/nexus-data/games.json).

Vortex picks up uploads and updates within two hours. GitHub submission issues and
prior manual reviews are no longer required. When several extensions target the
same game, Vortex lists the most endorsed one. Nexus periodically reviews
extensions after publication.

This process change is confirmed in the
[maintainer comment](https://github.com/Nexus-Mods/Vortex/issues/24501#issuecomment-6142700919)
and the updated [packaging guide](https://github.com/Nexus-Mods/Vortex/wiki/How-to-package-a-game-extension).
