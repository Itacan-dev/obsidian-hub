"use strict";
const test=require('node:test'), {assert,fixture,attach,S,crypto,G,fs,path,H}=require('./writer-support.cjs');
test('real writer receives, replays and reconciles exact applications under the existing gate',async t=>{
 const f=await fixture(t),task=f.repos[0].getTask(f.tasks[0].id);await f.repos[0].execute(S.save(f.ctx(f.repos[0]),task,{metadata:S.metadata({title:'Origin edit'})},crypto.randomUUID()));
 const w=await attach(t,f,1),p=await w.session.shared.prepare(w.cap,await f.packet(0),crypto.randomUUID());
 const out=await w.session.shared.receive(w.cap,p);assert.equal(out.status,'committed',JSON.stringify(out));assert.equal(out.gitShared.acceptedOrigins.length,1);assert.equal(w.repo.getTask(task.id).title,'Origin edit');
 const replay=await w.session.shared.receive(w.cap,p);assert.equal(replay.status,'committed');assert(replay.replayed);assert.equal((await w.session.shared.reconcile(w.cap,p)).state,'committed');
 assert.deepEqual((await w.session.shared.export(w.cap)).genesis,(await f.packet(0)).genesis);
 const newTask=await w.submit(S.rich(f.ctx(w.repo),{id:crypto.randomUUID(),metadata:S.metadata({title:'Continued local work'})},f.owner,crypto.randomUUID()));assert.equal(newTask.status,'committed',JSON.stringify(newTask));
 const before=await f.state(1),bad=structuredClone(p);bad.packet.head='f'.repeat(64);await assert.rejects(w.session.shared.receive(w.cap,bad));assert.deepEqual(await f.state(1),before);
 w.reg.change(v=>{v.owners[0].status='shelved'},false);const changed=await w.session.shared.receive(w.cap,p);assert.notEqual(changed.status,'committed');
});
for(const mode of ['registry','cancel','revoke'])test('shared final publication admission rejects '+mode,async t=>{
 const f=await fixture(t);await f.repos[0].execute(S.save(f.ctx(f.repos[0]),f.repos[0].getTask(f.tasks[0].id),{metadata:S.metadata({title:'Remote'})},crypto.randomUUID()));
 let armed=false,w;const abort=new AbortController();w=await attach(t,f,1,{fault:async stage=>{if(armed&&stage==='beforeManifestReplace'){armed=false;if(mode==='registry')w.reg.change(v=>{v.owners[0].status='shelved'},false);if(mode==='cancel')abort.abort();if(mode==='revoke')w.session.revoke(w.cap);}}});
 const prepared=await w.session.shared.prepare(w.cap,await f.packet(0),crypto.randomUUID()),before=await fs.readFile(path.join(f.dirs[1],'CURRENT.json'),'utf8');armed=true;
 const out=await w.session.shared.receive(w.cap,prepared,abort.signal);assert.notEqual(out.status,'committed',JSON.stringify(out));assert.equal(await fs.readFile(path.join(f.dirs[1],'CURRENT.json'),'utf8'),before);
});
test('changed prepared operation conflicts while original evidence remains replayable',async t=>{
 const f=await fixture(t);await f.repos[0].execute(S.save(f.ctx(f.repos[0]),f.repos[0].getTask(f.tasks[0].id),{metadata:S.metadata({title:'Remote'})},crypto.randomUUID()));
 const w=await attach(t,f,1),p=await w.session.shared.prepare(w.cap,await f.packet(0),crypto.randomUUID());assert.equal((await w.session.shared.receive(w.cap,p)).status,'committed');
 const changed=structuredClone(p);changed.request.reason+=' changed';const out=await w.session.shared.receive(w.cap,changed);assert.equal(out.code,'OPERATION_CONFLICT');
 assert.equal((await w.session.shared.receive(w.cap,p)).replayed,true);
});
test('sharing cannot bypass a live writer lease or export private source provenance',async t=>{
 const f=await fixture(t),w=await attach(t,f,0),W=require('../../writer'),other=W.createNativeWriterSession(w.config,{...w.options,gitSharing:{version:1,replicaId:crypto.randomUUID()}});t.after(()=>other.dispose());await assert.rejects(other.host.open({version:1,expectedAuthorityId:f.authority,syntheticOnly:true}),{code:'LOCK_HELD'});
 const before=await f.state(0),c=S.save(f.ctx(w.repo),w.repo.getTask(f.tasks[0].id),{metadata:S.metadata({phase:{projectId:f.owner.id,phaseId:'private-phase'}})},crypto.randomUUID()),out=await w.submit(c);assert.notEqual(out.status,'committed');assert.deepEqual(await f.state(0),before);
});
test('distinct reviewed Git replicas coexist while private-profile aliasing and unscoped proof inventories reject',async t=>{
 const f=await fixture(t),a=await attach(t,f,0),b=await attach(t,f,1);for(const w of [a,b]){const status=await w.session.shared.status(w.cap);assert.equal(status.state,'ready');assert.equal(status.acceptedOriginCount,2);assert.deepEqual(Object.keys(status).sort(),['version','authorityId','head','state','acceptedOriginCount','conflicts'].sort())}
 const other=H.API.createNativeRepositoryHost(a.config,{registry:a.reg,repositoryOptions:a.options.repositoryOptions});t.after(()=>other.dispose());await assert.rejects(other.open({version:1,expectedAuthorityId:f.authority,syntheticOnly:true}),{code:'STORAGE_AUTHORITY_MISMATCH'});
 const policy=structuredClone(a.policy);policy.inventory.ids.push(crypto.randomUUID());assert.throws(()=>require('../../writer').createNativeWriterSession(a.config,{...a.options,writerPolicy:policy}));
});
