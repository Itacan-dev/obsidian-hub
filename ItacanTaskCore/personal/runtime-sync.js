"use strict";
// Local task readiness is independent of this background transport queue.
const {randomUUID}=require("node:crypto"),V=require("../src/value"),{check}=require("../src/errors");
const G=require("../src/personal-shared");
let background=Promise.resolve();
function createPersonalSync({runtime,transport,assertBinding=async()=>{},changed=()=>{},diagnostic=null}){
 let stopped=false,queue=Promise.resolve(),status={version:1,state:"idle",publishedHead:null,accepted:0,conflicts:0,waiting:0,invalid:0,code:null};
 const snapshot=()=>Object.freeze(V.clone(status)),announce=next=>{status={...status,...next};if(!stopped)changed(snapshot())};
 const now=()=>performance.now(),report=value=>{try{diagnostic?.({version:1,...value})}catch(_){/* Diagnostics cannot affect admission. */}};
 const measured=async(phase,work)=>{const start=now();try{return await work()}finally{report({phase,elapsedMs:now()-start})}};
 async function run(){check(!stopped,"Personal synchronization closed.");announce({state:"checking",code:null});
  try{
   await measured("binding",assertBinding);await measured("retained",()=>runtime.assertRetainedResolved());const initial=V.clone(await measured("initial-export",()=>runtime.personal.export()));await measured("initial-publication",()=>transport.publish(initial));check(!stopped,"Personal synchronization closing.");
   const incoming=V.clone(await measured("discovery",()=>transport.read()));let accepted=0,waitingLocation=false;const acceptedPackets=[];
   // Run-local, detached evidence only. No filesystem result or graph survives
   // this scan; a new scan re-reads and validates the transport and local head.
   const proofs=new Map(),proof=packet=>{if(!proofs.has(packet))proofs.set(packet,G.graph(G.namespace(packet)));return proofs.get(packet)};
   const known=async packet=>{
    if(initial.version!==2||packet.version!==2||V.canonical(initial.binding)!==V.canonical(packet.binding)||V.canonical(initial.seed)!==V.canonical(packet.seed))return false;
    const frames=new Map(initial.frames.map(f=>[f.id,f]));
    const local=proof(initial),remote=proof(packet);
    if(![...remote.current.known].every(id=>local.current.known.has(id)))return false;
    if(packet.frames.every(f=>frames.has(f.id)&&V.canonical(f)===V.canonical(frames.get(f.id))))return true;
    // A peer may have a different bootstrap/receive-only local receipt chain.
    // Validate every unfamiliar execution proof, then prove the union has no
    // task/conflict effect. Never promote those receipts to this local chain.
    const ns=G.namespace(packet);
    await G.validateState({...Object.fromEntries(Object.entries(remote.current).filter(([k])=>!["known","accepted","frontier","taskHeads","conflicts","accounting","personalHead"].includes(k))),personalShared:ns});
    return !G.previewReceive(initial,packet).changed;
   };
   const hasOwnAcknowledgement=(packet,current)=>{
    if(current?.version!==2)return false;
    const g=proof(current),remote=proof(packet);
    return incoming.acknowledgements.some(ack=>ack.signer===runtime.personal.replicaId&&ack.body.head===packet.head&&g.current.receipts.some(r=>r.operationId===ack.body.application.operationId&&r.result.repositoryRevision===ack.body.application.repositoryRevision&&r.result.revisionId===ack.body.application.revisionId)&&[...remote.current.known].every(id=>g.current.known.has(id)));
   };
   for(const packet of incoming.packets){check(!stopped,"Personal synchronization closing.");await assertBinding();
    const alreadyKnown=await measured("known-proof",async()=>known(packet));
    if(!alreadyKnown){
     let prepared;try{prepared=await measured("prepare",()=>runtime.personal.prepare(packet,randomUUID()))}catch(e){if(e.code==="PERSONAL_WAITING_LOCATION"){waitingLocation=true;continue}throw e}
     const outcome=await measured("receive",()=>runtime.personal.receive(prepared));check(outcome.status==="committed"||outcome.code==="PERSONAL_NO_CHANGES","Personal request requires authoritative recovery.");
     if(outcome.status==="committed")accepted+=outcome.personal?.acceptedOrigins.length??0;
    }
    if(initial.version===2)acceptedPackets.push(packet);
    else{const current=await runtime.personal.status();if(!stopped&&!current.conflicts.length)await transport.acknowledge(packet.head,await runtime.personal.confirmAccepted(packet));}
   }
   const final=V.clone(await measured("final-export",()=>runtime.personal.export())),native=final.version===2?proof(final).current:await runtime.personal.status();
   if(final.version===2&&!native.conflicts.length)for(const packet of acceptedPackets)if(!stopped&&!hasOwnAcknowledgement(packet,final))await measured("acknowledgement",async()=>transport.acknowledge(packet.head,await runtime.personal.confirmAccepted(packet)));
   await measured("final-publication",()=>transport.publish(final));await assertBinding();
   let acknowledged=false;
   for(const ack of incoming.acknowledgements)if(ack.signer!==runtime.personal.replicaId&&ack.body.head===final.head)for(const packet of incoming.packets){const g=proof(packet),frame=packet.frames.find(f=>f.replicaId===ack.signer&&f.receipt.operationId===ack.body.application.operationId&&f.receipt.result.repositoryRevision===ack.body.application.repositoryRevision&&f.receipt.result.revisionId===ack.body.application.revisionId);if(frame&&g.frames.has(ack.body.head)&&[...g.read(ack.body.head).accepted].every(id=>g.read(frame.id).accepted.has(id)))acknowledged=true;}
   const capacity=transport.capacity?await transport.capacity():null,near=final.frames.length>=960||capacity&&(Math.max(capacity.objects,capacity.heads,capacity.acknowledgements)>=960||capacity.bytes>=capacity.byteLimit*0.9);
   announce({state:native.conflicts.length?"conflicting":incoming.invalid.length?"invalid":waitingLocation?"waiting-for-location":incoming.waiting.length?"waiting-for-evidence":near?"near-capacity":acknowledged?"peer-acknowledged":"locally-published",publishedHead:final.head,accepted,conflicts:native.conflicts.length,waiting:incoming.waiting.length,invalid:incoming.invalid.length,capacity,code:near?"PERSONAL_CAPACITY_NEAR_LIMIT":null});return snapshot();
  }catch(e){announce({state:["ENOENT","EACCES","EBUSY","EIO"].includes(e.code)?"waiting-for-evidence":"unavailable",code:e.code??"PERSONAL_SYNC_UNAVAILABLE"});throw e;}
 }
 return Object.freeze({status:snapshot,sync(){const requested=now();const work=queue.then(()=>{const local=now();const job=background.then(async()=>{report({phase:"queue",localWaitMs:local-requested,globalWaitMs:now()-local});await new Promise(resolve=>setImmediate(resolve));return measured("cycle",run)});background=job.catch(()=>{});return job});queue=work.catch(()=>{});return work;},async close(){stopped=true;await queue}});
}
module.exports={createPersonalSync};
