import {createNativeWriterSession,WriterCapabilityV1,WriterRequestV1,NativeTaskWriteV1} from "..";
import type {NativeAuthorityConfigV1,HostOptionsV1} from "../../host";
import type {WriterPolicyV1} from "..";
declare const config:NativeAuthorityConfigV1, options:HostOptionsV1, policy:WriterPolicyV1;
const s=createNativeWriterSession(config,{...options,writerPolicy:policy});
declare const cap:WriterCapabilityV1, request:WriterRequestV1<NativeTaskWriteV1>;
s.writer.task(cap,request).then(r=>{if(r.status==="committed")r.receipt.revisionId;else if(r.status==="uncertain")r.retry;});
// @ts-expect-error no public execute
s.host.execute({});
// @ts-expect-error capabilities cannot be constructed
const forged:WriterCapabilityV1={version:1,privacy:"local-private"};
// @ts-expect-error task command cannot use Step family
s.writer.step(cap,request);
// @ts-expect-error imports have no writer group
s.writer.importBundle(cap,request);
// @ts-expect-error repository revision is required
const bad:WriterRequestV1<NativeTaskWriteV1>={version:1,reason:"x",scope:request.scope,command:{type:"task.create",operationId:"x",payload:{task:{owner:{type:"project",id:"p"},title:"x"}}}};

// @ts-expect-error provenance cannot be injected by ordinary creation
const provenance:NativeTaskWriteV1={type:"task.create",operationId:"x",payload:{task:{owner:{type:"project",id:"p"},title:"x",migration:null}}};
// @ts-expect-error Step source clocks cannot be injected through creation
const clocks:NativeTaskWriteV1={type:"task.create",operationId:"x",payload:{task:{owner:{type:"project",id:"p"},title:"x",steps:[{title:"s",createdAt:null}]}}};
// @ts-expect-error capture provenance cannot be patched
const patch:NativeTaskWriteV1={type:"task.update",operationId:"x",taskId:"x",expectedRevision:1,payload:{patch:{captureSource:null}}};
