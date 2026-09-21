# Tasks to Do row polish — 19 September 2026

The shared Home/Workspace task rows now show **title → immediate parent folder → disclosure and Step progress**. Expanded Steps have their own nested checkboxes and completed-text strikethrough. Tasks without Steps do not receive this section.

Dates stay in the fourth, non-shrinking grid column, including in the narrow note rail. The content column shrinks; long titles and folder names ellipsize. From/Due labels and overdue styling remain. A root-level note uses its basename as the source label.

## Step writes and disclosure

`lib/ui/task-steps.js` is a reusable component using the existing task/Step data and shared Markdown renderer. Progress updates immediately and restores its previous state if saving fails. Step clicks and disclosure do not bubble into parent editing, completion, or source navigation.

Checking a Step uses the existing serialized task mutation queue and `vault.process`. The small `toggleTaskStep` helper resolves the parent against the current source, finds the Step only within that parent's block, and changes that checkbox marker. It preserves surrounding Markdown and line endings, returns an updated parent for the existing dashboard reconciliation, and does not create independent task history or automatically complete the parent. Changed or ambiguous Step targets are rejected.

Expansion is local to each mounted panel and survives ordinary rerenders and Step completion. Reloading the panel resets it. Unannotated tasks use their source path, line and text as the disclosure key; moving or renaming such a task may reset its disclosure.

## Files changed

Under `.obsidian/plugins/hub-project-menu/`:

- `lib/ui/tasks.js`: shared source label and Steps integration.
- `lib/ui/task-steps.js` (new): reusable disclosure, nested checkboxes, immediate progress and failure recovery.
- `styles.css`: stable right-side dates, title/source truncation, subordinate Steps styling.
- `lib/domain/task-planning.js`: nested-checkbox-only mutation.
- `plugin.js`: route Step updates through the existing mutation queue without independent completion history.
- `main.js`: rebuilt artifact, 39 bundled modules.
- `lib/tests/task-planning.test.js`, `lib/tests/task-history.test.js`: source safety, repeated checks, parent isolation and history assertions.
- `lib/tests/task-planning.html`, `lib/tests/task-editor.html`: browser coverage and shared component loading.

Dashboard changes in `System/Dashboards/Home/view.js` and `System/Dashboards/Project/view.js` only move the shared row binding after the source label is created. This report is `System/Hub-task-row-polish.md`.

## Checks

Build and all six relevant Node suites passed: tasks, task mutations, task planning, task history, task discovery/data, and plugin/dashboard load checks.

Three isolated headless Edge fixtures passed: task planning/rows, existing inline task editing, and existing checkbox regression. Coverage includes Home, Project and Resource rows; source labels; long-title/source ellipsis and right-side dates at 330px; disclosure; direct Step checks/unchecks; immediate progress; rerender during a pending save; failed-save rollback; and parent interaction isolation. Existing task modal and creation checks also passed.

The browser fixtures use real Hub modules with mocked Obsidian host APIs. Reload the Hub plugin to load the rebuilt artifact; the running Obsidian session was not forcibly reloaded.
