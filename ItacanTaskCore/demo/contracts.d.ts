import type {WorkspaceRef} from "../src/contracts";
import type {NativeAuthorityV1,NativeActionGuardV1,ActionEnvelopeV1,AtomicActionEnvelopeV2,ApplicationMutationOutcomeV1} from "../application/contracts";
import type {HostedEditorResultV1} from "../host/editor-read";
import type {HostReadStampV1} from "../host";
import type {CanonicalTaskSnapshotV1} from "../src/snapshot-read";
export interface DemoRuntimeV1 {
 info():{version:1;scope:"disposable-native-demo";authority:NativeAuthorityV1;workspaces:readonly {label:string;owner:WorkspaceRef;partitionId:string}[];readiness:{state:string;reason:string};pending:readonly {operationId:string;state:string}[]};
 list(owner:WorkspaceRef):Promise<{version:1;stamp:HostReadStampV1;tasks:readonly CanonicalTaskSnapshotV1[]}>;
 creationContext(owner:WorkspaceRef):Promise<{version:1;authority:NativeAuthorityV1;owner:WorkspaceRef;guard:NativeActionGuardV1}>;
 editor(taskId:string,owner:WorkspaceRef):Promise<HostedEditorResultV1>;
 mutate(intent:ActionEnvelopeV1|AtomicActionEnvelopeV2):Promise<ApplicationMutationOutcomeV1|{version:1;status:"conflict";code:"OPERATION_CONFLICT";operationId:string}>;
 reconcile(operationId:string):Promise<unknown>;
 seedBulk(count:number,owner:WorkspaceRef):Promise<void>;close():Promise<void>;
}
