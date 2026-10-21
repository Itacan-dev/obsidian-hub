# Inactive native task repository — Phase 2A

This standalone CommonJS package implements task-domain contracts and two storage
adapters. Nothing imports it from the running plugin. It has no build step or npm
dependencies and does not discover a vault, settings, Markdown or Project data.

Native activation, migration, consumer adapters, location registry, UI, Oath
policy and Git synchronization are outside this package's current integration.

## Modules

| File | Responsibility |
| --- | --- |
| `src/contracts.d.ts` | Portable schema, commands, results, queries and repository API |
| `src/domain.js` | Full-record/state invariants and injected reference validation |
| `src/value.js` | Strict portable JSON values and deterministic key serialization |
| `src/commands.js` | Shared command semantics, identity reservation and completion transitions |
| `src/repository.js` | Serialization queue, revisions, receipts, queries and notifications |
| `src/indexes.js` | Rebuildable task, owner, date, Phase, location, history and operation indexes |
| `src/memory-repository.js` | Complete reference adapter with reusable in-memory backing storage |
| `src/node-directory.js` | Narrow Node filesystem and advisory writer-lock port |
| `src/json-repository.js` | Checksummed generations, manifests, recovery and retention |
| `src/serialization.js` | Pure share-eligible partition encoding/decoding and head comparison |
| `src/errors.js` | Typed errors with stable codes and structured details |

The portable entry point `require('./src')` loads no Node, Obsidian, Dataview,
Electron or browser modules. Supply an ID factory to the memory adapter. JSON
has a separate entry point and defaults to Node's UUID factory. The core uses
only ordinary language APIs and an injected clock/resolvers.

## Example, deliberately disconnected from Itacan

```js
const { randomUUID } = require('node:crypto');
const { createMemoryRepository } = require('./src');
const owner = { type: 'project', id: 'synthetic-project' };
const repo = await createMemoryRepository({
  idFactory: randomUUID,
  partitions: [{ id: 'synthetic-private', kind: 'private-project', owner }]
});
const result = await repo.execute({
  type: 'task.create', operationId: 'caller-owned-create-1',
  payload: { task: { owner, title: 'Synthetic task' } }
});
await repo.execute({
  type: 'task.complete', operationId: 'caller-owned-complete-1',
  taskId: result.task.id, expectedRevision: result.task.revision,
  payload: { completed: true }
});
await repo.close();
```

For JSON, call `createJsonRepository` from `./src/json-repository` with an
**explicit absolute, existing, empty directory** and explicit partition
definitions. Reopen only with `openJsonRepository({ directory })`.
Open never creates a missing store. Creation refuses unfamiliar existing files.
Imports have no side effects. Never use a live vault directory for experiments.

## Schema and validation

Task IDs and Step IDs are canonical lowercase UUIDs. Workspace and location IDs
are opaque portable identifiers; names and paths are not identity. Exactly one
partition owns each workspace. A task's partition is selected from its owner,
never supplied as an independent creation override.

Tasks retain title, completion/time, importance, local start/due endpoints,
description, Project-qualified Phase, Steps, lifecycle timestamps, capture
provenance and migration evidence. Unknown top-level fields are rejected rather
than silently dropped. Future legacy properties can be preserved explicitly in
`migration.evidence`; this is not a Markdown importer.

Existing field correspondence for the later adapter/importer:

| Current field | Native field |
| --- | --- |
| `text` | `title` |
| `hubTaskId` | `id`, when a valid native UUID; noncanonical legacy aliases need explicit reviewed mapping |
| `necessity` | `importance` |
| `fromDate` / `fromTime` | `start.date` / `start.time` |
| `dueDate` / `dueTime` | `due.date` / `due.time` |
| `phaseId` | `phase: { projectId, phaseId }` |
| `description`, `captureSource` | Preserved explicitly |
| Markdown Step ancestry | `taskId`, `parentStepId`, `order` |
| Legacy source/status/continuation evidence | Explicit future migration provenance, not a fabricated native path |

Date strings remain Gregorian local `YYYY-MM-DD` values; times are `HH:mm` or
null. Leap days, cross-year ordering and same-day times are checked without UTC
conversion. Missing start time means 00:00 for comparison; missing due time means
23:59. Explicit due 00:00 stays midnight. Unknown imported timestamps may be null.

Steps are a flat adjacency collection with explicit parent IDs and sibling order.
Array position does not imply ancestry or ordering. Sibling orders are unique
nonnegative integers; gaps are valid. Reordering names exactly the current siblings
and assigns contiguous orders. Parent deletion requires explicit cascade. Removed
Step IDs remain reserved, so historical references cannot attach to new Steps.

Non-root locations require `resolvers.location`, which returns the referenced
identity and owner. Phases require `resolvers.phase`. Missing resolver or invalid
reference rejects the command. These services are not invoked through Obsidian.
Opening a store performs structural integrity validation without filesystem
location resolution; each task-changing command revalidates its associations.

## Repository semantics

`execute` accepts the discriminated commands declared in `contracts.d.ts`:

- Task create/batch-create, property update, explicit association/owner change.
- Complete/reopen, archive/unarchive and logical delete.
- Add/edit/reparent/reorder/delete/complete/reopen Steps.
- Append explicit historical-only evidence without inventing task identities.

Existing-task commands require the parent task revision, including Step commands.
Optional repository revision checks add store-wide optimistic concurrency.
Errors include `VALIDATION`, `IDENTITY_CONFLICT`, `REVISION_CONFLICT`,
`REPOSITORY_CONFLICT`, `OPERATION_CONFLICT`, `REFERENCE_UNRESOLVED`, `NOT_FOUND`,
`TASK_DELETED`, `LOCK_HELD`, `LOCK_LOST`, `INTEGRITY`, `UNSUPPORTED_SCHEMA`,
`RECOVERY_REQUIRED`, `IO_ERROR`, `ACKNOWLEDGEMENT_LOST` and `CLOSED`.

Keep the original command and operation ID for retry. Identical canonical payload
replay returns the original committed result, with `replayed: true`, even if the
task subsequently changed. A different payload with that ID fails. Receipts are
checked before stale task/repository revisions. Key order is immaterial; omitted
versus explicitly supplied fields are different payloads. Receipts survive JSON
restart. A no-op with a new operation ID commits a receipt/repository revision,
but does not fabricate a task revision or completion event.

Completion commits task/Step state, binding, history and receipt together.
Reopening marks the prior event uncounted and removes its current binding while
retaining its original snapshot. Queries default to all retained evidence;
`queryHistory({ counted: true })` supplies counted progress. Recompletion creates
a new event and one active binding, not cumulative counted toggles. Deleting a
task or Step detaches bindings and retains historical evidence. Archival preserves
completion. Step completion does not complete the parent task.

History distinguishes owner at event time, optional working workspace, Oath and
session. It implements no Oath fulfillment or Statistics attribution policy.
Historical-only records may have null task/Step IDs and timestamps and must carry
explicit legacy evidence. Matching titles never creates a relationship.

`coordination` on a command stores private durable service/operation correlation
and optional evidence in the receipt. An external Inbox/Phase service can query
that receipt after an interrupted acknowledgment. This is **not** a transaction
across external services, an outbox delivery service, or a collaboration protocol.

Results contain canonical IDs, task/repository revisions, committed snapshots,
operation identity, affected task/event IDs and partition revisions. Reads and
notifications return detached values. Internal repository state is private.

Queries use reconstructed owner/completion/date/Phase/location indexes, with ID,
history and operation maps. Date indexes select calendar-day ranges; optional
predicates inspect detached records. `queryScope` is a synchronous injected hook
for Phase 3 hierarchy/mount IDs. No filesystem ancestry is implemented here.

Subscriptions fire only after committed publication. Replays and rejected
commands do not notify. An acknowledgment-loss error represents an already
committed transaction and does notify once. Subscriber exceptions/rejections are
isolated and optionally reported through `onSubscriberError`. Close drains queued
commands, releases the writer and disposes subscriptions; future calls fail.

## Private/shared boundaries

There are three explicit partition kinds: `private-project`, `resource`, and
`git-project`. Eligibility is trusted configuration using stable workspace IDs.
It cannot be inferred from a view, mount, title or remote packet.

The initial JSON adapter keeps one **private local** generation spanning logical
partitions so a command can atomically relocate a task between registered owners.
This file is not a future Git transport format and must never be committed.
The contract does not require future storage adapters to put all records in one
device file: portable Project partition packets have independent heads/revisions.

`exportSharedPartition(id)` emits only tasks owned by an explicitly eligible
Project. It includes native task/Step properties and stable opaque completion
references. It excludes capture provenance, migration evidence, history snapshots,
Oath/session details, receipts, other partitions and global store identity/revision.
The completion event UUID can be exchanged without exchanging private event data;
a future adapter must preserve it instead of generating progress again on import.
Deleted-task tombstones and stable Step IDs remain in eligible task records.

Resource tasks remain Resource-owned even if `queryScope` makes them visible in a
Project. That does not authorize export. Serialization rejects mismatched owners,
partition metadata, duplicate identities and missing/invalid completion bindings.
Records and Steps are sorted deterministically; object keys are canonicalized.
User-authored content of a shared task is shared content; no claim is made to
automatically redact prose that a user puts in a shared task.

Decoding a packet validates and returns data only. It does not write/import or
synchronize it. A future receiver must validate against its trusted expected
partition and resolve location/Phase identities. Head comparison recognizes exact
agreement and direct ancestry; everything else requires additional ancestry or
explicit conflict resolution. Revision number alone never chooses a winner.

See [persistence protocol](PERSISTENCE.md), [executed verification](VERIFICATION.md)
and [Phase 2B handoff](PHASE-2B.md).

## Running isolated checks

With Node 20 or newer, from this directory:

```sh
npm test
npm run benchmark
node tests/typecheck.cjs /absolute/path/to/an/existing/typescript.js
```

No dependency install is needed for repository tests. The optional declaration
check uses an explicitly existing compiler. Tests create uniquely named OS Temp
directories, verify their resolved cleanup paths, and delete only those fixtures.
They never copy or open the user's real task dataset.
