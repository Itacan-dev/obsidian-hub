# N3-C1 handoff — application storage prerequisite, separate review

N3-C0 supplies private, allocation-free evidence analysis and actual persistence
observations. It implements no coordinator, workflow writer or persistent format.
See [C0 verification](../tests/native-coordination-n3-c0-verification.md) and
[the isolated package](../../../../../ItacanTaskCore/coordination/README.md).

Before authorizing C1, review the frozen source graph and executed observations.
HubDataStore queues pre-cloned snapshots, permits stale content under newer
revisions and has no cross-instance/process lease. Load rejects newer schemas,
but blind legacy save does not establish a mandatory writer barrier. Shared
preparation can copy assets; local and shared publication/rollback are separate.
An ordinary save promise is not an immutable domain-operation acknowledgement.

The minimum C1 contract must define scoped application transactions over the
existing authority, exact stable-operation binding/replay, stale-snapshot and
supported-writer isolation, preservation of unrelated fields, authoritative
readback/acknowledgement, ambiguous publication and restart reconciliation. It
must specify local versus shared participants and return bounded evidence.
No new authority, generic coordinator or journal is presumed necessary.

Specify explicit disposable admission/create/open behavior and the lifetime of
any managed writer lease. Define unknown-version refusal, older application
reader/writer behavior (including direct-save probes), privacy and receipt
retention. Do not promise protection against arbitrary filesystem writers or
whole-directory rollback. No real application-data upgrade is authorized.

Freeze a fresh exact C1 allowlist only after that contract is reviewed. Candidate
existing source is lib/services/data-store.js; shared-projects.js enters only if
required by an approved shared-participant design. Any production-bundled change
needs explicit build-impact approval. Preserve native core, atomic effects,
admission, proof versions and recovery fences; do not work around them.

Later C2 owns durable Oath enrollment/order evidence and proof with the existing
latch/outcome authority. The acknowledged enrollment → open cut belongs at
scheduling, not activation. A lost unpublished latch stays uncertain. Preserve
deadline and Standard/Strict semantics; no event-keyed outcome store.

Later C3 owns Inbox preparation and the complete original native request,
confirmed creation, retained acknowledgement and safe cleanup. Changed drafts
conflict. Confirmed creation followed by deletion retains the original draft
for review, without resurrection. Cleanup failure never replaces native IDs.

Later C4 owns live Phase admission and staged delete-and-clear. Its protocol
must block new assignments to a retiring Phase, reconcile exact child operations
and confirm final local/shared planning publication. Private acknowledgements
cannot certify shared-file/Git state. Live conflicts pause rather than rebase.

Rich coherent editor reads remain a separate prerequisite before interactive
adoption. Inbox, planning, task and Oath success remain distinct. N4 owns transport,
N5 committed-tree/migration rehearsals, and N6 activation. No production routing,
real task migration, installation or Obsidian reload is included.

C1 acceptance requires actual application persistence, supported concurrent-writer
and stale-snapshot tests, real process interruptions around every new boundary,
original-operation reconciliation, full saved regressions/declarations, protected
data comparisons and reviewed production build comparisons. Preserve all failures,
exact child/lock evidence and immutable earlier archives. Stop if the existing
authority cannot support the reviewed contract; propose that requirement for review.

STOP FOR USER REVIEW. This handoff does not authorize C1 or any later gate.

The next request should be **Plan C1 only**: use the sealed C0 observations to
specify a decision-complete, disposable application-persistence contract and its
exact source/build allowlist. Resolve acknowledgement, supported-writer isolation,
direct-save bypass, local/shared scope, versions and restart recovery before any
Agent-mode implementation. Preserve the three selected domain goals without
implementing Oath, Inbox or Phase coordination in that prerequisite.
