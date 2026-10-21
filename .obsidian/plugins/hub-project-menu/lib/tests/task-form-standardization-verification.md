# Task form polish verification (2026-10-12)

## Task ownership and persistence

Project tasks may have a phase belonging to their owning Project. Resource tasks
belong only to their Resource. Resource folders can still be mounted in Projects.

Removed the Resource **Project / No project** selector, `linkedProjects` provider,
`linkedProjectId` metadata/validation and Inbox intent/retry behavior, Project task
view/search inclusion, Resource task badges, Project table columns and sorting.
The remaining references to that retired property are narrow legacy cleanup and
negative regression tests.

Legacy links are ignored by canonical metadata and draft readers. Normal data
load removes them from in-memory task metadata, Inbox intent and task receipt
values; the next ordinary save removes them from persisted snapshots. Cleanup
preserves task/Step identities, dates/times, necessity, content, history, retry
receipts and Resource-folder configuration. It does not force a startup save.

## Shared components and styling

- `domain/task-form.js` retains the canonical field order, labels and validation.
- `ui/task-form.js` assembles the same text, destination, necessity, date, Step and
  Project-owned phase fields for all three task interfaces. `mountTaskPhase`
  replaces the former combined Project/phase relationship renderer.
- `ui/window-title.js` now exposes the shared `createModalHeader` builder used by
  Capture and the task editor. Edit Task uses **square-pen**, **Edit task** and
  **Make changes to this task**, with the common icon column, spacing, typography,
  structural divider and native close chrome.
- Date, Location and phase use shared picker styling: neutral Location surface,
  border, radius, typography, horizontal padding, hover, focus and disabled states.
  Single-line controls are 40px high; destination summaries retain their second
  line. Phase retains its native select and existing association behavior.
- Phase chevrons follow the native `select:open` state: down when closed and up
  when open. Native keyboard selection and Escape dismissal were verified.
- Necessity uses the existing `hub-option-group` selection rules and
  `--interactive-accent` / `--interactive-accent-hover` / `--text-on-accent` tokens,
  matching Quick Add Type buttons. Both states retain the Tasks panel's existing
  `hub-task-necessity-bar` and `--color-yellow` / `--color-red` colors. No new
  red/yellow palette was introduced.
- Each necessity indicator is 4px wide and 26px high, fully rounded, with an 8px
  gap to the label. One inline flex group centers the indicator and label together.
  A neutral dark keyline keeps the semantic indicator distinct against purple.
  Exclusivity, Clear, Enter/Space, hover and visible keyboard focus remain intact.
- Edit Task and Inbox have no divider below Task text. Ordinary field groups
  retain 24px spacing and 8px label/control gaps. Quick Add keeps its separate
  capture-to-Type divider. Headers and footers retain their structural separators.
- The shared form ends with 24px bottom padding, so its last field can scroll
  completely into view clear of the fixed footer, including with 20 Steps.

Quick Add capture/submission, Inbox drafts/partial completion/retries, and Edit
Task loading/saving/relocation/deletion remain separate workflow responsibilities.

## Passing checks

- **16 Node suites:** task-form, task-association-removal, task-planning, task-data,
  task-workspace, context-search, inbox, project-planning, task-progress,
  task-history, task-mutations, task-creation-retry, data-store.integration,
  shared-projects.integration, oath-shared-resources and plugin-load.
- **task-form-polish:** 113 checks at 1480x1058 and 420x850, using the installed
  Obsidian stylesheet and existing registered title-icon outlines. Covers shared
  headers and picker surfaces, actual native open/closed phase state, native
  keyboard selection, disabled controls, centered indicator geometry and exact
  Tasks panel colors, purple selection, Enter/Space/Clear, existing Resource
  editing, and long-form final-field visibility with fixed header/footer regions.
- **inbox:** 2,101 checks at 1480x1058 and 2,099 at 600x900. Covers capture creation,
  draft persistence/reload, partial completion/progress, retries, note/file routes,
  type changes, scrolling, focus and fixed action footers.
- **task-form-workflows:** 62 checks at 1100x850 and 600x900. Covers real task
  creation, Inbox organization, editing/relocation, dates/times, task/Step identity,
  Step History, Project/destination changes and actual Roadmap phase task lists
  after selecting, changing and clearing membership. Resource forms expose no
  Project association or phase.
- **form-consistency:** 76 checks at 1100px and 420px for canonical order, spacing,
  labels, absence of field dividers, phase scoping and keyboard Step controls.
- **selection-settings:** necessity selection/hover/focus/disabled, Enter/Space and
  Clear across Add/Edit Task, Quick Add and Inbox; other selection controls remain
  functional.
- **task-location-picker:** 103 checks at 420px for creation, relocation, metadata,
  identities, rollback/retry, focus and modal bounds.
- **modal-regions:** 176 checks at 1100x850 for fixed header/footer/close controls,
  independently scrolling content and task/phase form ownership.
- **row-focus:** nested Step removal and keyboard/pointer focus restoration,
  preserved values/order and dismissal without saves.

Browser fixtures use isolated in-memory vaults and real source modules with native
Chromium keyboard events. They do not modify production tasks or Inbox captures.

## Installed output and remaining failure

Rebuilt the installed `main.js` and `atlas-native.cjs` artifacts. The installed
`main.js` passes syntax/plugin-load checks and matches a fresh disposable source
build byte for byte. Existing unrelated work in the workspace was preserved.

The broader **task-workspace browser** fixture still stops at **Mode separator
aligns with Files divider** at 1100x850. That same failure was reproduced against
pre-change code during the preceding standardization. The focused task-form and
Roadmap checks pass; the unrelated Files layout was not changed.

Implementation and verification are complete and stopped for review. The running
Obsidian session was not restarted or used to migrate production data.
