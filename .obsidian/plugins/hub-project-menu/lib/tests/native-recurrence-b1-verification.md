# N1-D Gate B1 implementation and verification

2026-10-17. **B1 complete, inactive; STOP FOR USER REVIEW. B2 has not begun.** This phase stores/revises definitions and establishes reservation, structural and recovery safeguards. It does not calculate a next date, create a successor, instantiate occurrence Steps or combine completion with generation.

Review [API/format and runnable example](../../../../../ItacanTaskCore/RECURRENCE-FOUNDATION.md), [runtime declarations](../../../../../ItacanTaskCore/src/recurrence.d.ts) and [B2 handoff](../services/TASK-SERVICE-PHASE-N1-D-B2.md). Historical B0 decisions/contracts/proposal vectors and frozen B0/Gate A/N1-A observations remain unchanged; this report records the newly approved restricted subset.

## Approval and scope

The B1 request explicitly approves D10-01/02/04/05/07/10/11/12–16/18–20 and D10-17's safe deletion/spent-key principle, **for inactive fresh-native foundations only**. Intended initial execution is structured unbounded DAILY/WEEKLY positive interval, date-only, fixed origin/ordinal, Due else Start and preserved Start/Due calendar offsets. `when done` is expressly deferred, narrowing B0's proposal. Bounds, monthly/yearly, timed/elapsed, advanced grammar, legacy adoption and general lifecycle execution remain excluded.

Previously established owner/privacy, task/Step identity, completion-event distinction, Oath occurrence identity, Statistics, D07/D08/D09 and N1-B/N1-C policies are preserved. No new approval was inferred from passing tests or older unapproved proposal vectors.

## Source review and fresh baseline

Inspected the B0 handoff/decisions/contracts/reports/observations/specification vectors, Gate A temporal contracts/harness/evidence, N1-C Step/source-content implementation, N1-B identity planning, N1-A compatibility material, N0 read/privacy reports and actual domain/command/repository/storage/declaration/persistence code. Applicable `Projects/Itacan/Meta/AGENTS.md` contains TODO only. Installed Tasks/Moment are reused only by frozen earlier evidence tests; no plugin startup is needed.

Before implementation edits, captured **1,183 original files**, **345 Markdown files**, **68 original core files**, **431 preexisting Git status entries**, six exact existing-file modifications and twelve absent new-output paths. All six current originals, including prior working-tree changes, were copied and SHA256-verified before patching. No reset, cleanup, old-data restoration or unrelated source overwrite occurred.

All seventeen predecessor `itacan-*` archives were checked before edits: eleven historical full manifests verify **1,639 files**; six early archives lack full historical manifests, so **75 original backups** were checked against available historical baseline hashes and **1,006 current archive files** inventoried for preservation. That inventory cannot retrospectively prove all unmanifested historical evidence bytes. **84 reviewed prior phase files** matched the current pre-edit foundation, including all B0 outputs. Earlier archive limitations are inherited and disclosed; there is no B1 late-preflight exception.

Fresh plugin data baseline is `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7`. Legitimate earlier user changes were preserved, not restored to obsolete hashes. Read-only health retains two inherited stale-project-card-order warnings; no repair was run.

## Implementation and compatibility

Six existing core files were patched; all additions remain inactive core/tests/docs. Reused `TaskRepository.execute`, detached candidate validation, `applyCommand` dispatch, existing operation receipts and partition revisions, current memory/JSON storage, native Step/title/date validators and portable N1-C SHA256/content validators. No second database/dispatcher/receipt authority was introduced.

Task-only repository schema 1 still loads and remains schema 1 until an explicit successful definition. The same commit publishes repository schema **2** with mandatory recurrence namespace version **1** and `requiredCapabilities:['recurrence-foundation-v1']`. Tasks remain task schema 1; existing receipts/N1-C content retain original representation. JSON manifests carry the schema-2 old-reader barrier. Unknown newer versions/capabilities and schema 2 missing its namespace throw `UNSUPPORTED_SCHEMA`, without silent fallback. B1 namespace records are fully validated; arbitrary recurrence fields are not added to schema 1.

Records include series/owner/partition/lifecycle/active rule/template/frontier/count/clocks; immutable rule/origin/offset/boundary/digest chains; template definition and immutable nested content revisions; stable independent node IDs; initial task membership; live/retired recurrence reservations; captured immutable external inventory; and an **empty** generation ledger. B1 namespace requires active initial-only series, frontier=initial and count=1. Other lifecycle values exist in the type vocabulary but have no working transition commands.

Four commands use the existing `execute` boundary:

| Command | Actual B1 effect |
|---|---|
| `recurrence.defineSeries` | Around one existing live fresh-native task, creates series/rule identities, immutable rule revision and initial membership; atomically upgrades store schema if needed. |
| `recurrence.reviseRule` | Appends immutable rule revision and updates active series pointer at explicit initial-task future boundary. |
| `recurrence.defineTemplate` | Creates a separate template identity and immutable revision 1 with fresh node identities. |
| `recurrence.reviseTemplate` | Atomically revises complete hierarchy/content with explicit retained/new nodes and confirmed subtree removals. |

Commands require versioned payload, operation identity, expected repository/task and relevant series/rule/template revisions, owner/partition and external-inventory revision. Unsupported lifecycle/generation commands return `UNSUPPORTED_OPERATION`. No general recurrence workflow is advertised. The initial task is explicitly authored by the existing task command in test setup, never created implicitly by series definition.

## Rules, templates and occurrence isolation

Only structured fixed-origin DAILY/WEEKLY positive-safe-integer intervals are accepted. Strict field validation rejects trailing unsupported count/until/time/advanced parameters instead of discarding them. Explicit Gregorian/IANA context is captured; no device-zone default. Due anchors when present, otherwise Start; missing anchors and explicit times including 00:00 reject. Existing date validator preserves D08 precision and rejects invalid/reversed source fields; rule offset validation uses civil-day differences only, not recurrence advancement.

The original local endpoints, origin ordinal 1, offsets, rule version and initial-task boundary are sufficient for a later fixed-calendar calculator. Manual occurrence date changes leave captured origin unchanged. Rule revision requires an explicit new origin and preserves the prior digest/revision. B1 does not support future boundaries after generated successors.

Template nodes have UUIDs independent from real Step/task/rule/series/event identities, parent/null, explicit contiguous sibling order, canonical title and lossless body. Empty templates and four-level trees work. Reuse actual core hierarchy/title/cycle validation on temporary views; no occurrence Step is allocated. Same-title nodes remain distinct. Full revisions require explicit new/existing intent and every old node's disposition; omission is not deletion. Exact descendant confirmation/cascade guards subtree removal. Removed node IDs retire permanently. Earlier revisions and their receipt snapshots remain unchanged.

Current task/Step edits and Step completion retain existing behavior and do not alter templates. Template revisions never change current task/Steps, checks or bodies. Existing checked nested Steps and completion bindings survive definition intact. N1-C native-only private body revisions remain compatible; genuine legacy captures/provenance are not adopted. Existing occurrence original membership/rule capture stays unchanged when future definitions are revised. No N3 UI was added.

## Identity and static generation contracts

The native reservation boundary covers live/deleted tasks, live/retired Steps, existing History event IDs and new series/rule/template/node IDs, plus the supplied immutable external inventory. Schema-2 subsequent task/Step/event allocations check recurrence reservations too. Series=task, template=Step, rule=retired task, node=Step, repeated nodes, external collision, invalid allocator UUID and bounded factory exhaustion all reject before publication. Failed commands publish no reservations/receipts. Caller option inventory is cloned privately; a changed captured inventory/revision after reopen rejects. Concurrent changing cross-store N1-B planning remains unsupported; no plan, alias or external reservation was consumed or mutated.

Existing schema-1 History IDs had a separate namespace; prior legal overlaps are not rewritten. New recurrence IDs avoid both domains, and schema-2 new allocations use the combined guard. Store/revision/head UUIDs remain infrastructure metadata. This is not an atomic cross-store or distributed reservation claim.

Canonical generation keys encode `['native-generation',1,owner.type,owner.id,seriesId,predecessorOccurrenceId]`. Pure static graph validators check unique roots/ordinals/membership, reciprocal same-owner/partition lineage, one outcome per key, retained deleted-successor/spent outcome, distinct event versus operation receipt, original successor/mapping references and fresh-open Step mapping identities. Device/event/revision/title/path cannot change the stable key.

These are **structural synthetic checks only**: no actual B1 generation result can be committed. Live namespace validation rejects nonempty ledger/generated membership. Future terminal proof fields are shape validation, not a bounded calculator. Future B2 mapping must create fresh open Steps with null binding/completion time and real creation/modification metadata; no instantiation operation exists in B1.

## Atomic publication, receipts and crashes

One candidate state contains the definition revisions, reservations, membership, integrity and existing command receipt. Existing repository/partition revisions advance once; target task revision/content stay unchanged. A versioned `result.recurrence` snapshot preserves exact output definitions/identities. Existing receipt shapes stay valid. Identical operation/payload replays the original result before stale revision rejection; changed payload conflicts. No receipt or reservation escapes a rejected/stale operation.

Memory/JSON tests exercise rule validation, template normalization, identity checks, receipt persistence and pre-commit boundaries; JSON also exercises serialization, temporary write/flush/verify, generation-file publish, CURRENT replacement and acknowledgement loss. Partial generation files remain uncommitted evidence. Lost acknowledgements return identical recorded identities/revisions after reopen/retry when current state survives.

**Fifteen new actual child-process interruptions** cover ten template-definition stages, three recovery-fence stages and two template revision/retirement pointer stages. Children exit before cleanup, leaving an actual writer lock. Parent confirms exited PID/host/token and moves only that exact lock within the disposable store. Reopen/retry proves previous whole state or new whole state, no half template/node retirement, no duplicate revision/IDs. This does not test a successor-generation command, which does not exist.

Full-template rollback tests additionally prove a failure after staging subtree removal leaves the old content/hierarchy and live reservations intact. Series/template commands create zero tasks/occurrence Steps/completion events/bindings/generation successes/Oath outcomes; explicit ordinary fixture setup and occurrence-edit tests are distinguished from those commands.

## Persistent recovery fence and limits

Known corrupt-current/ancestor recovery still uses verified recorded ancestry. It may lose acknowledged latest definitions/receipts. Unlike N1-B identity storage, native JSON task storage still permits this read/recovery behavior; B1 does not claim they have equal durability.

Before exposing any known fallback, even to task-only state before recurrence existed, JSON persists/flushes/verifies private `RECURRENCE-FENCE.json`. If that cannot be established, open fails. A crash before fence creation causes recovery again next time; a partial marker blocks; a completed marker blocks. Unknown marker version is unsupported. No B1 clear/reconciliation operation exists.

Recurrence mutations/replay check the fence before receipt return and again before commit. Recovered definitions can be read; ordinary valid task writes remain available. Ordinary writes/restarts do not clear the fence, and publish a schema-2 manifest capability barrier while fenced even if the selected state/backup is schema 1. Thus an empty recovered namespace/absent receipt never authorizes recreation. Unsupported future schemas/capabilities fail before fallback; ordinary known-corrupt records recover only with the fence.

Verified local limits: cooperative single writer, actual local filesystem file flushes/readback and process interruption/restart with retained recovery evidence. Directory fsync is best effort on Windows. No universal power-loss, OneDrive/cloud rollback, hostile deletion, arbitrary complete-directory rollback, distributed exactly-once or production recovery guarantee. Complete loss/restoration of the directory/fence needs later N3 reconciliation. No cross-store identity consumption is claimed. B2 must reuse the fence and cannot generate while it remains set.

## D10 implementation matrix

| D10 | Approved policy | Implemented in B1 | Deferred to B2/later | Test evidence |
|---|---|---|---|---|
| 01 | Stable single-owner series UUID | Validated/persisted definitions | General lifecycle/production | Foundation/owner tests |
| 02 | Distinct task per occurrence | Membership and static disjoint identity contracts | Actual new occurrence allocation | Static graph/collision tests |
| 04 | One predecessor outcome | Canonical key and static uniqueness; live ledger empty | Actual durable generation entry | Pure graph duplicate/retarget tests |
| 05 | Recomplete preserves successor | Event/receipt/outcome distinctions in structural contracts | E1/reopen/E2 generation behavior | Static graph; unchanged earlier completion regressions |
| 07 | Narrow DAILY/WEEKLY subset | Strict definition grammar, unsupported-input rejection | Date advancement and actual next task | Foundation rule tests |
| 10/11 | Gregorian/zone, immutable origin/ordinal | Captured date-only anchor/offsets and explicit initial boundary | Calendar calculator, future-frontier boundaries | Anchor/rule/occurrence edit tests |
| 12–16 | Versioned explicit template, fresh-open future Steps, local edits | Immutable deep templates, node identities/retirement and scope isolation | Actual fresh Step instantiation, later UI | Hierarchy/content/retirement/static mapping tests |
| 17 | Deleted successor stays spent | Static tombstone/spent-key validation; member deletion rejects | Recurrence deletion/cancel/pause/replace lifecycle | Static graph + unsupported deletion tests |
| 18 | One coherent fresh-native authority | Combined guards and immutable external evidence | Changing cross-store planning/adoption | Identity/allocator/inventory tests |
| 19 | One transaction; separate event and receipts | Atomic definitions/receipt snapshots, no events | Completion-and-generation transaction, N1-E import | Memory/JSON faults/replays/crashes |
| 20 | Fail closed after ancestry fallback | Persistent recurrence-write fence across restart/ordinary writes | Verified reconciliation/production host | Corruption/marker/interruption tests |

D10-03/21/22/23/26 and D07/D08/D09 remain preserved invariants; D10-24/25 stay unresolved/outside scope. Count/until/exhaustion execution is deferred even though terminal result structure exists. No schema-only row is represented as a working generator.

## Privacy, History, Oath and production boundaries

Tests cover both shared Projects **Itacan** and **Obsidian Hub**, a private Project and all four Resources: Knowledge/study, Research/literature, Explorations/references, Inspiration/inspiration. Mounted/working Project context does not transfer Resource ownership. Series/template owner and partition must agree with initial task. Resource-to-Project linked ownership is not introduced.

Recurrence-member partition export rejects pending N4 rather than silently exporting task content without recurrence identity. Existing ordinary task-only exports remain unchanged; another eligible Project cannot export private Resource template/source evidence. No full generation/alias/raw source/local receipt/History/Oath/Strict/device/recovery export path was added. N4 canonical recurrence transport remains unimplemented.

History/current bindings/counting, Statistics deduplication/five ranges/All time default/original attribution, Oath `{id,path,text}`, both awaitingIndex bridges, Standard/Strict, fulfillment/outcomes and recovery remain unchanged in production. New native event checks strengthen schema-2 identity reservation only; completion/reopen transitions are reused. N1-E event/current-binding import and N1-F native Oath integration remain deferred.

## Executed tests

Final runs use explicit lists, existing VS Code Electron-as-Node 24.21.0, TS6.0.3 and the OS-Temp-only filesystem mutation guard. No dependencies were installed. `evidence/verification-run-final.json` records exact lists; complete outputs/errors and early diagnostics are retained.

| Newly executed suite | Passing result |
|---|---:|
| B1 foundation/invariants/persistence | **207 tests**, including 15 actual child interruptions |
| B0 evidence/specification | 22 |
| Gate A | 145 |
| N1-C Step/content | 180 |
| N1-B identity/recovery | 158 |
| N1-A compatibility | 158 |
| N0 read/readiness | 51 |
| Native core | 66 |
| Focused legacy readers/writers | 452 |
| Existing regression files | 34 file-level harness passes |
| Safe Strict/recovery | 48 |
| Prior TypeScript checks | 5, zero diagnostics |
| New B1 TypeScript check | 1, zero diagnostics; positive/negative contract examples |

Earlier test files/assertions and frozen observations were not edited. Initial B1 test-helper issues (synchronous rejection handling, invalid drive-like owner specimen and reading a closed/current-corrupt store instead of the selected test generation) were corrected without weakening runtime assertions. One earlier core schema rejection caught missing-namespace downgrade risk; runtime validation was corrected and the unchanged core suite passes. No frozen observations were recaptured. Later strengthened recovery capability-barrier changes were followed by another full explicit regression run.

The runnable memory-only documentation example and relative links are checked separately. No new browser execution: production graph/assets are unchanged. Historical browser results are not counted; unrelated divider/History heading-icon failures remain out of scope.

## Exact changed/new inventory and implementation hashes

**Six modified files**, all backed up before editing:

| Path under `ItacanTaskCore/src/` | Purpose | Final SHA256 |
|---|---|---|
| `domain.js` | Schema-2/namespace/receipt validation | `54CDD3EF093AFC765BB0F47C2196ECCA7BC2A802C21F5E2E0024163DAD7F5051` |
| `commands.js` | Four commands through existing dispatch; schema-2 reservation guards | `DC7D9283880EC9C3CBA2BEA39F60E8DBADEB45F2219273A2FC9275170F31A99C` |
| `repository.js` | Definition snapshots/readiness, atomic results, recurrence fence checks/export restriction | `E75AF0D0D5C305A16A87DA4074EAD6617E96E2D0935ED468D0D845FBE0BDDE5B` |
| `json-repository.js` | Version barrier and persistent recovery fence | `13C541EDEC77C4EED63FED31E05533A1FEB02093547549693C498DB4DFA9DD75` |
| `index.js` | Portable explicit validator exports | `FC49F1DCBD6C781A162075E34E4A7E67CDB7E0D9BF3E9F05D17C14548EACEC9B` |
| `contracts.d.ts` | Recurrence command/result/options/read contracts | `C27616D913A7A00F5A8AB2C494AE7846A1AF724154D58E59E4C73A547DEEF7AA` |

**Twelve new files**:

| Path | Purpose |
|---|---|
| `ItacanTaskCore/src/recurrence.js` | Definition rules/templates, reservation and pure future-graph validators; SHA256 `D5B3BF0AAF186ECAB189FA85A7E2899C8393E49076314BBBE233FEF677C277D2` |
| `ItacanTaskCore/src/recurrence.d.ts` | Actual B1 contracts; SHA256 `6E0F2C1A62D3F0DC0003915E02FED683F284C053F77A8D9BA5D25A045ED62781` |
| `ItacanTaskCore/RECURRENCE-FOUNDATION.md` | API/version/recovery/privacy format and runnable example |
| `ItacanTaskCore/tests/recurrence-foundation.test.cjs` | Rules/templates/revisions/current-occurrence isolation |
| `ItacanTaskCore/tests/recurrence-invariants.test.cjs` | Reservations/privacy/static future contracts |
| `ItacanTaskCore/tests/recurrence-persistence.test.cjs` | Memory/JSON receipts, faults, schema/corruption/fence/crashes |
| `ItacanTaskCore/tests/recurrence-crash-worker.cjs` | Disposable actual interruption child |
| `ItacanTaskCore/tests/recurrence-support.cjs` | Synthetic explicit fixtures/state assertions |
| `ItacanTaskCore/tests/recurrence-types.fixture.ts` | Positive/negative declarations |
| `ItacanTaskCore/tests/recurrence-typecheck.cjs` | Existing compiler, no emit/install |
| `lib/tests/native-recurrence-b1-verification.md` | This report, plugin-relative |
| `lib/services/TASK-SERVICE-PHASE-N1-D-B2.md` | Proposed B2 scope/gates, plugin-relative |

Archive `evidence/safety-final.json` independently records all before/after source hashes and all new-output hashes, including this report. `originals/` contains six verified pre-edit files; `reviewed-source/` contains exact eighteen final reviewed files. No report self-checksum is fabricated.

## Protected-state and build verification

Final comparison verifies **1,176 non-workspace/non-allowlisted original files unchanged**, all **345 original Markdown** unchanged, and **62 non-allowlisted original core files** unchanged. Six authorized files changed. All **431** preexisting status entries remain, plus twelve new paths (**443** final entries). All original backup hashes match baseline. No protected real task/data change was caused by tests.

| Protected state | Unchanged SHA256 |
|---|---|
| Original Markdown aggregate | `01B4F13529EA8C461B5B74098C8AD3B5728B2386CA6C87E9E02D8BEDE1BB3A41` |
| Non-allowlisted original core aggregate | `CAA87BB6F3D21BE792D577600BE4F184CCB850F3902AF9FCB08FF18B29F8C3B2` |
| Plugin data | `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7` |
| Task metadata | `AC081DBC5EC9CD156D341A5A2CBE397C24607EE52ADA52BEA8D8AC937E026F43` |
| Recorded History | `2F61CAB4668B1264B2BA99DCED1B07FDBA05D48A3D7F41CF6D78E1FDF9889892` |
| Completion checks | `8B881849D723AE28D0D7731F241AA6A850C025F16F2F396CE4B0FD842AD3C9E4` |
| Oath/Strict/device state | `FCC1DB2A09E634A4A19F6A16CA1134D4E3FA3F6D2E47D8CFDA745FA585B2805A` |
| Resource folders/mount definitions | `842B7832EBB45CEA89D252F1D8F01281A999CCC69EF7E3C4C17D246FD0DB4BF4` |
| Daily Brief | `7757973A84EA17611DC5D0E2BFAB3FBA4FFFE49212DF6404BA1104938855E19A` |
| Planning | `6AE5935E38C549DF0E6D0D35845B473B0953F204A2BA1E0CD253FF40275B0D76` |
| Shared Project container | `5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506` |
| Shared Itacan | `AE4FAF769FAE6039C422778398796F4B28168D26C7C2AAF1084EBFACDB13D389` |
| Shared Obsidian Hub | `95B8E407357E743F791A654CF6565C7C6B16E826C3F6ECA03164B57EBD359722` |

Aggregate is SHA256 of UTF8 sorted relative path + NUL + uppercase file SHA256 + LF. Health remains supported JSON/schema/structure, 174 History rows, zero projected-History diagnostics, seven Projects, four Resources and two shared Projects; inherited two stale-order warnings are unchanged. Additional substates and all exact per-file hashes are archived.

Workspace drift is recorded separately, never restored. Baseline `.obsidian/workspace.json` was `DA238EE5C3AFAA465251A4927F82841EB8856971849F056D9FADB2EAE85AE010`; an independent observation was `4F1B679425263275DA5328A5650ABE30D56AE852A5F50D5F6D166AE56EF74D9B` with modified UTC 2026-10-17T17:02:49.2823967Z. Latest archive comparison is authoritative; the independent writer was not instrumented, and guarded tests cannot write this path.

All twelve staged production assets before/after are byte-identical. Main has 168 factories and Atlas 24; changed/added/removed factories are zero. Current staged/installed distinction remains intentional:

| Artifact | SHA256 |
|---|---|
| Staged main | `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7` |
| Installed main | `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20` |
| Installed Atlas | `1345D4895B646507D61F88D34AA221CE5AD7D4652E4E15B49BF21ED76A2D47A4` |
| Installed Strict assets | `92B854B916604D138738CAF40D5FD5A266D5C2948A386CDFE30238DD6A614450` |
| Tasks 8.4.0 bundle | `2B4F9CE24D26F1D0CB191DCA9A73477454D256E03E51D81F37FAEEE7A293AD1B` |
| Moment 2.29.4 | `ECB84D57D5A7E3EC5F115BEF667656F2B9EDE90A03020525A2AF3573EA277453` |
| Frozen N1-A | `17DE517A3CCF3D8178A0647EB8F434565779491783BEA2A9EC4B5C66002D5080` |
| Frozen Gate A | `C797373FAEE445F7528FD47F5508E46165B0D92FBECA257CCB1A63336AA1D175` |
| Frozen B0 observations | `84B7BA46833BB6044CE936834D94E39BD0934534557CC6FEA6337AD474A319BB` |
| Frozen B0 proposal vectors | `5FA0D59A5DF34CA2D79FED90AC9FB93A720FF110F4F6AAB27C5937057759EF88` |

Production still calls `createLegacyTaskService(this)`; plugin/Task Service/UI/Markdown/Oath/History/Git sources and all installed assets are unchanged. Artifact scanning includes actual native `gen-*`, identity generations, CURRENT/RECOVERY, RECURRENCE-FENCE, writer/abandoned locks, excluding Git/backups; none was created in the real vault. All durable test storage was disposable OS Temp. No real task migration, identity-plan consumption, native production authority, generated successor/Steps, installed replacement, plugin toggle, Obsidian reload or restart occurred.

## Archive and B2 readiness

Archive: `System/Backups/itacan-n1db1-20261017-2b9075af/`. It retains complete request, fresh baseline and predecessor verification, six originals, eighteen reviewed final sources, exact explicit test/type/build/health logs, crash worker/source, before/after staged assets, protected comparisons and SHA256 manifest of every archived file except itself. Disposable audit directory: `C:/Users/El_Baraka 2025/AppData/Local/Temp/itacan-n1db1-a5d3dcaf1815474180957cceb08e577d`.

**Readiness: a separately authorized minimal inactive fixed-calendar DAILY/WEEKLY date-only B2 can build on this foundation.** Its first work must explicitly version the generated-state capability, then implement/calibrate the calculator and one completion/generation transaction, fresh task/Step instantiation, durable generation outcomes, E1/reopen/E2 semantics, spent/deleted-successor safety and new fault/crash tests. B1's static contracts do not prove that engine. Recovery reconciliation, changing cross-store planning, legacy migration and production/N1-E/N1-F/N3/N4 integration remain deferred. **B1 ONLY. STOP FOR USER REVIEW.**
