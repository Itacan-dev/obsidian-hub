# N1-D Gate B2 verification — minimal inactive native recurrence

2026-10-17. **B2 complete; STOP FOR USER REVIEW. Do not begin N1-E.** The standalone core now implements explicit prepared, unbounded, date-only fixed-origin DAILY/WEEKLY generation. Production TaskService remains on the Legacy Adapter. No production activation, migration, installation, plugin toggle or Obsidian reload/restart occurred.

API/format and runnable example: [RECURRENCE-GENERATION.md](../../../../../ItacanTaskCore/RECURRENCE-GENERATION.md). Next review only: [N1-E handoff](../services/TASK-SERVICE-PHASE-N1-E.md).

## Authorization and decisions

The complete B2 request was inspected in Plan mode, including its final STOP. The user selected complete task-and-Step templates and deferring rule edits after the first successor. A full eight-existing/fourteen-new-file plan was reviewed, then explicitly approved with “PLEASE IMPLEMENT THIS PLAN” in execution mode. No implementation preceded that approval. No broader recurrence policy or separate transaction authority was added.

## Foundation and safety-record disclosure

B1's 135 manifest-listed archived files and all 18 reviewed files matched during planning and were reverified during execution. Twelve predecessor archive manifests account for 1,774 verified files, including B1; six earlier archives have only the available originals/baselines and current preservation inventories, not retrospective full-manifest proof. Their limitations remain explicit in `earlier-archive-verification.json`.

A pre-edit smaller fresh inventory observed 1,195 protected paths and 443 Git entries. An earlier full hash scan was inadvertently left running beyond the tool wait and later overwrote that inventory and two original-backup copies with intermediate allowed source. This was a bookkeeping error, not a user-data repair. The raw overlapping capture is preserved as `baseline-raw-overlapping-scan.json`; the two intermediate originals remain under `overlapping-scan-originals/`.

All eight reference originals were subsequently verified/copied from B1's sealed reviewed source. The corrected baseline explicitly records that basis, the reconstructed initial 443-entry status list (removing exactly the three known agent-created paths from the later 446-entry observation), and the interval nature of the full 2,590-file capture. See `baseline-correction-disclosure.json`. Do not describe the full capture as a simultaneous pre-edit snapshot. No user file or implementation was restored/discarded. The independent frozen 14-module B1 reader agrees with B1 bytes.

## Exact changes

Eight existing files changed, all in `ItacanTaskCore/src/`:

| File | Final responsibility |
|---|---|
| `domain.js` | Schema 1/2/3 dispatch, namespace/version barrier, compatible receipts and whole-state validation |
| `json-repository.js` | Recognize manifest 3 without weakening unknown-schema recovery refusal |
| `commands.js` | Dispatch new explicit commands; share completion helper; guard ordinary prepared completion; cover schemas 2/3 identity checks |
| `recurrence.js` | Versioned templates/namespace/snapshots, immutable continuity, future boundaries, pre-generation-only rule edits |
| `repository.js` | Versioned read/readiness overloads, completion results, member completion/reopen fence before replay and commit |
| `contracts.d.ts` | Schema 3, B2 commands/results and read overloads |
| `recurrence.d.ts` | Complete content/template, calculator evidence, generation outcome and version-2 namespace types |
| `index.js` | Portable calculator and separate B2 command-catalogue exports |

Fourteen new files:

- Core: `src/recurrence-calendar.js`, `src/completion-transition.js`, `src/recurrence-generation.js`.
- Tests: `tests/recurrence-generation-support.cjs`, `tests/recurrence-calendar.test.cjs`, `tests/recurrence-generation.test.cjs`, `tests/recurrence-generation-persistence.test.cjs`, `tests/recurrence-generation-crash-worker.cjs`, `tests/recurrence-generation-types.fixture.ts`, `tests/recurrence-generation-typecheck.cjs`, `tests/fixtures/recurrence-b1-reader-v1.json`.
- Documentation: `ItacanTaskCore/RECURRENCE-GENERATION.md`, this report, `lib/services/TASK-SERVICE-PHASE-N1-E.md`.

No existing test, historical report, frozen observation or production file was changed. Verified original/source hashes and all fourteen output hashes are listed in `safety-final.json`; the archive inventory also seals the reviewed files themselves.

## Implemented contract

Explicit `recurrence.prepareGeneration` appends a version-2 complete template under the existing UUID/digest chain and commits repository/manifest schema 3, recurrence namespace 2 and exact mandatory generation capability. It creates no task/Step/event/binding. Preparation requires an open live date-only initial occurrence, no outcomes and an approved Step template, including explicit empty. Currently completed B1 initials reject reconciliation-required without historical changes. Mixed stores retain unprepared B1 definitions and their ordinary behavior.

The existing four-command B1 catalogue and zero-argument readiness contract (`generationSupported:false`) remain exact. A separate frozen version-2 catalogue advertises preparation and `recurrence.complete`. New commands use the existing execute dispatcher and require operation/task/repository, owner/partition and expected partition/series/rule/template/inventory guards. Explicit version-2 series/readiness overloads expose actual B2 definitions/frontier and eligibility blockers. The old series form rejects prepared definitions.

The pure calculator uses Gregorian integer civil days and a bounded inverse: immutable origin plus `(ordinal-1)*interval*(1 or 7)`. Due anchors when present; Start-only and captured offsets retain null endpoints and null times. Safe-integer/range/complete-pair validation precedes dependent completion. Zone is explicit evidence; no Date/elapsed/device arithmetic enters the implementation. Tests use an independent UTC oracle and actual device-timezone child runs. Invalid/unsupported/range values reject, never exhaustion or one-off fallback.

Complete future task title, description, continuation, importance, location and phase come only from the selected immutable template; administrative description is separate. Owner/partition come from the series, dates from the rule. N1-C native content holds generated continuation and Step bodies with empty originals/no fabricated import or capture provenance. Fresh UUIDs/clocks/open states/null completion bindings apply to every generated task/Step. Deep parents/order and same-title node mappings survive without flattening.

Native completion/event/current binding now has one shared helper, extracted from the existing transition. First completion publishes A/E1/current binding, B and open Steps/content, reciprocal membership, frontier/count, immutable outcome and normal operation receipt in one detached validated candidate/one commit. Allocation uses one staged reservation set over live/deleted/retired, events, recurrence identities and explicit external inventory; collisions skip or reject, and exhaustion is bounded. External inventory remains captured evidence, not a cross-store guarantee.

The stable B1 predecessor generation key excludes event/operation/device/date/revision. Version-2 outcome evidence retains original successor/Step identities and creation snapshot, rule/template digests, calculator evidence, E1, generation clock, original operation/receipt and committed revision. Current occurrence edits and Step retirement are validated separately from immutable creation evidence. Old receipt membership fields remain fixed; only the null successor can acquire its ledger-backed pointer.

Identical replay returns original identities before stale guards, subject to the fence. Changed payload conflicts; concurrent distinct completion commands publish once. New already-completed attempts reject without another event/receipt. Reopen uncounts/unbinds E1 normally while retaining B/spent key. Recompletion creates E2/current binding and reuses the original outcome, even after a future template revision; B/frontier remain unchanged. Old E1 replay is historical evidence, not a new counted completion.

Ordinary prepared parent completion rejects `RECURRENCE_COMMAND_REQUIRED`; strict update/structure patches cannot bypass it. Step completion is independent. Local task/Step/content/date/relocation/archive changes never change templates. Archived/timed frontiers block generation. Member deletion/owner transfer remain unsupported; history append remains historical-only. Rule changes reject after a successor exists. Explicit version-2 template revisions after B affect C only.

## Verification results

All mutable tests use the existing preloaded OS Temp mutation guard, synthetic stores, controlled clocks and injected UUID factories. No live native store or plugin startup was invoked. Node 24.21.0 was supplied by the existing VS Code Electron runtime; TypeScript 6.0.3 was already installed. No package installation occurred. Exact file lists, runtime/guard/compiler and logs are in `verification-run-b2.json` and `results-summary.json`.

| Newly executed checks | Passing result |
|---|---:|
| B2 calculator, generation, persistence and corruption | **189 tests** |
| Included actual B2 child interruptions | **22** |
| New B2 declaration fixture | **0 diagnostics** |
| Runnable synthetic memory example and 26-row D10/handoff coverage | Pass |

The 22 interruption tests are included in the 189, not additional tests. They cover 15 generation stages, two historical recompletions, two preparation publication barriers and three existing fence stages. Each tests actual process exit, lock refusal, dead PID, host/token and exact abandoned-lock move inside Temp. Raw lock bytes/SHA256/stage/PID/status are retained in `dead-child-lock-evidence.json` and the acceptance log before disposable-store cleanup. Exception injections are reported separately from process interruptions.

Behavioral coverage includes empty/deep same-title templates, task metadata/body/reference guards, initial checked Steps, local content/Step deletion, future template isolation, B1 coexistence, old ordinary receipt replay, E1/null timestamp/E2, stale guards, concurrent commands, calculation range rejection, complete identity-domain collisions, duplicate staged allocator outputs, operation/event separation, allocator exhaustion and retained-deletion fixtures.

Faults cover calculation, reservations, content/Steps, native event/binding, lineage, ledger, receipts, whole-candidate validation, serialization, temporary writes/flush, generation publication, pointer replacement and acknowledgement. Actual CURRENT replacement errors before and after publication verify prior-state versus committed-replay behavior. Corrupt ledger/receipts/members/definitions/reservations/null records recover only to verified ancestors and fence. Unsupported schemas/capabilities reject without fallback. The actual frozen B1 reader rejects both schema-3 manifests and generations despite schema-2 ancestry.

| Reexecuted existing suite | Passing result |
|---|---:|
| B1 foundation/invariants/persistence | 207 |
| B0 evidence/specification | 22 |
| Gate A temporal compatibility | 145 |
| N1-C Step/content | 180 |
| N1-B identity/recovery | 158 |
| N1-A compatibility | 158 |
| N0 reads/readiness | 51 |
| Native core | 66 |
| Legacy focused | 452 |
| Explicit regression files | 34 file-level passes |
| Safe Strict/recovery | 48 |
| Six existing declaration checks | 0 diagnostics each |

The final full regression run passed after source finalization. A subsequent B2-only acceptance run retained the actual lock evidence; it also passed all 189. Earlier assertions and frozen observations were not edited or recaptured. No historical browser run is counted as current.

## Recovery, privacy and limits

The existing persistent `RECURRENCE-FENCE.json` remains the only recurrence marker. Known fallback writes/verifies it before returning state; partial/invalid markers block and unknown versions reject. Prefix mutations and known-member completion/reopening check before replay and commit. Unrelated ordinary writes remain available. No clear/rename/replacement operation was added.

Tests deliberately lose an acknowledged B/receipt through ancestor fallback. Generation and replay stay fenced through ordinary local writes/restarts; absent receipt never authorizes another B. Even an unreadable CURRENT has a schema-3 RECOVERY barrier because preparation committed separately. Old B1 ordinary-recovery manifests keep their existing schema-2 behavior.

Only cooperative local persistence/process interruption with surviving evidence is claimed. No power-loss, cloud/OneDrive rollback, hostile-writer, distributed uniqueness, cross-store plan consumption or production-host guarantee is inferred.

Synthetic memory and JSON execution cover Itacan and Obsidian Hub UUIDs, a private Project and Knowledge/study, Research/literature, Explorations/references and Inspiration/inspiration. Mounted query/working context retains physical Resource ownership/history attribution. Recurrence partition export remains blocked; a separate clean public partition excludes private capture/migration sentinels. No recurrence transport or Oath routing was added.

Retained successor deletion is a static tombstone fixture followed by executed historical recompletion without resurrection. B1's version-1 future graph still has static terminal/lifecycle vocabulary. Neither establishes executable deletion, pause/resume, bounded exhaustion or replacement support.

## D10 implementation matrix

“Executed” below means current synthetic commands/calculation or rerun prior tests; “static” explicitly identifies fixture-only contracts. The historical B0 sheet remains unchanged, including its then-unapproved status. This table records the later approved subset and B2 execution, not blanket approval of broader proposals.

| Decision | B1 foundation | B2 / evidence level | Remaining boundary |
|---|---|---|---|
| D10-01 | Stable owned series UUID/revisions | Executed prepared series/frontier/count | Lifecycle vocabulary beyond active is contract only |
| D10-02 | Authored initial; future graph static | Executed fresh successor UUID/reciprocal lineage | No public deletion/transport workflow |
| D10-03 | Existing event/current binding semantics | Executed shared helper, E1/reopen/E2/null time | Historical binding/import is N1-E |
| D10-04 | Stable key and static graph | Executed one committed successor/key and replay/races | Terminal outcomes remain static/deferred |
| D10-05 | Future reuse contract only | Executed historical recompletion reuses B unchanged | No branch/replacement API |
| D10-06 | Terminal proof shape static | Executed calculation failure rolls back whole operation | Bounded valid exhaustion deferred |
| D10-07 | Strict DAILY/WEEKLY fixed definitions | Executed unbounded date-only generation | when-done/advanced grammar excluded |
| D10-08 | Count field/static terminal vocabulary | Executed committed ordinal count, no reopen refund | count/until bounds deferred |
| D10-09 | Reject timed definitions | Executed timed-current blocker; precision retained | Timed/elapsed recurrence deferred |
| D10-10 | Explicit Gregorian/IANA capture | Executed DST/calendar vectors and device-zone independence | when-done conversion/gap/overlap resolution deferred |
| D10-11 | Immutable origin/offsets | Executed ordinal schedule despite edited predecessor dates | No catch-up batch or when-done |
| D10-12 | Explicit immutable Step template | Executed complete task/Step templates, deep ancestry/body | Legacy tree adoption deferred |
| D10-13 | No checks in template; independent native Steps | Executed fresh open Steps/null time/binding; checked initial retained | No parent/child auto-completion |
| D10-14 | Full revisions/node intent/retirement | Executed complete revision preparation and future edits | No implicit recapture |
| D10-15 | Occurrence-only edit semantics | Executed local content/Steps/dates/reference changes | Future UI is N3 |
| D10-16 | Initial-only revision boundary | Executed frontier template boundary; B unchanged, C revised | Rule reanchoring after first successor deferred |
| D10-17 | Spent-key/tombstone graph static | Static retained-deletion fixture plus executed reuse without resurrection | Delete/cancel/pause/resume/stop/replacement workflows deferred |
| D10-18 | Captured inventory/native reservation checks | Executed unified staged IDs, retired/external collisions/exhaustion | No N1-B plan consumption or cross-store lease |
| D10-19 | Existing repository commit/receipt authority | Executed atomic event/binding/successor/Steps/ledger/receipt; IO/crash tests | Imported event pairing remains N1-E |
| D10-20 | Persistent fallback fence | Executed lost acknowledged B/receipt fencing/restarts/barrier | Clear/reconciliation/stronger rollback protocol deferred |
| D10-21 | Preserve occurrence-specific Oath invariants | Rerun existing Oath/Strict suites; production bytes unchanged | Native Oath/aliases/both awaitingIndex bridges are N1-F |
| D10-22 | One owner/private Resources/export restriction | Executed both shared Projects/all Resources/mount sentinels | Distributed conflict quarantine/transport is N4 |
| D10-23 | Preserve raw compatibility/quarantine evidence | Rerun frozen evidence; executed unsupported rejection | New canonical legacy adoption/reprocessing deferred |
| D10-24 | Monthly/yearly excluded | Executed strict rejection, no silent downgrade | Clamp/skip/reanchor policy unresolved/deferred |
| D10-25 | No automatic legacy Step adoption | Fresh-native only; prior N1-B/N1-C evidence rerun | Legacy migration requires reviewed identity/content/binding |
| D10-26 | Existing Statistics/events contract | Executed no phantom Step/task events; rerun Statistics/ranges/default | Historical dedup/import parity is N1-E; activation N3 |

## Protected state, build and archive

The full corrected comparison contains 2,590 interval-captured files: 2,581 non-allowlisted/non-workspace files match, all eight reference originals match verified B1, 441 original Markdown hashes match aggregate `8314B1E04D7D134F0B4684D07368F7112801505F8B3AB735342B68189F5C6892`, and all 70 non-allowlisted core files match aggregate `76689ECAD51615E620EB4C70674C7A71E2BB13B6624C372E12471462DDD6241A`. All initial 443 Git entries remain; the final expected status count is 457, adding fourteen authorized new files. `.obsidian/workspace.json` drift is recorded separately and was not restored; its external writer is not instrumented.

Plugin data SHA256 remains `7B99C74D8FBF44E7A71DB64126099FE42F3CF1DD0235C844C57ACBAA486306A7`: 174 History rows, zero History projection diagnostics, seven Projects, four Resources and two verified shared Projects. Two inherited stale-project-card-order warnings remain unchanged. History/checks, task metadata, all device Oath/Strict whitelist state, Resources, mounts/workspace mode, Daily Brief and project planning hashes match. All individual values and both shared Project hashes are in `safety-final.json` and pre/postflight health JSON.

Twelve staged production assets are byte-identical before/after. Main/Atlas remain 168/24 modules, with no factory changes. Installed main remains `318CD234980489C514E1C1085DF2D95FEBFEF64284D0293BC566493B4B28DB20`; staged source main remains intentionally different at `29635B7632218BDDA551E23358C1C393E300E8990D92D41F454741B240ADD9C7`. Installed Atlas/Strict assets, Tasks 8.4.0 bundle/manifest, Moment 2.29.4 and frozen N1-A/Gate A/B0 evidence/proposals match their baselines. Byte-identical production graph required no new browser run. Native storage artifact scan outside backups found no CURRENT/RECOVERY/fence/generation/lock artifacts.

Evidence archive: `System/Backups/itacan-n1db2-20261017-5d7ee445/`. It contains verified originals, preserved intermediate bookkeeping evidence, all twenty-two reviewed outputs/sources, raw/corrected baselines/disclosure, explicit test inventories, logs, raw dead-child locks, health/build/safety/results reports and a sealed `evidence-inventory.json`. That inventory supplies per-file SHA256; its final digest/count are also reported in the completion response. The report does not claim absent historical full-manifest proof for early archives.

## Completion boundary

B2's approved minimal generator, guards, atomic local persistence and compatibility checks are complete. No B2 capability is active in the real vault. N1-E is ready for a separately approved plan concerning historical event/current binding import and Statistics parity; its handoff is documentation only. when-done, bounds/exhaustion execution, monthly/yearly, timed recurrence, catch-up, deletion/cancellation/replacement/reanchoring, legacy adoption, Oath integration, hosting and shared transport remain deferred.

**STOP FOR USER REVIEW AFTER B2. DO NOT BEGIN N1-E.**

## Exact reviewed source hashes

Originals below are verified B1 references; see the explicit capture correction above. All new-file hashes are in the sealed inventory.

| Existing source | Verified original SHA256 | Final SHA256 |
|---|---|---|
| ItacanTaskCore/src/commands.js | DC7D9283880EC9C3CBA2BEA39F60E8DBADEB45F2219273A2FC9275170F31A99C | 72D715634F33BACD5CC34B4FB43766F19B6A6F2D8B36A042D40E5B9792C3C52C |
| ItacanTaskCore/src/contracts.d.ts | C27616D913A7A00F5A8AB2C494AE7846A1AF724154D58E59E4C73A547DEEF7AA | F39ADFCBE90321D19621CDA6D3C523D7F73B7DE7BFCA370DEE868FA629A58DBA |
| ItacanTaskCore/src/domain.js | 54CDD3EF093AFC765BB0F47C2196ECCA7BC2A802C21F5E2E0024163DAD7F5051 | 2618622E567285A147A42CD65F2618B2507432E06815D6EA32FE36172B6D706D |
| ItacanTaskCore/src/index.js | FC49F1DCBD6C781A162075E34E4A7E67CDB7E0D9BF3E9F05D17C14548EACEC9B | 139456F8CAEDF022DB85A1DEB9B0733F4C174B2E478326E5D74443A01FBDD442 |
| ItacanTaskCore/src/json-repository.js | 13C541EDEC77C4EED63FED31E05533A1FEB02093547549693C498DB4DFA9DD75 | F27EA1ABA076DBA2A94F818CF2BFD0EEE0652393FC20B7DDCAE628FF2911565D |
| ItacanTaskCore/src/recurrence.d.ts | 6E0F2C1A62D3F0DC0003915E02FED683F284C053F77A8D9BA5D25A045ED62781 | DB7DB3FB2790271506BAB9B68EC34B5C877AD5FAD05A8F0E233A927E0F15F8A7 |
| ItacanTaskCore/src/recurrence.js | D5B3BF0AAF186ECAB189FA85A7E2899C8393E49076314BBBE233FEF677C277D2 | 1E9C25D602F184BC5198BDFC2C550D3DF376409BC449DB3E878DB8D66B87642C |
| ItacanTaskCore/src/repository.js | E75AF0D0D5C305A16A87DA4074EAD6617E96E2D0935ED468D0D845FBE0BDDE5B | 10CBDA266EDEB984C4E71ABAE688CFC1E9E84C515F4454C51F5BD2053376C476 |
