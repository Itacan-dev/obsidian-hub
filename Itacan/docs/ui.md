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
| Quick Add and Inbox | `capture/capture.js` and `capture/capture.css`. Their shared destination controls handle Create task, Create note and Add to note. |
| Plan entries, notes, order and history | `plan/plan.js` and `plan/plan.css`. |
| Tabs, split panes or contextual file tree | `workspace/desk.js`, `workspace/tree.js` and `workspace/desk.css`. |
| Fields, file destination pickers and confirmation prompts | `ui/forms.js`. The picker reads only the folder being browsed. |
| App bar or breadcrumbs | `index.html` and the `navigation` function in `app.js`. |

## Adding a control

Use a native button, give it a visible action label, and append it where the feature needs it. The shared helper applies standard styles, the optional icon and error reporting.

```js
actions.append(button('New folder', () => create('folder'), { symbol: 'folder' }));
```

For a dialog, pass a title, an optional description, the feature's form content and its actions to `showDialog`. Use the wide dialog size for longer forms. An action can validate and save before dismissal. Failures appear in the dialog and leave its inputs available. The feature owns the result and decides what to save. A layout adjustment belongs in feature CSS. A shared style change belongs in the common stylesheet.

Run `npm start` and open the sample library to inspect Home, the folder listing and a document. Try Tab, Escape, the Save shortcut, a narrow window and the disabled Save state. Restart the development app after editing source to rebuild the renderer.
