"use strict";
const {fixture:base,create,mutate,randomUUID,owners}=require("./support.cjs"),fs=require("node:fs/promises"),path=require("node:path");
const inventory=()=>({version:1,revision:"synthetic-exclusive-inventory-1",ids:[]});
const rule=(patch={})=>({version:1,frequency:"DAILY",interval:1,referencePolicy:"fixed-origin",calendar:{calendar:"gregory",zone:"Europe/Stockholm"},...patch});
const fixture=(kind,t,extra={})=>base(kind,t,{externalReservations:inventory(),...extra});
function command(repo,task,type,payload,operationId=randomUUID()){
 return{operationId,type,taskId:task.id,expectedRevision:task.revision,expectedRepositoryRevision:repo.info().revision,payload:{version:1,expectedInventoryRevision:inventory().revision,owner:task.owner,partitionId:task.partitionId,reason:"Explicit synthetic definition",...payload}};
}
const define=(repo,task,patch={})=>command(repo,task,"recurrence.defineSeries",{rule:rule(),...patch});
const template=(repo,task,snapshot,nodes=[],patch={})=>command(repo,task,"recurrence.defineTemplate",{seriesId:snapshot.series.id,expectedSeriesRevision:snapshot.series.revision,description:"Synthetic template",nodes,...patch});
const revise=(repo,task,snapshot,nodes,patch={})=>command(repo,task,"recurrence.reviseTemplate",{seriesId:snapshot.series.id,expectedSeriesRevision:snapshot.series.revision,expectedTemplateRevision:snapshot.series.templateRevision,description:"Explicit future template",nodes,deletions:[],effectiveAfterOccurrenceId:task.id,...patch});
const reviseRule=(repo,task,snapshot,patch={})=>command(repo,task,"recurrence.reviseRule",{seriesId:snapshot.series.id,expectedSeriesRevision:snapshot.series.revision,expectedRuleRevision:snapshot.series.ruleRevision,rule:rule({frequency:"WEEKLY",interval:2}),origin:snapshot.rule.origin,effectiveAfterOccurrenceId:task.id,...patch});
const node=(patch={})=>({state:"new",id:randomUUID(),parentNodeId:null,order:0,title:"Same title",body:"**Lossless**\r\n\r\n日本語 [[link]]",...patch});
async function setup(kind,t,extra={}){const f=await fixture(kind,t,extra);const task=(await f.repo.execute(create({start:{date:"2026-10-16",time:null},due:{date:"2026-10-17",time:null}}))).task;return{f,task};}
async function defined(kind,t,extra={}){const{f,task}=await setup(kind,t,extra);const request=define(f.repo,task),result=await f.repo.execute(request);return{f,task,request,result,snapshot:result.recurrence};}
async function stateOf(f){if(!f.directory)return structuredClone(f.storage.state);const manifest=JSON.parse(await fs.readFile(path.join(f.directory,"CURRENT.json"),"utf8")).payload,ref=[manifest.current,...manifest.ancestry].find(r=>r.revisionId===f.repo.info().revisionId);assertReference(ref);return JSON.parse(await fs.readFile(path.join(f.directory,ref.file),"utf8"));}
function assertReference(ref){if(!ref)throw Error("Actual repository selection is not in this test manifest.");}
async function atomicReject(assert,f,request,code){const before=await stateOf(f);await assert.rejects(async()=>f.repo.execute(request),code?e=>e.code===code:undefined);assert.deepEqual(await stateOf(f),before);assert.equal(f.repo.getReceipt(request.operationId),null);}
module.exports={fixture,create,mutate,randomUUID,owners,inventory,rule,command,define,template,revise,reviseRule,node,setup,defined,stateOf,atomicReject};
