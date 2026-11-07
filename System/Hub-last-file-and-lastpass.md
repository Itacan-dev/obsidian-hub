# Last File restoration and LastPass feasibility

Verified 2026-11-07 on Windows, installed Obsidian 1.15.0 / Electron 39.8.3, using isolated temporary profiles and vaults.

## Last File correction

Both restoration paths contributed. Hub could replace its last-file reference with a pathless browser entry. Separately, Obsidian persists floating windows, and Hub's native `changeLayout` call carried those windows into note restoration.

Last File now records and resolves actual vault files. Old pathless browser entries are skipped. Footer-created ChatGPT, Overleaf and Atlas views carry a `hubUtility` ownership marker through the existing webviewer state adapter; ordinary updates to that view retain ownership. Those views are excluded from Hub note snapshots and active-note selection. Full note-layout restoration removes only marked utility views from the floating layout, preserving unrelated tabs and windows, including ordinary browsers with the same URL.

On normal quit, the integration detaches only owned utility views and flushes the resulting layout with `requestSaveLayout`. This uses Obsidian's public quit task and layout APIs; it does not patch the workspace serializer or replace its persistence system. No supported per-window opt-out from native restoration was found. Obsidian documents quit handling as best effort, so abrupt termination/crash recovery is not guaranteed. [Obsidian API](https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts)

Close utility pop-outs already open under the previous build once, then restart Obsidian to load the rebuilt plugin. Old unmarked windows cannot safely be distinguished from ordinary user-created windows by URL alone.

There is no separate startup “Open last file” toggle in the inspected Hub code. Verification covers native restart with a saved note workspace and invoking Last File immediately afterward.

## Verification

- Focused navigation and Atlas Node suite: **155/155 passed**.
- Full Hub Node suite: **87/88 passed**. The unchanged typography test rejects the existing `.hub-task-operation-status` size `var(--font-ui-smaller)`; this unrelated failure remains.
- Installed Obsidian fixture: note → each shortcut → Last File → close; ordinary webview state updates; switching between notes; multiple utilities followed by full layout restoration; normal quit and restart. The note remains the last file, marked utilities do not reopen, unrelated note/browser windows survive, and Atlas is READY with unchanged policy/revision.
- Existing native pop-out fixture: **11 groups passed**, including Blacklist redirect denial before network delivery, blocked website popups, bounded Journey redirects, explicit Access confirmation, and preservation of the shared controller after windows close.

Reproduce with `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/popout-installed.cjs --last-file`; omit the flag for the native Atlas regression. Fixtures create their own temporary vault/profile. The final successful runs were `hub-popout-installed-VAUqLK` and `hub-popout-installed-osUG5k` under the Windows temporary directory; each retains `result.json`, with the restart run also retaining `closed-workspace.json`. Tests did not authenticate to ChatGPT, Overleaf or LastPass.

## LastPass assessment

**Local inspection:** Hub uses Obsidian's built-in `webviewer` in native pop-out leaves, backed by Electron webviews. Guests share the vault's persistent partition from `app.getWebviewPartition()`. The fixture reported `persist:vault-popoutfixture` with no loaded extensions. This checks the fixture environment, not the user's LastPass account or browser installation.

| Question | Finding |
| --- | --- |
| Supported directly? | No verified, supported LastPass integration in the current Hub. LastPass documents installing its extension into a browser; that does not establish Obsidian support. [LastPass instructions](https://community.lastpass.com/kb/articles/39-install-and-log-in-to-the-lastpass-browser-extension%EF%BB%BF) |
| Does Electron provide enough? | Not established. Electron implements only part of Chrome's extension API and explicitly does not support arbitrary store extensions. Its extension loader accepts unpacked directories and requires loading each run. API presence cannot establish that LastPass's complete requirements are met. [Extension support](https://www.electronjs.org/docs/latest/api/extensions), [loader API](https://www.electronjs.org/docs/latest/api/extensions-api) |
| Possible with limitations? | LastPass's Windows desktop app offers QuickFill Companion for desktop applications. The vendor announcement does not confirm Obsidian/Electron webview compatibility. It remains an untested, vendor-managed option, not a demonstrated Hub integration. [LastPass announcement](https://community.lastpass.com/discussion/2145/meet-your-new-lastpass-for-windows-desktop-app) |
| Not recommended? | Unpacking an extension, emulating missing browser APIs, adding a credential bridge, or modifying Obsidian internals would exceed demonstrated support and this task's scope. No such changes were made. |

**Security:** The existing native guest configuration disables Node integration, enables sandboxing/context isolation, and removes guest preload scripts. However, Obsidian plugins themselves are privileged; Atlas navigation enforcement is not a credential-isolation boundary against host plugins. Any future password integration needs a separate review of permissions, session ownership and the host trust boundary. AtlasCore, its native navigation guard and its policy logic were unchanged.

**Recommendation:** Keep the current prototype's webviews without built-in LastPass autofill. For supported LastPass use, open the website in an external browser with its official extension. That browser has a separate session: logging in there does not log the Hub webview in, and this Obsidian Atlas adapter does not enforce that external browser. No external fallback was added. For later Itacan, prefer a vendor-supported browser/OS authentication flow and establish support and isolation before considering an integration. No extension was installed, and no passwords were read, injected, stored, copied or logged. LastPass autofill and QuickFill were not runtime-tested.
