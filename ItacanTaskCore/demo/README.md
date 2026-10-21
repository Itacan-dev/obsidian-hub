# Disposable native task lab

An interactive browser prototype using the actual N2 host, N3-A writer, N3-B
application facade and atomic `task.createRich` / `task.save`. It imports through
this private sibling path only. Production startup and installed assets are unchanged.

## Launch

Use Node 20 or newer from the workspace root:

```text
node ItacanTaskCore/demo/cli.cjs init
node ItacanTaskCore/demo/cli.cjs serve "<absolute profile directory printed by init>"
```

`init` explicitly creates a new verified OS Temp profile and seven synthetic
workspace examples. An optional existing empty absolute Temp directory may follow
`init`. It never imports real tasks. `serve` opens only the specified existing
profile; missing, modified, mixed or wrong-authority storage fails closed.

On this machine the compatible runtime is VS Code's `Code.exe` with
`ELECTRON_RUN_AS_NODE=1`. Python can keep its standard streams attached:

```powershell
$nativeNode = 'C:\Users\El_Baraka 2025\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$env:ELECTRON_RUN_AS_NODE = '1'
python -u -c "import subprocess,sys; sys.exit(subprocess.call(sys.argv[1:]))" $nativeNode ItacanTaskCore/demo/cli.cjs init
# Copy the exact profile path printed above:
python -u -c "import subprocess,sys; sys.exit(subprocess.call(sys.argv[1:]))" $nativeNode ItacanTaskCore/demo/cli.cjs serve '<absolute profile directory>'
```

Open the printed loopback URL. Its fragment contains an ephemeral launch
capability, held in that origin's session storage. It is not a task identity or
persistent authority. Use **Close demo** for graceful shutdown and lease release.
The Temp profile remains available for explicit reopening. There is no automatic
deletion, lock breaking, fence clearing, conversion or replacement authority.

## Try it

- Select a physical workspace and browse Open, Completed or All tasks.
- Create a task with title, description, Necessity, civil dates and optional times.
- Edit continuation separately from description; add nested Steps with bodies.
- Reorder siblings, select a new parent, or remove a confirmed subtree.
- Parent and Step checkboxes edit the draft. **Save changes** commits one atomic
  operation. Cancel/Escape before submission creates no task effects.
- List completion/reopening and deletion use existing commands. History remains
  in the native repository; the UI exposes no general History or export endpoint.
- Click a task title to navigate by UUID. No source Markdown note is needed.
- Reload the browser or explicitly reopen the same profile to restore tasks.

The seven owner contexts and their registry paths are synthetic fixture evidence.
No dashboard or Markdown source note is created or opened. Resources keep their
physical ownership regardless of mounts. All demo data stays private; there is
no sharing transport. Location/Phase values are preserved, not edited by this UI.
Prepared recurrence mutations/rule editing are unavailable in the initial UI.

## Coherent editing

`src/editor-read.js` extracts current content, exact Step hierarchy, completion
display, revisions, binding guards and recurrence membership from one validated
queued repository capture. `host/editor-read.js` retains the host's registry,
identity and acceptance checks, then adds immutable writer-policy pins.

It returns no original source envelopes, migration carriers, identity ledger,
raw receipt, unrelated History, Oath or device state. General N0 DTOs are unchanged.
The snapshot is an observation, not a lease. A stale Save conflicts as a whole;
the UI retains the draft rather than silently refreshing its guards.

## Uncertainty and lifecycle

Each submitted complete application envelope is retained unchanged in server
memory. Identical retries use actual receipt replay; changed stable intent
conflicts. A known commit remains committed if refresh fails. Uncertain results
block further mutation until the original request is reconciled. Cancellation
cannot undo native publication.

This is **not a durable pending-intent store**. After server interruption, an
unavailable original request requires review. Tests replay an externally retained
exact synthetic request; the runtime does not reconstruct one or allocate a
replacement identity. Native recovery fences and writer admission remain authoritative.

## Verification and measurement

Run the three explicit editor tests, four demo tests and their two declaration
runners. The browser fixture is available only with `serve ... --browser-tests`:
open `/browser-smoke.html` on the same authorized origin. It drives the actual UI
and real disposable storage, not a replacement task implementation.

`benchmark.cjs [100 1000 10000]` creates separate guarded synthetic profiles and
measures open/list/editor/Save/completion/Step operations, filtering and memory.
Bulk setup is one existing `task.createMany` per population. Results include
sample counts, medians and p95; process-cold is not physical disk-cache cold.
Report unavailable measurements and machine load. No Markdown comparison or
latency guarantee is implied. The browser renders at most 100 rows per page.

See the Track B verification report for executed results, browser observations,
raw evidence location and protected/build comparisons. Routine UI changes use
targeted checks. Changes to persistence, authority or commands require review and
stronger verification.

No Track A/C1 implementation, Oath, Inbox, live planning, production routing,
installation, migration or Obsidian reload is included. **Stop for user review.**
