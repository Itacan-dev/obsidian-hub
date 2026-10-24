"use strict";
const test=require('node:test'),{assert,fixture,attach,fs,path,crypto,S}=require('./writer-support.cjs');
test('new empty replica bootstraps the reviewed shared genesis through actual host creation then receives original tasks',async t=>{
 const f=await fixture(t),packet=await f.packet(0);await f.repos[1].close();await fs.rename(f.dirs[1],f.dirs[1]+'-closed-original');await fs.mkdir(f.dirs[1]);
 const w=await attach(t,f,1,{}, {version:3,authorityId:f.authority,partitions:[{id:'shared',kind:'git-project',owner:f.owner}],reason:'Explicit peer bootstrap',syntheticOnly:true,taskMutationVersion:1,gitSharedVersion:2,genesis:packet.genesis});
 assert.equal(w.repo.info().revision,0);assert.equal(w.repo.queryTasks().length,0);const prepared=await w.session.shared.prepare(w.cap,packet,crypto.randomUUID()),out=await w.session.shared.receive(w.cap,prepared);assert.equal(out.status,'committed',JSON.stringify(out));assert.equal(w.repo.queryTasks().length,2);assert.deepEqual(w.repo.queryTasks(),f.repos[0].queryTasks());const next=await w.submit(S.rich(f.ctx(w.repo),{id:crypto.randomUUID()},f.owner,crypto.randomUUID()));assert.equal(next.status,'committed',JSON.stringify(next));
});
test('bootstrap rejects a different physical Project before initializing the empty root',async t=>{
 const f=await fixture(t),genesis=(await f.packet(0)).genesis;genesis.partition.owner.id=crypto.randomUUID();await f.repos[1].close();await fs.rename(f.dirs[1],f.dirs[1]+'-closed-original');await fs.mkdir(f.dirs[1]);
 await assert.rejects(attach(t,f,1,{}, {version:3,authorityId:f.authority,partitions:[{id:'shared',kind:'git-project',owner:f.owner}],reason:'Invalid peer bootstrap',syntheticOnly:true,taskMutationVersion:1,gitSharedVersion:2,genesis}));assert.deepEqual(await fs.readdir(f.dirs[1]),[]);
});
