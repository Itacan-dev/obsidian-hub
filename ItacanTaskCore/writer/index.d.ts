import type {AtomicTaskSummaryV1} from "../src/atomic-task";
import type {Command, WorkspaceRef, PhaseRef, NativeTask} from "../src/contracts";
import type {HostOptionsV1, NativeAuthorityConfigV1, NativeRepositoryHostV1} from "../host";
import type {ExternalReservations} from "../src/recurrence";
export interface WriterCapabilityV1 {readonly version:1;readonly privacy:"local-private";readonly __opaqueWriterCapability:unique symbol}
type CleanStep<T> = Omit<T,"createdAt"|"modifiedAt"> & {createdAt?:never;modifiedAt?:never};
type CleanCreate<T> = Omit<T,"migration"|"captureSource"|"createdAt"|"modifiedAt"|"archivedAt"|"deletedAt"|"steps"> & {migration?:never;captureSource?:never;createdAt?:never;modifiedAt?:never;archivedAt?:never;deletedAt?:never;steps?:T extends {steps?: (infer S)[]} ? CleanStep<S>[] : never};
type WithoutCoord<C> = Omit<C,"coordination"> & {coordination?:never};
type Narrow<C> = C extends {type:"task.create";payload:{task:infer T}} ? WithoutCoord<Omit<C,"payload">> & {payload:{task:CleanCreate<T>}} :
 C extends {type:"task.createMany";payload:{tasks:(infer T)[]}} ? WithoutCoord<Omit<C,"payload">> & {payload:{tasks:CleanCreate<T>[]}} :
 C extends {type:"step.add";payload:{step:infer T}} ? WithoutCoord<Omit<C,"payload">> & {payload:{step:CleanStep<T>}} :
 C extends {type:"task.update";payload:{patch:infer T}} ? WithoutCoord<Omit<C,"payload">> & {payload:{patch:Omit<T,"captureSource"> & {captureSource?:never}}} :
 C extends {type:"task.editStructure";payload:infer T} ? T extends {content:infer X} ? WithoutCoord<Omit<C,"payload">> & {payload:Omit<T,"content"> & {content:Omit<X,"appendOriginals"> & {appendOriginals:[]}}} : never : WithoutCoord<C>;
export type NativeTaskWriteV1=Narrow<Extract<Command,{type:"task.save"|"task.createRich"|"task.create"|"task.createMany"|"task.update"|"task.relocate"|"task.complete"|"task.archive"|"task.delete"|"task.editStructure"}>>;
export type NativeStepWriteV1=Narrow<Extract<Command,{type:"step.add"|"step.update"|"step.reorder"|"step.delete"|"step.complete"}>>;
export type NativeRecurrenceWriteV1=Narrow<Extract<Command,{type:`recurrence.${string}`}>>;
export type NativeSharedWriteV1=WithoutCoord<import("../src/git-shared").GitReceiveCommandV2>;
export interface WriterGrantScopeV1 {version:1;owners:readonly {owner:WorkspaceRef;partitionId:string}[];commands:readonly (NativeTaskWriteV1|NativeStepWriteV1|NativeRecurrenceWriteV1|NativeSharedWriteV1|import("../personal/contracts").PersonalCommandV1|import("../personal/contracts-v2").PersonalCommandV2)["type"][]}
export interface WriterPolicyV1 extends WriterGrantScopeV1 {inventory:ExternalReservations|import("../shared/inventory").GitReservationWitnessV2;phases:{version:1;revision:string;values:readonly PhaseRef[]}}
export interface WriterScopeV1 {authorityId:string;ownerContextPin:string;identityPin:string|null;inventoryPin:string;phasePin:string;partitions:readonly {id:string;owner:WorkspaceRef;expectedRevision:number}[]}
export interface WriterRequestV1<C> {version:1;reason:string;scope:WriterScopeV1;command:C & {expectedRepositoryRevision:number}}
interface Base {version:1;privacy:"local-private";operationId:string}
export type WriterOutcomeV1=(Base & {status:"committed";receipt:{operationId:string;repositoryRevision:number;revisionId:string};replayed:boolean;tasks:readonly Pick<NativeTask,"id"|"revision"|"partitionId">[];eventIds:readonly string[];atomicTask?:AtomicTaskSummaryV1;gitShared?:import("../src/git-shared").GitApplicationSummaryV1;personal?:import("../personal/contracts").PersonalSummaryV1|import("../personal/contracts-v2").PersonalSummaryV2;originReplay?:import("../src/git-shared").GitOriginReplayV1;recurrence?:{seriesId:string;completionEventId:string|null;successorId:string|null;reused:boolean;originalGenerationOperationId:string|null}})|(Base & {status:"rejected";code:string;attempt:"not-started"|"not-published";priorOutcome:"not-checked";retry:"explicit-reopen"|"review-or-refresh"})|(Base & {status:"cancelled";boundary:"before-admission"|"before-publication";priorOutcome:"not-checked"})|(Base & {status:"uncertain";code:"ACKNOWLEDGEMENT_LOST"|"PUBLICATION_UNCERTAIN"|"OUTCOME_RECONCILIATION_REQUIRED"|"OPERATION_CONFLICT";retry:"identical-operation-after-authoritative-reconciliation"});
export interface NativeWriterPortV1 {task(capability:WriterCapabilityV1,request:WriterRequestV1<NativeTaskWriteV1>,signal?:AbortSignal):Promise<WriterOutcomeV1>;step(capability:WriterCapabilityV1,request:WriterRequestV1<NativeStepWriteV1>,signal?:AbortSignal):Promise<WriterOutcomeV1>;recurrence(capability:WriterCapabilityV1,request:WriterRequestV1<NativeRecurrenceWriteV1>,signal?:AbortSignal):Promise<WriterOutcomeV1>}
export interface NativeWriterSessionV1 {readonly host:NativeRepositoryHostV1;readonly writer:NativeWriterPortV1;authorize(scope:WriterGrantScopeV1):Promise<WriterCapabilityV1>;revoke(capability:WriterCapabilityV1):void;close():Promise<void>;dispose():Promise<void>}
export interface PreparedGitReceiveV1 {readonly version:1;readonly request:WriterRequestV1<NativeSharedWriteV1>;readonly packet:import("../src/git-shared").GitPacketV3;readonly noop?:true}
export interface GitSharedPortV1 {status(capability:WriterCapabilityV1):Promise<{readonly version:1;readonly authorityId:string;readonly head:string|null;readonly state:"conflicting"|"ready";readonly acceptedOriginCount:number;readonly conflicts:readonly import("../src/git-shared").GitConflictV1[]}>;export(capability:WriterCapabilityV1):Promise<import("../src/git-shared").GitPacketV3>;prepare(capability:WriterCapabilityV1,packet:import("../src/git-shared").GitPacketV3,operationId:string):Promise<PreparedGitReceiveV1>;receive(capability:WriterCapabilityV1,prepared:PreparedGitReceiveV1,signal?:AbortSignal):Promise<WriterOutcomeV1>;reconcile(capability:WriterCapabilityV1,prepared:PreparedGitReceiveV1):Promise<import("../src/snapshot-read").OperationSnapshotV3["operation"]|{state:"unavailable";code:string}>}
export interface GitNativeWriterSessionV1 extends NativeWriterSessionV1 {readonly shared:GitSharedPortV1}
export interface RetainedGitNativeWriterSessionV2 extends GitNativeWriterSessionV1 {readonly requests:import("../host/pending-requests").RetainedGitRequestPortV2}
export interface PreparedPersonalV1 {readonly version:1;readonly request:WriterRequestV1<import("../personal/contracts").PersonalCommandV1>;readonly evidence:{version:1;binding:import("../personal/contracts").PersonalBindingV1;seed:import("../personal/contracts").PersonalSeedV1;members:import("../personal/contracts").PersonalMemberV1[];packet:import("../personal/contracts").PersonalPacketV1|null};readonly noop?:true}
export interface PersonalPortV1 {
 export(capability:WriterCapabilityV1):Promise<import("../personal/contracts").PersonalPacketV1>;
 status(capability:WriterCapabilityV1):Promise<{version:1;authorityId:string;state:"conflicting"|"ready";head:string|null;conflicts:import("../personal/contracts").PersonalSummaryV1["conflicts"];frames:number;remainingFrames:number}>;
 prepare(capability:WriterCapabilityV1,packet:import("../personal/contracts").PersonalPacketV1,operationId:string):Promise<PreparedPersonalV1>;
 prepareEnrollment(capability:WriterCapabilityV1,type:"personal.enroll"|"personal.bootstrap",operationId:string):Promise<PreparedPersonalV1>;
 receive(capability:WriterCapabilityV1,prepared:PreparedPersonalV1,signal?:AbortSignal):Promise<WriterOutcomeV1>;
 confirmAccepted(capability:WriterCapabilityV1,packet:import("../personal/contracts").PersonalPacketV1):Promise<{operationId:string;repositoryRevision:number;revisionId:string}>;
 inspectConflict(capability:WriterCapabilityV1,taskId:string):Promise<import("../personal/contracts").PersonalConflictV1[]>;
}
export interface PersonalWriterSessionV1 extends NativeWriterSessionV1 {readonly personal:PersonalPortV1;readonly requests:import("../host/pending-requests").RetainedPersonalPortV3}
export interface PreparedPersonalV2 {readonly version:2;readonly request:WriterRequestV1<import("../personal/contracts-v2").PersonalCommandV2>;readonly evidence:{version:2;binding:import("../personal/contracts-v2").PersonalBindingV2;seed:import("../personal/contracts").PersonalSeedV1;members:import("../personal/contracts").PersonalMemberV1[];packet:import("../personal/contracts-v2").PersonalPacketV2|null;review:import("../personal/contracts-v2").ResolutionReviewV2|null};readonly noop?:true}
export interface PersonalPortV2 {
 export(capability:WriterCapabilityV1):Promise<import("../personal/contracts-v2").PersonalPacketV2>;
 status(capability:WriterCapabilityV1):Promise<{version:2;authorityId:string;state:"ready"|"conflicting";head:string|null;conflicts:import("../personal/contracts-v2").PersonalSummaryV2["conflicts"];frames:number;remainingFrames:number;resolutions:{operationId:string;taskId:string;originId:string}[]}>;
 prepare(capability:WriterCapabilityV1,packet:import("../personal/contracts-v2").PersonalPacketV2,operationId:string):Promise<PreparedPersonalV2>;
 prepareEnrollment(capability:WriterCapabilityV1,type:"personal.enroll"|"personal.bootstrap",operationId:string):Promise<PreparedPersonalV2>;
 prepareUpgrade(capability:WriterCapabilityV1,operationId:string):Promise<PreparedPersonalV2>;
 receive(capability:WriterCapabilityV1,prepared:PreparedPersonalV2,signal?:AbortSignal):Promise<WriterOutcomeV1>;
 inspectConflict(capability:WriterCapabilityV1,id:string):Promise<import("../personal/contracts-v2").PersonalConflictV2[]>;
 reviewResolution(capability:WriterCapabilityV1,id:string,origin:string):Promise<import("../personal/contracts-v2").ResolutionReviewV2>;
 prepareResolution(capability:WriterCapabilityV1,review:import("../personal/contracts-v2").ResolutionReviewV2,operationId:string):Promise<PreparedPersonalV2>;
 resolve(capability:WriterCapabilityV1,prepared:PreparedPersonalV2,signal?:AbortSignal):Promise<WriterOutcomeV1>;
 inspectResolution(capability:WriterCapabilityV1,id:string):Promise<import("../personal/contracts-v2").ResolutionInspectionV2>;
 confirmAccepted(capability:WriterCapabilityV1,packet:import("../personal/contracts-v2").PersonalPacketV2):Promise<{operationId:string;repositoryRevision:number;revisionId:string}>;
}
export interface PersonalWriterSessionV2 extends NativeWriterSessionV1 {readonly personal:PersonalPortV2;readonly requests:import("../host/pending-requests").RetainedPersonalPortV4}
export function createNativeWriterSession(config:NativeAuthorityConfigV1,options:HostOptionsV1&{writerPolicy:WriterPolicyV1;personalSync:import("../personal/contracts-v2").PersonalContextV2;requestRetention:{version:4;rehearsalId:string}}):PersonalWriterSessionV2;
export function createNativeWriterSession(config:NativeAuthorityConfigV1,options:HostOptionsV1 & {writerPolicy:WriterPolicyV1;personalSync:import("../personal/contracts").PersonalContextV1;requestRetention:{version:3;rehearsalId:string}}):PersonalWriterSessionV1;
export function createNativeWriterSession(config:NativeAuthorityConfigV1,options:HostOptionsV1 & {writerPolicy:WriterPolicyV1;gitSharing:{version:1;replicaId:string};requestRetention:import("../host/pending-requests").RequestRetentionOptionsV2}):RetainedGitNativeWriterSessionV2;
export function createNativeWriterSession(config:NativeAuthorityConfigV1,options:HostOptionsV1 & {writerPolicy:WriterPolicyV1;gitSharing:{version:1;replicaId:string};requestRetention?:never}):GitNativeWriterSessionV1;
export function createNativeWriterSession(config:NativeAuthorityConfigV1,options:HostOptionsV1 & {writerPolicy:WriterPolicyV1}):NativeWriterSessionV1;

export interface RetainedNativeWriterSessionV1 extends NativeWriterSessionV1 {readonly requests:import("../host/pending-requests").RetainedRequestPortV1}
export function createNativeWriterSession(config:NativeAuthorityConfigV1,options:HostOptionsV1 & {writerPolicy:WriterPolicyV1;requestRetention:import("../host/pending-requests").RequestRetentionOptionsV1}):RetainedNativeWriterSessionV1;
