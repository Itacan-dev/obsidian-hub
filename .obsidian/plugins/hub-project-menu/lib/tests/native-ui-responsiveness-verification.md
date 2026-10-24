# Native Home/startup/navigation responsiveness verification

Verified 2026-10-24 in the installed ordinary Work vault. No commit or push.

## Measured findings and outcome

The main renderer stall was Legacy indexed task discovery underneath eleven native-owner wrappers: each wrapper called Project-context resolution for every Markdown page, and each resolution rescanned the Project registry. The cold CPU profile attributed 7.715 seconds to this path. Warm navigation had 4.3-4.8 second renderer pauses, preventing image callbacks and destination painting even though routing promises completed quickly.

A second cold-start defect captured Dataview's empty Project index in Home. The visible Home retained no Project cards and could not resolve native owners after native admission. Other redundant work included task/History invalidations from Git status-only announcements and reading healthy authorities while the aggregate was known to be incomplete. Layout-ready plugin loading could also await all native owners before exposing consumer factories.

Measurements use the same ordinary Work data, Electron performance.now(), actual navigation functions/destination frame readiness, three warm round trips per build, and lightweight counters. The initial cold diagnostic also used the CPU profiler; cold values are observations, not a controlled CPU-profiler overhead comparison. No filesystem cache was flushed. Cold means a fresh process, not a cold OS disk cache.

| Observation | Original installed build | Corrected installed build |
|---|---:|---:|
| Workspace -> Home, three warm runs | 5.252 / 4.797 / 4.333 s | 0.320 / 0.258 / 0.319 s |
| Home -> Workspace, three warm runs | 0.523 / 0.471 / 0.455 s | 0.442 / 0.634 / 0.482 s |
| Warm maximum heartbeat pause | 4.761 s | 0.262 s |
| Fresh-process Home shell | 4.235 s | 4.370-4.528 s |
| Fresh-process Project cards/backgrounds | visible cold snapshot remained empty; warm rerender restored cards | all four visible cards/images at 4.370-4.528 s |
| All eleven authorities ready | 31.985 s | 22.863-25.822 s |
| Accepted Home task data | cold Project-model failure prevented a valid comparison | 26.233-30.518 s |

During initialization with **zero ready / eleven opening** owners, Home -> Workspace took 0.663 s and the return took 0.216 s. Thus navigation and images no longer wait for task admission. Home-return improvement is substantial; Workspace-entry and initial shell timing are not materially improved. Git identity/provenance and filesystem validation remain the principal cold task-read cost. This work does not claim instant native readiness or eliminate that remaining 23-31 second cold interval.

## Implementation and exact inventory

Existing production sources changed (P = .obsidian/plugins/hub-project-menu):

- P/plugin.js: expose navigation/factories without awaiting admission; expose the existing Project registry to Home; remove the helper on unload.
- P/lib/services/native-task-host.js: resolve the physical owner once per Legacy page query, retaining configured/current-root exclusion and mounted Resource independence; expose loading separately from failure; stop task invalidations for synchronization status alone. Actual repository notifications and fresh sharing status remain.
- P/lib/services/native-task-host-multi.js: aggregate readiness and short-circuit known-incomplete History reads.
- P/lib/services/home-task-read.js: initializing/error/current states, incomplete counts, guarded actions, and a plugin/vault/owner-qualified presentation-only cache. Retained rows are copied and read-only until a new validated read succeeds; the cache never admits mutations or validates repository evidence and is cleared on unload.
- P/lib/services/native-git-inventory.js: three bounded complete-capture attempts for the exact transient source-change failures. Every attempt rereads/revalidates both authoritative sources and all required domains. Persistent churn, disk/memory mismatch, malformed evidence and identity failures still reject. No inventory field or validation was removed.
- P/lib/ui/task-workspace.js: Schedule loading versus genuine unavailability; actions remain disabled until accepted data.
- System/Dashboards/Home/view.js: current Project registry plus metadata readiness subscription/final capture; reuse owner objects; independently load panels; render the initial loading state; refresh state even when the accepted task list is empty; preserve read-only previous presentation across navigation.
- System/Dashboards/Project/view.js: distinguish loading, empty and unavailable; retain accepted rows on read failure.

Derived installed asset: P/main.js only. All 247 factories remain present; six changed factories correspond exactly to the six bundled sources above. All ItacanTaskCore factories and the Electron shutdown prefix compare unchanged. Both dashboards load as source, outside the bundle.

Tests changed: ItacanTaskCore/integration/tests/startup-host.test.cjs, startup-obsidian.cjs; ItacanTaskCore/shared/tests/production-inventory-source.test.cjs. New test: ItacanTaskCore/integration/tests/ui-responsiveness.test.cjs. This report is the only new documentation file.

## Verification

- Final combined focused selection: **80/80 tests**. Covers startup/owner guards, Home/Schedule isolation, presentation cache invalidation, readiness, native read disposal, actual authoritative inventory changes, immutable reservation evidence, stale replay rejection, retained receive process death and real two-working-copy Git exchange.
- Final genuine disposable Obsidian actual-plugin startup fixture: **19 checks passed**.
- Relevant integration TypeScript 6.0.3 declarations: **zero diagnostics**.
- Actual installed Work: eleven ready owners; Home and Project show the existing Pulsed task; Schedule Overview/Week/Month; History reader with 182 records; existing Statistics modal with all five ranges; native recovery command; selected-owner Legacy guard.
- One labelled temporary Pulsed task created, edited, given one flat Step, observed through Home refresh and deleted through the existing confirmed Delete UI. No task or Step was completed. The original accepted live-task model compared exactly before/after. Normal receipts, tombstone and retained request evidence remain; no repository files were manually edited.
- Two consecutive ordinary graceful quit/restart cycles with this final candidate released **all eleven locks**, without intervention. Actual restarted runtime reached eleven ready again. The final launch is a normal visible responsive **Home - Work** window, with diagnostics/debug port removed and eleven leases belonging to its live Obsidian renderer. No timing wrappers remain after that process restart.

Raw corrected failures are retained: the old synchronous-onload fixture assumption; an intrusive profiler-only launch that failed before acquiring any native lease and was closed orderly; an actual startup inventory capture crossing application persistence (fixed with bounded verified recapture); smoke/consumer harness module/input assumptions. They were not made green by weakening correctness assertions. A smoke script initially rejected by automatic approval review was replaced by a single guarded create/edit/delete run with verified cleanup.

## Preservation, build and handoff

Installed main SHA-256: `6937b34f65e98444a9bfc4293f003637ac0982364a78812eca55c215ed0f1868` (previous `e7f954071182052d2bc73de4259a9e13536b3e30666e1534108b90b9cdbc34b1`). The other eleven installed assets match their initial hashes. Rollback assets and original dashboard/source copies remain at:

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\InstallBackups\v1\UI-responsiveness-6f7e38c7-e889-4936-a02c-e2a99df9bb33`

All baseline repository files in the other ten authorities compare unchanged. Only Pulsed advanced through the authorized temporary UI operations; six new generation/request files and normal old-generation retention are accounted for. Its original live task and native event history were preserved. No shared packet/protocol or activation/genesis changes occurred. All 182 Legacy History records, completed checks, task metadata, Project planning, Inbox, Oath-by-device and Music compare exactly as JSON values. Whole data.json bytes drifted and were preserved without restoration or speculative attribution. System shared metadata and baseline migration/source evidence compare unchanged.

HEAD remains `f7032fa4ff549c6b89623668a8c85e0eb168edf6`. The initial actual index was empty, despite the prompt's older staged-file estimate; its complete logical entries are unchanged and the staged diff remains empty. No reset, cleanup, restoration, commit, push or remote Git operation was performed.

Fresh exact-client package, verified against the installed twelve assets **and both dashboard sources**:

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\InstallBackups\v1\UI-responsiveness-6f7e38c7-e889-4936-a02c-e2a99df9bb33\compatible-client`

The prior exact-build package does not describe this changed bundle. The refreshed package retains the existing N4 protocol/genesis manifest, adds the two uncommitted dashboard sources and checks their hashes. It has not been transmitted to or verified on Jinhao's installation. Existing device-local repositories/activation records must never be copied to another client. The package README explains installation and read-only verification; the existing join-existing-genesis procedure remains unchanged.

Raw timings, checks, process/lock evidence, exact domain and asset comparisons: `C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-ui-perf-yq_f8j6v`. Useful files: baseline-navigation.json, baseline-cpu.json, after-retry-startup.json, after-loading-navigation-startup.json, navigation-during-loading.json, final-navigation.json, smoke-result-2.json, actual-consumers-3.json, final-focused.stdout, genuine-current.stdout, protected-final.json and factory-delta.json.

No protocol or historical assertion was changed. No full historical engine archive was rerun. Remaining limitation: native cold admission/read validation is still expensive; it now runs independently of destination/card painting and expected startup remains a quiet loading state, with genuine errors still unavailable. Stop for user review.
