"use strict";
const fs=require("fs"),path=require("path"),os=require("os");
const base=process.env.ATLAS_STORAGE_SOURCE||path.resolve(__dirname,"..");
const {fixture}=require(path.join(base,"tests/helpers")), {AtlasFileRepository}=require(path.join(base,"obsidian/persistence"));
const cleanups=[], t={after:fn=>cleanups.push(fn)}, result={date:"2026-10-26",cases:[]};
(async()=>{
 const f=await fixture(t);const open=f.io.openSync;let armed=true;
 f.io.openSync=(name,...args)=>{if(armed&&path.basename(String(name)).startsWith(".authority-")){armed=false;throw Object.assign(Error("synthetic transient"),{code:"EBUSY"});}return open(name,...args);};
 f.advance(1);await f.runtime.observe();const failed=f.runtime.view();f.io.openSync=open;f.advance(1);await f.runtime.observe();
 result.cases.push({name:"confirmed-pre-journal-failure-latches",afterFailure:failed.status,reason:failed.reason,afterHealthyObservation:f.runtime.view().status,journalAbsent:f.repository.read("pending.json")===null,policyIntact:f.runtime.view().snapshot.policy.whitelist.includes("trusted.test")});
 await f.runtime.command({kind:"RECOVER"});result.cases[0].afterManualRecovery=f.runtime.view().status;
 const original=f.repository.lastBytes, read=f.io.readFileSync;let authorityReads=0;
 f.io.readFileSync=(name,...args)=>{const value=read(name,...args);if(String(name)===f.repository.file("authority.json")&&++authorityReads===1){const data=JSON.parse(value);data.snapshot.policy.whitelist.push("external.test");fs.writeFileSync(name,JSON.stringify(data));}return value;};
 const loaded=await f.repository.load();f.io.readFileSync=read;
 result.cases.push({name:"load-validation-cached-bytes-race",loadedType:loaded.type,returnedOldPolicy:!loaded.envelope.snapshot.policy.whitelist.includes("external.test"),cachedBytesChanged:f.repository.lastBytes!==original,cachedBytesEqualExternal:JSON.parse(f.repository.lastBytes).snapshot.policy.whitelist.includes("external.test")});
 fs.writeFileSync(f.repository.file("authority.json"),original);f.repository.lastBytes=original;
 const d=f.runtime.view().application.destinations[0], c=f.attach();await f.navigate(c,"https://trusted.test/");await f.arrive(c);const before=f.effects.blocks.length;
 f.io.openSync=(name,...args)=>{if(path.basename(String(name)).startsWith(".authority-"))throw Object.assign(Error("synthetic transient"),{code:"EBUSY"});return open(name,...args);};
 const v=f.runtime.view();await f.runtime.command({kind:"SAVE_DISPLAY_DETAILS",destinationId:d.id,label:"Kept local edit",category:d.category,pinned:d.pinned,basePolicyRevision:v.snapshot.policyRevision,baseApplicationRevision:v.application.revision});f.io.openSync=open;
 result.cases.push({name:"definite-display-failure-closes-content",closedByDisplayFailure:f.effects.blocks.length>before,controller:f.runtime.view().status});
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"atlas-storage-probe-")),io=Object.create(fs),sync=fs.fsyncSync;let once=true;
 io.fsyncSync=fd=>{if(once){once=false;throw Object.assign(Error("synthetic fsync"),{code:"EIO"});}return sync(fd);};
 const repository=new AtlasFileRepository(directory);
 repository.io=io;const first=await repository.load();io.fsyncSync=sync;const second=await repository.load();result.cases.push({name:"owner-lock-acknowledgement-failure",first:first.type,second:second.type,issue:repository.issue});
 repository.close();if(path.dirname(directory)!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith("atlas-storage-probe-"))throw Error("Cleanup scope");fs.rmSync(directory,{recursive:true,force:true});
 
 const race=await fixture(t), raceRead=race.io.readFileSync;let replaced=false;
 race.io.readFileSync=(name,...args)=>{const value=raceRead(name,...args);if(!replaced&&String(name)===race.repository.file("authority.json")){replaced=true;const data=JSON.parse(value);data.snapshot.policy.blacklist.push("trusted.test");fs.writeFileSync(name,JSON.stringify(data));}return value;};
 race.advance(1);await race.runtime.observe();race.io.readFileSync=raceRead;const revocationRetained=JSON.parse(race.repository.read("authority.json")).snapshot.policy.blacklist.includes("trusted.test");
 const releases=race.effects.releases.length;await race.navigate(race.attach(),"https://trusted.test/");
 result.cases.push({name:"external-revocation-during-load",externalWriteInjected:replaced,revocationRetained,status:race.runtime.view().status,navigationReleased:race.effects.releases.length>releases});
 const growth=await fixture(t), tab=growth.attach(), samples=[];
 for(let i=0;i<=100;i++){if([0,25,100].includes(i)){const saved=JSON.parse(growth.repository.read("authority.json"));samples.push({documents:i,bytes:Buffer.byteLength(growth.repository.read("authority.json")),journeys:saved.snapshot.journeyState.journeys.length,ended:saved.snapshot.journeyState.journeys.filter(j=>j.phase==="ENDED").length,receiptHistory:Array.isArray(saved.receipts)?saved.receipts.length:0});}if(i<100){growth.advance(1);await growth.navigate(tab,"https://trusted.test/");await growth.arrive(tab);}}
 result.cases.push({name:"persistent-growth",samples});
 const distinct=await fixture(t), distinctSamples=[];
 for(let i=0;i<=100;i++){if([0,25,100].includes(i)){const bytes=distinct.repository.read("authority.json"),saved=JSON.parse(bytes);distinctSamples.push({closedContexts:i,bytes:Buffer.byteLength(bytes),journeys:saved.snapshot.journeyState.journeys.length,ended:saved.snapshot.journeyState.journeys.filter(j=>j.phase==="ENDED").length});}if(i<100){const context=distinct.attach();distinct.advance(1);await distinct.navigate(context,"https://trusted.test/");await distinct.arrive(context);await distinct.runtime.close(context);distinct.runtime.forget(context.nativeId);if(distinct.runtime.view().contexts.length)throw Error("Closed native context was not forgotten");}}
 result.cases.push({name:"distinct-context-growth",samples:distinctSamples});
 if(process.env.ATLAS_STORAGE_EVIDENCE_OUTPUT)fs.writeFileSync(process.env.ATLAS_STORAGE_EVIDENCE_OUTPUT,JSON.stringify(result,null,2));

 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{for(const fn of cleanups.reverse())fn();});
