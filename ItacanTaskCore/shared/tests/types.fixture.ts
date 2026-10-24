import {createNativeWriterSession,WriterPolicyV1,GitNativeWriterSessionV1} from "../../writer";
import {NativeAuthorityConfigV1,HostOptionsV1,GitCreateHostOptionsV3} from "../../host";
import {createJsonRepository} from "../../src/json-repository";
import {deserializeSharedPacketV3,TaskRepository} from "../../src/contracts";
import {GitPacketV3,GitReceiveCommandV2} from "../../src/git-shared";
import {createGitPacketTransport} from "../git-transport";
declare const config:NativeAuthorityConfigV1,options:HostOptionsV1,writerPolicy:WriterPolicyV1,packet:GitPacketV3,repo:TaskRepository,command:GitReceiveCommandV2;
const session:GitNativeWriterSessionV1=createNativeWriterSession(config,{...options,writerPolicy,gitSharing:{version:1,replicaId:"replica"}});
const create:GitCreateHostOptionsV3={version:3,authorityId:"authority",partitions:[{id:"git",owner:{type:"project",id:"p"},kind:"git-project"}],reason:"explicit",syntheticOnly:true,taskMutationVersion:1,gitSharedVersion:2};
async function exercise(){await session.host.create(create);const cap=await session.authorize({version:1,owners:writerPolicy.owners,commands:["git.receive","task.createRich"]});const p=await session.shared.prepare(cap,packet,"stable-operation");const out=await session.shared.receive(cap,p);if(out.status==="committed"){out.gitShared?.conflicts[0]?.origins;out.originReplay?.application.revisionId;}await session.shared.reconcile(cap,p);const transport=await createGitPacketTransport({version:1,root:"explicit",authorityId:"authority",projectId:"project"});await transport.publish(await session.shared.export(cap));await deserializeSharedPacketV3(JSON.stringify((await transport.read())[0]),packet.genesis);await repo.execute(command,undefined,{version:1,packet});await createJsonRepository({directory:"explicit",storageFormat:"private-v4",storeId:"authority",taskMutationVersion:1,gitSharedVersion:2,sharedReplicaId:"replica",partitions:create.partitions.slice()});}
// @ts-expect-error old snapshot packet cannot become proven origin evidence
session.shared.prepare({},{format:"itacan-task-partition",schemaVersion:1},"op");
// @ts-expect-error no arbitrary untyped shared writer command
session.writer.task({}, {command:{type:"git.receive"}});
void exercise;

import {capture,GitInventoryEvidencePortV1} from "../inventory";
import {createRuntimeSync} from "../runtime-sync";
import {openProjectRuntime} from "../../integration/project-runtime";
declare const evidence:GitInventoryEvidencePortV1;
async function productionTypes(){const e=await evidence.read();const inventory=capture(e.authorityId,e.inventory,e.phases);const runtime=await openProjectRuntime(config,{...options,writerPolicy:{...writerPolicy,inventory,phases:e.phases},inventoryEvidence:evidence,gitSharing:{version:1,replicaId:"replica"},owner:e.owner,rehearsalId:"session",creating:false});if(runtime.sharing){await runtime.sharing.status();const transport=await createGitPacketTransport({version:1,root:"root",authorityId:e.authorityId,projectId:e.owner.id});await createRuntimeSync({runtime,transport}).sync();}}
void productionTypes;
