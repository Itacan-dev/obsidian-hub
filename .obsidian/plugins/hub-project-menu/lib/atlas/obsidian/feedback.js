"use strict";
function describeOutcome(command, result, state = {}) {
    const kind = command.kind, reason = result?.reason;
    const info = (text, tone = "info", section = null) => ({ text, tone, section, detail: reason ?? null });
    if (reason?.startsWith("NATIVE_") || reason === "NOT_READY" && state.status === "UNINITIALIZED")
        return info("Atlas is not ready to start this operation. Your draft is kept; open setup or recovery to continue.", "warning", state.status === "UNINITIALIZED" ? "sites" : "diagnostics");
    if (!result || reason === "TRANSPORT_UNRESOLVED" || state.status === "RECONCILING" && result.type === "BLOCKED" ||
        ["COMMIT_UNKNOWN", "RECOVERY_SAVE_UNRESOLVED"].includes(reason))
        return info("The save outcome is unresolved. Your draft is kept. Reconcile saved state before retrying; nothing will be confirmed automatically.", "unresolved", "diagnostics");
    if (state.status === "UNAVAILABLE") return info("Saved authority is unavailable. Your draft is kept and no new change was verified. Open recovery to reconcile saved state.", "error", "diagnostics");
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
    const explanations = {
        FOREIGN_OWNER: "Saved state is locked by another computer. Recovery cannot establish whether that owner is still running. Stop Atlas on the other computer and review the saved state before authorizing a lock repair.",
        STORAGE_LOCKED: "Another owner or an interrupted lock recovery prevents access to saved state. Recovery will retry ownership; it never removes an owner whose shutdown cannot be verified.",
        COMMIT_UNRESOLVED: "A saved transaction is awaiting reconciliation. Recover saved state to check whether its exact write completed; no confirmation will be replayed.",
        JOURNAL_AUTHORITY_MISMATCH: "The transaction journal matches neither the saved state before its write nor the state after it. Recovery cannot choose the correct authority. Preserve both records and review them before authorizing a repair.",
        CORRUPT_STATE: "Saved authority is missing or invalid. Preserve the existing files and review a verified backup; initialization cannot replace previously initialized state.",
        CLOCK_ROLLBACK: "The current clock is earlier than a saved authority checkpoint. Check the system time before recovering saved state.",
        MANAGED_BLACKLIST_UNAVAILABLE: "The managed blacklist could not be validated. Browsing remains blocked until a verified bundle or cache is available."
    };
    return explanations[issue] ?? "Saved authority could not be verified. Review the diagnostic codes and storage access before retrying recovery. Existing state is preserved.";
}
module.exports = { describeOutcome, describeAuthorityFailure };
