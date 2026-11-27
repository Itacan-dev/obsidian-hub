# First desktop UI polish pass

The pass began with the running `standalone/internal-product` build at `4062c8d`. All screenshots came from offline Electron sessions on Windows with disposable libraries. Each comparison shows the same workflow at the same content size, with the earlier view on the left. The search pair records a defect found and corrected during the pass.

## What changed

| Surface | Change visible in the application |
| --- | --- |
| Shared controls and type | Baskervville identifies pages, panels and dialogs. Instrument Sans carries field values, controls and metadata. Dates and paths have less weight than titles. Standard controls use a 36 px minimum height and compact controls use 32 px. Smaller toolbar controls use the next size down. Related controls share insets and gaps drawn from the 4, 8, 12 and 16 px spacing scale. Keyboard focus has a visible outline. Brief color transitions stop for either the system or application reduced-motion preference. |
| Home and Workspace | The cover and sticky navigation share the same height at each window width. The current route has an accent edge, including when its button is disabled. The library icon and name stay together. Global actions have fewer outlines. Calendar rows lead with the task title. Resource cards change their image and caption arrangement as space narrows, keeping all four names readable at 760 px. Empty Projects keep their allocated space. [Resource cards](resources.webp) · [Workspace](workspace.webp) |
| Files and document desk | File columns align with their headings. The tree marks the current folder and file. At narrow widths Files moves above Tasks and Progress, and the desk rail leaves more space for documents. The active split has an accent tab underline. Read, Live Preview and Edit share the filename, mode group and save status. Prose, source and rendered equations respect the available pane width. PDF paging and zoom form separate groups, and the image viewer uses the same zoom treatment. [Split desk](split-desk.webp) |
| Tasks, Plan and roadmaps | A wrapped task title stays beside its checkbox. Workspace, Should/Must importance and dates sit below it. Steps sit under their parent and completed titles recede. Plan uses a consistent title column for tasks, files and workspaces. Reorder and remove controls occupy the same row. Milestone and phase fields use a form sized to their contents. [Mixed daily Plan](daily-plan.webp) |
| Quick Add, Inbox, Progress and Oaths | Quick Add aligns filing destinations and shows each attachment name once. At short, narrow sizes the Inbox list sits above its detail, with independent scrolling and a reachable Close button. Progress and Statistics use the theme colors for their history, charts and meters. Regular Oath groups start and fulfilment fields with their dependent inputs. Its existing rest, fulfilment and Break flows were exercised. Strict remains unavailable in this build. [Narrow Inbox](inbox.webp) |
| Dialogs, menus and Music | Dialog title, description and close control share a header, and action footers stay visible while longer forms scroll. Settings keeps the same shell across tabs. Music separates the playing filename from its folder and fits long tracks alongside playlist actions. Menu rows, hover, focus and disabled states use shared control styles. [Settings](settings.webp) |
| Search and recovery | Search groups distinguish a match from its path or snippet. The list opens above the field when the space below is too short, and the selected row stays in view when the window or list changes size. A missing document shows its path and relink action. Draft and disk-conflict states identify the save issue beside the available actions. Read-only library recovery separates the error, folder controls and readable file. [Minimum-window search](scoped-search.webp) · [Library recovery](recovery.webp) |

## Verification

Opened the development build from source and exercised the built application with temporary libraries. Checks covered desktop, intermediate and short windows, light and dark themes, compact density, extra-large text, keyboard and pointer use, and both reduced-motion settings.

- At the Windows minimum of 680 × 480, Electron provided a 664 × 415 content area. With 21 mixed search results, the last result stayed visible and clickable after a 250 px Workspace scroll.
- At 780 × 700, the rail, both split documents and their mode controls remained accessible together. Resizing a single pane down to 170 px kept all three Markdown modes and Save visible.
- Checked 22 matched Workspace and desk views, including a real disk conflict, a recovered draft and read-only library recovery. Both runs completed with zero renderer errors.

The 33 automated tests and all five offline Electron workflows passed. The desktop suite covers capture and filing, Plan and reporting, Oath fulfilment and Break, PDF and image sources, keyboard navigation, recovery, search across 1,000 notes and editing a long manuscript in two panes. The navigation workflow now checks that the keyboard-selected search result can be hit at its on-screen position.

Platform-specific visual sign-off on macOS remains open. Strict Oath platform verification remains a separate workstream.
