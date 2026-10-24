import type {Command,CommandBase,NativeTask,HistoryRecord,Partition,Receipt,CompletionRef} from "./contracts";
import type {ExternalReservations} from "./recurrence";
export interface GitGenesisV1 {authorityId:string;revisionId:string;partition:Partition}
export interface GitViewV1 {tasks:NativeTask[];history:HistoryRecord[];bindings:CompletionRef[];retiredStepIds:string[]}
export interface GitPublicationFrameV2 {version:2;id:string;parent:string|null;replicaId:string;clock:number;allocations:string[];inventory:ExternalReservations|import("../shared/inventory").GitReservationWitnessV2;receipt:Receipt;packet:null|{head:string|null;frameIds:string[]};delta:{history:HistoryRecord[];bindings:{remove:string[];add:CompletionRef[]};retiredStepIds:string[]}}
export interface GitOriginNamespaceV2 {format:"itacan-git-origin-state";version:2;genesis:GitGenesisV1;head:string|null;frames:GitPublicationFrameV2[]}
export interface GitPacketV3 {format:"itacan-git-native";version:3;genesis:GitGenesisV1;head:string|null;frames:GitPublicationFrameV2[]}
export interface GitConflictV1 {taskId:string;origins:string[];digest:string}
export interface GitApplicationSummaryV1 {version:1;acceptedOrigins:string[];conflicts:GitConflictV1[]}
export interface GitOriginReplayV1 {version:1;originId:string;application:{operationId:string;repositoryRevision:number;revisionId:string}}
export type GitReceiveCommandV2=CommandBase & {type:"git.receive";expectedRepositoryRevision:number;payload:{version:2;authorityId:string;projectId:string;partitionId:string;packetDigest:string;head:string|null}};
export interface GitReplicationEvidenceV1 {version:1;packet:GitPacketV3}
export interface GitHistoryProvenanceV1 {version:1;originId:string;operationId:string;repositoryRevision:number;revisionId:string;receiptDigest:string}
export function hash(value:unknown):string;
export function packet(namespace:GitOriginNamespaceV2,head?:string|null,ids?:readonly string[]):GitPacketV3;
export function namespace(packet:GitPacketV3):GitOriginNamespaceV2;
export function validateState(state:unknown):Promise<unknown>;
export function receiveCommand(state:{storeId:string;revision:number;partitions:readonly Pick<Partition,"id"|"owner">[]},packet:GitPacketV3,operationId:string):GitReceiveCommandV2;
