# Task location focus-shadow diagnosis

## Reproduced mechanism

The installed Obsidian 1.15.0 application archive was booted in the existing native-test Electron with a hidden window, fresh profile, synthetic vault, and a copy of the current plugin bundle/styles. Tests exercised the actual bundled editor, full task form, real Obsidian Modal, native CSS, and pointer input through Electron's debugger. The user's open vault was not reloaded or modified.

Before the correction, native pointer activation followed by Cancel reproduced the rectangle for Add/Edit at root, folder, and note locations. After moving the pointer away, `button.hub-task-location-trigger` had:

- `background-color: rgba(0, 0, 0, 0)`;
- `:focus = true`, `:focus-visible = false`, `:hover = false`, `:active = false`;
- zero border width and no outline;
- a raised, multi-layer `box-shadow`, beginning `rgba(255, 255, 255, 0.09) 0px 0.5px 0.5px 0.5px inset`.

The icon/text spans and their SVG descendants had transparent backgrounds, zero borders, and no shadow. The rectangle belongs to the button, whose content-sized dimensions explain the tight fit around icon and text.

The winning shadow comes from this shared plugin rule in `styles.css`:

```css
.hub-button-scope.hub-capture-form-scope
  :where(input:not([type=checkbox], [type=radio]),textarea,select,
    button:not(.is-active,.is-selected,.mod-cta,.mod-warning,[aria-pressed=true])):focus {
  border-color: var(--background-modifier-border);
  box-shadow: var(--input-shadow);
  outline: none;
}
```

Its specificity exceeds the inline location button's base `box-shadow: none`. Native Obsidian restores the previously focused element after the picker calls `onClose`; the previous parent-focus callback was overridden. The earlier mock restored no focus after `onClose` and defined `--input-shadow: none`, hiding both parts of this failure.

## Correction

The location button has a narrowly scoped `:focus { box-shadow: none }` rule within capture forms. Its existing transparent default background, gray hover/active background, and `:focus-visible` outline remain unchanged. The editor's picker `onClose` now releases its reference and lets native Modal restore focus. No timers, rerenders, or visual-state flags were added to production code.

## Regression commands

```text
node .obsidian/plugins/hub-project-menu/lib/tests/run-task-location-obsidian-test.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/task-location-focus-browser.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/task-location-display-browser.cjs
node .obsidian/plugins/hub-project-menu/lib/tests/task-location-polish-browser.cjs
node --test ItacanTaskCore/vnext/tests/location-defaults.test.cjs ItacanTaskCore/vnext/tests/location-editor.test.cjs .obsidian/plugins/hub-project-menu/lib/tests/task-location-formatting.test.js
node .obsidian/plugins/hub-project-menu/build.js
```

The focused browser fixture now restores the saved opener **after** `onClose` and supplies a nonzero input shadow. Removing only the new CSS rule makes its computed-style assertion fail after Select location, independently confirming that the shadow correction is necessary.

The native suite covers Add/Edit × root/folder/note × dark/light; Select location, Cancel, native X, and Escape; unchanged and changed locations; repeated opening; real hover/leave; fixed icon/text geometry; Tab, Enter, Space, and native keyboard focus restoration. Computed-style reports are written to the temporary directory. The native test uses synthetic location/service data, with actual UI and Modal implementations; it does not test saving live tasks.

The UI changes are JavaScript/CSS. There is no applicable UI TypeScript compilation target; the plugin rebuild and JavaScript syntax checks cover the modified code. Existing location default, ownership, persistence, and formatting tests remain relevant regressions.

The user's existing foreground Obsidian session cannot be inspected through the available UI automation runtime, which fails to start; the Obsidian CLI is disabled. Verification therefore uses the installed Obsidian application in an isolated native test session, rather than the user's already-open session.

## Results (2026-11-04)

- Native Obsidian 1.15.0 in Electron 39.8.3: all 12 mode/location/theme combinations passed, including 48 dismissal checks and the selection/hover/keyboard checks above.
- Updated focused browser suite: all 12 combinations passed; removing only the new rule correctly fails the post-confirm computed shadow assertion.
- Existing display/picker browser suites: all eight viewport/theme runs passed.
- Location defaults/editor/formatting: 22 tests passed.
- Plugin rebuild, JavaScript syntax, and whitespace checks (with CRLF recognized): passed.

Early diagnostic processes reported SQLite service-exit errors during forced test-process shutdown. The retained runner awaits the plugin's native task shutdown before exiting; no persistence test assertions depend on those teardown messages.
