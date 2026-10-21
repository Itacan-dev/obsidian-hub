# Existing Itacan UI with native tasks: Milestone 1

This is an isolated browser prototype. It runs the actual `openTaskCreator`, `openTaskEditor`, `mountLiveTaskForm`, task row/card/checklist presentation and task grouping/disclosure components. The browser bundle is assembled in memory from their current source and uses the existing plugin and dashboard CSS. There is no production startup registration or installation.

## Try it

Use Node 24 and an explicitly selected, newly created empty OS Temp directory. Run from the workspace root:

```powershell
$preview = Join-Path ([IO.Path]::GetTempPath()) ("itacan-ui-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $preview | Out-Null
node ItacanTaskCore/product-ui/cli.cjs init $preview
node ItacanTaskCore/product-ui/cli.cjs serve $preview
```

Open the printed loopback URL, including its capability fragment. The preview opens with two synthetic physical owners, Project and Knowledge (Resource `study`). Click **+ Task**, use the existing compact Add/Edit windows, and use the ordinary task and Step checkboxes. Completed tasks use the existing disclosure. **Close preview** drains native work and releases the writer lease. Run `serve` again against that exact directory to reopen its tasks. Never remove an unknown writer lock; the runtime has no lock-break or replacement-root operation.

The exercised runtime was Node 24.21 through VS Code's Electron Node mode. The test browser was installed Chrome with a fresh owned Temp profile. No dependency installation is needed for the runtime.

## Translation and preservation

- Creation compiles to one v2 application `rich-create` / native `task.createRich` request. Flat Steps have fresh UUIDs and independent initial checked state.
- Edit retains the complete coherent native editor draft privately. It overlays title, Description, Necessity, civil Start/Due endpoints, visible flat Step text and explicit checkbox intentions. One `task.save` commits the complete edit. Retained IDs, continuation, Step bodies and location survive; absent visible Steps become explicit flat deletions.
- List checkbox actions use existing ordinary task/Step completion commands. Parent and Step completion remain independent. Delete uses whole-tree logical deletion, with the existing two-click confirmation.
- The runtime uses the actual N2 host, P1 combined reads, coherent editor port, N3-A writer, N3-B application adapter and native atomic commands. The bridge opens no repository and the UI receives no repository handle.
- Exact original intents, UUIDs and guards survive an in-process uncertain retry. Identical replay reaches native receipts; changed stable intent conflicts. Known commitment stays committed if refreshed display is unavailable. No replacement identities or automatic recovery of a lost application intent are offered.
- A failed modal save leaves its draft visible. A transport-uncertain modal may retry the identical Save. An uncertain list action blocks new changes for review; there is no durable UI pending-intent store or cross-store acknowledgement protocol.

Nested trees, Phase-bound tasks and recurrence members cannot be edited or toggled through this prototype. Their data remains intact. The form adds no hierarchy selector, Step notes, continuation field or separate parent-completion control. Native source-less tasks have no fabricated Markdown path, line or Hub ID. Owner labels are presentation context, not note provenance.

## Isolation and product boundary

Only the two approved existing source files change: `lib/ui/task-editor.js` and `lib/ui/task-live-form.js`. Their optional presentation/destination seam is unused by legacy production callers. The original path-based branch remains in place. The new sibling package has exactly twelve files and is absent from the production graph.

Mutable profiles must be existing ordinary Temp children outside the workspace/cloud roots; native admission pins the physical repository and authority. The HTTP host binds only loopback, checks Host/Origin and an ephemeral capability, serves an explicit static allowlist, and exposes only scoped reads and the restricted form actions. It exposes no generic executor, export, real Vault adapter or application-data save. Its browser shim implements the necessary Obsidian DOM/modal hosting only. Markdown previews are safe plain text; Obsidian Markdown/MathJax, custom themes and full native icon fidelity are not demonstrated.

Schedule/Home controllers, Phase assignment, recurrence editing, clear-completed, source positioning/navigation, Oath, Inbox, Roadmap coordination and production routing are unavailable. C1-A is neither imported nor adopted. This is Milestone 1 only.

## Verification

Run explicit tests with the established Temp isolation guard in the execution environment:

```text
node --test --test-reporter=tap
  ItacanTaskCore/product-ui/tests/bridge.test.cjs
  ItacanTaskCore/product-ui/tests/isolation.test.cjs
node ItacanTaskCore/product-ui/tests/browser.cjs
```

The browser runner accepts an optional absolute Chrome executable as its first argument. It uses only owned Temp profiles, trusted browser clicks for controls, screenshots and actual native persistence. Its transport-loss test drops acknowledgement after a real committed response, then retries the exact retained Save without creating another task. Its legacy component check uses an in-memory service, not a Markdown write.

Acceptance on 2026-10-20:

- 19 new bridge/isolation/persistence checks; two parent-terminated native children cover before publication and published-before-acknowledgement. Exact lock bytes, PID/host/token and death proof precede guarded lock movement; identical replay preserves UUIDs.
- 46 affected legacy UI checks and 164 focused editor/application/atomic regressions passed, with no assertion changes.
- Editor, application and atomic declaration runners: zero diagnostics.
- DOM-driven Chrome workflow covers Add/Edit, flat Step editing, Description, Necessity, date-only Due, draft-only modal checks, task/Step completion and reopening, cancellation, deletion, Resource ownership, host reconstruction, acknowledgement retry and fresh-document reload. No page exceptions in the accepted run. Screenshots were visually inspected.
- Baseline/final builds are Temp-only. All twelve installed assets remain unchanged. Staged main changes only the two authorized UI factories; all other staged assets match. Factory IDs/counts remain 171 main / 24 Atlas, with one Legacy Task Service construction and no native package in startup.
- Protected application data, Markdown, History/checks and native/core/C1-A source bytes remain unchanged. Concurrent workspace-state drift is retained separately without restoration or attribution.

Small-workload browser latency observations are retained in the Temp evidence, including initial harness failures and shutdown cleanup. These are individual empirical observations, not a benchmark or production performance guarantee. A browser shutdown stall was corrected entirely inside this new package by draining native work and closing the server's owned HTTP connections; stalled disposable roots/lock evidence were preserved.

The full command/exit/output records, original two UI files, screenshots, interruption evidence, fresh baseline and final comparisons are retained privately at the execution's Temp audit location. No historical acceptance archive was repeated. Stop for user review before any further milestone or production adoption.
