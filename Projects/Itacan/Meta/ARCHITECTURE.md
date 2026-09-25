
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