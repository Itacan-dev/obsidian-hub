"use strict";
// Explicit offline archive-and-switch for one physical owner; never imported by startup.
const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto");
const A=require("../host/private-authority"),C=require("./controlled-cutover.cjs"),P=require("../../.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation"),R=require("../../.obsidian/plugins/hub-project-menu/lib/services/native-task-activation"),V=require("../src/value");
const check=(ok,message)=>{if(!ok)throw Error(message)},same=(a,b)=>V.canonical(a)===V.canonical(b);
async function writeNew(file,value){const h=await fs.open(file,"wx",0o600);try{await h.writeFile(JSON.stringify(value,null,2)+"\n");await h.sync()}finally{await h.close()}}
async function dependencies(plan){
 const data=JSON.parse(await fs.readFile(path.join(plan.options.config.binding.vaultRoot,".obsidian/plugins/hub-project-menu/data.json"),"utf8")),m=await P.verifyArchive(plan.archive),ids=m.sources.filter(s=>same(s.owner,plan.owner));
 const inventory=await P.inspectVault(plan.options.config.binding.vaultRoot),identities=inventory.sources.filter(s=>same(s.owner,plan.owner)).flatMap(s=>s.parsed.identities??[]);
 const keys=[plan.owner.id,plan.owner.type==="resource"?"resource:"+plan.owner.id:plan.owner.id,plan.projectRoot,...identities];
 const references=v=>typeof v==="string"?keys.includes(v)||v.startsWith(plan.projectRoot+"/"):Array.isArray(v)?v.some(references):v&&typeof v==="object"?Object.values(v).some(references):false;
 check(!Object.values(data.oathsByDevice??{}).some(b=>["active","scheduled"].includes(b.current?.state)&&references(b.current)),"Active Oath references this owner.");const captures = data.inbox?.captures;
 check(captures === undefined || Array.isArray(captures), "Inbox capture evidence unavailable.");
 const taskIdentityReference = v => typeof v === "string" ? identities.includes(v) : Array.isArray(v) ? v.some(taskIdentityReference) : v && typeof v === "object" ? Object.values(v).some(taskIdentityReference) : false;
 // A capture's source dashboard is provenance, not a prepared task publication.
 // Preserve it unchanged; only original target/intent/operation evidence can block.
 check(!(captures ?? []).some(c => references(c.operation) || references(c.intent) || taskIdentityReference(c)), "Inbox task intent or operation references this owner; review required.");
 check(A.digest(JSON.stringify(data.completedTaskHistory??[]))===plan.historyDigest&&A.digest(JSON.stringify(data.taskMetadata??{}))===plan.metadataDigest,"Legacy History/metadata changed.");return ids;
}
async function prepare({archive,owner,deviceId,deviceEvidence,localDataRoot}){
 R.ownerKey(owner);const m=await P.verifyArchive(archive);check(await A.registration(m.vaultRoot)===m.vaultId,"Vault identity changed.");
 const preview=await P.previewRetirement({archive,owner});check(preview.previewSafe,"Ambiguous or changed task sources.");
 const physical=owner.type==="resource"?require("../../.obsidian/plugins/hub-project-menu/lib/config").RESOURCE_TYPES.filter(r=>r.id===owner.id).map(r=>({root:r.root,path:r.hubPath}))[0]:m.candidates.find(p=>p.projectId===owner.id&&p.eligible&&!p.shared);check(physical,"Eligible physical owner required.");
 const binding={version:2,vaultRoot:m.vaultRoot,vaultId:m.vaultId,deviceId,owner,ownerRoot:physical.root,dashboard:physical.path,localDataRoot:await fs.realpath(localDataRoot)},directory=A.repositoryPath(binding);
 await A.validateBinding(binding,directory);await P.validatePrivateLocation(directory,{vaultRoot:m.vaultRoot,localDataRoot,kind:"authority"});
 // Never replace a prior authority/activation, including the original version-1 owner.
 try{const old=await R.readPlan(path.join(R.location(localDataRoot,m.vaultId),"CUTOVER-v1.json"));check(!same(old.owner,owner),"Existing version-1 authority must be preserved.")}catch(e){if(e.code!=="ENOENT")throw e}
 const folder=R.ownerFolder(localDataRoot,m.vaultId,owner);try{await fs.lstat(folder);throw Error("Existing owner cutover requires review.")}catch(e){if(e.code!=="ENOENT")throw e}
 const authorityId=crypto.randomUUID();const plan=R.seal({version:2,kind:"itacan-owner-cutover",vaultId:m.vaultId,deviceId,deviceEvidence,owner,projectRoot:physical.root,dashboard:physical.path,archive,archiveHash:A.digest(await fs.readFile(path.join(archive,"MANIFEST.json"))),sources:preview.files.filter(f=>f.edits.length).map(f=>({path:f.path,stamp:m.sources.find(s=>s.path===f.path).stamp,sourceHash:f.sourceHash,proposedHash:f.proposedHash,proposedBase64:f.proposedBytes.toString("base64")})),historyDigest:m.application.historyDigest,metadataDigest:m.application.metadataDigest,options:{version:1,owner,projectRoot:physical.root,dashboard:physical.path,partitionId:"private",rehearsalId:crypto.randomUUID(),creating:false,config:{version:1,scope:"device-private-project",storageFormat:"private-v4",authorityId,directory,applicationContextId:"owner-"+authorityId,registryId:R.ownerKey(owner),binding}}});
 await C.verifyDevice(plan);await dependencies(plan);return plan;
}
async function verify(plan){const p=R.verify(plan),b=p.options.config.binding;await P.verifyArchive(p.archive);check(A.digest(await fs.readFile(path.join(p.archive,"MANIFEST.json")))===p.archiveHash,"Archive changed.");await A.validateBinding(b,p.options.config.directory);await C.verifyDevice(p);await dependencies(p);const preview=await P.previewRetirement({archive:p.archive,owner:p.owner});check(preview.previewSafe&&same(preview.files.filter(f=>f.edits.length).map(f=>({path:f.path,sourceHash:f.sourceHash,proposedHash:f.proposedHash,proposedBase64:f.proposedBytes.toString("base64")})),p.sources.map(({path,sourceHash,proposedHash,proposedBase64})=>({path,sourceHash,proposedHash,proposedBase64}))),"Retirement inputs changed.");return p;}
async function execute(plan,{quiescenceConfirmed=false,installedMainHash,stage=async()=>{}}={}){
 check(quiescenceConfirmed===true&&/^[a-f0-9]{64}$/.test(installedMainHash),"Explicit quiescence and verified installed build required.");await C.assertObsidianClosed();const p=await verify(plan),b=p.options.config.binding;
 check(A.digest(await fs.readFile(path.join(b.vaultRoot,".obsidian/plugins/hub-project-menu/main.js")))===installedMainHash,"Installed build changed.");
 const locks=[];try{
  for(const source of p.sources)locks.push(await C.sourceLock({...p,sources:[source]}));
  await C.assertObsidianClosed();const folder=R.ownerFolder(b.localDataRoot,p.vaultId,p.owner);await fs.mkdir(path.dirname(folder),{recursive:true});await fs.mkdir(folder);await writeNew(path.join(folder,"CUTOVER-v1.json"),plan);await stage("incomplete",p.owner);
  await C.prepareRepository(p);await stage("prepared",p.owner);await C.assertObsidianClosed();
  for(const lock of locks)await lock.retire();await stage("retired",p.owner);
  await writeNew(path.join(folder,"ACTIVATION-v1.json"),R.seal({version:2,kind:"itacan-owner-activation",state:"active",planDigest:R.checksum(p),authorityId:p.options.config.authorityId}));await stage("active",p.owner);
  return{state:"active",owner:p.owner,authorityId:p.options.config.authorityId,folder};
 }finally{for(const lock of locks.reverse())await lock.close()}
}
module.exports={prepare,verify,execute,dependencies};
