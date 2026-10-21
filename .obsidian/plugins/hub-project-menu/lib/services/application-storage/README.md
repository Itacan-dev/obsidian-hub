# C1-A: inactive local-private application transactions

`createTransactionalApplicationStore(config)` is exported through this private sibling entry point and delegates through actual `HubDataStore` methods. Normal plugin construction does not select it. It neither inspects a vault nor allocates a browser device identity or constructs `SharedProjectStore`. Construction performs no filesystem work.

Explicit `create` needs an existing empty ordinary OS Temp child and pinned canonical authority UUID/context. `open` requires an existing supported profile; wrong-format inspection writes nothing. The physical directory identity is pinned for the instance and authority's process lifetime. UNC, Temp itself, missing/non-directory/reparse roots and known authority/root substitutions reject. No root search, mkdir, conversion, fallback, replacement authority, lock break or fence clearing is provided.

One `APPLICATION.lock` owns the profile for its open lifetime. PID/host/random token, exact lock bytes and filesystem identity are checked with the root around reads and publication. Unknown/dead locks remain blocking. One queue serializes accepted operations. Close stops admission, drains accepted jobs and releases only exact owned evidence; failed release keeps cleanup retryable. Concurrent close calls coalesce. These are cooperative local guarantees, not hostile filesystem exclusion.

## Request and scope contract

See `contracts.d.ts`. `readScopes` supplies original revision/snapshot digest/owner epoch and selected presence/value digests. Transactions carry an immutable original request, reason, operation ID, physical participant, ordered absolute replacement/deletion changes and dependency guards. No callback, append, JSON pointer, raw receipt control or whole-snapshot save exists. Known field names and portable JSON/top-level replacement shapes are validated without coercion.

Creation pins an immutable allowlist of `{field, dependencies}` declarations. Dependencies are explicitly declared, not inferred from labels or assumed independent. Every declared dependency must be guarded or selected. Validation reads no undeclared logical domain field. C1-A provides storage isolation, not Oath/Inbox/planning domain validation; C1-B must establish complete domain dependencies and domain-specific validators before adopting real callers. No caller adoption occurs here.

Within the lease, the queue loads the latest validated state. It validates the original observation retained by the current owner, then compares original presence/digest for all selected/dependency fields. Changed fields conflict without publication. Disjoint stale requests preserve intervening unrelated fields. New requests from an earlier owner epoch are unknown; exact retained committed receipts can replay across epochs.

`categories`, `projectPlanning`, `taskMetadata` and `headerImagePlacements` cannot be read as writable scopes or changed. Seeded logical values, including unrelated fields, survive. No finer shared/private split is inferred. Shared-participant requests return `unsupported-participant` before queueing/staging or shared/asset work.

## Envelope and receipts

A single `data.json` has format `itacan-application-transactions`, version 1, capability `scoped-application-transactions-v1`, `hubState.schemaVersion:2`, authority/context, revision, allowed scopes, initial logical snapshot digest, logical data, immutable receipt chain and canonical checksum. Canonical sorting/detachment/zero normalization matches native portable values without importing the native engine into production.

Each receipt retains the complete stable request, request digest, revision, previous snapshot digest, selected before/after facts, original result and previous receipt digest. Validation joins the chain, operation uniqueness, original observation lineage, effects and current field facts. Data and receipt are one candidate, one flushed temporary file and one replacement. Readback verifies exact candidate bytes/checksum/receipt under the owned root/lease before acknowledging success. No pruning, journal, recovery ancestor selection or directory-sync/power-loss claim exists.

Identical committed replay returns the original result and receipt digest without a new revision. Changed stable evidence under the same operation ID conflicts. Results are detached and scoped; raw data and full receipts are not mutation results. A receipt proves commitment, not response delivery. Public owner epochs are fresh UUIDs independent of the private lock token.

Any error after publication may have started is `uncertain`. Reconciliation can confirm only the exact retained receipt under validated current authority. A missing receipt remains `unknown`; a prior-epoch absent request is never executed as fresh work. The original request must survive externally to support restart replay. No lost request is reconstructed from current values. Missing/corrupt data, unknown capabilities, lease/root loss or external changes require review; they never trigger replacement storage. Creation acknowledgement loss throws `PUBLICATION_UNCERTAIN`; explicitly inspect/open the same authority rather than retrying creation.

## Compatibility and limits

Managed handles reject legacy save/load, normalization/versioning and raw atomicWrite even through prototype invocation. Updated ordinary writers refuse recognized managed files both before preparation and at raw publication boundaries. Existing ordinary legacy behavior remains, including known stale snapshots and separate shared writes. A frozen old loader refuses schema 2; a frozen blind writer demonstrably can overwrite it. A marker cannot force such writers to cooperate. No production profile is converted or protected by this inactive gate.

Tests use actual HubDataStore/SharedProjectStore for old failure probes and real Temp filesystem writes for managed cases. Child interruptions retain command, PID/host/token, exact raw files, death proof and lock bytes/hash before moving only the proven dead-child lock within its disposable root. Exceptions and actual termination are separate evidence.

C1-B caller adoption, C2 Oath, C3 Inbox, C4 planning, native UI, sharing, migration, installation and production activation remain separately authorized work.
