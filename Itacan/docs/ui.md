# Changing the interface

Open `renderer/`. The directory names match the visible screens. Each feature's JavaScript builds its layout in reading order. Its CSS controls the placement and width of those elements.

| Change | Edit |
| --- | --- |
| Accent, paper color, foreground, typeface, spacing or radii | The named properties in `ui/shared.css` under `:root`. |
| Every standard button, input or focus outline | `.button`, `.field input` or `:focus-visible` in `ui/shared.css`. The primary and quiet button variants share the base rule. |
| Standard icon size or stroke | `.icon` in shared CSS. The named stroke paths live in `ui/elements.js`. Decorative icons are hidden from assistive technology. |
| Dialog header, close control, actions or keyboard behavior | `showDialog` in `ui/dialog.js`. The native HTML dialog handles focus trapping and Escape. Use `askName` for a single required name. |
| Home cover, card layout or order | `home/home.js` for composition, `home/home.css` for sizing, `assets/` for bundled art. |
| Workspace Files toolbar or rows | `workspace/workspace.js` and `workspace/workspace.css`. |
| Note width, reading typography or editor toolbar | `document/document.css` for appearance and `document/document.js` for placement and behavior. |
| Task editor fields, recurrence controls, filters or task rows | `tasks/tasks.js` and `tasks/tasks.css`. Home, workspaces, capture and Plan use the same task editor. |
| Quick Add and Inbox | `capture/capture.js` and `capture/inbox.js` own the dialogs. Both use `capture/actions.js` for destinations and `capture/capture.css` for layout. |
| Plan entries, notes, order and history | `plan/plan.js`, `plan/picker.js` and `plan/plan.css`. |
| Progress on Home or a workspace | `home/home.css` (`.home-panels`) and `workspace/workspace.css` (`.workspace-summary`) set the allocation. `progress/panel.js` and `progress/progress.css` set heatmap cells, year navigation and history placement. |
| Daily report and Statistics windows | `progress/report.js` and `progress/statistics.js` build their contents. Change card spacing, chart heights, dialog heights and Statistics columns in `progress/progress.css`. Rating descriptions live beside the rating controls. |
| Tabs, split panes or contextual file tree | `workspace/desk.js` owns tab actions. `workspace/splits.js` places pane hosts around shared dividers. `workspace/desk.css` sets the responsive rail width, the 70/30 Files and Tasks split, tab height, pane minima and split overflow. `workspace/tree.js` owns folder navigation. |
| Sortable cards, folders, steps, Plan entries and presets | `ui/reorder.js` handles insertion and keyboard order. Each feature supplies its own save action. Change the focus, selection and insertion styles in `ui/shared.css`. |
| File and tab drops | `workspace/file-drag.js` handles folder targets. `workspace/pane-drop.js` determines tab insertion and pane edges. `workspace/desk.css` paints the pane previews and per-tab close controls. |
| Fields, file destination pickers and confirmation prompts | `ui/forms.js`. The picker reads only the folder being browsed. |
| Navigation bar or capture footer | `index.html` and the `navigation` function in `app.js`. |

The shared canvas cap, cover height, row heights and gaps live under `:root` in `ui/shared.css`. Home and Workspace each own their grid spans and container breakpoints. The agenda lives in `home/calendar.js`. Workspace owns the folder tree’s default fraction and pane minima. The document rail formula lives in `workspace/desk.css`. Double-click either explorer divider to restore its responsive default. The read and edit text limits live together in `document/document.css`. Maximized startup and the native View menu live in `main/app.cjs`.

## Adding a control

Use a native button, give it a visible action label, and append it where the feature needs it. The shared helper applies standard styles, the optional icon and error reporting.

```js
actions.append(button('New folder', () => create('folder'), { symbol: 'folder' }));
```

For a dialog, pass a title, an optional description, the feature's form content and its actions to `showDialog`. Set the intended width and, for fixed work areas, height in the feature stylesheet through `--dialog-width` and `--dialog-height`. An action can validate and save before dismissal. Failures appear in the dialog and leave its inputs available. The feature owns the result and decides what to save. A layout adjustment belongs in feature CSS. A shared style change belongs in the common stylesheet.

Run `npm start` and open the sample library to inspect Home, the folder listing and a document. Try Tab, Escape, the Save shortcut, a narrow window and the disabled Save state. Restart the development app after editing source to rebuild the renderer.
