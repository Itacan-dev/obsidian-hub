# Atlas–Obsidian Milestone 3 — Performance, Rendering Stability, and Visual Coherence

Date: 2026-10-16. Active repository: `C:\Users\jinhao\OneDrive\obsidian-hub`. Starting point: HEAD `91132b8` plus the existing uncommitted Milestones 1 and 2. The configured Desktop checkout is absent. Earlier milestone work is preserved. No commits or pushes were made.

## Executive summary

Atlas now derives immutable presentation data without running the complete Core planner separately for each displayed hostname. Unchanged observations do not repeatedly publish the same presentation, identical transport reads reuse encoded JSON, and renderer commands avoid a second notification when the native notification already supplied their state.

Home cards, Sites rows, Managed Lists inputs, request rows, diagnostics and access buttons retain their DOM identity during unrelated updates. Vault compares explicit proposal fields, preserving its review when Core normalizes object-field order. Local edit-session housekeeping does not move focus.

Atlas retains its paper/olive branding while sharing Hub's type scale and interface typography. It now has explicit light/dark palettes, stronger control boundaries, semantic state styling, container-aware Home/forms, visible keyboard focus, horizontal section-tab navigation and restrained phase announcements.

Core authorization, native navigation checks and persistence checkpoints remain authoritative and unchanged.

## Measurement method and baseline

Fresh measurements were captured before modifying production source. Milestone 2 source was archived at `C:\Users\jinhao\AppData\Local\Temp\atlas-m3-baseline-a17zYy`. The final comparison runs the same instrumented harness against that source and the current implementation.

The repeatable harness is `lib/atlas/tests/performance-benchmark.cjs`, relative to the plugin. Durable raw evidence is in [performance-results.json](../.obsidian/plugins/hub-project-menu/lib/atlas/tests/performance-results.json).

Runtime measurements use Node v24.19.0 on Windows, synthetic 32/64/128/256-host policies, isolated temporary filesystem repositories and an injected clock. Each size has a cold read, two warmups, seven warm samples and seven repeated transport reads. Instrumentation counts actual planner calls, snapshot validations and filesystem operations. Event-loop evidence is the delay of one scheduled `setImmediate` while executing one description read; it is not a long-running latency histogram.

Observation scenarios use 32 destinations and zero, one or four attached runtime contexts, plus Vault/access countdowns. Three one-second clock advances are measured without including real waiting time. Browser-context effects in this benchmark are stubs; real Electron guests are exercised separately by the native suite. No user authorization store, account or live provider was used.

### Description generation

Times are milliseconds.

| Destinations | Before cold | After cold | Before warm mean | After warm mean |
| --- | ---: | ---: | ---: | ---: |
| 32 | 11.617 | 0.736 | 8.076 | 0.015 |
| 64 | 29.030 | 0.536 | 28.703 | 0.022 |
| 128 | 110.977 | 0.994 | 110.304 | 0.027 |
| 256 | 433.022 | 1.792 | 432.705 | 0.100 |

At 128/256 destinations, the old warm description performs 256/512 planner calls and 257/513 full snapshot validations per read. The new warm presentation read performs zero of either. Authoritative controller operations retain their validation; these counts apply only to descriptions.

### Serialization and event-loop work

| Destinations | Raw JSON mean, before → after | Repeated description+transport mean, before → after | Event-loop turn, before → after |
| --- | ---: | ---: | ---: |
| 32 | 0.057 → 0.033 | 7.927 → 0.032 | 7.785 → 0.089 |
| 64 | 0.064 → 0.055 | 28.660 → 0.017 | 28.207 → 0.042 |
| 128 | 0.142 → 0.096 | 108.834 → 0.028 | 108.608 → 0.059 |
| 256 | 0.338 → 0.316 | 429.377 → 0.066 | 430.222 → 0.353 |

Raw JSON serialization cost is broadly unchanged. The improvement comes from efficient derivation and avoiding repeated encoding: seven identical transport reads encode seven times before and zero times after a warm cached read. Payload sizes remain the same: 20,978 / 39,762 / 77,610 / 154,026 bytes.

### Observation and storage work

The work durations below include a subscriber reading/serializing each publication. Counts cover three observations.

| Scenario | Work ms, before → after | Publications, before → after | Reads, before and after |
| --- | ---: | ---: | ---: |
| Idle, no tabs | 46.139 → 23.767 | 3 → 0 | 54 |
| One tab | 51.538 → 28.683 | 3 → 0 | 69 |
| Four tabs | 68.851 → 43.351 | 3 → 0 | 114 |
| Vault countdown | 51.671 → 23.823 | 3 → 2 | 54 |
| Access countdown | 51.009 → 27.458 | 3 → 2 | 69 |

Every row retains **six writes, six file fsyncs and three atomic renames**, exactly as before. Waiting-to-ready and ready-to-expired boundaries still publish. Ordinary elapsed-time bookkeeping does not.

These are controlled adapter measurements on temporary local storage, not measurements of OneDrive latency or the complete live application's idle CPU.

### Renderer measurements

The browser benchmark uses 32 destinations and five Managed Lists status updates, with intentional 20 ms settling waits.

| Measurement | Before | After |
| --- | ---: | ---: |
| Managed update child/text mutation records | 115 | 11 |
| Lookup input, focus and selection retained | No | Yes |
| Unrelated Home card, focus and open disclosure retained | No | Yes |
| Five updates including settling waits | 149.8 ms | 147.1 ms |
| Ten fresh Settings constructions/disposals | 64.1 ms | 110.3 ms |

Full form construction is slightly more expensive, about 6.4 → 11.0 ms per mount in this fixture. Extra stable controls, accessibility state and scroll capture account for work that was absent before. This is not claimed as a mount-time speedup. Retained components avoid repeating that construction during status updates. The deliberate waits dominate the five-update wall time; the useful improvement there is state preservation and fewer mutations.

To repeat the runtime comparison now:

```powershell
node .obsidian/plugins/hub-project-menu/lib/atlas/tests/performance-benchmark.cjs 'C:\Users\jinhao\AppData\Local\Temp\atlas-m3-baseline-a17zYy\lib\atlas'
node .obsidian/plugins/hub-project-menu/lib/atlas/tests/performance-benchmark.cjs
```

The optional `ATLAS_PERF_OUTPUT` environment variable writes UTF-8 JSON. The browser runner's test-only `ATLAS_BROWSER_FIXTURE_DIR` can point at the archived `lib/tests` directory; `HUB_TEST_PREVIEW=baseline` records the baseline without applying new stability expectations to old source. Current regression mode is the default.

## Description and update architecture

`presentation.js` projects only controller-validated data into display decisions. It indexes exact manual hosts and existing scoped request/grant records, preserves Blacklist/Whitelist/managed precedence, and derives waiting/readiness/expiry labels. Descriptions have no Journey binding and cannot create a Journey.

The cache explicitly accounts for policy and configuration values/revisions, application metadata including pending/recovery data, request/grant contents and time phases, enabled/authority status, clock validity and compiled managed-list identity. Invalid or rolled-back presentation time and unavailable managed authority cannot retain a permissive description. Startup curated descriptions are derived once. Application metadata is reused only for the controller's verified storage version.

These objects are immutable presentation data. No cached decision enters native release, lease establishment, `controller.handle` or a policy transition. Core and native browser operations still sample current policy, time, storage, revisions, contexts and managed authority independently.

Runtime publication is coalesced at the end of an existing serialized operation; browser-close and lease effects remain immediate. The semantic publication key includes policy/configuration, proposals, recovery, requests/grants, Journeys, contexts and phase transitions. It excludes only persistence checkpoint bookkeeping such as unchanged observed timestamps/storage tokens.

Native JSON caching still invalidates on actual storage version, status, context, managed state and derived description changes. It does not replace current snapshot reads with an old snapshot. The renderer compares encoded descriptions before parsing/notifying and avoids a duplicate refresh after a command whose native notification already supplied the same result.

Document mutation handling examines added element subtrees and tracked webview identities. Countdown text no longer triggers a full-document guest query. Existing lifecycle hooks and the 500 ms fallback discovery scan remain; security enforcement continues in the native service. Removed guests lose their listeners, and observers/listeners are disposed with the integration.

## Rendering stability

A small local keyed-list helper updates Atlas-owned children without introducing a framework.

- Home destination cards and groups update their labels and host entry points independently. Filtering hides retained cards. Pending rows and their overflow disclosure survive phase updates.
- Sites rows retain identity across filters and unrelated revisions. Actions resolve the latest committed record at activation, preserving Milestone 1's stale-base protections.
- Managed Lists updates status/source text without replacing lookup input, typed hostname, caret, result or disclosure.
- Diagnostics updates existing text/journey rows and preserves its technical-details disclosure.
- Temporary Access keeps independent grant/request/context rows. Existing Cancel buttons survive readiness changes; expired or mismatched confirmation controls are removed.
- Vault keeps its diff and controls through readiness updates and harmless Core object-field reordering. Real operation/revision changes still update review state. Rebuilds retain scroll/disclosure state where applicable.
- Section navigation retains scroll. The running edit session also captures Settings/section scroll for remounting. Destination and timing drafts retain their previous ownership and conflict/recovery rules.

Actual browser assertions cover focus, selection ranges, element identity, search text, scroll, disclosures, concurrent Core policy commits and correct phase-dependent controls. Keeping an element mounted never keeps its obsolete permission state usable.

## Visual and responsive layout

The scoped Atlas contract uses Hub's existing semantic sizes and native interface face. The Atlas Home wordmark retains its serif branding. Security-relevant hosts, help, review terms and pending text use the body size rather than the small metadata size.

Light appearance retains paper/olive colors. Dark appearance uses explicit compatible surface/control/text colors. Textual labels distinguish Whitelist, Greylist, Blacklist, waiting, ready, expired, grants, proposals and unresolved/error/success feedback; colors supplement these labels. Unresolved feedback also uses a dashed boundary.

Home responds to its own container width. Its search/actions reflow and cards avoid a fixed minimum wider than the available space. Settings retains the canonical Hub rail plus horizontal Atlas section tabs. Narrow forms and host controls reflow within the Atlas container. Long hostnames wrap, buttons have usable targets, and the existing whole-section Vault scroll fallback remains.

Measured native-theme contrast:

| Appearance | Input text/control | Secondary text/surface | Unfocused control border/control |
| --- | ---: | ---: | ---: |
| Light | 12.44:1 | 6.14:1 | 3.43:1 |
| Dark | 11.26:1 | 8.42:1 | 4.25:1 |

Error, warning, success and unresolved text are also asserted at ≥4.5:1 in both appearances. These are component measurements, not an accessibility certification for the entire application.

## Keyboard, focus and announcements

Atlas sections now have linked tab/tabpanel semantics and a roving tab stop. Left/Right arrows and Home/End select sections and retain visible focus. Explicit section changes reveal their tab in the horizontal strip; background updates do not scroll that navigation.

Explicit Note-scoped Home launching focuses its search after revealing/creating the native leaf. Background mounting/publication leaves note focus alone. Shared Settings opener restoration remains intact. Local session `changed` notifications are distinguished from explicit route navigation, preventing draft housekeeping from focusing a section.

Synchronous route buttons remain enabled through their focus handoff. Asynchronous actions retain busy/double-click guards. Phase announcers update when an item's identity/phase changes; countdowns are separate and not live-announced every tick. No global shortcut was added.

## Security and persistence review

Unchanged guarantees include exact hosts, default deny, manual Blacklist precedence, managed-list enforcement, full Greylist/Vault waits, explicit confirmation, immutable proposals, current revision validation, fixed Access Grant lifetimes, bounded context-specific Journeys, native interception and verified persistence before active publication.

Milestone 1's durable proposal-copy lifecycle, failure injection and explicit recovery remain functional. Milestone 2's single Settings owner, session-only drafts, dirty replacement guard, direct operation routes and Note ownership restrictions remain functional.

Optimizations deliberately rejected:

- Removing/debouncing controller observation or checkpoint writes merely to reduce I/O: those protect time floors, rollback detection, expiry and recovery.
- Caching executable ALLOW decisions, skipping controller loads/validation, trusting file mtime, or replacing native retention checks with renderer state.
- Hot-swapping the retained main-process controller or its uncertain-commit guards.
- A general rendering framework, permanent navigation panel, full batching or new popup/download authorization.

Core source, native webviewer enforcement, managed service semantics and persistence/journal/CAS/atomic replacement were not modified in this milestone. Main and renderer retain compatible API version 4; no transport command/schema changed.

Fully quit and reopen Obsidian to load the rebuilt native implementation. Reloading only the renderer intentionally retains an already-loaded main-process service.

## Files changed

Paths below are relative to `.obsidian/plugins/hub-project-menu/`.

| Files | Responsibility |
| --- | --- |
| `lib/atlas/obsidian/presentation.js` | New immutable display projection, semantic publication key and JSON reuse |
| `lib/atlas/obsidian/runtime.js`, `native.js` | Version-bound metadata reuse, batched semantic publication and native transport cache |
| `lib/atlas/obsidian/dom.js` | New small keyed DOM/text/phase-announcement helpers |
| `lib/atlas/obsidian/home-ui.js` | Retained cards, grants, pending rows and disclosures |
| `lib/atlas/obsidian/settings-ui.js`, `ui.js` | Stable controls, phase actions, review state, keyboard semantics and focus |
| `lib/atlas/obsidian/integration.js`, `session.js` | Deduplicated delivery, narrow guest discovery, explicit Home focus and local scroll/navigation state |
| `styles.css` | Atlas-only visual, contrast, focus and container layout contract |
| `lib/atlas/tests/performance{.test.js,-benchmark.cjs,-results.json}` | Eleven safety regressions, repeatable measurements and raw results |
| `lib/tests/atlas-rendering.html` | New measured rendering/caret/scroll/concurrent-state/keyboard fixture |
| `lib/atlas/tests/native/quality-renderer.cjs` | Actual-theme narrow-container, contrast and native-keyboard checks |
| `lib/atlas/tests/native/{browser-runner,milestone-renderer,renderer-fixture}.cjs` | Seventh browser fixture, expanded theme matrix and integration regressions |
| `lib/tests/{atlas-product,settings}.html` | Visible filtering assertions and explicit helper dependency |
| `main.js`, `atlas-native.cjs` | Rebuilt production bundles |

The combined working tree also contains the preserved earlier milestone changes; this table describes Milestone 3.

## Tests and validation

| Command | Final result |
| --- | --- |
| `node --test AtlasCore/packages/core/tests/*.test.mjs` | 191 passed, 0 failed |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js` | 93 passed, 0 failed; all 82 earlier tests plus 11 new performance-safety tests |
| `node --test .obsidian/plugins/hub-project-menu/lib/tests/*.test.js` | 90 passed, 0 failed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/launch.cjs` | 22 passed, with expanded renderer/quality assertions |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs` | 7 passed, 0 failed |
| `node AtlasCore/packages/core/node_modules/typescript/bin/tsc -p .obsidian/plugins/hub-project-menu/lib/atlas/tsconfig.json` | Passed |
| `npm.cmd --prefix AtlasCore/packages/core run typecheck` | Passed |
| `git -c safe.directory=C:/Users/jinhao/OneDrive/obsidian-hub -c core.whitespace=cr-at-eol -c core.safecrlf=false diff --check` | Passed |

New Node regressions compare projected descriptions against fresh Core plans for exact scopes, precedence and deadlines. They cover immutable cached values, display/configuration changes, managed identity, invalid time, waiting/ready/expired publication, preserved time-checkpoint writes, stale cached ALLOW after disk replacement, grant expiry, uncertain writes and durable recovery-copy creation/discard.

Browser fixtures verify that real concurrent Core commits preserve the local editor, that pending/request/Vault phases update without replacing unrelated controls, and that session housekeeping does not steal focus. Subscription disposal remains balanced.

Native tests use Electron 39.8.3 / Chromium 142.0.7444.265 and installed Obsidian 1.14.4 CSS. They retain all browser-boundary, expiry, revocation, managed/Blacklist, multi-window, recovery and Note-launch regressions. Layout coverage includes 800×900, 800×500, 800×400, a 420×360 embedded pane in a wider window, 150% zoom, long descriptions and a 300-host Vault diff. Additional light-theme short/embedded layouts and light/dark 420 px forms/Home checks assert actual bounds, hit tests, contrast and keyboard access. Countdown text mutations are asserted not to query all document guests.

Existing visible-result assertions were updated to select visible filtered rows/cards because filtered elements are now retained. Native short test timing remains explicit and frozen; an enabled Confirm must be at/after readiness, and expiry still requires explicit recreation with a new full wait.

The production build used:

```powershell
node .obsidian/plugins/hub-project-menu/build.js --output-dir 'C:\Users\jinhao\AppData\Local\Temp\atlas-m3-release-105e8988127a48b79632b0447c9847da'
```

Only `main.js` and `atlas-native.cjs` were copied into the plugin. A fresh independent build at `C:\Users\jinhao\AppData\Local\Temp\atlas-m3-independent-z6gS6S` matches both byte for byte: 149 renderer modules and 25 native modules.

| Bundle | SHA-256 |
| --- | --- |
| `main.js` | `4f8942bbea06bb32f7cddf8d0e0cb03a017a619a59002e755251740945f12ea5` |
| `atlas-native.cjs` | `dcb17a43b420ddfa981b1ab9add6e91265dc71a6646541a163fe9e83e856c538` |

## Limitations and Milestone 4

The performance numbers demonstrate controlled source-level improvements, not complete live Obsidian/provider performance. General Core observation and synchronous persistence costs remain. Fresh Settings reconstruction is more expensive than before; routine status updates preserve its controls instead. Checkpoint-only storage-version changes are not continuously published to presentation, so technical diagnostics reflect the last delivered description until another read/update.

Tests use fixture workspace/modal/Note/PDF objects plus real Electron guests and actual installed CSS. A walkthrough inside the user's running Obsidian, authenticated SSO/providers, complete live popout lifecycle, custom-theme combinations and assistive-technology behavior were not verified. Physical power loss and cross-device OneDrive interruption were not tested. Ordinary drafts remain renderer-session-only.

Recommend Milestone 4 first exercise combined live Note/PDF/popout, keyboard and authenticated-provider workflows, then address F13's manual versus effective/usable access explanations and F14's explanations for blocked popup/download actions. Keep any new popup/download capability or full batch editing separately scoped. Investigate further persistence/observation reduction only with an explicit consistency and recovery design.
