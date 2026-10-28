"use strict";
const test=require("node:test"),{fixture,assert,S,crypto,V,M,J}=require("./v2-support.cjs"),{attach}=require("./v2-host-support.cjs"),{mirrors}=require("./transport-support.cjs"),{createPersonalSync}=require("../runtime-sync");
function facade(h,id,counters={}){return{assertRetainedResolved:()=>h.session.requests.assertResolved(h.cap),personal:{replicaId:id,
 export:()=>h.session.personal.export(h.cap),status:()=>h.session.personal.status(h.cap),
 prepare:(p,id)=>{counters.prepare=(counters.prepare??0)+1;return h.session.personal.prepare(h.cap,p,id)},
 receive:p=>{counters.receive=(counters.receive??0)+1;return h.session.personal.receive(h.cap,p)},
 confirmAccepted:p=>{counters.confirm=(counters.confirm??0)+1;return h.session.personal.confirmAccepted(h.cap,p)}}}}
async function pair(t){const f=await fixture(t);await f.enroll();const a=await attach(t,f,0),b=await attach(t,f,1),m=await mirrors(t,f,true);return{f,a,b,m}}
async function nativeMutation(f,h,index,work){await h.session.dispose();const repo=await J.openJsonRepository(f.opts(index));f.repos[index]=repo;try{await work(repo)}finally{await repo.close()}await h.reopen();}

test("an unfamiliar peer bootstrap is fully proven without repeated native no-op preparation",async t=>{
 const{f,a,b,m}=await pair(t),count={},peer=await b.session.personal.export(b.cap);await m.transports[1].publish(peer);await m.transfer(1,0);let forge=false;
 const transport={...m.transports[0],async read(){const r=await m.transports[0].read();if(forge){const p=V.clone(peer),frame=p.frames.find(x=>x.id===p.head);frame.allocations.push(crypto.randomUUID());const{id,signature,...body}=frame;frame.id=M.hash(body);frame.signature=f.replicas[1].sign(["itacan-personal-frame-v2",f.binding.base.spaceId,M.hash(f.binding),f.seed.digest,frame.id]);p.head=frame.id;r.packets=[p];}return r}},sync=createPersonalSync({runtime:facade(a,f.replicas[0].replicaId,count),transport});t.after(()=>sync.close());
 const before=V.canonical(await f.state(0));await sync.sync();await sync.sync();assert.equal(count.prepare??0,0);assert.equal(count.receive??0,0);assert.equal(V.canonical(await f.state(0)),before);
 forge=true;await assert.rejects(sync.sync());assert.equal(V.canonical(await f.state(0)),before);
});

test("v2 no-op scan reuses exact accepted proof, while new origins still use retained native receive",async t=>{
 const{f,a,b,m}=await pair(t),ca={},cb={},ra=facade(a,f.replicas[0].replicaId,ca),rb=facade(b,f.replicas[1].replicaId,cb),sa=createPersonalSync({runtime:ra,transport:m.transports[0]}),sb=createPersonalSync({runtime:rb,transport:m.transports[1]});t.after(()=>Promise.all([sa.close(),sb.close()]));
 await sa.sync();const own=f.repos[0].info().revision,counts={...ca};await sa.sync();assert.equal(f.repos[0].info().revision,own);assert.deepEqual(ca,counts);
 const task=f.repos[0].getTask(f.source.tasks[0].id);await nativeMutation(f,a,0,repo=>repo.execute({type:"task.complete",operationId:crypto.randomUUID(),expectedRepositoryRevision:repo.info().revision,taskId:task.id,expectedRevision:task.revision,payload:{completed:true}}));
 await sa.sync();await m.transfer(0,1);await sb.sync();assert(cb.prepare>0&&cb.receive>0);assert.equal(f.repos[1].queryHistory().length,1);assert(f.repos[1].getTask(task.id).completed);
 const revision=f.repos[1].info().revision,received={...cb};await sb.sync();assert.equal(f.repos[1].info().revision,revision);assert.equal(cb.prepare,received.prepare);assert.equal(cb.receive,received.receive);assert.equal(f.repos[1].queryHistory().length,1);
});

test("v2 proof reuse is scan-local: altered accepted frame bytes reject on the next scan",async t=>{
 const{f,a,m}=await pair(t);let corrupt=false;const transport={...m.transports[0],async read(){const r=await m.transports[0].read();if(corrupt){r.packets[0].frames[0].clock++;}return r}},sync=createPersonalSync({runtime:facade(a,f.replicas[0].replicaId),transport});t.after(()=>sync.close());await sync.sync();const before=V.canonical(await f.state(0));corrupt=true;await assert.rejects(sync.sync());assert.equal(V.canonical(await f.state(0)),before);
});

test("v2 already-known proof rejects unreferenced ancestry rather than treating any subset as accepted",async t=>{
 const{f,a,m}=await pair(t),task=f.repos[0].getTask(f.source.tasks[0].id);await nativeMutation(f,a,0,repo=>repo.execute(S.save(f.ctx(0),task,{metadata:S.metadata({title:"Known later branch"})},crypto.randomUUID())));let corrupt=false;
 const transport={...m.transports[0],async read(){const r=await m.transports[0].read();if(corrupt){const p=r.packets[0];p.head=p.frames.find(f=>f.parent===null).id;}return r}},sync=createPersonalSync({runtime:facade(a,f.replicas[0].replicaId),transport});t.after(()=>sync.close());await sync.sync();corrupt=true;await assert.rejects(sync.sync(),/Unreferenced/);
});

test("v2 self-signed acknowledgement must match an authoritative local receipt",async t=>{
 const{f,a,m}=await pair(t),count={},runtime=facade(a,f.replicas[0].replicaId,count);let forged=false;
 const transport={...m.transports[0],async read(){const r=await m.transports[0].read();if(forged){const p=r.packets[0];r.acknowledgements=[M.seal({format:"itacan-personal-ack",version:2,profileDigest:f.binding.profile.digest,spaceId:f.binding.base.spaceId,authorityId:f.authority,bindingDigest:M.hash(f.binding),head:p.head,application:{operationId:crypto.randomUUID(),repositoryRevision:999,revisionId:crypto.randomUUID()}},f.replicas[0])];}return r}},sync=createPersonalSync({runtime,transport});t.after(()=>sync.close());await sync.sync();const before=count.confirm;forged=true;await sync.sync();assert.equal(count.confirm,before+1);assert.equal(f.repos[0].info().revision,2);
});

test("timing separates local and global queues; a diagnostic failure never changes an outcome",async()=>{
 let release;const blocked=new Promise(r=>release=r),events=[],make=(hold=false)=>{let first=true;return createPersonalSync({diagnostic:e=>{events.push(e);if(e.phase==="discovery")throw Error("Diagnostic only")},runtime:{assertRetainedResolved:async()=>{},personal:{replicaId:crypto.randomUUID(),export:async()=>({version:1,head:null,frames:[]}),status:async()=>({conflicts:[]})}},transport:{async publish(){if(hold&&first){first=false;await blocked}},read:async()=>({packets:[],waiting:[],invalid:[],acknowledgements:[]})}})};
 const a=make(true),b=make(),one=a.sync(),two=a.sync(),three=b.sync();await new Promise(r=>setTimeout(r,20));release();await Promise.all([one,two,three]);assert(events.some(e=>e.phase==="queue"&&e.globalWaitMs>=10));assert(events.some(e=>e.phase==="queue"&&e.localWaitMs>=10));assert.equal(b.status().state,"locally-published");await Promise.all([a.close(),b.close()]);
});
