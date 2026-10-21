# N1-E2-R — Private storage compatibility and recovery

This is an inactive native-core repair. It provides no production host, migration, conversion, installation, Statistics/UI routing or Oath integration. Stop for user review after the repair verification report.

## Explicit authority

Existing valid task-only/B1/B2 JSON roots retain the default `legacy` profile and logical schemas 1/2/3. Stopped flat schema-4 repositories are forensic-read-only. Every writer path rejects their recognized evidence: open, authoritative reload, receipt replay and direct commit. Rejection covers ordinary task/Step/completion/structure/recurrence/import commands, including damaged or rewound pointers while schema-4 generation evidence remains. No import-only exception grants ordinary writability.

Create a dedicated root explicitly:

```js
const repo = await createJsonRepository({
  directory: verifiedEmptyAbsoluteTempDirectory,
  storageFormat: "private-v4",
  storeId: explicitlyAllocatedAuthorityUuid,
  partitions,
  idFactory,
  clock
});
```

Reopen only that authority:

```js
const repo = await openJsonRepository({
  directory: theSameExplicitDirectory,
  storageFormat: "private-v4",
  expectedAuthorityId: explicitlyAllocatedAuthorityUuid,
  idFactory,
  clock
});
```

Opening never calls creation. Missing/empty/invalid/mixed roots or mismatched authorities fail closed. Creation requires an existing ordinary empty directory, verified again under the lock; it never creates a parent directory or clears abandoned evidence. An injected storage port must match the named physical root's evidence and cannot substitute another repository. Root naming may follow `native-private-v4/<authorityId>/`; the verified identity and directory are the boundary, not the basename.

No existing populated root is copied or converted. A live transition requires separate N2/N3 authority coordination, migration rehearsal and activation approval. Distinct roots do not provide distributed UUID coordination or atomic N1-B consumption.

## Wire versus logical schema

The first empty committed generation is already wire version 4. Logical schema remains 1 until existing recurrence/import commands explicitly advance it. `repo.info().schemaVersion` continues reporting logical schema; optional `info().storage` reports private format, wire version, authority, logical high-water mark and fence state. Task schema stays 1.

The manifest wrapper remains `{payload, sha256}`. Its payload has exactly the six historical keys:

```text
format: "itacan-task-manifest"
schemaVersion: 4
storeId
retention
current: existing five-field generation descriptor
ancestry: {
  format: "itacan-private-lineage", version: 1,
  barrier, entries: existing descriptor array
}
```

Private generation roots retain exactly the eleven historical keys. Partitions, tasks, History, bindings and retired Steps retain their data. `schemaVersion` is wire 4, and `receipts` becomes:

```text
{
  format: "itacan-private-state", version: 1,
  barrier, logicalSchemaVersion,
  records: unchanged actual receipt array,
  recurrence: existing namespace or null,
  historyImport: existing namespace or null
}
```

Portable codecs reconstruct the original logical state and run complete domain validation. Receipt strings, IDs, timestamps, content envelopes, array order and import/recurrence digests are not rewritten. The private codec does not call the public partition serializer.

The barrier contains version 1, authorityId, minimumLogicalSchemaVersion, requiredCapabilities and importRecoveryScope. Capability order is `private-native-storage-v1`, followed by `private-history-import-v1` once logical schema 4 is known. Schema 4 requires the existing checksummed protected identity scope. Lower recovered logical state may retain a higher barrier only under recovery protection.

Manifest checksums remain canonical-JSON SHA256. Descriptors checksum the exact encoded generation bytes including the trailing newline. Filenames, descriptor ancestry, retention and lock ownership are unchanged.

## Frozen-reader guarantee

The old schema-1/B1/B2 manifest decoders check allowed field names before schema versions. Retaining their six recognized outer fields lets them reach terminal `UNSUPPORTED_SCHEMA` at wire 4. The schema-1 state validator similarly accepts the eleven field names before rejecting wire 4. No historical reader or expected error was modified.

Generation tests use genuinely valid lowered historical manifests with the original descriptors and array ancestry; they reach generation validation. Empty, prepared and published dedicated roots contain no legacy-readable committed generation. Old readers cannot return an authoritative repository or commit through corruption fallback within that root. They may transiently acquire/release their own lock before rejection; committed bytes remain unchanged.

An intact unsupported header gives `UNSUPPORTED_SCHEMA`. If corruption leaves no usable version header, `RECOVERY_REQUIRED` is a safe refusal, never successful empty state. Future wire/logical/namespace versions and unknown mandatory capabilities reject without ancestor downgrade.

## Recovery and acknowledgement

CURRENT remains the sole publication authority. Both verified pointers contribute monotonic high-water/scope evidence before private selection. Every readable private generation must match the wire format and authority. Unexplained unreadable generations block opening. A damaged retained generation may be classified as historical evidence only when an authority-matched, checksummed saved CURRENT manifest proves the reference; that evidence never selects a head or grants authority.

After CURRENT publication, committed identity scope is mirrored into RECOVERY before acknowledgement. RECOVERY continues to name committed state, never the prospective candidate. A mirror failure is acknowledgement loss; retry/reopen repairs protection before successful receipt acknowledgement. This protects acknowledged preparation even when CURRENT is subsequently unreadable. A failed pre-CURRENT candidate is not adopted as committed scope.

Existing `RECURRENCE-FENCE.json` behavior is retained: version-1 bytes are not rewritten; version-2 scope is validated and merged; no clear/replace API exists. Known loss fences import/replay and affected binding changes, reserves spent IDs, and makes compatibility unavailable. Proven independent ordinary work remains available. Unknown scope fails normal opening. Late fences are rechecked before CURRENT replacement.

No absent receipt establishes that an acknowledged import never occurred. Repeated restart and ordinary allowed commits retain the barrier and marker.

## Stopped flat format

```js
const evidence = await inspectJsonRepository({
  directory: preservedFlatRoot,
  expectedAuthorityId,
  sourceFormat: "stopped-e2-flat-v1"
});
```

The result is private detached evidence with `authority:"forensic"`, `writable:false`, a validated snapshot or diagnostics, and no execution API. Inspection takes no writer lease, creates no state/fence, removes no lock, and does not choose an ancestor as replacement authority. A present writer or changing observations prevents a stable snapshot. Normal legacy/private opening does not convert the root.

## Preserved E2 contracts and verification

Historical import E01-E09, exact reviewed N1-B claims, quarantine, time/null rules, native completion, Statistics projection, B1/B2 recurrence and both export guards remain intact. Import writes still lazily require Node/E1 validation; portable validation and ordinary operations do not. Missing mandatory capability fields now reject explicitly; publication indices must match their creation receipts.

See the new `native-history-e2-r-verification.md` report for exact test counts, original four failure-to-pass evidence, process exits versus parent terminations, protected comparisons and sealed inventory. Earlier E1/E2 reports and reader fixtures remain unchanged.

Claims cover only tested cooperative local persistence and process interruption. They exclude hostile writers, power-loss/OneDrive guarantees, distributed uniqueness, complete-directory rollback detection and atomic cross-store plan consumption. Consistent erasure/forgery of all evidence is not detectable from an absent receipt. No production authority or N1-F work is included.
