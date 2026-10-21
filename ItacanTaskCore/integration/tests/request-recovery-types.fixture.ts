import {openProjectRuntime,ProjectRuntimeOptionsV1} from "../project-runtime";
import {createNativeWriterSession,WriterCapabilityV1} from "../../writer";
import {NativeAuthorityConfigV1} from "../../host";
import {RequestRecoveryInspectionV1} from "../../host/pending-requests";
declare const config:NativeAuthorityConfigV1,options:ProjectRuntimeOptionsV1,cap:WriterCapabilityV1;
async function use(){
 const session=createNativeWriterSession(config,{...options,requestRetention:{version:1,rehearsalId:options.rehearsalId}});
 const review:RequestRecoveryInspectionV1=await session.requests.inspect(cap,"operation");
 await session.requests.replay(cap,review);await session.requests.reconcile(cap,review.operationId);
 const runtime=await openProjectRuntime(config,options),inspection=await runtime.recovery.inspect("operation"),result=await runtime.recovery.reconcile("operation");
 if(result.presentation.state==="current")result.presentation.stamp.head.repositoryRevision;
 // @ts-expect-error diagnostics expose no full command or retained content
 inspection.intent;
 // @ts-expect-error evidence is readonly
 inspection.operationId="replacement";
 // @ts-expect-error arbitrary writer commands are not an operator review
 await runtime.recovery.replay({type:"task.create",operationId:"replacement"});
 await runtime.recovery.replay(inspection,new AbortController().signal);
 // @ts-expect-error inspection cannot clear receipts or force-unfence a root
 runtime.recovery.clear();
 await runtime.close();
}
void use;
