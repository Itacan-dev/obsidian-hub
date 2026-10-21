# Phase 2A completion and executed verification

Date: 2026-10-16, Europe/Stockholm. This package is inactive.

## Implementation delivered

New files exist only under `ItacanTaskCore/`, plus one `.gitignore` allowlist line
so the isolated package is visible to Git. No installed plugin module/build file
imports this package. Source is CommonJS JavaScript with TypeScript declarations;
no application build or dependency installation is required.

Implemented: shared command/validation engine, complete memory adapter, JSON
generations adapter, reference resolvers, optimistic revisions, durable idempotency,
atomic task/Step completion history and bindings, lifecycle commands, indexed
queries, subscriptions, independent logical partitions and pure shared packet
serialization. Stable shared completion references preserve event identities
without exporting private historical/session records. No synchronization/import
writer is implemented.

## Executed checks

Tests used the existing VS Code executable in `ELECTRON_RUN_AS_NODE=1` mode,
Node 24.21.0 on Windows. No VS Code/Obsidian UI was launched by the tests.
Repository filesystem fixtures were uniquely created under Windows OS Temp,
outside the live vault, including directory names containing spaces and Unicode.

- **66 tests passed; 0 failed, skipped or cancelled.**
- The same behavioral contract runs against memory and JSON adapters.
- The final full run took approximately 4.9 seconds on this machine.
- TypeScript **6.0.3**, strict declaration/API fixture check: **0 diagnostics**.
- Standalone child-process check denies platform/UI module imports while exercising
  the portable memory repository without browser globals.
- Existing production suites/UI fixtures were not run or modified; no current
  application integration changed.

Coverage includes: task/property CRUD, missing owners, noncanonical IDs, global
task/Step collisions and retired Step IDs, invalid calendars/times/schema/fields,
Step parent/cycle/order rules, 1,500 nested Steps, explicit ownership/location/Phase
validation, stale task/store revisions, batch atomicity, archive/delete evidence,
unknown historical relationships, counted completion/reopening, detached reads,
query indexes, subscriber errors, unsubscribe/close, identical/conflicting retries,
restart receipts, and concurrent stale edits.

Partition checks exercise two eligible shared Projects plus private Project and
Resource partitions. They verify owner-based isolation, stable task/Step IDs on
pure serialization round trips, deterministic ordering, exclusion of private
provenance/history/Oath/session/receipt data, valid completion event references,
malformed metadata rejection and independent partition revision/head changes.

## Representative failure/recovery results

| Injected or simulated condition | Verified outcome |
| --- | --- |
| Before candidate commit/serialization | Original task/history/revision/receipt remain; no notification |
| During temporary write; before/after flush | Partial/unpublished evidence ignored at restart |
| Candidate checksum mismatch | Rejected before manifest publication |
| After generation publication, before manifest replacement | Orphan generation never becomes authoritative |
| CURRENT replacement EACCES/EPERM/EBUSY | Previous generation remains authoritative |
| Replacement succeeds but acknowledgment reports EIO | Exact published manifest detected; ACKNOWLEDGEMENT_LOST; one effect |
| After manifest commit, before acknowledgment | Task/history/binding/receipt all committed; replay returns existing result |
| Corrupted current generation | Recorded committed predecessor selected; recovery diagnostics exposed |
| Corrupted CURRENT manifest | Saved RECOVERY manifest used; no scan for highest generation |
| Missing immediate predecessor | Older recorded valid generation selected with explicit recovery status |
| No verified committed generation | RECOVERY_REQUIRED; evidence preserved; no new empty store |
| Unsupported newer schema with matching checksum | UNSUPPORTED_SCHEMA; no downgrade fallback |
| External manifest or writer token changes | Unsafe live write refused |
| Second local process while writer active | LOCK_HELD; no overwritten task/history state |
| Real child process exits during write/publication/commit | Abandoned lock retained; exact previous/committed state recovered after test-only verified manual unlock |
| Retention after repeated commits | Current/recovery ancestry protected; unfamiliar files untouched |

The nine pre-publication fault stages each verify exact absence of partial
completion/history/receipt state and successful safe retry. Four real child-process
exits cover temporary write, generation publication, pre-manifest replacement and
post-manifest commit. This is process-interruption evidence, not a physical power
loss test.

The first broad run found a test-fixture teardown-order error: temporary directories
were removed before closing their writer. Cleanup ordering was corrected; invariant
assertions were retained. The first declaration check found deprecated Node10
module-resolution configuration; it now uses Node16 resolution without suppressing
diagnostics. These were development harness issues, not live application failures.

## Synthetic performance baseline

Single final run, milliseconds, no performance targets or capacity guarantees.
Seeding uses one atomic `task.createMany` command, not N individual commits. Owner
queries return half the records; due queries return approximately three days of a
28-day distribution. ID lookup is the mean of 100 calls. Measurements include
validation/cloning; JSON commits include full-generation serialization and flush.

| Adapter | Tasks | Seed batch | ID lookup | Owner query | Due query | One update commit | Reopen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Memory | 100 | 10.197 | 0.006 | 6.094 | 0.125 | 7.601 | 2.719 |
| JSON | 100 | 48.316 | 0.004 | 0.244 | 0.072 | 44.162 | 6.446 |
| Memory | 1,000 | 58.087 | 0.008 | 2.933 | 0.471 | 61.566 | 24.802 |
| JSON | 1,000 | 106.409 | 0.004 | 2.697 | 0.484 | 124.208 | 32.623 |
| Memory | 10,000 | 878.982 | 0.004 | 26.246 | 5.353 | 573.372 | 269.709 |
| JSON | 10,000 | 1,222.248 | 0.005 | 34.774 | 6.590 | 1,046.076 | 424.783 |

Latest JSON generation sizes were 126,156 / 1,231,356 / 12,310,356 bytes.
Batch receipts retain original result snapshots, contributing to size. Full-state
validation, canonical clones and snapshot writes are intentionally visible costs.
Do not interpret this short synthetic workload as a long-running history/receipt
growth or collaboration benchmark. No optimization or receipt deletion was added
to make the benchmark pass.

Directory fsync returned false on this Windows fixture. File flush/replacement
and process interruption were exercised. OneDrive synchronization, physical power
loss, actual ACL denial, network filesystems and other OS/runtime versions were not
established. Error injection tests cover storage-boundary failures, not all OS causes.

## Safety evidence

A pre-edit inventory recorded hashes for **1,408 existing files**, including
tracked/untracked project work, Markdown and relevant local/shared JSON data.
The existing Git status contained **129 entries**, all preserved.

The only intentional existing-file edit is `.gitignore`: one new line,
`!/ItacanTaskCore/`. The original file was backed up before editing in the unique
OS Temp audit directory. Removing that one line reproduces the original bytes.

The baseline comparison also observed an external change to the app-managed
`.obsidian/workspace.json` during this session. No implementation/test command writes
that file; it was preserved rather than restored over current application state.
This exception is reported explicitly instead of claiming every app-managed byte
remained frozen while Obsidian was running.

Other existing source, task Markdown, shared Project data, plugin settings and
installed plugin files remain hash-identical to the baseline. No existing file was
deleted, no pre-existing Git status entry was lost, and no native store was created
inside the new package/live task dataset. No consumer was switched. No build was
installed. Obsidian was not reloaded or restarted. No commit/reset/rebase/clean was
performed. Repository test cleanup operates only on its own unique Temp paths.

## Remaining boundaries

- No Git synchronization, merge resolution or remote native import is implemented.
- Full location ancestry/lifecycle and mounted visibility belong to Phase 3.
- Partition registration/lifecycle, native packaging and sharing transport need later work.
- The UUID contract requires an explicit reviewed legacy-alias strategy during migration.
- Cross-service operations are correlated through receipts, not distributed transactions.
- Recovery can select an older verified commit and must be surfaced by a future host.
- Snapshots, history and receipts need a production retention/performance policy.

See [Phase 2B handoff](PHASE-2B.md) for the next approved scope. Stop after this
inactive foundation; compatibility integration and activation are not performed.
