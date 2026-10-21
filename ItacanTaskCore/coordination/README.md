# N3-C0 — private cross-authority evidence

This inactive Node evidence entry point implements only
`analyzeCoordinationEvidence(capture)` and `classifyWorkflowOutcome(observation)`.
It allocates no identities, reads no clock, opens no store, subscribes to nothing
and performs no writes. Results are detached, deeply frozen, local-private and
`executable:false`. Nothing imports it from production startup or core indexes.

`confirmed` means the selected supplied scope observations agree at capture time.
Its code explicitly says **not durability**. It is neither an admission ticket nor
an authenticated proof, an Oath fulfillment instruction or a committed workflow.
Only a trusted private harness supplies facts. Digests identify captured content;
the package does not authenticate a hostile caller. Missing participants, mismatched
receipt evidence, unavailable recovery, missing original requests and empty captures
remain explicit. A save promise cannot substitute for scope evidence. Proposed
contracts never become implemented durable protocols through this analysis.

## Existing authorities and milestones

The native repository publishes tasks, Steps, completion effects, events, bindings
and receipts together. Its private-v4 authority, writer admission, coherent reads,
creation-only atomic capability and all-write recovery fence remain unchanged.

HubDataStore clones the complete requested snapshot **before** its instance queue.
The queued work reads/checks disk, assigns a revision and prepares shared state;
preparation can copy assets. It flushes a temporary local file and renames it,
then separately publishes changed shared state. A shared failure attempts local
rollback. Only afterward does the store update its in-memory revision/signature
and resolve with a cloned logical snapshot. It supplies no domain-operation
receipt, post-publication readback or cross-process writer lease. The abstract
saveData fallback supplies no directly inspected filesystem acknowledgement.

Oath and Inbox records normally remain in local data.json. Shared Project planning
and selected task metadata live in System/Hub-shared-projects.json and are merged
on load. Planning for private Projects is local. Markdown, owner/frontmatter
observations and N1-B identity stores are separate authorities. A local save does
not prove shared publication, and shared loading is not cross-store atomicity.

Actual probes expose stale queued snapshots, independent-instance lost updates,
blind legacy saves bypassing load-time version refusal, partial local/shared
publication and preparation side effects. These are observations of existing
weaknesses. C0 fixes none of them and introduces no new persistent format.

## Oath, Inbox and Phase boundaries

F1 preparation and F2's closed synthetic save-acknowledgement → open cut → genuine
completion sequence remain separate from durable enrollment evidence. Completions
before/during save or before a valid cut do not gain causal proof from timestamps,
notifications or incomparable revision numbers. Scheduling and activation remain
distinct. Current parent binding and genuine creation receipt/effect are required;
Steps, import and initial checked state never substitute for parent work.

Actual Oath methods retain the in-process latch after a save rejection. Persisted
fulfilledAt survives reopening; an unpublished latch can be lost after restart.
Terminal current/History publication precedes enforcement release. Repeated accepted
exits remain inactive. Deadline fulfillment and fake Standard/Strict recovery are
exercised without physical enforcement. No stored proposal is accepted as F2 ordering.

Inbox already prepares capture/operation/task IDs and freezes retry details.
Those legacy meanings are not automatically native receipt bindings. Native creation
and Inbox acknowledgement remain separate. The selected future policy retains a
draft for review if its verifiably created task was subsequently deleted. It never
recreates the task. Changed drafts, missing receipts and lost authority cannot
authorize new identities. Notes/attachment workflows are not native transactions.

Phase revisions protect stale legacy editors. Legacy delete-and-clear changes
planning/task metadata in one application snapshot; native references are another
participant. Closed native Phase resolvers can accept a snapshot after separate
planning deletion. A future staged deletion needs assignment admission, exact
clearing operations and final planning acknowledgement. No such protocol exists here.

## Proposals and privacy

Declarations label future enrollment, fulfillment, Inbox acknowledgement and Phase
deletion evidence as proposals with `executable:false`. They choose no disk namespace,
application schema, coordinator, journal or new authority. C1 must review storage
isolation, acknowledgement, supported-writer admission, unknown versions and
retention before these can become persistent contracts.

Both shared Projects, a private Project and all four Resources remain physically
owned. Mounts change presentation only. C0 has no public packet/export API. Native
export restrictions are preserved. Actual legacy broad metadata copying and
out-of-root captureSource exposure are recorded separately; they confer no future
privacy permission and are not repaired in this gate.

## Verification

Run the seven explicit test files in the approved C0 plan, plus the declaration
runner. The harness composes actual existing production methods with reviewed inert
fixture seams. Critical application evidence uses actual HubDataStore and
SharedProjectStore writes. UI/clock/Strict hosts are fake; persistence is real.

The source graph preserves actual code bytes/origins/hashes. JSON evidence resources
are pinned to exact originals retained in the private sealed package. Frozen
executed observations and future decision vectors are separate. Child termination,
injected exceptions, cancellation, reconstruction and acknowledgement loss are
reported separately. Raw child evidence includes absence of an application lease;
native locks are preserved and moved only after exact identity/death checks.

Claims cover tested cooperative local behavior and process interruption, not power
loss, cloud rollback, hostile writers, distributed uniqueness, full-directory rollback
detection or atomic task/Oath/N1-B commits. Rich editor reads, durable protocols,
production routing, migration and N4 transport remain outside C0. Stop for review.
