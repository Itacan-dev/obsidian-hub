import { analyzeCoordinationEvidence, classifyWorkflowOutcome, type WorkflowObservationV1, type ApplicationCommitEvidenceV1, type OathEnrollmentProofProposalV1 } from "../index";
import type { EnrollmentOrderV1 } from "../../oath/completion-proof";
const observation: WorkflowObservationV1 = { version: 1, privacy: "local-private", id: "capture", kind: "inbox-task", sourceIdentity: "original-capture", preparationDigest: "a".repeat(64), preparation: "confirmed", originalIntent: "retained", authority: "matched", recovery: "intact", source: "unchanged", proof: "not-required", protocol: "observed-existing", native: [], application: [] };
const analysis = classifyWorkflowOutcome(observation);
const inactive: false = analysis.executable;
analyzeCoordinationEvidence({ version: 1, privacy: "local-private", sourceGraphDigest: "a".repeat(64), observations: [observation] });
// @ts-expect-error Evidence is not a workflow executor.
analysis.execute();
// @ts-expect-error Detached results are immutable.
analysis.executable = true;
// @ts-expect-error Only a closed workflow kind is accepted.
classifyWorkflowOutcome({ ...observation, kind: "generic-batch" });
// @ts-expect-error Raw errors are not a diagnostic input field.
classifyWorkflowOutcome({ ...observation, rawError: "private" });
// @ts-expect-error Shared projection is not supplied by this private package.
const shared: { privacy: "shared" } = analysis;
declare const ack: ApplicationCommitEvidenceV1;
const revision: number = ack.applicationRevision;
declare const proposal: OathEnrollmentProofProposalV1;
// @ts-expect-error A proposed persisted witness is not the F2 closed synthetic contract.
const synthetic: EnrollmentOrderV1 = proposal;
void [inactive, revision];
