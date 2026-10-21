import type {TaskRepository,WorkspaceRef} from "../../src/contracts";
import {createNativeEditorReadPort} from "../../host/editor-read";
import type {NativeRepositoryHostV1} from "../../host";
import type {WriterPolicyV1} from "../../writer";
declare const repo:TaskRepository,host:NativeRepositoryHostV1,policy:WriterPolicyV1,owner:WorkspaceRef;
repo.readSnapshot({version:1,authorityId:"uuid",selection:"editor",owners:[owner],targets:[{taskId:"uuid",owner,partitionId:"p"}]}).then(r=>{if(r.editor.state==="available")r.editor.guards.expectedBindings;});
createNativeEditorReadPort(host,{writerPolicy:policy}).read({version:1,authorityId:"uuid",owner,partitionId:"p",taskId:"uuid"});
// @ts-expect-error editor selection requires exactly one target
repo.readSnapshot({version:1,authorityId:"uuid",selection:"editor",owners:[owner],targets:[]});
// @ts-expect-error no raw state selector
repo.readSnapshot({version:1,authorityId:"uuid",selection:"raw-state",owners:[owner]});
