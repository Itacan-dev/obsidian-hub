# Strict Oath Phase 5 — recovery, verification and installation

Implemented 8 October 2026. The rebuilt plugin is installed in this vault,
with Strict still disabled on every existing device bucket. Installation did
not change `data.json` or restart everyday Obsidian. Stop here for review.

Open [Strict Oath Preview.cmd](../Projects/Itacan/Strict%20Oath%20Preview.cmd)
to inspect the working interface in a disposable profile. Follow the
[personal testing procedure](../Projects/Itacan/Strict%20Oath%20Testing.md)
before enabling Strict in an everyday vault.

## Delivered recovery behavior

- Lost or crashed docks are reconstructed with the same frozen applications.
  The regular serial observation loop performs recovery; failed attempts are
  throttled to once per fifteen seconds. Footer/status actions remain available.
- Resume and display-change handlers restore fullscreen where possible and
  reposition the dock in the host display's work area. Restoration retains the
  original normal bounds unless they are unreachable after a display disappears.
- Renderer loss releases guards. A new process records the persisted active
  commitment as interrupted once, without automatically entering fullscreen.
  Main-process ownership survives a completed plugin reload without duplicate
  guards or docks. Another window in the same process cannot acquire ownership.
- Release disarms guards first, removes power/display listeners, disposes the
  dock and coalesces overlapping restoration requests. A failed restore retains
  its snapshot, blocks new activation, and exposes **Restore window** in Settings
  → The Oath. That action cannot release an active commitment.
- A destroyed-window cleanup callback now uses its retained WebContents reference
  instead of accessing a destroyed BrowserWindow property.

The product remains a behavioral commitment tool. Windows escape, focus
restrictions and incomplete application observations are accepted limits. No
external application is closed or terminated by the product.

## Personal preview and development recovery

The preview reuses the Phase 1–4 harness, installed Obsidian archive and existing
test Electron. It opens actual Settings/Oath UI and a separate ordinary companion
application, with synthetic workspace/task/index adapters and a disposable vault.
It starts with Strict off. The test-only permission helper can copy verified
executable identities of currently observed applications into the disposable
whitelist, avoiding closure of the person's everyday applications.

Native shortcut and watchdog restoration must pass before restrictions are
available. A separate sandboxed recovery window offers **Release restrictions**
and **Finish and clean up**. Local **Ctrl+Alt+Shift+F12** works in preview Electron
windows, including the recovery panel; switch back from an external application
first. Strict guards have a two-minute deadline. The entire preview has a
twenty-minute deadline and the companion has an independent heartbeat lease.
Cleanup removes the disposable profile. A new preview is required after release.

These entrypoints and escape mechanisms live only under `lib/tests/` and the
explicit preview launcher. They are absent from production bundles and the
production asset manifest. The production plugin has no two-minute release.
No keyboard hook, privileged service, native dependency, registry modification
or Electron/Atlas security relaxation was added. The installed `obsidian://`
handler still points to `C:\Program Files\Obsidian\Obsidian.exe`.

## Verification results

| Verification | Result |
|---|---|
| General Node regression run, 51 files | 115 entries pass; Oath, tasks, scheduling/history, Settings, Music, navigation, shared resources and packaging |
| Atlas Node regressions | 32 pass |
| Isolated Obsidian release suite | 20 checks pass, including prior Settings/review/dock tests, actual plugin reload, actual dock renderer crash, Settings restoration retry and fresh-process restart |
| Interactive preview smoke | 5 checks pass, including prerequisite recovery, actual Strict activation, independent-panel release and the preview's own shortcut wiring |
| Real Electron Atlas suite | 22 pass, including focused sandboxed guest authorization while Strict fullscreen/dock are active |
| Installed bundle load plus original recovery fixtures | 11 entries pass |
| Ordinary Oath and Settings browser fixtures | Both pass, including narrow layouts and existing interaction regressions |
| Build/install | 133-module main bundle, 20-module Atlas bundle, nine explicit Strict assets; installed hashes verified |
| Isolation | Successful automated Obsidian runs report copied source unchanged and temporary profiles removed; normal data unchanged during installation; zero enabled normal-device buckets |

Native runtime: installed Obsidian 1.13.7 archive in test Electron 39.8.3,
Node 22.22.1, Windows x64. This is not the exact runtime of the installed
Obsidian launcher. Browser-only DOM fixtures use the existing isolated Edge
runner; Electron host, dock and Atlas security preferences were not weakened.

Evidence is in
[`lib/tests/oath-phase5/results/`](../.obsidian/plugins/hub-project-menu/lib/tests/oath-phase5/results/):
`windows-2026-10-08.json`, `preview-smoke-2026-10-08.json`, `regression.tap`,
`atlas.tap`, `atlas-native.txt`, `installed-load-recovery.tap` and
`installation.json`. Existing Phase 1–4 infrastructure and historical reports
are preserved. Five old Node fixtures needed test-only isolation repairs:
domain tests now import their actual modules instead of pulling Obsidian UI
through the export barrel; the resource-navigation fixture stubs title rendering.

## Limits and failures found

- An immediate plugin reload while prior writes were still finishing triggered
  the existing `HubStateConflictError`. No conflict protection was weakened and
  no user data was overwritten. Reload verification passes after draining pending
  writes; arbitrary mid-write hot reload is not certified. Save work and fully
  restart Obsidian if conflict protection intervenes.
- Resume/display-change and host renderer-loss **events were simulated**. Actual
  dock renderer crash and full host-process restart were exercised. Physical
  sleep/wake, display disconnects and scaling changes remain manual checks.
- The second-window test uses a separate native window in the same process.
  It does not prove every Obsidian vault/popout topology. Independent processes
  cannot share this in-memory ownership lock.
- Companion minimization/restore, host fullscreen persistence and untouched local
  Alt+Tab input pass. Physical Alt+Tab, real third-party stacking and foreground
  ownership require personal observation. Electron focus flags do not establish
  OS foreground ownership.
- Application observation is still one conventional main window per process.
  Dialogs, packaged applications and inaccessible metadata can be missed. There
  is no foreground-change detector or arbitrary external focus/minimize/restore.
  Dock actions launch a verified executable or request host focus; Alt+Tab remains
  the conventional way to return to an existing application.
- Native launch testing uses a harmless built-in executable; the green companion
  provides a controlled ordinary GUI application. Acceptance with the person's
  own applications is deliberately left to the interactive preview.

The automated Phase 5 recovery and packaging criteria are met for the tested
runtime. Personal desktop/hardware acceptance and installed-launcher equivalence
remain open. This is ready for review, not a claim of guaranteed Windows lockdown.

## Installed files and rollback

`build.js` now copies and hashes the main-process Strict module closure and local
dock assets into `strict-oath-assets.json`. Installation replaced `main.js` and
`atlas-native.cjs` and installed that manifest; source/assets already live in the
plugin tree. This is an update to the existing plugin installation.

The previous generated bundles are retained locally in
`.obsidian/plugins/hub-project-menu/.release-backups/strict-oath-phase5-2026-10-08/previous/`,
with `previous-sha256.json` alongside. The verified staged build is in the sibling
`staged/` folder. Backups stay out of Git. For a bundle rollback, save work, quit
Obsidian, copy the previous `main.js` and `atlas-native.cjs` back into the plugin
folder, then reopen Obsidian. This does not revert source edits or user data.

Installed SHA-256 values:

| File | SHA-256 |
|---|---|
| `main.js` | `838dd84ec72cf66d6a0dc38b4c8e56ebf8cb6b8cd6d4675c42d4b78652e6cb05` |
| `atlas-native.cjs` | `e3ed257bc48962b283fba63c24d5fd5acc348906587827387ab4971b31db92681c` |
| `strict-oath-assets.json` | `92b854b916604d138738caf40d5fd5a266d5c2948a386cdfe30238dd6a614450` |

Save work and fully reopen everyday Obsidian when ready to load the update;
main-process modules can remain cached through a plugin toggle. Leave Strict off
until the preview satisfies your own desktop acceptance checks.
