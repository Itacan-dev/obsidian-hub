# Native Task Location Picker - verification

2026-10-24. Implemented and installed in ordinary Work; no commit or push.

## Result

The existing compact Add/Edit editor opens a 560px breadcrumb browser. Each level contains immediate physical subfolders and Markdown notes. Folder navigation does not select; `Choose this folder` proposes the folder, and `Use location` confirms the editor draft. Workspace root is valid. Cancel/Escape preserve the draft, and cancelling the editor does not mutate tasks. Up/Down/Home/End support row navigation. Empty folders, long names, scroll, focus restoration and fresh light/dark modals were checked in genuine Obsidian.

Add chooses any ready native Project/Resource and respects the opening destination; ordinary Home Add retains its Explorations default through the native service. Edit supports location changes within the existing owner, through the existing atomic Save. Moving an existing task between owners remains unsupported: the selector is disabled and the adapter rejects it before effects. No delete/recreate transfer is used.

Physical Resource ownership wins over Project mounts. The indexed location provider uses immediate TFolder children, caches presentation catalogs with filesystem/metadata invalidation, and supplies fresh owner catalogs for admission. It does not rescan the entire vault for each picker interaction or task row.

Git locations use bounded `workspace-location:v1:` references derived from SHA-256 over normalized owner identity, location type and workspace-relative path. Absolute/device paths are not persisted. Existing Resource aliases remain readable. Two real Git working-copy tests exchange location-bearing tasks without changing the protocol or genesis.

Shared card formatting omits the owner inside its workspace, includes it outside/Home, and reduces long routes to first / ... / last with the entire route in the tooltip. Root locations have meaningful labels. The picker retains the entire breadcrumb route.

Missing/renamed destinations remain explicitly unavailable, never redirected. A narrowly scoped optional UI projection reports unresolved location evidence while keeping ordinary strict reads unchanged. Completion controls reject unavailable locations, and guarded Edit Save can select a valid replacement.

## Approved receipt and Schedule corrections

Adding current folder/note catalogs changes the presentation inventory digest. The separately approved bound-receipt correction confirms already committed requests using the same validated bound authority, owner, physical root/dashboard, partition, identity and immutable receipt. Git bulk confirmation uses the same rule. Original commands, request identities and replay guards remain unchanged; missing/conflicting receipts and stale replay remain blocked. Persistence, receipt formats and N4 protocol are unchanged.

Actual Schedule verification exposed a pre-existing dashboard seam omitting `path` and `status` from its workspace argument. With explicit approval, the dashboard now forwards `current.file.path` and `current.status` unchanged. Native validation was retained. A focused actual-caller regression covers active/future/shelved/missing status without defaults. Actual Overview/Week/Month passed in all four currently active Projects, including both Git-shared Projects. Future/shelved opening restrictions were not bypassed or changed.

## Verification

- Combined focused selection: 121/121 checks, covering picker/provider, real native writer, startup/multi-owner routing, recovery, scoped capture, responsiveness, Home/Schedule, retained Git operations/admission and existing task forms.
- Final focused recheck: 9/9, including the additional actual-dashboard Schedule contract case (eight repeat existing picker cases).
- Four declaration runners passed with TypeScript 6.0.3 and zero diagnostics: host, scoped capture, integration, Home/Schedule.
- Genuine disposable Obsidian: 32 startup/permanent-Project checks and 14 multi-owner/Resource checks; actual modal interaction, native create/Save/reopen, missing-note replacement, properties/Step identities and cleanup without completion History. Both light and dark 560px picker captures inspected.
- Existing two-copy Git runtime/admission fixtures passed with portable locations, unchanged origin receipt evidence, inventory changes, stale replay rejection and reconstruction. The focused selection includes existing relevant process-death recovery.
- Ordinary installed Work: all eleven owners ready; original Pulsed task present; Home Add and actual Edit picker draft/navigation/cancel checked twice, without task writes. Combined History reader and existing Statistics modal load; recovery command remains accessible.
- Warm installed navigation: Home 267/270/282ms; Workspace 503/528/689ms across three repetitions. No task-loading warnings after readiness. This is a warm regression check, not a new cold-start performance study.
- Actual process restarts and four ordinary graceful shutdowns exercised. Every shutdown released all eleven writer locks with no quarantine, deletion or force-unlock.

The Windows UI helper could not initialize. Actual Work checks used the installed application's existing actions and local Electron diagnostic connection, with real visible application windows. Chromium temporarily reported its open window as hidden, stalling a reading view; foregrounding and normal reading-view refresh restored rendering. No lifecycle or renderer workaround was installed. The final application launch omits diagnostic flags. The normal `Home - Work - Obsidian` window is responsive, all eleven leases belong to verified live Obsidian processes, and the temporary diagnostic endpoint is closed.

Historical frozen-source assertions were not changed or rerun; the statements above refer to the focused selections, not the full historical archive. Raw earlier failures remain in the audit directory: theme-transition screenshots, initial missing-location/receipt cases, Schedule context rejection and a future-Project opening timeout. No assertion was weakened.

## Installation and preservation

Only `main.js` and the location-picker stylesheet changed among installed assets. Eleven sidecars remain byte-identical. The staged production closure was rebuilt from current sources and reproduces the exact tested bundle (250 modules).

Installed main.js SHA-256: `ff97448744856ca0d9d5bd54ac758457c37613643ea18b3f7e88e01a4d913914`.

All 108 files in the eleven native repositories matched the initial capture exactly after verification, including their receipts and retained requests. No real task was created, edited, completed or deleted for testing. The original Pulsed task remains intact. All 182 Legacy History records deep-compare equal. Shared source/authority evidence and the other protected assets remain unchanged. Application presentation state (`hubState`, `workspaceMode`) changed independently and through ordinary navigation; it was preserved, not restored. Git HEAD and logical index entries are unchanged; no staging, commit, push, cleanup or history rewrite occurred.

Durable rollback, refreshed compatibility package and raw evidence:

- Rollback: `C:\Users\El_Baraka 2025\AppData\Local\Itacan\InstallBackups\v1\Task-location-4d601f08-703c-4d56-8ab2-de3992927fc4` (13 original assets plus prior dashboard sources).
- Compatible client: `C:\Users\El_Baraka 2025\AppData\Local\Itacan\InstallBackups\v1\Task-location-4d601f08-703c-4d56-8ab2-de3992927fc4\compatible-client`. Its checker passes against the installed 13 assets and two dashboard sources. N4 packet/frame/witness/retention versions remain unchanged. Upgrade clients before using new Project folder/note references; the old package hashes are obsolete. Jinhao was not deployed or verified here.
- Raw audit: `C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-task-location-1bjb4jlv`.

## Exact changed-file inventory

- `.obsidian/plugins/hub-project-menu/lib/domain/native-task-location.js`
- `.obsidian/plugins/hub-project-menu/lib/services/home-task-read.js`
- `.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js`
- `.obsidian/plugins/hub-project-menu/lib/services/native-task-locations.js`
- `.obsidian/plugins/hub-project-menu/lib/tests/native-task-location-picker-verification.md`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-card.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-editor.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-live-form.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-location-picker.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-steps.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-view-primitives.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/task-workspace.js`
- `.obsidian/plugins/hub-project-menu/main.js`
- `.obsidian/plugins/hub-project-menu/plugin.js`
- `.obsidian/plugins/hub-project-menu/styles.css`
- `ItacanTaskCore/host/editor-read.d.ts`
- `ItacanTaskCore/host/editor-read.js`
- `ItacanTaskCore/host/index.d.ts`
- `ItacanTaskCore/host/repository-host.js`
- `ItacanTaskCore/host/tests/scoped-capture-types.fixture.ts`
- `ItacanTaskCore/integration/project-runtime.d.ts`
- `ItacanTaskCore/integration/project-runtime.js`
- `ItacanTaskCore/integration/tests/multi-owner-obsidian.cjs`
- `ItacanTaskCore/integration/tests/multi-owner-rollout.test.cjs`
- `ItacanTaskCore/integration/tests/native-location-obsidian.cjs`
- `ItacanTaskCore/integration/tests/native-location-runtime.test.cjs`
- `ItacanTaskCore/integration/tests/native-location.test.cjs`
- `ItacanTaskCore/integration/tests/obsidian-host.cjs`
- `ItacanTaskCore/integration/tests/startup-host.test.cjs`
- `ItacanTaskCore/integration/tests/startup-obsidian.cjs`
- `ItacanTaskCore/shared/tests/production-admission.test.cjs`
- `ItacanTaskCore/shared/tests/production-runtime.test.cjs`
- `System/Dashboards/Home/view.js`
- `System/Dashboards/Project/view.js`
