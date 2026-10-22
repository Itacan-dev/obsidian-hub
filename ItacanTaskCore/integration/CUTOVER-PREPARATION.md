# Archive-and-switch preparation

This offline tool reads actual Markdown and writes a new private archive. It never loads a native host, changes a source file or authorizes activation. Native startup remains synthetic-only.

Run `integration/prepare-cutover.cjs --vault <registered-vault-path> --archives-root <new-private-LocalAppData-path>` with the compatible Node runtime. The CLI resolves the existing Obsidian vault registration read-only; it does not allocate a vault/device/task identity. It rejects cloud, vault-contained, Git and symlink/junction destinations. Keep the archive beneath the user's local application data, outside synchronization and Git. Use the verified write guard when operating on a real vault.

The output directory is unique. `TASKS.txt` contains readable tasks, Steps, available metadata and verbatim source blocks. Unsupported/literal text is preserved raw. `originals/` contains complete, byte-exact original notes. `TASK-METADATA.json` preserves only metadata referenced by archived legacy identities, as a private human reference; copied identities are not attributed as proven metadata. `MANIFEST.json` and `MANIFEST.sha256` identify paths, physical owners, counts/reliability, hashes, file write stamps, capture changes and unresolved sources. The tool never imports these records.

The module `.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation.js` supplies `verifyArchive`, `previewRetirement` and `cutoverPreflight`. Preview requires one explicitly selected eligible private Project. Resource ownership is resolved before Project ownership; mounts never extend the selected owner. Preview removes only verified `[ ]`/`[x]` checkbox marker spans in memory, retaining list markers, text, indentation, prose, formulas, headings and every other byte. It does not remove entire blocks. Unknown status/syntax/ownership, changed hashes/write stamps and ambiguous contexts block that source. No function applies the proposed bytes.

`prepareAuthority` calculates an inert device-private location:

```text
%LOCALAPPDATA%/Itacan/NativeTasks/v1/<hash(vaultId)>/<hash(deviceId)>/<hash(projectId)>/repository
```

Use the existing registered vault ID, actual `HubDataStore.deviceId` from the owning application context, and selected Project ID. Do not substitute a display name, generate a replacement ID or assume the last writer's `data.json` device stamp is the current device. The result is explicitly disabled, unadmitted and nonexecutable; it is not a native host configuration. Planning creates no directory or repository. Existing storage/lock evidence at that path requires separate review.

Preflight re-verifies backups/readable output, owner registry, task-source membership, original hashes/write stamps, metadata/History digests and the proposed authority location. Even a successful preparation cannot authorize cutover: an exclusive source-write window, approved permanent native admission/configuration and explicit cutover authorization remain mandatory. File observations do not provide a cross-store transaction or an indefinite no-write guarantee. Immediately revalidate after stopping relevant application/editor/synchronization writers; acquire native writer ownership through the existing protocol when activation is separately authorized.

No Project is automatically selected. Existing History stays in its current application authority; manually recreated native tasks will be new identities and events. Source retirement, permanent admission and activation require another reviewed execution.
