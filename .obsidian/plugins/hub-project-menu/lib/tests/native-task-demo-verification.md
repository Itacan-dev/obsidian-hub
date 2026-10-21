# Track B ? Disposable native task experience: executed verification

Date: 2026-10-19. Track B only. Status: implemented, inactive, stopped for user review.

## Result and boundary

A working loopback browser prototype uses the actual N2 host, N3-A admission/writer,
N3-B application facade, and existing atomic `task.createRich` and `task.save`.
The private coherent editor-read checkpoint passed before browser implementation.
There are exactly five approved existing-source edits and 33 new files. The exact
lists, originals and final hashes are retained in the evidence inventory.

The existing edits are `src/snapshot-read.js`, `src/snapshot-read.d.ts`,
`src/contracts.d.ts`, `host/repository-host.js` and `host/index.d.ts` under
`ItacanTaskCore`. No repository publication, command, storage codec, domain,
completion, import, recurrence, serializer, F1/F2 or application-adapter semantics
changed. N0 DTOs and production construction remain unchanged.

Track A/C1, durable application coordination, Oath, Inbox, planning protocols,
transport, migration and production activation are not implemented. No Obsidian
startup, enforcement, installation or reload was performed.

## Editor-read checkpoint

A fixed `editor` selector runs through the existing queued authoritative
`TaskRepository.readSnapshot`. It returns one exact owner-qualified parent and its
current metadata, continuation, ordered Step bodies/hierarchy, checked-state
display, content/task/partition revisions, tree/binding guards and existing
recurrence occurrence guard. A content-less ordinary native task retains the
existing canonical empty-content semantics (content revision zero).

The host brackets the same capture with existing lease/root, registry, identity
and generation acceptance checks. The sibling editor port supplies immutable
writer-policy inventory/Phase pins and the accepted head/context stamp. It does
not reconstruct a draft from separate getters. Unknown, deleted, wrong-kind,
quarantined, foreign-owner, pending, fenced or unstable evidence fails closed.

The result contains no original source envelope, migration carrier, raw receipt,
identity ledger, unrelated History, Oath or device state. Current content is a
private editor capability, not a public packet. Existing export guards remain.

The initial checkpoint passed 28 checks and its declaration runner. Additional
real recurrence/import/mount cases bring the final editor selection to 31 checks.
No storage, command or domain expansion was needed.

## Interactive behavior

The UI provides seven synthetic physical workspaces, open/completed/all views,
Necessity/dates, Step progress, search and 100-row paging. Creation and editing
include separate description/continuation, Step bodies, four-level ancestry,
reorder/reparent, explicit subtree deletion and independent checked states.
Checkboxes modify the draft until Save. Cancel/Escape before submission writes
nothing. Whole-task deletion and list completion/reopening use existing commands.
Task navigation uses UUID and physical-workspace context without a Markdown note.

The server binds only `127.0.0.1` on an ephemeral port. APIs require an ephemeral
launch capability, exact Host/Origin checks and bounded JSON. Static routes are
allowlisted; there is no generic command/filesystem/import/export endpoint.
UTF-8 decoding preserves multibyte content across request chunks. Explicit init
creates an enabled repository only in verified empty Temp storage. Serve only
opens the exact existing profile/authority; it never initializes a missing root.
Relative, network, wrong-authority and protected roots reject.

Known commitment remains committed when refresh fails. Uncertainty blocks new
mutation and reconciles the original unchanged request through native replay.
Requests are retained in server memory only: this is not a durable intent store.
Externally retained exact requests are used in restart/interruption tests. Missing
request/receipt evidence never authorizes new identities or successor generation.
Use **Close demo** to drain accepted work and release the owned lease; the profile
is retained. The final normal server was gracefully reopened on the same profile,
without browser-test routes. Launch/reopen instructions are in `demo/README.md`.

## Executed acceptance

| Selection | Result |
|---|---:|
| Three editor files + four demo files, explicit final run | 64 / 64 |
| Targeted saved native/host/writer/application/atomic/recurrence/F2 selections | 1,207 / 1,207 |
| Existing declaration selections | 5 / 5 runners |
| New editor and demo declarations | 2 / 2 runners |
| Actual Chrome scripted UI interaction assertions | 17 / 17 |
| Real parent-termination/replay cases in the new selection | 9 / 9 |

The targeted saved selection counts were N2 127, N3-A 136, application B1 138,
atomic B2-B 220, core 66, recurrence B2 189, recurrence B1 207 and F2 124. Exact
saved arguments/order were retained; only disposable guard/evidence paths changed.
Actual existing frozen-reader tests in these selections passed unchanged. The
complete historical archive was deliberately not rerun under the user's targeted
verification instruction; this report does not relabel archived counts as new
execution. No new source-hash exclusion or historical fixture edit was introduced.

The new tests cover coherent/no-op Save round trips, stale guards, read races,
wrong owner/authority, privacy sentinels, all seven owners/eight Resource mounts,
actual recurrence/imported null-time evidence, export rejection, replay/conflict,
HTTP isolation, split UTF-8, known-commit/refresh failure, uncertainty blocking,
explicit-root admission, reconstruction and graceful release.

Chrome used a fresh Temp browser profile and actual HTTP/native storage. The 17
interaction assertions exercised creation, nested same-title Steps, independent
checks, midnight/date-only distinction, content round trip, draft-only checkboxes,
Save, completed disclosure, reopening, reorder/insertion/retirement, search and
workspace switching. Separate executed observations verified UUID route/reload,
Escape retaining the stored task, actual deletion, normal-server reopen, desktop
rendering and a 390?844 editor with document width exactly 390 (no horizontal
overflow). Desktop/mobile PNGs are retained. This is automated browser evidence,
not a claim of human usability approval.

Single small-fixture browser samples: creation editor 127 ms, rich creation
344 ms, editor open 126 ms, atomic Save 339 ms, reopening 541 ms. These are single
observations, not percentile measurements. The simple list/editor is usable at
this scale. Draft validation, conflict retention and post-submit cancellation
boundaries remain visible. Prepared recurrence actions and location/Phase editing
are deliberately unavailable in the initial interface.

## Process interruption and evidence limits

Nine new cases parent-terminate actual children for rich creation, atomic Save
including completion, and ordinary completion, each before CURRENT replacement,
after CURRENT publication, and before acknowledgement. Each awaits death,
verifies PID/host/token and exact lock bytes/hash, preserves that evidence, then
moves only the exact dead-child lock inside its disposable root. Identical
externally retained replay yields one task and the original events: two initial
parent/Step events for rich creation; one event for Save/ordinary completion.
Before publication commits once; after publication returns the original replay.

Two earlier development server restarts are retained separately and are not
counted as acceptance interruptions. The final test-mode server was closed through
the authenticated lifecycle operation and reopened normally; its owned lock was
released without removing the profile. Benchmark servers also closed gracefully.

Claims cover tested cooperative local persistence and process interruption only.
There is no claim of power-loss/cloud rollback protection, hostile-writer safety,
distributed uniqueness or atomic task/application/Oath persistence.

## Measured performance

The actual host/writer was measured at 100, 1,000 and 10,000 synthetic tasks.
The table shows median / p95 milliseconds. List used 20 samples, editor/Save/
completion 10 each, Step insertion 5; three list warmups preceded measurement.
Save/completion/Step samples include the preceding coherent editor read. Operations
run sequentially and retain normal receipts. Bulk setup uses one existing
`task.createMany`; it is not a rich-creation throughput measurement.

| Tasks | List | Editor | Save | Complete/reopen | Step insertion |
|---:|---:|---:|---:|---:|---:|
| 100 | 71 / 79 | 115 / 120 | 782 / 1042 | 1568 / 1651 | 1962 / 2238 |
| 1,000 | 380 / 402 | 353 / 375 | 1789 / 2115 | 2531 / 2747 | 2854 / 3381 |
| 10,000 | 3060 / 3486 | 2943 / 2970 | 12781 / 14857 | 13897 / 14166 | 14351 / 15313 |

Actual Chrome measurements below use 100 rendered rows, 10 filter-to-paint samples
and four completed HTTP workspace transitions. Initial-ready is one navigation
sample; RSS is the native benchmark process at its end, not browser memory.

| Tasks | Browser initial ready ms | Filter median / p95 ms | Workspace median / p95 ms | Native RSS MiB |
|---:|---:|---:|---:|---:|
| 100 | 425 | 14 / 16 | 375 / 379 | 216 |
| 1,000 | 535 | 14 / 14 | 666 / 917 | 220 |
| 10,000 | 2974 | 35 / 35 | 3552 / 3612 | 495 |

Process-cold open samples were 94 / 241 / 1,585 ms; warm reopen samples were
82 / 344 / 2,667 ms for the three populations. These are single samples and not
physical disk-cache-cold measurements. Browser JS heap samples were approximately
1.8 / 1.8 / 5.0 MB. Thirty idle animation-frame samples per population had median
6.9 ms and p95 about 7 ms on this headless display; no >50 ms long task was observed
in those browser measurement windows. That does not guarantee delivered input
latency, physical display behavior or absence of stalls elsewhere.

The 10,000-task editor/list waits (~3 seconds), Save (~13 seconds), completion and
Step insertion (~14 seconds) are substantial. Large-scale responsiveness is not
accepted for interactive adoption. Browser filtering remains comparatively quick;
the authoritative read/validation/publication path needs profiling before future
performance work. No validation or recovery rule was relaxed. Some native samples
shared machine load with regressions. Raw samples are retained; no Markdown
comparison, universal latency threshold or controlled comparative claim is made.

## Protected state and production comparisons

The fresh sequential baseline hashed 1,664 existing files and retained exact
allowlisted originals before edits. Final scanning found exactly the five approved
existing-source changes, all 33 approved new files and no unexpected new file.
No existing file was removed. No live native pointer/generation/fence/lock artifact
was found in the workspace outside backups; runtime profiles are in Temp.

Two protected files drifted during execution: `.obsidian/workspace.json` and
plugin `data.json`. Exact observed copies/hashes were preserved privately without
restoration or attribution. Plugin-data changes are confined to top-level
`hubState` and `workspaceMode`; other top-level values, including task/History,
Inbox and Oath domains, compare equal. Full protected byte identity is therefore
not claimed. No test or demo writer was directed at these files; mutable execution
used the isolation guard and verified Temp roots.

All other 1,657 baseline files compare equal, including nonallowlisted sources,
Markdown, application storage code, production startup and installed assets.
Baseline/final builds were staged only in Temp. All twelve assets are byte-identical,
with unchanged 168 main / 24 Atlas factory IDs, one Legacy Task Service construction,
and no native host/writer/demo startup dependency. Nothing was installed.

## Evidence and review

Raw commands, arguments, stdout/stderr, scalar exits, summaries, source originals,
final outputs, screenshots, benchmark samples and crash/lock records are retained
under `C:/Users/EL_BAR~1/AppData/Local/Temp/itacan-trackb-3h3yr9ui`.
`targeted-verification-runs.json`, `final-acceptance.run.json`, the two final type
records, `boundary-and-build-comparison.json` and final comparison/inventory files
are the primary indexes. A compact inventory-verified review ZIP excludes active
profiles and browser cache; raw disposable stores remain at their recorded paths.

Initial new-test failures concerned stale fixture capability/expectation and
runner evidence-directory setup; those new fixtures/runners were corrected and
passing runs retained. Initial browser capture attempts reset viewport emulation
between CDP sessions; accepted mobile capture sets/checks dimensions in one session.
A preliminary workspace benchmark observed the immediate empty loading view; the
reported final measurements await completed HTTP reads and paint. UTF-8 reporting
helper failures and the unavailable embedded computer-use sandbox are preserved
separately from passing execution evidence. Actual Chrome execution supplied the
browser evidence. No historical assertion was weakened to obtain a pass.

Review the interactive prototype and measured scaling cost before authorizing the
next gate. Track A/C1 and all later production/domain work remain separate.
**STOP FOR USER REVIEW.**
