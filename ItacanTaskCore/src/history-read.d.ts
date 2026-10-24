import type {WorkspaceRef} from "./contracts";
import type {CoherentSnapshotV1} from "./snapshot-read";
export interface HistoryReadRequestV4 {version:4;authorityId:string;owners:readonly WorkspaceRef[];selection:"history"}
export interface HistoryEventV1 {eventId:string;taskId:string|null;stepId:string|null;partitionId:string;kind:"task"|"step";timestamp:number|null;title:string;parentTitle:string|null;ownerAtEvent:WorkspaceRef|null;attribution:null|{label:string;status:string};counted:boolean;reopenedAt:number|null;origin:string;replication?:import("./git-shared").GitHistoryProvenanceV1;receipt:{operationId:string;repositoryRevision:number;revisionId:string;digest:string;index:number};navigation:{state:"available"|"deleted"|"owner-mismatch"|"retired-step"|"unbound"|"unsupported";taskId:string|null;stepId:string|null}}
export interface HistoryEvidenceV1 {version:1;events:readonly HistoryEventV1[];overlap:null|{captureDigest:string;rows:readonly {key:string;ordinal:number;digest:string;occurrence:number;suppressed:boolean;eventId:string|null}[];representedEventIds:readonly string[]}}
export type HistorySnapshotV4=Omit<CoherentSnapshotV1,"version"> & {version:4;history:HistoryEvidenceV1};
export function validateRequest(request:unknown):HistoryReadRequestV4;
export function projectHistory(state:unknown,request:HistoryReadRequestV4,storage?:unknown):HistorySnapshotV4;
