import type {WorkspaceRef} from "../src/contracts";
import type {ActionEnvelopeV1,NativeAuthorityV1,ApplicationActionV1} from "../application/contracts";
import type {WriterCapabilityV1, WriterRequestV1, NativeTaskWriteV1, NativeStepWriteV1} from "../writer";
import type {OperationEvidenceV3} from "../src/snapshot-read";
import type {HostReadStampV1} from "./index";
export type RetainedIntentV1=(Extract<ActionEnvelopeV1,{authority:NativeAuthorityV1}> & {action:Extract<ApplicationActionV1,{kind:"set-completion"|"set-step-completion"|"delete-tree"}>})|import("../application/contracts").AtomicActionEnvelopeV2;
export interface RequestRetentionOptionsV1 {version:1;rehearsalId:string}
export interface RequestRetentionOptionsV2 {version:2;rehearsalId:string}
export interface RetainedRequestV1 {readonly format:"itacan-native-ui-request";readonly version:1;readonly authorityId:string;readonly applicationContextId:string;readonly rehearsalId:string;readonly owner:WorkspaceRef;readonly partitionId:string;readonly operationId:string;readonly intent:RetainedIntentV1;readonly intentDigest:string;readonly writerRequest:WriterRequestV1<NativeTaskWriteV1|NativeStepWriteV1>;readonly writerRequestDigest:string;readonly commandDigest:string;readonly checksum:string}
export interface PrivateSaveNonexecutionProofV1 {readonly format:"itacan-private-save-nonexecution";readonly version:1;readonly authorityId:string;readonly operationId:string;readonly commandDigest:string;readonly taskId:string;readonly expectedRepositoryRevision:number;readonly expectedTaskRevision:number;readonly predecessorRevisionId:string;readonly head:{readonly repositoryRevision:number;readonly revisionId:string};readonly receiptCoverageDigest:string;readonly supersedingTaskRevision:number;readonly supersedingTaskDigest:string}
export interface PrivateSaveRejectionReviewV1 {readonly operationId:string;readonly state:"reviewable-nonexecution"|"proven-not-executed";readonly recordChecksum?:string;readonly proof:PrivateSaveNonexecutionProofV1}
export interface RejectedPrivateSaveOutcomeV1 {readonly state:"rejected";readonly code:"PROVEN_NOT_EXECUTED";readonly operationId:string;readonly receipt:null;readonly taskIds:readonly [];readonly eventIds:readonly []}
export interface RetainedRequestPortV1 {
 reviewPrivateSaveRejection(capability:WriterCapabilityV1,operationId:string):Promise<PrivateSaveRejectionReviewV1>;
 concludePrivateSaveRejection(capability:WriterCapabilityV1,review:PrivateSaveRejectionReviewV1):Promise<{readonly operationId:string;readonly state:"proven-not-executed"}>;
 prepare(capability:WriterCapabilityV1,intent:RetainedRequestV1["intent"]):Promise<RetainedRequestV1>;
 assertResolved(capability:WriterCapabilityV1):Promise<void>;
 list(capability:WriterCapabilityV1):Promise<readonly Pick<RetainedRequestV1,"operationId"|"intentDigest"|"owner"|"partitionId">[]>;
 get(capability:WriterCapabilityV1,operationId:string):Promise<RetainedRequestV1>;
 reconcile(capability:WriterCapabilityV1,operationId:string):Promise<OperationEvidenceV3|RejectedPrivateSaveOutcomeV1>;
 inspect(capability:WriterCapabilityV1,operationId:string):Promise<RequestRecoveryInspectionV1>;
 replay(capability:WriterCapabilityV1,review:RequestRecoveryInspectionV1,signal?:AbortSignal):Promise<import("../writer").WriterOutcomeV1>;
}
export interface RetainedGitRequestV2 extends Omit<RetainedRequestV1,"format"|"version"|"intent"|"writerRequest"> {readonly format:"itacan-native-shared-request";readonly version:2;readonly intent:{version:1;kind:"git-receive";prepared:import("../writer").PreparedGitReceiveV1};readonly writerRequest:import("../writer").WriterRequestV1<import("../writer").NativeSharedWriteV1>}
export interface BootstrapRejectionProofV1 {readonly version:1;readonly kind:"bootstrap-empty-location-catalog";readonly code:"REJECTED_BEFORE_COMMIT";readonly genesis:import("../src/git-shared").GitGenesisV1;readonly originalOwnerContextPin:string;readonly reviewedOwnerContextPin:string;readonly inventoryPin:string;readonly phasePin:string}
export interface BootstrapRejectionReviewV1 {readonly operationId:string;readonly state:"reviewable-rejection"|"rejected-before-commit";readonly recordChecksum?:string;readonly proof:BootstrapRejectionProofV1}
export interface RejectedBootstrapOutcomeV1 {readonly state:"rejected";readonly code:"REJECTED_BEFORE_COMMIT";readonly operationId:string;readonly receipt:null;readonly taskIds:readonly [];readonly eventIds:readonly []}
export interface RetainedGitRequestPortV2 extends Omit<RetainedRequestPortV1,"get"|"reconcile"> {
 get(capability:WriterCapabilityV1,operationId:string):Promise<RetainedRequestV1|RetainedGitRequestV2>;
 reconcile(capability:WriterCapabilityV1,operationId:string):Promise<OperationEvidenceV3|RejectedBootstrapOutcomeV1|RejectedPrivateSaveOutcomeV1>;
 reviewBootstrapRejection(capability:WriterCapabilityV1,operationId:string):Promise<BootstrapRejectionReviewV1>;
 concludeBootstrapRejection(capability:WriterCapabilityV1,review:BootstrapRejectionReviewV1):Promise<{readonly operationId:string;readonly state:"rejected-before-commit"}>;
}
export interface RequestRecoveryInspectionV1 {
 readonly version:1;readonly privacy:"local-private";readonly authorityId:string;readonly applicationContextId:string;readonly operationId:string;
 readonly classification:"confirmed-committed"|"committed-refresh-unavailable"|"confirmed-rejected"|"execution-uncertain"|"conflict"|"damaged"|"authority-unavailable";
 readonly code:string;readonly owner:WorkspaceRef|null;readonly partitionId:string|null;readonly recordChecksum:string|null;readonly commandDigest:string|null;
 readonly observation:HostReadStampV1|null;readonly receipt:OperationEvidenceV3["receipt"];readonly taskIds:readonly string[];readonly eventIds:readonly string[];
 readonly canReplay:boolean;readonly replayCode:string;
}

export interface RetainedPersonalRequestV3 extends Omit<RetainedRequestV1,"format"|"version"|"intent"|"writerRequest"> {readonly format:"itacan-native-personal-request";readonly version:3;readonly intent:{version:1;kind:"personal-operation";prepared:import("../writer").PreparedPersonalV1};readonly writerRequest:import("../writer").WriterRequestV1<import("../personal/contracts").PersonalCommandV1>}
export interface RetainedPersonalPortV3 extends Omit<RetainedRequestPortV1,"get"> {get(capability:WriterCapabilityV1,operationId:string):Promise<RetainedRequestV1|RetainedPersonalRequestV3>}

export interface RetainedPersonalRequestV4 extends Omit<RetainedRequestV1,"format"|"version"|"intent"|"writerRequest"> {readonly format:"itacan-native-personal-request";readonly version:4;readonly intent:{version:2;kind:"personal-operation";prepared:import("../writer").PreparedPersonalV2};readonly writerRequest:import("../writer").WriterRequestV1<import("../personal/contracts-v2").PersonalCommandV2>}
export interface RetainedPersonalPortV4 extends Omit<RetainedRequestPortV1,"get"|"reconcile"> {get(capability:WriterCapabilityV1,operationId:string):Promise<RetainedRequestV1|RetainedPersonalRequestV3|RetainedPersonalRequestV4>;reconcile(capability:WriterCapabilityV1,operationId:string):Promise<OperationEvidenceV3|RejectedBootstrapOutcomeV1|RejectedPrivateSaveOutcomeV1>}
