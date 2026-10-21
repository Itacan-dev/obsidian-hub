# N1-D Gate A — configured recurrence evidence

2026-10-17. Synthetic evidence only. **D09 quarantine approved; D10 engine/identity implementation not approved.** [Verification](native-temporal-recurrence-verification.md), [frozen exact observations](../../../../../ItacanTaskCore/temporal/tests/gate-a-evidence.json), [harness](../../../../../ItacanTaskCore/temporal/tests/tasks-harness.cjs), [D10 proposal](native-recurrence-d10-proposal.md), [Gate B handoff](../services/TASK-SERVICE-PHASE-N1-D-B.md).

## Provenance and execution boundary

Installed Tasks manifest reports **8.4.0**. Bundle SHA-256: `2B4F9CE24D26F1D0CB191DCA9A73477454D256E03E51D81F37FAEEE7A293AD1B`; manifest SHA-256: `499CFA146BA9CBDD70CCFC9D16B6B6CBFB4243158D14335B2B336259E867C33F`. Both are read/hashed, never edited. Actual user settings are **not loaded** into this harness or printed; only their file hash is protected locally in the safety baseline.

The installed bundle is evaluated in an isolated fake-host VM, with appended accessors to existing `Cb`, task parser, status/settings/filter helpers. Existing algorithm bodies are unmodified. The executed path is `Cb → ye.fromLine → toggleWithRecurrenceInUsersOrder → handleNewStatus/recurrence.next/createNextOccurrence → toFileLineString`. The public API wrapper's `executeToggleTaskDoneCommand:(line,path)=>Cb(line,path).text` is source-inspected; no plugin instance/getter/onload is invoked.

Moment **2.29.4** is read from installed Obsidian `obsidian.asar/lib/moment.min.js`, SHA-256 `ECB84D57D5A7E3EC5F115BEF667656F2B9EDE90A03020525A2AF3573EA277453`. It is evaluated separately with the same fixed Date constructor as Tasks, avoiding a cross-realm `instanceof Date` artifact. Clock: `1792224000000` (2026-10-17 10:00 Europe/Stockholm); timezone explicitly Europe/Stockholm. No Obsidian app code/startup is executed to obtain Moment.

Synthetic defaults: emoji format, empty global filter, setDoneDate/setCancelledDate true, setCreatedDate false, recurrenceOnNextLine false, removeScheduledDateOnRecurrence false, no filename date inference. Case-specific overrides and complete relevant settings are in each JSON record. Filter singleton setters mirror the inspected `loadSettings` branch without invoking startup. One custom status fixture adds `?`/IN_PROGRESS → x. Fake Obsidian base classes cannot be constructed, and every executed case reports zero host constructions. No VM vault, process, filesystem, network, DOM or timer dependency is supplied. Outer test reads only implementation/provenance and writes guarded OS Temp evidence.

These results establish **configured implementation behavior for the specified synthetic settings and dependencies**. They do not establish the user's actual settings, plugin activation, real editor events, Dataview reassociation or full production recurrence parity. The corpus is a new Gate A artifact; N1-A's 147 frozen observations remain unchanged.

## Executed installed cases

All **39** cases below execute the installed implementation and are reproduced by current tests. A match to an undesirable output is an observation pass, not an approval of its semantics or importability. Full exact input/output/settings/provenance/parsed IDs are in the JSON; the table abbreviates calendar dates.

| Case ID | Executed observation |
|---|---|
| daily | Due 2026-10-17 → next 2026-10-18, followed by completed original |
| weekly | Next 2026-10-24 |
| monthly-month-end | Jan 31 → Feb 28, 2026 |
| yearly-leap-day | Feb 29, 2024 → Feb 28, 2025 |
| explicit-interval | Every 3 days → Oct 20 |
| when-done | Old Jan 1 due → Oct 18 using controlled completion day |
| end-condition | ISO-date `until 2026-10-18` is not parsed as recurrence; one completed line retains raw text |
| no-next | ISO-date `until 2026-10-17` likewise unparsed; no native end-rule equivalence proved |
| end-count-two | Parsed bounded rule; next Oct 18 |
| end-count-one | Parsed rule but next line has literal `📅 Invalid date` |
| end-word-date | Input `until October 18, 2026` serializes `until October 17, 2026`, with `Invalid date` next output |
| unsupported-punctuation | `every ???` stays raw/unparsed; one completed line |
| missed-fixed | Jan 1 fixed daily rule advances to Jan 2, not automatically to the current day |
| different-start-due | Weekly Start/Due offsets advance together; see exact date fields |
| scheduled-start-due | Start/Scheduled/Due offsets retained across weekly advancement |
| year-boundary | Dec 31, 2026 → Jan 1, 2027 |
| spring-dst | Mar 28 → Mar 29 calendar date |
| autumn-dst | Oct 24 → Oct 25 calendar date |
| explicit-time-as-text | `09:00` remains description text; not parsed native timed recurrence |
| midnight-as-text | `00:00` remains description text; not proof of endpoint midnight recurrence |
| completed-reopen | Completed → open returns one line and removes done date; no next generation |
| cancelled | Default cancelled marker toggles open; one line, no next generation |
| in-progress | Default in-progress → completed generates next plus completed original |
| delete-completed | `🏁 delete` removes completed original, retaining next only |
| delete-no-next | Unparsed ISO end text plus delete action returns zero lines |
| next-on-following-line | Synthetic recurrenceOnNextLine=true reverses order: completed first, next last |
| no-done-date | setDoneDate=false keeps completed line without new done date |
| created-date | setCreatedDate=true adds controlled current creation date to next occurrence |
| remove-scheduled | Configured next occurrence scheduled-date removal exercised |
| own-identities | Next clears Tasks ID/dependencies/block link but **copies hidden canonical-looking Hub UUID** |
| unknown-syntax | Links/tags/unknown inline field/comment remain visible in actual serialized output |
| unsupported-rule | `every frobnication` permissively parses as `every week on Friday`; next Oct 23 |
| empty-rule | Bare recurrence marker stays unparsed; one completed line |
| no-recurrence | Normal due task completes as one line, no next occurrence |
| global-filter-ineligible | Nonmatching #task filter excludes Tasks parse; checkbox fallback returns one checked line retaining recurrence text |
| dataview-format | Configured `[repeat:: every day] [due:: ...]` returns next/completed dataview lines |
| changed-rule | Explicit two-week rule advances to Oct 31; no persistent rule-revision model implied |
| daily-no-date | Date-free rule executes under fixed current reference; exact serialized output retained |
| custom-status-cycle | Synthetic ?/IN_PROGRESS → completed generates next/open plus completed original |

The `until`/count findings are real outputs of this hash-pinned implementation/dependency/zone setup. Root cause across all configurations is **not** proved, and no production plugin bug fix or interpretation change is attempted. In particular, Gate B must not convert a bounded-rule `Invalid date` into null/ordinary task or claim it as a valid native successor.

## Transitions, identity and Step evidence

Three additional actual status executions follow a chosen completed occurrence through complete → reopen → recomplete. Completion generates two lines; reopen returns one open line without done date; recompletion generates two again. Pure Tasks receives no durable generation receipt. Repeating pure input deterministically returns the same text, which is not an exactly-once storage guarantee.

The identity fixture includes a canonical-looking Hub UUID, Tasks `🆔 tasks1`, dependency `⛔ dep1` and `^block1`. Completed original retains all; next clears Tasks ID/dependencies/block link but keeps the **same Hub UUID** as description/comment content. Tasks does not allocate a new Itacan/native identity. A future identity migration must reject that duplicate rather than reuse a reserved UUID or infer lineage by title/date. Existing N1-B collision/quarantine rules remain intact.

Two full-block fixtures combine actual installed output with current pure Itacan `editTaskContent`, `readTaskSnapshot` and range rules. Only the parent line is passed to Tasks. Existing child/grandchild lines remain untouched. They attach by indentation to the **last returned parent**: completed original with default order, new open occurrence when recurrenceOnNextLine=true. The checked grandchild remains checked; no new Step IDs or completion reset occurs. Both returned parents share the original Hub ID, so unique-ID actions reject. Positional snapshots are diagnostic only. This establishes pure splice/range behavior under both settings, not a correct native Step-copy policy or full Dataview runtime result.

## Actual Itacan writer/failure evidence in a Map host

Six fixtures execute current Itacan mutation methods compiled without onload, injecting the actual installed-function callback where applicable. Notes/metadata/History are Maps/arrays only; no real file/event/Oath is changed. Recorded event IDs are normalized to synthetic labels for reproducibility, while values/transitions are retained.

| Mode | Observed effect |
|---|---|
| complete | Parent splice produces next/completed lines; one synthetic History row; stale retry rejects copied identity |
| api-failure | API exception propagates before source/History change; repeating fails again |
| fallback | Missing Tasks API uses existing checkbox fallback: one checked line retains recurrence text; one synthetic History row |
| source-write-failure | Source write rejects; source/History remain previous state; repeating fails again |
| lost-source-ack | Source Map has changed but writer throws before History; zero History rows; retry rejects duplicated Hub identity |
| history-save-failure | Source changes; History persistence failure follows existing notice/recovery behavior, with zero retained History rows in this fixture |

These experiments reproduce the source/History split and retry hazard. They do not establish durable plugin recurrence idempotency, reliable latest-operation recovery, or safe current-binding import. That work remains N1-E/N3; no double-counting repair or new event-import policy is supplied here.

## Evidence hierarchy and remaining gaps

| Subject | Level | Limit |
|---|---|---|
| 39 supplied settings/input cases, three transitions | Executed configured installed logic | Exact harness/library/clock/zone only; bad outputs remain bad |
| Two nested blocks | Executed configured logic + current pure splice/parser | Real index/UI refresh, eligibility and metadata reassociation unverified |
| Six mutation/failure cases | Executed current Map-host writer; actual Tasks callback or explicit fallback | Memory-only persistence; no OS/process interruption durability claim |
| Public API wrapper, loadSettings/filter branch, rule/status/delete/next-ID branches | Source-inspected and relevant functions exercised | Plugin getter/onload and actual user configuration not invoked |
| N1-A four transport vectors | Controlled callback only, preserved | Not upgraded retrospectively to configured Tasks evidence |
| Native timed recurrence with date-only/midnight/DST clock policy | Unverified/unsupported | Time-like text in description does not prove endpoint behavior |
| Exhausted bounded rules and configured end-date semantics | Observed problematic examples; broader semantics unresolved | Need focused evidence/policy; no guessed repair |
| Rule change between stored occurrences; explicit series identity; Step templates | Proposed, not implemented | Tasks one-line transforms provide no native series/receipt policy |
| Multi-device lineage/portable receipts/merge, power loss, OneDrive | Unverified | No transport/distributed host implemented |
| Historical binding import and live Oath occurrence resolution | Deferred | N1-E/N1-F/N3 gates remain |

All recurring tasks remain D09 blocked from automatic native import even when a parser recognizes a rule. Existing legacy tasks stay visible/active and unmodified. Gate A is complete as evidence/classification; **Gate B is only partially ready for design review and requires explicit D10 decisions plus narrower evidence completion before an engine can safely claim equivalence. STOP FOR USER REVIEW.**
