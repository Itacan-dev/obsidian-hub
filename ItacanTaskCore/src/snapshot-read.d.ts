import type { NativeTask, WorkspaceRef, RepositoryInfo } from "./contracts";
import type { NativeHeadV1, CompletionEventEvidenceV1, CompletionReceiptEvidenceV1 } from "../oath/completion-proof";
export interface SnapshotTargetV1 { taskId:string;owner:WorkspaceRef;partitionId:string;stepId?:string|null;preparation?:{repositoryRevision:number;revisionId:string;taskRevision:number} }
export type SnapshotRequestV1 = {version:1;authorityId:string;owners:readonly WorkspaceRef[];cut?:NativeHeadV1|null} & (
 {selection:"tasks";includeArchived?:boolean;includeDeleted?:boolean;includeConsumerFacts?:boolean;targets?:never} |
 {selection:"status";includeArchived?:boolean;includeDeleted?:boolean;includeConsumerFacts?:never;targets?:never} |
 {selection:"targets"|"completions";targets:readonly SnapshotTargetV1[];includeArchived?:never;includeDeleted?:never});
export type CanonicalTaskSnapshotV1 = Pick<NativeTask,"id"|"revision"|"partitionId"|"owner"|"location"|"title"|"description"|"completed"|"completedAt"|"importance"|"start"|"due"|"phase"|"steps"|"archivedAt"|"deletedAt"> & {kind:"native-task-snapshot";consumerFacts?:{version:1;recurrenceMember:boolean}};
export interface TargetSnapshotV1 {index:number;taskId:string;disposition:"resolved"|"missing"|"deleted"|"owner-mismatch"|"quarantined"|"pending-native-publication"|"retired-step"|"kind-mismatch"|"missing-step";task:CanonicalTaskSnapshotV1|null;preparation:null|{repositoryRevision:number;revisionId:string;taskRevision:number;open:true}}
export interface CompletionSnapshotV1 {index:number;binding:{taskId:string;stepId:string|null;eventId:string}|null;event:CompletionEventEvidenceV1|null;creation:CompletionReceiptEvidenceV1|null}
export interface CoherentSnapshotV1 {
 version:1;privacy:"local-private";authorityId:string;head:NativeHeadV1;logicalSchemaVersion:1|2|3|4;
 namespaces:{recurrence:1|2|null;historyImport:1|null};storage:RepositoryInfo["storage"]|null;
 partitions:readonly {id:string;owner:WorkspaceRef;revision:number;head:string|null}[];
 readiness:{state:"ready"|"recovering";reason:string};recovery:{state:"intact"|"fenced"|"unknown";selectedScope:"unaffected"|"affected"|"unproven"};
 tasks:readonly CanonicalTaskSnapshotV1[];targets:readonly TargetSnapshotV1[];completions:readonly CompletionSnapshotV1[];
 cutEvidence:null|{cut:NativeHeadV1;state:"verified-current-lineage"|"unproven";receiptOperationId:string|null};
}
export function projectSnapshot(state:unknown,request:SnapshotRequestV1,storage?:unknown):CoherentSnapshotV1;
import type {CompletionEventEvidenceV2,CompletionReceiptEvidenceV2} from "../oath/completion-proof";
export type SnapshotRequestV2=Omit<Extract<SnapshotRequestV1,{selection:"targets"|"completions"}>,"version"|"selection"> & {version:2;selection:"completions"};
export type CompletionSnapshotV2=Omit<CompletionSnapshotV1,"event"|"creation"> & {event:CompletionEventEvidenceV2|null;creation:CompletionReceiptEvidenceV2|null};
export type CoherentSnapshotV2=Omit<CoherentSnapshotV1,"version"|"completions"> & {version:2;completions:readonly CompletionSnapshotV2[]};
export function validateRequest(request:unknown):SnapshotRequestV1|SnapshotRequestV2|import("./editor-read").EditorReadRequestV1|OperationReadRequestV3|import("./history-read").HistoryReadRequestV4;
export function projectSnapshot(state:unknown,request:SnapshotRequestV2,storage?:unknown):CoherentSnapshotV2;
export function projectSnapshot(state:unknown,request:import("./editor-read").EditorReadRequestV1,storage?:unknown):import("./editor-read").EditorSnapshotV1;

export interface OperationReadRequestV3 {version:3;authorityId:string;owners:readonly [WorkspaceRef];selection:"operation";operationId:string;commandDigest:string}
export interface OperationEvidenceV3 {state:"committed"|"missing"|"conflict"|"unavailable";code:string;operationId:string;receipt:null|{operationId:string;repositoryRevision:number;revisionId:string};taskIds:readonly string[];eventIds:readonly string[]}
export type OperationSnapshotV3=Omit<CoherentSnapshotV1,"version"> & {version:3;operation:OperationEvidenceV3};
export function projectSnapshot(state:unknown,request:OperationReadRequestV3,storage?:unknown):OperationSnapshotV3;

export function projectSnapshot(state:unknown,request:import("./history-read").HistoryReadRequestV4,storage?:unknown):import("./history-read").HistorySnapshotV4;
