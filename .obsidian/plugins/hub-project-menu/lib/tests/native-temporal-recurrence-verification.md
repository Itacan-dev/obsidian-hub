# N1-D Gate A verification — dates and recurrence evidence

2026-10-17. **Gate A implemented, inactive. STOP FOR USER REVIEW.** D07 preserve-and-quarantine and D09 recurrence preserve-and-quarantine are explicitly approved by this phase's request; D08 remains an invariant. **D10 is proposed only and no native recurrence engine is implemented.**

[Temporal API/format](../../../../../ItacanTaskCore/temporal/README.md), [typed contracts](../../../../../ItacanTaskCore/temporal/contracts.d.ts), [configured recurrence evidence](native-recurrence-evidence.md), [D10 proposal](native-recurrence-d10-proposal.md), [Gate B handoff](../services/TASK-SERVICE-PHASE-N1-D-B.md), [Gate A backup/evidence archive](../../../../../System/Backups/itacan-n1da-20261017-b753687c/).

The archive contains the complete request, fresh baseline, exact reviewed source/evidence copies, guarded test/build/health logs and final safety comparison. `evidence-inventory.json` SHA-verifies every archive file except itself. Disposable execution directory: `C:/Users/El_Baraka 2025/AppData/Local/Temp/itacan-n1da-14a47ad86716436b9975c4ec26c425f8`. Exact final file/source hashes and protected substate hashes are in `evidence/safety-final.json`.

## Pre-edit inspection and gap inventory

Applicable `Projects/Itacan/Meta/AGENTS.md` contains only TODO. Current N1-D handoff, N1-C API/report/core/commands, existing N1-A decision sheet/specification/frozen date/content/recurrence vectors/report, N1-B planning/quarantine API/report, N0 contract/report and relevant Phase 2B service/reader/writer/Schedule contracts were inspected. The current decision filename is `TASK-SERVICE-N1-DECISIONS.md`; historical approvals/observations were not rewritten.

Actual source was used: `domain/dates`, `domain/task-planning`, `domain/task-views`, `domain/tasks`, legacy value/Task Service host contracts, current `plugin.js` mutation/delegation, native `domain`/`commands`/`value`, identity planning and N1-C capture/structure. Installed Tasks' current manifest/bundle/settings/filter/status/parser/recurrence/serialization/API wrapper branches were inspected. A source-backed gap inventory was saved in the fresh preflight baseline **before implementation**:

| Capability | Existing legacy source/behavior | Existing native behavior | Gate A action |
|---|---|---|---|
| Date-only | validateTaskMetadata / parseLocalISODate | `{date,time:null}` endpoint | Reuse validators; preserve raw precision |
| Explicit time/midnight | fromTime/dueTime and validLocalTime | HH:mm or null, distinct | Preserve explicit 00:00; no UTC conversion |
| Local wall clock | localDateTime uses local Date | Local fields, no zone/instant resolution | Separate accepted field, zone evidence and display |
| Start/due ordering | Calendar dates only | Same-day clock comparison also | D07 mismatch quarantine |
| DST gap/overlap | JS normalizes/chooses local offset | Endpoint syntax accepted without unique-instant claim | Intl round-trip candidate evidence; unresolved clocks blocked |
| Completion instant | History timestamp/null | Nonnegative integer/null, binding separate | Retain known/unknown without event import |
| Schedule grouping | taskGroups/task-views | Read dates, no production consumer routing | Existing pure bucket/sort/calendar tests |
| Recurrence detection | Tasks parser; N1-C uninterpreted raw syntax | No native semantic conversion | Conservative marker/evidence classification, optional reviewed parser witness |
| Recurrence execution | Installed Cb/status/recurrence/serializer | None | Synthetic configured investigation; D09 remains blocked |
| Series/occurrence identity | Hub comments and Tasks IDs differ | No approved series/generator schema | D10 proposal only |

## Exact implementation inventory

Existing files modified: **zero**. Fresh original-file backups required: **zero**, because the exact allowlist is new paths only. No prior tests/assertions, source/declarations, reports, plans or receipts were edited. Fifteen new outputs:

| Path | Purpose |
|---|---|
| `ItacanTaskCore/temporal/index.js` | Independent pure classifier and denied public projection |
| `ItacanTaskCore/temporal/contracts.d.ts` | Independent versioned candidate/result/witness/diagnostic contracts |
| `ItacanTaskCore/temporal/README.md` | API, precision, quarantine, privacy and evidence limits |
| `ItacanTaskCore/temporal/tests/compatibility.test.cjs` | Date/native mismatch, evidence preservation, versions, owners/privacy |
| `ItacanTaskCore/temporal/tests/local-calendar.test.cjs` | Stockholm/Intl/DST and actual Schedule/calendar helpers |
| `ItacanTaskCore/temporal/tests/recurrence-evidence.test.cjs` | Reproduce installed outputs, pure classification and Map-writer failures |
| `ItacanTaskCore/temporal/tests/tasks-harness.cjs` | Test-only hash-pinned actual Tasks/Moment VM host |
| `ItacanTaskCore/temporal/tests/fixtures.cjs` | Synthetic candidates and configured case inputs |
| `ItacanTaskCore/temporal/tests/gate-a-evidence.json` | Exact new configured observations/settings/provenance |
| `ItacanTaskCore/temporal/tests/types.fixture.ts` | Positive/negative temporal declarations |
| `ItacanTaskCore/temporal/tests/typecheck.cjs` | Existing compiler, no installation/no emit |
| `lib/tests/native-temporal-recurrence-verification.md` | This report |
| `lib/tests/native-recurrence-evidence.md` | Separate evidence-level matrix and findings |
| `lib/tests/native-recurrence-d10-proposal.md` | Unimplemented alternatives/policy/transaction proposal |
| `lib/services/TASK-SERVICE-PHASE-N1-D-B.md` | Review-gated Gate B/B0 handoff |

Last four paths are relative to `.obsidian/plugins/hub-project-menu/`. The one new runtime module is outside native/core/plugin exports and startup. There is no new dispatcher/store/ledger/command/schema mutation. Existing pure validators/projectors are reused; Intl adds an assessment of already validated wall-clock fields rather than a duplicate date parser.

## Temporal contract and D07/D08 evidence

Private candidate/result format, policy version and decision revision `N1-D-A-D07-D09-r1` are independent of other phases. The result retains the entire original JSON, source envelope/rule/identity/owner/context/completion evidence and typed reason/decision/field diagnostics. Unknown/missing/newer mandatory contracts/policies produce unsupported-format without downgrade. Corrupt/conflicting source/checksum/witness blocks; non-JSON inputs reject rather than losing fields.

Statuses distinguish representable temporal evidence, explicit quarantine, invalid legacy dates, ambiguous/incomplete evidence and unsupported future contracts. Legacy acceptance, native representability, wall-clock resolution, completion and recurrence remain separate dimensions. `temporalGate` may be clear, but `automaticImportAllowed` is **always false**: identity planning, temporal compatibility, recurrence execution and actual import are distinct. No published N1-B plan/disposition/alias/reservation/receipt is rewritten. Future migration must compose separately versioned, source/revision-bound readiness; no integration writer is added now.

| Date/time case | Actual current result / Gate A policy |
|---|---|
| Missing start/due, one missing | Preserved; corresponding endpoint absent, no invented instant |
| Both date-only | Native local date/null-time; date-only wall-clock evidence has zero candidate instants |
| Date-only start + timed due / reverse | Distinct precision retained; existing validators applied |
| Both timed / equal endpoints | Valid current ordering remains representable |
| Explicit 00:00 versus missing/empty time | Explicit minute precision differs from date-only; original missing/null/empty field evidence retained |
| Same day Start 18:00 / Due 09:00 | Legacy accepts, actual native validator rejects; **unchanged values quarantined with D07 reason** |
| Reversed calendar dates | Existing legacy/native validators reject; no repair |
| Orphan/24:00/invalid February | Existing legacy rejection retained; no dropped-time conversion |
| Leap day / month end / midnight/year boundary | Actual calendar helpers and native accepted inputs tested |
| Must/should/unassigned | Preserved; user-facing term remains Necessity |
| Unknown raw Necessity/nonstring temporal values | Retained, explicitly ambiguous; normalizer defaults not silently accepted |
| Known completion instant / null unknown | Exact millisecond value/null retained, no import/current/due/reference time substituted |
| Invalid/open-with-completion evidence | Retained and blocked, not relabelled completion |

The native assessment uses `validateTask` on a non-persisted validation-only record; it calls no identity factory or repository. N1-A's current rerun independently reproduces frozen validator outputs, including both validators' calendar-order rejection and the reversed-clock mismatch. No endpoint validator was relaxed. No legacy task is newly marked invalid or removed from its current authority.

## Local clocks and Schedule

Explicit Europe/Stockholm evidence distinguishes accepted local syntax, native endpoint representability, uniquely resolvable instant, ambiguous/nonexistent zone clock and current calendar display. Winter 09:00 resolves to 08:00Z; summer 09:00 to 07:00Z. Spring 2026-03-29 02:30 has **zero** candidates; autumn 2026-10-25 02:30 has **two**, 00:30Z and 01:30Z. Both domains accept those wall-clock fields, but Gate A reports D08 unresolved conditions without selecting/rewriting an instant. Known completion time is never used to infer an offset. Candidate instants are diagnostic evidence only.

Existing JS helpers normalize spring 02:30 to 03:30 and pick the earlier autumn overlap offset in this runtime. Those observations are not adopted as import policy. Date-only remains a local calendar value and explicit midnight remains separate. Tests cover before/after transitions, midnight/month/leap/year boundaries, invalid dates and a missing/unsupported timezone. Tested target is modern Stockholm/this Intl runtime, not a universal historical zone proof.

Actual Schedule helpers retain Past due/Today/Tomorrow/Later/Unscheduled, due-over-start bucket preference, current local day, completed/future filtering, untimed Start at local midnight, untimed Due at end-of-day, time/date-only sorting, stable ties and Necessity ordering. A midnight due today is overdue but remains in Today's calendar bucket. Week/Month grids and timeline day ordinals span 23/25-hour DST changes without fixed-day-millisecond geometry. Itacan's 06:00 work day remains distinct from calendar display.

No native Schedule parity is claimed from endpoint validation. Full future consumer integration still needs eligibility/physical owner/location/completion/ID/invalidation/query/rendering/review-policy routing; none is changed here.

## Recurrence classification and configured findings

D09 preserves the original rule/source/identity/content/dates and blocks unsupported native recurrence. Typed statuses distinguish explicit absence, recognized-but-native-unimplemented, present-unverified, unsupported/ineligible, malformed and ambiguous evidence. Marker detection is conservative; natural-language syntax is not guessed by a new parser. Optional reviewed version/hash/input/settings parser witnesses are separate evidence. Even recognized syntax remains blocked. N1-C source quarantine remains a blocker and cannot be overridden by a new parser witness.

The [separate evidence report](native-recurrence-evidence.md) contains all 39 case IDs and an evidence-level matrix. Actual installed Tasks 8.4.0 parsing/status/recurrence/serialization executes in a fake-host VM under known synthetic settings, with installed Moment 2.29.4 and fixed shared clock. No plugin constructor/onload/real vault/settings/Dataview is used. The public API wrapper is source-inspected; the actual called recurrence function is executed, without rewriting its algorithm. A separate Map host executes current Itacan delegation/splice/History methods without onload.

Important observed outcomes:

- Daily/weekly/monthly/yearly/interval/when-done and several calendar/date-offset/settings branches execute reproducibly.
- Next/completed order is configurable; delete can leave next only or zero lines.
- Next clears Tasks ID/dependency/block reference but duplicates hidden Hub UUID comments.
- Untouched nested Steps attach to the last returned parent, changing with ordering; checked descendants remain checked.
- Completion/reopen/recompletion executes, but pure Tasks has no native durable generation receipt.
- `every frobnication` is permissively parsed as weekly Friday; recognized does not imply faithful intent.
- Some bounded/end/count cases return literal `Invalid date`, and an end-date text changes in the observed output. Gate A preserves these results instead of normalizing them into acceptable native values.
- Plain `09:00`/`00:00` text is retained as description, not proof of timed native recurrence equivalence.
- Source acknowledgement loss and History failure leave different synthetic source/History states; retries can reject copied identity. No durable native generation recovery is inferred.

Evidence levels remain explicit: **39 executed configured installed cases**, **3 executed status transitions**, **2 configured-plus-pure full-block splice cases**, **6 Map-host writer/failure cases**, source-inspected wrapper/settings branches, historical controlled callbacks and explicitly unverified/deferred domains. No bad-output match or source-only finding is counted as a native parity pass. Actual user settings were never used to make a configured-runtime claim.

New evidence JSON SHA-256: `C797373FAEE445F7528FD47F5508E46165B0D92FBECA257CCB1A63336AA1D175`. Original N1-A JSON remains unchanged at `17DE517A3CCF3D8178A0647EB8F434565779491783BEA2A9EC4B5C66002D5080`.

## Identity, content, History, Oath and privacy

There is no series/occurrence allocation, completion-event import, History deduplication, Statistics change, native Oath alias/routing or portable recurrence lineage. N1-C hierarchy/cascade/retired IDs/original byte captures/content revisions and same-state publication remain unchanged. Source originals/rules are never replaced/relabelled, and identity conflicts cannot be bypassed by changed labels or allocation. Future History current-binding/double-counting work remains N1-E.

Both shared Projects, a private Project and all four Resource IDs study/literature/references/inspiration are covered. Source owner/context remains exactly physical; mounts do not transfer ownership. Original raw/content/private plan/History/Oath sentinels are retained privately. The new public projection always rejects; temporal records are not attached to tasks or passed to the unchanged sharing serializer. Neither Project can acquire mounted Resource evidence. No Git or full-generation export is introduced.

The D10 proposal separates stable series UUID, per-occurrence Task UUID, event UUID, immutable rule revisions, explicit predecessor/successor, captured reference/generation clock, proposed one-successor receipt key and alternative Step/template policies. Actual Tasks evidence is distinguished from deliberate product choices. Fresh per-occurrence Step IDs/reset/template direction requires user review; no template-copying policy is implemented. Proposed atomic generation depends on a reviewed one-state schema/reservation boundary, N1-E for old bindings/import and N3 for live orchestration; independent identity/task stores are not magically atomic.

## Verification executed now

Explicit file lists only; no recursive archive discovery. Mutable tests run with the existing OS Temp filesystem guard, synthetic data/fake hosts and deterministic clocks. Runtime: VS Code Electron-as-Node **24.21.0**, Europe/Stockholm. Existing TypeScript **6.0.3** was used, without installation or emit.

| Suite | Actual current result | Evidence prefix |
|---|---|---|
| New Gate A, three files | **145 passed**, zero skipped | gate-a-verified |
| N1-C Step/content, including seven process crashes | **180 passed** | step-content-final |
| N1-B identity/recovery | **158 passed** | identity-final |
| N1-A frozen compatibility | **158 passed** | compatibility-final |
| N0 read/readiness | **51 passed** | readiness-final |
| Existing inactive core | **66 passed** | core-final |
| Legacy focused consumers, 24 files | **452 passed** | focused-final |
| Existing regression files | **34 passed** file-level suites/internal assertions | regression-final |
| Safe Strict/recovery | **48 passed** | strict-final |
| Four existing declarations + new temporal declarations | **0 diagnostics**, five checks | task/core/identity/content/temporal-types-final |
| Read-only pre/postflight health | **Passed**, same data/substate hashes | preflight-health, postflight-health |
| Staged source builds | **Passed**, 168 main/24 Atlas factories | source-build-before/after |
| Documentation/API example | Relative-link and standalone pure example verification | documentation-check |

Gate A's classifier is pure and adds **no persisted compatibility state**. It has evidence/version/conflict/repeated-call checks, not invented durable crash guarantees. Six Map-host writer scenarios cover actual legacy API/write/acknowledgement/History failures and retry observations. Existing N1-C/N1-B/core persistence/process tests are rerun but not relabelled new Gate A durability tests. Native JSON's reported fallback may lose the last committed revision/receipt; identity storage remains stricter fail-closed. Universal power-loss/OneDrive/distributed/latest-acknowledged recovery is unproven and unchanged.

Development evidence retains failed setup attempts: initial raw ASAR inspection needed Electron's read-only raw archive mode; VM Date instances initially differed across realms; a template-string newline needed raw escaping. The first draft filter test did not initialize the filter singleton, then was corrected to mirror inspected settings application before the final evidence freeze. One new test fixture used the wrong synthetic owner and was corrected. A PowerShell summary display needed an explicit object cast; actual safety JSON/hash checks were correct. Final published evidence is reproduced by passing tests; no old compatibility outputs/assertions were changed.

No new browser run was needed because production builds/factories remain byte-identical. Historical browser passes are not counted as new; inherited divider-alignment and History heading-icon failures remain outside scope, with no unexecuted tails counted.

## Fresh baseline and protected data

Before source edits: **1,155 source/protected files**, **334 Markdown files**, **49 existing native-core/identity files**, **403 dirty/untracked Git status entries**. Scope: Git cached/untracked nonignored files plus all Markdown (excluding git/trash/node_modules/backups), explicit installed plugin/data/workspace/shared and Tasks bundle/manifest/settings hash. This is not a claim to inventory every unrelated ignored vault file. All fifteen output paths were absent and allowlisted before implementation; no existing file was authorized to change.

Current data was already different from the prior N1-C snapshot at phase entry: `data.json` was `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7`, and one additional Resource task note was present. These preexisting changes are preserved, not restored to CAB5… or attributed to a writer. Current read-only health passes: **174 History rows, zero projection diagnostics, seven Projects/four Resources/two shared Projects**. Two preexisting stale-project-card-order references remain untouched; no repair was performed. The historical U3 writer remains unidentified; no unavailable old private snapshot is reconstructed.

**1,154 non-workspace baseline files remain byte-identical.** All 334 original Markdown and 49 preexisting native-core/identity files match individual/aggregate hashes. All 403 preexisting Git entries remain; final status adds only fifteen authorized outputs (**418** entries). No existing source, frozen fixture, Tasks bundle/settings, Markdown, task metadata, History/checks, Oath/Strict/device state, Resource/mount/Project/planning/Daily Brief data or sharing state was changed by Gate A. Current substate hashes are retained in safety evidence.

Prior archives reverified both before and after: N0 **118**, N1-A **83**, N1-B **88**, N1-C **118**, consolidated audit **53** files. Current reviewed outputs match: N0 **16**, N1-A **7**, N1-B **15**, N1-C **18**. Thus N1-C's five changed-core outputs and thirteen additions, exact-byte fixtures, originals/receipts and N1-B source/plan/receipt evidence remain intact.

| Artifact | Preserved/reverified SHA-256 |
|---|---|
| Fresh protected plugin data | `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7` |
| Shared state containing both Projects | `5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506` |
| Installed Itacan main | `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20` |
| Staged before/after main | `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7` |
| Installed Atlas | `1345D4895B646507D61F88D34AA221CE5AD7D4652E4E15B49BF21ED76A2D47A4` |
| Installed Strict asset manifest | `92B854B916604D138738CAF40D5FD5A266D5C2948A386CDFE30238DD6A614450` |
| Tasks 8.4.0 main | `2B4F9CE24D26F1D0CB191DCA9A73477454D256E03E51D81F37FAEEE7A293AD1B` |
| Original Markdown aggregate | `4F855CA284E854932A2CED1CDF1E31417E0FBB0911B1B43E713B91902D3C7377` |
| Original native-core/identity aggregate | `0C2603D535F559FF3E8CF0D90D45D77C3B5D4A80A414028C60BC34A7ACAF85A4` |

Aggregate is SHA-256 of UTF-8 sorted relative path + NUL + uppercase file SHA-256 + LF. Final hashes for each new source/output are in safety/archival inventories. Both shared registration objects are unchanged under PowerShell compact JSON hashing: Itacan `AE4FAF769FAE6039C422778398796F4B28168D26C7C2AAF1084EBFACDB13D389`, Obsidian Hub `95B8E407357E743F791A654CF6565C7C6B16E826C3F6ECA03164B57EBD359722`; the containing file matches the fresh baseline byte-for-byte. Resource definitions/mounts and all protected substates remain unchanged from the fresh entry state.

All **12 staged main/Atlas/Strict/Oath auxiliary assets** are identical before/after. Production factories changed **0**, added **0**, removed **0**. Existing host still constructs one shared Legacy Adapter; N0 opt-in native reads, identity planning and new temporal helper remain inactive. No test adapter/native import/startup or native core module changes enter the production graph. Staged versus installed main remains intentionally different; no installation is used to reconcile it.

Workspace exception: `.obsidian/workspace.json` began `51DCD7ECFAABEC9F077CE8D8B2EBB3C16A5CB50A8CF2FE2A90CC711313F201C3`; a later observation was `800059F148C023B24C13213F35A65C744D7716EDC2013A5B583A23569FE402F5`. Final hash/time is recorded in safety evidence. The independent writer is unobserved; guarded tests cannot write that path. No workspace state was restored and zero total vault changes is not claimed.

Real native pointer/generation/lock/receipt/quarantine/migration storage artifacts created in the vault: **zero**. New source/evidence/report/backup files are not live task storage. No real task occurrence, completion, History, Oath or Strict operation runs. No native authority, real migration, production writer/UI change, Git reset/clean/rebase/commit, installed bundle, Obsidian reload/restart or plugin toggle occurred.

If reversal is later requested, compare final hashes and later edits, then remove only the fifteen new outputs if safe. Preserve the archive and all prior/user work. Never restore an entire vault, old plugin/task/History/Oath data, prior Markdown or independently changed workspace.

## Readiness verdict

Gate A's approved preserve/quarantine safety and reproducible configured evidence are complete. **Gate B is partially ready for design review, not authorized or ready for a full equivalence-claiming native generator.** D10 identities, one-successor/recompletion, rule/reference/clock/Step template/reset and schema/reservation/receipt policies need explicit approval. Bounded/end-rule and timed recurrence gaps justify a narrower Gate B0 evidence/specification stage first. N1-E History import/current bindings, N1-F Oath/portability, N2 host/registry and N3 production orchestration remain deferred.

The [Gate B handoff](../services/TASK-SERVICE-PHASE-N1-D-B.md) identifies exact evidence, policy alternatives, atomic generation/retry/rollback tests and review gates. No engine is guessed to accelerate activation. **STOP FOR USER REVIEW AFTER N1-D GATE A.**
