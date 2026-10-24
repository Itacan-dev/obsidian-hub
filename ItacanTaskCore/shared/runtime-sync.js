"use strict";
// One caller queue, existing retained receive requests, and immutable Git files.
// No Git network/branch operation and no second task-outcome ledger.
const {randomUUID}=require('node:crypto'),V=require('../src/value'),G=require('../src/git-shared'),{check}=require('../src/errors');
function createRuntimeSync({runtime,transport,assertBinding=async()=>{},changed=()=>{}}){
 check(runtime.sharing&&transport,'Explicit shared runtime and transport required.');let stopped=false,queue=Promise.resolve(),status={version:1,state:'not-checked',published:null,accepted:0,conflicts:0,code:null,capacity:null};
 const snapshot=()=>Object.freeze(V.clone(status));
 function announce(next){status={...status,...next};if(!stopped)try{changed(snapshot())}catch(_){}}
 async function run(){check(!stopped,'Sharing is closed.');announce({state:'checking',code:null});
  try{await assertBinding();
   // Reconcile from original receipts before allocating any new receive ID.
   // Missing/conflicting evidence remains operator-assisted, never rebased.
   if(runtime.assertRetainedResolved)await runtime.assertRetainedResolved();
   else for(const record of await runtime.retained())check((await runtime.reconcile(record.operationId)).state==='committed','Retained operation requires operator recovery.');
   // Publish the current validated repository evidence before receiving. If a
   // process died after commit, this reconstructs the export from receipts.
   const current=await runtime.sharing.export(),published=await transport.publish(current);await assertBinding();check(!stopped,'Sharing is closed.');
   const packets=await transport.read();let accepted=0;
   for(const packet of packets){check(!stopped,'Sharing is closed.');await assertBinding();
    const now=await runtime.sharing.export();if(!G.previewReceive(now,packet).changed)continue;
    const prepared=await runtime.sharing.prepare(packet,randomUUID());
    const result=await runtime.sharing.receive(prepared);
    check(result.status==='committed'||result.code==='SHARED_NO_CHANGES','Incoming operation requires retained-request recovery.');accepted+=result.gitShared?.acceptedOrigins.length??0;
   }
   const final=await runtime.sharing.export(),out=await transport.publish(final),native=await runtime.sharing.status();await assertBinding();
   const transportCapacity=transport.capacity?await transport.capacity():null,capacity={version:1,frames:final.frames.length,frameLimit:1024,remainingFrames:Math.max(0,1024-final.frames.length),transport:transportCapacity};
   const remaining=transportCapacity?[1024-transportCapacity.objects,1024-transportCapacity.heads,capacity.remainingFrames]:[capacity.remainingFrames];
   const exceeded=remaining.some(n=>n<0)||(transportCapacity&&transportCapacity.bytes>transportCapacity.byteLimit),near=remaining.some(n=>n<=64)||(transportCapacity&&transportCapacity.bytes>=transportCapacity.byteLimit*0.9);
   if(exceeded){announce({capacity,code:'SHARED_CAPACITY_EXCEEDED'});const e=Error('Shared evidence capacity exceeded; preserve evidence.');e.code='SHARED_CAPACITY_EXCEEDED';throw e;}
   announce({state:native.conflicts.length?'conflicting':near?'near-capacity':'local-published',published:out.digest,accepted,conflicts:native.conflicts.length,capacity,code:near?'SHARED_CAPACITY_NEAR_LIMIT':null});
   return snapshot();
  }catch(error){announce({state:'unavailable',code:error.code??'SHARED_SYNC_UNAVAILABLE'});throw error;}
 }
 return Object.freeze({status:snapshot,sync(){if(stopped)return Promise.reject(Error('Sharing is closed.'));const work=queue.then(run);queue=work.catch(()=>{});return work;},async close(){stopped=true;await queue;}});
}
module.exports={createRuntimeSync};
