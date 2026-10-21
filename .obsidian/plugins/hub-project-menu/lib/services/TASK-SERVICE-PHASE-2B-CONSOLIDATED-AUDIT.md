# Phase 2B — Consolidated Read-Architecture Audit handoff

Proposed next review only. Do not perform this audit, activate native storage or
migrate task writers under Phase 2B-2F-2. The proposed next stage, requiring separate
authorization, is an architecture audit followed by a native-writing integration plan.

## Current completed consumers to inspect together

- Search display/reveal and Daily Brief live task inputs/saved target validation.
- Project Schedule indexed structured reads and source-validated actions.
- Project/Resource Tasks panels and Roadmap Phase-editor task selection.
- Home Tasks global presentation/physical-owner evidence and local reconciliation.
- Home/Project/Resource recorded task/Step History and Statistics completion inputs.
- Oath setup indexed oath-candidates and separate active resolveOathWork hydration.

Markdown, effective legacy metadata, Wizard History and Oath persistence remain
authoritative. ItacanTaskCore is tested but inactive in production. One explicitly
injected legacy facade/backend remains the integration boundary.

## Review questions and required evidence

1. Inventory facade construction, startup/unload order, backend subscriptions and
   all owned consumer sessions. Prove no duplicate enumeration/watchers or stale
   callbacks across multiple views/windows and plugin teardown.
2. Inventory remaining direct legacy readers. Oath tasks/workspaceTasks/setup
   validation intentionally remain for enrollment, and readNewWork intentionally
   retains immediate post-write hydration. Distinguish writer preflight from UI
   discovery and evaluate other direct readers without silently migrating them.
3. Compare parent/Step identity policies, ID-less locators, stable-ID title/path
   drift, global copied identities, source/action guarantees and ambiguity.
4. Compare physical owner, Home presentation owner, setup eligibility, active
   committed-workspace eligibility, mounted Resource navigation and sharing.
   Preserve Resource privacy and private/Itacan/Hub Git-sharing boundaries.
5. Verify recorded historical attribution stays independent from current source,
   including deleted/moved sources and historical workspace names/identities.
6. Keep Oath setup and committed policies separate. Audit corrected awaitingIndex:
   only current enrollment/readNewWork origin, both delayed-index histories,
   canonical retirement, current source/owner proof, no fabricated recovery.
7. Audit each cache, generation, invalidation, pending read and accepted writer
   bridge. Verify disposal cannot cancel accepted writes or duplicate outcomes.
8. Measure cold/invalidation/source/identity counts across consumers, including
   source batching and ordinary UI/countdown updates. The Oath reader deliberately
   caches no source across resolution batches; candidate sessions are independent.
9. Review mutation validation and effective metadata partitions before proposing
   any authority cutover. Legacy snapshots are not native revision tokens.
10. Evaluate inactive-core packaging, migration identity mapping, parent/Step
    storage semantics, location/owner semantics, durable retries, atomicity,
    history and Git-sharing prerequisites. Identify missing capabilities.

## Required next deliverable

Produce an evidence-backed consolidated audit and a precise native task-writing
and persistence integration plan for separate approval. The plan should separate
portable command/writer preconditions, inactive native adapter/persistence proof,
disposable migration rehearsals and an explicitly reviewed authority cutover with
backups/recovery. It must state prerequisites and blocking gaps before each step.
These are planning boundaries, not authorization to implement any of them now.

Use the completed phase reports and fresh current baselines. Retain all existing
assertions, the inherited divider/icon failures, real-data protections and safe
mock-host restrictions. Synthetic timings do not establish live Obsidian latency.

**STOP FOR REVIEW. The consolidated audit and native writing are not started.**
