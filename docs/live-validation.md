# Live Windows validation

Automated installer tests cannot establish game runtime compatibility. Keep
`final: false` until these checks have passed on a real Windows PC with Vortex.
Record the Vortex version, game version/store, DLCs, mod/file versions, actual
archive tree, and results. Obtain the mods from their authors; none are bundled here.

1. Install the built ZIP through Vortex's Extensions page and restart. Confirm
   the game entry, tile, and manual discovery requirements. Check automatic Steam,
   GOG, or Epic discovery for the store being tested. Launch through Vortex.
2. Purge any existing managed mods. Back up manually changed game files and saves.
   Record the original `data/patch_0.pak` hash.
3. Install a compatible variant of Clean Menu (Nexus mod 20). Confirm the staged
   and deployed file is `data/patch_0.pak`, without an extra mod-name directory.
   Launch the game and observe the menu change.
4. Install a second compatible PAK replacement. Confirm Vortex detects the shared
   target, select a winner, deploy, and observe that winner's behavior. Disable it
   and verify the other mod is deployed. No merging should occur.
5. Disable both replacements and deploy/purge. Confirm the original PAK hash is
   restored and the unmodified game launches. Check Vortex's external-change prompts
   separately rather than overwriting manually modified originals.
6. Install No Logos (mod 4), checking its actual archive tree. Verify deployment
   under `data/videos` and the skipped logos; purge and verify restoration.
7. Install Mod Framework (mod 9). Inspect its real archive tree and runtime DLLs.
   Install one matching framework mod, such as Dynamic Difficulty (mod 80).
   Confirm the manifest is directly in `mods/`, script references resolve, and
   the framework loads it. Check the framework/game/mod versions for compatibility.
8. Install ReShade manually, then a preset such as Pure Amalur (mod 6). Select it
   in the overlay and confirm effects/shader dependencies. Purge the preset and
   confirm the separately installed runtime remains intact.
9. Import a save editor, a save download, and an archive with two PAK variants.
   Confirm each gets an explanatory cancellation and leaves game files unchanged.
10. Purge before a store repair/update; test redeployment using mods compatible
    with that updated version. Confirm the new original files are not replaced
    with an obsolete backup.
11. Open **Amalur Essentials**. With no framework, confirm that the required
    row identifies missing runtime DLLs and that the other three rows are optional.
    Enable/deploy the framework and refresh: the framework row should pass. Disable
    or purge it and confirm the row updates. Check the optional editor at its portable
    and custom paths; enable/disable the two recommended mods and check their rows.
    Browser links should open their author pages without marking a check passed.
    Confirm there are no setup/recommendation notifications and the page is hidden
    when another game is active.

Automated ZIP contents are verified; live game loading is not verified in
this cloud workspace. If a package does not match a supported layout, collect its
file list and the author's instructions before extending the routing rules.

12. In **Amalur Essentials**, use **Download with Vortex** for a missing mod.
    Confirm the correct main file enters Downloads with Nexus metadata; install,
    enable, and deploy it, then confirm the status updates. Test Premium and free
    accounts: website authorization may still be required for a free account.
13. Use Save Editor **Download & install**. Confirm only a remaster 3.x main file
    is offered, the full archive is installed in tools/KoAR.SaveEditor under the
    game folder, and Dashboard > Tools launches it with that working directory.
    No managed mod or deployment should be required. Also test **Install downloaded
    copy** with an existing completed Nexus mod 8 download.
14. Cancel file selection or Nexus authorization and retry. Confirm the button
    becomes available again. Confirm the secondary Mod page link still works.

15. Replace an existing Save Editor installation. Confirm the previous folder and
    user settings remain in a sibling backup folder. Test a corrupt archive and
    verify the previous installed tool is preserved and no success is reported.
16. Change mod profiles or purge mods. Confirm the standalone Save Editor remains
    installed and linked. Confirm the game launcher is still the primary tool.
