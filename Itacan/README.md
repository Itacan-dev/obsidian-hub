# Itacan

Itacan opens a personal library of Markdown documents in a single desktop window. Home leads to Projects and Resources. Each workspace has its own folder listing, and each note has Read and Edit modes.

## Install and open a library

- **Mac with Apple silicon** — Extract `release/Itacan-0.1.0-darwin-arm64.zip` to a local disk. Move `Itacan.app` to Applications or your personal Applications folder and open it. This personal build uses an ad-hoc signature.
- **Windows x64** — Extract `release/Itacan-0.1.0-win32-x64.zip` to a local disk. Keep the extracted folder together and open `Itacan.exe`. This personal build is unsigned.
- Choose an empty folder to initialize a library, or select an existing Itacan library. To try sample content, copy [Field Library](<examples/Field Library>) somewhere writable and choose that copy. Open **Forest survey → Field notes.md** to try a local image, an equation and a link to a note in Research.

Both packages include Electron, typography, the editor and the math renderer. Installed use is offline. The library name at the top right opens the folder picker. On the next launch, Home opens the last library used by that installation.

## Everyday use

Create a project on Home. Open a Project or Resource to create a folder or Markdown note. The breadcrumbs return to a parent folder or Home. Add existing files with Finder or Explorer. Reopen the folder to refresh its listing.

Use **Edit**, then **Save** or **⌘S / Ctrl+S**. Leaving a changed note or closing the window offers Save, Discard and Cancel. If someone edits the same file on disk, **Save a copy** keeps your draft beside it. Saving is explicit. A forced process termination can lose edits since the last save.

Read mode supports ordinary Markdown, inline and block TeX with dollar delimiters, relative note links, heading fragments and local raster images. PDFs and images can open in their associated desktop viewer. Clicking a web link opens the system browser.

## Library and backup

```text
Field Library/
  itacan-library.json
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

[Architecture and incremental product overview](docs/architecture.md) · [Manual UI guide](docs/ui.md) · [Verification results](docs/verification.md)
