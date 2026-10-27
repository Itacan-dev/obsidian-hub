# Atlas foreign-owner startup recovery

Date: 2026-10-27. Baseline: `7ef6bd2`. The reported setup is a separate Git clone on the friend's computer, with Obsidian fully restarted.

## Confirmed causes

The screenshot reports `UNAVAILABLE / STORAGE_UNAVAILABLE / FOREIGN_OWNER`. This is a storage ownership failure, not a missing ChatGPT Whitelist entry.

Two independent issues explain why pulling the previous changes did not help:

- The preceding task prohibited deployment. Its repairs were committed as source, while tracked `main.js` and `atlas-native.cjs` still contained native API 4. Source expected API 5. Obsidian executes the bundles, so an ordinary pull did not activate those repairs.
- The existing recovery button only retries the same ownership check. A lock from another hostname is deliberately refused because Atlas cannot prove whether the former owner is stopped. The screen referred to authorizing a lock repair, but provided no such operation. “Open recovery” also targeted the normal diagnostics section inside a hidden shell when no verified snapshot existed.

`atlas-state/` is ignored and has no Git history. An ordinary pull did not introduce the foreign lock. The screenshot establishes its presence; it does not establish whether it came from an earlier copied folder, a machine rename or some other local operation. No live authority records were inspected to guess that history.

## Repair

The visible startup Diagnostics / Recovery panel now offers **Review storage ownership** for this specific failure. Review performs no storage mutation.

After review, **Use saved state on this computer** remains disabled until the user explicitly confirms that this is an independent local copy, or that Atlas is stopped on every other computer using the same saved files. Cancellation leaves the records unchanged. Ordinary Recover saved state and automatic transient-write recovery still cannot take over a foreign owner.

The native review is bound to exact owner, authority, initialized-sentinel and journal records using a single-use, process-held token with a five-minute expiry. Missing, changed, used, expired, corrupt or invalid records are rejected. Valid UTF-8 is required so “exact backup” cannot silently mean a lossy decoded copy. Locally live owners, interrupted/different reclaim records and incomplete initialized repositories do not enter this path.

On explicit approval the adapter:

1. Acquires the existing cooperative reclamation guard.
2. Saves and verifies original records under `atlas-state/ownership-backups/<review-id>/` before changing ownership.
3. Checks the reviewed records again and atomically replaces only the foreign owner lock.
4. Reopens the same Core controller. Core validates authority, reconciles an exact pending journal, persists required checkpoints, and ends lost Journey bindings before READY.

The original pending journal is preserved through ownership repair and settled through normal Core reconciliation. Policies, protected timings, destination labels/pins, frozen requests, grants and Vault candidates keep their terms. No confirmation, navigation request or POST body is replayed. Core's normal recovery can update its observation checkpoints and Journey state; this is not a policy reset.

A copied lock without any initialized authority leads to UNINITIALIZED and explicit first setup. Repair does not select a starter policy automatically. A failed cleanup can be completed only for this same instance's exact reclaim record; another claim is retained and remains blocked.

The UI now focuses and scrolls the visible startup recovery panel, explains foreign-owner recovery specifically, prevents duplicate submissions, and preserves unrelated session drafts. Successful recovery requires the user to navigate again deliberately.

## Runnable bundle handoff

The new source/native compatibility marker is 6. An older retained main-process service is rejected rather than being hot-swapped. Fully quit and reopen Obsidian after receiving updated bundles.

Two independent temporary builds produced identical `main.js` and `atlas-native.cjs`: 252 renderer modules and 27 native modules. New `lib/atlas/tests/check-runtime-bundles.cjs` rebuilds in an isolated temporary directory and compares the tracked executable bundles with current source. It reproduced the stale-bundle problem before replacement.

Bundle replacement status: **completed on 2026-10-27 with explicit user approval**. Both tracked executable bundles now match the tested/current source, and the bundle-parity check passes. Original bundle copies were retained in a temporary backup. No commit, push or live authority repair has been performed.

After these changes are committed and shared by the repository owner, the friend should:

1. Pull those changes, fully quit Obsidian, and reopen it.
2. Open Atlas Settings and choose **Review storage ownership**.
3. Confirm that this is his separate local copy and select **Use saved state on this computer**.
4. Reopen the destination deliberately after recovery. If the copy has no saved authority, complete explicit first setup instead.

Do not delete `authority.json`, `initialized` or `pending.json` to work around this failure.

## Verification

All authority tests used isolated temporary filesystem repositories. No live Atlas state was read, changed or reset.

| Command | Result |
| --- | --- |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/*.test.js` | 146 passed, 0 failed/skipped |
| `node --test .obsidian/plugins/hub-project-menu/lib/atlas/tests/ownership-recovery.test.js` | 26 new ownership regressions passed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/browser-launch.cjs` | 8 pages passed, 0 failed |
| `node .obsidian/plugins/hub-project-menu/lib/atlas/tests/native/launch.cjs` | 25 native scenarios passed, including expanded actual startup ownership UI |
| `node AtlasCore/packages/core/node_modules/typescript/bin/tsc -p .obsidian/plugins/hub-project-menu/lib/atlas/tsconfig.json` | Passed |
| `npm.cmd --prefix AtlasCore/packages/core run typecheck` | Passed |
| `git -c safe.directory=C:/Users/jinhao/OneDrive/obsidian-hub -c core.whitespace=cr-at-eol -c core.safecrlf=false diff --check` | Passed |

Regressions cover read-only review, ordinary recovery remaining blocked, unchecked attestation, cancellation, exact backups, policy/configuration/pin/request/grant/proposal preservation, Journey retirement, applied and unapplied journal resolution, replayed/expired/changed reviews, corrupt JSON/legacy metadata/UTF-8, external changes during backup, competing reclamation, corrupt backup readback, failed backup/owner rename, lost rename acknowledgement, interrupted reclaim cleanup and exact command fields.

The startup-specific browser fixture is now included in the default run. It previously existed but was omitted from the seven-page default suite, and still expected a raw commit ID intentionally removed by the prior repair. It now tests visible routing, truthful feedback and the complete confirmation lifecycle.

The native renderer fixture starts with a real foreign lock, clicks the actual review/confirmation controls, verifies its backup, confirms that no policy was implicitly initialized, and proceeds through existing setup/Greylist/Vault/native navigation tests. During development an old fixture assumption expected the initially closed guest to retain a destination assessment; it was corrected to require continued blocking and a fresh deliberate navigation after ownership recovery.

The prior task's broad Hub task-data fixture failure remains separately documented in [the storage report](Hub-atlas-storage-reliability-and-recovery.md); no unrelated task loader code was changed here.

## Changed files

Plugin paths are relative to `.obsidian/plugins/hub-project-menu/`.

| Files | Change |
| --- | --- |
| `lib/atlas/obsidian/ownership-recovery.js` | New explicit proof-bound backup/ownership repair |
| `lib/atlas/obsidian/persistence.js`, `runtime.js` | Repository integration, exact command boundary and same-controller reconciliation |
| `lib/atlas/obsidian/settings-ui.js`, `feedback.js` | Actionable startup review, visible focus and truthful outcomes |
| `lib/atlas/obsidian/native.js`, `integration.js` | Main/renderer API 6 compatibility |
| `lib/atlas/tests/ownership-recovery.test.js` | 26 real-filesystem regressions |
| `lib/tests/atlas-initialization.html`, `lib/atlas/tests/native/browser-runner.cjs` | Startup coverage included by default |
| `lib/atlas/tests/native/renderer-fixture.cjs` | Actual native startup repair and retained-version rejection |
| `lib/atlas/tests/check-runtime-bundles.cjs` | Detect executable/source mismatches before sharing |
| `lib/atlas/tests/ownership-recovery-results.json` | Build and validation evidence |
| `main.js`, `atlas-native.cjs` | Replaced with tested runnable API 6 bundles after explicit approval |
| `System/Hub-atlas-foreign-owner-recovery.md` | This report |

Core, Firefox, presets and live saved data remain unchanged. This operation is intended for an independent local copy or a genuinely stopped former owner. It cannot verify a remote computer's shutdown and does not make simultaneous OneDrive writers safe. Moving ongoing authority to a device-local storage boundary remains a separate architectural follow-up.
