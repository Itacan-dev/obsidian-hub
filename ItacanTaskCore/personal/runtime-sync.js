"use strict";
// Local task readiness is independent of this background transport queue.
const {randomUUID}=require("node:crypto"),V=require("../src/value"),{check}=require("../src/errors");
const G=require("../src/personal-shared");
let background=Promise.resolve();
function createPersonalSync({runtime,transport,assertBinding=async()=>{},changed=()=>{}}){
 let stopped=false,queue=Promise.resolve(),status={version:1,state:"idle",publishedHead:null,accepted:0,conflicts:0,waiting:0,invalid:0,code:null};
 const snapshot=()=>Object.freeze(V.clone(status)),announce=next=>{status={...status,...next};if(!stopped)changed(snapshot())};
 async function run(){check(!stopped,"Personal synchronization closed.");announce({state:"checking",code:null});
  try{
   await assertBinding();await runtime.assertRetainedResolved();const initial=await runtime.personal.export();await transport.publish(initial);check(!stopped,"Personal synchronization closing.");
   const incoming=await transport.read();let accepted=0,waitingLocation=false;
   for(const packet of incoming.packets){check(!stopped,"Personal synchronization closing.");await assertBinding();
    let prepared;try{prepared=await runtime.personal.prepare(packet,randomUUID())}catch(e){if(e.code==="PERSONAL_WAITING_LOCATION"){waitingLocation=true;continue}throw e}
    const outcome=await runtime.personal.receive(prepared);check(outcome.status==="committed"||outcome.code==="PERSONAL_NO_CHANGES","Personal request requires authoritative recovery.");
    if(outcome.status==="committed")accepted+=outcome.personal?.acceptedOrigins.length??0;
    const current=await runtime.personal.status();if(!stopped&&!current.conflicts.length)await transport.acknowledge(packet.head,await runtime.personal.confirmAccepted(packet));
   }
   const final=await runtime.personal.export(),native=await runtime.personal.status();await transport.publish(final);await assertBinding();
   let acknowledged=false;
   for(const ack of incoming.acknowledgements)if(ack.signer!==runtime.personal.replicaId&&ack.body.head===final.head)for(const proof of incoming.packets){const ns=G.namespace(proof),g=G.graph(ns),frame=proof.frames.find(f=>f.replicaId===ack.signer&&f.receipt.operationId===ack.body.application.operationId&&f.receipt.result.repositoryRevision===ack.body.application.repositoryRevision&&f.receipt.result.revisionId===ack.body.application.revisionId);if(frame&&g.frames.has(ack.body.head)&&[...g.read(ack.body.head).accepted].every(id=>g.read(frame.id).accepted.has(id)))acknowledged=true;}
   const capacity=transport.capacity?await transport.capacity():null,near=final.frames.length>=960||capacity&&(Math.max(capacity.objects,capacity.heads,capacity.acknowledgements)>=960||capacity.bytes>=capacity.byteLimit*0.9);
   announce({state:native.conflicts.length?"conflicting":incoming.invalid.length?"invalid":waitingLocation?"waiting-for-location":incoming.waiting.length?"waiting-for-evidence":near?"near-capacity":acknowledged?"peer-acknowledged":"locally-published",publishedHead:final.head,accepted,conflicts:native.conflicts.length,waiting:incoming.waiting.length,invalid:incoming.invalid.length,capacity,code:near?"PERSONAL_CAPACITY_NEAR_LIMIT":null});return snapshot();
  }catch(e){announce({state:["ENOENT","EACCES","EBUSY","EIO"].includes(e.code)?"waiting-for-evidence":"unavailable",code:e.code??"PERSONAL_SYNC_UNAVAILABLE"});throw e;}
 }
 return Object.freeze({status:snapshot,sync(){const work=queue.then(()=>{const job=background.then(async()=>{await new Promise(resolve=>setImmediate(resolve));return run()});background=job.catch(()=>{});return job});queue=work.catch(()=>{});return work;},async close(){stopped=true;await queue}});
}
module.exports={createPersonalSync};
