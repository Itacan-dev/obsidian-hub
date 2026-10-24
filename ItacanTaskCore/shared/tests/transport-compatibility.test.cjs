"use strict";
const test=require('node:test'),{spawnSync}=require('node:child_process'),{assert,fixture,fs,path,crypto}=require('./support.cjs'),{createGitPacketTransport}=require('../git-transport');
test('immutable Git packet files reject altered bytes, wrong owners, malformed entries and non-Git roots',async t=>{
 const f=await fixture(t),root=path.join(f.root,'git-files');await fs.mkdir(root);const input={version:1,root,authorityId:f.authority,projectId:f.owner.id};await assert.rejects(createGitPacketTransport(input));const r=spawnSync('git',['init',root],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);
 const transport=await createGitPacketTransport(input),packet=await f.packet(0),saved=await transport.publish(packet);assert.deepEqual(await transport.publish(packet),saved);assert.deepEqual(await transport.read(),[packet]);
 const wrong=await createGitPacketTransport({...input,projectId:crypto.randomUUID()});await assert.rejects(wrong.publish(packet));
 const target=path.join(root,saved.relativePath),raw=await fs.readFile(target,'utf8');await fs.writeFile(target,raw.replace('itacan-git-head','forged-git-head'));await assert.rejects(transport.read());await fs.writeFile(target,raw);
 const unexpected=path.join(path.dirname(target),'unreviewed.json');await fs.writeFile(unexpected,'{}');await assert.rejects(transport.read());await fs.unlink(unexpected);assert.deepEqual(await transport.read(),[packet]);
});
test('unchanged actual frozen older private reader refuses the version-3 Git capability without fallback',async t=>{
 const f=await fixture(t),old=require('../../atomic-task/tests/support.cjs');await f.repos[0].close();const entry=await old.materializeReader(f.root,'preB2Private'),before=await old.fileHashes(f.dirs[0]),r=old.executeReader(entry,f.dirs[0],f.authority,true);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.stdout,'UNSUPPORTED_SCHEMA');assert.deepEqual(await old.fileHashes(f.dirs[0]),before);
});
