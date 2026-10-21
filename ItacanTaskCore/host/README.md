# N2 — Inactive native host

This Node-only sibling package hosts an explicitly selected disposable private-v4 repository. Import `ItacanTaskCore/host` explicitly. Production startup, the existing Legacy Task Service, N0, F1/F2 and native-core entry points do not import it.

The public host owns lifecycle and private reads. It exposes no command, import, export, migration, lock-break, fence-clear or root-conversion method. General History/Statistics DTOs and provenance navigation are unsupported. N3 writer routing and durable Oath coordination are separate work.

## Authority and lifecycle

Supply `NativeAuthorityConfigV1` and injected registry observations. The authority UUID is caller supplied and equals the native store ID. Only an existing ordinary child directory of OS Temp is admitted, outside the working vault and recognized cloud roots. The host never creates a directory, searches for another root or infers authority from a label or workspace.

`create({version:1, authorityId, partitions, reason, syntheticOnly:true})` explicitly initializes an empty admitted destination. `open({version:1, expectedAuthorityId, syntheticOnly:true})` opens existing matching evidence. Neither calls the other. A failed/uncertain creation requires inspection and an explicit same-authority open, not replacement creation.

Admission retains canonical path and filesystem device/inode identity. A process-local map prevents a known UUID from naming a different physical directory, even after close. Case/dot aliases contend for the same actual lock. Root symlinks/junctions, UNC roots and unstable identity fail closed. This is cooperative local protection, not hostile filesystem or distributed copy detection.

The host wraps the existing `NodeDirectory`; core private-v4 opening, generation validation, CURRENT/RECOVERY publication and writer-token checks remain authoritative. Private wire 4 applies to the initial generation; logical schema remains 1 until existing commands explicitly advance it. No wire/schema/namespace upgrade occurs merely by opening.

Phases are configured, opening, open, closing, closed and disposed. Open while opening shares one acquisition; open while open refreshes the same authority. Create while open rejects. Close revokes acceptance first, drains the existing repository queue, releases only its owned lock and clears caches/subscriptions. A failed release remains closing and retryable; no unknown lock is removed. Disposal is terminal after successful cleanup. Reopening advances the host/provider epoch and requires fresh consumer subscriptions.

`inspectNativeRepository` is detached diagnostics only. It refuses a writer lock, opens no repository and writes no pointers/fences. Private inspection validates stable pointer headers without selecting ancestry. Explicit stopped-flat inspection delegates to the existing forensic reader but discards its unrestricted state. Inspection returns neither tasks nor proof.

## Reads

`TaskRepository.readSnapshot` is a queued, fixed projection over an authoritative validated load. Existing synchronous getters remain cached APIs. JSON reads recheck owned lease, root, CURRENT, RECOVERY, barriers, fence and generation bytes; live external changes never cause another head to be adopted automatically.

```js
const { createNativeRepositoryHost } = require("./index");
const host = createNativeRepositoryHost(explicitDisposableConfig, { registry });
await host.open({ version: 1, expectedAuthorityId, syntheticOnly: true });
const info = await host.refresh();
if (info.readiness.state === "ready") {
    const result = await host.read({
        version: 1, authorityId: expectedAuthorityId,
        ownerContextPin: info.ownerContextPin,
        owners: [physicalOwner], selection: "tasks"
    });
    // result is an immutable scoped snapshot or a bounded typed failure.
}
await host.close();
```

Selections are status, tasks, exact targets and current completions. Status validates the complete partition/registry mapping. Target/task projections retain current metadata and complete Step ancestry; they omit source captures, migration carriers, raw History, continuation/Step bodies and unrestricted receipts. Read DTOs are not serialized NativeTask records or approved public packets.

The injected registry has version, identity/context, revision and canonical SHA256 digest. Each row supplies physical owner, partition, root/dashboard, status/availability, location and mount evidence. Capture brackets registry and optional published-identity observations. A changed pin rejects acceptance. There is no native registry store, identity-plan consumption or cross-store lease. Mounts never change Resource ownership, partition, History attribution or privacy.

## N0 and F2

`createNativeReadAdapter(host)` implements the existing N0 read backend for structured, candidate, committed, target and task/location navigation reads. Construct a separate disposable `TaskService` only in a controlled harness. Its legacy operations/mutations are unsupported. The production facade is unchanged. Current checked state is display state, not Oath fulfillment proof.

`createCompletionEvidencePort(host)` implements the unchanged private F2 port. One capture joins the exact parent binding, canonical event, actual creation receipt, completed-task snapshot, preparation anchor and exact native cut. Receipts are narrowly excerpted and digested, not returned whole. Missing, copied, wrong-owner, wrong-kind, quarantined or unpublished identities cannot acquire a fallback target. Legacy-origin targets require exact case-sensitive published alias pins.

Origins distinguish genuine task/recurrence completion, recompletion, completed creation, Step completion, import and historical append. A recurring commitment remains A; A's current E2 is separate from immutable generation trigger E1 and successor B. Explicit null/backdated completion times do not replace publication-order evidence.

Native order does not prove an independent Oath enrollment save. F2 ordinary/restored references remain ENROLLMENT_ORDER_UNPROVEN. Positive qualification remains restricted to its acknowledged-save → open cut → later genuine completion synthetic sequence. Reopen, disconnect, recovery and epoch discontinuity cannot reconstruct a lost volatile witness.

## Recovery and invalidation

Existing CURRENT is the publication authority; RECOVERY retains committed ancestry and monotonic barriers. Recovery runs only inside explicit opening of the selected root. Stopped flat schema 4 remains forensic-only. Existing fence bytes, capability barriers, imported reservations, recurrence lineage and export restrictions remain intact.

Known fencing permits labelled private recovered observations, while N0 reports recovering and its unchanged facade refuses reads. F2 cannot newly qualify work from that state. Unprovable import scope exposes no authority. Existing core guards may permit unrelated work; the host provides no writer admission. No absent receipt proves acknowledged work never happened.

The host subscribes to actual post-publication repository changes and injected context changes, and watches storage for advisory invalidation. Subscription immediately sends an epoch/generation handshake. Reads validate evidence independently; callbacks are ephemeral, not receipts or leases. Superseded or closing captures cannot publish. Unstable captures retry at most three times per demand, then report SNAPSHOT_UNSTABLE. Providers remain caller-owned; adapters/ports dispose only their own subscriptions.

## Verification and limits

The exact seven test files and type runner are in `tests/`. Tests use actual native/identity/import/recurrence implementations, unchanged F1/F2, actual N0 TaskService and existing physical-registry helpers. A test-only constructor wrapper retains fixture repositories; it is not a runtime writer API. Process tests preserve child PID/host/token, raw lock bytes and verified death before guarded movement. Exceptions and parent terminations have separate evidence.

See `lib/tests/native-host-n2-verification.md` for executed counts, acceptance inventories, drift/build comparisons and seal. Existing legacy broad sharing metadata selection and out-of-root captureSource exposure remain documented prior findings, not native export permissions.

Claims exclude universal power-loss durability, OneDrive/cloud rollback, hostile writers, distributed uniqueness, complete-directory rollback detection, durable event delivery, atomic N1-B consumption and atomic task/Oath persistence. No production migration, installation, restart/reload or N3 work is included. Stop for review after N2.
