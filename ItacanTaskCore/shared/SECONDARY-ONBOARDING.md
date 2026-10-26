# Join the existing native shared Projects

This document accompanies the second-client bootstrap correction. Check the deployment report before assuming a client has that correction installed. The laptop repair candidate was prepared outside OneDrive; live installation/recovery requires a coordinated write window with the stationary client closed.

## Compatibility and preservation

Close older writing clients and coordinate access to the same OneDrive vault before replacing shared plugin files or repairing a join. Preserve local application data, native repositories, retained requests, activation/join plans, device metadata, installed assets, worktree, index and HEAD in a verified backup outside OneDrive. Do not copy the primary computer's device identity or local repository.

Use the complete reviewed compatible-client package and its `COMPATIBILITY.json`/`verify-client.cjs`, including the listed sidecars and Home/Project dashboard sources. Verify the package itself first, then the installed files. Hashes belong in that package's generated manifest, rather than a permanently hardcoded documentation hash. The plugin manifest version alone does not identify a build.

Required shared protocol capabilities remain packet 3, origin frame 2, namespace 2, receive 2, reservation witness 2, retention marker 2, host API 3 and `git-shared-compact-proofs-v2`. The correction also requires location-aware bootstrap and the explicit `nativeTaskHost.openJoinRecovery` operator API. A root containing `REQUEST-REJECTED-v1-*` requires this recovery-aware client; older retention readers reject that unfamiliar evidence. No task schema, portable location or N4 packet format changes.

Before opening a new client, verify that the working copy contains the reviewed, committed Project bindings, transitions, retired sources and complete portable evidence. Preserve overlapping local changes and stop if admission rejects them. This process does not fetch, merge, commit or push. Never rerun the migration executor or generate another authority/genesis.

## Ordinary new-client startup

Metadata-ready startup discovers the committed shared bindings, immediately reserves those owners against Legacy writes, then creates only the new device-local replicas and receives validated portable evidence. The join obtains its current physical folder/Markdown-note catalog from the existing native location provider. Resource mounts do not transfer physical ownership. Nonexistent, escaped and foreign locations remain invalid; catalog changes produce new registry observations.

| Project | Project UUID | Shared authority | Genesis revision |
| --- | --- | --- | --- |
| Itacan | 4b597e3b-b588-4a29-969b-70db3a684112 | 29233647-49ee-8061-9291-1d1d6c7d20ce | efa5ee9f-2e72-42c4-8957-df46d4e325cd |
| Obsidian Hub | 9325047c-eb3d-43e7-92f2-a9bf630afe13 | 44f5d46b-cb87-83cd-ae30-ec18dfc21548 | 96b2fae6-8b56-43aa-9ddf-b579bbeb843d |

The captured 25 October 2026 baseline contains **57 live Itacan tasks and two live Obsidian Hub tasks**. Expect those 59 shared tasks with existing UUIDs, properties and locations, rather than empty lists. Validate against the actual reviewed portable head if later legitimate work changes those counts. Local absolute vault paths and device identities can differ; Project-relative roots remain `Projects/Itacan` and `Projects/Obsidian Hub`.

## Explicit interrupted-bootstrap recovery

An absent receipt alone does not prove nonexecution. Ordinary receipt reconciliation and exact original replay retain their existing rules. A committed request is confirmed from its receipt; stale or conflicting requests stay blocked. Startup never automatically concludes a failed request as rejected.

The narrow terminal-rejection extension handles only the empty bootstrap catalog defect. Under the selected authority's owned writer lease, it requires:

- Valid unchanged retained request, original packet and permanent physical binding.
- Intact, unfenced revision-zero authority with its exact original genesis and no publication frames or receipts, bracketed by stable authoritative captures.
- The current registry, with only its locations removed, matching the original registry guard exactly; identity, partition, reservation and Phase guards must also match.
- Independent validation of the complete incoming packet, reproduction of the original location rejection under the empty catalog, and successful candidate/reservation validation under the genuine current catalog.

A live review object is required to conclude the operation; changed evidence invalidates that review. The resulting `REQUEST-REJECTED-v1-*` record is private, immutable and bound to the original request checksum and genesis. It records nonexecution, not success, and cannot coexist with an operation receipt. The original request/ID/guards remain unchanged and permanently non-replayable. This does not retroactively admit the invalid request. A **separate newly admitted receive**, with its own operation ID and current guards, performs synchronization.

The operator API remains available when ordinary startup has blocked the join. After preserving evidence and installing/verifying the correction, inspect from Obsidian's Developer Console:

```js
const hub = app.plugins.plugins["hub-project-menu"];
const join = await hub.nativeTaskHost.openJoinRecovery({
  type: "project", id: "4b597e3b-b588-4a29-969b-70db3a684112"
});
await join.requests();
const review = await join.review("15427fcf-468b-478b-80f4-0765f1b552b5");
review;
```

Review the reported proof before the separate explicit mutation step:

```js
try {
  if (review.state === "reviewable-rejection") await join.conclude(review);
  await join.finish();
} finally {
  await join.close();
}
```

If review fails, close the session with `await join.close()` and preserve the evidence. Do not edit/delete JSON, manufacture receipts, force-unlock, relax guards or retry under a replacement authority. An already-concluded operation reports `rejected-before-commit`; finish does not repeat the rejection. An interruption after the new receive commits is reconciled from its actual receipt on next startup, without another task mutation. Join sessions participate in native host shutdown draining.

After successful finish, restart Obsidian normally to reconnect existing consumers. Confirm both shared owners ready, each task exactly once, unchanged task/Step identities and properties, unchanged Legacy History, operational Home/Workspace readers, then verify graceful shutdown releases both leases and a clean restart remains ready. Do not create verification tasks in ordinary Work.

The proof is scoped to the existing cooperative local persistence contract. It does not claim to detect a complete external directory rollback or hostile rewriting of the entire evidence set.

## Shared versus private workspaces

Shared native edits publish portable evidence under `.itacan-native/v3/<authority>/`. Git or OneDrive can deliver those files; admission still verifies committed bindings and sources. Local publication is not confirmation that another client received it. Conflicts stay explicit; the application performs no automatic remote push/pull.

Private Project and Resource repositories live under each device's `%LOCALAPPDATA%/Itacan/NativeTasks`. Their native task data does **not** synchronize through the vault. Nine absent private authorities on the laptop are not recovered by joining the two shared Projects. Do not initialize empty substitutes or copy local repositories blindly. Combined shared readers cover the admitted shared owners; any failed registered owner must continue to make its aggregate unavailable. This correction makes no aggregate-reader exception and adds no private synchronization.

Legacy History remains application data in ignored `data.json`; preserve the local 182-record baseline independently. The six older Hub `data-*.json` conflict copies are unrelated to native Git task conflicts and are not part of this repair.
