# Native task profiling gate

Diagnostic-only. Existing runtime algorithms, storage, commands and both UIs are
unchanged. All mutable profiles and raw measurements must live in verified OS
Temp, separately from the active Task Lab profile. No optimization is implemented.

See [REPORT.md](REPORT.md) for executed measurements, source-backed conclusions,
limitations and the single proposed next optimization gate.

## Operation boundaries (frozen before measurement)

The unchanged `demo/benchmark.cjs` seeds one `task.createMany`, closes the store,
measures a process-cold open, then reopens it. It warms list capture three times.
Its list metric calls `runtime.list`: host refresh, then another authoritative host
capture, owner projection and detached result. Its editor metric calls the private
editor port: host refresh, then a scoped authoritative editor capture.

The original process-cold timer starts after the child has loaded its modules;
it measures opening in that fresh process, not complete process-launch latency.
The browser runner separately records child launch through server-ready output.

The original Save metric includes an editor fetch, model/draft preparation,
`runtime.mutate`, intent compilation, capability authorization, actual application
adapter/writer admission, repository command/candidate/receipt/commit and coherent
read-after-write. Completion and Step insertion include the same preceding editor
fetch. A final browser list refresh and HTTP/rendering are not in those three
original mutation metrics. Filtering/sorting is an in-process pure model call.
Process-cold opening is not an OS disk-cache-cold measurement. The original repeated
mutations grow receipts/History; retain and account for that growth.

Additional diagnostic boundaries:

| Boundary | Included |
|---|---|
| Native command | Actual writer call, including its admission/host refresh and repository execution; no editor fetch or application refresh |
| Application mutation | Existing application facade translation, actual writer and coherent read-after-write; no editor fetch |
| Full backend interaction | Editor/creation-context read, draft preparation, application dispatch and coherent refresh |
| HTTP interaction | Loopback request/decode, full backend interaction, encode and response; browser paint measured separately |
| Repository execution | Existing queue through authoritative load, candidate, validation, receipt, storage commit and publication |
| Domain validation | Inclusive time inside actual exported `validateState`; nested validators appear in CPU samples |
| Storage load/verify | Actual generation read/checksum/decode/validation and barrier/fence checks |
| Storage commit | Existing generation encode/write/flush/verify, manifests, publication, cleanup and acknowledgement |
| Projection | Actual fixed snapshot/editor projections, separate from full authoritative load |

An external CommonJS diagnostic wrapper records calls without editing source. It
preserves arguments, receiver and result/error identities; promises are chained
with the same fulfillment/rejection values. Wrapper scheduling/overhead is an
explicit limitation, checked against uninstrumented runs. Nested inclusive time
must not be summed; nonoverlapping self-time accounts for nested calls and async
waits. Timings are diagnostic process wall time, not pure CPU time. CPU sampling
and an uninstrumented comparison quantify overhead. Generic clone/canonical/JSON
costs are sampled or selectively wrapped to avoid per-primitive timing distortion.
No validation, receipt, lock, fence or publication check is skipped.

## Reproduction

Use the compatible Node runtime and established isolation guard. Pass an existing
verified empty Temp child as `<audit>` for a new run. Never supply a Task Lab
profile or existing user repository. The runner creates separate synthetic roots;
unchanged benchmark child locations are also recorded in its raw output.

```text
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs baseline <audit>
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs prepare <audit>
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs diagnose <audit>
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs boundaries <audit>
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs profiles <audit>
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs calibrate <audit>
node --require <isolation-guard> ItacanTaskCore/perf/run.cjs http <audit>
node --require <isolation-guard> ItacanTaskCore/perf/sensitivity.cjs prepare <audit>
node --require <isolation-guard> ItacanTaskCore/perf/sensitivity.cjs measure <audit>
node --require <isolation-guard> ItacanTaskCore/perf/sensitivity.cjs measure-writes <audit>
node --require <isolation-guard> ItacanTaskCore/perf/browser.cjs <audit> <Chrome-executable>
node --require <isolation-guard> ItacanTaskCore/perf/analyze.cjs <audit>
node --test ItacanTaskCore/perf/tests/harness.test.cjs
```

Paths above are relative to the workspace. Raw records contain exact arguments,
counts, sample sizes, state growth, bytes, CPU/heap profiles and process memory.
Preparation and measurement are separate. Do not run regression suites while
collecting performance data. Small expensive samples are reported as ranges or
individual observations, not precise population percentiles. Fresh cloned closed
synthetic baselines are opened only in separate child processes, preserving each
sample's original authority and initial counts. No lock is copied while held.

Export/class-method wrappers must be installed before native modules load. They
are confined to diagnostic children and preserve opaque admission objects. CPU
sampling uses the Node inspector; heap sampling includes collected allocations.
GC counters, boundary memory observations and post-close explicit-GC readings are
separate from measured operation time. Full heap snapshots are unnecessary here.
Returned completion callbacks are wrapped to time the actual existing transition
and explicit initial-event calls; event/binding updates inside a transition are
not falsely reported as independently timed stages.

## Product UI boundary

The existing compact Itacan Add Task/Edit Task windows remain authoritative:
dark theme/accent, flat Steps, Necessity and Start/Due controls, progressive
disclosure, modal spacing/header/footer. Task Lab is an engineering harness.
Child Steps, parent/top-level selectors, Step notes, continuation and a separate
parent-completion control are not approved product features. No UI is changed in
this gate. Future compact editors must preserve hidden native structures/content,
original evidence and bindings, or explicitly restrict incompatible edits.

N3-C1-A, Oath/Inbox/Phase coordination, production routing and migration are outside
this gate. Stop after profiling and recommendations; proposed optimizations need
separate review.
