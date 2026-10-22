# Milestone 1F ? controlled native cutover preparation

**Ready for one final execution approval; no real cutover performed.** Pulsed Optomechanics only, UUID `70927a62-591c-4df9-81a1-27585c903563`. Native tasks start empty; there is no automated recreation or legacy History import.

## Implementation

Permanent admission is a separate `device-private-project` scope. The registered vault, existing localStorage device identity, fixed selected Project UUID and hashed LocalAppData path are validated. Creation requires the atomic capability and one private Project partition; permanent writers require retained requests. Another owner, partition, synthetic permit, cloud/vault/Git path or conflicting root is rejected. Generation, codec, domain, command, receipt and recovery implementations are unchanged.

Ordinary onload reads only the external owner cutover record when present. Absent evidence keeps Legacy as default without opening a native repository. An existing incomplete, corrupt, changed-device/registry or failed-native cutover reserves this owner and presents unavailable state; it never reactivates its Markdown writer. Existing Project/Home/Schedule/History/Statistics suppliers and operator recovery are reused. Every accepted read/admission/publication revalidates context; individual storage accesses retain physical root identity checks.

The offline executor requires exact-plan approval plus explicit source-writer quiescence and rejects a running Obsidian process. It revalidates archive, source set/hash/write stamps, registered identities, original local-device snapshot, History/task metadata, dependencies, candidate/installed assets, rollback copies and destination occupancy. It holds an actual Windows `FileShare.None` source handle, checks source identity/write stamps under that handle, writes immutable incomplete evidence, installs the verified required asset, creates and closes an empty native authority, removes only the approved marker bytes, then writes the matching active acknowledgement before releasing the handle. No automatic resume, restore, pruning, fence reset or outcome invention exists.

Disposition: no record = not started; immutable plan without matching active acknowledgement = incomplete/blocked; matching active acknowledgement plus valid identities/source/native authority = active. Exceptions/process death preserve partial evidence. Native startup failure remains unavailable. Rollback copies do not authorize automatic source restoration. Application and filesystem power-loss durability is not overstated as a distributed transaction.

## Exact source inventory

Existing files changed (10):

- `.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js`
- `.obsidian/plugins/hub-project-menu/plugin.js`
- `ItacanTaskCore/host/authority.js`
- `ItacanTaskCore/host/index.d.ts`
- `ItacanTaskCore/host/repository-host.js`
- `ItacanTaskCore/integration/project-runtime.d.ts`
- `ItacanTaskCore/integration/project-runtime.js`
- `ItacanTaskCore/integration/tests/obsidian-host.cjs`
- `ItacanTaskCore/integration/tests/run-obsidian.cjs`
- `ItacanTaskCore/integration/tests/startup-obsidian.cjs`

New files:

- `ItacanTaskCore/host/private-authority.js`
- `.obsidian/plugins/hub-project-menu/lib/services/native-task-activation.js`
- `ItacanTaskCore/integration/controlled-cutover.cjs`
- `ItacanTaskCore/integration/cutover-source-lock.ps1`
- `ItacanTaskCore/integration/execute-cutover.cjs`
- `ItacanTaskCore/integration/tests/cutover-support.cjs`
- `ItacanTaskCore/integration/tests/controlled-cutover.test.cjs`
- `ItacanTaskCore/integration/tests/cutover-crash-worker.cjs`
- `ItacanTaskCore/integration/tests/cutover-interruption.test.cjs`
- `ItacanTaskCore/integration/tests/cutover-identity.cjs`
- `ItacanTaskCore/integration/tests/cutover-types.fixture.ts`
- `ItacanTaskCore/integration/tests/cutover-typecheck.cjs`
- This verification report.

## Real selected-owner preflight

- Registered vault: `47f2fab0a1a1e5ec`; physical private owner and dashboard UUID verified. Exactly one owned task source, one task, zero Steps. Mounted Resources and other Projects are excluded.
- Selected source: `Projects/Pulsed Optomechanics/Meta/Tasks.md`.
- Original SHA256: `f4d001bd26c754a01b1427b32cc076b5737a17b18374dcf1c8865d6169d68344`.
- Proposed SHA256: `0c6d539c8e5a51fc669150e49d14ad984dcb7e0bd3c1632850396c8a9284f50f`.
- Exact change: remove `[ ] ` from the one verified list marker. All other bytes, including blank lines and note content, remain identical.

```diff
-- [ ] Look up what I was doing before and make tasks for how to continue
+- Look up what I was doing before and make tasks for how to continue
```

The exact 1E archive remains verified and preserved. Its old preview reported changed owner-registry observation; the fresh comparison did **not** report a History mismatch. A new capture was made without overwriting it. All 12 complete source/backup hash pairs verify, with zero capture changes.

Current readable archive:

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\preparation-20261021-b4c56b89-01c7-4890-8b9a-dad0265687f9\capture-2026-10-21T19-52-05-139Z-887418ec-aa53-414f-8a2e-125ce6f0cccf/TASKS.txt`

Manifest: `MANIFEST.json` with `MANIFEST.sha256`; selected complete original backup:

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\preparation-20261021-b4c56b89-01c7-4890-8b9a-dad0265687f9\capture-2026-10-21T19-52-05-139Z-887418ec-aa53-414f-8a2e-125ce6f0cccf/originals/7a4cc067dbc917d91f1f927d09cd3df666af16b15b25a44ae0bf00e12e52fe69.md`

History observation: **182 records**, digest `b0669aa71ad1cb776baae9670dfbaeb0df76e11a14a12a8f2ef22510da6c9b65`. Current History and task metadata match the new manifest. No active Oath or Inbox reference to the selected owner/source was found. No existing History is imported, removed or rewritten.

Planned native authority (absent; never opened/created):

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\NativeTasks\v1\3d112659bc9abb96bc8e5f30\971c1109ea713b8b4f1b5d07\9786507a462977fde57977dd\repository`

Authority UUID reserved in the unexecuted plan: `5caa62f1-8f75-4682-af57-aba6affa01a1`.

Planned activation directory (absent):

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\NativeActivation\v1\3d112659bc9abb96bc8e5f30`

The device ID was obtained from the established localStorage key using a verified copy in an owned Temp Obsidian profile. No replacement identity was allocated and the real profile was not opened. Its original backing-file hashes must still match before execution; normal runtime thereafter checks the actual device ID, not that historical file snapshot.

## Prepared installation and approval package

`C:\Users\El_Baraka 2025\AppData\Local\Itacan\CutoverArchives\v1\47f2fab0a1a1e5ec\preparation-20261021-b4c56b89-01c7-4890-8b9a-dad0265687f9\execution-1f-5187fc77-1c04-4a4c-8957-0f094ff92a48`

- `PLAN.json`: immutable owner-specific plan; body digest `39791c9ad00ee1b6bc7b64b989a882826bbe29431583f77ff9e57d0a30022eda`.
- `previous/`: verified byte-exact rollback copies of all twelve installed assets.
- `candidate/`: verified selected installation bytes.
- `SOURCE-HASHES.json`: current relevant source freeze for final build review.
- `EXECUTION-REVIEW.txt`: exact approval-gated command and quiescence/restart instructions.

Only `main.js` would be replaced:

- Installed: `2f189a7447d9f782f20e07865121b3e9364b59155d9ffe10c9d8d25236ce7d57`.
- Candidate: `c1acc8956409d8ece57ae864462fc55343d07754c3d995f63f86bc0522a4f2aa`.

Atlas is byte-different in the raw build solely because of CRLF/LF representation; all normalized bytes and factories match, so its installed bytes are deliberately retained. The other ten assets also remain unchanged. Fresh main factory count is **233 ? 235**, adding only private-authority and activation factories; the five changed factories are host authority, host repository lifecycle, Project runtime, native task host and plugin startup. Atlas remains **25** factories. The one Legacy Task Service construction remains. No offline cutover executor, source-lock helper or end-user activation toggle is bundled.

## Verification

- **194 distinct focused tests pass:** 43 startup/recovery/archive/default-boundary; 136 History/accounting/host/scoped-read; 15 new cutover/identity/occupancy/interruption checks.
- **Eight declaration runners pass**, zero diagnostics: integration, recovery, History, cutover, host, writer, P1 scoped capture and Home/Schedule.
- **22 genuine Obsidian complete-cutover checks pass** using actual production plugin lifecycle and final under-lock source-stamp gate; **19 ordinary/default-and-synthetic startup checks pass**. This uses the existing harness with synthetic data and owned profiles, not the everyday vault or a second UI application.
- Actual Add/Edit controls verify Must do, Description, date-only Start, explicit midnight Due, flat Steps and UUIDs. Completion/reopening/recompletion, calendar creation, Overview/Week/Month, mixed Home, native/legacy History/Statistics, confirmed deletion retaining History, operator identical replay, unload/restart and unavailable/no-fallback behavior pass.
- **Two parent-terminated processes** after empty native preparation and after marker retirement reconstruct incomplete/blocked. Original request/native evidence and exact source bytes survive; no task/event recreation occurs. Native lease is already closed at these stages (recorded absence, not fabricated lock evidence); the source worker releases its exact handle on parent death. No lock movement is performed.
- Injected exceptions at incomplete/installed/prepared/retired are distinct from actual process death. Changed/ABA source, invalid archive/backup, missing/changed build, occupied authority, malformed activation and stale device/context reject without unsafe writes.

Initial failures are preserved: Windows short-path comparison; genuine startup readiness/report serialization and timeout diagnostics; declaration invocations missing the explicit TypeScript path. All corrected selected checks pass. No immutable historical source-hash assertion or frozen graph was modified, weakened or claimed rerun. No broad historical crash archive was repeated.

## Protection and remaining approval

All **1,167 protected existing files** and all **twelve installed assets** match the fresh baseline. Original Markdown, application data, History/checks, shared state, Oath/Inbox and workspace remain unchanged; no protected drift was observed. Dirty Git state is preserved. Only the ten listed existing source/harness files differ. Real permanent native and activation directories remain absent. New archive and package copies are outside the vault/cloud/Git and inherit the private archive ACL.

Raw commands/exits, failures, child evidence, source originals and comparisons:

`C:\Users\EL_BAR~1\AppData\Local\Temp\itacan-m1f-_l103ydi`

Genuine accepted cutover evidence: `%TEMP%/itacan-real-host-fpu8YO/evidence`.
Default startup evidence: `%TEMP%/itacan-real-host-N4P6bl/evidence`.

Before execution, the user must close everyday Obsidian and other task editors and pause source synchronization. Revalidate immediately; any source/registry/device/History/asset/occupancy change aborts and requires review. No application is killed. The exact exclusive source handle stays held through the actual writes.

One final authorization is required to install this `main.js`, retire only this verified checkbox marker, create the empty selected-owner permanent repository, persist its external activation evidence, and reopen/restart Itacan to verify routing. Other private/shared Projects and every Resource remain Legacy. Oath, Inbox/Quick Add, Phase mutation, sharing, unsupported hierarchy/recurrence and native clear-completed remain unavailable. No task is automatically recreated. Stop for user review; no real changes have been executed.
