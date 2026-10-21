/** Private, portable, inactive read contract. No production provider is included. */
import type { CommitmentTargetV1, CommitmentResolutionV1 } from "./contracts";
import type { WorkspaceRef, NativeNavigationTarget, TaskReadiness, NativeReadTask } from "../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
export type NativeTargetV1 = CommitmentTargetV1 & { authority: Extract<CommitmentTargetV1["authority"], {kind:"native"}> };
export interface NativeHeadV1 { authorityId:string; repositoryRevision:number; revisionId:string }
export type EnrollmentOrderV1 = { version:1; kind:"unproven"; reason:string } | {
 version:1; kind:"closed-synthetic"; session:CommitmentTargetV1["session"]; targets:readonly NativeTargetV1[];
 save:{acknowledgement:"observed";snapshotDigest:string}; cut:NativeHeadV1;
 openTasks:readonly {taskId:string;taskRevision:number}[];
};
export interface CompletionProofRequestV1 { version:1;requestGeneration:number;authorityId:string;ownerContextPin:string;targets:readonly NativeTargetV1[];enrollmentCut:NativeHeadV1|null }
export interface CompletionEventEvidenceV1 {
 eventId:string;operationId:string;taskId:string|null;stepId:string|null;partitionId:string;kind:"task"|"step";
 ownerAtEvent:WorkspaceRef|null;timestamp:number|null;counted:boolean;reopenedAt:number|null;
 origin:"task-completion"|"recurrence-completion"|"initial-completed-creation"|"step-completion"|"historical-import"|"history-record"|"historical-only"|"unverifiable";
}
export interface CompletionReceiptEvidenceV1 {
 operationId:string;commandType:string;commandTaskId:string|null;requestedCompletion:boolean|null;
 repositoryRevision:number;revisionId:string;receiptDigest:string;createdEventId:string;
 taskAfter:{id:string;owner:WorkspaceRef;partitionId:string;completed:boolean;completedAt:number|null};
}
export interface CompletionTaskStateV1 {
 id:string;revision:number;owner:WorkspaceRef;partitionId:string;completed:boolean;completedAt:number|null;archivedAt:number|null;deletedAt:number|null;
 steps:readonly {id:string;taskId:string;parentStepId:string|null;order:number;completed:boolean;completedAt:number|null}[];
}
export interface CompletionProofRowV1 {
 targetIndex:number;resolution:{state:CommitmentResolutionV1["state"];reason:string};task:CompletionTaskStateV1|null;
 binding:{taskId:string;stepId:string|null;eventId:string}|null;
 event:CompletionEventEvidenceV1|null;creation:CompletionReceiptEvidenceV1|null;navigation:NativeNavigationTarget|null;
}
export interface CompletionProofReadV1 {
 version:1;privacy:"local-private";requestGeneration:number;ownerContextPin:string;providerEpoch:number;
 readiness:{state:TaskReadiness["state"];reason:string};freshness:"current-snapshot"|"stale"|"unknown";
 head:NativeHeadV1|null;partitions:readonly {id:string;revision:number;head:string}[];recovery:"intact"|"affected"|"unknown";
 cutEvidence:{cut:NativeHeadV1;state:"verified-current-lineage"|"unproven";receiptOperationId:string|null}|null;
 rows:readonly CompletionProofRowV1[];
}
export interface CompletionEvidencePortV1 {
 readCurrentCompletionProof(request:CompletionProofRequestV1,signal?:AbortSignal):Promise<CompletionProofReadV1>;
 subscribeInvalidations(listener:(change:{version:1;kind:"proof-invalidated";providerEpoch:number})=>void):()=>void;
}
export interface QualifiedCompletionV1 { version:1;state:"eligible"|"ineligible"|"unknown"|"unsupported";reason:string;displayCompleted:boolean|null }
export function assessQualifiedCompletion(target:NativeTargetV1,row:CompletionProofRowV1,proof:CompletionProofReadV1,order:EnrollmentOrderV1,orderIntact?:boolean):QualifiedCompletionV1;
export function taskState(task:NativeReadTask,partitionId:string):CompletionTaskStateV1;
export type {CompletionEffectExcerptV2,CompletionEventEvidenceV2,CompletionReceiptEvidenceV2,CompletionProofRequestV2,CompletionProofRowV2,CompletionProofReadV2,CompletionEvidencePortV2} from "../atomic-task/contracts";
import type {CompletionProofRowV2,CompletionProofReadV2} from "../atomic-task/contracts";
export function assessQualifiedCompletion(target:NativeTargetV1,row:CompletionProofRowV2,proof:CompletionProofReadV2,order:EnrollmentOrderV1,orderIntact?:boolean):QualifiedCompletionV1;
