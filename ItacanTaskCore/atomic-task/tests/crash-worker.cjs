"use strict";
// Disposable test child only. Pauses delegated actual publication, never mocks it.
const S=require("./runtime-support.cjs"),A=require("../../application/tests/support.cjs");
(async()=>{const[inputFile,signalFile]=process.argv.slice(2),input=JSON.parse(await S.fs.readFile(inputFile,"utf8"));let armed=input.mode==="fence";
 async function pause(stage){if(!armed||stage!==input.stage)return;const lock=await S.fs.readFile(S.path.join(input.directory,"WRITER.lock"),"utf8");await S.fs.writeFile(signalFile,JSON.stringify({stage,pid:process.pid,host:S.os.hostname(),lock}));setInterval(()=>{},1000);await new Promise(()=>{});}
 if(input.mode==="fence"){const repo=await S.J.openJsonRepository({directory:input.directory,storageFormat:"private-v4",expectedAuthorityId:input.authorityId,idFactory:S.id,fault:pause});await repo.close();return;}
 const f=await A.fixture(null,{unopened:true,directory:input.directory,authorityId:input.authorityId,policy:input.policy,...(input.registry?{registry:{snapshot:()=>input.registry,read:async()=>input.registry,subscribe:()=>()=>{}}}:{}),repositoryOptions:{fault:pause},...(input.stage==="before-coherent-return"?{readHost:h=>({...h,read:async(...args)=>{const r=await h.read(...args);await pause("before-coherent-return");return r;}})}:{})});
 await f.host.open({version:1,expectedAuthorityId:input.authorityId,syntheticOnly:true});await f.reconnect();
 if(input.mode.startsWith("oath")){
  const H=require("../../oath/tests/adapter-support.cjs"),h=H.H.legacy(),o=h.fixture(),task=f.repo.getTask(input.intent.action.target.taskId);h.commit(o,["parent"],task.owner,"active");
  globalThis.localStorage={getItem:()=>o.oath.deviceId,setItem(){throw Error("No device persistence");}};
  const {HubDataStore}=require(f.root+"/.obsidian/plugins/hub-project-menu/lib/services/data-store.js"),plugin={...o.plugin,app:{vault:{adapter:{getBasePath:()=>input.dataDirectory},configDir:".obsidian"}},manifest:{dir:input.dataDirectory}},store=new HubDataStore(plugin);store.sharedProjects.prepare=async()=>null;const seed=S.clone(o.wizard.data);seed.oathsByDevice[o.oath.deviceId].current=null;await store.save(seed);o.plugin.dataStore=store;await o.oath.persist(o.oath.current);
  const target=f.target(task);target.session={deviceId:o.oath.deviceId,oathId:o.oath.current.id};const cut={authorityId:f.authorityId,repositoryRevision:f.repo.info().revision,revisionId:f.repo.info().revisionId},order={version:1,kind:"closed-synthetic",session:target.session,targets:[target],save:{acknowledgement:"observed",snapshotDigest:S.H(JSON.parse(await S.fs.readFile(store.dataFilePath(),"utf8")))},cut,openTasks:[{taskId:task.id,taskRevision:task.revision}]};
  const committed=await f.app.mutate(input.intent);S.assert.equal(committed.status,"committed");const port=f.API.createCompletionEvidencePort(f.host);await f.host.refresh();const proof=await port.readCurrentCompletionProof({version:2,requestGeneration:1,authorityId:f.authorityId,ownerContextPin:f.host.info().ownerContextPin,targets:[target],enrollmentCut:cut});S.assert.equal(require("../../oath/completion-proof").assessQualifiedCompletion(target,proof.rows[0],proof,order).state,"eligible");o.oath.work=[{ref:o.oath.current.tasks[0],task:{...task,completed:true}}];
  if(input.mode==="oath-failure"){
   const save=store.save.bind(store);store.save=async()=>{throw Error("Synthetic failed fulfillment save");};await S.assert.rejects(o.oath.markFulfilled());S.assert(o.oath.pendingFulfilment);store.save=save;
   const current=f.repo.getTask(task.id),q=S.save({repo:f.repo,options:{externalReservations:input.policy.inventory},storage:{}},current,{parentCompletion:{kind:"reopen"}}),action={kind:"full-save",target:{taskId:task.id,expectedTaskRevision:current.revision},guards:Object.fromEntries(["expectedContentRevision","expectedTreeDigest","expectedBindings","recurrence"].map(k=>[k,q.payload[k]])),draft:q.payload.draft};S.assert.equal((await f.app.mutate(await f.intent(action,{version:2}))).status,"committed");armed=true;await pause("after-failed-save-reopen");
  }else{
   const rename=S.fs.rename.bind(S.fs);S.fs.rename=async(from,to)=>{if(S.path.resolve(to)===store.dataFilePath()&&input.stage==="before-oath-publication")await pause(input.stage);const r=await rename(from,to);if(S.path.resolve(to)===store.dataFilePath()&&input.stage==="after-oath-publication")await pause(input.stage);return r;};armed=true;await o.oath.markFulfilled();
  }
  throw Error("Oath interruption stage not reached");
 }
 armed=true;const r=await f.app.mutate(input.intent);process.stdout.write(JSON.stringify(r));await f.session.dispose();
})().catch(e=>{process.stderr.write(e.stack);process.exitCode=1;});
