# N3-C1-A: reliable transactional application storage

Implemented C1-A only on 2026-10-20. **One existing source edit and exactly 21 new files.** Production construction, existing legacy callers and real application data remain unchanged. No C1-B, Oath/Inbox/Phase protocol, native UI, migration, installation or application reload was performed.

## Contract and implementation

The private `createTransactionalApplicationStore(config)` delegates through actual `HubDataStore` methods. Managed construction skips legacy device identity, Vault lookup and SharedProjectStore construction. It opens no storage until explicit create/open. The one existing edit is `lib/services/data-store.js`; the seven new application-storage files, twelve new verification files and two reports/handoffs are exactly the approved list below.

Explicit creation requires an existing empty verified ordinary OS Temp child, pinned canonical authority UUID and application context. Opening neither creates nor converts data; invalid existing formats are inspected without acquiring a new lease. One lifetime APPLICATION.lock and one queue admit a supported cooperative owner. Root/lock filesystem identity and exact PID/host/token bytes are checked around authoritative reads and publication. Public owner epochs are independent of private lock tokens. No expiry, lock-break, fallback, replacement authority or automatic cleanup of abandoned locks exists. Close drains accepted work, coalesces repeated calls and releases only owned evidence; uncertain cleanup stays retryable.

Creation declares immutable allowed top-level scopes and required dependency guards. Requests bind complete stable authority/context, operation ID/reason, original revision/snapshot digest/owner epoch, ordered replacements/deletions and original field presence/digests. The latest validated state is loaded under the lease. Changed selected/dependency fields conflict; stale disjoint requests preserve both changes. Forged/unobserved current-owner evidence rejects. Missing operations from a prior epoch remain unknown. Domain-specific invariants and complete caller dependencies still require C1-B adoption; C1-A does not certify portable JSON as a valid Oath/Inbox/planning operation.

The single data.json envelope uses `itacan-application-transactions`, version 1, capability `scoped-application-transactions-v1`, hubState.schemaVersion 2, authority/context, global revision, immutable scope declarations, initial snapshot digest, logical data, retained immutable receipt chain and canonical checksum. Portable-value behavior is compared with actual native value.js without importing native code into the production bundle. Arrays, key sorting, detachment, signed zero and invalid values retain canonical behavior.

Each receipt stores the full stable original request/digest, committed revision, previous snapshot identity, before/after scoped facts, original result and previous receipt digest. Candidate validation joins these relationships and current facts. Data and receipt are staged/flushed/replaced together. Exact authoritative candidate readback, checksum and ownership are verified before successful acknowledgement. Exact replay returns the original result without publication or revision increase; changed stable evidence conflicts. Later unrelated commits retain receipts. Receipts do not certify response delivery.

Errors once publication may have begun are uncertain. Reconciliation confirms a matching retained receipt or preserves unknown/recovery-required evidence. Missing receipts never authorize another operation, regenerated identity or fresh execution of an earlier-epoch request. The original request must survive externally for restart replay. Creation acknowledgement uncertainty is PUBLICATION_UNCERTAIN, followed only by explicit same-authority inspection/opening. Cancellation is definitive only before publication starts.

Mixed categories/projectPlanning/taskMetadata/headerImagePlacements remain unmodifiable and seeded values survive. Shared-participant requests reject before staging or shared/asset work. Managed paths never prepare shared data. Raw/legacy save, atomicWrite, load/normalization/versioning entry points refuse managed instances, including prototype calls. Updated ordinary writers refuse recognized managed files before preparation and publication. No plugin.saveData fallback is admitted for managed handles.

## Foundation and original failure reproduction

Fresh pre-edit baseline: 1,721 files and 712 Git-status entries, exact originals, installed assets and protected data captured sequentially. No live native artifacts were present. C0's archive SHA256 3325e566099b84457f8444a3776211bed5c9685acc8813d8d4774890fd9cf747 and every one of its 7,858 inventory entries verified. Accepted P2's seal and codec hash verified. Native P1/P2 source remains byte-identical to the fresh baseline; unrelated performance measurements were not rerun.

Thirteen original C0 application-save probes executed before editing and again unchanged against the exact frozen original HubDataStore, with actual unchanged SharedProjectStore. They reproduce higher-revision stale-snapshot loss, independent-instance lost updates, lack of an operation receipt/readback acknowledgement, blind newer-schema overwrite, shared preparation asset effects, separate local/shared publication and rollback failure. Managed tests demonstrate scoped preservation, leased exclusion, retained receipts and fail-closed uncertainty. The production legacy path's demonstrated limitations remain; C1-A corrects them only in opted-in disposable profiles.

## Verification

| Selection | Result |
|---|---:|
| Exact saved C0 acceptance, 44 selections | 3,391 behavioral checks; 18 declarations |
| Additional current behavioral counterparts | 561 checks |
| New C1-A explicit six-file selection | 86 checks, zero failures/cancellations/skips |
| New private declaration runner | TypeScript 6.0.3; zero diagnostics |
| Total distinct accepted selection checks | 4,038 |

New checks include selected-field presence/deletion, disjoint/same-field concurrency, explicit dependencies, malformed/reserved/excluded inputs, canonical parity, detachment, wrong authority/context/root, root replacement, token loss after flush, concurrent close, actual process contention, exact restart replay, changed operation conflicts, lost acknowledgement, missing receipts, corruption with recomputed outer checksums, unknown format/capability, no-write format rejection, managed prototype bypass refusal and shared rejection before effects.

Historical F1/F2/application-B1/C0 byte assertions execute unchanged on verified frozen closures. Current counterparts omit only their historical-byte assertion, as explicitly required by the approved plan; those assertions are not removed or changed. E1's 138 frozen/137 current distinction and frozen B2-A's 36 checks remain. Actual frozen older readers, original four reader assertions and B2-B codec-output cases execute in the saved selections. No old graph, fixture, report or expected failure was edited. Relevant current HubDataStore/shared persistence regressions and safe Strict fixtures pass without launching enforcement.

Exact commands, original selections/order, per-command stdout/stderr/exits and assertion summaries are retained in the private Temp audit. Runner exit and assertion success are accounted separately. Development failures remain: Windows short/long-path fault matching; a child with an unresolved promise exiting before parent termination; and a lock-precedence check after read-only format validation. Corrections preserve intended assertions. Three inherited selections initially failed because rebased evidence directories were missing; their unchanged full selections passed after directories were created. All failed logs remain; no test source was weakened.

## Actual process interruption

Seven new parent-terminated children use actual managed filesystem publication: before publication, after temporary creation, after flush, before replacement, immediately after replacement, before acknowledgement, and during restart reconciliation. Each child is awaited. Evidence preserves command/stage, original request, PID/host/token, exit/signal, raw files and SHA256, death proof and exact lock bytes/hash before moving only that proven dead-child lock within its disposable root.

Pre-replacement cases reconstruct revision 0 with no receipt; identical earlier-epoch requests remain unknown and do not write. Post-replacement/before-ack cases reconstruct the one original committed receipt and replay without a second revision/effect. Reconciliation interruption retains the previously committed receipt. Actual independent-process contention returns LOCK_HELD. Injected exceptions, cancellation, reconstruction and lost responses are separate from process termination.

## Production and protected state

Baseline/candidate builds ran only beneath guarded Temp. Main changes 168 -> 171 factories: exactly application-storage/codec.js, lease.js and transactions.js are added. Only the existing data-store.js factory body changes. Atlas retains 24 identical factories and identical bytes. Eleven of twelve staged assets are identical; only staged main.js differs as approved. All twelve **installed** production assets remain byte-identical.

The ordinary HubDataStore constructor is unchanged. Startup has no managed profile construction, exactly one Legacy Task Service construction and no native task engine factory. Editor/Inbox/Oath/Strict routing and build configuration remain unchanged. No bundle was installed.

Final protected comparison: 1,720 baseline files unchanged, solely the authorized data-store.js source edit, no missing files and no independent drift observed. Real Markdown, data.json, task metadata, History/checks, Inbox, Oath/Strict/device, planning/shared state, workspace/Manual Sorting and accepted native source are preserved. No native or application authority artifacts exist in the workspace outside backups. Private protected originals remain outside the review ZIP.

## Exact files and hashes

Original data-store.js SHA256: `7fcf635d30bcf88bd22c0465fbf9321d1b415426f7b5ed7e7b2438cba6eb4053`.
Final data-store.js SHA256: `bcd3492bee8f8b94bac910f5fd50c81d15cc21d7f9b6cf2b11f0915474091766`.

| Current output | SHA256 |
|---|---|
| `lib/services/data-store.js` | `bcd3492bee8f8b94bac910f5fd50c81d15cc21d7f9b6cf2b11f0915474091766` |
| `lib/services/application-storage/index.js` | `d1924dab742fb41016b1eaea768be5cc1ce6af54bb346cc5db3a675b4f022617` |
| `lib/services/application-storage/index.d.ts` | `b12ed2d8e0c9dbe9ea8eed3d7b4c5cffd64c36f5a05f74414f1b4090692ef947` |
| `lib/services/application-storage/contracts.d.ts` | `5e2614d693cf3034434e92564ea5cd3a13f1c68a8538a3f7240459dac766cd13` |
| `lib/services/application-storage/codec.js` | `6ee4df5c557f15e21d40a474817dfa381970bcf5ed5e167be3850ea100d0adc2` |
| `lib/services/application-storage/lease.js` | `ed8f0fa16dba91e9732728560b268a15f97064b46a54106805d342f7a33b5a7e` |
| `lib/services/application-storage/transactions.js` | `18bcba76aee5cba7771364a49f668f25798d7b22381f0255b52ab25203266091` |
| `lib/services/application-storage/README.md` | `a9dc03ca7337c4b6ec98409db31ede6dfb208f3bec3c6f1a7e93e6ae00464eea` |
| `lib/tests/application-storage/support.cjs` | `072acdd9c94c3de91291f9230186d4d300d5fc1258309c5aecc12885682d1cf2` |
| `lib/tests/application-storage/baseline.test.cjs` | `e110c4d60c29f82807a6e8f9e06ba30ea2e5f54c95b7554c4356da12e5fa4d3c` |
| `lib/tests/application-storage/authority.test.cjs` | `1395f3910861de1618f1dac70517696ecaa1374d66992b26f953ff5f121e84e1` |
| `lib/tests/application-storage/transactions.test.cjs` | `744c9cc2463630d52efde0b77e69e8393a9032ca2c839a988cf669ae0480e3c4` |
| `lib/tests/application-storage/replay-recovery.test.cjs` | `e6ef24ec06e7aa24ff0a4ff0e3cfa79ff04d81115de0d6a281e75edcc4393565` |
| `lib/tests/application-storage/shared-boundary.test.cjs` | `c012232c75907c15cf5339efdf94d007fb962d4cb0a633268ad9af4a5006ca96` |
| `lib/tests/application-storage/persistence.test.cjs` | `2dbcc8334b8edd42a73e6cb2f6a722a6828d6248652e068bffb79d4041e8f32d` |
| `lib/tests/application-storage/crash-worker.cjs` | `552dafd1cf81b4d618cd940681e9d881ae232a533fc079e4e24e53d12b18bd78` |
| `lib/tests/application-storage/decision-vectors-v1.json` | `6b283ce73a88fa44e764dff507df6f494a876daf93e50d84562a80ab0f5a9eee` |
| `lib/tests/application-storage/source-graph-v1.json` | `2b6a26e961e1fe0c72dc1c9133160809e6bfbf7fdd2daa7b77b3ad12f6ebe501` |
| `lib/tests/application-storage/types.fixture.ts` | `3eb66f237a353365499802da45515cdbeb3dbe0390359928264c0d786a1f251f` |
| `lib/tests/application-storage/typecheck.cjs` | `811951e89472403c2d5cabc4d0f7ff9f9acf646f71112d56769273f55c59e32d` |
| `lib/services/TASK-SERVICE-PHASE-N3-C1-B.md` | `0aa31693f4a2e11baa086a5bc679803ab7a4773bc6825d29b63690a87b1cbbe7` |

The verification report itself is the twenty-second reviewed output; its exact hash is in the sealed archive inventory.

## Limitations and handoff

This is cooperative local persistence/process-interruption evidence. It does not establish power-loss/directory-sync durability, hostile-writer protection, cloud/full-directory rollback detection, distributed uniqueness or cross-authority atomicity. A frozen old loader refuses the new marker; a frozen blind writer demonstrably can overwrite it. That incompatibility is documented, not repaired. Existing legacy shared preparation/publication/rollback remains non-atomic. No receipt pruning or automatic recovery repair exists.

C1-B must separately review every full-snapshot caller, complete dependency/domain validation, supported writer admission, production authority/location/format adoption, full-state restoration and mixed shared/private participants. C2/C3/C4 remain independent domain protocols. No native task receipt is substituted by application evidence.

The compact inert review ZIP retains current authorized outputs, exact source originals/graph, decisions, command logs, failures, synthetic interruption evidence, source/build comparisons and a SHA256 inventory. Predecessor archives are referenced by verified hashes rather than recursively repackaged. Real vault files/private production data and active test profiles are excluded. Detailed protected originals stay in the private Temp audit.

**C1-A complete. STOP FOR USER REVIEW.** Next recommended separately authorized gate: C1-B caller-compatibility/adoption review. No implementation of that gate or C2/C3/C4 follows automatically.
