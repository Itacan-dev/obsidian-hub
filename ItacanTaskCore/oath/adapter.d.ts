import type { NativeReadTask, NativeNavigationTarget, TaskReadProtocol, TaskReadiness, WorkspaceRef } from "../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
import type { CommitmentTargetV1, CommitmentResolutionV1 } from "./contracts";
import type { NativeTargetV1, EnrollmentOrderV1, CompletionEvidencePortV1, QualifiedCompletionV1 } from "./completion-proof";
export interface OathAdapterOptionsV1 {
 completionProofVersion?:1;
 commitment:{session:CommitmentTargetV1["session"];owner:WorkspaceRef;targets:readonly NativeTargetV1[]};
 authorityId:string;ownerContextPin:string;enrollmentOrder:EnrollmentOrderV1;
 reads:TaskReadProtocol;evidence:CompletionEvidencePortV1;
}
export interface OathAdapterSnapshotV1 {
 readonly version:1;readonly privacy:"local-private";readonly generation:number;
 readonly readiness:Readonly<{state:TaskReadiness["state"];reason:string}>;
 readonly rows:readonly DeepReadonly<{targetIndex:number;resolution:{state:CommitmentResolutionV1["state"];reason:string};task:NativeReadTask|null;eligibility:QualifiedCompletionV1;navigation:NativeNavigationTarget|null}>[];
 readonly diagnostics:readonly string[];
}
export type DeepReadonly<T> = T extends object ? {readonly [K in keyof T]:DeepReadonly<T[K]>} : T;
export interface InactiveOathAdapterV1 {
 getSnapshot():OathAdapterSnapshotV1;
 refresh():Promise<OathAdapterSnapshotV1>;
 subscribe(listener:()=>void):()=>void;
 dispose():void;
}
export function createOathAdapter(options:OathAdapterOptionsV1):InactiveOathAdapterV1;
export type OathAdapterOptionsV2=Omit<OathAdapterOptionsV1,"completionProofVersion"|"evidence"> & {completionProofVersion:2;evidence:import("./completion-proof").CompletionEvidencePortV2};
export function createOathAdapter(options:OathAdapterOptionsV2):InactiveOathAdapterV1;
