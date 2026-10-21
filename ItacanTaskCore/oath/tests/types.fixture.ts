import { CommitmentTargetV1, OathEvidenceV1, resolveCommitmentTarget, assessCompletionEligibility, assessMigrationProtection, classifyTaskSharing, analyzeOathEvidence } from "../contracts";
declare const target: CommitmentTargetV1;
declare const evidence: OathEvidenceV1;
const r = resolveCommitmentTarget(target, evidence);
if (r.navigation?.kind === "native-task") { const id: string = r.navigation.id; void id;
    // @ts-expect-error source-independent navigation has no fabricated path
    r.navigation.path;
}
const c = assessCompletionEligibility(target, evidence);
if (c.state === "eligible") { const id: string | null = c.eventId; void id; }
const a = analyzeOathEvidence(evidence); const count: number = a.accounting.candidateRows;
const protection = assessMigrationProtection([{ state: "active", id: target.session.oathId, deviceId: target.session.deviceId, targets: [target] }], evidence);
const authorized: false = protection.migrationAuthorized;
if (r.task && "owner" in r.task) { const share = classifyTaskSharing(r.task, evidence.registry); const packet: null = share.packet; void packet; }
// @ts-expect-error standalone Step enrollment is outside version 1
const step: CommitmentTargetV1["original"] = { kind: "native-step", taskId: "t", stepId: "s" };
// @ts-expect-error no Oath mutation or adapter method
import { execute } from "../contracts";
void [count, authorized, step, execute];
