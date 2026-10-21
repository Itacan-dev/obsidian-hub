# Milestone 1D — Dormant native task startup integration

Completed 2026-10-21. Source integration only; installed production code and real task authorities were not activated. Archive-and-switch remains separately authorized work.

## Exact implementation inventory

Existing files modified:

- `.obsidian/plugins/hub-project-menu/plugin.js`
- `.obsidian/plugins/hub-project-menu/build.js`
- `ItacanTaskCore/integration/tests/run-obsidian.cjs`
- `ItacanTaskCore/integration/tests/obsidian-host.cjs`

New files:

- `.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js`
- `.obsidian/plugins/hub-project-menu/lib/ui/native-task-recovery.js`
- `ItacanTaskCore/integration/tests/startup-host.test.cjs`
- `ItacanTaskCore/integration/tests/startup-obsidian.cjs`
- This report.

No native execution, persistence, codec, receipt, recovery, command, domain, calculation or declaration source changed. Oath, Inbox, Roadmap, Music, C1 storage and existing Add/Edit components remain byte-preserved. Unsupported-domain admission is applied to the selected owner's service instances by the new startup boundary, rather than implementing coordination in those services.

## Configuration and lifecycle

Ordinary `onload` still constructs exactly one Legacy Task Service. With no authorization, `createNativeTaskHost` returns null before importing native modules: no native root, writer, lease, storage inspection or subscriptions are acquired. Default Add follows its original form directly. No settings field, automatic conversion, persistent activation setting or user switch was added.

Explicit pre-onload `HubProjectMenu.authorizeNativeTaskRehearsal(instance, configuration)` records a one-use instance-local authorization. Version 1 requires `syntheticOnly:true`, a verified Temp parent `root`, an existing synthetic vault and separate native directory inside it, one Project `owner`, `projectRoot`, `dashboard`, `partitionId`, `rehearsalId`, `creating`, and the existing inactive-disposable/private-v4 host `config`. Live/cloud roots, overlapping vault/native storage and existing Markdown checkboxes in the selected Project reject. Authorization does not create storage. Vault physical identity is pinned and rechecked by the registry provider.

Authorized startup lazily imports the completed Project runtime and uses the existing host/writer/application adapter, atomic capability and retained-request mechanism. Live Project records provide the registry; duplicate Project IDs, changed physical context/root/dashboard/status, shared ownership or lost vault identity make native evidence unavailable. No supplied registry can override actual Project ownership. A failed open reserves the selected owner and exposes unavailable consumers; it does not reactivate legacy writes.

Consumer hooks are published after initialization. Existing Project/Home/Schedule factories receive the established native task port. History readers and the Statistics modal receive one existing completion supplier. The legacy supplier observes the full original typed History array and its canonical digest, with established completion invalidations; native and legacy reads do not constitute an atomic cross-store snapshot. No old History is imported, rewritten or manufactured. Existing accounting and Statistics algorithms are reused unchanged.

Instance-local task guards exclude selected-owner Markdown rows and reject legacy task editing, creation, cursor insertion and clearing. Resource ownership stays physical. Native Oath enrollment and Phase mutation reject; native task destinations are unavailable in Inbox/Quick Add and publication rejects before capture/task side effects. Other owners retain their existing service methods. Nested, recurrence-member and Phase-bound native editing retains the existing restrictions; clear-completed/source operations do not gain substitutes.

Unload closes recovery/Statistics presentation, begins the host's idempotent shutdown and exposes its same `nativeTaskStopping` promise. Shutdown stops admission, drains construction and existing runtime work, disposes feeds/subscriptions and releases the writer. Registered cleanup uses the same close operation. Clean restart reconstructs the authority; competing ownership remains blocked. There is no new queue, pending store or outcome authority.

## Operator recovery

Only enabled native mode registers the actual plugin command **Native task recovery**. Its small existing-style modal lists operation IDs, performs bounded inspection/reconciliation and offers eligible identical replay. Replay requires a separate **Confirm exact original replay** click using the original issued review object. Neither inspection nor confirmation shows command bodies, task content or storage tokens. Unavailable/corrupt authorities remain blocked. Existing receipts and M1C admission/publication checks remain authoritative; retention files are neither cleared nor rewritten.

## Acceptance results

| Selection | Actual result |
|---|---:|
| New startup/owner/isolation/lifecycle checks | 9/9 pass |
| Selected existing native controllers, Home/Schedule, History/accounting/navigation, recovery, host lifecycle and P1 scoped races | 158/158 pass |
| Writer admission and replay/lifecycle | 40/40 pass |
| Selected legacy Home, Project, Schedule, History/Statistics and historical boundary checks | 113/114 pass |
| Relevant declaration runners, TypeScript 6.0.3 | 7/7 pass, zero diagnostics |
| Genuine isolated Obsidian, staged actual plugin onload/onunload | 19/19 workflow checks pass |

The legacy selection is **not entirely green**. Its unchanged `task-service-boundary.test.js` assertion that no statically reachable source filename contains `ItacanTaskCore` fails against the newly authorized dormant bundle graph. The assertion and all other historical tests are unchanged; its raw failure is retained. Runtime absence in disabled mode is verified separately, including actual onload and an instrumented no-native-import check. No historical frozen-graph execution is newly claimed here, and no assertion was skipped or weakened. Earlier source-hash/frozen-graph distinctions remain unchanged.

The initial new overlap test exposed acceptance of equal vault/native paths; this gate corrected the admission condition and all nine final checks pass. Two initial declaration invocations lacked the installed TypeScript argument; their explicit-path reruns pass. Both initial failures are preserved.

The actual Obsidian plugin manager loads the candidate bundle staged **only in its synthetic Temp vault**. A thin fixture subclass supplies authorization before calling the actual plugin's complete `super.onload`; it does not reproduce task dependency construction. The actual plugin's window hooks, command registration, components and `onunload` are used. The controlled legacy index is a synthetic Dataview-compatible provider, not an installed Dataview plugin or real corpus.

The workflows verify default Legacy Project/Home/Schedule and Add; native Add/Edit, flat Step creation, independent Step/parent completion, reopen/recomplete; mixed Home; Overview/Week/Month and calendar date-only creation; mixed typed legacy/native History and actual Statistics modal; unsupported actions; recovery inspection and two-click identical replay of a genuinely retained undispatched request; UUID preservation; clean unload/lease release; reconstruction; failed startup without fallback or complete Home count; and subsequent default Legacy startup. The native authority was opened only beneath the owned Temp root. Full dashboard-page/pixel parity and production readiness are not claimed.

No durable protocol changed, so this gate did not repeat the historical process-death archive. Selected M1C recovery tests and writer acknowledgment-loss/admission cases were rerun; actual plugin unload/restart was exercised repeatedly.

## Build and protected-state comparisons

The fresh baseline recorded 1,813 existing file hashes, exact changed-source originals, 805 dirty Git entries, 1,161 protected Markdown/data/asset hashes and installed assets. All mutable execution and builds used guarded OS Temp. No Git cleanup or restoration occurred.

Staged main factories grow **171 → 227**, adding 54 existing native/support factories and two new plugin factories. All previous factory IDs remain; only the existing `plugin.js` factory body changes. Atlas remains **24**, with identical bytes. The other eleven staged assets match exactly. The startup factory retains one Legacy Task Service construction. Dormant native factories are intentionally now bundled; they are not evaluated to construct a host in disabled mode.

**All twelve installed production assets match their fresh baseline hashes.** Plugin `data.json`, shared data, real Markdown and the inventoried task/History/Oath/Inbox/device/planning sources remain unchanged. The sole observed protected drift is `.obsidian/workspace.json`, in `lastOpenFiles`; its observed bytes/hashes are preserved without restoration or actor attribution. No complete protected-byte identity is claimed. Baseline comparison finds only the four authorized existing-source changes plus that workspace drift.

Exact commands, raw stdout/stderr, scalar exits, selections, originals, failures, staged-factory comparison and protected/installed comparisons are retained at:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-m1d-5jl8qkrp`

Final genuine Obsidian evidence:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-real-host-5hqi9E\evidence`

## Remaining cutover work

This milestone provides dormant ordinary-startup integration with synthetic Temp admission only. It does not install the candidate, persist a real activation configuration or authorize a permanent native authority. A later gate must approve device-private stable authority admission/configuration, the selected real Project, readable task/Step export and Markdown backups, verified deactivation of its task sources, and the controlled switch. Legacy completed History stays untouched; desired active tasks will be manually recreated. No automated migration or History import is required. Oath/Inbox/Phase/sharing, unsupported recurrence and clear-completed remain unavailable for native ownership until separately integrated.

Stop for user review after 1D; no archive, retirement, real activation or task recreation has been performed.
