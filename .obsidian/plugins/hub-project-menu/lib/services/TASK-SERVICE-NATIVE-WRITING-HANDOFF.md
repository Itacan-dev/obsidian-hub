# Native task-writing implementation handoff

2026-10-17 · proposed work only · **No implementation authorized by this handoff**

Read [the consolidated audit](../tests/task-read-architecture-audit.md), [read inventory](../tests/task-read-architecture-inventory.md) and [field matrix](../tests/task-read-architecture-compatibility.md) first. Verdict: **Ready for a narrowly scoped native-writing preparation phase; not ready for an authority switch.** No verified Critical runtime defect was found. High findings H1–H7 must be resolved before their dependent phases.

## Exact next phase to authorize: N0

**Inactive backend-neutral read/readiness contract closure.**

Purpose: turn the verified legacy-shaped read assumptions into explicit, testable native variants before building a production native writer. This is the smallest useful preparation step; it does not imply storage or runtime rollout.

Implement only:

1. Discriminated native structured-query, committed-work, recorded-history and reveal/readiness contract variants. Keep legacy-only evidence explicitly legacy; never make a native task invent Markdown path/line/hidden ID or claim Dataview readiness.
2. A source-independent **synthetic** native adapter fixture covering those variants, detached values, stable parent/Step IDs, owner/location, completion/revision and lifecycle. It may use memory records; no production storage discovery/open or plugin onload.
3. Contract-level consumer translation/policy fixtures for Search, Brief, Schedule, panels, Home, Phase selection, History/Statistics and both Oath policies. These must expose unsupported native behavior honestly. Limit reusable pure conversion work to what this phase can verify; actual production consumer routing remains legacy.
4. A checked contract-gap list for later N1/N3/N5 work: full-source/search compatibility, Home presentation evidence, Step draft ancestry, date mismatch, event lineage, native saved targets and Oath reference aliases. Do not pretend a type union solves those runtime semantics.

Relevant files: `lib/services/task-service-contract.d.ts`, `task-service.js` only if needed for explicit supported operations/readiness, new pure native test adapter/fixtures, task-service contract/type/boundary tests and phase documentation. Existing production legacy consumers/writers/data stores should retain behavior. Any proposed UI/helper runtime changes beyond pure verified contract boundaries require a separate scope review.

Prerequisites already sufficient: current source/build verified; one shared facade and lifecycle established; current policy/identity/source matrix and frozen-original fixtures exist; native record shapes inspected. Re-establish hashes/status before editing because this is a dirty working tree.

Before any later implementation, review audit safety exception U3: plugin data.json and app-managed workspace.json changed concurrently, after audit tests/probes ended. No originating process or exact private-field delta was established, and no state was restored. Identify the concurrent writer and establish a fresh protected-data baseline; do not treat the audit's failed frozen-data check as a clean baseline certificate.

Data/authority: synthetic only. Production host continues to inject one LegacyTaskAdapter. No native path configuration, files, initialization, installation or activation.

Decisions requiring review in later phases (do not choose by silent coercion): non-UUID aliases, legacy same-day time acceptance, recurrence behavior, source-block provenance/search semantics, imported completion binding/counting, cross-owner move/clear policies, authority unit and migration schedule. N0 can model explicit unresolved/unsupported states without deciding these.

Required evidence: strict declarations; actual native fixture with **no Markdown/Dataview dependency** for new read variants; legacy frozen policy parity; copied/ID-less evidence stays legacy-only; stable Step hierarchy; distinct physical/presentation/recorded/workspace attribution; missing/deleted native work and completed committed parents; no source/path fabrication; consumer close and stale result suppression; History raw scalar/duplicate fidelity and All time default unchanged; source/build boundary and no native storage. Test that a partially capable adapter cannot be mistaken for an end-to-end native backend.

Recovery: revert only N0's exact new/edited files from fresh verified originals, preserving unrelated work; nothing to migrate or restore in user data. No live runtime authority changes.

Exit: native read contracts and synthetic policy fixtures exist and pass, legacy behavior unchanged, unresolved semantics listed, reviewable diff/report. **STOP FOR REVIEW after N0.** Do not proceed into N1 or install automatically.

## Protected behavior across every later phase

- Exactly one primary Project **or** Resource owner. No linkedProjectId feature. No Resource task copied into a mounted Project.
- Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration keep registry identity; preserve aliases deliberately.
- Both **Itacan** and **Obsidian Hub** retain Git sharing. Private Resource/project history/provenance/receipts/Oath state must never leak through a shared export.
- Native migration uses the **source note's parent folder as folder context**, not automatic permanent note association. Original note/block can remain provenance evidence.
- Titles, explicit descriptions, continuations, nested Steps/order, date-only vs explicit midnight, local calendar/DST and **Necessity** semantics retain meaning.
- Physical ownership, Home presentation, recorded historical attribution and committed Oath workspace remain separate.
- Candidate and committed Oath policies remain distinct; both legitimate enrollment awaitingIndex histories remain accepted. No fabricated recovery bridge or rejected provenance patch.
- Recorded History never reconstructed from current task state; preserve event identity/duplicates/order/raw legacy primitives and Statistics dedup/counting behavior.
- Native errors/recovery/conflicts cannot silently fall back to writable Markdown. Reader disposal cannot cancel already accepted durable writes.
- No automatic plugin reload/restart/Strict host activation; future installation/activation must be explicitly included in the authorized phase.
- Inherited divider/History icon failures remain outside task migration scope.

## Dependency order and authority rule

Recommended sequence:

`N0 contracts → N1 domain/import semantics → N2 inactive host/registry → N3 inactive native mutation orchestration → N4 both shared-Project transport → N5 migration + all-consumer/writer rehearsals → N6 reviewed authority activation → N7 retirement → N8 location UI`

N4 may develop against disposable N2/N3 repositories, but must complete before either shared Project's authority changes. N5 jointly rehearses Oath, History, readers and writers because migrating them independently creates unsafe split authority. Dependencies are semantic gates, not permission to continue automatically.

Define an explicit versioned authority manifest before any live transition, identifying store/partition/owner/schema/migration/alias ledger and enabled read/write mode. Proposed safest initial rollout unit is the complete selected owner cohort with all of its consumers and writer routes gated together; global identity, shared receipts and historical dependencies must be validated across cohorts. Review whether the first real rollout should include all owners at once to avoid hybrid complexity. No mixed mode is authorized by this audit.

A rehearsal may compare legacy and native **read-only shadow** outputs. It must not expose two writable versions of the same task. After native cutover, Markdown provenance/exports are not automatically write authority. A new arbitrary Markdown checkbox must be treated according to a reviewed explicit intake policy, not silently dual-imported.

## N1 — Domain, identity and migration-semantic gap closure

**Purpose/scope:** close H3/H4 in the inactive core and application contracts. Specify/implement reviewed UUID alias/import ledger; missing-ID and copied-ID quarantine; lossless source/provenance handling; Step draft ancestry/order; same-day time compatibility; recurrence decision; import of current completion bindings plus historical-only evidence without duplicate events. Preserve unknown timestamps as null. Native counted-event vs recorded legacy Statistics mapping must be explicit.

**Prerequisites/files:** N0; approved decisions listed above. `ItacanTaskCore/src/domain.js`, `commands.js`, `contracts.d.ts`, serialization/version handling and corresponding tests; pure task/history compatibility mappers. Version schemas/import contracts where needed; no production imports.

**Data/authority:** synthetic/disposable records only; no production authority change or Markdown cleanup.

**Writer/reader impact:** native command/draft semantics become sufficient; current legacy writers/readers unchanged. Native Step command requirements include parent task revision; all changes must preserve nested lineage and reserved IDs.

**Owner/Git impact:** one owner invariant; aliases cannot merge a Resource and Project task accidentally. Decide which identity/migration data is private and which stable collaboration identity is portable. Shared packet privacy tests for both Project identities and all four Resources.

**Oath/History impact:** persist original Oath IDs or resolve via durable alias without rewriting commitments blindly. Reopen/recomplete/clear/history-only/current completion imports must preserve event relationships; no native create that adds a second counted legacy completion.

**Failure modes:** duplicate alias assignment on rerun; canonicalization changes an existing ID; Step flattening; invented task birth/completion times; dropped continuations; recurrence silently lost; imported reopened event counted again.

**Tests:** invalid/valid legacy IDs, task/Step cross-collisions, repeated migration seed, unknown timestamp, same-day times/date-only/midnight/DST, 1,500 nested Steps, recurrence occurrence lineage if supported, duplicate raw History IDs, current/reopened/cleared/completed events, existing Oath saved snapshots; failed import candidate leaves no state/receipt.

**Recovery:** disposable fixture cleanup only; preserve failing evidence and alias-plan versions. Changes must not auto-open older repositories with incompatible new schema.

**Exit/STOP:** approved semantic decisions, versioned migration contract and lossless test vectors, core/declarations pass; no unresolved silently coerced records. **STOP FOR REVIEW.**

## N2 — Inactive production storage host, workspace/partition and location registry

**Purpose/scope:** close H5. Package core through a deliberate dependency/build boundary; implement a one-writer host/broker, explicit private repository path, authority-disabled defaults, open/close/recovery diagnostics, backup/export checks and workspace registry. Add partition registration/lifecycle capability needed for real Project/Resource creation/deletion; folder/note identity/rename/move/delete and same-owner Phase resolvers. No task-location UI.

**Prerequisites/files:** N1 schemas/references; approved storage placement and multi-window ownership strategy. Native core JSON/node-directory/partition commands; new host/registry modules, build staging/runtime dependency rules, capability/authority manifest tests. Keep portable core free of Node/UI dependencies.

**Data/authority:** disposable production-shaped directories first. Any later real inactive empty storage provisioning needs explicit separate authorization; this phase must not initialize in real vault by default or on legacy plugin load.

**Writer/reader impact:** expose native capabilities and a stable writer channel without routing existing task actions. Existing consumers remain legacy. Durable native committed notifications publish after commit; accepted commands drain on close.

**Owner/Git impact:** owner registry uses stable Project/Resource IDs, not labels/path discovery; Resources remain private. Full all-partition generation is private storage, never Project Git payload. Location rename does not transfer task owner; explicit relocation enforces destination owner.

**Oath/History impact:** host unavailable/recovery status cannot silently fulfill or abandon commitments. Recovery to an older valid generation must surface which receipt/event revisions are absent; retain evidence for later reconciliation.

**Failure modes:** two window writers; path/symlink escape; abandoned lock stolen automatically; malformed CURRENT treated as empty; incompatible schema downgrade; recover older generation without warning; receipts pruned causing duplicate retry; partial assets shipped.

**Tests:** independent processes/windows ownership, stale owner registry revision, unknown/deleted locations/Phases, private path/packaging boundary, read-only/no-init legacy startup, corrupted/missing manifest and verified ancestry, acknowledgement loss, crash at stages, Windows access/rename failure and Unicode paths, bounded growth at realistic task+Step+history+receipt counts. Define acceptance latency budgets before claiming performance readiness.

**Recovery:** restore only verified full-store backup with authority disabled; never delete unfamiliar lock/orphan evidence automatically. Explicit operator recovery plan with store/revision/receipt identification. No restoring old app workspace state.

**Exit/STOP:** inactive host/registry packaged and independently verified, no startup activation, meaningful performance/recovery report. **STOP FOR REVIEW.**

## N3 — Inactive native mutation service and cross-store orchestration

**Purpose/scope:** close H2/H7. Add durable intent envelopes for **all** mutation families, capturing operation ID, action time, expected task/store revision, physical owner, working/presentation context and canonical payload. Implement native command translation plus receipt-aware orchestration for Inbox, Phase/planning and Oath enrollment. Specify clear batch behavior and partial outcomes. Remove no legacy writer yet.

**Prerequisites/files:** N1 completion/tree/recurrence contracts; N2 broker/registry. Task-service contract/adapter/mutation modules, task-editor and plugin command boundaries behind disabled native routing, Inbox/planning/Oath orchestration test seams; core atomic batch commands if approved.

**Data/authority:** synthetic/disposable only; production continues legacy. Durable receipt belongs to operation intent across restart, not each new button retry.

**Writer/reader impact:** cover create/edit/move/task complete/reopen/delete/archive; inline task/Step add/edit/delete/complete/reorder; clear; Phase link/remove/delete; Quick Add/Inbox; cursor/arbitrary Markdown intake policy; Oath enrollment. Source mutation must never execute for a native-routed handle. Native read notifications/returned edit facts replace source overlays only in native fixtures.

**Owner/Git impact:** validate command owner and explicit relocation; mounted viewing Project cannot become owner. Preserve recorded working/presentation context separately. Sharing-triggered writes still use owner partition and revision checks.

**Oath/History impact:** atomic native completion event+binding+receipt; correlate Oath/Inbox/planning stores through durable recovery, not a false cross-file transaction guarantee. Capture fulfillment time once and retry same outcome; no repeated completion on lost acknowledgement.

**Failure modes:** create succeeds but Inbox removal fails; Phase persisted but native membership fails; task succeeds while Oath enrollment save fails; acknowledgement lost and retry uses new ID/time; multiple-note clear silently partial; stale Step command moves wrong subtree; disposed UI drops accepted write.

**Tests:** inject failure before/after each durable boundary, retry/restart/duplicate click/concurrent window, identical-vs-conflicting operation IDs, stale revisions, source-independent native actions, clear event preservation, source bypass denial, no double History/Oath outcomes, both legitimate legacy awaitingIndex histories unchanged.

**Recovery:** inspect durable operation journal + repository receipts; resume same intent or explicit compensation only when safe. Do not roll back committed native work by overwriting a newer repository generation or blindly restoring Markdown.

**Exit/STOP:** every writer route inventoried and native simulation covered; receipts, failures, attribution and notifications testable; legacy branch parity retained; production routing still disabled. **STOP FOR REVIEW.**

## N4 — Both shared Projects: trusted native partition export/import and conflicts

**Purpose/scope:** close H6. Retain pure sanitized packet format, then add trusted allowlisted Project transport and validated remote adoption/import, independent head lineage, completion-reference/event handling, Step deletion tombstones/retired IDs and explicit conflict workflow. This is collaboration infrastructure, not permission to run Git sync.

**Prerequisites/files:** N1 lineage/aliases/schema; N2 private storage; N3 receipt/command model. `ItacanTaskCore/src/serialization.js` and import command boundary, `lib/services/shared-projects.js` adapter replacement behind inactive native mode, disposable two-device harness and migration manifest.

**Data/authority:** two disposable device roots/repos representing Itacan and Obsidian Hub plus private Project and four Resources. Production Git/Markdown/shared JSON untouched; no automatic commit/pull/push.

**Writer/reader impact:** import must go through validated repository transaction, publish committed invalidation and reject stale/ambiguous authority. Readers cannot consume unvalidated remote JSON as native authority.

**Owner/Git impact:** exact stable-ID/root trust registry for **both** shared Projects. Export only matching owner partition. Never export full generation, private receipt payload/result snapshots, Resource tasks/mounts, capture/migration evidence, Oath/session records or private History. Define allowlisted user-entered shared task text as intentional shared content; test systemic exclusions separately.

**Oath/History impact:** stable parent/Step/completion identities survive round trip. Imported completion refs cannot invent or double-count local/private historical evidence; remote deletion behavior for existing commitment must be explicit unavailable/deleted, not accidental fulfillment/reassignment.

**Failure modes:** same numeric revision divergent heads; two independent heads appear as fast-forward without proof; stale packet resurrects deletion; import poisons global identities/owners; mount leaks Resource; completed remote task lacks event lineage; exporting retry receipt leaks private task snapshots.

**Tests:** two-Project round trips, disjoint/conflicting edits, concurrent reopen/complete, Step/task delete conflict, first import/head adoption, missing ancestry, forged owner/path/partition, unsupported schema, duplicate IDs across remote/private partitions, privacy sentinels for all four Resources, deterministic no-op replay, interrupted import/export.

**Recovery:** retain last verified packet/store head and conflicts; stop relevant partition writes when conflict requires review. Never choose highest revision or force reset automatically.

**Exit/STOP:** sharing feature parity for both Projects, no privacy leakage in fixture payloads, conflict/recovery plan and tests pass. **STOP FOR REVIEW.**

## N5 — Migration ledger, all-consumer/writer compatibility and disposable rehearsals

**Purpose/scope:** implement controlled migration planner/ledger and simulate complete cutover of readers, writers, History/Statistics and Oath together. Generate a dry-run inventory, hash-pinned source snapshot, owner/folder mapping, alias/event relationships, quarantine and deterministic rerun receipts. Update consumer native branches only behind inactive/test mode. No real migration.

**Prerequisites/files:** N0–N4 exit gates; all semantic decisions approved. New migration planner/ledger/diagnostics, facade native adapter, consumer translation/readiness paths identified in inventory, History/Statistics adapters, Oath committed/enrollment recovery, authority manifest and tests. Legacy bridge stays for legacy mode.

**Data/authority:** use sanitized synthetic snapshots/frozen originals/disposable vault copies with permission; no production task edits. Rehearse a complete owner-cohort/all-owner authority transaction, leaving source evidence untouched until a separate approved cleanup.

**Writer/reader impact:** all routes read/write the same selected authority. Search ranking/full text, Home attribution, panel/Brief/Schedule scopes, Phase drafts, menus/reveal/saved targets and notifications must accept source-independent tasks. Native actions use native commands; explicit legacy provenance stays navigable as provenance only. No writable dual ingestion.

**Owner/Git impact:** classify physical owner independently of Home page reference; source note's parent folder → native folder context. Resource mounts don't cause Project ownership or exports. Both shared Project snapshots/packets and private registry included in rehearsal/recovery accounting.

**Oath/History impact:** preserve historical raw scalar values/duplicates and counted native event policy; unknown/deleted sources remain representable. Map active/scheduled references by durable aliases without re-enrolling or changing Standard/Strict restrictions. Recovered arbitrary commitments get no legacy awaitingIndex bridge. Test fulfilled/pending outcome and receipt recovery across restart.

**Failure modes:** rerun duplicates tasks/events; late Markdown edit invalidates manifest; subset switched readers lose writes; crash mid-cohort; existing commitment orphaned; another device writes old authority; stale source retained as writable copy; accidental note context/Resource reassignment.

**Tests:** 100/1,000/5,000 datasets plus realistic History/receipt growth; task/Step/copy/ID-less/fence/continuation/CRLF/date/recurrence cases; modified/deleted/moved notes; existing completion checks; all consumer policy parity, delayed reads/write acknowledgement/disposal/draft focus; actual isolated browser scenarios including source-independent native tasks. Native startup with Dataview absent must work. Exercise rollback pre-activation and forward recovery after first native write. Retain inherited failing browser assertions and mark unexecuted tails.

**Recovery:** before activation, discard only identified disposable output; after simulated activation, freeze writes, inspect authority/ledger/receipts and replay/recover forward. Reverse migration only with a designed verified exporter and approval; never restore stale Markdown over newer native data.

**Exit/STOP:** reproducible migration dry run + collision/quarantine list, exact event/alias counts and hashes, complete reader/writer authority coverage, both Git Projects and Oath/History recovery rehearsed. **STOP FOR REVIEW.**

## N6 — Explicitly approved production authority activation

**Purpose/scope:** execute a concrete reviewed migration/activation plan for a specified owner cohort and release. This phase requires a new user authorization naming target, backups, rollback boundaries, shared-device coordination and activation procedure. This audit grants none.

**Prerequisites/files:** all N0–N5 gates; no unresolved Critical issues; High prerequisites for affected features closed; fresh source/data/bundle/status baseline, verified restorables, migration dry-run approval and user-controlled Oath/Strict timing. Authority manifest, migration runner, signed-off installed artifact inventory and cohort ledger.

**Data/authority:** **Yes, this is the first production authority change.** Coordinate other windows/devices and writers during a bounded snapshot/activation boundary. Include both shared Projects' sharing readiness and private Resource isolation; do not silently downgrade sharing for a pilot.

**Writer/reader impact:** atomically select validated native authority for every covered reader/writer route; deny stale legacy actions. Preserve explicit provenance access. No automatic fallback on missing native state. No opportunistic extra features.

**Owner/Git impact:** verify before/after owner/folder/task/Step/event/alias manifests and safe shared packets; commit/push/sync only if explicitly authorized in that phase.

**Oath/History impact:** stable commitments and outcomes survive, no unwanted fulfillment/re-enrollment; historical counts/cohorts unchanged except approved policy; no real Strict activation as a test. Recovery status visible before restrictions or task actions resume.

**Failure modes/tests:** live snapshot drift, migration interruption, partial manifest/asset publication, lost acknowledgement, stale device writes, post-activation corruption, missing owner/context, historical count mismatch. Preflight validates all; post-activation read-only acceptance verifies manifest/receipts, counts/owners/privacy and selected user workflows. Any material mismatch freezes relevant writes for review.

**Recovery:** before first native write, verified rollback can restore pre-activation authority if no outside drift. **After native writes, restoring old Markdown is unsafe**; preserve native state and recover forward or use explicitly approved reverse exporter with reconciliation. Retain all originals and receipts.

**Exit/STOP:** report exact changed data/artifacts, verified authority state and known limits. User controls any reload/restart included in separate authorization. **STOP FOR REVIEW.**

## N7 — Legacy read/write retirement and bounded simplification

**Purpose/scope:** after observed successful native authority, disable/remove obsolete legacy writer entry points and optional Markdown index/overlay dependencies for native cohorts. Preserve historical provenance and any deliberately retained legacy mode/ingestion path.

**Prerequisites/files:** N6 accepted plus agreed recovery retention period and verified backups. TaskData/legacy adapter/bridge, pending overlays, plugin globals/cursor/Tasks-plugin entry routes, native consumer readiness, docs and build graph.

**Data/authority:** native stays authoritative; no source/history deletion by default. Writer impact: reject retired legacy actions clearly; readers no longer depend on Dataview for native work. Owner/mount/Git semantics unchanged.

**Oath/History impact:** never delete aliases/event provenance required by saved commitments/history; ensure native startup/recovery independent of legacy source. Keep historical read adapters where facts remain legacy.

**Failure modes/tests:** indirect global/menu writer survives; removed bridge breaks old recorded source navigation; pruned receipt resurrects retry; overlay removal breaks pending acknowledged writes. Static inventory + controlled workflows/tests must cover all routes, no task scans in native-only host, privacy and event parity.

**Recovery:** restore exact code only if compatible with current native schema; never reactivate Markdown as authority just because legacy files remain. Preserve native manifest.

**Exit/STOP:** no unintended legacy authority or duplicate writer, evidence retention policy approved, tests/profile justify simplification. **STOP FOR REVIEW.**

## N8 — Task-location UI and subsequent polish

**Purpose/scope:** only after registry/native authority settles, expose approved owner/root/folder/note context interactions. Breadcrumbs, mount presentation and optional navigation are later product work, not migration prerequisites or part of this audit.

**Prerequisites/files:** N2 registry lifecycle + accepted N6/N7 authority; separate UX scope. Task forms/panels/location picker/navigation and native relocation service.

**Data/authority:** native context changes through revision/receipt-aware commands; no automatic migration from provenance note. Writers/readers use stable owner/location references; cross-owner relocation is explicit and validated, never induced by mount visibility.

**Owner/Git/Oath/History impact:** Resource remains Resource; shared Project export follows actual owner; historic owner/context untouched; active commitments/navigation restrictions honored.

**Failure modes/tests:** UI folder choice creates second owner; rename loses location; mounted Resource treated as Project; context move rewrites recorded History. Test root/unassigned/note/folder, rename/delete/mount/detach, stale revisions and Oath restrictions.

**Recovery/exit:** receipt-aware undo/explicit safe relocation; no blind source rewrites. Approved UX and tests complete. **STOP FOR REVIEW.**

## Review checklist before converting any phase into a prompt

Name the exact phase and files, fresh baseline/allowlist, authorized storage/data/installation actions, unresolved user decisions, tests and inherited failures, recovery boundary and STOP gate. Reuse the current frozen-original tests where they substantiate unchanged policy; don't accumulate browser counts instead of resolving a specific invariant. Verify hashes when reusing evidence.

The immediate request should authorize **N0 only**. All later phases remain proposals. **STOP FOR REVIEW.**

