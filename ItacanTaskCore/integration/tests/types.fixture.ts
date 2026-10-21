import {openProjectRuntime,ProjectRuntimeOptionsV1} from "../project-runtime";
import {createNativeWriterSession} from "../../writer";
import type {NativeAuthorityConfigV1,NativeRepositoryHostV1} from "../../host";
import type {TaskRepository} from "../../src/contracts";
import type {OperationReadRequestV3} from "../../src/snapshot-read";
import type {RetainedRequestV1} from "../../host/pending-requests";
declare const config:NativeAuthorityConfigV1, options:ProjectRuntimeOptionsV1, host:NativeRepositoryHostV1, repository:TaskRepository;
const session=createNativeWriterSession(config,{...options,requestRetention:{version:1,rehearsalId:options.rehearsalId}});
declare const intent:RetainedRequestV1["intent"];
async function use(){
 const cap=await session.authorize(options.writerPolicy);
 const saved=await session.requests.prepare(cap,intent);
 const r=await session.requests.reconcile(cap,saved.operationId);
 const q:OperationReadRequestV3={version:3,selection:"operation",authorityId:config.authorityId,owners:[options.owner],operationId:saved.operationId,commandDigest:saved.commandDigest};
 await repository.readSnapshot(q);
 await host.readOperation({...q,ownerContextPin:saved.writerRequest.scope.ownerContextPin,identityPin:saved.writerRequest.scope.identityPin});
 const runtime=await openProjectRuntime(config,options); const rows=await runtime.list();
 rows.tasks[0]?.nativeReference.taskId;
 // @ts-expect-error source handles are never fabricated
 rows.tasks[0].path;
 // @ts-expect-error readonly UUID identity
 rows.tasks[0].id="replacement";
 // @ts-expect-error arbitrary command execution is absent
 runtime.execute({});
 // @ts-expect-error operation reads require one physical owner
 await repository.readSnapshot({...q,owners:[]});
 // @ts-expect-error old sessions have no request retention authority
 createNativeWriterSession(config,options).requests;
 return r;
}
void use;
