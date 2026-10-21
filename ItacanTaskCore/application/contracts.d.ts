import type {AtomicActionEnvelopeV2,AtomicTaskSummaryV1} from "../atomic-task/contracts";
export type {AtomicActionEnvelopeV2} from "../atomic-task/contracts";
import type {WorkspaceRef, LocationRef, PhaseRef, LocalEndpoint, StructuralEditPayload, RecurrenceCommand, RecurrenceGenerationCommand} from "../src/contracts";
import type {HostReadStampV1, NativeRepositoryHostV1} from "../host";
import type {TargetSnapshotV1} from "../src/snapshot-read";
import type {NativeWriterPortV1, WriterCapabilityV1} from "../writer";
import type {TaskServiceLifecycle,TaskHandle,EditToken,TaskDraft} from "../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
export type NativeAuthorityV1={backend:"native";authorityId:string;applicationContextId:string};
export type TaskAuthorityV1=NativeAuthorityV1|{backend:"legacy-markdown";applicationContextId:string};
export interface NativeActionGuardV1 {expectedRepositoryRevision:number;ownerContextPin:string;identityPin:string|null;inventoryPin:string;phasePin:string;partitions:readonly {id:string;owner:WorkspaceRef;expectedRevision:number}[]}
export interface ExistingTargetV1 {taskId:string;expectedTaskRevision:number;stepId?:never}
export interface StepTargetV1 {taskId:string;expectedTaskRevision:number;stepId:string}
export interface CreationStepV1 {id?:string;parentStepId:string|null;order:number;title:string;completed:boolean;completedAt?:number|null}
export interface CreationDraftV1 {id?:string;title:string;description:string;necessity:"must"|"should"|null;start:LocalEndpoint|null;due:LocalEndpoint|null;location:LocationRef|null;phase:PhaseRef|null;steps:readonly CreationStepV1[];completed:boolean;completedAt?:number|null}
export type MetadataPatchV1=Partial<Pick<CreationDraftV1,"title"|"description"|"necessity"|"start"|"due">>;
type RecurrencePayload<T extends string>=Extract<RecurrenceCommand|RecurrenceGenerationCommand,{type:T}>["payload"];
type RecurrenceActionV1={kind:"recurrence";target:ExistingTargetV1}&(
 {change:"define-series";values:RecurrencePayload<"recurrence.defineSeries">}|
 {change:"revise-rule";values:RecurrencePayload<"recurrence.reviseRule">}|
 {change:"define-template";values:RecurrencePayload<"recurrence.defineTemplate">}|
 {change:"revise-template";values:RecurrencePayload<"recurrence.reviseTemplate">}|
 {change:"prepare-generation";values:RecurrencePayload<"recurrence.prepareGeneration">}|
 {change:"complete-occurrence";values:RecurrencePayload<"recurrence.complete">});
export type ApplicationActionV1=
 {kind:"create";draft:CreationDraftV1}|
 {kind:"edit-metadata";target:ExistingTargetV1;patch:MetadataPatchV1}|
 {kind:"edit-title";target:ExistingTargetV1;title:string}|
 {kind:"set-necessity";target:ExistingTargetV1;necessity:"must"|"should"|null}|
 {kind:"set-dates";target:ExistingTargetV1;start:LocalEndpoint|null;due:LocalEndpoint|null}|
 {kind:"set-completion";target:ExistingTargetV1;completed:boolean;completedAt?:number|null}|
 {kind:"edit-structure";target:ExistingTargetV1;draft:Omit<StructuralEditPayload,"content">&{content:NonNullable<StructuralEditPayload["content"]>&{appendOriginals:[]}}}|
 {kind:"add-step";target:ExistingTargetV1;step:CreationStepV1}|
 {kind:"edit-step";target:StepTargetV1;title:string}|
 {kind:"reparent-step";target:StepTargetV1;parentStepId:string|null;order:number}|
 {kind:"delete-step";target:StepTargetV1;cascade:boolean}|
 {kind:"set-step-completion";target:StepTargetV1;completed:boolean;completedAt?:number|null}|
 {kind:"reorder-steps";target:ExistingTargetV1;parentStepId:string|null;stepIds:readonly string[]}|
 {kind:"relocate"|"set-phase";target:ExistingTargetV1;location:LocationRef|null;phase:PhaseRef|null}|
 {kind:"archive";target:ExistingTargetV1;archived:boolean}|
 {kind:"delete-tree";target:ExistingTargetV1}|RecurrenceActionV1|
 {kind:"full-save";target:ExistingTargetV1;draft:Json}|
 {kind:"rich-create";draft:Json}|{kind:"compound";actions:readonly Json[]}|
 {kind:"inbox-send"|"quick-add-task"|"phase-live"|"phase-save-assignments"|"oath-completion"|"source-migration"|"shared-sync"|"clear-completed"|"source-edit"|"source-position"|"delete-promote-children"|"cross-owner-move"|"planning-edit"|"save-inbox-draft";details:Json};
export type Json=null|boolean|number|string|readonly Json[]|{readonly [key:string]:Json};
export type LegacyApplicationActionV1=ApplicationActionV1|{kind:"legacy-editable";handle:Extract<TaskHandle,{kind:"legacy"}>;token:Extract<EditToken,{kind:"legacy-snapshot"}>;draft:TaskDraft};
export type ActionEnvelopeV1={version:1;operationId:string;reason:string;owner:WorkspaceRef}&(
 {authority:NativeAuthorityV1;guard:NativeActionGuardV1;action:ApplicationActionV1}|
 {authority:Extract<TaskAuthorityV1,{backend:"legacy-markdown"}>;guard?:never;action:LegacyApplicationActionV1});
export interface ActionCapabilityV1 {version:1;state:"supported-native"|"conditional-supplied-draft"|"legacy-only"|"requires-atomic-extension"|"requires-coordination"|"unsupported-input"|"authority-unavailable"|"recovery-blocked";code:string}
export type ReadAfterWriteV1={state:"current";stamp:HostReadStampV1;targets:readonly TargetSnapshotV1[];navigation:readonly {taskId:string;target:{kind:"native-task";id:string}|null}[]}|{state:"pending"|"unavailable"|"superseded";code:string};
interface OutcomeBase {version:1;privacy:"local-private";operationId:string;authority:TaskAuthorityV1}
export type ApplicationMutationOutcomeV1=(OutcomeBase&{
 status:"committed"|"replayed";receipt:{operationId:string;repositoryRevision:number;revisionId:string};taskIds:readonly string[];eventIds:readonly string[];readAfterWrite:ReadAfterWriteV1;
 atomicTask?:AtomicTaskSummaryV1;recurrence?:{seriesId:string;completionEventId:string|null;successorId:string|null;reused:boolean;originalGenerationOperationId:string|null}
})|(OutcomeBase&{status:"uncertain";code:string;requestedOperationId?:string;retry:"identical-operation-after-authoritative-reconciliation"})|
 (OutcomeBase&{status:"cancelled";boundary:"before-admission"|"before-publication";priorOutcome:"not-checked"})|
 (OutcomeBase&{status:"rejected"|"conflict"|"unsupported"|"requires-coordination"|"recovery-blocked";code:string;attempt:"not-started"|"not-published";priorOutcome:"not-checked";retry?:string;capability?:ActionCapabilityV1["state"]});
export interface ApplicationMutationServiceV1 {capabilities(intent:ActionEnvelopeV1|AtomicActionEnvelopeV2):Promise<ActionCapabilityV1>;mutate(intent:ActionEnvelopeV1|AtomicActionEnvelopeV2,signal?:AbortSignal):Promise<ApplicationMutationOutcomeV1>;dispose():void}
export interface NativeApplicationAdapterV1 extends ApplicationMutationServiceV1 {readonly backend:"native";readonly authority:NativeAuthorityV1}
export interface NativeApplicationOptionsV1 {authority:NativeAuthorityV1;host:Pick<NativeRepositoryHostV1,"info"|"refresh"|"read"|"subscribe">;writer:NativeWriterPortV1;capability:WriterCapabilityV1}
export interface ServiceOptionsV1 {taskService:Pick<TaskServiceLifecycle,"capabilities">;adapter?:NativeApplicationAdapterV1|null}
