"use strict";
// Capture the actual legacy/application reservation corpus; never synthesize an
// empty witness for a shared Project. Original data stays unchanged and local.
const fs=require('node:fs/promises'),path=require('node:path'),V=require('../../../../../ItacanTaskCore/src/value'),P=require('../../../../../ItacanTaskCore/writer/policy'),{check}=require('../../../../../ItacanTaskCore/src/errors');
const keys=['taskMetadata','completedTaskHistory','completedTaskChecks','projectPlanning','inbox','oathsByDevice'];
function selected(data){const value={};for(const k of keys)value[k]=Object.hasOwn(data,k)?{present:true,value:data[k]}:{present:false};check(value.taskMetadata.present&&value.completedTaskHistory.present&&value.projectPlanning.present,'Required application inventory observation is missing.');check(data.taskMetadata&&typeof data.taskMetadata==='object'&&!Array.isArray(data.taskMetadata)&&Array.isArray(data.completedTaskHistory)&&data.projectPlanning&&typeof data.projectPlanning==='object'&&!Array.isArray(data.projectPlanning),'Invalid authoritative application inventory.');// ProjectWizard.migrateStoredResourceReferences applies the same path observer
 // to both completion collections, attaching absent oldPath properties. Match
 // that complete load/save contract; defined values and all other fields remain
 // validated unchanged. Never mutate either original completion collection.
 for(const key of ['completedTaskHistory','completedTaskChecks'])if(Array.isArray(value[key].value))value[key].value=value[key].value.map(row=>{
  if(row&&typeof row==='object'&&!Array.isArray(row)&&Object.hasOwn(row,'oldPath')&&row.oldPath===undefined){const copy={...row};delete copy.oldPath;return copy;}return row;
 });
 V.jsonValue(value);return value;}
function capture(data,owner,authorityId){const observation=selected(data),ids=new Set(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 function walk(value){if(typeof value==='string'){if(uuid.test(value))ids.add(value);return;}if(Array.isArray(value)){value.forEach(walk);return;}if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){walk(key);walk(v);}}
 walk(observation);const plans=observation.projectPlanning.value;check(plans&&typeof plans==='object'&&!Array.isArray(plans),'Invalid Project inventory.');const present=Object.hasOwn(plans,owner.id),plan=present?plans[owner.id]:null;
 if(present)check(plan&&Number.isSafeInteger(plan.revision)&&plan.revision>=0&&Array.isArray(plan.phases)&&Array.isArray(plan.milestones),'Incomplete Phase inventory.');
 const phases={version:1,revision:P.hash({present,plan}),values:(plan?.phases??[]).map(p=>{check(p&&typeof p.id==='string'&&p.id.length>0,'Invalid Phase identity.');require('../domain/project-planning').phaseValues(p);return{projectId:owner.id,phaseId:p.id}})};
 check(new Set(phases.values.map(p=>p.phaseId)).size===phases.values.length,'Duplicate Phase identity.');
 return{version:1,authorityId,owner:V.clone(owner),inventory:{version:1,revision:P.hash(observation),ids:[...ids].sort()},phases};
}
async function readAuthoritative(vaultRoot,file,owner,authorityId){
 const A=require('../../../../../ItacanTaskCore/host/private-authority');
 async function source(name,optional=false){let stat;try{stat=await fs.lstat(name,{bigint:true})}catch(e){if(optional&&e.code==='ENOENT')return{raw:null,pin:null};throw e}check(stat.isFile()&&!stat.isSymbolicLink()&&await A.ordinaryPath(name)===await fs.realpath(name),'Ordinary authoritative inventory source required.');return{raw:await fs.readFile(name,'utf8'),pin:['dev','ino','size','mtimeNs','ctimeNs'].map(k=>String(stat[k]))};}
 const local=await source(file),disk=JSON.parse(local.raw);selected(disk);
 // SharedProjectStore.load only reads/parses its file and physical ownership,
 // and overlays a detached input. Do not invoke prepare/save or rewrite data.
 const Shared=require('./shared-projects'),sharedFile=path.join(vaultRoot,Shared.SHARED_STATE_PATH),shared=await source(sharedFile,true),store=new Shared.SharedProjectStore(vaultRoot),resolved=await store.load(JSON.parse(local.raw));check(store.lastText===shared.raw,'Shared inventory changed during capture.');
 const original=capture(disk,owner,authorityId),effective=capture(resolved,owner,authorityId);
 if(shared.raw!==null){const originalShared=JSON.parse(shared.raw);effective.inventory={version:1,revision:P.hash({local:original.inventory.revision,effective:effective.inventory.revision,shared:{taskMetadata:originalShared.taskMetadata,projectPlanning:originalShared.projectPlanning}}),ids:[...new Set([...original.inventory.ids,...effective.inventory.ids])].sort()};}
 const observation=selected(resolved);async function assertCurrent(){check(P.same(await source(file),local)&&P.same(await source(sharedFile,true),shared),'Authoritative application inventory changed during capture.');}
 await assertCurrent();return{evidence:effective,observation,assertCurrent};
}
function createInventoryEvidence(plugin,owner,authorityId){return Object.freeze({async read(){const vault=plugin.app.vault.adapter.getBasePath(),file=path.join(vault,plugin.manifest.dir,'data.json'),observed=await readAuthoritative(vault,file,owner,authorityId),memory=selected(plugin.projectWizard.data);check(P.same(observed.observation,memory),'Application inventory is not coherently persisted.');await observed.assertCurrent();check(P.same(selected(plugin.projectWizard.data),memory),'Application inventory changed during capture.');return observed.evidence;}});}
module.exports={capture,createInventoryEvidence,readAuthoritative};
