# Repeat task visibility ? 2026-11-06

Add/Edit task passes `showRecurrenceAction: false` to the shared live form. The option defaults to true for other composers. When false, neither the recurrence action nor its accordion section is created; optional lifecycle hooks tolerate the omitted picker. Restore the action by removing this override.

No recurrence component, schema, service, validation, scheduling, serialization, or existing test was removed. The editor still copies the complete snapshot and submits its state. Skipping the recurrence picker avoids synthesizing recurrence defaults. The unchanged native application treats an absent recurrence draft as no recurrence operation.

Verification:
- `node .obsidian/plugins/hub-project-menu/lib/tests/task-repeat-visibility.cjs`: 97 browser checks passed using real UI modules/native Obsidian CSS and isolated Modal/service adapters. Covers Add/Edit, Add/Edit description, no recurrence DOM/accessibility nodes, Tab exclusion, no unused row space, natural modal/footer height reduction, recurrence-preserving Save payloads, and unchanged other-composer visibility. Screenshots visually reviewed.
- `node .obsidian/plugins/hub-project-menu/lib/tests/task-editor-step-context.cjs`: 281 browser interaction/layout checks passed, including keyboard, pointer, touch, steps, Add/Save/Cancel, and panel isolation.
- `npm test` in ItacanTaskCore: all 106 existing tests passed, including recurrence, persistence, scheduling, process interruption, sync, and Git transport.
- `node --test ItacanTaskCore/vnext/tests/application.test.cjs`: all 13 tests passed, including two added daily/weekly tests using the real native application/SQLite persistence. Unchanged saves and edits to title, dates, location, importance, description, and steps preserve the complete recurrence configuration and series revision.
- TypeScript 6.0.3: `tsc --noEmit --strict --skipLibCheck false --target es2022 --module commonjs --ignoreDeprecations 6.0 ItacanTaskCore/vnext/tests/types.fixture.ts`: passed.
- JavaScript syntax checks for both changed UI modules: passed.
- Plugin build: passed (177 UI modules, 27 Atlas native modules).
- `git -c core.whitespace=cr-at-eol diff --check`: passed.

Browser evidence: `%TEMP%/itacan-repeat-visibility-9YxykP`. Browser verification uses isolated test data; no live user tasks were edited.

Pre-existing workspace changes were retained.
