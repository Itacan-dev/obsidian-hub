"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawn } = require("node:child_process");
const { fixture, CONFIG } = require("./helpers");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");
const { cause } = require("../obsidian/storage-diagnostics");
function failCandidates(f, code = "EBUSY", count = 1) {
    const open = f.io.openSync; let hits = 0;
    f.io.openSync = (name, ...args) => {
        if (path.basename(String(name)).startsWith(".authority-") && hits < count) {
            hits++; throw Object.assign(Error("private path/URL/token must not escape"), { code });
        }
        return open(name, ...args);
    };
    return { restore: () => { f.io.openSync = open; }, hits: () => hits };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const propose = f => f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["trusted.test", "new.test"], blacklist: ["blocked.test"] } });

test("storage: one proven busy checkpoint recovers the same owner and retains independently valid pages", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c,"https://trusted.test/"); await f.arrive(c);
    const controller = f.runtime.controller, blocks = f.effects.blocks.length, releases = f.effects.releases.length, policy = f.snapshot().policy;
    const fault = failCandidates(f); f.advance(1); await f.runtime.observe(); fault.restore();
    const view = f.runtime.view(); assert.equal(fault.hits(),1); assert.equal(view.status,"READY"); assert.equal(f.runtime.controller,controller);
    assert.deepEqual(view.snapshot.policy,policy); assert.equal(view.recovery.automaticAttempts,1); assert.equal(view.recovery.automaticSucceeded,1);
    assert.equal(f.effects.blocks.length,blocks); assert.equal(f.effects.releases.length,releases); assert.equal(c.phase,"DISPLAYED");
    assert.equal(view.storage.lastFailure.cause,"BUSY"); assert.equal(view.storage.lastFailure.outcome,"NOT_WRITTEN");
    const denied=f.attach();await f.navigate(denied,"https://blocked.test/");assert.equal(denied.response.decision.reason,"BLACKLISTED");
});
test("storage: recovery persistence acknowledgement precedes READY and any fresh native release", async t => {
    const f=await fixture(t),entered=deferred(),ack=deferred(),commit=f.repository.commit.bind(f.repository);let withheld=false;
    const fault=failCandidates(f);
    f.repository.commit=async request=>{const result=await commit(request);if(!withheld&&fault.hits()&&result.type==="COMMITTED"){withheld=true;entered.resolve();await ack.promise;}return result;};
    f.advance(1);const observation=f.runtime.observe();await entered.promise;
    assert.equal(f.runtime.view().status,"COMMITTING");const navigation=f.navigate(f.attach(),"https://trusted.test/");assert.equal(f.effects.releases.length,0);
    ack.resolve();await observation;await navigation;fault.restore();assert.equal(f.runtime.view().status,"READY");assert.equal(f.effects.releases.length,1);
});
test("storage: persistent failure exhausts one recovery attempt without periodic write or reset loops", async t => {
    const f=await fixture(t),fault=failCandidates(f,"EBUSY",Infinity);f.advance(1);await f.runtime.observe();
    assert.equal(f.runtime.view().status,"UNAVAILABLE");const writes=f.runtime.view().storage.writeAttempts;
    for(let i=0;i<50;i++){f.advance(1000);await f.runtime.observe();}
    const view=f.runtime.view();assert.equal(view.recovery.automaticAttempts,1);assert.equal(view.recovery.automaticFailed,1);assert.equal(view.storage.writeAttempts,writes);assert.equal(fault.hits(),2);
    assert.ok(view.snapshot.policy.whitelist.includes("trusted.test"));await f.runtime.command({kind:"RECOVER"});const afterManual=f.runtime.view().storage.writeAttempts;for(let i=0;i<5;i++)await f.runtime.observe();assert.equal(f.runtime.view().recovery.automaticAttempts,1);assert.equal(f.runtime.view().storage.writeAttempts,afterManual);fault.restore();await f.runtime.command({kind:"RECOVER"});assert.equal(f.runtime.view().status,"READY");assert.equal(f.runtime.view().recovery.manualSucceeded,1);
});
test("storage: capacity, access, readonly, resource and unclassified errors never auto-recover", async t => {
    for(const [code,expected]of [["ENOSPC","CAPACITY"],["EDQUOT","CAPACITY"],["EACCES","ACCESS_DENIED"],["EROFS","READ_ONLY"],["EMFILE","RESOURCE_LIMIT"],["UNTRUSTED_PRIVATE_VALUE","OTHER"]]){
        const f=await fixture(t),fault=failCandidates(f,code);f.advance(1);await f.runtime.observe();fault.restore();
        assert.equal(f.runtime.view().status,"UNAVAILABLE",code);assert.equal(f.runtime.view().recovery.automaticAttempts,0);assert.equal(f.runtime.view().storage.lastFailure.cause,expected);
    }
});
test("storage: interrupted and I/O failures receive the same bounded verified recovery", async t => {
    for(const code of ["EINTR","EIO"]){const f=await fixture(t),fault=failCandidates(f,code);f.advance(1);await f.runtime.observe();fault.restore();assert.equal(f.runtime.view().status,"READY");assert.equal(f.runtime.view().recovery.automaticAttempts,1);}
});
test("storage: an uncertain applied write never auto-recovers or replays a policy confirmation", async t => {
    const f=await fixture(t);await propose(f);const pending=f.snapshot().vaultState.pendingProposal;f.advance(30);f.loseAcknowledgement(true);
    assert.equal((await f.runtime.command({kind:"CONFIRM_POLICY",proposalId:pending.id})).type,"BLOCKED");assert.equal(f.runtime.view().status,"RECONCILING");
    f.loseAcknowledgement(false);for(let i=0;i<10;i++)await f.runtime.observe();assert.equal(f.runtime.view().status,"RECONCILING");assert.equal(f.runtime.view().recovery.automaticAttempts,0);
    await f.runtime.command({kind:"RECOVER"});assert.equal(f.snapshot().policyRevision,1);assert.equal(f.snapshot().vaultState.pendingProposal,null);assert.equal(f.snapshot().vaultState.nextProposalId,pending.id+1);assert.equal(f.effects.opened.length,0);
});
test("storage: corrupt, incompatible and missing initialized authority stay fenced without reset", async t => {
    for(const alteration of ["corrupt","incompatible","missing"]){const f=await fixture(t);if(alteration==="missing")fs.unlinkSync(f.repository.file("authority.json"));else if(alteration==="corrupt")fs.writeFileSync(f.repository.file("authority.json"),"{broken");else{const e=JSON.parse(f.repository.read("authority.json"));e.schemaVersion=999;fs.writeFileSync(f.repository.file("authority.json"),JSON.stringify(e));}
        await f.runtime.observe();for(let i=0;i<3;i++)await f.runtime.observe();assert.equal(f.runtime.view().status,"UNAVAILABLE");assert.equal(f.runtime.view().recovery.automaticAttempts,0);
        assert.equal((await f.runtime.command({kind:"INITIALIZE",policy:{whitelist:[],blacklist:[]},configuration:CONFIG})).reason,"ALREADY_INITIALIZED");
    }
});
test("storage: a concurrent external revocation cannot be hidden by a second load read and overwritten", async t => {
    const f=await fixture(t),read=f.io.readFileSync;let injected=false,external;
    f.io.readFileSync=(name,...args)=>{const bytes=read(name,...args);if(!injected&&String(name)===f.repository.file("authority.json")){injected=true;const e=JSON.parse(bytes);e.snapshot.policy.blacklist.push("trusted.test");external=JSON.stringify(e);fs.writeFileSync(name,external);}return bytes;};
    f.advance(1);await f.runtime.observe();f.io.readFileSync=read;
    assert.equal(f.repository.read("authority.json"),external);assert.notEqual(f.runtime.view().status,"READY");
    await f.navigate(f.attach(),"https://trusted.test/");assert.equal(f.effects.releases.length,0);assert.equal(f.runtime.view().recovery.automaticAttempts,0);
});
test("storage: settlement caches only verified bytes and rejects an external change before reload", async t => {
    const f=await fixture(t);f.loseAcknowledgement(true);await propose(f);f.loseAcknowledgement(false);
    const read=f.io.readFileSync;let injected=false,external;
    f.io.readFileSync=(name,...args)=>{const bytes=read(name,...args);if(!injected&&String(name)===f.repository.file("authority.json")){injected=true;const e=JSON.parse(bytes);e.storageVersion="external-new-version";e.snapshot.policy.blacklist.push("trusted.test");external=JSON.stringify(e);fs.writeFileSync(name,external);}return bytes;};
    await f.runtime.command({kind:"RECOVER"});f.io.readFileSync=read;assert.ok(injected);
    assert.notEqual(f.runtime.view().status,"READY");assert.equal(f.repository.read("authority.json"),external);assert.notEqual(f.repository.lastBytes,external);
});
test("storage: a journal replaced before cleanup remains intact and unresolved", async t => {
    const f=await fixture(t);f.loseAcknowledgement(true);await propose(f);f.loseAcknowledgement(false);
    const original=f.repository.read("pending.json"),foreign={...JSON.parse(original),commitId:"foreign-journal"},read=f.io.readFileSync;let injected=false;
    f.io.readFileSync=(name,...args)=>{const bytes=read(name,...args);if(!injected&&String(name)===f.repository.file("authority.json")){injected=true;fs.writeFileSync(f.repository.file("pending.json"),JSON.stringify(foreign));}return bytes;};
    await f.runtime.command({kind:"RECOVER"});f.io.readFileSync=read;assert.ok(injected);assert.equal(f.runtime.view().status,"RECONCILING");
    assert.equal(JSON.parse(f.repository.read("pending.json")).commitId,foreign.commitId);assert.equal(f.runtime.view().storage.lastFailure.cause,"JOURNAL_CHANGED");
});
test("storage: interrupted own-lock acknowledgement can finish without reclaiming another owner", async t => {
    const f=await fixture(t);f.repository.close();const io=Object.create(fs);let first=true;io.fsyncSync=fd=>{if(first){first=false;throw Object.assign(Error("flush interrupted"),{code:"EIO"});}fs.fsyncSync(fd);};
    const r=new AtlasFileRepository(f.directory,{io,configuration:CONFIG});try{assert.equal((await r.load()).type,"UNAVAILABLE");const owner=r.read("owner.lock");io.fsyncSync=fs.fsyncSync;const loaded=await r.load();assert.equal(loaded.type,"READY");assert.equal(r.read("owner.lock"),owner);assert.ok(loaded.envelope.snapshot.policy.whitelist.includes("trusted.test"));const other=new AtlasFileRepository(f.directory,{configuration:CONFIG});assert.equal((await other.load()).type,"UNAVAILABLE");}finally{r.close();}
});
test("storage: stable loads and renderer descriptions perform no authority writes or fsyncs", async t => {
    const f=await fixture(t),counts={writeFileSync:0,fsyncSync:0,renameSync:0};
    for(const key of Object.keys(counts)){const original=f.io[key];f.io[key]=(...args)=>{counts[key]++;return original(...args);};}
    for(let i=0;i<20;i++){f.runtime.view();assert.equal((await f.repository.load()).type,"READY");}
    assert.deepEqual(counts,{writeFileSync:0,fsyncSync:0,renameSync:0});assert.equal(f.runtime.view().storage.writeAttempts,1);
});
test("storage: a proven aborted display save keeps browsing, input intent and committed metadata intact", async t => {
    const f=await fixture(t),c=f.attach();await f.navigate(c,"https://trusted.test/");await f.arrive(c);const before=f.runtime.view(),blocks=f.effects.blocks.length,d=before.application.destinations[0],fault=failCandidates(f);
    const result=await f.runtime.command({kind:"SAVE_DISPLAY_DETAILS",destinationId:d.id,label:"Local unsaved name",category:d.category,pinned:!d.pinned,basePolicyRevision:before.snapshot.policyRevision,baseApplicationRevision:before.application.revision});fault.restore();
    assert.equal(result.reason,"PRESENTATION_NOT_WRITTEN");assert.equal(f.effects.blocks.length,blocks);assert.equal(f.runtime.view().status,"READY");assert.deepEqual(f.runtime.view().application,before.application);assert.equal(f.runtime.view().recovery.automaticAttempts,0);
});
test("storage: failed Greylist confirmation is never replayed and frozen request terms do not renew", async t => {
    const f=await fixture(t),c=f.attach();await f.navigate(c,"https://grey.test/");await f.command(c,"START_ACCESS");const pending=structuredClone(f.snapshot().accessState.pendingRequests[0]);f.advance(10);
    const fault=failCandidates(f);const result=await f.command(c,"CONFIRM_ACCESS_AND_OPEN");fault.restore();
    assert.equal(result.type,"BLOCKED");assert.equal(f.runtime.view().status,"READY");assert.deepEqual(f.snapshot().accessState.pendingRequests,[pending]);assert.equal(f.snapshot().accessState.grants.length,0);assert.equal(f.effects.opened.length,0);
    f.advance(60);await f.runtime.observe();assert.equal(f.snapshot().accessState.grants.length,0);assert.equal(f.snapshot().accessState.pendingRequests[0].confirmBy,pending.confirmBy);
});
test("storage: Vault wait, candidate, configuration and deadline survive a failed confirmation exactly", async t => {
    const f=await fixture(t);await propose(f);const pending=structuredClone(f.snapshot().vaultState.pendingProposal),configuration=f.snapshot().configuration;f.advance(30);
    const fault=failCandidates(f);const result=await f.runtime.command({kind:"CONFIRM_POLICY",proposalId:pending.id});fault.restore();
    assert.equal(result.type,"BLOCKED");assert.equal(f.runtime.view().status,"READY");assert.equal(f.snapshot().policyRevision,0);assert.deepEqual(f.snapshot().configuration,configuration);assert.deepEqual(f.snapshot().vaultState.pendingProposal,pending);
    f.advance(60);await f.runtime.observe();assert.equal((await f.runtime.command({kind:"CONFIRM_POLICY",proposalId:pending.id})).reason,"PROPOSAL_EXPIRED");assert.equal(f.snapshot().policyRevision,0);
});
test("storage: a recovered grant keeps its original expiry and an expired grant cannot authorize", async t => {
    const f=await fixture(t),c=f.attach();await f.navigate(c,"https://grey.test/");await f.command(c,"START_ACCESS");f.advance(10);await f.command(c,"CONFIRM_ACCESS_AND_OPEN");const grant=structuredClone(f.snapshot().accessState.grants[0]);
    const fault=failCandidates(f);f.advance(1);await f.runtime.observe();fault.restore();assert.deepEqual(f.snapshot().accessState.grants,[grant]);
    f.setTime(grant.expiresAt);await f.runtime.observe();const releases=f.effects.releases.length;await f.navigate(f.attach(),"https://grey.test/");assert.equal(f.effects.releases.length,releases);
});
test("storage: recovery ends a lost Journey and never replays an intermediate navigation", async t => {
    const f=await fixture(t),c=f.attach();await f.navigate(c,"https://trusted.test/redirect");const requestId=c.flight.requestId;
    await f.navigate(c,"https://idp.test/login",{redirectedFrom:requestId,redirectTarget:"https://idp.test/login"});await f.arrive(c);
    const journey=structuredClone(f.snapshot().journeyState.journeys[0]),releases=f.effects.releases.length,fault=failCandidates(f);
    f.advance(1);await f.runtime.observe();fault.restore();const saved=f.snapshot().journeyState.journeys[0];
    assert.equal(saved.phase,"ENDED");assert.equal(saved.expiresAt,journey.expiresAt);assert.equal(saved.id,journey.id);assert.equal(f.effects.releases.length,releases);assert.equal(f.effects.opened.length,0);assert.equal(c.displayed,null);
    await f.navigate(f.attach(),"https://idp.test/login");assert.equal(f.effects.releases.length,releases);
});
test("storage: a loading request loses its binding on recovery instead of being continued again", async t => {
    const f=await fixture(t),c=f.attach();await f.navigate(c,"https://trusted.test/");const old=c.flight,releases=f.effects.releases.length,fault=failCandidates(f);
    f.advance(1);await f.runtime.observe();fault.restore();assert.equal(c.flight,null);assert.notEqual(c.generation,old.generation);assert.equal(f.effects.releases.length,releases);assert.equal(f.effects.opened.length,0);
});
test("storage: a destroyed context cannot receive a late retained-page lease", async t => {
    const f=await fixture(t),c=f.attach();await f.navigate(c,"https://trusted.test/");await f.arrive(c);const leases=f.effects.leases.length,entered=deferred(),resume=deferred(),load=f.repository.load.bind(f.repository);let reads=0;
    f.repository.load=async()=>{const result=await load();if(++reads===2){entered.resolve();await resume.promise;}return result;};
    const observation=f.runtime.observe();await entered.promise;const closing=f.runtime.close(c);resume.resolve();await observation;await closing;assert.equal(f.effects.leases.length,leases);assert.equal(c.displayed,null);
});
test("storage: suspended owners reject new policy actions and resume with the same controller", async t => {
    const f=await fixture(t),controller=f.runtime.controller;f.runtime.suspend();assert.equal((await propose(f)).reason,"INTEGRATION_SUSPENDED");assert.equal(f.snapshot().vaultState.pendingProposal,null);
    await f.runtime.open();assert.equal(f.runtime.controller,controller);assert.equal((await propose(f)).type,"COMMITTED");
});
test("storage: diagnostic failure cannot disable healthy authorization or expose raw error data", async t => {
    const f=await fixture(t),get=f.repository.getDiagnostics;f.repository.getDiagnostics=()=>{throw Error("private data");};await f.navigate(f.attach(),"https://trusted.test/");assert.equal(f.effects.releases.length,1);f.repository.getDiagnostics=get;
    const fault=failCandidates(f,"ENOSPC");f.advance(1);await f.runtime.observe();fault.restore();
    const diagnostic=JSON.stringify(f.runtime.view().storage);assert.ok(!diagnostic.includes("private")&&!diagnostic.includes(f.directory)&&!diagnostic.includes("trusted.test"));
    for(const code of ["__proto__","constructor","toString","private-token"])assert.equal(cause({code}),"OTHER");
});
test("storage: an uncertain legacy migration reconciles once without policy or display loss", async t => {
    const f=await fixture(t);f.repository.close();const legacy=JSON.parse(f.repository.read("authority.json"));legacy.schemaVersion=1;delete legacy.snapshot.configuration;delete legacy.snapshot.configurationRevision;
    fs.writeFileSync(f.repository.file("authority.json"),JSON.stringify(legacy));const io=Object.create(fs);let lost=false;io.renameSync=(a,b)=>{fs.renameSync(a,b);if(!lost){lost=true;throw Object.assign(Error("lost ack"),{code:"EIO"});}};
    const r=new AtlasFileRepository(f.directory,{io,configuration:CONFIG}),runtime=createAtlasRuntime({repository:r,clock:{now:()=>1001},configuration:CONFIG});try{
        await runtime.open();assert.equal(runtime.view().status,"RECONCILING");assert.equal(runtime.view().recovery.automaticAttempts,0);io.renameSync=fs.renameSync;
        await runtime.command({kind:"RECOVER"});assert.equal(runtime.view().status,"READY");assert.deepEqual(runtime.view().snapshot.policy,legacy.snapshot.policy);assert.deepEqual(runtime.view().application,legacy.application);assert.equal(runtime.view().storage.migrations,1);
    }finally{r.close();}
});
test("storage: a real Windows sharing violation leaves a journal fenced until explicit resolution", { skip: process.platform!=="win32" }, async t => {
    const f=await fixture(t),file=f.repository.file("authority.json").replace(/'/g,"''");
    const script="$atlasHandle=[IO.File]::Open('"+file+"',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);try{[Console]::Out.WriteLine('LOCKED');[Console]::Out.Flush();[Console]::In.ReadLine() | Out-Null}finally{$atlasHandle.Dispose()}";
    const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-EncodedCommand",Buffer.from(script,"utf16le").toString("base64")],{windowsHide:true,stdio:["pipe","pipe","pipe"]});
    try{
        await new Promise((resolve,reject)=>{let output="";const timeout=setTimeout(()=>reject(Error("Sharing helper timeout")),5000);child.stdout.on("data",data=>{output+=data;if(output.includes("LOCKED")){clearTimeout(timeout);resolve();}});child.once("error",reject);child.once("exit",code=>{if(!output.includes("LOCKED")){clearTimeout(timeout);reject(Error("Sharing helper failed: "+code));}});});
        f.advance(1);await f.runtime.observe();assert.equal(f.runtime.view().status,"RECONCILING");assert.equal(f.runtime.view().recovery.automaticAttempts,0);assert.ok(f.repository.read("pending.json"));assert.equal(f.runtime.view().storage.lastFailure.outcome,"UNKNOWN");
    }finally{if(child.pid&&child.exitCode===null){const exited=new Promise(resolve=>child.once("exit",resolve));const timeout=setTimeout(()=>child.kill(),2000);try{child.stdin.end("release\n");await exited;}finally{clearTimeout(timeout);}}}
    await f.runtime.command({kind:"RECOVER"});assert.equal(f.runtime.view().status,"READY");assert.ok(f.snapshot().policy.whitelist.includes("trusted.test"));assert.equal(f.repository.read("pending.json"),null);
});
