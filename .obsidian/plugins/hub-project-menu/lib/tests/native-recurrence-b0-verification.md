# N1-D Gate B0 completion and verification

2026-10-17. **Gate B0 evidence/specification complete; STOP FOR USER REVIEW. D10 remains unapproved for implementation.** No native recurrence engine, recurrence schema/declarations, series/template persistence, generation command or production activation was added.

Primary review: [26-decision D10 sheet](../services/TASK-SERVICE-D10-DECISIONS.md), [proposed contracts](../services/TASK-SERVICE-D10-CONTRACTS.md), [next implementation handoff](../services/TASK-SERVICE-PHASE-N1-D-B-IMPLEMENTATION.md), [executed evidence](native-recurrence-b0-evidence.md). The decision sheet is the approval document. Specification test success is not approval or runtime parity.

## Scope and authoritative review

Gate A's handoff/report/evidence/proposal, temporal README/harness/frozen observations, N1-A vectors/spec/decision sheet, N1-B identity planning, N1-C Step/content contracts, N0 read/privacy reports and actual core validators/commands/receipts/JSON recovery were inspected. Applicable `Projects/Itacan/Meta/AGENTS.md` contains only TODO. Existing production routing/writers and installed Tasks recurrence branches were reviewed. Current function names and evidence levels are recorded in the focused evidence report. Existing source, frozen fixtures, plans, assertions and previous reports were not edited.

D07 remains preserve/quarantine for reversed same-day times; D08 retains local dates, explicit midnight versus null time, unknown timestamps and Necessity; D09 keeps legacy recurrence migration blocked. D10 recommendations made here authorize no implementation. The next handoff recommends B1 transaction/template foundation followed by separately approved B2 minimal inactive generation, each ending at review.

## Fresh safety baseline and archive verification

Baseline captured **1,170 existing files**, **339 Markdown files**, **60 existing core/identity/temporal files**, **418 preexisting Git status entries**. Existing edit allowlist is empty. All thirteen output paths were absent before creation; zero original-file backups were required. Full Git status/file hashes and gap inventory are in archived `evidence/baseline.json`. No preexisting modified/untracked work was discarded, restored or committed.

Before source creation, six native-foundation/audit archive manifests were verified (578 files) and 71 reviewed native-phase outputs matched current source, including all fifteen Gate A outputs. Gate A frozen observations and N1-A's 147 vectors were checked. The broader older Phase 2B archive verification was completed **after** new B0 test/document creation; this is a preflight ordering exception, not a claim that all archives were checked before edits. No existing source was modified in between.

Final broader check covers sixteen `itacan-*` predecessor archives: ten full historical manifests (1,516 files) pass; six early Phase 2B archives lack historical full manifests. For those six, **75 original backups** match their recorded historical baseline hashes; all **1,006 current archived files** are inventoried for preservation. Their unmanifested remaining evidence cannot retrospectively be proved identical to historical bytes. Exact scope/limitations are in `evidence/earlier-archive-verification.json`. No mismatch was found in verifiable evidence. Prior native reviewed outputs/frozen evidence remain exact.

Prior user-data changes discussed by Gate A are preserved. The fresh data baseline is `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7`, not an older phase's snapshot. No old protected content was restored. Read-only health checks retain two inherited stale-project-card-order warnings; no repair was run.

## Installed provenance and new observations

| Artifact | Version / SHA256 |
|---|---|
| Installed Tasks | 8.4.0; `2B4F9CE24D26F1D0CB191DCA9A73477454D256E03E51D81F37FAEEE7A293AD1B` |
| Tasks manifest | `499CFA146BA9CBDD70CCFC9D16B6B6CBFB4243158D14335B2B336259E867C33F` |
| Installed Moment | 2.29.4; `ECB84D57D5A7E3EC5F115BEF667656F2B9EDE90A03020525A2AF3573EA277453` |
| Frozen Gate A evidence | `C797373FAEE445F7528FD47F5508E46165B0D92FBECA257CCB1A63336AA1D175` |
| Unchanged Gate A harness | `7D32A01DF4CF3363D0A0DB48AB44F868EBD3D46B51415A36B877A864F616DDAF` |
| Frozen N1-A vectors | `17DE517A3CCF3D8178A0647EB8F434565779491783BEA2A9EC4B5C66002D5080` |
| New B0 observations | `84B7BA46833BB6044CE936834D94E39BD0934534557CC6FEA6337AD474A319BB` |
| Separate unapproved proposal vectors | `5FA0D59A5DF34CA2D79FED90AC9FB93A720FF110F4F6AAB27C5937057759EF88` |

New evidence runs in three process zones: Europe/Stockholm, UTC, America/New_York. Each has 52 configured actual-installed cases, six actual transformation chains, four installed-plus-pure nested splices, fourteen manually supplied endpoint comparisons using the existing Gate A classifier and four current Map-host metadata/writer cases. Total 240 mixed evidence groups; no native recurrence engine is executed. The default injected clock is 1792224000000; individual clock overrides/settings/statuses/input/output are saved exactly. Real Tasks settings are hash-only, never loaded by the harness. No Obsidian startup/onload is used. Moment is read as data from the installed ASAR.

## Bounded-rule conclusions

Valid count exhaustion can produce raw RRule `null` which Tasks passes into an invalid next reference and literal Invalid date. That differs from unsupported grammar, invalid source dates, partial parsing and unexplained calculation failure. End dates are timezone-dependent in the tested installed path: “until October18” becomes Oct17 in normalized Stockholm text, unlike UTC/New York. Combined count/until drops the end bound in the tested text. Reparsed “for 2 times” successors restart the count window and continue through Oct18/19/20. No lifetime budget can be safely inferred from that loop.

Propose explicit exhausted-series state and terminal receipt when validated bounds genuinely forbid a next occurrence; no successor or silent one-off fallback. Count includes initial occurrence and committed ordinals, never event attempts; until is inclusive local anchor date. Calculation failure blocks the dependent atomic transition, and malformed/unsupported evidence stays quarantine. Bounds are deferred from initial native implementation, not stripped or approximated.

## Time/reference and DST conclusions

Actual installed reference priority is Due/Scheduled/Start; removing Scheduled changes priority to Due/Start/Scheduled. Early/late fixed rules advance stored dates, while when-done advances from completion-local day and retains endpoint offsets. Date-free rules can return an undated next line. Clock suffix strings do not establish timed metadata semantics. In four current Map-host cases raw metadata survives, but copied Hub IDs cause duplicate-ID conflict and metadata withholding by current reader; time advancement is not demonstrated.

Manual clock-pair comparisons show Stockholm/New York 23h/25h calendar days, gap zero-candidate and overlap two-candidate endpoints, distinct null time and 00:00, weekly/monthly elapsed differences and +24h wall-clock drift. These are explicit comparisons through existing classification, not a native calendar recurrence calculator. The proposal captures series zone, keeps calendar advancement separate from elapsed intervals and defers timed generation with no silent gap/overlap normalization. Unknown completion times remain null. Known overlap completion instants remain distinct even when resulting local calendar dates coincide.

## Steps, edits and recompletion

Legacy Step ownership follows the last returned parent: default ordering attaches nested Steps to completed occurrence; reversed ordering attaches them to open successor. Checked Grandchild stays checked. Zero-parent deletion splices can attach children to an unrelated previous task. These exact executions are hazards, not a template model.

Model A (no Steps) loses the checklist; B (copy current structure/state) propagates accidental edits/checks; C (copy current structure with completion reset) prevents inherited checks but still propagates incidental content/structure edits and lacks explicit template ownership. Recommend Model D: immutable versioned series template, stable template-node IDs, fresh open occurrence Step UUIDs, lossless nested content/order, null completion bindings, occurrence-only default edits and explicit future-template update. Existing B stays unchanged after future rule/template updates. Full comparison is in D10 decisions.

Legacy recompletion regenerates a successor, and line date/rule edits reanchor later transformations. Proposed native policy is at most one successor per predecessor, separate from completion attempts. Reopen A uncounts E1; genuinely recomplete A records E2 without another B or changing B. Deleted B keeps its tombstone/spent generation key and pauses frontier; deleting A preserves B and events. Non-frontier completion does not branch. Cancelling one occurrence, stopping a series, pause/deferred advance and explicit replacement are distinguished in contracts; no such commands were implemented. Oath remains committed to the exact occurrence and its Steps.

## Proposed lifecycle, transactions and recovery

Proposed versioned records cover series, immutable rule revision, occurrence/lineage, template/revision/node mapping, stable generation key, separate command receipt and generation ledger, terminal exhaustion and quarantine diagnostics. States are active, paused, exhausted, stopped, quarantined/conflicted, plus repository recovery fencing. Examples and atomic logical stages are documented only; no live schema/declaration changes were made.

Reuse current detached native transaction/event-binding/receipt mechanisms, with a later approved single-state schema extension. One commit must include current transition/event, optional successor/Steps, reservations, reciprocal lineage/frontier/lifecycle and receipts. Identical operation replay returns original IDs before stale revision checks; new completion attempt can create E2 while reusing A-to-B generation result. N1-B's separate immutable plan store needs common reservation authority/fenced coordination; two receipts do not give cross-store atomicity.

Verified-ancestor fallback can lose an acknowledged latest receipt and successor. Recommend recurrence write fence after any fallback and explicit reconciliation before generation, not blind regeneration from an old state. Separate journal/watermark alternatives require durability/atomicity proof. Offline devices may independently generate different B identities for the same key; preserve both branches/events, quarantine/pause and reconcile later under N4. Local exactly-once tests do not establish distributed uniqueness.

## Supported initial scope and exclusions

After explicit policy approval, recommend structured positive-interval DAILY/WEEKLY, unbounded, date-only, explicit Due else Start anchor, fixed-origin/ordinal scheduling, plus known-instant when-done only if approved with fixed series zone. Preserve valid local Start/Due offsets. Manual occurrence date edits do not implicitly shift future fixed schedule. One successor per completion, no catch-up batch.

Exclude bounds pending ledger/proof work, monthly/yearly pending original-anchor policy, timed/elapsed, advanced/permissive grammar, date-free/scheduled-only, legacy recurrence adoption, implicit template import, replacement/regeneration UX and distributed synchronization. N1-E owns historical event/current-binding import; N1-F owns native Oath adoption; N3 real host/activation; N4 Git transport/conflicts. Existing quarantine remains mandatory even if fresh-native generation is later approved.

## Test results

All acceptance runs use explicit file lists, existing VS Code Electron-as-Node 24.21.0, no package install, and OS-Temp-only mutation guard. Exact lists are in archived `evidence/verification-run.json`; full outputs/errors are retained. No assertions in prior suites or frozen vectors were weakened.

| Newly executed suite | Passing result |
|---|---:|
| B0 actual evidence reproduction/interpretation | 15 tests |
| B0 proposal document/reference consistency | 7 tests; 32 unapproved static scenarios |
| N1-D Gate A | 145 tests |
| N1-C Step/content | 180 tests |
| N1-B identity/recovery | 158 tests |
| N1-A compatibility | 158 tests |
| N0 read/readiness | 51 tests |
| Native core | 66 tests |
| Legacy focused | 452 tests |
| Existing regressions | 34 explicit files pass |
| Safe Strict/recovery | 48 tests |
| TypeScript declarations | 5 checks; 0 diagnostics each, TS6.0.3 |

An initial proposal-format test used an arbitrary string-length threshold that rejected a valid concise “Unchanged” effect. The new document validator was corrected to require explicit nonempty strings; the full guarded B0 run then passed all 22 checks. Older tests were untouched. An initial evidence-only run used synthetic isolation without the extra filesystem guard; final acceptance and three-zone reproduction ran guarded. A copied health helper's fixed Temp output filename was corrected for distinct final snapshots; full health and protected-file comparison passed. Initial diagnostics/logs are retained. No real-vault repair or test-data writes were performed.

All thirteen new files pass a direct trailing-whitespace check. A broader `git diff --check` over the preexisting plugin/core work reports inherited whitespace/line-ending issues in unchanged original files; its full diagnostic log is archived. Baseline hashes prove those files were unchanged by B0. This unrelated preexisting diff was not reformatted or repaired.

No new generator fault/process-crash tests exist because no generator exists. Existing crash suites were rerun as regressions only. No new browser runs: production assets/factories are identical, and no UI change was authorized. Prior browser results are not counted as executions here; unrelated divider and History heading-icon failures remain out of scope.

## Exact new file inventory

Existing files modified: **0**. New files: **13**, all from the captured allowlist. Plugin-relative `lib/...` paths below resolve under `.obsidian/plugins/hub-project-menu/`.

| New path | Purpose |
|---|---|
| `ItacanTaskCore/temporal/b0/harness.cjs` | Actual installed implementation inspection in isolated host |
| `ItacanTaskCore/temporal/b0/cases.cjs` | Exact synthetic input/settings/clocks |
| `ItacanTaskCore/temporal/b0/zone-worker.cjs` | Three-zone capture without real startup |
| `ItacanTaskCore/temporal/b0/evidence.json` | Separate frozen observed outputs |
| `ItacanTaskCore/temporal/b0/specification-vectors.json` | 32 static unapproved native proposals |
| `ItacanTaskCore/temporal/b0/evidence.test.cjs` | Reproduce observations and distinguish causes |
| `ItacanTaskCore/temporal/b0/specification.test.cjs` | Document consistency/reference checks only |
| `ItacanTaskCore/temporal/b0/README.md` | Evidence levels/isolation/reproduction |
| `lib/tests/native-recurrence-b0-verification.md` | This completion report |
| `lib/tests/native-recurrence-b0-evidence.md` | Focused source-grounded findings |
| `lib/services/TASK-SERVICE-D10-DECISIONS.md` | Product decisions and approval boundary |
| `lib/services/TASK-SERVICE-D10-CONTRACTS.md` | Unimplemented record/atomicity contracts/examples |
| `lib/services/TASK-SERVICE-PHASE-N1-D-B-IMPLEMENTATION.md` | Precise subdivided future scope and test gates |

Exact SHA256 of **every** new file (including this report) is in archived `evidence/safety-final.json` → `newOutputs`, and independently verified copies under `reviewed-source/` are listed in `evidence-inventory.json`. No self-referential report checksum is invented here. All originals remain in place; original-file backup count is zero because none were edited.

## Protected-state results

Final baseline comparison verifies **1,169 non-workspace existing files unchanged**, all **339 original Markdown** and **60 original core files** unchanged. All **418** preexisting status entries remain; thirteen allowed new files give **431** final entries. Only `.obsidian/workspace.json` is excepted for separately observed independent application changes. The final safety record contains exact current workspace hash/time; no restore was attempted. Tests are prevented from writing that path by the guard; the independent writer was not instrumented.

Aggregate algorithm is SHA256 of UTF8 sorted relative path + NUL + uppercase file SHA256 + LF:

| Protected artifact/substate | Unchanged SHA256 |
|---|---|
| 339 original Markdown aggregate | `06CBD65010B0C7F296AE6DF166C70E09E3E5B4180CAC3E9FDD8E08450B14D97B` |
| 60 original core aggregate | `87C621C8E9072C256B0400A53DD88DF68B49A81149A49D8F93A48736DD43E254` |
| Plugin data.json | `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7` |
| taskMetadata | `AC081DBC5EC9CD156D341A5A2CBE397C24607EE52ADA52BEA8D8AC937E026F43` |
| completedTaskHistory | `2F61CAB4668B1264B2BA99DCED1B07FDBA05D48A3D7F41CF6D78E1FDF9889892` |
| completedTaskChecks | `8B881849D723AE28D0D7731F241AA6A850C025F16F2F396CE4B0FD842AD3C9E4` |
| oathsByDevice, including Strict whitelist state | `FCC1DB2A09E634A4A19F6A16CA1134D4E3FA3F6D2E47D8CFDA745FA585B2805A` |
| Resource definitions | `842B7832EBB45CEA89D252F1D8F01281A999CCC69EF7E3C4C17D246FD0DB4BF4` |
| Shared Project container | `5E553775898003A2111BEA1C11BAB336A3DC863941AED9C25056320BA7ECB506` |
| Shared Itacan entry | `AE4FAF769FAE6039C422778398796F4B28168D26C7C2AAF1084EBFACDB13D389` |
| Shared Obsidian Hub entry | `95B8E407357E743F791A654CF6565C7C6B16E826C3F6ECA03164B57EBD359722` |

Health remains: supported parse/schema/structure, 174 History rows, zero projected-History diagnostics, seven registered Projects, four Resources, two shared Projects, two inherited stale-order warnings. All time default/five Statistics ranges, original historical attribution and counted/reopened event semantics remain unchanged. Both Itacan/Obsidian Hub shared Projects retain ownership; Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration remain private, including through mounts.

Workspace baseline was `43B496B30EEDBD5D27C02767970E6E3E11E58B82555419EB08230D5CE0C22BC4`; an independent observation after baseline was `BF66FF79D2F198158C60E5472F2115D25EA7ECB5D7CE0FAE08AC0800D916C1C2` at modified UTC 2026-10-17T16:12:33.2855671Z. Latest captured comparison is authoritative in the archive; no zero-workspace-change claim is made.

## Source/build and production safety

Builds before/after use only explicit OS Temp output directories. All twelve staged assets are byte-identical: main has 168 factories, Atlas 24; changed/added/removed factories are all zero. Existing staged and installed bundles intentionally differ and both are preserved:

| Artifact | SHA256 |
|---|---|
| Staged source main.js | `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7` |
| Installed main.js | `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20` |
| Installed atlas-native.cjs | `1345D4895B646507D61F88D34AA221CE5AD7D4652E4E15B49BF21ED76A2D47A4` |
| Installed strict-oath-assets.json | `92B854B916604D138738CAF40D5FD5A266D5C2948A386CDFE30238DD6A614450` |

Production `plugin.js:12750` still calls `createLegacyTaskService(this)`. Existing production source is hash-identical. No recurrence command/export was added to native core, no series repository is constructed, no real native state or identity plan is consumed, and no task/Step/History/Oath writer changed. Live artifact scanning includes actual `gen-*`, `identity-gen-*`, generation files, CURRENT/RECOVERY manifests and writer/abandoned locks, excluding backups/Git; none was created. No Git transport, migration, authority activation, installed asset replacement, plugin toggle, reload or restart occurred.

## Archive and review verdict

Evidence archive: `System/Backups/itacan-n1db0-20261017-64979579/`. It contains baseline, complete request, exact reviewed new sources, frozen observations and proposal copies, all logs, explicit suite inventories, before/after staged builds, protected substate/file comparisons, predecessor archive verification and SHA256 inventory of every archived file except the manifest itself. Disposable execution directory is `C:/Users/El_Baraka 2025/AppData/Local/Temp/itacan-n1db0-a28b477623f74c4f95062bf556af9cc3`.

User decisions concern Steps/templates, initial rule subset, fixed versus when-done reference, exhaustion/calculation failure, occurrence-only edits, recompletion, deleted successor, zone/DST and recovery/reservation policy. Established owner/privacy, no-ID-reuse, Oath, Statistics and D07/D08/D09 invariants are not being reopened. Full decision IDs/alternatives/risks/deferred dependencies are in the D10 sheet.

**Gate B readiness: evidence and policy specification ready for review; initial inactive fresh-native engine is conditionally design-ready only after explicit D10 approvals and the separate B1/B2 scope. Broader recurrence, migration and production activation are not ready. Gate B0 ends here. STOP FOR USER REVIEW.**
