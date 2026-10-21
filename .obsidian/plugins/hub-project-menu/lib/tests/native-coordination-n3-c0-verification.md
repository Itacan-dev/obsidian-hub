# N3-C0 — coordination evidence verification

Implemented the approved C0 gate only on 2026-10-19. There are **zero existing-source edits and exactly 23 new files**. The inactive sibling package exports only `analyzeCoordinationEvidence` and `classifyWorkflowOutcome`. Both are deterministic, private, detached, immutable and `executable:false`. They allocate no identities, read no clock, open no storage, subscribe to nothing and execute no workflow. Production entry points are unchanged.

This gate demonstrates existing persistence limitations; it does not repair application storage or implement a durable coordination protocol. C1 and all domain protocols require separate review.

## Foundation and safety

The fresh sequential baseline completed before implementation: 1,641 exact original files, 632 Git-status entries, 178 History rows and six checks. It captured protected Markdown, current plugin/application state, Inbox, Oath/Strict/device state, planning/shared/owner/mount state, workspace/Manual Sorting and installed assets. No live native pointer, generation, fence or writer-lock artifacts were found outside backups. Reparse-point exclusions are recorded.

Before editing, the B2-B archive verified against SHA256 `03e298caac71fb9c08ac081665743fed984801f964be2e112b9e9896a099852d`: all 9,047 inventoried files, 9,048 ZIP members and 46 reviewed outputs matched. Seven earlier archive seals also verified. A later continuity check compared 1,161 immutable **pre-edit C0 captures** with the sealed predecessor source/fixture/documentation state, with zero mismatches. That additional comparison ran after tests; it is not represented as a pre-edit execution.

All mutable probes and staged builds used guarded OS Temp. Actual service functions ran through existing inert fixture seams. No real Obsidian host, Strict launcher, watchdog, window/focus/input control or enforcement was started. No real repository was initialized or converted; no bundle was installed and Obsidian was not reloaded.

## New acceptance

The seven explicit C0 test files passed **143/143 checks**, with no failures, cancellations or skips. The separate declaration runner used TypeScript 6.0.3 and reported **zero diagnostics**. Runtime import-denial checks verify the pure package has no filesystem, host, identity allocation or persistence dependency.

The frozen evidence contains:

- **84 executed observations**, each uniquely accounted for and compared with its observed result.
- **43 decision vectors**: twenty adversarial cases, fourteen policy cases and nine explicit limitations. Modeled future protocols are not presented as implemented coordinators.
- **918 source files** with actual bytes, origins and hashes, plus **80 pinned JSON resources** whose exact originals are retained in the private archive.
- Source-graph SHA256 `0fbd6e90f1821d26b41b7a2ce9c10ceaa4bf7c96b13d5bdd618b6c52fa1c471d`.

Observed legacy results remain separate from proposed future contracts. Missing/unsupported evidence is explicit; empty input cannot fabricate successful totals. A matching captured observation is labelled `OBSERVED_SCOPES_CONFIRMED_NOT_DURABILITY`. It is neither an application operation receipt nor an admission or fulfillment instruction. Proposal declarations select no on-disk namespace, schema or new authority. Synthetic negative-test properties are probe data, not a persisted native Oath format.

## Executed findings

Critical application probes use actual **HubDataStore and SharedProjectStore**, including their real filesystem writes and shared preparation. They demonstrate stale queued snapshots overwriting newer domain values at a higher revision; separate instances passing pre-write checks and losing updates; shared preparation copying an asset before save failure; local/shared partial publication; rollback failure; and blind legacy saves bypassing load-time unsupported-version refusal. Independent-instance tests are not a claim of cross-process isolation. The abstract `saveData` fallback has no inspected filesystem acknowledgement.

Actual Oath methods exercise enrollment/save/cut interleavings, scheduled activation, genuine current native receipts/effects, parent-only progress, reopening/recompletion, deadline, failed saves, repeated terminal exits and fake Standard/Strict recovery. Only the explicitly closed synthetic acknowledgement → open cut → completion sequence demonstrates positive ordering. Ordinary/restored evidence remains unproven. A persisted fulfillment latch survives reopening; a failed-save memory-only latch can disappear after reconstruction. Terminal save precedes enforcement release. Native revision order does not prove independent Oath publication.

Actual Inbox methods preserve prepared identities on cleanup failure, reject changed retry details, deduplicate double Send and retain remaining content. Native boundary probes separate creation from application cleanup. A confirmed creation followed by task deletion retains the draft for review and preserves the original receipt; it never recreates the task. These are probes of existing participants, not an implemented native Inbox protocol.

Actual planning methods demonstrate revision conflicts, stable rename identity, delete-and-clear within the legacy snapshot, and failed-save rollback. A closed native Phase resolver can still accept a reference after separate planning deletion: this is an observed coordination gap, not live consistency. Shared planning uses the actual shared file.

Seven physical owners and all eight Resource/shared-Project mount combinations are exercised. Mounting does not change ownership, grant sharing or permit cross-owner Save. Native export guards remain effective. Actual legacy broad metadata copying and out-of-root `captureSource` publication are recorded as existing exposure, **not** native privacy permission. Coded C0 results contain no raw source, receipt payload, Oath outcome or Strict/device carrier.

## Actual interruption evidence

There are **23 new parent-terminated child scenarios**, distinct from injected exceptions, cancellation, reconstruction and simulated lost acknowledgement:

| Participant | Stages | Cases |
|---|---|---:|
| Local application save | Before/after flush, before/after local rename, after caller return | 5 |
| Local/shared save | After local rename, before/after shared rename | 3 |
| Attempted rollback | Before/after rollback | 2 |
| Oath enrollment | Before/after publication | 2 |
| Oath fulfillment | Before/after publication | 2 |
| Oath terminal save | Before/after publication, after caller return | 3 |
| Native creation and Inbox cleanup | Before CURRENT replacement, after publication, before acknowledgement, after native return, before/after application rename | 6 |

Every child was awaited. Evidence retains executable/arguments, stage, PID/host, exit/signal, death proof, raw files and observed old/new states. Application storage has **no lease**; this absence is recorded. Native cases preserve the exact PID/host/token lock bytes and hash, verify death and byte identity, then move only that exact lock inside its disposable root. Identical externally retained native replay returns the original task/event after publication; no replacement identity is inferred from a missing acknowledgement. No atomic cross-store outcome is claimed.

## Inherited acceptance

All **42 exact saved selections** passed: **25 behavioral selections / 3,248 checks**, and **17 existing declaration runners**. Together with C0, eighteen declaration runners passed. Only disposable guard/materialization/evidence paths were rebased; test order, arguments and assertions were preserved.

| Inventory | Passed checks |
|---|---:|
| B2-B / frozen B2-A / application B1 / N3-A | 220 / 36 / 138 / 136 |
| N2 / F2 / F1 | 127 / 124 / 160 |
| E2-R / E2 persistence / behavior / Statistics | 102 / 124 / 43 / 53 |
| E1 frozen / current behavioral | 138 / 137 |
| Recurrence B2 / B1 / B0 / Gate A | 189 / 207 / 22 / 145 |
| N1-C / N1-B / N1-A | 180 / 158 / 158 |
| N0 / core / focused legacy | 51 / 66 / 452 |
| Regression / Safe Strict | 34 explicit files / 48 |

All 138 E1 assertions ran unchanged in its frozen graph. Current-core execution retains only the established historical-source-hash exclusion. B2-A ran unchanged in its verified frozen pre-B graph. No new exclusions were introduced.

The **four original older-reader assertions** passed through actual frozen-reader execution, along with additional reader cases and B2-B's implemented version-2 codec-output tests. They were not mocked. Historical graphs, vectors, failures and original reader assertions remain unchanged. The inherited actual-helper Statistics corpus runs across its three time zones; its documented malformed-raw post-mutation unavailable case remains unavailable rather than being replaced with a successful empty total.

Each command has raw stdout/stderr, exact argument lists, scalar exit and assertion summary. Runner success is recorded separately from test success. Development fixture errors and their failed logs are retained: reused operation IDs/revision IDs, an incomplete delete payload, wrong Resource fixture keys and a deleted-task query missing `includeDeleted:true`. Only new C0 fixtures were corrected; existing tests and expected failures were not edited.

## Protected and production comparisons

The final scan found **no existing code changes, missing files, unexpected new paths or live native artifacts**. All 23 new paths match the exact allowlist.

Protected bytes changed during the gate in `.obsidian/workspace.json`, plugin `data.json` and `Projects/Itacan/Itacan.md`. Exact before/observed bytes and private differences are retained without restoration or actor attribution. Workspace changes affect `main` and `lastOpenFiles`; application changes affect `activityLog`, `dirtyContexts`, `hubState` and `workspaceMode`. History/checks, Inbox, Oath/Strict/device and planning fields did not change in that observed comparison. History remains 178 rows and six checks. Accordingly this report does **not** claim full protected-byte identity.

All **twelve** baseline/final staged assets are byte-identical. Installed hashes are unchanged. Main/Atlas retain **168/24** factories with identical module IDs, one Legacy Task Service construction and no native-package startup references. Editor, Inbox, Oath and Strict routing remain unchanged.

## Archive and review boundary

The private inert package is under `System/Backups/itacan-n3c0-20261019-xyurbs61/`. Its outer `SEAL.json` records the complete ZIP SHA256, member inventory and separate Temp/copied-archive verification. The package includes exact originals/current outputs, approved execution transcription and original planning attachment, source graph, frozen observations/vectors, commands/logs/exits, child/lock evidence, protected comparisons and build results. The execution transcription is labelled as such rather than represented as a byte-exact chat export.

Claims are limited to tested cooperative local behavior and process interruption. They exclude power-loss safety, cloud rollback, hostile writers, distributed uniqueness, complete-directory rollback detection, atomic N1-B consumption and atomic task/Oath persistence.

**STOP FOR USER REVIEW.** C0 is complete. The C1 handoff requests a separately reviewed application-storage design. No C1 implementation, durable Oath/Inbox/Phase protocol, rich-editor read, production routing, transport, migration, installation or reload is included.
