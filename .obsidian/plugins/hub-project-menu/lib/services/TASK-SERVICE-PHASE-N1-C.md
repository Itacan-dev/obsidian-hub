# N1-C handoff — Nested Step Semantics and Lossless Task Content

2026-10-17. **Proposed next phase only. N1-C is not implemented or authorized by N1-B.** Review [N1-B verification](../tests/native-identity-plan-verification.md), [identity formats/API](../../../../../ItacanTaskCore/identity/README.md), [N1-A specification](../tests/native-migration-compatibility-spec.md) and [semantic decisions](TASK-SERVICE-N1-DECISIONS.md).

## Entry requirements and decisions needing later approval

N1-B implements only approved D01/D02/D03/D17/D18 against synthetic/disposable data. D04/D08/D14/D16 remain preserved constraints. Before N1-C, obtain explicit authorization plus concrete approval of:

1. **D05 draft/edit semantics:** explicit Step parent and sibling order; insertion/reparent/reorder rules; parent task revision; rejecting unsafe deletion by default; whether an explicit cascade deletes the entire subtree; required retained evidence versus a new full deleted-Step tombstone format. Do not silently reparent children or flatten structure.
2. **D06 content contract:** private versioned original source envelope and its retention; canonical title/explicit description versus continuations; unknown Markdown/status syntax; privacy-safe searchable projections. N1-B identity capture is not approval of a production content schema, renderer or Search implementation.
3. **Any necessary inactive core/declaration changes:** precise fields/commands/versions, backward compatibility and atomicity of edits involving structure/evidence. Existing native core already supports explicit parent/order and reparent/reorder commands; use current source rather than assuming those commands are absent.

Keep D07 dates, D09/D10 recurrence, D11–D13 completion/History import, D15 production Oath aliases and portable transport deferred. Quarantine unsupported content with original evidence rather than introducing a date/recurrence/import policy inside N1-C.

## Preserve the N1-B foundation

N1-B lives separately in `ItacanTaskCore/identity/`. It does not alter existing native task commands or enter plugin bundles/startup. It has distinct analysis, durable prepare, snapshot-specific synthetic approval and publication. Exact aliases and UUID reservations are identity evidence, not tasks. Every operation has a canonical payload and receipt; retries replay original results.

Identity plans, allocated IDs, raw captures, quarantine and receipt history are immutable evidence. Do not rewrite the 147 N1-A observations or reinterpret old N1-B receipts to fit N1-C. If new formats/decision revisions are needed, define readers/writers and unsupported-newer behavior explicitly, retaining old evidence. N1-B supports only its exact format-1 version map and approved identity decision revision; there is no implicit upgrade.

Source changes, overlapping file lineage/path and ambiguous aliases fail rather than reallocate IDs. A reviewed rebase/source reconciliation operation remains unsupported. N1-C must not bypass that guard by changing plan/snapshot/file labels. If such an operation is necessary, propose it separately with proof, review and retained old evidence before implementation.

Reservations include supplied existing/deleted/retired IDs and every durable planned/published/abandoned UUID. There is no automatic coordination between planning storage and another native task store. Consuming reservations during future migration needs a reviewed atomic boundary; N1-C must not treat task creation as proof that an identity plan was consumed safely.

## Step drafts and structure

Inspect current `lib/services/task-service-contract.d.ts`, `task-service-legacy-values`, task-planning snapshots/save helpers and `ItacanTaskCore/src/contracts.d.ts`, `domain.js`, `commands.js`. Production legacy draft fields cannot currently represent every parent/order edit. Close the inactive native contract gap without changing live forms/writers.

A proposed inactive Step draft should distinguish existing stable IDs from explicitly new Steps, parent task identity/revision, parent Step ID or null, sibling order, title/content and independent completion. Define one representation for sibling sequence, rejecting duplicate IDs/order, missing/foreign parents, self-parent/cycles and omitted required descendants. Source line positions are captured evidence, not native Step identity or final order.

Review how insertion before/between siblings, reparenting a whole subtree, moving between sibling groups and explicit reorder interact. Do not expose a patch that temporarily creates cycles/order collisions between sequential commands. Use an atomic validated edit/batch if one logical edit requires multiple changes, or reject unsupported combinations. Parent task revision must gate all structural edits; stale operations leave task/evidence/receipts unchanged.

Deletion must reject unsafe ancestor removal unless explicitly authorized cascade is present. Preserve retired Step identities and historical event snapshots. Existing native Step deletion removes Step records/subtree and retains reserved IDs/events; it does not retain full deleted-Step content tombstones. If N1-C needs undo/content recovery, define and obtain approval for retained private evidence or a new tombstone schema rather than claiming current core already provides it. Never reuse a deleted Step ID or silently reparent surviving children.

Completion remains independent: completing a Step does not complete its parent. Current live completion/event commands retain their existing behavior. Do not infer a missing completion time or import an old event while implementing structural edits. Completion migration remains N1-E.

## Lossless content and parser versions

Separate canonical single-line title, explicit Markdown description, source continuation, nested non-task lists, Steps, checkbox status, inline Tasks metadata, hidden Hub ID, Obsidian block ID, unknown syntax, whitespace/EOL and source location. These are not interchangeable strings. Explicit description must not be inferred from continuation prose.

Design a private raw-source envelope with original content/encoding assumptions, source checksum/revision, parser/evidence version, captured ranges, physical owner/privacy, parsed fields and unresolved syntax. Keep original input and any normalized projection separately. N1-B's `rawBlock` uses a detected EOL projection; its retained source content is identity evidence, not an approved D06 lossless native edit format. Mixed EOL, BOM/Unicode and exact marker/status recovery need new tests.

Parsing must cover intervening ordinary bullets, continuation paragraphs, blank lines, tabs/indent variation, nested ordered/unordered lists, fences with checkbox-like text, quoted/examples, links/embeds/tags, native block references and Tasks recurrence/date syntax. Unknown or unsafe structures remain explicit private quarantine with reason/version and original bytes/string evidence. No title-based merge, content stripping or “best” duplicate wins.

Parser upgrades must not silently change identity interpretation or overwrite old captures. Reparse into a new evidence revision and compare original meaning/ranges; unsupported-newer records fail without downgrade. A full Markdown parser, final content schema and identity recognizer may have different version/compatibility boundaries.

## Search, owner and folder context

Specify the future searchable representation before claiming parity: canonical title, explicit description, current continuations, structured metadata and retained historical provenance have different roles. Historical blocks must not reappear as live tasks. N0 title scoring and N1-B identity analysis prove no full-content Search/ranking/navigation parity. Keep production Search unchanged unless separately authorized.

Owner remains exactly one Project or Resource; no `linkedProjectId`. The source note's parent folder is folder context; the note itself remains provenance unless explicitly associated. Unresolved folders stay unresolved, not root fallback. Do not implement the N2 location registry here.

Both Itacan and Obsidian Hub retain future Git sharing. Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration remain private even when mounted into a shared Project. Private source envelopes, collision candidates, identity/quarantine/receipts, full History, Oath and device/Strict evidence must not enter public task packets. Only an explicitly reviewed canonical public content projection may be shareable within its owning eligible Project. No alias/Git transport in N1-C.

## Required tests and recovery boundaries

Use real inactive validators/commands and isolated stores with explicit synthetic fixtures. Reuse N1-A and N1-B evidence unchanged; add decision-tagged tests for:

- Nested ancestry through prose/ordinary list items; sibling insertion/order/reorder; subtree reparent; missing/foreign parents, cycles, duplicate IDs/order; same-title distinct Steps; stable parent/Step IDs and revisions.
- Independent Step completion, unknown timestamps, stale parent revisions, guarded ancestor deletion, explicit cascade, retained Step event evidence and retired-ID reuse rejection.
- LF/CRLF/mixed EOL, Unicode/BOM, tabs, blank paragraphs, multiline explicit description, continuations, fences, quotes/examples, links/embeds/tags, block IDs, hidden comments and unknown Tasks syntax.
- Round-trip/recovery evidence without flattening or silently dropping content; exact source conflict on title/line/block/note/ancestry changes; no new identity allocated to replace old planned work.
- Interrupted candidate validation, content/evidence serialization, structural publication, receipt persistence and acknowledgement; one whole committed state or prior state, never a structure/content mismatch.
- Reopen/replay, changed payload/decision/parser versions, missing/corrupt evidence/receipt and concurrent stale edits. No repair through identity reallocation or empty-state initialization.
- Both shared Project projections plus every private owner, mounted Resources and recognizable source/Oath/History/receipt sentinels. Full evidence and generations remain private.
- No production route/startup/writer/UI behavior change; no real task/Oath/History mutation, native activation, bundle installation or Obsidian reload.

Re-run explicit N1-A 158 checks, N0 51, N1-B identity/recovery suite, existing native-core 66, focused 452, 34 regression files, safe Strict 48 and relevant declaration checks. Do not count archived discovery or historical browsers as current results. Inherited divider/History heading-icon failures stay outside scope.

Before edits, verify fresh source/installed/protected-state hashes, prior archives and dirty Git status; preserve exact originals and a narrow allowlist. Keep all persistent tests under verified OS Temp. Preserve the N0 staged/installed difference. Roll back only authorized N1-C files after verifying no later edits; never restore old user data/workspace.

Stop if a content/Step decision needs lossy coercion, unapproved new storage/authority, identity retarget/reallocation, missing private evidence, unsafe partial publication, changed protected data or production runtime integration. If a broader command/schema or host is necessary, document the precise dependency and request review rather than expanding scope.

N1-C completion must report approved decisions, exact schemas/source changes, source/identity fidelity, structural fault/retry evidence, privacy, remaining date/recurrence/History/Oath gaps, full test results and protected hashes. **STOP FOR REVIEW after N1-C; do not continue to N1-D automatically.**
