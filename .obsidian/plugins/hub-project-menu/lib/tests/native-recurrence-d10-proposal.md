# D10 proposal — recurrence series, occurrences and transactional identity

2026-10-17. **Proposal only. No D10 schema, writer, generator or routing is implemented. User approval is required before Gate B.** [Configured evidence](native-recurrence-evidence.md), [Gate A verification](native-temporal-recurrence-verification.md), [Gate B handoff](../services/TASK-SERVICE-PHASE-N1-D-B.md).

## Evidence that constrains the proposal

Executed Tasks 8.4.0 logic can return next/completed/zero lines, reverse their order, clear Tasks IDs while duplicating Hub comments, and attach unchanged Steps to whichever parent is last after Itacan's splice. Recompletion of a reopened completed occurrence can generate again. Some bounded rules yield literal `Invalid date`; time-like description text is not native clock evidence. These observations justify conservative identity/quarantine constraints, not approval to reproduce every behavior as native product policy.

## Material decisions requiring approval

| Decision | Alternatives and evidence | Proposed policy for review | Risks / further evidence / approval |
|---|---|---|---|
| Series identity | Reuse first task ID; infer title/date series; allocate distinct stable series ID. Actual Tasks outputs contain no trustworthy Itacan series identity. | Distinct canonical series UUID, one physical owner and explicit membership; no title/date inference. | New schema/reservation domain and migration linkage need D10 approval. No IDs are allocated now. |
| Occurrence identity | Reuse old task UUID; fresh task UUID per occurrence. Copied Hub UUIDs collide in executed output. | Each occurrence has a distinct native Task UUID; predecessor/successor references bind explicit occurrences. | Fresh IDs must coordinate all live/retired/planned/published reservations; N1-B cannot currently atomically reserve into the task store. Approve schema/coordinator first. |
| Completion identity | Treat completion as occurrence; create distinct events. Existing native complete/reopen/recomplete already uses separate counted/reopened events. | Event UUID is distinct from series and occurrence; reopening retains occurrence/series, recompletion records a new event. | Historical current-binding import still belongs to N1-E; do not synthesize old timestamps/events. |
| Generation key / recompletion | New successor per completion attempt, or at most one generated successor per occurrence. Actual Tasks can generate again on recompletion and has no native receipt. | Unique generation key `(seriesId, predecessorOccurrenceId)`; original committed successor/result replayed across retry/recompletion. | Deliberate native policy rather than asserted Tasks parity. Approve behavior for an already generated successor after reopen, delete or rule change. |
| Rule identity/revision | Mutable rule string, or immutable rule revisions with explicit effective boundary. Current one-line changes do not model a series revision. | Stable rule identity plus immutable revision, source digest, timezone/precision and effective next-ungenerated occurrence. Generated occurrences retain their original rule revision/reference evidence. | Changing an existing successor requires separate reviewed reconciliation; no silent rewrite. End rules/partial parsing need more evidence. |
| Next-date semantics | Mirror all Tasks outputs, normalize invalid results, or support an explicit verified subset. | Only a reviewed supported subset; reject/quarantine invalid/unresolved next dates, preserve exact raw rule and reason. | Bounded/count/end-date failures and timed recurrence are blockers. Approve intended semantics after narrower evidence, not guessed date correction. |
| Generated timestamps | Use due/reference/import time as creation/completion instant, or keep separate clocks. | `createdAt` is the captured native generation operation time; start/due stay approved local calendar values/precision. Completion event time belongs to its actual transition; unknown historical times stay null. | Define timezone/DST/reference policy and retain original operation time in receipt before implementation. |
| Oath target | Follow the series/latest successor, or bind one occurrence. Copied parent IDs/step attachment would otherwise retarget work. | Existing commitment remains tied to one occurrence and its Steps; never follow successor automatically. | Production `{id,path,text}`/awaitingIndex/fulfillment remain unchanged; N1-F approval needed for future routing. |
| Sharing | Export raw recurrence evidence/receipts, or an allowlisted owning-Project canonical projection. | Future eligible Project series/rule/occurrence projection only, excluding provenance/identity plans/History/Oath/device state. | Both Projects supported independently; Resources private even when mounted. Wire format, offline conflicts and transport are unapproved. |

## Step lineage alternatives

| Model | Benefit | Cost / observed evidence |
|---|---|---|
| Keep Steps only on original occurrence | Minimal new data/identity allocation | New occurrences have no Steps; may break intended progress/Oath behavior |
| Copy current structure with fresh IDs | Stable independent per-occurrence identities and retained hierarchy | Must decide whether ad hoc edits/deletions propagate; no Tasks source proof establishes a reset policy |
| Copy current structure and reset completion | Predictable new open work; no reused completion events | Deliberate product choice; executed splice leaves checked descendants checked |
| Explicit per-series Step template, fresh occurrence copies | Clear template revision/lineage, immutable historical snapshots | Adds schema/editor/propagation decisions; existing Tasks line API has no template model |
| Reuse Step IDs across occurrences | Superficially simple | Conflicts with globally unique/retired Step identity, old History and occurrence-specific commitments; reject this alternative |

The preferred **design direction for review** is explicit per-occurrence fresh Step UUIDs preserving full ancestry/order, with lineage to a separately reviewed template/revision and new completion state open/null. This is not established Tasks parity. Evidence is insufficient to choose template creation/propagation/reset policy on the user's behalf; that material product decision remains pending. Alternatively approve original-only Steps as a deliberately reduced supported subset. Do not implement automatic copying until approved.

A template model must define stable template-node identity distinct from occurrence Step IDs; nested hierarchy, independent completion, deleted/retired Steps and original content evidence remain explainable. Historical snapshots/events never change when a template is edited. New Step copies must not inherit old bindings or counted completions. Future Statistics counts actual occurrence events, not templates; future Oath progress uses the committed occurrence's Step IDs. Portable lineage, if later approved, must retain owning-Project privacy and conflict rules.

## Required schema and transaction proposal

Proposed records, all future/versioned and **not written by Gate A**:

- Series: UUID, owner/partition, revision, active rule/revision, zone/precision policy, optional Step-template revision, lifecycle state.
- Rule revision: rule identity/version, exact supported semantics/reference policy and private original-evidence link; prior revisions retained.
- Occurrence lineage: native Task UUID, series UUID, predecessor/successor, generation key, captured rule/template revisions, reference local values and generation operation ID.
- Generation receipt: canonical payload, expected task/series/rule revisions, original stable result, captured clock and all new task/Step IDs; exact replay/conflict semantics.

Prefer these inside one reviewed native transactional state so the existing candidate/receipt/generation machinery can validate the entire operation. Do not build independent series/evidence writes and call them atomic. Backward compatibility and explicit unsupported-newer readers must be reviewed before extending schema 1.

One future generation transaction must:

1. Validate current occurrence/rule/series/owner/source and native revisions, plus the D07/D08/D09 gates.
2. Replay a committed identical operation/result before allocating; reject conflicting payload or stale revisions.
3. Apply the existing completion transition/event relationship correctly, preserving historical records/null timestamps.
4. Determine a supported next local endpoint or explicit end-of-series result; unresolved/invalid rule output blocks the whole dependent operation.
5. Reserve a fresh occurrence UUID and every required new Step UUID across all existing/retired/planned domains, under one reviewed coordination boundary.
6. Materialize approved Step hierarchy/content/template lineage without copying old completion bindings or source originals as new captures.
7. Commit current transition, event, successor, reciprocal lineage, series revision and immutable receipt in one generation.
8. On precommit failure retain the old whole state; after commit/reply loss reopen/replay the exact result once, with no second successor.

N1-B identity preparation and task storage are currently separate; static supplied reservations cannot prove atomic plan consumption. Gate B must either introduce a reviewed common transaction/reservation authority or explicitly defer cross-store import. A caller changing plan/source labels cannot bypass reservation/source conflicts. N1-C original source and prior content revisions stay immutable; generated current canonical content must be explicitly new and linked, never relabelled original Markdown evidence.

N1-E is required before importing old completion/binding/History state and resolving the reproduced double-counting hazard. N3 orchestration is required before any live writer integration. Synthetic new-native recurrence experiments could later exercise approved current completion commands without claiming historical import/production readiness, but no such engine is implemented now.

## Quarantine exit and approval checklist

Exit requires exact identity/source/owner validation; clear temporal compatibility; an approved supported rule/reference/zone/precision policy with safe configured evidence; approved series/occurrence/Step/recompletion semantics; coherent reservations/atomic receipts; required History/Oath/consumer/host gates; and demonstrated privacy. A parser UUID, a parsed rule or an observed next line alone is insufficient. Preserve unsupported raw evidence for reprocessing; do not remove the existing legacy task or turn it into one-shot native work.

Approval must select the material policies above, define scope of a verified rule subset, and accept any intentional divergence from observed Tasks behavior. Before engine implementation, complete focused evidence for exhausted/end rules, date advancement versus invalid results, and actual timed/reference semantics. If those cannot be proved safely, approve only a narrower evidence-completion stage. Cross-device exactly-once/portable lineage requires later transport/conflict review; local receipts do not prevent independent offline generation branches.

**Verdict: partially ready for design review; not ready for an authorized equivalence-claiming Gate B engine. STOP FOR USER REVIEW.**
