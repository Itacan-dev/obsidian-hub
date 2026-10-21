# N1-D Gate B0 recurrence evidence

2026-10-17. **Observed legacy behavior and proposed native policy are separate. D10 remains unapproved.** No native recurrence calculator, series store or template engine exists as a result of this phase. Gate A and N1-A frozen evidence remain byte-identical.

## Provenance and evidence levels

The actual installed Tasks **8.4.0** bundle SHA256 is `2B4F9CE24D26F1D0CB191DCA9A73477454D256E03E51D81F37FAEEE7A293AD1B`; manifest `499CFA146BA9CBDD70CCFC9D16B6B6CBFB4243158D14335B2B336259E867C33F`. Actual installed Moment **2.29.4** is read from Obsidian's ASAR as data, SHA256 `ECB84D57D5A7E3EC5F115BEF667656F2B9EDE90A03020525A2AF3573EA277453`. No Obsidian startup, plugin construction/onload, real Tasks settings or vault access is used by that VM. Real Tasks settings are hashed only in the protected inventory.

New frozen observations: `ItacanTaskCore/temporal/b0/evidence.json`, SHA256 `84B7BA46833BB6044CE936834D94E39BD0934534557CC6FEA6337AD474A319BB`. Each of Europe/Stockholm, UTC and America/New_York is a separate child process with an asserted effective timezone. Cases carry exact synthetic input, configured settings/statuses, injected clock, parser witness, raw RRule options/query/result and installed transformation output. Default clock `1792224000000`; explicit overlap/midnight cases override it. Original/effective RRule options are captured before the installed monthly/yearly helper can mutate `origOptions.dtstart`.

| Evidence level | Per zone | Total | What actually executes |
|---|---:|---:|---|
| Configured installed Tasks single transformations | 52 | 156 | Actual parser and Cb callback path; raw bundled RRule inspection alongside it. |
| Installed transformation chains | 6 | 18 | Successor reparsing, rule/date edits, reopen/recomplete. |
| Installed Tasks plus pure Itacan nested splices/readback | 4 | 12 | Returned lines through current `editTaskContent` and positional `readTaskSnapshot`. |
| Manually supplied endpoint comparisons | 14 | 42 | Existing Gate A temporal classifier/Intl candidate resolution; **no recurrence generation**. |
| Map-host metadata/writer cases | 4 | 12 | Current Itacan toggle callback/writer/readPages, synthetic source/metadata only. |

The 240 mixed groups are not 240 native runtime tests. Fifteen new evidence tests reproduce/inspect them; seven additional tests check the separate 32-case proposal document and references. The proposal checks do not prove an implemented native model. Ordinary earlier process-crash regressions are rerun unchanged; no new generator/process-crash/durability claim is made.

`b0/harness.cjs` compiles the unchanged Gate A test-harness source with an extra return accessor in memory, using its original filename for dependencies. Only the host accessor changes; no installed algorithm is rewritten. Gate A harness SHA256 remains `7D32A01DF4CF3363D0A0DB48AB44F868EBD3D46B51415A36B877A864F616DDAF`. Tasks and Moment VMs share the injected Date constructor to preserve real cross-realm `instanceof` assumptions. Synthetic `it(settings)` and filter singleton `Re.getInstance().set(...)` mirror actual settings application; custom statuses use actual status-registry types. The final acceptance runs preload the OS-Temp-only mutation guard; an initial evidence-only run used the same synthetic VM/Map isolation without that additional preload. Full exact settings are in each saved input; the harness never borrows a real user's data.json settings. Protected-state comparisons found no test-caused vault changes.

## Source path grounding

Installed `.obsidian/plugins/obsidian-tasks-plugin/main.js` executes `Cb` → `ye.fromLine` → `toggleWithRecurrenceInUsersOrder` → `handleNewStatus` / `recurrence.next` / `createNextOccurrence` → `toFileLineString`. The plugin API's `executeToggleTaskDoneCommand` delegates to Cb; no real plugin instance is needed. Installed recurrence `ki.fromText` extracts permissive text and uses bundled RRule `parseText`. `nextReferenceDateFromOriginal` uses fixed reference end-of-day with UTC-preserved wall clock; `nextAfter` calls `window.moment.utc(rrule.after(...))` without guarding null. `fromOneDayEarlier` implements monthly/yearly clamp and can mutate original dtstart. `addTimezone` uses UTC noon/local-day conversion. `occurrence.nextOccurrenceDate` preserves calendar-day offsets using rounded day duration.

Current Itacan sources under `lib/`: `task-data.js` / `HubTaskData.readPages` withhold per-ID metadata on duplicate Hub IDs; the `tasks` edit/read helpers splice returned parent lines into existing source and read nesting by position. Current native `ItacanTaskCore/src/domain.js` validates endpoints/timestamps, `commands.js` / `applyCommand` manage task/Step transitions and event bindings, `repository.js` / `execute` manage detached drafts and command replay, `json-repository.js` can recover a verified ancestor. N1-B identity planning remains a separate store. These current mechanisms inform proposals but do not already implement series or template records.

## Count/end results: null is not one generic failure

All following are exact configured installed observations, with full source preserved in the JSON:

| Case | Actual parser/library result | Actual Tasks result | Interpretation |
|---|---|---|---|
| BOUND-count-1: every day for 1 time, due Oct17 | Accepted count=1, dtstart Oct17; raw RRule after Oct17 cutoff is null. | nextReference invalid; literal Invalid date next line plus completed current line. | Valid library exhaustion propagates into a bad task date; no valid terminal series state exists. |
| BOUND-count-2 / count-5 | Accepted positive count; next raw result Oct18. | Valid Oct18 successor. | One transformation works; it does not prove a lifetime count budget. |
| BOUND-count-0 | Recurrence unparsed. | Ordinary completion transformation. | Invalid/unsupported source, not valid exhaustion. |
| BOUND-exhausted-count-probe | Explicit raw library query Oct20 with count2 returns null. | Tasks' own current-reference query still gives Oct18. | Direct exhaustion probe is deliberately labelled; it does not override Tasks' reference. |
| BOUND-until-before / until-equal | Accepted past/current end bound; raw next=null. | Invalid nextReference / Invalid date. | Library exhaustion versus unsafe output. |
| BOUND-before-weekly-next | Next weekly date Oct24 would exceed Oct20 bound; raw next=null. | Invalid date. | Valid bound exclusion, not malformed grammar. |
| BOUND-until-next | Until Oct18 parsed differently by zone; see below. | Stockholm invalid, UTC/New York Oct18. | A calendar end string is not a portable canonical bound. |
| BOUND-until-after | Oct20 bound permits Oct18. | Valid successor in all three zones. | Does not settle inclusive native policy. |
| BOUND-invalid-end | “until February 30, 2026” normalizes to March1 in Stockholm, March2 in UTC/New York. | Exhausted relative to October reference, producing invalid next. | Source date invalidity precedes exhaustion analysis; never call this a valid native calendar rule. |
| BOUND-count-and-end | Parser keeps count2 but drops until from “for 2 times until October20”. | Valid Oct18 line without proving both bounds. | Partial grammar consumption; native adoption must validate whole input. |
| BOUND-iso-until | ISO until text not recognized in tested form. | No recognized recurrence. | Unsupported syntax, not proof of series exhaustion. |
| BOUND-permissive | “every frobnication” normalizes to weekly Friday. | Generates according to inferred Friday rule. | Successful permissive parse is not product intent evidence. |
| BOUND-delete-count-one | Accepted count1 exhausts as above. | Completed line removed, invalid-date next line survives. | Delete-on-completion does not cure invalid next. |
| BOUND-delete-unsupported | Unsupported ISO-until recurrence plus delete. | Zero returned parent lines. | Removal after unparsed recurrence, not a correct native end-of-series result. |

For `every day until October 18, 2026`, raw until is **Oct17 22:00Z** in Stockholm (normalized text “Oct17”), **Oct18 00:00Z** in UTC and **Oct18 04:00Z** in New York. The fixed cutoff is Oct17 end-of-day UTC-preserving-wall-clock. Stockholm therefore yields no raw next, the other two yield Oct18. Evidence does not authorize copying this timezone artifact into native policy.

`CHAIN-count-reset` reparses the returned open successor each time. With “for 2 times”, observed next due dates are Oct18, Oct19 and Oct20; each new parsed dtstart moves and count remains 2. There is no persistent series-wide ordinal/budget in these line transformations. Proposal D10-08 therefore cannot be implemented by repeatedly calling this legacy operation.

Proposed later policy (unapproved): canonical count includes first occurrence; end is inclusive local anchor date; evaluate all bounds. Proven exhaustion completes current work atomically with terminal receipt, no successor. Unexplained invalid calculation rejects the dependent transaction. Invalid grammar/source/calendar values remain preserve/quarantine, never silently one-off. Bounded rules are excluded from the recommended first engine.

## Calendar rules and support classification

`CHAIN-month-clamp` yields Jan31→Feb28→Mar28→Apr28. `CHAIN-leap-clamp` yields Feb29 2024→Feb28 2025→Feb28 2026→Feb28 2027→Feb28 2028. These are actual installed chains, not an anchored-month/day specification. Original anchor information is lost by reparsing/clamping. D10-24 needs a deliberate anchored-day clamp/skip/reanchor choice; exclude monthly/yearly initially.

| Rule family | Legacy evidence | Proposed initial native support |
|---|---|---|
| Daily/weekly, positive interval, explicit local Due/Start | Configured due/start/offset/reference cases execute. | Structured canonical, date-only, unbounded only, after approval. |
| Fixed schedule | Advances from stored reference even when early/late; no catch-up. | Immutable origin/ordinal, one successor; explicit deliberate divergence for manual date edits. |
| when done | Uses completion-local day and preserves calendar offsets. | Only with known instant and explicit captured zone; requires approval. |
| Count/end | Null exhaustion, invalid propagation, reset count, timezone/partial parse limitations. | Deferred; preserve/quarantine legacy input. |
| Monthly/yearly | Clamp/reanchor chains verified. | Deferred product choice and broader vectors. |
| Scheduled-only/date-free | Legacy scheduled/date-free behavior verified, not a canonical native anchor. | Unsupported; explicit Due/Start adoption required. |
| Timed, elapsed, complex weekdays/advanced RRule/custom status loops | Tested clock-like strings do not establish metadata-time semantics; broader grammar not fully verified. | Unsupported; no inferred support. |
| Malformed/permissive/partially parsed/unknown versions | Invalid/permissive/combined probes show materially different behavior. | Strict rejection and retained raw quarantine evidence. |

No new installed rule syntax is claimed beyond the exact probes. Positive interval constraints and structured native grammar are recommendations, not current parser parity.

## Reference-date and metadata results

Actual default date priority is Due, Scheduled, Start; synthetic `removeScheduledDateOnRecurrence:true` changes it to Due, Start, Scheduled and clears Scheduled on generation.

| Case | Reference and returned open occurrence |
|---|---|
| REF-start-only / scheduled-only / due-only weekly Oct10 | Same selected endpoint advances to Oct17. |
| REF-all-dates: Start9, Scheduled10, Due12 | Due12 anchor; next Start16, Scheduled17, Due19. |
| REF-start-scheduled-default: Start9, Scheduled12 | Scheduled12 anchor; next Start16, Scheduled19. |
| REF-start-scheduled-remove | Start9 anchor; next Start16, Scheduled null. |
| REF-early-fixed due Dec1 | Next Dec2 despite October completion. |
| REF-early-when-done | Next Oct18. |
| REF-late-fixed due Jan1 | Next Jan2 despite October completion. |
| REF-late-when-done | Next Oct18. |
| REF-weekly-when-done-offsets: Start8, Due10 | Completion Oct17; next Start22, Due24, retaining two-day offset. |
| REF-date-free-fixed / date-free-when-done | A new line can be returned, but Start/Scheduled/Due all remain null. |

The suffix “09:00” after the due token, explicit midnight suffix, ISO datetime suffix and tested Dataview datetime form do not establish timed recurrence: in those exact inputs neither recurrence nor date tokens are recognized and only a completed raw line returns. Clock text **before** the tokens remains description text while the recognized due date advances. Do not extrapolate from prose to native endpoint time.

The four actual Map-host cases use per-ID metadata: 09:00–18:00, explicit 00:00, reversed 18:00–09:00 and date-only. The metadata remains exactly unchanged after the legacy recurrence callback/writer. Before completion the reader sees metadata for the unique Hub ID. Afterwards duplicated copied IDs cause the current reader to flag `identityConflict:true` and withhold metadata for those rows, leaving null endpoints. This demonstrates both preservation of raw metadata and loss of unique projection; it is **not** evidence that native timed endpoints advance. No duplicate-ID reader or writer behavior was fixed.

## Timezones, DST and elapsed versus calendar time

Actual installed date-only calendar cases cover winter, summer, spring/autumn transitions, month/year boundaries and completion-local-day when-done. Two known Stockholm overlap completion instants, `2026-10-25T00:30Z` and `01:30Z`, both yield next local due Oct26 while remaining distinct input instants. These tests preserve completion evidence, not a guessed offset.

Separately, CLOCK-* pairs manually supply local endpoints to the existing Gate A classifier. They compare candidate instant sets and an explicit +24h projection; they do not calculate recurrence. In Stockholm, 09:00 day-to-next-day spans 23h across spring and 25h across autumn. +24h lands at 10:00/08:00 respectively. A spring weekly pair spans 167h; March1→April1 at 09:00 spans 743h. Stockholm gap 02:30 has zero candidates and overlap 02:30 has two. Explicit midnight across spring spans 23h; date-only endpoints have no invented candidate instant. New York's own March8/Nov1 gap/overlap and 09:00 transitions likewise show 0/2 candidates and 23h/25h. UTC comparisons have no DST transition for these pairs.

Observed differences support separating calendar-day/month rules from elapsed-duration intervals. The recommendation is local calendar scheduling with a fixed series zone where instant-to-local conversion is required; elapsed-hour rules are a separate deferred capability. Future timed recurrence must preserve local fields and block for review on gap/overlap, not silently shift/select an offset. Date-only and explicit midnight remain different; known generation/completion clocks are independent from endpoint precision. Device/timezone database changes need captured provenance later, not an assumption that native engine behavior has been tested here.

## Nested Steps, settings, deletion and recompletion

The four nested cases combine actual installed parent-line return order with current pure Itacan splice/readback. With next-first/completed-last, Child and checked Grandchild attach to the completed occurrence. With `recurrenceOnNextLine:true`, completed-first/next-last, they attach to the open next occurrence. Checked Grandchild remains checked in both. With delete-on-completion producing zero parent lines, those indented children attach to the preceding unrelated synthetic `Previous` task. `Following` has none. This is a source-layout hazard, not an approved inheritance policy or a native template test.

Additional configured settings cover global filter `#task`, `setDoneDate:false`, ordering, scheduled-date removal and actual custom status definitions. Custom TODO `?` transitioning to CANCELLED returns a cancelled line without successor; reopening an already cancelled recurring line returns one open line. These exact paths do not imply native pause/cancel-series policy.

`CHAIN-reopen-recomplete` completes A (producing open Oct18 B), reopens completed A and completes A again; the legacy transformation again returns an Oct18 successor. There is no durable predecessor generation key in the line operation. `CHAIN-edited-rule` changes generated Oct18 B to weekly and produces Oct25; `CHAIN-edited-due` changes B due to Nov1 and produces Nov2. These are occurrence-line reparse observations, not a versioned future-rule editing contract.

Deleting a generated successor and then retrying an immutable native receipt cannot be executed against a nonexistent native engine. The executed deletion evidence is Tasks' delete-on-completion line return/splice, not persistent successor tombstone behavior. Proposed successor deletion/retry, predecessor deletion, non-frontier completion, explicit template revisions and distributed conflicts appear only in the separately marked unapproved vectors/contracts.

Recommendation: explicit versioned Step template (Model D), fresh open nested Steps per occurrence, occurrence-only edits by default, explicit future-template promotion, unchanged already generated B. At most one successor per predecessor; recompletion can create a new event without another task. Deleted B stays deleted; its spent key/IDs persist and frontier pauses pending explicit action. These are new product policies requiring approval, never inferred from line ordering.

## Architectural consequences and limits

Existing core completion events/current bindings and operation receipts are reusable mechanisms, not a recurrence schema. Generation entry must be separate from completion attempt receipt so E2 does not reuse E1 or generate another B. A single commit must cover event/binding, optional task/Step tree, reservations, lineage/frontier/lifecycle and receipt. N1-B reservation plans remain separate; a common fenced authority is required before cross-store adoption. Two receipts do not establish atomic coordination.

Current JSON verified-ancestor recovery may lose an acknowledged latest receipt/successor while an independent B survives elsewhere. Recommend fail-closed recurrence writes after fallback and explicit reconciliation before clearing a recovery fence. An independent journal or watermark needs its own atomicity/loss proof; local replay tests cannot establish distributed uniqueness. Preserve conflicting offline successors/events for review; N4 transport is not implemented. N1-E historical event/current-binding import, N1-F Oath adoption and N3 host activation remain deferred.

Both shared Projects (Itacan and Obsidian Hub) and all private Resources retain their existing boundaries. Private mounted work never exports identity/History/Oath/receipt evidence through a Project. Oath targets one occurrence and its Steps. Statistics counts its existing event inputs, not templates/new tasks/receipts; All time default and five ranges remain unchanged. D07/D08/D09 are preserved; no recurrence source, production writer or parser was changed.
