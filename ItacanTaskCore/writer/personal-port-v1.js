"use strict";
// Uses the existing participant gate and host retention; no parallel outcome log.
const V=require("../src/value"),G=require("../src/personal-shared"),P=require("./policy"),{check,fail}=require("../src/errors"),{freeze}=require("../src/snapshot-read");
function createPersonalPort({config,options,host,grant,observed,inventoryFresh,submit,inventoryPin,phasePin}){
 const personal=options.personalSync;
 async function state(capability){grant({capability});await inventoryFresh();const info=await host.refresh(),observation=await observed();check(info.readiness.state==="ready","Personal authority is unavailable.");return{info,observation};}
 function request(info,o,command){const owner=o.registry.owners[0];return P.request({version:1,reason:"Explicit personal replication operation",scope:{authorityId:config.authorityId,ownerContextPin:o.ownerContextPin,identityPin:o.identityPin,inventoryPin,phasePin,partitions:[{id:owner.partitionId,owner:owner.owner,expectedRevision:info.head.repositoryRevision}]},command},"personal");}
 async function prepare(capability,command,packet){
  const before=await state(capability),evidence={version:1,binding:V.clone(personal.binding),seed:V.clone(personal.seed),members:V.clone(personal.members),packet:packet?V.clone(packet):null};
  check(command.expectedRepositoryRevision===before.info.head.repositoryRevision,"Personal preparation head changed.");
  let tasks=personal.seed.body.state.tasks,noop=false;
  if(packet){const remote=G.graph(G.namespace(packet));await G.validateState({...Object.fromEntries(Object.entries(remote.current).filter(([k])=>!["accepted","taskHeads","conflicts"].includes(k))),personalShared:G.namespace(packet)});const current=await port.export(capability),preview=G.previewReceive(current,packet);tasks=preview.tasks;noop=!preview.changed;}
  const owner=before.observation.registry.owners[0];for(const t of tasks)if(t.deletedAt===null&&t.location!==null&&!owner.locations.some(l=>P.same(l,t.location)))fail("PERSONAL_WAITING_LOCATION","Referenced personal location has not arrived.");
  const r=request(before.info,before.observation,command),prepared=freeze({version:1,request:r,evidence});
  const after=await state(capability);check(P.same(before.info.head,after.info.head)&&P.same(before.observation,after.observation),"Personal preparation observation changed.");
  if(noop)return freeze({...prepared,noop:true});await host.retention().prepare({version:1,kind:"personal-operation",prepared});return prepared;
 }
 const port=Object.freeze({
  async export(capability){const before=await state(capability),packet=await host.exportPersonalPacket(),after=await state(capability);check(P.same(before.info.head,after.info.head)&&P.same(before.observation,after.observation),"Personal export context changed.");return freeze(packet);},
  async status(capability){const packet=await port.export(capability),g=G.graph(G.namespace(packet));return freeze({version:1,authorityId:config.authorityId,state:g.current.conflicts.length?"conflicting":"ready",head:packet.head,conflicts:V.clone(g.current.conflicts),frames:packet.frames.length,remainingFrames:1024-packet.frames.length});},
  async inspectConflict(capability,taskId){const packet=await port.export(capability),g=G.graph(G.namespace(packet)),state={...Object.fromEntries(Object.entries(g.current).filter(([k])=>!["accepted","taskHeads","conflicts"].includes(k))),personalShared:G.namespace(packet)};return freeze(G.inspectConflict(state,taskId));},
  async confirmAccepted(capability,packet){const current=await port.export(capability);check(P.same(current.binding,packet.binding)&&P.same(current.seed,packet.seed),"Personal acknowledgement binding differs.");const g=G.graph(G.namespace(current)),remote=G.graph(G.namespace(packet));check(!g.current.conflicts.length&&[...remote.current.accepted].every(id=>g.current.accepted.has(id)),"Personal head has not been accepted.");const receipt=g.frames.get(current.head)?.receipt;check(receipt,"Personal application receipt missing.");return freeze({operationId:receipt.operationId,repositoryRevision:receipt.result.repositoryRevision,revisionId:receipt.result.revisionId});},
  async prepare(capability,packet,operationId){const {info}=await state(capability);return prepare(capability,{type:"personal.receive",operationId,expectedRepositoryRevision:info.head.repositoryRevision,payload:{version:1,spaceId:personal.binding.spaceId,authorityId:config.authorityId,partitionId:personal.seed.body.partition.id,packetDigest:P.hash(packet),head:packet.head}},packet);},
  async prepareEnrollment(capability,type,operationId){check(["personal.enroll","personal.bootstrap"].includes(type),"Personal enrollment operation required.");const {info}=await state(capability);return prepare(capability,{type,operationId,expectedRepositoryRevision:info.head.repositoryRevision,payload:{version:1,spaceId:personal.binding.spaceId,seedDigest:personal.seed.digest,bindingDigest:P.hash(personal.binding),replicaId:personal.signer.replicaId,...(type==="personal.bootstrap"?{baseRevisionId:info.head.revisionId}:{})}},null);},
  async receive(capability,prepared,signal){
   check(prepared?.version===1&&P.same(prepared.evidence.binding,personal.binding)&&P.same(prepared.evidence.seed,personal.seed),"Exact personal evidence required.");
   if(prepared.noop){const current=await port.export(capability);check(!G.previewReceive(current,prepared.evidence.packet).changed,"Personal no-op changed.");return freeze({version:1,status:"rejected",operationId:prepared.request.command.operationId,code:"PERSONAL_NO_CHANGES"});}
   return submit("personal",capability,prepared.request,signal,undefined,prepared.evidence.packet?{version:1,packet:prepared.evidence.packet}:undefined);
  }
 });return port;
}
module.exports={createPersonalPort};
