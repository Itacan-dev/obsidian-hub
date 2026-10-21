# JSON generation protocol and recovery

The storage adapter requires an explicit absolute directory. `create` requires
an existing empty directory; `open` requires recoverable committed evidence.
There is no default vault path, empty-on-error recovery or application startup hook.

## Files and revisions

- `WRITER.lock`: exclusive local writer token, PID, host and creation time.
- `gen-<revision>-<revisionId>.json`: immutable full private native state.
- `CURRENT.json`: checksummed manifest selecting one generation and bounded ancestry.
- `RECOVERY.json`: checksummed previously committed manifest.
- `candidate-<uuid>.tmp`, `manifest-*.tmp`: uncommitted evidence, never selected by scanning.
- `evidence-current-<uuid>.json`: preserved damaged/current manifest before a recovered writer replaces it.

The generation contains schema/store IDs, repository revision and UUID lineage,
partition descriptors and UUID lineage, tasks, Steps, history, bindings, receipts
and retired Step IDs. The manifest includes exact generation filenames, SHA-256
checksums, revision identities and committed ancestry. Hashes detect accidental
corruption; this is not authentication against an attacker able to rewrite both
data and checksums.

Partition descriptors pair stable workspace ownership with classification. Their
revision/head advances for related committed commands, including receipt-only
commands. Heads are opaque UUID lineage, not a hash of private content. Different
partitions advance independently. Native task revisions advance only when a task
changes. A single global revision orders local transactions across partitions.

## Commit ordering

1. Hold the exclusive writer for the repository lifetime and verify its token.
2. Read/validate the current generation; reject external manifest changes.
3. Check persisted operation ID before optimistic revisions.
4. Apply to a private candidate; validate the entire candidate and references.
5. Allocate new repository and affected-partition revisions/heads and the receipt.
6. Canonically serialize, exclusively create a uniquely named temporary file.
7. Write, flush and close. Reread and verify the checksum.
8. Exclusively publish the immutable generation, flush and verify it again.
9. Preserve a damaged primary manifest if recovery occurred.
10. Atomically replace `RECOVERY.json` with the prior verified committed manifest.
11. Recheck lock/current-manifest identity and atomically replace `CURRENT.json`.
12. Attempt directory fsync where supported. Expose state and notify subscribers
    only after current-manifest publication.
13. Prune only verified committed ancestors outside both retained manifests.

Publication uses exclusive destination copying, not replacement of any existing
generation. An interrupted publication copy remains an uncommitted orphan. No
manifest names it until its bytes and full state validate. Manifest replacement
uses same-directory rename; Node's Windows replacement is retried only for
EPERM/EACCES/EBUSY. Temporary/corrupt/unfamiliar files are not swept automatically.

Before manifest publication, failure leaves the previous task/history/receipt
state authoritative and emits no committed change. After publication, injected
failure returns `ACKNOWLEDGEMENT_LOST`, updates the repository's committed view and
notifies once. Retrying the identical operation retrieves its durable receipt.
Generation files and retained receipts therefore agree after interruption.

## Recovery

At open, validate `CURRENT` and its referenced generation. If data is damaged or
missing, follow that manifest's recorded ancestry. If the primary manifest cannot
be used, inspect `RECOVERY` and its recorded ancestry. A candidate is usable only
after checksum, schema, store identity, revision lineage and complete domain-state
validation. Unsupported newer schemas stop with `UNSUPPORTED_SCHEMA`; they do not
trigger downgrade to an older schema/generation.

Never choose a file by revision number or modification time. Unreferenced files
cannot establish a commit. If no verified committed generation remains, return
`RECOVERY_REQUIRED`, leave evidence intact and do not initialize an empty store.
An empty revision-zero generation is usable only if an actual validated manifest
records it as committed; `info().recovery` makes that fallback explicit.

Recovery may roll back a damaged committed suffix. `info().recovery` reports the
selected revision, source manifest and failed evidence. A future host must surface
that fact and reconcile pending external operations before normal activation.
This is not a claim to reconstruct data whose only committed copies are corrupt.
Opening validates structure; it does not guess missing filesystem identities.
Damage discovered in an already-open writer fails closed; close/reopen performs
explicit ancestry recovery. Permission/access failures are not treated as deletion.

## Retention and backups

Default manifest retention is four generations; configurable range is 2–32.
`CURRENT` plus its previous `RECOVERY` normally retain at most retention + 1
verified committed generations. Cleanup uses only recorded descriptors, rereads
and verifies a file before unlinking it, and preserves both active manifests'
dependencies. Corrupt, unfamiliar and uncommitted files are retained as evidence
and can increase directory size. Failed cleanup never reports an uncommitted task
or rolls back an already committed result.

This local recovery window is not a long-term backup policy. Before native
activation, define external backups, restore/export, receipt/history retention and
an explicit operator procedure for reviewing leftover evidence. Receipts/history
are currently retained without compaction; full snapshots and result receipts
increase write size and memory with workload.

## Writer lock and manual abandoned-lock procedure

Each open obtains `WRITER.lock` with exclusive creation and retains it until
close. Another local instance/process is rejected, even if a PID appears stale.
Every command verifies the token and current manifest. Release removes only the
held token. There is no stale-lock timeout, automatic stealing or PID-only reclaim.

For an abandoned lock, an operator must:

1. Stop every process capable of writing this exact directory on every relevant host.
2. Preserve the entire directory, including manifests, generations and lock evidence.
3. Inspect the lock token/host/PID and establish the original writer has terminated.
4. Remove only that confirmed lock, with writers still stopped, then open normally.
5. Review recovery diagnostics and restore a verified backup if recovery is impossible.

There is deliberately no production auto-unlock command. Crash tests remove a
lock only after their exact spawned child exits and its token/host/PID is verified
inside the test's own unique temporary directory.

A lock file and local manifest check do not implement cross-device synchronization.
Do not run two active writers against a cloud-replicated directory and assume this
protocol coordinates them. An uncooperative external writer can also bypass this
advisory protocol. Such changes are rejected when detected; a local lock is not a
distributed compare-and-swap service.

## Platform limits

Executed tests use Windows local Temp storage, real file creation/flush/replacement,
and real child-process interruption. Permission/replacement failures are injected
at the storage boundary. Directory fsync is unavailable in this Windows test
environment. File fsync and same-directory rename provide the best tested local
guarantees here; universal power-loss, disk-controller durability, OneDrive conflict
behavior, network filesystems and other operating systems are unproven.

The eventual Electron main process can host one repository and expose commands
and detached DTOs over a narrow IPC boundary. UI/process integration, live data
directory choice and multi-device collaboration remain later work.
