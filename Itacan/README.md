# Itacan 0.4.0-internal.1

This internal development build brings research documents, workspace tasks, daily planning, Regular Oaths and progress reports into one offline desktop window. Home opens your Projects, Resources and saved document layouts.

## Open for development

Double-click **Open Itacan.app** in this folder in Finder, or **Open Itacan.cmd** in Explorer. The launcher starts the current source with the project's installed Electron runtime and development profile. Quit and reopen after editing code to rebuild. Opening it again while it is running brings the existing window forward.

On a fresh checkout, install dependencies once on the machine you are using, as described under **Run and build from source**. Keep the launcher in the Itacan folder. On macOS you can drag it to the Dock for one-click access.

## Open a library

Choose an empty folder to initialize a library, or select an existing Itacan library. To try the bundled example, choose **Try Field Library** and select where to create your copy. Itacan gives the copy a numbered name if Field Library already exists there. **Library guide** is available before choosing a folder. Open **Forest survey → Field notes.md** to try a local image, an equation and a link to a note in Literature.

A fresh profile opens maximized. Subsequent launches restore ordinary window size and position within the available display. Use the title bar to restore, resize or minimize it. **F11** toggles fullscreen. After setup, development use is offline. The library name in the navigation bar opens the folder picker. On the next launch, Home opens the last library used by the development profile.

## Everyday use

- **Documents and workspaces** — Open a Project or Resource from Home. The folder tree selects the directory shown alongside it. In the file list, click to select, double-click or press Enter to open, and use F2 to rename. New folders and notes are named in place. Create notes inside workspace folders. Right-click a row for file operations. Drag Project cards within their Home status group or use the ↕ handle shown when a top-level folder row is hovered or keyboard-focused to change its display order. Drag a folder name or selected file-list rows onto another folder to move them on disk. Dropping external files into a workspace folder copies them and preserves existing names by numbering collisions. Deletion uses the operating system's Trash or Recycle Bin, with a library Trash fallback.
- **Tabs and splits** — Opening a note uses the active pane. The file menu opens a new tab or splits the current pane right or below. Drag a tab onto a tab strip to set its position, into the center of another pane to join it, or to any pane edge to split. You can also drag a note from the rail. Middle-click a note to open it alongside the current pane. Close any tab with its × or a middle-click. Ctrl+W closes the active tab and Ctrl+Tab cycles tabs. A tab's context menu also offers placement and close commands. Drag a divider or focus it and use the arrow keys to resize. Escape cancels a divider drag. Multiple views share the same draft and Save operation.
- **Resume and presets** — **Workspace** returns to the folder browser. **Last File** resumes the most recent desk from Home or that workspace’s desk from Full view. Use **Presets → Save as new preset** to remember open tabs, the active pane, split sizes, explorer state and document positions. Use the ellipsis beside a preset to update or rename it. Drag a preset name or focus it and press Alt+Up or Alt+Down to change its order.
- **Editing** — Choose Read, Edit (source) or Live Preview. Idle autosave is the default. Use Save, Command+S or Ctrl+S for an immediate save, or choose manual saving in Settings. Multiple views share text and undo, with separate selections and scroll positions. If a file changes externally, a clean view reloads on revalidation and a dirty view offers recovery. Save a copy to retain competing edits.
- **Documents and search** — Read mode renders Markdown, TeX, local raster images and ordinary relative links. Live Preview reveals Markdown syntax around the caret. PDFs open in tabs with page, zoom and selectable text where the source has text. Images open with zoom and pan. Last File and presets restore mixed layouts. Missing tabs can be relinked. Search by filename, task or a line in a Markdown note. Manually authored Markdown links keep their literal paths when reorganizing files.
- **Resources** — Knowledge, Literature, Explorations and Inspiration are fixed workspaces. From a Project, choose **Attach Resource folder** to browse and edit its original files under the Project rail. The folder’s context menu can detach it while retaining its files. A legacy `Resources/Research/` directory appears as Literature with its physical path intact. If both folders exist, use **Other folders in Resources** to review the older one.
- **Calendar and tasks** — Home’s agenda includes start, planned, until and due dates. Create tasks in a workspace with an optional note or folder, steps and dates. New tasks appear unmarked. Use Should or Must when needed. Complete a recurring task to create one successor with reset steps. Expand Completed to review past work.
- **Quick Add and Inbox** — Open Quick Add with Ctrl+Shift+Space on Windows. Type text, or choose, paste or drop files. Enter sends text to Inbox and keeps Quick Add open. Shift+Enter inserts a line break. Closing retains the draft. In Inbox, choose a row to edit or file it. Ctrl-click or Shift-click to select compatible items for a common destination. Destination collisions retain the unresolved captures.
- **Daily Plan** — Use the Plan panel on Home. Choose tasks, documents and workspaces in one picker. Drag an entry or press Alt+Up or Alt+Down on its reorder control. Finish the plan to keep a snapshot. Hide the finished preview and choose **Show earlier plans** to read the history. Plan notes save as you type. The day boundary is the next midnight where the plan started. Reopening after that boundary archives it. History retains the original labels and routes and can open associated content that is still available.

- **Project planning and Oaths** — From a Project, open **Roadmap** for phases and dated milestones or **Today’s plan** for its daily entries. **The Oath** starts a Regular session scoped to a workspace and selected tasks. Set a duration, choose Until ended, or tie fulfilment to completing the selected tasks. Break Oath explicitly ends an unfinished commitment. History keeps the outcome. Strict remains platform-specific and unavailable in this internal build.
- **Settings and Music** — Set appearance, reading width, document mode, saving, keyboard bindings and period-specific Home covers for this library. **App shortcuts** opens configured websites or device-bound applications. **This device** can override a library binding. To hear local audio, enable the player under **Settings → Music**, then use **Music** to add tracks from the library, reorder, seek, adjust volume and control playback. Closing Music keeps the current track playing.
- **Progress** — Use **Log progress** to rate a Project or Resource from 0 to 4 and write a reflection. Add another workspace to the same report as needed. Expand **Recorded work** for evidence or **Current plan** to review that day's planning. On Home or in a workspace, choose a heatmap date to view or edit a report. History includes Reports, Activity, Tasks and Oaths. Home's **Statistics** opens the period and workspace filters. When you close after reading or recording new work, you can report, continue working or close without reporting.

## Library and backup

```text
Field Library/
  itacan-library.json
  itacan-work.json
  Inbox attachments/
  Trash/
  Projects/
    Forest survey/
      Field notes.md
      canopy.jpg
  Resources/
    Knowledge/
    Literature/Papers/Sampling protocol.md
    Explorations/
    Inspiration/
```

The work file appears on the first structured change. It stores tasks, text captures and attachment records, the active Plan, finished plans, workspace/day reports, timestamped activity, explorer preferences, last desks and named presets, shared folder references, Regular Oaths, project roadmaps, portable preferences and playlist order. Report evidence preserves the work visible when the report was saved. A newer edit of that report refreshes its evidence. Earlier standalone libraries acquire these fields as needed. Staged files live in **Inbox attachments** until filed or removed. **Trash** can retain deleted files if the system Trash is unavailable.

The marker identifies format `itacan-library`, version `2`. The upgrade from version 1 saves its prior metadata under `.itacan-recovery/before-format-2.json`. Earlier 0.3.2 clients refuse the newer marker. Original research files and workspace folder names stay intact. Use a separate copy for testing an upgrade. The first folder under Projects or Resources is the workspace. Its name and nested folders determine how it appears in the app. Notes are UTF-8 `.md` files. A note requires no frontmatter or generated ID. Ordinary saves retain a UTF-8 BOM and the document's LF or CRLF convention. Use relative links so the library can move. For a path containing spaces, write `[Protocol](<../Papers/Sampling protocol.md>)`.

Copy the entire library for a backup, or move it and choose its new location. Projects, Resources and all authored content travel together. The profile holds the last library path, local application bindings, device keyboard overrides, window geometry, audio volume and recovery drafts. The library’s portable records remain in its folder. OneDrive-backed folders work as ordinary local folders when their files are available on the device. Use one writer at a time across machines.

## Run and build from source

Use Node.js 24 or later with npm. Run these commands in the standalone `Itacan` directory.

```sh
npm ci
npm exec -- install-electron
npm start
```

Initial development setup downloads dependencies and the Electron runtime. Subsequent `npm run build` uses installed dependencies. `npm start` builds and opens the app. Use a normal Terminal or PowerShell session. If an IDE sets `ELECTRON_RUN_AS_NODE`, clear that variable before starting. Development uses its own last-library setting. Use **Try Field Library** for a writable development example.

In Windows PowerShell, use `npm.cmd` for these commands if the execution policy blocks `npm.ps1`. After setup, double-click **Open Itacan.cmd**. Quit and reopen it after a source edit to rebuild.

```sh
npm test
npm run test:desktop
```

The test supplies its own temporary library and profile.

[Source and dependency map](docs/architecture.md) · [Manual UI guide](docs/ui.md) · [Verification results](docs/verification.md)
