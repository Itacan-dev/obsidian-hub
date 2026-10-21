import {openProjectRuntime,ProjectRuntimeOptionsV1} from "../project-runtime";
import {mergeHome,taskKey,NativeHomeContextV1,HomeOwnerV1} from "../home-schedule";
import {NativeRepositoryHostV1,NativeAuthorityConfigV1} from "../../host";
import {SnapshotRequestV1} from "../../src/snapshot-read";
declare const host:NativeRepositoryHostV1,config:NativeAuthorityConfigV1,options:ProjectRuntimeOptionsV1;
async function checks(){
 const runtime=await openProjectRuntime(config,{...options,consumerUiV1:true});const list=await runtime.list();
 for(const task of list.tasks)taskKey(task);
 await host.readScoped({version:2,authorityId:config.authorityId,owners:[options.owner],selection:"tasks",includeConsumerFacts:true});
 // @ts-expect-error Facts do not expose a general state selector.
 await host.readScoped({version:2,authorityId:config.authorityId,owners:[options.owner],selection:"state",includeConsumerFacts:true});
 // @ts-expect-error Editor requests cannot negotiate task consumer facts.
 await host.readScoped({version:2,authorityId:config.authorityId,owners:[options.owner],selection:"editor",targets:[],includeConsumerFacts:true});
 // @ts-expect-error No mutation or receipt API is added to the host.
 await host.execute({});
 const ctx:NativeHomeContextV1={owner:options.owner,root:"Projects/Synthetic",dashboard:"Projects/Synthetic/Dashboard.md",status:"active"};
 const owner:HomeOwnerV1={projectId:ctx.owner.id,root:ctx.root,path:ctx.dashboard,status:ctx.status};mergeHome([],list.tasks,options.owner,ctx,()=>owner);
 const request:SnapshotRequestV1={version:1,authorityId:config.authorityId,owners:[options.owner],selection:"tasks",includeConsumerFacts:true};void request;
 // @ts-expect-error Consumer facts require task selection.
 const bad:SnapshotRequestV1={version:1,authorityId:config.authorityId,owners:[options.owner],selection:"status",includeConsumerFacts:true};void bad;
}
void checks;
