# Itacan 0.2.0

Itacan brings Markdown documents, workspace tasks, Inbox and a daily Plan into one offline desktop window. Home opens your Projects, Resources and saved document layouts.

## Open for development

Double-click **Open Itacan.app** in this folder in Finder, or **Open Itacan.cmd** in Explorer. The launcher starts the current source with the project's installed Electron runtime and development profile. Quit and reopen after editing code to rebuild. Opening it again while it is running brings the existing window forward.

On a fresh checkout, install dependencies once on the machine you are using, as described under **Run and build from source**. Keep the launcher in the Itacan folder. On macOS you can drag it to the Dock for one-click access.

## Install and open a library

- **Mac with Apple silicon** — Extract `release/Itacan-0.2.0-darwin-arm64.zip` to a local disk. Move `Itacan.app` to Applications or your personal Applications folder and open it. This personal build uses an ad-hoc signature.
- **Windows x64** — Extract `release/Itacan-0.2.0-win32-x64.zip` to a local disk. Keep the extracted folder together and open `Itacan.exe`. This personal build is unsigned.
- Choose an empty folder to initialize a library, or select an existing Itacan library. To try sample content, copy [Field Library](<examples/Field Library>) somewhere writable and choose that copy. Open **Forest survey → Field notes.md** to try a local image, an equation and a link to a note in Research.

Both packages include Electron, typography, the editor and the math renderer. Installed use is offline. The library name at the top right opens the folder picker. On the next launch, Home opens the last library used by that installation.

## Everyday use

- **Documents and workspaces** — Create a project from Home. Open a workspace to create a folder or note. Use **Manage** beside an item to rename, move or delete it. A deletion goes to the operating system's Trash or Recycle Bin, with a library Trash fallback. While reading, the contextual tree opens neighboring notes, subfolders and supported attachments.
- **Tabs and splits** — Open notes from the tree or an internal link. **Split view** opens another view of the active document. Click inside a pane to make it the destination for the next note. Both views share unsaved text. **Resume documents** on Home reopens the last layout. **Save layout** records tabs, active documents and modes under a name on Home.
- **Editing** — Save with **Save** or **⌘S / Ctrl+S**. Ordinary navigation retains drafts. Closing a document's last tab, replacing its layout, changing libraries or quitting offers Save, Discard and Cancel when needed. **Save a copy** preserves a draft after an external edit. For a clean reload from disk, close that document's tabs and reopen it. A forced quit can lose unsaved work.
- **Markdown** — Read mode supports Markdown, TeX, relative note links, heading fragments, local raster images and relative wiki links such as `[[Sampling protocol#Method|Method]]`. Images and PDFs open in the operating system's associated viewer. Manually authored links use their literal paths. Adjust them yourself after reorganizing linked notes.
- **Tasks** — Create a task from a workspace or Home. Choose a Project or Resource, an optional note or folder, steps, dates, times and importance. Completing a daily or weekly recurring task creates its next occurrence once and resets its steps. Reopen or edit a completed task using **Show tasks → Completed**.
- **Quick Add and Inbox** — Send text or local files to Inbox. Text can become a task, create a note, or append to an existing note. The append includes the open note's current draft. Use Inbox to filter and sort captures, file attachments and remove items. Destination name collisions retain the original capture.
- **Daily Plan** — Start today's plan, add tasks, notes, Projects or Resources, and use Up and Down to order them. Open an entry to work on its source. Save accompanying notes or close the dialog to keep them. **Finish plan** archives the entries and notes. Opening Home or Plan on a later day archives the previous day's active plan.

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
    Research/Papers/Sampling protocol.md
    Explorations/
    Inspiration/
```

The work file appears on the first structured change. It stores tasks, text captures and attachment records, the active Plan, daily history, the last layout and named presets. Staged files live in **Inbox attachments** until filed or removed. **Trash** can retain deleted files if the system Trash is unavailable.

The marker identifies format `itacan-library`, version `1`. The first folder under Projects or Resources is the workspace. Its name and nested folders determine how it appears in the app. Notes are UTF-8 `.md` files. A note requires no frontmatter or generated ID. Ordinary saves retain a UTF-8 BOM and the document's LF or CRLF convention. Use relative links so the library can move. For a path containing spaces, write `[Protocol](<../Papers/Sampling protocol.md>)`.

Copy the entire library for a backup, or move it and choose its new location. Projects, Resources and all authored content travel together. Only the last-library path is stored in the app profile's `settings.json`. OneDrive-backed folders work as ordinary local folders when their files are available on the device. Use one writer at a time across machines.

## Run and build from source

Use Node.js 24 or later with npm. Run these commands in the standalone `Itacan` directory.

```sh
npm ci
npm exec -- install-electron
npm start
```

Initial development setup downloads dependencies and the Electron runtime. Subsequent `npm run build` uses installed dependencies. `npm start` builds and opens the app. Use a normal Terminal or PowerShell session. If an IDE sets `ELECTRON_RUN_AS_NODE`, clear that variable before starting. Development uses its own last-library setting. Select a copy of the sample library for development.

```sh
npm test
npm run test:desktop
npm run package -- darwin arm64
npm run package -- win32 x64
```

Build the Mac archive on macOS. The two commands package the same application code and write ZIPs to `release/`. Packaging needs the matching Electron runtime archive on its first run. A cached archive is verified using checksums included with the pinned Electron npm package. Set `ELECTRON_CACHE` to reuse a specific archive cache. To run the desktop smoke test against an extracted package, set `ITACAN_TEST_EXECUTABLE` to its executable first. The test supplies its own temporary library and profile.

[Source and dependency map](docs/architecture.md) · [Manual UI guide](docs/ui.md) · [Verification results](docs/verification.md)
