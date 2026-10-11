
The foundation of Itacan and Atlas will be built from Electron.

The reason for using Electron is because
- it is used by Obsidian, Notion, Discord, and basically most apps we use;
- it makes UI development easy;
- it inherently handles Markdown;
- it is cross-platform, meaning it supports Windows, macOS, Linux;
- AI is good with Electron since it is broadly used;
- Electron makes Atlas integration easy;
- good ecosystem for many things like reading PDFs;

Downsides of Electron
- Electron apps are use more RAM (acceptable for modern PCs);
- The security concern comes when handling Chromium and Node; 

We will have to decide whether to use TypeScript everywhere, backend + frontend; or to divide the job between two languages, TypeScript frontend + Rust backend. GPT recommends the latter choice.

The fundamental unit of information will be Markdown files.

Itacan will primarily be a file management application similar to Obsidian.

Atlas will be integrated inside the application similar to how Obsidian handles its webbrowser.

Electron has us chose between UI frameworks, we will probably use React instead of raw Javascript.

In summary,
> Electron + TypeScript + Svelte + Rust core (optional later) + Markdown files + SQLite index + Atlas as restricted browser module + No plugins initially + Local-first + AI as assistant, not owner


## Application structure

```text
Itacan
|
├── Electron
│   ├── Renderer — Svelte/React UI
│   ├── Main process
│   │   ├── window management
│   │   ├── Atlas
│   │   ├── Oath session coordinator
│   │   └── IPC
│   │
│   └── Electron kiosk layer
│       ├── fullscreen/kiosk
│       ├── disable close/minimize
│       ├── intercept Itacan shortcuts
│       └── renderer/main-process guards
│
├── Core
│   ├── Markdown/files
│   ├── SQLite index
│   ├── tasks/projects/resources
│   ├── Oath state
│   └── statistics/history
│
└── Native Enforcement Host
    ├── Windows adapter
    ├── macOS adapter
    └── Linux adapter
```

## Strict Oath architecture

Strict Oath should be split between Electron and a native enforcement host. Electron handles the visible kiosk experience: fullscreen, preventing normal close/minimize actions, intercepting Itacan-level shortcuts, and coordinating the Oath session. The native host handles OS-level restrictions that Electron cannot reliably enforce on its own.

The native enforcement host should therefore be treated as a required part of Strict Oath, even if a broader Rust application core remains optional. Rust is the preferred implementation because it can expose platform-specific Windows, macOS, and Linux adapters behind one interface.

Oath state must be persisted outside the renderer. The session is committed before lockdown begins, and normal release is allowed only when the Oath is fulfilled. If the user restarts, shuts down, or signs out while an Oath is active, the next launch records the Oath as broken and starts normally rather than restoring lockdown.

The intended boundary is: **no ordinary application-level escape, while OS session termination remains available**. Itacan should not attempt to defeat secure operating-system mechanisms such as Windows `Ctrl+Alt+Del`.

During development, Strict Oath should have a clearly isolated development-only bypass. It must not be registered in production builds, and use of it should be recorded separately from a genuinely broken Oath.

In summary,
> Electron + TypeScript + Svelte/React + Markdown files + SQLite index + Atlas + native enforcement host for Strict Oath (Rust recommended) + optional broader Rust core + local-first + no plugins initially + AI as assistant, not owner