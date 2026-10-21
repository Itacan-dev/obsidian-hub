# N1-E2 — Historical import (stopped for compatibility review)

**Incomplete gate. Do not use this implementation for migration or activation.** The older-reader acceptance gate fails. The implementation and failing tests are retained for review; no production repository was created or installed.

## Contract implemented so far

`TaskRepository.execute` handles the separate version-1 `HISTORY_IMPORT_COMMANDS` catalogue: `history.prepareImport` and `history.importBundle`. Ordinary History, B1 and B2 command catalogues remain separate. The importer lazily loads Node-only E1 evidence analysis. Schema-4 validation and ordinary core operations have portable source boundaries; the full portability acceptance proof remains outstanding.

Both commands require an operation ID, expected repository revision, decision revision `N1-E2-E01-E09-r1`, exact partition guards, identity/revision/digest pins, `syntheticOnly:true`, and a reason. They accept no task revision, completion context or Oath context. The read-only `historyImportEvidence` provider must return exclusive closed-synthetic capture, external inventory and reviewed owner observations; the queued operation compares them again before commit. This is not a lease or another storage authority.

Preparation validates the unchanged E1 proposal, explicit content drafts, ownership and references. It commits schema 4, an immutable revision-1 plan, exact published N1-B reservation claims, stable event UUIDs and a normal receipt. It creates no tasks, Steps, events, bindings or compatibility activity. A second capture/allocation plan is rejected.

Publication names the prepared publication operation, plan digest/revision, bundle digest and unchanged pins. It constructs complete eligible task trees directly through the pure native constructor, attaches N1-C original envelopes/current content, inserts prepared historical events and proven bindings, and appends the immutable outcome and normal receipt in one candidate. It does not reenact completion. Source creation/modification times and original event recording times are explicitly null; the import clock is separate.

The sole full capture resides in the canonical preparation-command receipt. Namespace records and imported event provenance reference it. Supported historical-only groups have null task/Step targets. Contradictory/unsupported groups retain raw evidence without an allocated canonical winner. A completed target without proof quarantines its entire tree; supported events from that tree can remain historical-only. Quarantined approved task/Step identities stay reserved.

## Reads and subsequent activity

`getHistoryImportPlan(planId,{version:1})` returns detached private plan/outcome evidence. `historyCompatibility({version:1,projection:"recorded"|"statistics"})` is an explicit Node-only read. Before publication it reports `HISTORY_NOT_IMPORTED`. Canonical `queryHistory` remains independent.

The durable projection preserves ordered raw History and uses E1 unchanged. Imported canonical events are represented by those rows once. Genuine native events use receipt-derived publication order and reviewed closed owner snapshots. Genuine reopening suppresses the corresponding raw group through receipt-backed metadata; recompletion contributes its new event. Deletion retains activity. Unsupported native provenance or known recovery loss makes compatibility unavailable, never a successful empty total.

Direct task serialization and repository partition export reject import-dependent state pending N4. The shared completion transition and existing E1 entry point, fixtures and algorithms are unchanged.

## Blocking older-reader evidence

The actual pre-E2 schema-1, B1 and B2 reader graphs are frozen in `tests/fixtures/history-pre-e2-readers-v1.json` and the existing B1 fixture. Tests materialize them only into OS Temp.

All three old manifest decoders validate the exact manifest field set **before** testing its schema version. Adding schema-4 `requiredCapabilities` and `importRecoveryScope` therefore raises recoverable field validation instead of the required terminal unsupported-version error. The publication test returns `RECOVERY_REQUIRED`, not the approved `UNSUPPORTED_SCHEMA` barrier.

The schema-1 state validator likewise validates exact root fields before version dispatch. Behind a deliberately lowered test manifest it treats the new namespace as recoverable corruption and successfully opens an older ancestor. The acceptance test intentionally fails. B1 and B2 generation-level rejection checks pass.

This cannot be corrected inside an immutable historical reader. A compatible schema-4 wire representation or a separately reviewed reader prerequisite must be chosen before E2 can pass. No alternate representation, reader edits, ancestry removal or weakened acceptance assertion has been adopted.

## Recovery implementation and limits

The current candidate adds checksummed import scope to schema-4 manifests and a version-2 scoped extension of the existing `RECURRENCE-FENCE.json`. It retains the highest observed barrier and reserved IDs through verified fallback. Existing version-1 marker behavior is retained, with no clear operation. Import writes/replays and affected binding changes are fenced; unrelated native work can continue. The current-reader interruption/recovery tests pass, but that does not resolve old-reader acceptance.

Tests cover cooperative local persistence, injected exceptions and actual child-process exits. They do not establish power-loss, cloud rollback, hostile-writer, distributed uniqueness, complete-directory rollback detection or atomic N1-B consumption. All execution is synthetic memory or guarded OS Temp. No live source capture, migration, production hosting, installation, Obsidian reload/restart or N1-F work is included.

## Review artifacts

See `.obsidian/plugins/hub-project-menu/lib/tests/native-history-e2-verification.md` for exact verification outcomes, protected-state comparisons and the sealed stopped-gate archive. `tests/history-import-support.cjs` and the new declaration fixture show the explicit synthetic bundle and command shapes. This document describes a stopped implementation, not an accepted import API release.
