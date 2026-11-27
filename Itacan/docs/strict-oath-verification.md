# Strict Oath feasibility on Windows

The internal standalone build offers Regular Oaths. It rejects a request to start a Strict session. The established Strict terms, host and development recovery remain in the Hub prototype. A standalone port requires its own physical desktop and independent recovery checks before enabling that capability.

On 27 November 2026, 51 assertions registered as Node tests passed on the Windows development machine. The fixtures used injected windows, process observations, clocks and recovery handlers. They exercised no restrictions on the developer’s desktop.

| Fixtures under the Hub plugin tests | Checks |
|---|---|
| `oath-preflight.test.cjs`, `oath-phase5.test.cjs`, `oath-prototype.test.cjs` | 41 tests covering frozen permissions, limits of window observations, interrupted recovery, one window owner, failed restore and retry, shortcut self-test, and independent watchdog release |
| `oath-reminder/state.test.cjs`, `oath-reminder/integration.test.cjs` | 10 tests covering version-4 foreground persistence, transitions through unknown observations, a centered reminder that leaves focus alone, permitted-window return, and cleanup |

The reference implementation separates its [terms and policy](../../.obsidian/plugins/hub-project-menu/lib/domain/oath-strict.js), [Electron host](../../.obsidian/plugins/hub-project-menu/lib/services/oath-strict-host.js), and [development recovery helper](../../.obsidian/plugins/hub-project-menu/lib/services/oath-prototype-host.js). The installed prototype’s independent recovery window, locally focused emergency shortcut and two-minute development watchdog are documented in the [November recovery report](../../System/Hub-oath-prototype-recovery.md).

Before exposing Strict on Windows, verify the reference consent and preflight flow using a disposable profile on a designated physical desktop. Exercise sanctioned and unknown windows, multi-display and sleep/resume, renderer loss, interruption, and restoration of the original window bounds. Verify that the independent release path still works when the application renderer fails. Record OS, display configuration, executable and outcome. macOS and Linux require separate physical capability checks.
