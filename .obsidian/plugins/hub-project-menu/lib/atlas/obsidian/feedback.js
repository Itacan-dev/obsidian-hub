"use strict";
function describeOutcome(command, result, state = {}) {
    const kind = command.kind, reason = result?.reason;
    const info = (text, tone = "info", section = null) => ({ text, tone, section, detail: reason ?? null });
    if (kind === "REVIEW_STORAGE_OWNERSHIP" && result?.type === "STORAGE_OWNERSHIP_REVIEW")
        return info("Saved files are ready for ownership review. No lock or policy has changed. Review the confirmation below.");
    if (reason?.startsWith("STORAGE_REPAIR_")) {
        const explanations = {
            STORAGE_REPAIR_NOT_FOREIGN: "Saved storage no longer has the reviewed foreign lock. Review its current diagnostics before another action.",
            STORAGE_REPAIR_NOT_AVAILABLE: "Ownership repair is unavailable in this state. Review the current diagnostics; saved policy has not been reset.",
            STORAGE_REPAIR_INVALID_STATE: "The saved files could not be validated for ownership repair. Preserve the records and review their diagnostics before proceeding.",
            STORAGE_REPAIR_BUSY: "Another owner or storage repair is active. Stop competing Atlas instances before reviewing ownership again.",
            STORAGE_REPAIR_CHANGED: "Saved files changed after this ownership review. Review ownership again before attempting a repair.",
            STORAGE_REPAIR_EXPIRED: "This ownership review expired. Review ownership again; no new confirmation was applied.",
            STORAGE_REPAIR_CONFIRMATION_REQUIRED: "Confirm that this is an independent local copy or all other Atlas instances using these saved files are stopped.",
            STORAGE_REPAIR_FAILED: "Storage ownership repair could not finish. Browsing stays blocked. Review the saved-state diagnostics before trying again.",
            STORAGE_REPAIR_STALE: "This ownership review was used or no longer applies. Review the current saved files again."
        };
        return info(explanations[reason] ?? "Ownership repair was not verified. Review the saved-state diagnostics before another action.", "error", "diagnostics");
    }
    if (kind === "REPAIR_STORAGE_OWNERSHIP" && result?.status === "READY")
        return info("Storage ownership repaired and saved state reconciled. Original files were backed up; policy and timing values were preserved. No confirmation or browser request was replayed.", "success");
    if (kind === "REPAIR_STORAGE_OWNERSHIP" && result?.status === "UNINITIALIZED")
        return info("Storage ownership repaired. No saved policy was found in this copy; setup remains an explicit separate action.", "success");
    if (kind === "REPAIR_STORAGE_OWNERSHIP" && result?.status === "RECONCILING")
        return info("Storage ownership repaired, but a saved transaction still needs reconciliation. Its journal is preserved and browsing stays blocked.", "unresolved", "diagnostics");
    if (reason?.startsWith("NATIVE_") || reason === "NOT_READY" && state.status === "UNINITIALIZED")
        return info("Atlas is not ready to start this operation. Your draft is kept; open setup or recovery to continue.", "warning", state.status === "UNINITIALIZED" ? "sites" : "diagnostics");
    if (!result || reason === "TRANSPORT_UNRESOLVED" || state.status === "RECONCILING" && result.type === "BLOCKED" ||
        ["COMMIT_UNKNOWN", "RECOVERY_SAVE_UNRESOLVED"].includes(reason))
        return info("The save outcome is unresolved. Your draft is kept. Reconcile saved state before retrying; nothing will be confirmed automatically.", "unresolved", "diagnostics");
    if (state.status === "UNAVAILABLE" && state.repositoryIssue === "FOREIGN_OWNER") return info("Another computer's storage lock still prevents access. Repeated recovery cannot remove it. Open recovery to review storage ownership; your saved policy is preserved.", "error", "diagnostics");
    if (state.status === "UNAVAILABLE") return info("Saved authority is unavailable. Your draft is kept and no new change was verified. Open recovery to reconcile saved state.", "error", "diagnostics");
    if (reason === "PRESENTATION_NOT_WRITTEN") return ["RECREATE_POLICY", "RESTORE_RECOVERY", "DISCARD_RECOVERY"].includes(kind)
        ? info("A recovery metadata save did not complete. Saved copies are kept; review the current Vault and recovery state before retrying.", "warning", "vault")
        : info("Display changes were not saved. Your input is kept; retry explicitly when storage is available. Host access is unchanged.", "error");
    if (reason === "WRITE_FAILED" && state.status === "READY") return info("This change was not saved. Saved authority recovered; your input is kept. Try again explicitly within the original confirmation window when applicable.", "warning");
    if (reason === "INTEGRATION_CLOSED" || reason === "INTEGRATION_SUSPENDED") return info("This Atlas session is closed. Reopen Atlas to review saved state before another action.", "warning", "diagnostics");
    if (kind === "RECOVER" && result.status === "READY")
        return info("Saved state reconciled. Review any pending operation; nothing was automatically confirmed.", "success");
    if (result.type === "COMMITTED") {
        if (kind === "CANCEL_POLICY") return info("Proposal cancelled. Your active policy is unchanged.", "success");
        if (kind === "CANCEL_ACCESS") return info("Access request cancelled. No temporary access was granted.", "success");
        if (kind === "CANCEL_JOURNEY") return info("Journey cancelled.", "success");
        if (kind === "CONFIRM_POLICY") return info("Reviewed changes committed. The saved policy and timing terms are now active.", "success");
        if (kind === "CONFIRM_ACCESS_AND_OPEN") return info("Temporary access granted. A fresh homepage is checked before loading.", "success");
        if (kind === "START_ACCESS") return info("Access requested. Wait, then confirm explicitly; waiting alone grants no access.");
        if (kind === "DISCARD_RECOVERY") return info("Recovery copy discarded. Active policy and any pending proposal are unchanged.", "success");
        if (result.operation === "PRESENTATION" || kind === "SAVE_DISPLAY_DETAILS") return info("Display details saved. Host access is unchanged.", "success");
        if (state.snapshot?.vaultState.pendingProposal) return info("Changes submitted for Vault review. Current policy stays active until you explicitly confirm.", "success", "vault");
    }
    if (reason === "PROPOSAL_PENDING" || reason === "RECOVERY_DRAFT_PENDING")
        return info("Another change is already in Vault. Your draft is kept. Review or cancel the existing proposal first.", "warning", "vault");
    if (["STALE_DRAFT", "STALE_DESTINATION"].includes(reason))
        return info("Committed values changed. Your input is kept; review current values before retrying.", "warning");
    if (reason === "PROPOSAL_EXPIRED") return info("This proposal expired without changing policy. Recreate it in Vault for a full new wait.", "warning", "vault");
    if (["REQUEST_EXPIRED", "ACCESS_REQUEST_EXPIRED", "STALE_REQUEST"].includes(reason))
        return info("This access request expired or changed. No access was granted. Return to the destination to request access again.", "warning", "temporary");
    if (["STALE_CONTEXT", "NO_DESTINATION", "STALE_JOURNEY", "NOT_GREYLIST"].includes(reason))
        return info("This browsing context is no longer applicable. No access was granted. Return to the destination in a Note tab to continue.", "warning", "temporary");
    if (["INVALID_DESTINATION", "INVALID_HOST_ACCESS", "INVALID_CANDIDATE_POLICY"].includes(reason))
        return info("Check the destination name, category and exact hostnames. Your input is kept; URLs and wildcard hosts are not accepted.", "error");
    if (reason === "DUPLICATE_DESTINATION") return info("A destination already uses this primary hostname or identity. Your input is kept; edit the existing destination or choose another hostname.", "error", "sites");
    if (["INVALID_CONFIGURATION", "INVALID_TIMING"].includes(reason)) return info("Check the timing values. Use positive seconds and whole Journey hops. Your input is kept.", "error", "timings");
    if (reason === "NOT_READY" || reason === "PROPOSAL_NOT_EXPIRED") return info("This action is not available yet. Wait for the current operation; no access or policy was changed.");
    if (reason === "REPLACEMENT_ALREADY_SAVED") return info("The replacement proposal is already saved. Review it in Vault; do not recreate it again.", "info", "vault");
    if (["STALE_PROPOSAL", "STALE_RECOVERY", "PROPOSAL_NOT_FOUND", "ALREADY_APPLIED"].includes(reason)) return info("This operation changed or is no longer pending. Review the current Vault state.", "warning", "vault");
    if (kind === "INITIALIZE_CURATED" || kind === "INITIALIZE") {
        if (result.status === "READY") return info("Atlas is set up. Your initial rules are saved.", "success");
    }
    if (reason === "NO_POLICY_CHANGE") return info("These security values are already committed. Your draft is kept; save display details or discard the local copy.");
    if (result.type === "OPEN_REQUESTED") return info("Opening a fresh homepage through the current access checks.");
    if (result.type === "REVIEW") return info("Review the frozen changes. Confirmation remains a separate action.");
    if (result.type === "MANAGED_STATUS") return info("Managed list refresh completed. Review its current status below.");
    return info("The operation could not complete. Your input is kept and no success was verified. Review the current state before retrying.", "error", state.status !== "READY" ? "diagnostics" : null);
}
function describeAuthorityFailure(state) {
    const issue = state.repositoryIssue ?? state.reason;
    if (state.storage?.lastFailure?.cause === "CAPACITY") return "Storage is full or its quota is exhausted. Free space and explicitly recover saved state. Existing policy files are preserved; do not reset Atlas.";
    if (["ACCESS_DENIED", "READ_ONLY"].includes(state.storage?.lastFailure?.cause)) return "Atlas cannot write to its saved-state directory. Check storage access and explicitly recover saved state. Existing files are preserved.";
    const explanations = {
        FOREIGN_OWNER: "Saved state has another computer's lock. Atlas cannot determine whether that owner is still running. Review storage ownership below only for an independent local copy or after stopping all other Atlas instances using these saved files.",
        STORAGE_LOCKED: "Another owner or an interrupted lock recovery prevents access to saved state. Recovery will retry ownership; it never removes an owner whose shutdown cannot be verified.",
        COMMIT_UNRESOLVED: "A saved transaction is awaiting reconciliation. Recover saved state to check whether its exact write completed; no confirmation will be replayed.",
        JOURNAL_AUTHORITY_MISMATCH: "The transaction journal matches neither the saved state before its write nor the state after it. Recovery cannot choose the correct authority. Preserve both records and review them before authorizing a repair.",
        EXTERNAL_WRITE: "Saved state changed outside the current owner. Preserve the existing records and review the external change before repairing ownership or authority.",
        CORRUPT_STATE: "Saved authority is missing or invalid. Preserve the existing files and review a verified backup; initialization cannot replace previously initialized state.",
        CLOCK_ROLLBACK: "The current clock is earlier than a saved authority checkpoint. Check the system time before recovering saved state.",
        MANAGED_BLACKLIST_UNAVAILABLE: "The managed blacklist could not be validated. Browsing remains blocked until a verified bundle or cache is available."
    };
    return explanations[issue] ?? "Saved authority could not be verified. Review the diagnostic codes and storage access before retrying recovery. Existing state is preserved.";
}
function storageSummary(state) {
    const d = state.storage, r = state.recovery;
    if (!d) return ["Storage diagnostics are unavailable in this host."];
    return [
        "Filesystem loads: " + d.loadAttempts + " · verified: " + d.verifiedLoads + " · initialization: " + d.initialized + "/" + d.initializeAttempts,
        "Journaled write attempts: " + d.writeAttempts + " · committed: " + d.committedWrites + " · confirmed not written: " + d.notWrittenWrites + " · unknown: " + d.unknownWrites + " · conflicts: " + d.conflicts,
        "Reconciliation attempts: " + d.resolveAttempts + " · resolved: " + d.resolvedCommits + " · legacy migration attempts: " + d.migrations,
        d.lastFailure ? "Latest storage failure: " + [d.lastFailure.operation, d.lastFailure.stage, d.lastFailure.cause, d.lastFailure.outcome].join(" · ") : "No storage failure recorded in this process.",
        r ? "Automatic recovery: " + r.automaticAttempts + " attempted · " + r.automaticSucceeded + " succeeded · " + r.automaticFailed + " failed. Manual recovery: " + r.manualAttempts + " attempted · " + r.manualSucceeded + " succeeded · " + r.manualFailed + " failed. Last recovery outcome: " + r.status.toLowerCase() + "." : "",
        "These counters are local diagnostics. Recovery never repeats a confirmation, renews a deadline or resets policy."
    ];
}
module.exports = { describeOutcome, describeAuthorityFailure, storageSummary };
