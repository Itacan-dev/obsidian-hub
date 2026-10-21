import {createNativeRepositoryHost,createNativeReadAdapter,createCompletionEvidencePort,inspectNativeRepository,type NativeAuthorityConfigV1,type HostOptionsV1} from "..";
import type {TaskRepository} from "../../src/contracts";
import type {CompletionEvidencePortV1} from "../../oath/completion-proof";
import type {TaskServiceAdapter} from "../../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
declare const config:NativeAuthorityConfigV1; declare const options:HostOptionsV1; declare const repository:TaskRepository;
const host=createNativeRepositoryHost(config,options); const adapter:TaskServiceAdapter=createNativeReadAdapter(host);const port:CompletionEvidencePortV1=createCompletionEvidencePort(host);
void host.open({version:1,expectedAuthorityId:config.authorityId,syntheticOnly:true});
void host.create({version:1,authorityId:config.authorityId,partitions:[],reason:"Synthetic",syntheticOnly:true});
void host.read({version:1,authorityId:config.authorityId,ownerContextPin:"pin",selection:"tasks",owners:[{type:"project",id:"p"}]});
void repository.readSnapshot({version:1,authorityId:config.authorityId,selection:"completions",owners:[{type:"project",id:"p"}],targets:[]});
void inspectNativeRepository({version:1,directory:config.directory,expectedAuthorityId:config.authorityId,sourceFormat:"private-v4"});
// @ts-expect-error N2 exposes no command writer
host.execute({type:"task.complete"});
// @ts-expect-error no implicit creation or omitted authority
host.open({version:1,syntheticOnly:true});
// @ts-expect-error arbitrary selectors cannot expose private state
repository.readSnapshot({version:1,authorityId:config.authorityId,owners:[],selection:(state:unknown)=>state});
// @ts-expect-error explicit disposable scope required
const wrong:NativeAuthorityConfigV1={...config,scope:"production"};void wrong;
// @ts-expect-error no full History read selector
repository.readSnapshot({version:1,authorityId:config.authorityId,owners:[],selection:"history"});
void adapter;void port;void host.dispose();
