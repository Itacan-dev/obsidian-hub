import {createNativeWriterSession} from "../../writer";
import {createJsonRepository} from "../../src/json-repository";
import type {NativeAuthorityConfigV1,HostOptionsV1} from "../../host";
import type {WriterPolicyV1} from "../../writer";
import type {PersonalContextV1,PersonalPacketV1,PersonalCommandV1} from "../contracts";
import {confirm,fingerprint} from "../binding";
import {identity,certify} from "../membership";
import {createOneDriveTransport} from "../onedrive-transport";
import {openPersonalRecovery} from "../recovery";
declare const config:NativeAuthorityConfigV1,options:HostOptionsV1,policy:WriterPolicyV1,personal:PersonalContextV1,packet:PersonalPacketV1;
const session=createNativeWriterSession(config,{...options,personalSync:personal,writerPolicy:policy,requestRetention:{version:3,rehearsalId:"explicit"}});
async function check(){const cap=await session.authorize(policy);const prepared=await session.personal.prepare(cap,packet,"original");await session.personal.receive(cap,prepared);const record=await session.requests.get(cap,"original");if(record.version===3){const typed:PersonalCommandV1=record.writerRequest.command;void typed;}await session.personal.inspectConflict(cap,"task");const signer=identity();certify(personal.binding,personal.signer,signer);confirm(personal.binding,fingerprint(personal.binding));const transport=await createOneDriveTransport({...personal,vaultRoot:"synthetic"});await transport.publish(packet);const repo=await createJsonRepository({directory:"synthetic",storageFormat:"private-v4",storeId:config.authorityId,partitions:[],taskMutationVersion:1,personalSync:personal});await repo.exportPersonalPacket();}
void check;
async function recoveryTypes(){const recovery=await openPersonalRecovery(config,{...options,personalSync:personal,writerPolicy:policy,requestRetention:{version:3,rehearsalId:"explicit"}});const review=await recovery.recovery.inspect("original");await recovery.recovery.replay(review);await recovery.recovery.reconcile("original");await recovery.close();}
void recoveryTypes;

import type {PersonalContextV2,PersonalPacketV2,PersonalCommandV2} from "../contracts-v2";
import {create as createProfile} from "../profile";
import {openProjectRuntime} from "../../integration/project-runtime";
declare const v2:PersonalContextV2,packet2:PersonalPacketV2;
const session2=createNativeWriterSession(config,{...options,personalSync:v2,writerPolicy:policy,requestRetention:{version:4,rehearsalId:"explicit-v2"}});
async function v2Types(){const cap=await session2.authorize(policy);const c=await session2.personal.inspectConflict(cap,"task"),r=await session2.personal.reviewResolution(cap,"task",c[0].origins[0]),p=await session2.personal.prepareResolution(cap,r,"fixed-operation");await session2.personal.resolve(cap,p);await session2.personal.inspectResolution(cap,"fixed-operation");await session2.personal.prepare(cap,packet2,"receive-operation");const held=await session2.requests.get(cap,"fixed-operation");if(held.version===4){const command:PersonalCommandV2=held.writerRequest.command;void command;}await (await createOneDriveTransport({...v2,vaultRoot:"disposable"})).publish(packet2);confirm(v2.binding,fingerprint(v2.binding));createProfile(personal.binding,personal.signer);const runtime=await openProjectRuntime(config,{...options,owner:v2.seed.body.owner,personalSync:v2,writerPolicy:policy,rehearsalId:"stable",creating:false,personalEnrollment:"source"});await runtime.personal.reviewResolution("task","origin");}
void v2Types;
