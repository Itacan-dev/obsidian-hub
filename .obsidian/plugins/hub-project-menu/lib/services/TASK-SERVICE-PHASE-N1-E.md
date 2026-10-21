# N1-E handoff — Completion Binding, Historical Event Import and Statistics Parity

Prepared 2026-10-17 after inactive N1-D B2. This is a handoff, not authorization to implement N1-E, migrate tasks or activate the native backend. B2 stops for review. Review B2's report and `ItacanTaskCore/RECURRENCE-GENERATION.md` before a separate N1-E plan/approval gate.

## Evidence and problem

Frozen N1-A vector `HIST-import-double-count-risk` and its unchanged compatibility test show the hazard: a separate historical append plus creating a completed native task can represent one source completion twice. A durable historical event and a live current binding are different records. Import cannot infer that two event IDs mean two completions, or synthesize another event merely to obtain a binding.

The observed legacy source-mutation and History-persistence failures also have distinct outcomes. A History save failure does not prove a task source write failed; a source failure does not authorize publishing a completion binding. Preserve the actual source outcome and retry evidence. A pair of independent receipts is not a cross-store atomic transaction.

N1-A frozen observations, recorded task/Step History, current completion checks, historical identity aliases, null timestamps, deleted/inactive owner cohorts and all prior audit evidence remain authoritative inputs. Do not rewrite frozen vectors to fit a desired migration. Inspect the current writer/read behavior again before implementation.

## Existing native semantics to preserve

- `completion-transition.js` is the shared native task/Step completion implementation. Open-to-completed creates a distinct event and current binding. Explicit null completedAt stays null; recordedAt remains a known operation clock. Date-only due dates never supply a completion timestamp.
- Reopen uncounts the bound event, records reopenedAt and removes the binding. Recompletion creates a new event/current binding. Historical E1 remains retained, with the established mutable counted/reopened state; E2 is a separate transition.
- Task and Step completion are independent. Binding keys distinguish parent task from Step. History events retain `ownerAtEvent`, partition, snapshot title/parentTitle, optional working context/Oath/session correlation and raw legacy evidence.
- `history.record` is historical-only. Its taskId/stepId are null and legacy evidence is explicit; it cannot establish a current binding. There is no B2 historical-import command.
- B2 preparation rejects currently completed B1 initial tasks with reconciliation required. Neither N1-E nor a retry may implicitly advance a completed imported recurring task. Recurrence preparation/generation remains explicit and separate from import.

## Proposed N1-E planning questions

1. Define a versioned, auditable import contract mapping genuine legacy recorded event identities to native history and, where supported, exactly one existing current binding. Establish task/Step identity and immutable source evidence first; preserve ownership and ambiguity/quarantine reasons.
2. Specify an atomic native import for an already-completed task and its genuine historical event/current binding. Do not route through ordinary completed creation plus independent append. Preserve all raw recorded rows, including rows not eligible for a current binding.
3. Decide explicit ambiguity policies for missing/stale current checks, duplicate source IDs, repeated completions, task/Step title changes, deleted/inactive tasks, changed owners, absent source and unknown timestamps. Null remains unknown; never use import time, local midnight or due dates as historical completion time.
4. Prove exact replay and changed-payload conflict under immutable source revision/identity evidence. Preserve N1-B plans and consumed/reserved identities; do not claim cross-store atomic consumption without a reviewed authority/fence protocol.
5. Preserve source failure versus History persistence failure evidence. Separate verified source-write outcome, durable native event/binding publication and external acknowledgement. Define recovery before exposing repair/retry operations.
6. Keep all import plans, aliases, original source envelopes, full History, Oath/device state and receipts private/local. Shared export requires its separate canonical contract; mounts never transfer Resource ownership.

## Statistics parity gate

Preserve the existing five time ranges and **All time default**, historical Project/Resource attribution, eligibility for deleted/inactive cohorts, recorded/current dedup rules and null-timestamp treatment. Review the current Statistics reader and frozen vectors for exact range boundaries; no range or dedup algorithm was changed by B2.

Compare native projections to the existing reader on synthetic cases for one historical completion/current check; historical-only completion; unknown timestamp; duplicate recorded identity; different genuine E1/E2; reopened uncounted E1 and counted E2; parent versus Step; changed title; deleted/inactive task or owner; both shared Projects and all four private Resources, including mounts. Imported raw rows must remain available even when counting excludes a duplicate or a current binding cannot be established. An event lacking a timestamp is not permission to invent one for a chart bin.

## Recurrence separation

B2 schema 3 / namespace 2 has one immutable predecessor generation outcome and version-2 completion snapshots. `completion.completionEventId` identifies the current attempt; `completion.outcome.completionEventId` identifies original E1. Recompletion after reopening creates E2 while reusing A→B. Generated tasks/Steps, templates, ordinal counts and operation receipts are not completed History. A commitment to A never follows B.

Use current binding/event semantics for Statistics; do not count both a generation outcome's E1 reference and its native History event. Future import of a completed recurring occurrence requires reviewed event/membership reconciliation, not a second successor or a fabricated completion. Missing successor/ledger/receipt or recovered older ancestry is a recovery problem. The persistent recurrence fence must not be cleared as a side effect of import.

## Separate approval and verification gates

First produce an N1-E plan with exact allowed files, new command/schema decisions, immutable source/history identity mapping, transaction authority, reconciliation rules, version compatibility and protected-state inventory; stop for review. Implement only after separate approval.

Use guarded synthetic memory and OS Temp stores. Test completion/binding import atomically, explicit null timestamps, raw History retention, genuine dedup, independent task/Step events, exact replay/conflicts, stale source/reservations, faults, actual process interruption, acknowledgement loss, recovery fences and both writer failures. Rerun all existing suites and B2's explicit tests/declarations without changing frozen evidence or earlier assertions.

Production backend selection, N1-F native Oath/aliases/awaitingIndex integration, installation, Obsidian reload/restart, migration of real tasks, N3 hosting and N4 sharing remain outside this handoff. End N1-E at its own review gate. **STOP FOR USER REVIEW AFTER B2. Do not begin N1-E as part of B2.**
