# Gate B2 handoff — minimal inactive recurrence generation

2026-10-17. **Proposed next phase; not begun or authorized by B1. STOP FOR USER REVIEW.** B1 implements definitions, immutable templates/rules, initial membership, reservation checks and persistent recurrence recovery fencing. It performs no date advancement, successor creation, Step instantiation or completion-and-generation operation.

Read [B1 API/format](../../../../../ItacanTaskCore/RECURRENCE-FOUNDATION.md), [B1 verification](../tests/native-recurrence-b1-verification.md), the unchanged B0 decisions/contracts/evidence and the exact next user authorization before implementation. B1's approval narrows B0's initial suggestion: **when-done is excluded**. Do not treat older proposals or static graph tests as engine parity.

## Reuse from B1

- Existing native `TaskRepository.execute`, one detached validated state and one CURRENT publication boundary; no separate recurrence dispatcher/database/receipt authority.
- B1 repository schema 2 and namespace version 1, with mandatory capability discriminator; schema-1 stores remain compatible. Rule/template revisions have canonical portable SHA256/previous-digest integrity and retained receipt snapshots.
- One physical owner/partition, explicit existing fresh-native initial task, ordinal 1, captured initial rule/origin and no implicit task creation.
- Four definition commands only: defineSeries, reviseRule, defineTemplate, reviseTemplate; optimistic store/task/series/rule/template guards, explicit future initial boundary and exact operation replay.
- Explicit template-node identity, deep hierarchy/contiguous sibling order/lossless body, full revision with explicit guarded deletions, permanent node retirement and occurrence-only edits.
- Fresh-native reservation checks across live/deleted tasks, live/retired Steps, History events, series/rule/template/node identities and the immutable captured external inventory. Existing schema-1 namespace history remains documented; no separate N1-B plan consumption.
- Stable canonical predecessor generation key and pure future lineage/outcome/mapping validators. These are structural tests, not an executable calculator or committed ledger.
- JSON `RECURRENCE-FENCE.json`: known fallback, including to a task-only ancestor, blocks recurrence mutations/replay across ordinary writes/restarts. No automatic clear API. Malformed marker blocks; unknown versions fail; unable-to-persist fence fails open attempt.

## Exact proposed scope

After separate B2 authorization, implement only structured **DAILY/WEEKLY**, positive safe-integer interval, **unbounded date-only fixed-calendar** recurrence. Use immutable selected rule origin and occurrence ordinal; Due anchor else Start; preserve validated local calendar-day Start/Due offsets. Captured explicit Gregorian/IANA information must not depend on device defaults. One successor for a completed frontier, no catch-up batch; a missed fixed date may remain past due.

No count/until, valid bounded exhaustion execution, monthly/yearly/clamp/skip, when-done, timed/elapsed, advanced natural language, scheduled-only/date-free rules, custom status cycles, legacy recurrence adoption, automatic replacement, N1-E event import, N1-F native Oath routing, N3 production host/authority, N4 Git transport or offline reconciliation. Unsupported input retains evidence and rejects; it is never stripped into a daily one-off rule. Current timed/manual endpoint changes must be revalidated without erasing raw precision. Date-only null time and explicit midnight stay distinct.

The D10 product subset was approved for inactive fresh-native foundations and intended B2 direction, but **this handoff is not B2 authorization**. If generation requires new product policy outside that subset, stop for review. Bounds, pause/resume/deletion/replacement workflows and existing-successor reanchoring need their own narrowly reviewed scope; do not infer them from lifecycle enum values.

## Version extension prerequisite

B1 live namespace version 1 deliberately requires active initial-only membership, frontier=initial, count=1 and empty generation ledger. B2 must introduce an explicit reviewed namespace version/mandatory capability (and any necessary manifest/schema barrier), with reader tests proving a B1 reader fails `UNSUPPORTED_SCHEMA` rather than falling back and losing generated records. Do not silently relax version-1 validation. Old schema-1 receipts/tasks/N1-C content and B1 immutable definitions must survive exactly; no real repository upgrade is authorized.

B1 revision operations support only the initial boundary. If B2 permits edits after an existing B, extend boundary/revision validation explicitly, capturing B's original rule/template while future C uses the newly selected revisions. Do not silently reuse initial-boundary code for a later frontier.

## Required generation behavior

The approved operation must atomically validate owner/partition and expected store/task/series/rule/template/inventory revisions; resolve current binding and predecessor generationKey; validate supported rule/current endpoint evidence; determine next fixed calendar ordinal and valid endpoints; reserve all fresh task/Step/event IDs; transition current occurrence; create a new successor and independent open Steps if permitted; record reciprocal lineage/frontier/count; write generation entry and command receipt in the same native commit.

The new task must have a fresh UUID, original generated endpoint/reference evidence and captured rule/template revision. Each Step has a fresh UUID disjoint from template-node, prior live/retired and externally reserved IDs. Instantiate the complete tree by parent/order, not list position; retain titles/bodies, map `(occurrenceId,templateId,templateRevision,templateNodeId)` to the new Step UUID, start open with null completedAt/binding and fresh legitimate creation/modification clocks. No completion event is created merely to establish open Step state. The completed predecessor and its Step events remain unchanged.

Generation key is the B1 canonical tuple `(owner type/id,series UUID,predecessor occurrence UUID)` with fixed version/prefix. It excludes completion attempt/event/device/revision/date. A generation entry identifies the original successor or terminal result; an operation receipt identifies one exact attempted command; an event identifies one completion transition. They must remain distinct.

Identical operation ID/payload replays original task/Step/event identities before stale revision rejection when current verified state survives and no recovery fence applies. Payload conflict rejects. A already completed must not generate an extra event. Reopen A uncounts/unbinds E1 normally; new completion of A can create E2 while retaining original A-to-B entry and B unchanged. Non-frontier completion cannot create another branch. A missing/deleted B never unspends the key or causes retry resurrection; retained successor/Step identity/tombstone requirements must be explicit before deletion is supported. Oath remains attached to A and its Steps, never relinked to B.

Terminal contracts exist structurally, but bounds remain unsupported. Invalid/range/overflow calculation is not exhaustion. A dependent completion/generation failure must not partly complete A, create B or publish a success receipt. No unsupported recurring task silently becomes one-off work. A separate “complete without advance” workflow cannot be invented as an error fallback.

## Identity and recovery constraints

Keep all generation identities/outcomes in the same reservation/publication authority. N1-B plans remain separate and immutable; use explicit captured inventory/revision and exclusive fresh-native fixtures, reject conflicts or changing inventories. No live cross-store coordinator exists. Canonical generation keys detect local uniqueness only; no local test proves offline distributed uniqueness.

Before any generation, revalidate persistent recovery fence and current committed generation. Known ancestry fallback can lose an acknowledged B/receipt even when external B survives. Block generation/replay-as-new until separately reviewed reconciliation; B1 has no fence-clear command. Do not remove/replace the marker or infer permission from an empty recovered ledger. Preserve schema barriers after task-only ancestor recovery and ordinary writes.

Claim only tested cooperative local persistence/process interruption. Do not claim arbitrary power-loss/cloud/OneDrive rollback safety, hostile marker deletion, distributed exactly-once or production hosting. Any stronger receipt journal/watermark/reconciliation protocol needs its own atomicity and loss proof; adding another file is not a second transaction solution.

## Verification requirements

Use memory and unique OS Temp JSON repositories with the existing mutation guard. Never construct a real-vault repository or invoke plugin startup. Cover:

- Exact DAILY/WEEKLY intervals over winter/summer/year/leap/DST calendar boundaries, Due/Start anchor/offsets and original-origin behavior after manual occurrence edits. Explicit overflow/range failures, unsupported grammar/bounds/timed/when-done rejection without mutation.
- Fresh task/Step identities, full deep template structure/content, stable node lineage, initial checked Steps producing fresh open successor Steps, captured revision boundaries and unchanged customized B after future-definition edits.
- Current completion binding/event identity versus generation ledger versus command receipt; E1/reopen/E2 counting, already-complete repeats, non-frontier completion, spent/deleted successor protection and no automatic resurrection.
- Invalid/cyclic/cross-owner/nonreciprocal chains, duplicate generation outcomes, reserved/live/retired/external collisions, allocator exhaustion, stale revisions, identical replay and changed-payload conflicts.
- Faults during calculation/reservation/event mutation/Step staging/lineage/receipt/serialization/generation write/pointer/acknowledgement. Previous whole state or new whole state, never partial task/Steps/events/ledger.
- Actual child-process interruption before/during/after durable writes and pointer commit, before acknowledgement, reopening/retry and verified dead-child abandoned locks. Crash-test the new generation command, not only B1 definitions.
- Corruption and unsupported schema/capability versions; acknowledged receipt lost by fallback with external B evidence; persistent recurrence fence across restart/ordinary writes; no B2 allocation before reconciliation. Do not confuse an exception test with a process-crash test.
- Both eligible shared Projects and all four private Resources, including mount context. Recurrence transport stays blocked pending N4; do not export full generations/private aliases/source/receipts/History/Oath/Strict/recovery state.

Rerun explicit B1, B0, Gate A, N1-C, N1-B, N1-A, N0, native-core, focused legacy, 34 regression files, safe Strict and all six declaration checks, then new B2 checks. Preserve frozen N1-A/Gate A/B0 observations and every old assertion. Stage builds only into OS Temp; compare twelve production assets/factories and installed/staged distinction. Verify fresh protected Markdown/data/substates/shared state, all unrelated dirty files and independent workspace drift. No new browser run is required solely for untouched production graph; do not count historical browser results anew.

## Dependencies and completion gate

N1-E remains responsible for legacy historical event/current-binding import; B2 must not synthesize a second event from imported completion. N1-F owns native Oath aliases/commitments and both existing awaitingIndex bridges. N3 owns production host/activation/recovery UI; N4 owns shared canonical recurrence transport and conflicting offline successors. Preserve both conflicting completed branches/events for later explicit reconciliation; no timestamp winner or silent deletion.

Publish exact changes/backups/hashes, source/API/schema strategy, new versus prior test results, fault/crash evidence, recovery limits, private boundaries, protected-state/build comparison and unresolved next work. No migration, production Task Service selection, installed asset replacement, plugin toggle, Obsidian reload/restart or subsequent phase. **STOP FOR USER REVIEW AFTER B2. B1 stops before this work begins.**
