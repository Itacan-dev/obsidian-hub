# Task editor dynamic presentation — verification, 15 October 2026

Implemented and installed the pending-draft labels, shared date prefixes, ordinary-editor Step placeholder, and **No phase → Unassigned** refinement. Obsidian was not reloaded or restarted.

## Ownership and changes

`lib/ui/task-compact-form.js` previously used constant action text for the ordinary editor's `keepLabel` controls. Importance now reads **Change importance** for the existing `must`/`should` values, otherwise **Set importance**. Phase looks up the draft's ID in the current project's available phases: a real match reads **Change Phase assignment**; a cleared or invalid assignment reads **Assign to Phase**. Existing invalid-assignment cleanup remains in place.

The adapters still update the visible label and `aria-label` together, and the live form's existing readiness refresh adds/removes the configured suffix and decorative white check. Obsidian's existing hover tooltips read that same accessible action label. Labels update immediately while the accordion stays open. Selecting Clear or Unassigned restores the unconfigured action/check state. Save/reopen and Cancel retain their original transaction behavior.

The ordinary live adapter passes `unassignedLabel: "Unassigned"`. Its first radio option retains the existing empty value, maps to `phaseId: null`, and has the accessible name Unassigned through its visible text. Real Phase IDs, ordering, selected/hover styling and persistence are unchanged. Other Phase consumers retain their default **No phase** wording; this is explicitly tested. Phase remains unavailable in Resources and projects without applicable phases.

`lib/domain/task-planning.js::taskDatePresentation` remains the sole shared date-presentation owner used by `mountTaskCardPresentation` in Tasks panels and live Add/Edit cards. The future-start/range branch is unchanged. When that branch no longer applies, the due-only branch prefixes the existing `taskDateLabel` result with **Overdue** only for an incomplete task satisfying the existing `taskIsOverdue` predicate; otherwise **Due**. The underlying date formatter, local start/deadline semantics and sorting predicates were not changed. Completed tasks retain their completed styling and have no overdue warning. Uncompleting an overdue task restores its warning immediately.

At a deterministic local clock of 15 October 2026, noon:

| State | Before | After |
|---|---|---|
| Future start only | Starts 20 Oct | Starts 20 Oct |
| Due only | 23 Oct | Due 23 Oct |
| Future start and due | 20 Oct → 23 Oct | 20 Oct → 23 Oct |
| Start 1 Oct, upcoming due | 23 Oct | Due 23 Oct |
| Start 1 Oct, overdue due, incomplete | 13 Oct | Overdue 13 Oct |
| Completed, past due | 13 Oct | Due 13 Oct |
| Untimed due today | Today | Due Today |
| Timed past deadline today | Today, 11:00 | Overdue Today, 11:00 |
| Cross-year future range | 30 Dec 2026 → 2 Jan 2027 | 30 Dec 2026 → 2 Jan 2027 |

Past start-only dates remain hidden. No obsolete start is reintroduced into overdue labels. Native `<time datetime>` values retain the original ISO date/time. Today/Tomorrow, optional time, compact formatting, cross-year precision and exact deadline boundaries remain covered.

`mountTaskSteps` accepts a presentation-only `pendingPlaceholder` option. Only the ordinary live adapter supplies **Describe this step...**. Other adapters retain **Add a step...**, also checked directly in the browser. The pending circle checkbox and separate circle-plus **Add step** action remain intact. Saved Step text, IDs, timestamps, native editing, wrapping, IME, keyboard/blur behavior and storage were not changed.

## Enabled/disabled Step geometry

The current source did **not** reproduce a size difference between the enabled and disabled internal Add step control. Both already share one geometry rule in `styles.css`; the disabled rule changes only faint color, opacity/interactivity and background. No approximate enlargement or CSS override was introduced. New assertions record and compare actual SVG, text and button dimensions in Add and Edit before and after this pass.

| Metric | Enabled | Disabled |
|---|---:|---:|
| SVG dimensions, desktop and narrow | 16 × 16 CSS px | 16 × 16 CSS px |
| SVG stroke | 2 | 2 |
| Font size | 12.48px | 12.48px |
| Computed line height | 17.472px | 17.472px |
| Label box, desktop | 49.5625 × 17.46875px | 49.5625 × 17.46875px |
| Label box, narrow/150% | 49.53125 × 17.46875px | 49.53125 × 17.46875px |
| Icon-column/text gap | 8px | 8px |
| Padding top/bottom | 3px / 3px | 3px / 3px |
| Padding left/right | 6px / 0px | 6px / 0px |
| Row height | 23.46875px | 23.46875px |
| Color | text-normal, rgb(218,218,218) | text-faint, rgb(102,102,102) |
| Opacity | 1 | 1 |

Horizontal positions also match exactly between states: desktop SVG x=360, label x=384; narrow SVG x≈105.3333, label x≈129.3333. Baseline and final metrics are retained in `evidence/step-metrics-comparison.json`. The slight desktop/narrow label-width difference is Chromium text rounding; each layout's enabled/disabled widths are equal.

Trusted pointer tests preserve focus and pending state on disabled clicks. Meaningful text enables the action; clicking it commits the prior Step once and focuses the next empty Step. Clicking the main checkbox abandons an empty Step and completes the parent on the first click. Existing tests additionally verify native caret/selection, IME, blur, no Step attention animation, empty disclosure cleanup and nested Step identities.

## Layout and visual verification

Edge Chromium used extracted native Obsidian CSS and actual Lucide shapes at 1100×850/DPR 1 and 360×640/DPR 1.5. Screenshots were inspected for normal due, overdue, future start, future range, cross-year dates, the expanded Phase list, first/subsequent pending Steps, enabled/disabled Add step and multiple naturally wrapping Steps.

Dates retain their right alignment. Narrow overdue labels do not overlap the title, location, Phase or checklist. The existing narrow cross-year layout elides location/Phase text to preserve the complete date range; no new fixed widths were added. Long checklists remain within the bounded body with the modal footer visible.

The existing symmetry fixture still measures heading x=306…794 and controls x=340…760 on desktop: **34px / 34px** margins, with the original left edge unchanged. Date/Time and Importance columns remain 206px each with an 8px gap. Narrow controls remain x≈85.667…275, with the native-fit Date/Time stacking mechanism active. Footer alignments, Phase short/scrollable edges and the **16px** expanded-to-next-heading gap pass unchanged. Styles were not edited in this pass.

## Tests

**45 current browser runs passed; 5 runs of older fixtures reproduce pre-existing failures.** Each fixture was exercised at desktop and narrow/150%. The focused dynamic fixture passes **372 checks per layout**, including draft label/check/accessible-name transitions, Unassigned, Save/reopen, Cancel isolation, panel/Add/Edit date parity, deterministic dates, completion transitions, Step metrics, focus/readiness and opt-in scope.

Passing current fixtures: `task-dynamic-presentation`, `task-live-card`, `task-opening`, `task-step-alignment`, `task-configuration-polish`, `task-symmetric-content`, `task-specification-layout`, `task-specification-indicators`, `task-configuration-layouts`, `task-config-popovers`, `task-date-closing-atomic-add`, `task-date-closing-atomic-edit`, `task-date-dismissal-pointer`, `task-form-workflows`, `task-inline-accordion`, `task-surfaces-integrated-steps`, `task-card-step-correction`, `task-autofocus`, `task-title-strikethrough`, `task-step-progress`, `task-step-disclosure-refinement`, `task-interaction-corrections`; plus desktop `modal-regions`.

The 15 existing Node suites passed: task form, compact form, layout polish, created completion, progress, History, mutations, workspace, task data, creation retry, planning, typography, project planning, Inbox and icons. New deterministic `task-date-presentation.test.js` passes in **Europe/Stockholm, America/Los_Angeles and Pacific/Auckland**. It checks local midnight/end-of-day, exact timed deadlines and the following millisecond, completion/uncompletion, Today/Tomorrow, times, years, ranges, ISO values and nonmutation. Total: **18 passing Node runs across 16 suites**.

Unrelated assertions were not weakened. Old label/placeholder expectations were updated only where this pass intentionally changes them.

Known pre-existing fixture failures, reproduced against this pass's backed-up UI/domain sources:

| Fixture/layout | Same failure before and after |
|---|---|
| task-compact-form, both layouts | Queries the removed ordinary-editor subtitle `.hub-window-undertext`, then reads null.textContent. This fixture describes the superseded Location/Planning modal. |
| task-planning, desktop | Old month-first `Sep 21` range expectation; current compact formatting is day-first. |
| task-planning, narrow | Old row-separator expectation in its synthetic narrow panel. |
| modal-regions, narrow | Oath Exit rating reveal/scroll assertion, outside the task editor. Desktop passes before and after. |

The new focused fixture directly checks the compact adapters' preserved default labels and placeholder despite the obsolete whole-modal fixture. Baseline logs end in `task-compact-form-before-dynamic`, `task-planning-before-dynamic`, and `modal-regions-baseline-dynamic`. An initial generated modal baseline harness accidentally altered its own script-extraction regex and timed out; that harness was corrected, and the successful desktop/same-failure narrow reproduction is recorded under `modal-regions-baseline-dynamic`. No production changes were made for these fixture issues.

## Files and installation

Production files changed in this pass:

- `lib/domain/task-planning.js`
- `lib/ui/task-compact-form.js`
- `lib/ui/task-form.js`
- `lib/ui/task-live-form.js`
- generated `main.js`

Verification files: new `task-dynamic-presentation.html`, `task-date-presentation.test.js`, and this report; intentionally updated expectations in `task-live-card.html`, `task-step-alignment.html`, `task-configuration-polish.html`, `task-symmetric-content.html`, `task-configuration-layouts.html`, `task-opening.html`, `task-specification-layout.html`, `task-planning.test.js`.

Backups and all evidence are vault-relative at **`System/Backups/task-dynamic-presentation-20261015/`**: original source/styles/tests in `source/`, original installed artifacts in `installed/`, staged artifacts in `staged/`, per-suite logs, `verification-summary.json`, `installed-hashes.json`, `staged-load.log` and `install.log`. Existing repository changes were preserved.

Staging built 150 plugin modules and the 24-module native bridge. Syntax and plugin loading passed with the established Obsidian API stub. Comparing module factories against the installed backup identifies **exactly the four intended source-module changes**. Installation checked that original installed artifacts had not changed since backup, then copied only the verified `main.js`. Installed/staged SHA-256:

`d698ddb8912cdf5b1eaa888db4b38915ae1bfd26a34f16fd38655e5d87826a88`

Styles, manifest, native bridge, strict manifest and every strict asset are byte-identical to their installed counterparts. No task data, Markdown, IDs or persistence schema was changed by installation.

Representative screenshots under `evidence/`:

- `hub-dynamic-before-desktop-add-empty-step.png` / `hub-dynamic-after-desktop-add-empty-step.png`
- `hub-dynamic-before-desktop-edit-overdue.png` / `hub-dynamic-after-desktop-edit-overdue.png`
- `hub-dynamic-after-desktop-edit-phase.png`
- `hub-dynamic-after-desktop-add-due.png`, `...-start.png`, `...-range.png`
- `hub-dynamic-after-small-150-add-overdue.png`, `...-cross-year.png`
- `hub-dynamic-after-small-150-add-empty-step.png`, `...-valid-step.png`, `...-subsequent-step.png`, `...-multiple-steps.png`

Equivalent Add/Edit desktop/narrow captures and full geometry traces are retained alongside these examples. Native Obsidian was deliberately not reloaded; verification uses the isolated native-CSS Chromium fixtures and staged module-load check. The installed change is ready for user review when Obsidian loads the new bundle.
