import {createOathAdapter, type OathAdapterOptionsV1} from "../adapter";
import {assessQualifiedCompletion, type CompletionEvidencePortV1, type CompletionProofRequestV1, type CompletionProofReadV1, type EnrollmentOrderV1} from "../completion-proof";
declare const options: OathAdapterOptionsV1;
declare const proof: CompletionProofReadV1;
const adapter = createOathAdapter(options);
adapter.subscribe(() => { const state = adapter.getSnapshot(); const privacy: "local-private" = state.privacy; void privacy; });
void adapter.refresh(); adapter.dispose();
declare const port: CompletionEvidencePortV1;
declare const request: CompletionProofRequestV1;
void port.readCurrentCompletionProof(request, new AbortController().signal);
port.subscribeInvalidations(change => { const kind: "proof-invalidated" = change.kind; void kind; });
assessQualifiedCompletion(options.commitment.targets[0], proof.rows[0], proof, options.enrollmentOrder);
const unknown: EnrollmentOrderV1 = {version:1,kind:"unproven",reason:"NO_ORDER"}; void unknown;
// @ts-expect-error boolean completion assertions are not enrollment evidence
const falseProof: EnrollmentOrderV1 = {version:1,wasCompletedAfterEnrollment:true}; void falseProof;
// @ts-expect-error no mutation command interface on an inactive read adapter
adapter.execute({type:"task.complete"});
// @ts-expect-error snapshots are immutable
adapter.getSnapshot().rows = [];
// @ts-expect-error nested task/Step snapshots are immutable too
adapter.getSnapshot().rows[0].task!.steps[0].completed = true;
// @ts-expect-error arbitrary event/binding overrides are not request fields
port.readCurrentCompletionProof({...request, bindings:[]});
// @ts-expect-error future proof versions require a new contract
port.readCurrentCompletionProof({...request, version:2});
