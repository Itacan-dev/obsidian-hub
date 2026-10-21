# Real-Obsidian Project-task rehearsal (Milestone 1A)

This explicit sibling package mounts the existing Itacan Project controller, task rows, Step checklist and compact Add/Edit modals in a separate Obsidian/Electron process. It does not invoke Itacan onload or install its bundle. Production continues using its original Legacy Task Service.

`openProjectRuntime(config, options)` requires an existing verified OS Temp directory, exact native authority/application/registry identity, one available private Project/partition and an explicit rehearsal UUID. Creation opts into the existing atomic-task capability; opening requires the existing matching request-retention marker. The runtime owns its actual N2/N3-A session. The optional `nativeTasks` dependency selects that exact Project in `createTaskPanelRead`; every other Project or Resource retains the legacy branch. A Resource mount never selects Project ownership.

The supported product slice is existing Add/Edit, Description, Necessity, civil Start/Due dates, flat Steps, parent/Step complete/reopen, completed disclosure and modal whole-tree deletion. UUIDs remain native references; no source path/line/Hub identity is fabricated. Compact Save retains hidden continuation and Step bodies privately. Nested trees, recurrence members and Phase-bound editing reject intact. Source-position actions, source navigation and clear-completed are unavailable. Home, Schedule, Oath, Inbox, Roadmap, global History/Statistics and sharing are not native rehearsal surfaces.

## Request retention and recovery

The host writes `REQUEST-RETENTION-v1.json` and immutable `REQUEST-v1-<sha256(operationId)>.json` inside its admitted root under its existing writer lease. The marker binds authority, application context and rehearsal identity. Each strictly validated record binds the complete original intent, owner/partition, compiled writer request and command, digests and checksum. Creation task/Step UUIDs are allocated once before retention. Exclusive creation, flush, readback and root/lease rechecks precede dispatch. The existing writer gate and final publication callback both verify the exact record. No queue, second lease, task receipt field or native generation/manifest change is added.

The private version-3 operation snapshot uses the existing authoritative repository queue. It returns bounded `committed`, `missing`, `conflict` or `unavailable` evidence. Only validated native receipts establish commitment. `missing` never proves nonexecution. After restart, unresolved retained evidence blocks new mutations and automatic execution. `getRetained`, `reconcile` and explicit `replay` retain the original operation, identities and guards. Confirmed replay does not recreate a task deleted later. There is no pruning, record rewriting, automatic uncertain retry, guard rebasing or replacement identity allocation. A validated rejected request without a receipt remains retained and requires review; this gate provides no clearing API.

Older standalone core readers may ignore these sidecars. Updated writer hosts refuse a retained root without explicit retention support, before and after acquiring the repository lease. This is a disposable-only admission contract, not production compatibility or distributed protection.

## Verification entry points

Use a compatible Node runtime and the established Temp-only write guard:

```text
node --require <Temp-isolation-guard> --test --test-reporter=tap
  ItacanTaskCore/integration/tests/controller.test.cjs
  ItacanTaskCore/integration/tests/pending-recovery.test.cjs
node --require <Temp-isolation-guard> ItacanTaskCore/integration/tests/typecheck.cjs <typescript.js>
node --require <Temp-isolation-guard> ItacanTaskCore/integration/tests/run-obsidian.cjs
```

The real-host launcher requires the already-installed Obsidian archive and existing test Electron/remote dependencies. It verifies a new Temp root, supplies its own profile/vault/native/evidence directories and working directory, loads only a tiny synthetic API bootstrap, and blocks external navigation/network requests. The actual Itacan modules load from reviewed source; no rebuilt Itacan bundle is installed. The automated window stays hidden and exits after the workflow. Screenshots and exact process results remain in its printed evidence root. It is an actual Obsidian-hosted component test, not complete plugin-startup integration or a manual persistent application session.

Parent-terminated child tests preserve complete original requests, raw native files, PID/host/token, exact lock bytes/hash and exit evidence; death and unchanged lock identity are verified before moving that disposable lock. Partial retention blocks reopening. Missing prepublication receipts remain uncertain; postpublication receipts reconcile and identical replay preserves the original IDs.

See `lib/tests/native-real-host-m1-a-verification.md` for actual results and limitations. Milestone 1 remains incomplete; migration rehearsal, Markdown retirement and real cutover are unapproved.
