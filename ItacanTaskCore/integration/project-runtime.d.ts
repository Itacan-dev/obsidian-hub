import type {WorkspaceRef} from "../src/contracts";
import type {NativeAuthorityConfigV1,HostOptionsV1,HostReadStampV1} from "../host";
import type {WriterPolicyV1} from "../writer";
import type {RetainedRequestV1} from "../host/pending-requests";
import type {ApplicationMutationOutcomeV1,NativeAuthorityV1,NativeActionGuardV1} from "../application/contracts";
import type {OperationEvidenceV3} from "../src/snapshot-read";
import type {HostedEditorV1} from "../host/editor-read";
export interface NativeProjectTaskV1 {
 readonly id:string;readonly nativeReference:{authorityId:string;owner:WorkspaceRef;taskId:string;taskRevision:number};readonly owner:WorkspaceRef;
 readonly nativeLocationUnavailable?:true;readonly nativeLocationDisplay?:{readonly workspaceName:string;readonly segments:readonly string[];readonly available:boolean};
 readonly location:import("../src/contracts").LocationRef|null;readonly text:string;readonly description:string;readonly completed:boolean;readonly necessity:"must"|"should"|null;
 readonly fromDate:string|null;readonly fromTime:string|null;readonly dueDate:string|null;readonly dueTime:string|null;
 readonly steps:readonly {id:string;taskId:string;text:string;completed:boolean;parentStepId:string|null}[];readonly nativeReadOnly:boolean;
}
export interface ProjectRuntimeOptionsV1 extends HostOptionsV1 {owner:WorkspaceRef;writerPolicy:WriterPolicyV1;sharedGenesis?:import("../src/git-shared").GitGenesisV1;rehearsalId:string;creating:boolean;locationLabel?:(ref:import("../src/contracts").LocationRef)=>string;describeLocation?:(ref:import("../src/contracts").LocationRef|null)=>{workspaceName:string;segments:string[];available:boolean};consumerUiV1?:true;historyUiV1?:true}
export interface NativeProjectRuntimeV1 {
 readonly recovery:{inspect(operationId:string):Promise<import("../host/pending-requests").RequestRecoveryInspectionV1>;
  reviewBootstrapRejection(operationId:string):Promise<import("../host/pending-requests").BootstrapRejectionReviewV1>;
  concludeBootstrapRejection(review:import("../host/pending-requests").BootstrapRejectionReviewV1):Promise<{readonly operationId:string;readonly state:"rejected-before-commit"}>;
  reconcile(operationId:string):Promise<{readonly inspection:import("../host/pending-requests").RequestRecoveryInspectionV1;readonly presentation:{readonly state:"current";readonly stamp:HostReadStampV1}|{readonly state:"unavailable"|"not-requested";readonly code:string}}>;
  replay(review:import("../host/pending-requests").RequestRecoveryInspectionV1,signal?:AbortSignal):Promise<ApplicationMutationOutcomeV1|import("../writer").WriterOutcomeV1>};
 readonly historyEvidence:{read(signal?:AbortSignal):Promise<import("../host/history-read").HistoryObservationV1>;subscribe(listener:(change:unknown)=>void):()=>void;dispose():void}|null;
 readonly sharing?:{subscribe(listener:(change:import("../host").HostInvalidationV1)=>void):()=>void;export():Promise<import("../src/git-shared").GitPacketV3>;status():Promise<Awaited<ReturnType<import("../writer").GitSharedPortV1["status"]>>>;prepare(packet:import("../src/git-shared").GitPacketV3,operationId:string):Promise<import("../writer").PreparedGitReceiveV1>;receive(prepared:import("../writer").PreparedGitReceiveV1):Promise<import("../writer").WriterOutcomeV1>};
 readonly owner:WorkspaceRef;readonly nativeTasks:{readonly owner:WorkspaceRef;readonly consumerUiV1?:true;createPanelRead(options:{plugin:unknown;component:{register(close:()=>void):void};workspace:WorkspaceRef;changed?:()=>void}):unknown};
 completionFeed(options:{legacy:import("./completion-feed").LegacyHistoryPortV1;app?:unknown;navigate?:(target:import("./completion-feed").NativeHistoryReferenceV1)=>unknown}):import("./completion-feed").CompletionFeedV1;
 list():Promise<{stamp:HostReadStampV1;tasks:readonly NativeProjectTaskV1[]}>;
 editor(taskId:string):Promise<HostedEditorV1>;
 creationContext():Promise<{authority:NativeAuthorityV1;owner:WorkspaceRef;guard:NativeActionGuardV1}>;
 mutate(intent:RetainedRequestV1["intent"]):Promise<ApplicationMutationOutcomeV1>;
 formService(app:unknown,sourceLabel?:string):{app:unknown;formContext():unknown;context():null;phases():readonly [];read(task:{id:string}):Promise<unknown>;create(destination:unknown,text:string,values:unknown):Promise<unknown>;save(snapshot:unknown,values:unknown):Promise<unknown>};
 info():{scope:"inactive-disposable"|"device-private-project"|"device-private-git-project";authority:NativeAuthorityV1;owner:WorkspaceRef;lastOutcome:ApplicationMutationOutcomeV1|null;history:"unavailable"|"rehearsal";statistics:"unavailable"|"rehearsal";home:"unavailable"|"rehearsal";schedule:"unavailable"|"rehearsal"};
 assertRetainedResolved():Promise<void>;
 retained():Promise<readonly Pick<RetainedRequestV1,"operationId"|"intentDigest"|"owner"|"partitionId">[]>;
 getRetained(operationId:string):Promise<RetainedRequestV1|import("../host/pending-requests").RetainedGitRequestV2>;reconcile(operationId:string):Promise<OperationEvidenceV3|import("../host/pending-requests").RejectedBootstrapOutcomeV1>;replay(operationId:string):Promise<ApplicationMutationOutcomeV1>;close():Promise<void>;
}
export function openProjectRuntime(config:NativeAuthorityConfigV1,options:ProjectRuntimeOptionsV1):Promise<NativeProjectRuntimeV1>;
