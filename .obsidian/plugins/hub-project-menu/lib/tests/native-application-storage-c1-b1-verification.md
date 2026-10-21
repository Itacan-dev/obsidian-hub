# C1-B Milestone 1 ? scoped Music preferences

Completed on 2026-10-20. One existing source changed (`lib/services/music-library.js`); exactly the eight approved new files were added. Production still constructs `new MusicLibrary(this)` without options, and ordinary `HubDataStore` construction and Settings routing are unchanged. No Workspace adoption, copied-profile rehearsal, native-task integration, domain coordination, migration, installation or reload was performed.

## Actual integration

The private `createMusicPreferences({store, authorityId, applicationContextId})` receives an already-open C1-A authority. It opens/creates/closes no profile and owns no queue or lease. Actual C1-A admission continues to restrict mutable profiles to explicitly verified ordinary OS Temp child directories. No new persistent format or receipt field exists.

Its four methods are `read()`, `prepare(intent, originalRead, operationId?)`, `submit(prepared, signal?)` and `reconcile(prepared)`. The two intents are `set-enabled` and `set-provider-enabled` (the four existing providers). Read/replace selects only the complete `music` field; original presence/digest and complete authority/observation evidence are retained. A profile must declare independent Music scope; the adapter refuses a scope requiring other fields rather than reading them. Absent Music uses actual defaults. Present Music must equal the existing normalizer's output: any repair, omitted defaults, migration, future version, changed identity, unknown data loss or other normalization change rejects without writing.

Preparation retains/freeze-copies the complete intent, canonical intent digest, original read and complete C1-A request. Exactly one operation ID is allocated by preparation (or supplied for an externally retained exact request); reason binds version, intent digest and action kind within the existing bounded request. Submission reconstructs the only permitted effect from the original intent/evidence and rejects altered replacements, guards, reasons or other fields. The normal C1-A receipt binds the entire request. A properly prepared changed intent under an existing operation ID conflicts at C1-A. No caller-generated operation ID replaces an uncertain operation.

`MusicLibrary` accepts the optional `transactionalPreferences` dependency. Only its actual `setEnabled` and `setProviderEnabled` methods are adopted. They reuse its existing `queue`; module-private actions do not pass through an externally executable generic callback. In opted-in mode, generic `enqueue(work)`, direct `save`, add/import, edit/rename, item enablement/removal/reorder and other unadopted mutations reject before their side effects. In particular, Spotify's actual reused generic save queue cannot enter managed mode. Normal legacy construction retains all prior behavior.

The disposable host can inspect detached `getPreferenceStatus()` evidence (`readiness`, original `prepared`, last `outcome`). `refreshPreferences()` initializes/refreshes current Music; `reconcilePreferences(prepared?)` and `replayPreferences(prepared?, signal?)` are explicit host operations. Externally retained requests are copied before queueing. The host must retain the original externally for restart; no automatic pending-intent persistence or recovery discovery was added.

Uncertain/unknown/recovery-required/conflicting requests block additional toggles. There is no automatic reconciliation, retry, rebase or new operation. Confirmed commitment or replay triggers a fresh authoritative Music read, then changes only `.music` on the latest `plugin.projectWizard.data` object and notifies existing listeners. Historical receipt results never become current Music. Refresh failure preserves the committed result, marks readiness unavailable and makes `.state` refuse to portray old memory as current. Explicit refresh/reconciliation may restore readiness. Conflicts require host review; reconstructing a caller is not permission to reissue uncertain work with a new operation identity. Disposal suppresses late memory/listener publication without undoing a commitment. Listener failures remain contained by the existing emitter.

## Verification

All explicit selections ran using the saved VS Code Node 24.21 runtime and a filesystem-write guard admitting only resolved OS Temp paths. Exact command/argument records, stdout/stderr, scalar exits, original source and hashes are retained in the private Temp audit.

| Final selection | Result |
|---|---:|
| New Music caller and persistence files | 36 passing tests |
| Six unchanged C1-A behavioral files | 86 passing tests |
| Music library/providers/controller, Spotify Connect, data-store and shared-projects integration | 43 passing TAP checks |
| Combined final run | **165 passed; zero failures, cancellations or skips** |
| C1-A declaration runner | TypeScript 6.0.3, zero diagnostics |
| New Music declaration runner | TypeScript 6.0.3, zero diagnostics |

Standalone integration scripts are counted as TAP file checks; their internal assertions also executed. Compatibility Spotify/provider behavior uses synthetic requests, loopback callbacks and inert playback fixtures; no real OAuth, external playback or provider account was used. Legacy shared-project compatibility writes are confined to synthetic Temp fixtures; the adopted Music path never invokes shared preparation.

Coverage includes both toggles/all providers; absent/default/populated state; metadata, artwork, order, sources and IDs; unrelated/excluded-field preservation; disjoint stale updates and Music conflicts; immutable preparation; exact replay after later Music changes; changed-operation conflict; memory-object replacement; postcommit refresh outage; unknown receipt and publication uncertainty; explicit reconciliation; cancellation; generic queue refusal and actual Spotify save refusal; listener exceptions; disposal; concurrent adopted calls and queued retry detachment.

Six new actual parent-terminated caller runs cover both enablement and provider preferences at: before publication, immediately after file replacement/before acknowledgement, and after confirmed commitment/before memory refresh. They use actual MusicLibrary, actual C1-A publication and actual files. For each child, commands/stage/PID/host/token, original preparation, raw files/hashes, exit/signal, proven death and exact lock bytes/hash are preserved before moving only its verified dead-child lock within the admitted disposable root. Prepublication reconstruction returns unknown without executing the earlier-epoch request. Postpublication reconstruction reconciles/replays the original receipt at exactly one revision. No receipt absence creates replacement work. The seven unchanged C1-A interruption cases also pass. Exceptions, lost responses, reconstruction and actual termination are separate tests.

## Source, build and protected comparison

Fresh baseline captured 1,755 existing files, exact Music source, dirty Git inventory, protected data and installed-asset hashes. Final comparison finds solely the authorized Music source change; all other baseline bytes remain unchanged, with no observed protected-data drift. Existing device-ID correction and all C1-A/core/P1/P2 source remain untouched. No real-vault mutation or new authority artifacts were introduced.

Baseline/final builds ran only in guarded Temp. Main retains **171** identical factory IDs; Atlas retains **24**. Only the Music service factory body differs. Eleven of twelve staged assets are byte-identical; only staged main.js changes. All **twelve installed assets remain byte-identical**. Production Music constructor, ordinary storage constructor, exactly one Legacy Task Service construction and routing are unchanged. The injected adapter is explicitly imported by disposable hosts/tests and is absent from the production startup graph.

## Exact new-file boundary

- `lib/services/application-storage/music-preferences.js`
- `lib/services/application-storage/music-preferences.d.ts`
- `lib/tests/application-storage/music-preferences.test.cjs`
- `lib/tests/application-storage/music-preferences-persistence.test.cjs`
- `lib/tests/application-storage/music-preferences-crash-worker.cjs`
- `lib/tests/application-storage/music-preferences-types.fixture.ts`
- `lib/tests/application-storage/music-preferences-typecheck.cjs`
- `lib/tests/native-application-storage-c1-b1-verification.md`

## Remaining limits and review boundary

This is opt-in disposable caller adoption, not production storage adoption. Supported evidence remains cooperative local persistence and process interruption, without power-loss, hostile-writer, distributed or full-directory rollback guarantees. An observation is not a lease on future Music state. Older blind writers remain incompatible with managed profiles. Complete original requests must survive externally for replay; no lost request is reconstructed. Present noncanonical Music is deliberately unavailable for mutation, and every non-preference Music/Spotify write stays unadopted in managed mode. No cross-store atomicity, OAuth/playback adoption, receipt pruning or domain workflow success is claimed.

**STOP FOR USER REVIEW. Milestone 1 only.**
