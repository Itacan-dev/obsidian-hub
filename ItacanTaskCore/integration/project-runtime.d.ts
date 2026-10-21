import type {WorkspaceRef} from "../src/contracts";
import type {NativeAuthorityConfigV1,HostOptionsV1,HostReadStampV1} from "../host";
import type {WriterPolicyV1} from "../writer";
import type {RetainedRequestV1} from "../host/pending-requests";
import type {ApplicationMutationOutcomeV1,NativeAuthorityV1,NativeActionGuardV1} from "../application/contracts";
import type {OperationEvidenceV3} from "../src/snapshot-read";
import type {HostedEditorV1} from "../host/editor-read";
export interface NativeProjectTaskV1 {
 readonly id:string;readonly nativeReference:{authorityId:string;owner:WorkspaceRef;taskId:string;taskRevision:number};readonly owner:WorkspaceRef;
 readonly text:string;readonly description:string;readonly completed:boolean;readonly necessity:"must"|"should"|null;
 readonly fromDate:string|null;readonly fromTime:string|null;readonly dueDate:string|null;readonly dueTime:string|null;
 readonly steps:readonly {id:string;taskId:string;text:string;completed:boolean;parentStepId:string|null}[];readonly nativeReadOnly:boolean;
}
export interface ProjectRuntimeOptionsV1 extends HostOptionsV1 {owner:Extract<WorkspaceRef,{type:"project"}>;writerPolicy:WriterPolicyV1;rehearsalId:string;creating:boolean;consumerUiV1?:true;historyUiV1?:true}
export interface NativeProjectRuntimeV1 {
 readonly recovery:{inspect(operationId:string):Promise<import("../host/pending-requests").RequestRecoveryInspectionV1>;
  reconcile(operationId:string):Promise<{readonly inspection:import("../host/pending-requests").RequestRecoveryInspectionV1;readonly presentation:{readonly state:"current";readonly stamp:HostReadStampV1}|{readonly state:"unavailable"|"not-requested";readonly code:string}}>;
  replay(review:import("../host/pending-requests").RequestRecoveryInspectionV1,signal?:AbortSignal):Promise<ApplicationMutationOutcomeV1>};
 readonly owner:WorkspaceRef;readonly nativeTasks:{readonly owner:WorkspaceRef;readonly consumerUiV1?:true;createPanelRead(options:{plugin:unknown;component:{register(close:()=>void):void};workspace:WorkspaceRef;changed?:()=>void}):unknown};
 completionFeed(options:{legacy:import("./completion-feed").LegacyHistoryPortV1;app?:unknown;navigate?:(target:import("./completion-feed").NativeHistoryReferenceV1)=>unknown}):import("./completion-feed").CompletionFeedV1;
 list():Promise<{stamp:HostReadStampV1;tasks:readonly NativeProjectTaskV1[]}>;
 editor(taskId:string):Promise<HostedEditorV1>;
 creationContext():Promise<{authority:NativeAuthorityV1;owner:WorkspaceRef;guard:NativeActionGuardV1}>;
 mutate(intent:RetainedRequestV1["intent"]):Promise<ApplicationMutationOutcomeV1>;
 formService(app:unknown,sourceLabel?:string):{app:unknown;formContext():unknown;context():null;phases():readonly [];read(task:{id:string}):Promise<unknown>;create(destination:unknown,text:string,values:unknown):Promise<unknown>;save(snapshot:unknown,values:unknown):Promise<unknown>};
 info():{scope:"inactive-disposable";authority:NativeAuthorityV1;owner:WorkspaceRef;lastOutcome:ApplicationMutationOutcomeV1|null;history:"unavailable"|"rehearsal";statistics:"unavailable"|"rehearsal";home:"unavailable"|"rehearsal";schedule:"unavailable"|"rehearsal"};
 retained():Promise<readonly Pick<RetainedRequestV1,"operationId"|"intentDigest"|"owner"|"partitionId">[]>;
 getRetained(operationId:string):Promise<RetainedRequestV1>;reconcile(operationId:string):Promise<OperationEvidenceV3>;replay(operationId:string):Promise<ApplicationMutationOutcomeV1>;close():Promise<void>;
}
export function openProjectRuntime(config:NativeAuthorityConfigV1,options:ProjectRuntimeOptionsV1):Promise<NativeProjectRuntimeV1>;
