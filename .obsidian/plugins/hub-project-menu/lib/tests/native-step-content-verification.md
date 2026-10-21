# N1-C implementation verification

2026-10-17. **Inactive N1-C implemented; STOP FOR REVIEW.** D05/D06 are approved by the N1-C request for synthetic/disposable work only. [API and format](../../../../../ItacanTaskCore/STEP-CONTENT.md), [typed contracts](../../../../../ItacanTaskCore/src/step-content.d.ts), [N1-D handoff](../services/TASK-SERVICE-PHASE-N1-D.md).

Exact originals, baseline, complete request, guarded tests/builds, reviewed output copies and final hashes are retained in the [N1-C evidence archive](../../../../../System/Backups/itacan-n1c-20261017-ba9837e0/). `evidence/safety-final.json` records the final comparison; `evidence-inventory.json` hashes all archive files except itself. Initial disposable evidence directory: `C:/Users/El_Baraka 2025/AppData/Local/Temp/itacan-n1c-eb6863f0b9504345976da527eadb5799`.

## Scope and implementation inventory

Production still constructs one shared Task Service/Legacy Adapter in `task-service-host.js`. N0 opt-in reads, N1-B identity planning and N1-C task/content commands are inactive at plugin startup. No real native store, migration, alias routing, recurrence, date change, completion-event import, Oath/History writer, UI, Search ranking, transport or authority switch is introduced.

The existing core was inspected before extension: explicit ancestry/order, add/update/reorder/delete, independent completion, parent revisions, global UUID reservations, retired IDs, receipts, one-state candidate validation and memory/JSON publication already existed. The recorded pre-edit gap table distinguished those features from the missing atomic full-tree draft and exact-byte content lifecycle. No duplicate repository/dispatcher or separate evidence store was created.

Exactly **five existing files** changed, with pre-edit originals SHA-verified under `before/ItacanTaskCore/src/`:

| Existing file | Change |
|---|---|
| `ItacanTaskCore/src/commands.js` | One `task.editStructure` branch; reuse reservation/retirement/bindings; advance opted-in content alongside existing native edits |
| `ItacanTaskCore/src/domain.js` | Validate reserved private content and committed receipt continuity |
| `ItacanTaskCore/src/repository.js` | Pass fault hooks into actual command path; prevalidation/pre-receipt fault boundaries |
| `ItacanTaskCore/src/contracts.d.ts` | Typed command union and declaration re-export |
| `ItacanTaskCore/src/index.js` | Explicit portable capture/validation/current-content helper exports |

Exactly **13 new files**:

- `ItacanTaskCore/src/structural-edit.js`
- `ItacanTaskCore/src/source-content.js`
- `ItacanTaskCore/src/step-content.d.ts`
- `ItacanTaskCore/STEP-CONTENT.md`
- `ItacanTaskCore/tests/step-content-support.cjs`
- `ItacanTaskCore/tests/step-structure.test.cjs`
- `ItacanTaskCore/tests/source-content.test.cjs`
- `ItacanTaskCore/tests/step-content-persistence.test.cjs`
- `ItacanTaskCore/tests/step-content-crash.cjs`
- `ItacanTaskCore/tests/step-content-types.fixture.ts`
- `ItacanTaskCore/tests/step-content-typecheck.cjs`
- `.obsidian/plugins/hub-project-menu/lib/tests/native-step-content-verification.md`
- `.obsidian/plugins/hub-project-menu/lib/services/TASK-SERVICE-PHASE-N1-D.md`

Evidence scripts/logs/staged builds are confined to the named OS Temp directory and backup. No other existing source or prior report was edited. Existing tests/frozen observations were not weakened or recaptured.

## D05 contracts and structural guarantees

| Decision | Approved rule | Implementation | Tests |
|---|---|---|---|
| D05 | Explicit ancestry and sibling order | Versioned full draft; core hierarchy validator; deterministic preorder | First/between/append, three levels, duplicate order/missing parent/cycle rejection |
| D05 | Revision-guarded structural edits | Existing native task guard plus explicit content revision | Competing edits, stale native/content revision, unchanged failed candidates |
| D05 | Default reject / explicit cascade | Exact current descendants and nonoverlapping deletion requests | Leaf/default-unsafe/incomplete-confirmation/cascade/replay |
| D05 | Retired IDs and retained evidence | Existing retired-ID set/History/receipts plus private prior bodies/originals | Completed-Step cascade, unchanged events/counts, ID reuse rejection |
| D06 | Private versioned source envelope | Typed envelope/private carrier with independent versions/capability | Memory/JSON attach, unsupported newer contracts, public export sentinels |
| D06 | Byte-level original source fidelity | UTF-8 byte scanner, raw hex/SHA-256/ranges/EOL | Mixed EOL/BOM/Unicode/prefix/trailing bytes and corruption negatives |
| D06 | Canonical content separate from provenance | Explicit current fields and immutable original/revision chain | Independent title/description/body edits, source-independent insertion, retained old evidence |
| D06 | Unsupported-content preservation | Typed quarantine diagnostics/raw evidence/unresolved tail | Unknown marker/Tasks/metadata/comment/encoding/fence fixtures |
| D06 | Privacy-safe future Search boundary | Owner-scoped current-only specimen; unchanged public serializer | Frozen TEXT-* fields, History/Oath/source sentinels, both Projects/all Resources |

Only D05/D06 are implemented by this phase; deferred date/recurrence/History/Oath/transport policies are not marked implemented.

`task.editStructure` payload version 1 contains a versioned full `draft`, explicit `deletions`, title/description-only `taskPatch`, and null or versioned guarded `content`. Draft repeats the parent task UUID/current revision. Each Step explicitly declares existing/new, canonical UUID, parent UUID or null, sibling order, title, body and independent completion.

Existing Steps must belong to the task and keep identity/created/completion evidence. New IDs must be globally unreserved and open. Every old Step is kept explicitly or deleted explicitly. Missing/foreign parents, self-parent/cycles, duplicate IDs/order, negative/gapped order, implicit omission and completion changes reject before commit. Each final sibling group is exactly `0..n-1`, and committed Step/body arrays have deterministic preorder. Legacy schema-1 sparse ordering remains valid outside this new full-tree contract.

First/between/append insertion, reorder, reparent, movement between sibling groups and deeper subtree insertion publish as one validated operation. Subtree descendants retain stable parent/Step identities. Stale native/content revisions publish nothing. Failed candidates leave no receipts or durable ID reservations; a rejected proposed new Step can be retried. Completion remains independent, including a checked Step under an open parent with unknown null completion time.

Deleting an ancestor rejects by default. Explicit cascade must confirm the exact current descendant set and current parent revision, omitting the root from `descendantIds`. No silent reparenting or overlapping deletions. Removed IDs are retired globally and cannot be reused. Existing History/events/snapshots/counts remain intact; current removed-Step bindings detach. Structural operations emit zero completion events. Prior full task receipts, private content revisions/removed IDs and original source evidence provide recovery evidence. **No comprehensive Step tombstone schema or undo/restore operation exists.** Receipt retention/compaction is not designed here.

## D06 source envelope, bytes and parser

The typed private envelope independently versions format/parser/decision and records physical owner/privacy, document ID/path/root/revision, task/Step/revision association, full document digest/length, captured half-open absolute byte range, raw hex/SHA-256/EOL/BOM/final-newline evidence, folder context, explicit parsed metadata/description, derived normalized text/status/title/continuation/Step ranges and integrity checksum. Source parent folder is evidence with `noteAssociation:false`; source note remains provenance. No N2 registry/root attestation or automatic location resolution is claimed.

Supported UTF-8 captured bytes round-trip directly from hex, including LF/CRLF/mixed EOL, no final newline, BOM, multibyte prefixes, Unicode/combining/emoji, whitespace, tabs, blank paragraphs, comments, hidden Hub IDs, block references, links/embeds/tags and nested lists/Steps. Byte offsets are measured from supplied document bytes, never JS code units. Fatal decoding avoids replacement-character round trips. Unsupported UTF-8/UTF-16 retains the supplied bytes as quarantined evidence with null decoded text.

Normalized LF/parsed display fields remain separate from raw originals. Exact recognized Hub display comments can be omitted from parsed titles while retained in raw. Continuation prose does not become explicit description. Explicit description can be multiline and remains separately chosen. Metadata is explicit supplied evidence, not proof that unknown Tasks/date/recurrence/completion syntax was converted.

The minimal parser compares supported list-item boundaries and Step counts with unchanged N1-A source vectors/current legacy helpers. Parent/child ancestry survives intervening ordinary lists/prose; fence/quote examples do not become eligible Steps. Fence length/character are respected. Adjacent siblings and unindented following prose remain outside the capture. Nonstandard checkbox status, Tasks/inline metadata syntax, unknown comments, lone CR, selected examples and unclosed fences have explicit typed quarantine diagnostics. Ambiguous unclosed-fence tail bytes are retained separately as unresolved context, never promoted to current content. `supported-region` is a capture/parsing status, not import readiness or full Markdown equivalence.

Envelope validation re-derives normalized/parsed/EOL/range evidence and verifies checksums. Negative cases cover truncation, missing continuation/metadata/comments/block evidence, wrong owner/path/BOM/offsets, flattened parsed ancestry, modified digests and unknown versions/fields. The portable SHA-256 implementation matches Node crypto for standard/long/multibyte samples. Reverification requires exact source identity/location/revision and full-document bytes. Separate edited-title/indentation/moved-Step/note rename/note move/replacement/line-shift/ancestry/same-title/deletion fixtures reject without replacing captures or allocating identities. Reviewed rebasing is unsupported.

## Canonical lifecycle and same-state publication

Current task title/explicit description, Step title/body and current continuation are explicit native content. Original source syntax, parsed interpretation, historical generic evidence and prior current revisions are distinct. No capture is automatically promoted into current content, written back to a note or indexed.

The reserved private carrier is `migration.evidence.format:"itacan-private-task-content"`, version 1, decision `N1-C-D05-D06-r1`, exact capability `private-source-content-v1`. Prior generic evidence is retained as `previousEvidence`, and existing migration source/sourceId/importedAt remain unchanged. Source-independent opt-in uses the private carrier tag with importedAt null; that is not a completed migration or plan-consumption assertion. Old records outside the reserved namespace remain compatible.

Content revisions bind current live bodies/continuation, native fingerprint/revision, operation, removed IDs, original ID/checksum prefixes, previous-evidence digest and prior revision digest. Latest content and native hierarchy must agree. Stored receipts also prevent stripping the entire carrier or rewriting retained content history. Original capture replacement/relabelled rebasing conflicts; append/identical replay preserves originals. Existing native update/add/reorder/complete/reopen/delete commands maintain revision linkage automatically. No independent evidence write can half-publish with a hierarchy edit.

The SHA chain detects ordinary corruption; it is not a signature against hostile history replacement. Evidence/receipt growth is unbounded in these fixtures. No source-to-native full-note round-trip editor, format upgrade/reparse, compaction or original evidence deletion API is implemented.

## Future Search, physical owner and privacy

The owner-scoped `currentSearchProjection` is an explicitly unverified future specimen of current title, explicit description, continuation, Step title/body/ancestry/order and importance/start/due/phase. It excludes paths/original raw bytes, original metadata, previous generic evidence, old revisions, identity receipts, History and Oath. It is not production Search, a public export or a native navigation implementation.

Tests explicitly choose current values from frozen `TEXT-markdown`, `TEXT-explicit-description`, `TEXT-extra-multiline-description` and same-title block A/B vectors. They exercise existing pure title scoring and preserve formatting/link text, separate description/continuation, current Step text, native metadata and different current content under equal titles. This proves a field boundary, not full-content ranking/indexing/navigation parity. Historical-only sentinels never become current fields.

Synthetic coverage includes Itacan and Obsidian Hub as separate shared Projects, a private Project and all four stable Resource identities: study/literature/references/inspiration. Private owner/root attribution is checked; mount visibility cannot transfer ownership. Both Project packets exclude Resource tasks/evidence; all four Resource packet exports reject. Generic prior plan/alias/quarantine receipt sentinels and source/History/Oath sentinels stay private.

The existing public serializer is unchanged and excludes migration/captureSource completely. N1-C private current body/continuation also remain local; sharing them would require a reviewed canonical public schema. Full native generations are never treated as Git packets. No aliases, identity plans, portable receipt/History/Oath/Strict state or raw provenance are exported.

## Atomicity, fault injection and real recovery limits

The same real inactive command/repository path runs against memory and actual OS Temp JSON stores. Native candidate state, structure, current content, original evidence, retired IDs and receipt publish together. JSON uses existing generation staging/flush/verification and atomic manifest replacement; `CURRENT.json` publication is the commit boundary. Replay returns the original receipt/result even after later native edits; changed payload under the same ID conflicts. Concurrent edits based on one revision produce one winner and one stale rejection.

| Exercised boundary | Observed result |
|---|---|
| Pure capture creation/validation failures | No repository/store/identity side effects; invalid capture is not attached |
| Before command validation/draft normalization/hierarchy validation/source attachment; after content staging; before receipt persistence/before commit | Prior complete state and no new receipt; retry succeeds coherently |
| Before serialization/temp write; actual partial write/flush; generation verify/publish; before manifest replace | Old pointer remains authoritative; reopened structure/content agree |
| After manifest commit / before acknowledgement | New complete state reopens; retry replays once with stable IDs/content revision |
| Reopening transient storage I/O failure | Explicit failed open, committed files retained; clean reopen/replay succeeds |
| Corrupt checksum/linkage/range/receipt, removed originals/carrier or changed previous evidence | Existing native core reports recovery to a verified committed ancestor containing intact original evidence |
| Newer content/envelope/parser/capability/decision | `UNSUPPORTED_SCHEMA`, no ancestry downgrade or file rewrite |

Seven actual child-process exits interrupt after content staging, before receipt persistence, during temporary writing, after generation publication, before manifest replacement, after manifest commit and before acknowledgement. Ordinary reopen blocks on the abandoned writer lock. Tests reuse N1-B's unchanged explicit exact-lock/dead-process recovery helper, retain abandoned lock evidence, reopen the expected whole old/new state, and replay cascade once. Native History/retired IDs remain coherent, with no new tombstone collection.

Known-corruption recovery is the existing **reported committed-ancestry fallback**, distinct from N1-B's stricter identity-store failure policy. It may discard a whole last task/content revision and its receipt; it is not latest-state repair or a claim that arbitrary disk corruption loses no committed data. No verified ancestor means failed open. Future-format evidence cannot be downgraded to old ancestry. Single-writer advisory locking/local disposable storage is tested; directory fsync is best effort. Universal power-loss/cloud/OneDrive/distributed durability, hostile writers, cross-store plan consumption and production hosting remain unproven.

## Executed verification

Every mutable test ran with the OS Temp filesystem guard, explicit file lists and synthetic/fake-host data. No archived discovery, installed plugin onload or real Oath/Strict start occurred. Runtime: VS Code Electron-as-Node 24.21.0, Europe/Stockholm; existing TypeScript 6.0.3, no dependency installation.

| Check | Current result | Evidence log |
|---|---|---|
| N1-C source/structure/persistence, 3 files | **180 passed**, zero skipped | step-content-accepted |
| N1-C actual process crashes | **7 cases** within those 180 | step-content-accepted |
| N1-B identity/recovery, 2 files | **158 passed** | identity-final |
| N1-A frozen vectors/invariants | **158 passed**, JSON unchanged | compatibility-final |
| N0 read/readiness, 3 files | **51 passed** | readiness-final |
| Existing inactive core, 2 files | **66 passed**, portable import check included | core-verified |
| Legacy focused, 24 explicit files | **452 passed** | focused-final |
| Existing regression files | **34 passed** file-level suites with internal assertions | regression-final |
| Safe Strict/recovery, 5 files | **48 passed** | strict-final |
| Task Service/core/identity/N1-C declarations | **0 diagnostics**, 4 checks | task-types-final, core-types-final, identity-types-final, step-content-types-verified |
| Read-only health before/after | **Passed**, identical data/substates | preflight-health, postflight-health |
| Source builds before/after | **Passed**, 168 main / 24 Atlas factories | source-build-before, source-build-after |
| Documentation/example | Relative links and standalone memory example checked | documentation-check |

All earlier phase assertions remain unchanged. Two new-test expectation errors were corrected and their failed logs retained: the initial no-final-newline fixture appended an unrelated checkbox without a separator; the later Search assertion wrongly expected a positive exact-match score where the existing helper returns zero. The safety aggregation script was also corrected to normalize PowerShell object types before sorting; individual protected file hashes never differed. These are fixture/evidence corrections, not recaptured compatibility outputs or hidden test failures. Final required checks pass.

No new browser run was necessary because production assets/factory graph are byte-identical. Historical browser passes are not counted as current. Inherited divider-alignment and History heading-icon failures remain untouched; no unexecuted tails are counted.

## Baseline, protected state and artifact comparison

Fresh baseline: **1,140 inventoried source/protected files**, including **330 Markdown**, **38 existing native-core/identity files**, and **389 preexisting Git status entries**. This is the recorded protected/source inventory, not a claim to hash every unrelated ignored file in the vault. The existing five-file and new thirteen-file allowlists were established before edits. Five exact originals were backed up and SHA-verified before and after work.

**1,134 non-allowlisted/non-workspace baseline files remain byte-identical.** All 330 preexisting Markdown files match individually and in aggregate. Existing dirty Git entries remain present; final status adds only the 13 authorized new outputs (**402** entries). No reset/clean/rebase/commit or unrelated restoration occurred. Original five files are the only modified baseline sources; exact before/after hashes appear in final safety evidence.

Prior archive manifests reverify: N0 **118**, N1-A **83**, N1-B **88**, consolidated audit **53** files. Current N0 **16**, N1-A **7** and N1-B **15** reviewed outputs match their archived originals. N1-B source/identity formats/aliases/plans/reservations/receipts and their evidence remain untouched; N1-C never consumes planning state or coordinates a second store. Frozen N1-A observations remain exact.

| Protected artifact | Unchanged SHA-256 |
|---|---|
| Plugin data, including metadata/History/checks/Oath/Strict/device state | `CAB5DC6C82E77D3719AEAB33B92A4B31F5DE89258974F1AC9910E9455A94F9AA` |
| Shared state containing both Projects | `5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506` |
| Frozen N1-A vector JSON | `17DE517A3CCF3D8178A0647EB8F434565779491783BEA2A9EC4B5C66002D5080` |
| Installed main | `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20` |
| Staged main before/after | `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7` |
| Installed Atlas | `1345D4895B646507D61F88D34AA221CE5AD7D4652E4E15B49BF21ED76A2D47A4` |
| Installed Strict asset manifest | `92B854B916604D138738CAF40D5FD5A266D5C2948A386CDFE30238DD6A614450` |
| Original Markdown aggregate | `D9B96730E098E2F25C1DD0D017AFD3EF4F9AF0F25A7BF2A2AC9418C09F130CB9` |

The aggregate hashes sorted relative path + NUL + uppercase file SHA-256 + LF using UTF-8. Individual original-core files and changed native modules have separate before/after hashes in `safety-final.json`; the aggregate of the 38 original native-core/identity paths changes only because of the five allowlisted edits. New files have their own output inventory hashes.

Both shared Project registration subobjects also have unchanged hashes, using UTF-8 PowerShell compact JSON (containing shared-state file is byte-identical): Itacan `AE4FAF769FAE6039C422778398796F4B28168D26C7C2AAF1084EBFACDB13D389`; Obsidian Hub `95B8E407357E743F791A654CF6565C7C6B16E826C3F6ECA03164B57EBD359722`. Protected task metadata/History/checks/Oath/resource/mode/Daily Brief/planning subhashes match preflight. Read-only health remains 174 History rows, zero projection diagnostics, seven Projects/four Resources/two shared Projects. One inherited stale-project-card-order warning remains unchanged. Prior U3 writer attribution remains unidentified; no unavailable historical snapshot is reconstructed.

All **12 staged main/Atlas/Strict/Oath auxiliary assets** match before/after exactly. Production factories changed **0**, added **0**, removed **0**. N1-C's two new runtime modules and five modified core modules remain outside that graph, with no test adapter/import/startup added. The staged/installed main distinction is preserved intentionally. No asset was installed and no Obsidian reload/restart/toggle occurred.

Workspace exception: `.obsidian/workspace.json` began at `5C6D70FDBF3C4EDFDF74F4AB0883C83E5E00757B4D9D3A2C76294CAF46ED9B02`; observed later `5D92BC2EA366E2579C5CB5D8AC1BF0EB72CF0A23813F99E7C8F804BD78C86EB1`. Final hash/time is in safety evidence. The independent writer was not identified, and guarded checks cannot write that path. No workspace or old user data was restored. This phase therefore does **not** claim zero vault changes.

Real-vault native storage/pointer/generation/lock/quarantine/migration artifacts created: **zero**. New deliverable sources/reports and backup copies are not live task storage. No real task/Step/event/binding/Oath outcome was migrated or rewritten; no production native repository or content authority became active.

If reversal is requested later, first compare current files with final output hashes; restore only the five original source copies and remove only the thirteen new outputs after checking no later work. Preserve evidence. Never restore the whole repository, old Markdown/data/History/Oath or independent workspace state.

## Remaining blockers and N1-D readiness

N1-C establishes inactive hierarchy/content safety and exact retained original-byte evidence for tested captures. It does not establish production Markdown-equivalent editing/Search/navigation, authorized source rebase, reviewed identity-plan/task cross-store consumption, long-term retention/compaction, a production host/location registry, date/recurrence parity, completion binding/History import, production Oath aliases, Git transport or live migration/authority activation.

The [N1-D handoff](../services/TASK-SERVICE-PHASE-N1-D.md) preserves D07 reversed same-day clocks, D08 date-only/midnight/local wall clock/DST/null timestamps, configured Tasks evidence limits, D09 recurrence/quarantine choice, D10 separate series/occurrence/event lineage, complete/reopen/recomplete/next generation/Step identity and private/shared boundaries. **N1-D can safely begin after N1-C review and explicit date/recurrence policy authorization; D10 implementation still requires configured evidence and review.** No next-phase blocker has been waived and N1-D has not begun.

**STOP FOR REVIEW AFTER N1-C.**
