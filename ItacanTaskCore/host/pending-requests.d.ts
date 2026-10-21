import type {WorkspaceRef} from "../src/contracts";
import type {ActionEnvelopeV1,NativeAuthorityV1,ApplicationActionV1} from "../application/contracts";
import type {WriterCapabilityV1, WriterRequestV1, NativeTaskWriteV1, NativeStepWriteV1} from "../writer";
import type {OperationEvidenceV3} from "../src/snapshot-read";
import type {HostReadStampV1} from "./index";
export type RetainedIntentV1=(Extract<ActionEnvelopeV1,{authority:NativeAuthorityV1}> & {action:Extract<ApplicationActionV1,{kind:"set-completion"|"set-step-completion"|"delete-tree"}>})|import("../application/contracts").AtomicActionEnvelopeV2;
export interface RequestRetentionOptionsV1 {version:1;rehearsalId:string}
export interface RetainedRequestV1 {readonly format:"itacan-native-ui-request";readonly version:1;readonly authorityId:string;readonly applicationContextId:string;readonly rehearsalId:string;readonly owner:WorkspaceRef;readonly partitionId:string;readonly operationId:string;readonly intent:RetainedIntentV1;readonly intentDigest:string;readonly writerRequest:WriterRequestV1<NativeTaskWriteV1|NativeStepWriteV1>;readonly writerRequestDigest:string;readonly commandDigest:string;readonly checksum:string}
export interface RetainedRequestPortV1 {
 prepare(capability:WriterCapabilityV1,intent:RetainedRequestV1["intent"]):Promise<RetainedRequestV1>;
 list(capability:WriterCapabilityV1):Promise<readonly Pick<RetainedRequestV1,"operationId"|"intentDigest"|"owner"|"partitionId">[]>;
 get(capability:WriterCapabilityV1,operationId:string):Promise<RetainedRequestV1>;
 reconcile(capability:WriterCapabilityV1,operationId:string):Promise<OperationEvidenceV3>;
 inspect(capability:WriterCapabilityV1,operationId:string):Promise<RequestRecoveryInspectionV1>;
 replay(capability:WriterCapabilityV1,review:RequestRecoveryInspectionV1,signal?:AbortSignal):Promise<import("../writer").WriterOutcomeV1>;
}
export interface RequestRecoveryInspectionV1 {
 readonly version:1;readonly privacy:"local-private";readonly authorityId:string;readonly applicationContextId:string;readonly operationId:string;
 readonly classification:"confirmed-committed"|"committed-refresh-unavailable"|"execution-uncertain"|"conflict"|"damaged"|"authority-unavailable";
 readonly code:string;readonly owner:WorkspaceRef|null;readonly partitionId:string|null;readonly recordChecksum:string|null;readonly commandDigest:string|null;
 readonly observation:HostReadStampV1|null;readonly receipt:OperationEvidenceV3["receipt"];readonly taskIds:readonly string[];readonly eventIds:readonly string[];
 readonly canReplay:boolean;readonly replayCode:string;
}
