# Phase 2B-1 — inactive task application boundary

This is the Phase 2B-1 implementation record. Current Phase 2B-2F-2 connects Search,
Daily Brief, Project Schedule, Project/Resource Tasks panels, Phase-editor task reads and Home Tasks to one legacy-backed facade;
native authority remains inactive. Home and Project/Resource recorded task/Step
History and Statistics completion inputs now use the same facade's explicit
recorded projection. Statistics calculations and its other providers remain
unchanged; its opening default is All time by explicit user instruction. Oath setup
candidate discovery uses a dedicated indexed oath-candidates policy. Active Oath
hydration now uses the separate legacy-backed resolveOathWork operation. Existing
enrollment, readNewWork, bridge creation, fulfillment/outcome writers and Strict
host behavior remain unchanged. Both enrollment-established delayed-index histories
are supported; allocation provenance is neither inferred nor added. See the
[committed Oath completion report](../tests/oath-committed-verification.md), the
[consolidated architecture-audit handoff](TASK-SERVICE-PHASE-2B-CONSOLIDATED-AUDIT.md), the
[Oath candidate completion report](../tests/oath-candidate-verification.md), the
[committed Oath resolution handoff](TASK-SERVICE-PHASE-2B-2F-2.md), the
[Statistics completion report](../tests/statistics-read-verification.md), the
[History completion report](../tests/history-read-verification.md),
the separate [Statistics input handoff](TASK-SERVICE-PHASE-2B-2E-2.md) and
[Oath resolution handoff](TASK-SERVICE-PHASE-2B-2F.md), the [Home completion report](../tests/home-read-verification.md),
the [remaining History/Statistics and Oath handoff](TASK-SERVICE-PHASE-2B-2E-2F.md), the [Phase-editor completion report](../tests/phase-read-verification.md),
the [Home read handoff](TASK-SERVICE-PHASE-2B-2D.md), the [Tasks panel completion report](../tests/task-panel-verification.md),
the archived [Roadmap/Phase selection handoff](TASK-SERVICE-PHASE-2B-2C-2.md), the [Daily Brief/Schedule completion
report](../tests/task-read-verification.md), the [Search record](../tests/context-search-verification.md)
and the unimplemented [Phase 2B-2C handoff](TASK-SERVICE-PHASE-2B-2C.md).

The application contract and legacy adapter are implemented independently of all
existing consumers. Markdown, Dataview and the current effective local/shared
metadata remain authoritative. No production entry point imports these modules.
There is no native adapter, store, fallback, migration, startup change or UI change.

## Files and ownership

| New file in `lib/services/` | Responsibility |
| --- | --- |
| `task-service-contract.d.ts` | Complete portable application API, DTOs, handles, drafts, capabilities, changes and reveal targets |
| `task-service.js` / `.d.ts` | One injected backend for the service lifetime; operation dispatch and lifecycle |
| `task-service-legacy.js` / `.d.ts` | Translation into the current task data/editor, ownership and history services |
| `task-service-legacy-values.js` / `.d.ts` | Existing-source handle conversion, detached DTO/draft conversion and portable input copies |
| `task-service-errors.js` / `.d.ts` | Coded application errors, unsupported operations and legacy error mapping |
| `TASK-SERVICE-PHASE-2B-2.md` | Read-consumer implementation order and integration gates |

Tests, synthetic fixtures, declaration fixture/checker and verification evidence
are new `lib/tests/task-service*` files. No pre-existing file needed editing or
backup. In particular, the editor, domain parsers, shared store, plugin entry,
installed `main.js`, dashboards and Phase 2A package are unchanged.

The facade does not import the external `ItacanTaskCore/` package. Its application
types structurally match portable owner/Phase/date concepts where useful, but are
not a second repository schema. The actual legacy validators and source parsers
remain the existing domain modules. A future native adapter is injected through
the same application interface. Runtime packaging of the core still needs a
reviewed package/artifact boundary; no absolute production require or copied core
implementation has been introduced.

## Contract and identities

`TaskService` selects exactly one injected adapter. It has no backend switch,
discovery, fallback or implicit writer. Imports have no registration side effects.
All task operations through the facade return promises. Subscription disposal is
synchronous; close drains accepted writes and releases only this adapter's resources.

`TaskHandle` distinguishes `native` UUID identities from `legacy` references.
A legacy handle contains either an existing hidden ID or `identity: null`, plus
an explicit source locator: note path, line and expected first-line title.
Existing alphanumeric/hyphen IDs, including non-UUID Inbox IDs, remain verbatim.
Paths/titles never become UUIDs. Reads never assign IDs or save metadata.

Persistent legacy IDs resolve through the current global task-data index and
source validation. An indexed move can change the source and actual owner. A
changed expected title is rejected. Missing source, unresolved index entries and
copied identities are typed errors. Global parent/Step identity checks augment the
existing data service and the source-file checks in `readTaskSnapshot`.

Unassigned locators require the same source path, line and expected title, with no
competing parent title in that note. They do not use the legacy parser's text-only
relocation fallback. A renamed temporary locator must be refreshed. Byte-identical
replacement of an unassigned block cannot establish persistent identity; therefore
all saves of unassigned parents are explicitly unsupported in this phase. Existing
UI editing of these tasks continues through its unchanged current services.

Editable snapshots expose an ephemeral adapter-scoped token and a detached draft.
The raw Markdown block and `TFile` are retained privately by the adapter. Tokens
are not task IDs, revisions, durable receipts or security secrets. They expire on
successful save, explicit release or adapter close. Call `releaseEditable` on
Cancel/disposal. A failed save retains its token for the current legacy retry
behavior; after partial failure, re-read canonical state before retrying.

Legacy Step handles contain parent identity, existing Step ID or null, and ordinal
within the editable snapshot. Commands validate these against that snapshot; an
ordinal is not a durable identity. Existing source block ranges supply Step ancestry
and sibling order. The facade contains no Markdown parser.

## DTO and editor conversion

Tasks expose title, completion, Steps and ancestry, importance, local start/due
endpoints, description, owner-qualified Phase, actual workspace owner, optional
capture source, progress, source-independent location/revision slots and edit safety.
No DTO contains Dataview objects, `TFile`, DOM nodes or raw Markdown blocks. Line
information appears only inside explicit legacy locators/reveal targets.

Legacy `necessity` maps to `importance`; `fromDate/fromTime` and `dueDate/dueTime`
map to endpoints with nullable time. Date-only and explicit `00:00` stay distinct.
No UTC conversion or new same-day time-order rule is imposed on the legacy backend.
Existing metadata read normalization and validation are reused, including date-only
ordering and owner-scoped Phase validation. Invalid incoming metadata is rejected;
existing invalid metadata reads retain the old service's normalization behavior.

The editable draft represents the current Add/Edit state, including completion
action timestamps, Step edits and capture provenance. Legacy source continuation
prose is preserved privately by `saveTaskSnapshot`, not converted to description.
The title comes from the actual editor snapshot's first line. Some Dataview display
texts include continuations: later read consumers must preserve that presentation
and search evidence explicitly before connection. See the next-phase gates.

Future native conversion must resolve unassigned/noncanonical legacy IDs through a
reviewed migration mapping, replace Step ordinals with stable Step IDs, use native
revision tokens and preserve native lifecycle/provenance. The current editor's
line-keyed pending Steps and source `file` cannot be passed directly to the native
repository. Location and workspace changes require explicit adapter conversions;
no native folder/note registry is invented here.

## Method coverage

“Delegated” below means implemented translation into the named existing service,
verified with isolated fixtures. It does not mean that any production caller uses it.

| Operation | Status | Legacy implementation | Limitations |
| --- | --- | --- | --- |
| `capabilities` | Implemented | Explicit backend/operation/guarantee description | Per-task restrictions also apply |
| `getTask` | Delegated | `HubTaskDataService.readPages`, `HubTaskEditor.read` | Requires available index and validated source; throws on ambiguous/unresolved references |
| `queryOwned` | Delegated | Global `readPages`, `getContextForPath`, validated snapshots | Physical owner only; preserves index order; fails closed on an invalid row |
| `queryVisible` | Delegated subset | Physical root for `panel`; existing `validLocation` for `workspace` | No mounted Resource expansion; Home/Oath policy is unsupported; fails closed on invalid rows |
| `readSteps` | Implemented via get | Current source snapshot Steps | No inferred durable ID for unassigned Steps |
| `readEditable` | Delegated | Existing editor read + private token | Unassigned parents can be read, but cannot be saved through this adapter yet |
| `releaseEditable` | Implemented | Removes only the adapter's snapshot token | Session-local |
| `queryHistory` | Delegated | Wizard `getCompletedTaskHistory` and existing `historyKind` | Recorded facts, not a new audit log; ID-less task correlation unsupported; source evidence may be historical |
| `resolveReveal` | Delegated | Validated current source | Explicit `legacy-source`, not a universal note assumption; native target is only a contract variant |
| `createTask` | Delegated | `HubTaskEditor.create` | Explicit existing legacy destination and actual owner; returns source result, `task: null`, refresh required |
| Creation retry | Delegated subset | Existing `hubTaskId`/`createdWithIdentity` path | Caller must already own its established retry ID; checks existing title/owner, not full-payload receipt equality |
| `saveEditable` | Delegated | `HubTaskEditor.save` → `saveTaskSnapshot`, metadata save/history | Existing parent ID required; source block and effective metadata checks, no durable revision |
| `setCompleted` | Delegated | Existing editor save completion | Add/Edit semantics only; ordinary checkbox/Tasks-plugin recurrence bridge remains separate |
| `addStep` | Delegated subset | Existing editor save | Append at parent level only; IDs allocated only when existing mutation semantics require them |
| `editStep` | Delegated subset | Existing editor save | Title only; ancestry/order changes rejected |
| `deleteStep` | Delegated | Existing editor block removal | Explicit cascade required for descendants |
| `setStepCompleted` | Delegated | Existing editor save transitions | Does not complete parent; completion timestamps/history retain editor semantics |
| `reorderSteps` | Deferred, typed unsupported | No write | Existing editor does not implement arbitrary reordering |
| `changeAssociations` | Delegated subset | Editor owner-scoped Phase validation/save | Same owning Project's Phase or null only; owner/location relocation deferred |
| `deleteTask` | Delegated | Existing editor delete | Removes task block and Steps; retains historical evidence through existing housekeeping |
| `archiveTask` | Deferred, typed unsupported | No write | Legacy archive has no equivalent standalone command |
| `clearCompleted` | Deferred, typed unsupported | Existing plugin clear workflow remains untouched | Archive/history/check removal and optional confirmation need Phase 2B-3 delegation |
| `subscribe` | Delegated | One task-data subscription per adapter | Refresh/invalidation only, no per-command commit promise |
| `close` | Implemented | Drains accepted writes, disposes own watcher/tokens | Does not destroy shared task-data/editor or current UI subscriptions |

## Guarantees and error behavior

Legacy capabilities explicitly report false for durable revisions, atomic task/history
commits, generic persistent idempotency, native location references, facade relocation
and portable native sharing. Existing Git sharing remains true. The creation ID seam
is narrower than a generic operation receipt. Do not resubmit arbitrary failed creates
without their existing caller-owned retry mechanism.

Every delegated save result is `legacy-applied`, with `historyPersistence: unconfirmed`
and `refreshRequired: true`. The old editor may catch a history write failure, retain
the saved note and show its existing Notice; this adapter cannot observe a stronger
history acknowledgment. No result is labelled a native committed transaction. A
successful mutation supplies a detached resulting DTO when the editor returns one;
create returns only the existing source file outcome and never guesses by title.

Errors use `TaskServiceError` with stable `code`, `details` and original `cause`:
`VALIDATION`, `SOURCE_MISSING`, `REFERENCE_UNRESOLVED`, `STALE_REFERENCE`,
`AMBIGUOUS_REFERENCE`, `STATE_CONFLICT`, `READ_FAILED`, `WRITE_FAILED`,
`PARTIAL_FAILURE`, `UNSUPPORTED`, `CLOSED`. Source and metadata guards remain the
actual legacy guards. An ambiguous legacy message can cover moved/changed/copied
identity; the cause is preserved rather than claiming exact diagnosis.

Note writes use existing `processTaskWrite` through the editor; metadata uses the
existing data store; progress uses the existing Wizard implementation. Compensating
rollback can itself fail. Such exposed partial failures require inspection and are
not converted to success. Cross-file transactions, generic receipts, recovery and
cross-vault identity locking have not been added.

Queries validate indexed rows against current source one at a time, and are not
atomic workspace snapshots. They currently reject the whole query on an unresolved
or ambiguous row. Existing views can display such rows with blocked editing instead;
per-row diagnostic/query parity is a required Phase 2B-2 gate, not claimed complete
UI compatibility. Source reads and repeated global identity checks also need host
latency measurement before broad dashboard use.

## Sharing, visibility and notifications

Metadata is read from the Wizard's effective state after its unchanged local/shared
load. Writes go through the same editor/data-store partitioning. The adapter does
not merge raw local/shared maps, derive sharing eligibility or replace the allowlist.
Actual source ownership comes from `getContextForPath`; a viewing Project or mounted
Resource folder never changes that ownership. Itacan and Obsidian Hub remain the
two existing shared roots. Native Git transport is unimplemented and inactive.

`panel` visibility retains the existing recursive physical-root selection used by
Project/Resource panels. `workspace` retains `validLocation`, as used by Schedule
and planning reads. Neither expands mounted Resources. Home's active/selected
contexts and Oath eligibility remain in their unchanged current consumers.

The adapter adds one subscription to the existing task-data service when its first
listener arrives and disposes it after its last listener leaves. That service still
coalesces vault structural and completed Dataview import notifications and local
midnight invalidation. Events say `kind: invalidation`, `durability: unknown`, and
`requiresRequery: true`. They have no fabricated task-ID set or commit revision.
Reads never emit events. Both synchronous and asynchronous subscriber exceptions
are isolated, as are error-reporting exceptions. Metadata invalidation continues
through existing services; no competing raw vault writer/subscription was installed.

See `../tests/task-service-verification.md` for executed tests and safety evidence.
Stop here for Phase 2B-1 review.
