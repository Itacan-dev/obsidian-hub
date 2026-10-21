"use strict";
const H=require("../../host/tests/support.cjs"), API=require(".."),P=require("../policy");
const intents=new Map(),storages=new Map(), originalCommit=H.J.JsonGenerationStorage.prototype.commit;
H.J.JsonGenerationStorage.prototype.commit=async function(...args){storages.set(this.port.directory,this);if(args[2])intents.set(this.port.directory,args[2]);return originalCommit.apply(this,args);};
const policy=()=>({version:1,owners:H.owners.map(x=>({owner:x.owner,partitionId:x.partitionId})),commands:[...P.task,...P.step,...P.recurrence],inventory:{version:1,revision:"synthetic-inventory",ids:[]},phases:{version:1,revision:"synthetic-phases",values:[{projectId:"private",phaseId:"phase-1"}]}});
async function fixture(t,extra={}){
 const directory=extra.directory??await H.fs.mkdtemp(H.path.join(H.os.tmpdir(),"itacan-n3a-store-")),authorityId=extra.authorityId??H.id(),reg=extra.registry??H.registry(),p=extra.policy??policy();
 const config={version:1,scope:"inactive-disposable",storageFormat:"private-v4",authorityId,directory,applicationContextId:"synthetic-app",registryId:"synthetic-registry"};
 const options={registry:reg,writerPolicy:p,repositoryOptions:{idFactory:H.id,clock:()=>1800000000000,...extra.repositoryOptions}};const session=API.createNativeWriterSession(config,options);t?.after(()=>session.dispose());
 if(!extra.unopened)await session.host.create({version:1,authorityId,partitions:H.partitions,reason:"Synthetic N3-A",syntheticOnly:true});
 const v={...H,get intent(){return intents.get(directory);},get storage(){return storages.get(directory);},session,host:session.host,config,options,directory,authorityId,reg,policy:p,get repo(){return H.held.get(directory);}};
 v.authorize=()=>session.authorize({version:1,owners:p.owners,commands:p.commands});if(!extra.unopened)v.cap=await v.authorize();
 v.request=async(command)=>{await v.host.refresh();const info=v.repo.info(),owners=command.type==="task.create"?[command.payload.task.owner]:command.type==="task.createMany"?command.payload.tasks.map(t=>t.owner):[v.repo.getTask(command.taskId,{includeDeleted:true})?.owner??H.owners[2].owner];return{version:1,reason:"Synthetic writer verification",scope:{authorityId,ownerContextPin:reg.snapshot().digest,identityPin:null,inventoryPin:P.hash(p.inventory),phasePin:P.hash(p.phases),partitions:info.partitions.filter(x=>owners.some(o=>P.same(o,x.owner))).map(x=>({id:x.id,owner:x.owner,expectedRevision:x.revision}))},command:{...command,expectedRepositoryRevision:command.expectedRepositoryRevision??info.revision}};};
 v.submit=(r,cap=v.cap,signal)=>session.writer[r.command.type.startsWith("step.")?"step":r.command.type.startsWith("recurrence.")?"recurrence":"task"](cap,r,signal);
 v.create=async(patch={})=>{const r=await v.request({type:"task.create",operationId:H.id(),payload:{task:{owner:H.owners[2].owner,title:"Native parent",...patch}}}),result=await v.submit(r);H.assert.equal(result.status,"committed",JSON.stringify(result));return v.repo.getTask(result.tasks[0].id);};
 v.mutate=async(task,type,payload)=>v.submit(await v.request({type,operationId:H.id(),taskId:task.id,expectedRevision:v.repo.getTask(task.id,{includeDeleted:true}).revision,payload}));
 v.state=async()=>{const m=JSON.parse(await H.fs.readFile(H.path.join(directory,"CURRENT.json"),"utf8")).payload;return require("../../src/private-storage-codec").decodePrivateGeneration(await H.fs.readFile(H.path.join(directory,m.current.file),"utf8"),authorityId).state;};return v;
}
module.exports={...H,fixture,policy,P};
