/** Node-only, inactive disposable lifecycle and private reads. No command routing. */
import type { PartitionDefinition, RepositoryOptions, WorkspaceRef, LocationRef } from "../src/contracts";
import type { SnapshotRequestV1, CoherentSnapshotV1 } from "../src/snapshot-read";
import type { NativeHeadV1, CompletionEvidencePortV1 } from "../oath/completion-proof";
import type { TaskReadiness, TaskServiceAdapter } from "../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
import type { IdentityState } from "../identity/contracts";
export type ReadinessState=TaskReadiness["state"];
export type HostPhase="configured"|"opening"|"open"|"closing"|"closed"|"disposed";
export interface NativeAuthorityConfigV1 {version:1;scope:"inactive-disposable"|"device-private-project"|"device-private-git-project";binding?:{version:1;vaultRoot:string;vaultId:string;deviceId:string;projectId:string;localDataRoot:string}|{version:2;vaultRoot:string;vaultId:string;deviceId:string;owner:WorkspaceRef;ownerRoot:string;dashboard:string;localDataRoot:string}|import("./git-authority").GitAuthorityBindingV1;storageFormat:"private-v4";authorityId:string;directory:string;applicationContextId:string;registryId:string}
export interface CreateHostOptionsV1 {version:1;authorityId:string;partitions:readonly PartitionDefinition[];reason:string;syntheticOnly:true}
export interface OpenHostOptionsV1 {version:1;expectedAuthorityId:string;syntheticOnly:true}
export interface OwnerContextV1 {owner:WorkspaceRef;partitionId:string;root:string;dashboard:string|null;status:"active"|"future"|"shelved"|"archived";available:boolean;shared:boolean;shareApproval:null|{version:1;projectId:string;root:string;reviewDigest:string};locations:readonly LocationRef[];mounts:readonly WorkspaceRef[]}
export interface OwnerRegistrySnapshotV1 {version:1;registryId:string;applicationContextId:string;revision:string;digest:string;owners:readonly OwnerContextV1[]}
export interface OwnerRegistryPortV1 {read(signal?:AbortSignal):Promise<OwnerRegistrySnapshotV1>;subscribe(listener:()=>void):()=>void}
export interface IdentityObservationV1 {version:1;snapshot:IdentityState;planId:string}
export interface GitCreateHostOptionsV3 {version:3;authorityId:string;partitions:readonly PartitionDefinition[];reason:string;syntheticOnly:true;taskMutationVersion:1;gitSharedVersion:2;genesis?:import("../src/git-shared").GitGenesisV1}
export interface HostOptionsV1 {inventoryEvidence?:import("../shared/inventory").GitInventoryEvidencePortV1;gitSharing?:{version:1;replicaId:string};registry:OwnerRegistryPortV1;identity?:{read(signal?:AbortSignal):Promise<IdentityObservationV1|null>;subscribe(listener:()=>void):()=>void};repositoryOptions?:RepositoryOptions}
export interface HostReadStampV1 {version:1;hostEpoch:number;readGeneration:number;head:NativeHeadV1;ownerContextPin:string;identityPin:string|null}
export interface HostInvalidationV1 {version:1;kind:"snapshot-invalidated";durability:"ephemeral";hostEpoch:number;generation:number;reason:"subscribed"|"repository"|"storage"|"registry"|"identity"|"unavailable"|"closing"|"reopened"}
export interface HostFailureV1 {version:1;state:Exclude<ReadinessState,"ready">;code:string;retry:"refresh"|"explicit-reopen"|"review"}
export interface HostInfoV1 {version:1;privacy:"local-private";phase:HostPhase;authorityId:string;storeId:string|null;applicationContextId:string;storageFormat:"private-v4";wireVersion:4;logicalSchemaVersion:1|2|3|4|null;namespaces:CoherentSnapshotV1["namespaces"]|null;storage?:CoherentSnapshotV1["storage"];head:NativeHeadV1|null;hostEpoch:number;generation:number;ownerContextPin:string|null;identityPin:string|null;readiness:{state:ReadinessState;reason:string};permissions:{taskReads:"available"|"recovered-observation"|"unavailable";completionProof:"available"|"unavailable";mutations:"unsupported";history:"unsupported"}}
export type HostReadRequestV1=SnapshotRequestV1 & {ownerContextPin:string};
export type HostReadResultV1=HostFailureV1|{version:1;status:"ok";stamp:HostReadStampV1;snapshot:CoherentSnapshotV1};
/** Fresh global status admission plus bounded data from one accepted head. Pins,
 * when supplied, are expectations; omitted pins are acquired in this capture. */
export type HostScopedRequestV2={version:2;authorityId:string;ownerContextPin?:string;identityPin?:string|null} & (
 {selection:"tasks";owners:readonly WorkspaceRef[];includeArchived?:boolean;includeDeleted?:boolean;includeConsumerFacts?:boolean;targets?:never} |
 {selection:"editor";owners:readonly [WorkspaceRef];targets:import("../src/editor-read").EditorReadRequestV1["targets"];includeArchived?:never;includeDeleted?:never});
export type HostScopedFailureV2=Omit<HostFailureV1,"version"> & {version:2;kind:"scoped-capture"};
export type HostScopedResultV2<S extends CoherentSnapshotV1=CoherentSnapshotV1>=HostScopedFailureV2|{version:2;kind:"scoped-capture";status:"ok";info:Readonly<HostInfoV1>;stamp:HostReadStampV1;snapshot:S};
export interface NativeRepositoryHostV1 {info():Readonly<HostInfoV1>;create(options:(Omit<GitCreateHostOptionsV3,"syntheticOnly"> & {verifiedCutover:true})|GitCreateHostOptionsV3|CreateHostOptionsV1|import("../atomic-task/contracts").AtomicCreateHostOptionsV2|{version:2;authorityId:string;partitions:readonly PartitionDefinition[];reason:string;verifiedCutover:true;taskMutationVersion:1}):Promise<HostInfoV1>;open(options:OpenHostOptionsV1|{version:1;expectedAuthorityId:string;verifiedCutover:true}):Promise<HostInfoV1>;refresh():Promise<HostInfoV1>;read(request:HostReadRequestV1,signal?:AbortSignal):Promise<HostReadResultV1>;read(request:import("../src/editor-read").EditorReadRequestV1 & {ownerContextPin:string},signal?:AbortSignal):Promise<HostFailureV1|{version:1;status:"ok";stamp:HostReadStampV1;snapshot:import("../src/editor-read").EditorSnapshotV1}>;subscribe(listener:(change:HostInvalidationV1)=>void):()=>void;close():Promise<void>;dispose():Promise<void>}
export interface NativeRepositoryHostV1 {
 readScoped(request:Extract<HostScopedRequestV2,{selection:"editor"}>,signal?:AbortSignal):Promise<HostScopedResultV2<import("../src/editor-read").EditorSnapshotV1>>;
 readScoped(request:HostScopedRequestV2,signal?:AbortSignal):Promise<HostScopedResultV2>;
}
export function createNativeRepositoryHost(config:NativeAuthorityConfigV1,options:HostOptionsV1):NativeRepositoryHostV1;
export function inspectNativeRepository(options:{version:1;directory:string;expectedAuthorityId:string;sourceFormat:"private-v4"|"stopped-e2-flat-v1"}):Promise<{version:1;authority:"diagnostic";writable:false;authoritative:false;sourceFormat:string;authorityId:string;codes:readonly string[];validatedHeader:boolean}>;
export function createNativeReadAdapter(host:NativeRepositoryHostV1):TaskServiceAdapter;
export function createCompletionEvidencePort(host:NativeRepositoryHostV1):CompletionEvidencePortV1 & import("../oath/completion-proof").CompletionEvidencePortV2 & {dispose():void};
export function registryDigest(snapshot:Omit<OwnerRegistrySnapshotV1,"digest">|OwnerRegistrySnapshotV1):string;

export interface NativeRepositoryHostV1 {readOperation(request:import("../src/snapshot-read").OperationReadRequestV3 & {ownerContextPin:string;identityPin:string|null},signal?:AbortSignal):Promise<HostFailureV1|{version:1;status:"ok";stamp:HostReadStampV1;snapshot:import("../src/snapshot-read").OperationSnapshotV3}>}

export interface NativeRepositoryHostV1 {readHistory(request:import("../src/history-read").HistoryReadRequestV4,signal?:AbortSignal):Promise<HostFailureV1|{version:4;status:"ok";stamp:HostReadStampV1;snapshot:import("../src/history-read").HistorySnapshotV4}>}
