# Inbox multi-selection and bulk organization

Verified 2026-11-10. The implementation preserves the pre-existing working tree and reuses the existing native task, vault operation, and location-picker boundaries.

## Behavior

- Inbox rows have accessible sibling checkboxes. They appear on hover/focus, stay visible when checked, and remain visible for coarse/touch pointers. Ordinary row navigation clears the checked selection.
- One checked item uses normal details. Two or more eligible checked items show bulk actions. Mixed captures and unrelated retained operations are excluded with a reason, including completed legacy receipts that could otherwise recreate an old result. Filter changes retain visible eligible checks; sorting preserves checked identities.
- Picker cancellation restores checked items, displayed order, active item, filter, scroll position, and unfinished location choice. A failed edit checkpoint prevents handoff and preserves the edit.
- All selected items share the confirmed destination. Tasks use the first nonblank line and the remaining description, with no dates, importance, Steps, Phase, recurrence, or completion added.
- Bulk note names use one local timestamp and parenthesized numbers starting at 1. Existing/reserved names are skipped. Exact original text is written without attribution or markers. Allocated paths remain fixed for recovery.
- Combined append preserves each capture exactly. Blank-line separators use the destination newline convention outside capture strings; there is no extra trailing newline. A single write/receipt covers all selected texts, followed by atomic source cleanup.
- Files use existing ownership, movement, collision, hash, and rollback mechanisms. Legacy file-only groups remain intact. Shared references are remapped in both captures and remaining batch inputs; file counts represent distinct paths. No companion note is created.
- Processing stops on the first failure and reports completed/remaining item counts. Remaining checked items and processing order are retained. A single remainder becomes the active normal detail with its retained retry. An already-written append explicitly reports that retry only verifies it and finishes cleanup.

## Persistence and compatibility

One private `inbox.bulk` record stores a versioned batch, frozen ordered input, destination, per-member progress, and original operation receipts. Completion and capture removal are committed together. Native operation and task identities, allocated note paths, and append hashes are reused after failures and restart.

Existing Inbox v1 data remains readable. Ordinary saves retain v1 until the first confirmed bulk batch; that batch advances the envelope to v2. Older plugin builds then refuse the newer Inbox format instead of ignoring batch locks. Legacy capture records are not migrated or split, and no TaskCore SQLite schema changes are required.

Confirmed batch members cannot be edited, deleted, or processed through another action. Retained destinations remain fixed. Unexpected destination edits, unavailable destinations, or a competing file at an allocated output path retain sources for review; retry never blindly overwrites or renumbers an uncertain result. A batch is not a transaction across SQLite and multiple vault files.

## Changed files

| File | Purpose |
| --- | --- |
| lib/domain/inbox-bulk.js (new) | Eligibility, counts, timestamp allocation, exact append formatting, and progress messages. |
| lib/domain/inbox.js | Supported envelope version and shared timestamp formatting, preserving Quick Add naming. |
| lib/services/inbox-bulk.js (new) | Durable preparation, serialized coordination, retries, and multi-source append receipts. |
| lib/services/inbox.js | Batch membership guards, atomic completion, raw bulk notes, version gating, and attachment accounting. |
| lib/ui/inbox-bulk-flow.js (new) | Shared picker handoff, counts, destination validation, and resumed actions. |
| lib/ui/inbox.js | Checked selection, bulk panel, cancellation restoration, and single-remainder retry. |
| lib/ui/task-location-picker.js | Optional selection lock for retained batches; existing callers keep the default behavior. |
| styles.css | Scoped checkbox visibility/layout and bulk-panel spacing. |
| lib/tests/capture-workflows.test.cjs | Sixteen additional bulk/domain/recovery cases, including real SQLite reopening. |
| lib/tests/capture-obsidian-fixture.cjs | Real Obsidian bulk selection, four actions, failures, cancellation, and restart checks. |
| lib/tests/run-capture-obsidian-test.cjs | Bulk and bulk-restart phases. |
| main.js | Rebuilt installed bundle. |
| lib/tests/inbox-bulk-verification.md (new) | This report. |

## Staged verification

- Baseline: 88 existing Node runner entries passed before changes.
- Final automated suite: 104/104 entries passed, including 56 capture cases. Real SQLite verification loses a creation reply, reopens the application/database, and retries without a duplicate. A pre-existing task retains its identity, owner, description, and Steps.
- Bulk acceptance: 64 genuine Obsidian assertions across processing and process restart. Both themes and a narrow viewport were checked, and screenshots inspected. Coverage includes all four actions, exact content, cancellation/order restoration, failed edit checkpoints, partial task failure, a single remaining item, grouped files, and append cleanup recovery.
- Opening regression: 82 assertions and 18 recorded first-frame snapshots pass across both themes and all sort orders, plus resumed/empty states.
- Existing polish regression: 130 assertions pass, including sort centering/chevrons/dismissal, icons, spacing, and narrow-window fit.
- Existing capture/processing/restart workflows: 175 assertions pass across four fresh processes.
- Total genuine UI assertions: 451, plus the 18 paint observations. Tests use disposable vaults and profiles, real Obsidian Modals/Vault APIs, and deterministic task responses; actual native SQLite is verified separately. File selection uses synthetic FileLists; the OS file dialog and physical touchscreen were not manually exercised.
- Bundle scope: four existing factories changed (Inbox domain/service/UI and shared location picker); three bulk factories added; no factories removed. Native TaskCore, Quick Add, and other picker modes retain their existing implementations. Atlas output is not installed by this change.

Backups, candidate, hashes, and complete logs: `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-bulk-8OuAyk`.

Evidence logs: `bulk-installed-candidate.log` (final bulk candidate), `opening-final.log`, `polish-final.log`, and `workflows-final.log`. Each records its disposable vault and JSON report directory.

The live vault was not used for test writes or restarted/reloaded. User data, unrelated planning/stream changes, and existing working-tree changes were not rolled back. No commit, push, or merge was performed. Restart Obsidian to load the installed JavaScript.
