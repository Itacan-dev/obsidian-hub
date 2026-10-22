"use strict";
const fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),A=require("../../host/private-authority"),C=require("../controlled-cutover.cjs"),P=require("../../../.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation"),R=require("../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-activation"),G=require("../../host/registry"),W=require("../../writer/policy");
let sequence=0;
async function fixture(t,index=sequence++) {
 const ids=JSON.parse(process.env.ITACAN_PRODUCTION_TEST_IDS||"[]"),vaultId=ids[index];if(!vaultId)throw Error("Explicit disposable test identities required");
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"itacan-permanent-test-")),vault=path.join(root,"vault"),roaming=path.join(root,"roaming"),local=await fs.realpath(process.env.LOCALAPPDATA),before=process.env.APPDATA;process.env.APPDATA=roaming;t?.after(()=>{process.env.APPDATA=before});
 const write=async(base,name,value)=>{const f=path.join(base,name);await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,value)};
 const projectRoot="Projects/Pulsed Optomechanics",dashboard=projectRoot+"/Pulsed Optomechanics.md",source=projectRoot+"/Meta/Tasks.md",deviceId=crypto.randomUUID();
 await write(vault,dashboard,"---\ntype: project\nprojectId: "+A.PROJECT+"\nstatus: active\n---\n# Synthetic owner\n");await write(vault,source,"# Retain\n\n- [ ] Archived original\n\nProse stays.\n");await write(vault,".obsidian/plugins/hub-project-menu/data.json",JSON.stringify({completedTaskHistory:[],taskMetadata:{}}));
 await write(roaming,"obsidian/obsidian.json",JSON.stringify({vaults:{[vaultId]:{path:vault}}}));await write(roaming,"obsidian/Local Storage/leveldb/CURRENT","synthetic device observation");
 const evidenceRoot=path.join(roaming,"obsidian/Local Storage/leveldb"),deviceEvidence={version:1,deviceId,source:evidenceRoot,hashes:{CURRENT:A.digest(await fs.readFile(path.join(evidenceRoot,"CURRENT")))}};
 const staged=path.join(root,"build"),packageRoot=path.join(vault,".obsidian/plugins/hub-project-menu");for(const name of C.ASSETS){await write(packageRoot,name,"original:"+name);await write(staged,name,(name==="main.js"?"candidate:":"original:")+name)}
 const archive=(await P.captureArchive({vaultRoot:vault,vaultId,localDataRoot:local,archivesRoot:path.join(root,"archives")})).archive;
 const plan=await C.prepare({archive,deviceId,deviceEvidence,localDataRoot:local,staged,packageRoot}),config=plan.options.config;
 const base=path.join(local,"Itacan/NativeTasks/v1",A.digest(vaultId).slice(0,24));await fs.mkdir(base);await write(base,"TEST-OWNER.json",JSON.stringify({vaultId,root,authorityId:config.authorityId}));await fs.mkdir(config.directory,{recursive:true});
 const relative=path.relative(await fs.realpath(os.tmpdir()),await fs.realpath(config.directory));if(!relative.startsWith(".."))throw Error("Test must actually run outside OS Temp");
 const body={version:1,registryId:config.registryId,applicationContextId:config.applicationContextId,revision:JSON.stringify([A.PROJECT,projectRoot,dashboard,"active",false]),owners:[{owner:plan.owner,partitionId:"private",root:projectRoot,dashboard,status:"active",available:true,shared:false,shareApproval:null,locations:[],mounts:[]}]};
 const registry={read:async()=>({...body,digest:G.registryDigest(body)}),subscribe:()=>()=>{}},writerPolicy=W.policy({version:1,owners:[{owner:plan.owner,partitionId:"private"}],commands:["task.createRich","task.save","task.complete","step.complete","task.delete"],inventory:{version:1,revision:"synthetic-empty",ids:[]},phases:{version:1,revision:"no-phases",values:[]}});
 return{root,vault,roaming,local,vaultId,base,source,staged,packageRoot,plan,config,registry,writerPolicy,options:{owner:plan.owner,registry,writerPolicy,rehearsalId:plan.options.rehearsalId,consumerUiV1:true,historyUiV1:true},write};
}
module.exports={fixture,fs,path,os,crypto,A,C,P,R};
