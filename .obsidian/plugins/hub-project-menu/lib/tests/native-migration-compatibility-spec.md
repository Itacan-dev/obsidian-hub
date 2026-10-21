# N1-A compatibility specification, format 1 / observation revision 1

Prepared 2026-10-17. **Specification and synthetic evidence only. STOP FOR REVIEW.** No migration policy in this document is implemented or approved by its publication.

Read with [versioned vectors](native-migration-compatibility-v1.json), [executable probes](native-migration-compatibility-probes.cjs), [observation checks](native-migration-compatibility.test.cjs), [decision sheet](../services/TASK-SERVICE-N1-DECISIONS.md), [N1-B handoff](../services/TASK-SERVICE-PHASE-N1-B.md), and [verification report](native-migration-compatibility-verification.md). Earlier [N0 report](native-read-verification.md) and [N1 handoff](../services/TASK-SERVICE-PHASE-N1.md) remain intact.

## Scope and evidence boundaries

Production authority remains Markdown/Dataview and existing writers. N0's opt-in read protocol and inactive memory fixtures remain inactive. This phase adds only seven test/data/document files. No domain, declaration, command, facade, consumer, source writer, startup, or installed artifact changes are authorized here. No alias ledger, quarantine store, recurrence engine, native binding importer, transport, persistent native repository, or host activation is created.

The installed main bundle is `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20`; the staged source build is `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7`. Their difference is intentional. Installation remains excluded.

Evidence is current-source execution, source inspection, or explicitly unverified. `observed` means a current function executed on synthetic input; it does not mean a migration passed. `rejected` records its actual error. `unsupported` means there is no equivalent operation in the tested interface; it is not a fabricated native rejection. `source-inspected` is an implementation finding without a full executable operation. `unverified` marks a missing behavioral proof. Test passes for those boundary records prove their explicit representation, not the missing capability.

Sources inspected include `plugin.js` completion/clear writers; domain `tasks`, `task-planning`, `task-progress`, `dates`, `history`, `statistics`, `oath-workspace`; task-service/legacy values, task-data/editor, committed Oath reads, recorded History projection, Statistics and shared-project services; N0 read contracts/fixtures; native `domain`, `value`, `commands`, `repository`, memory repository, contracts and serialization; their existing tests. Installed Tasks **8.4.0** manifest and minified main were inspected read-only. Dataset `evidenceSources` pins current source SHA-256 values. References beginning `lib/` or `plugin.js` are relative to `.obsidian/plugins/hub-project-menu`; `ItacanTaskCore/` and `.obsidian/` are vault relative. Function anchors name implementation symbols, not browser fragments.

## Versioned vector contract

The dataset envelope contains `format`, `fixtureVersion:1`, `observationRevision:1`, `nativeSchemaVersion:1`, capture date, timezone, evidence hashes, capture segments and ordered `cases`. Fixture format is independent of repository schema. `readVectors` rejects newer/unknown format versions; no repository schema migration is implied.

Each case has:

| Field | Meaning |
|---|---|
| `caseId`, `category`, `description` | Stable evidence identity and bounded claim |
| `legacyInput`, `legacyContext` | Original synthetic source/records and explicit clock/owner/timezone assumptions |
| `observedLegacyResult` | Frozen current output or rejection, including raw field types/absence |
| `currentNativeInput`, `observedNativeResult` | Separate current native challenge and result; not an approved translation |
| `requiredPreservedMeaning` | Established preservation requirement, not an assertion that current code achieves it |
| `proposedMapping` | Future interpretation; subject to the referenced decision's status |
| `expectedDisposition` | Proposed migration disposition, never executed by N1-A |
| `evidenceReferences`, `openDecisionIds` | Source functions and decision traceability; established IDs are references, not renewed approval requests |

Inputs deliberately include null versus omitted fields. JSON preserves scalar types, array order and source EOL escapes. No stringify-based ID conversion, timestamp invention, source normalization, or duplicate elimination is permitted in the evidence layer. Canonical native UUIDs use a deterministic injected allocator; source paths, titles, lines and checksums are evidence, never permanent task identities. Clock is fixed at `2026-10-17T10:00:00+02:00`, with explicit Europe/Stockholm local-calendar tests across both DST transitions. Oath's established fixture has its own fixed 26 October clock, recorded in the observed fixture outputs; the common context clock is not substituted into that fixture.

There are **147 cases**: identity 20; context 14; Steps 12; source content 17; dates 23; recurrence 8; History 21; Oath 20; privacy 7; retry 5. Three immutable capture segments preserve the initial 130 observations and later 13 content/date and 4 lineage observations. Segments and their hashes are archived. The test runner compares current results against those frozen observations. It never executes `proposedMapping` or treats a disposition as implemented.

Native and legacy inputs can test different boundaries. For example `COPY-*` compares indexed copied legacy IDs with a native global-reservation challenge, and `HIST-raw-*` compares raw legacy arrays with a native validation envelope containing original evidence. These are not full import simulations. A native record validator passing is weaker than repository/state/operation validation; `STEP-nested` passing validation does not establish completion bindings. Memory scenarios execute actual commands and validate the full candidate state. No case claims native Statistics or migration parity.

Future phases must read the version before using a case; preserve original inputs/observations; associate new implementation assertions with approved decision IDs; compare both preserved meaning and observable outputs; append a new capture/decision revision on changed behavior. Never overwrite an old expected result to fit a proposal. A changed source hash requires an explained new observation revision and retained old capture, even if the output appears unchanged.

## Identity, collisions and retired identities — D01–D03, D17

`taskIdentity` accepts exact hidden-comment alphanumeric/hyphen IDs, including legacy non-UUID and uppercase tokens; malformed/braced/underscore examples are not equivalent accepted IDs. `legacyTaskHandle` preserves accepted IDs exactly. Native UUID validation requires canonical lowercase UUID shape. Missing native record IDs fail validation; native create may allocate when the ID is omitted. This does not make allocation on every migration retry safe.

Indexed identity counts scan all pages before workspace filtering, including parents and Steps outside an owner root. Parent flags and metadata suppression should be read from the actual outputs: not every copied Step implies every reader flags its parent identically. Same-title ID-less tasks remain separate occurrences. The low-level locator can use a unique title fallback; the facade has stronger ambiguous-ID-less guards. That fallback is not migration identity evidence.

Native reservation is global across tasks, Steps, partitions and retired Step IDs. Candidate rejection occurs before state publication. Task deletion retains its record, identity, owner/content and deletion timestamp; Step deletion removes Step records/subtree and reserves retired IDs, retaining existing historical events. It does **not** preserve a complete deleted-Step content tombstone. Existing native state validators alone must not be described as a migration ledger.

Recommended: exact legacy alias plus canonical UUID, allocate once for ID-less occurrences under a frozen plan, quarantine ambiguous copies, reserve retired IDs forever within the applicable store identity namespace. Alternatives and approval scope are D01–D03. No first/last copy wins, title merge, owner-based conflict concealment, automatic comment rewrite, or path-derived permanent ID.

An ID-less occurrence needs a plan entry containing source revision/checksum, original parent/Step block and ordinal/range, owner, allocation, status and receipt identity. A same-title duplicate can be distinguished by explicit captured occurrence evidence within one frozen snapshot; changing that snapshot requires review. Movement without stable evidence is a source conflict, not grounds to allocate again.

## Owner, context and Phase — D04, D16

Each task has exactly one owner: Project or Resource. A location, phase, capture source or presentation reference is not a second owner. No `linkedProjectId` is introduced. Resources retain persisted IDs: Knowledge=`study`, Research=`literature`, Explorations=`references`, Inspiration=`inspiration`. Both Itacan and Obsidian Hub remain shared Projects; the private and shelved Project cases remain distinct.

Migration maps a source note's **parent folder** to folder context. The note itself is provenance unless an explicit note association was intentionally requested. `normalizeLegacyTask` currently returns source locator plus null native location; a future resolver must establish the folder's stable identity and same owner. Missing or cross-owner references must be explicit unresolved/quarantine outcomes, never silently promoted to root or note context. Project Phases must belong to the owning Project; Resources cannot acquire a Phase by being mounted/presented in a Project.

## Step structure and edits — D05

Legacy snapshots retain Step source ranges and indentation. The normalizer reconstructs ancestry through ranges, including Steps beneath ordinary prose bullets, and emits sibling order. Native Steps use explicit `taskId`, `parentStepId`, nonnegative sibling `order`, canonical IDs and independent completion. Missing parents, cycles, duplicate IDs/orders and foreign task IDs are rejected. A checked Step does not check its parent.

Current facade Step drafts lack explicit parent/order edit fields; legacy add supports parent-level append. The inactive core already has reparent/update and reorder commands. Closing that contract gap belongs to N1-C, not N1-A. Future tests must cover insertion before/between siblings, nested creation, reparent/reorder, independent completion, stale parent revision, and incompatible ancestor removal. Recommend explicit cascade for subtree deletion, retained historical events and reserved IDs, with full source evidence retained privately. Reject unsafe deletion by default; do not silently reparent surviving children. Full deleted-Step tombstones versus reversible sidecar evidence remains a reviewed design choice.

## Source and Search fidelity — D06

Fixtures cover LF/CRLF, tabs, Unicode, ordinary and quoted examples, hidden IDs and Obsidian `^block` references, inline Tasks syntax, links/embeds/tags/formatting, fences containing checkbox-like examples, prose, blank lines, same-title distinct blocks, nested lists and multiline explicit description. `readTaskSnapshot.block` joins LF, so it is not an original-byte archive. Quoted checkbox text is not accepted by the current line recognizer. Explicit metadata description remains separate from note continuation; nonstandard checkbox status is not equivalent to a generic completed boolean.

Native title/description alone cannot represent every original status marker, continuation, unknown syntax, EOL convention or third-party behavior. A JSON evidence value can hold content but does not itself define a reviewed provenance lifecycle. Recommend a private, versioned source envelope with exact raw block, source checksum/revision, parsed fields, note/range/folder evidence, owner/privacy and parser version, alongside canonical title and explicit description. Normalized block is a useful additional projection, never a replacement for raw evidence. Do not concatenate prose into description or strip syntax to force validation.

Future native Search must specify indexing of title, explicit description, continuations, structured metadata and privacy-safe retained content. Historical evidence must not casually surface as current task text. Ranking, all-content matches and navigation require consumer-level tests. N0 title scoring proves none of that parity.

## Dates and Necessity — D07–D08

Actual validators reproduce legacy acceptance/native rejection of same-date Start 18:00 / Due 09:00. Both reject reversed calendar dates. Date-only, midnight, leap/invalid dates, valid/invalid time, orphan time, year transition, DST gap/overlap and current grouping are captured. A manually constructed native endpoint dropping an orphan time is not an approved conversion; the original legacy validator rejects that input.

Established meaning: local dates/wall clocks remain local calendar values; date-only differs from explicit `00:00`; unknown completion instants remain null; migration time is not completion time. DST gap/overlap acceptance of endpoint values does not establish unique instant interpretation. Legacy JS local-calendar rendering/grouping must be tested explicitly at transitions rather than converting date-only values to UTC midnight. Necessity remains the UI label; must/should/null is compatible with internal importance. Unknown raw values must be retained for review even where a legacy projector defaults to null.

D07 compares grandfathered native validation, rejection/review, approved normalization and separate imported compatibility representation. Initial recommendation: quarantine reversed-time records unchanged until that policy is approved. This preserves current legacy Schedule/edit behavior for unmigrated records. A compatibility envelope could later preserve legacy ranges while new native tasks stay strict, but needs coherent query/edit/sort rules and approval. No clock swap, day increment or dropping a time by default.

## Recurrence and occurrence identity — D09–D10

Itacan delegates parent-line toggling to Tasks `apiV1.executeToggleTaskDoneCommand(line,path)` when available, otherwise checkbox fallback; Step toggle is local. Installed Tasks 8.4.0 source exposes `Cb`, which parses a line, invokes `toggleWithRecurrenceInUsersOrder`, serializes returned task lines, and joins them. `handleNewStatus` can produce `[nextOccurrence, completedOccurrence]` when entering completion with a next recurrence. Reopening/already-completed status transitions do not take that generation branch. `putRecurrenceInUsersOrder` applies configured ordering and `UD` can remove a completed occurrence for `onCompletion:delete`. `createNextOccurrence` clears Tasks' own `id`, block link, dependency IDs and done/cancel dates. **That Tasks ID is not the hidden Hub comment.** Exact Hub comment carryover and configured serialization remain unverified.

The installed recurrence parser supports `when done`, uses RRULE and Moment reference-date logic, advances occurrence date offsets and has month/year/DST handling. This is source evidence of branches, not a safe full configured-runtime replay. The API receives one line rather than a nested Step block. Four controlled callback vectors freeze Itacan's multiline splice, returned identities/state and surviving Step text; they do not prove real next-occurrence content, Hub-ID allocation, nested-Step reassociation, actual configured dates or History results. Four explicit unverified records retain those gaps.

Native schema/commands have no recurrence field/engine. Storing an intent string cannot restore behavior. Compare implementing a verified equivalent engine, preserving intent while quarantining affected tasks, mandatory per-series review, or a separately authorized legacy authority during transition. Recommend quarantine plus retained source until evidence and engine support exist. A hybrid authority would require exclusive per-task authority and route/recovery proofs; it is not authorized here.

Future evidence must distinguish series ID, occurrence ID, predecessor/next linkage, completed/deleted/reopened occurrence, original rule/reference dates, generation operation and completion-event ID. Recompletion creates a new completion event for the same occurrence, not a new series. A next occurrence must not inherit a globally reserved task/Step ID. These are proposed requirements; exact Tasks parity is unresolved.

## Completion, History and Statistics — D11–D14

Legacy `taskProgressMutation` records a completion plus a current check. Reopening removes the event linked by that check; recompletion adds a new event. Edit/delete housekeeping preserves recorded snapshots while updating/detaching current checks. Actual clear on seeded History removes source/check, retains the original completion and creates no second event. Clear of externally checked tasks has a different archive writer: it may use an available timestamp or archive time and retain presentation attribution; historical archive time must not be reinterpreted as a known completion instant. Existing writer regression tests cover that separate path. Failed History persistence can leave the Markdown checked with no recorded History; the new Map failure vector reproduces it.

Native completion adds an event/binding atomically; reopening retains that event with `counted:false` and `reopenedAt`, removing its binding. Task/Step deletion retains event evidence; current bindings detach. Creating an already-completed task creates a new event even with `completedAt:null`. `history.record` supports historical-only targets and cannot establish the original current binding. **`HIST-import-double-count-risk` executes historical-only append then completed create: two counted events result.** Retrying the same commands does not remove this semantic duplication.

Recommend future atomic import of reliably linked current state/event/binding, with a versioned hybrid retaining unlinked raw History separately. Separate append then reconstruct risks partial success and double counting; guessed title/path linking is forbidden. Evidence must include exact legacy ID mapping, current check/history relationship, source revision, raw event ordinal/ID/type, original snapshot/owner/context/time, confidence/reason and an operation receipt. Unreliable relationships stay historical-only or quarantined. Current APIs cannot perform that import; N1-E must add it only after review.

Raw recorded History is not a current-task reconstruction. Preserve original order, duplicates, missing/empty/null/numeric/string/zero/false IDs, invalid/unknown timestamps and archival fields. Retain owner at event independently of current physical owner and working context. No retroactive owner/title repair or name-based joining. Historical-only native envelopes in these vectors demonstrate validator capacity for raw JSON, not a reviewed persistence/privacy format or a bound import.

Statistics applies **truthy raw-ID deduplication before valid-time filtering**; numeric `7` and string `"7"` differ; falsey/absent IDs do not deduplicate. An invalid first duplicate can suppress a later valid event. Preserve all five ranges (7d, 30d, 3m, 1y, all), local-calendar bins, task/Step counts, historical owner/resource cohorts, deleted/inactive identity and legacy Project-name fallback. **All time is the existing UI default**; the pure aggregate helper's separate default argument is still 3m. Do not change it casually. Future proof must compare actual consumer Statistics inputs and aggregate outputs for all ranges/cohorts, including duplicates, invalid first records, DST, missing owners, repeated/imported/reopened/deleted work. Counting all retained native events is wrong; filtering native `counted` alone is not a full legacy mapping proof.

## Committed Oath — D15

Commitments remain `{id,path,text}`; ID is authoritative, path/text are recorded snapshots. Current committed resolution tolerates title/line/note moves when unique and still owned, resolves completion independently, and leaves copied/missing/foreign-owner records unresolved. Same-title replacement never recovers identity. Both newly allocated enrollment IDs and preexisting source IDs observed through a stale ID-less index legitimately use `awaitingIndex`. Two new vectors execute scheduled enrollment in synthetic Maps with fake fullscreen, fixed clock and deterministic IDs. They never activate real Oath or Strict. The rejected fresh-allocation-only restriction remains unapplied.

N0's native read fixture explicitly returns `unsupported-alias` for legacy references. It does not resolve them by title or source. Future exact alias resolution must cover canonical/noncanonical IDs, migration-allocated ID-less tasks (which cannot invent past commitments), copies, deleted/foreign owner/completed tasks and unavailable provenance. Keep commitment IDs, workspace, snapshots and outcomes unchanged. Prove exactly-once fulfillment, recovery, device history and Standard/Strict restrictions later using isolated hosts. No existing Oath history is rewritten.

## Privacy and version compatibility — D16–D18

| Class | Proposed/established treatment |
|---|---|
| Task/Step UUID, owner, title/description, endpoints, Necessity, Phase, completion state | Shareable only within owning eligible Project; existing native serializer covers public fields |
| Shared completion reference identity | Existing eligible Project packet supports references; not full private History |
| Exact legacy aliases | Conditional future portable allowlist; begin local/private; requires owner-safe cross-device design |
| Source path/block, parser evidence, migration receipts, quarantine, capture source | Private local by default; never export generic provenance envelopes |
| Full History, Oath, device/enforcement state, Resource definitions/mounts/private tasks | Forbidden from shared Project task export |
| Entire native generation, bindings/receipts/global indices | Forbidden as Git shared payload |

Both shared Projects and all four Resource partitions are tested. Legacy `selectShared` is keyed by supplied ownership/task IDs and is not a complete migration privacy validator. Native export strips migration/capture provenance and rejects private/Resource partitions. Mounted visibility must never supply export eligibility. Future aliases need owner-partition validation, so private source evidence is not leaked while planning portable aliases.

Future ledger, quarantine/evidence and plan formats require independent versions, minimum reader/writer versions, decision/capture revisions and explicit unsupported-newer outcomes. Never strip unknown/newer fields then write an older version. A plan must bind its source checksum, allocations, ledger revision and command receipt; restart repeats those identities or reports conflict. Format upgrades retain old evidence and cannot make unsafe source text exportable.

Future quarantine entries must preserve raw input, owner/privacy, all candidate identities, source revision, parsed result/error, reason code, decision/version and review/resolution history. Required dispositions are importable, exact-alias required, approved transformation, quarantine, unsupported, invalid source, ambiguous identity and source conflict. None may silently drop an occurrence, count it as migrated or allocate replacement identities on retry. No quarantine storage/UI is implemented now.

## Readiness and remaining proofs

**Ready for a limited N1-B subset; other decisions remain deferred.** The limited subset is an inactive identity-plan/alias/quarantine design implemented only after explicit approval of D01–D03, D17–D18 and its private scope. Recurrence, source/Step import, grandfathered dates, completion bindings, Oath alias routing and portable alias transport remain excluded. The generic native read readiness result is not import readiness.

Keep the proposed N1-B → N1-C → N1-D → N1-E → N1-F sequence, with privacy/version constraints designed into N1-B from the outset. Do not wait until N1-F to protect private ledger evidence. Recurrence and History evidence can be researched independently, but neither blocker is waived by an identity ledger. Review the decision sheet and N1-B handoff before any implementation. STOP FOR REVIEW.
