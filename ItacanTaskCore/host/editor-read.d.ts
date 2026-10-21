import type {NativeRepositoryHostV1,HostFailureV1,HostReadStampV1} from "./index";
import type {AvailableEditorV1,UnavailableEditorV1} from "../src/editor-read";
import type {NativeAuthorityV1,NativeActionGuardV1} from "../application/contracts";
import type {WriterPolicyV1} from "../writer";
import type {WorkspaceRef} from "../src/contracts";
export type HostedEditorV1=AvailableEditorV1 & {authority:NativeAuthorityV1;guard:NativeActionGuardV1};
export type HostedEditorResultV1=HostFailureV1|UnavailableEditorV1|{version:1;state:"unavailable";code:string}|{version:1;status:"ok";privacy:"local-private";stamp:HostReadStampV1;editor:HostedEditorV1};
export interface NativeEditorReadPortV1 {read(request:{version:1;authorityId:string;owner:WorkspaceRef;partitionId:string;taskId:string},signal?:AbortSignal):Promise<HostedEditorResultV1>}
export function createNativeEditorReadPort(host:NativeRepositoryHostV1,options:{writerPolicy:WriterPolicyV1}):NativeEditorReadPortV1;
