"use strict";
const base=require("./recurrence-support.cjs");
const taskContent=(patch={})=>({title:"Future task",description:"Explicit description",continuation:"**Continuation**\r\n\r\n[[link]] 日本語",importance:"must",location:null,phase:null,...patch});
function request(repo,task,sid,type,patch={},operationId=base.randomUUID()){
 const view=repo.getRecurrenceSeries(sid,{version:2});
 return{operationId,type,taskId:task.id,expectedRevision:task.revision,expectedRepositoryRevision:repo.info().revision,payload:{version:2,seriesId:sid,owner:task.owner,partitionId:task.partitionId,expectedPartitionRevision:repo.info().partitions.find(p=>p.id===task.partitionId).revision,expectedSeriesRevision:view.series.revision,expectedRuleRevision:view.series.ruleRevision,expectedTemplateRevision:view.series.templateRevision,expectedInventoryRevision:base.inventory().revision,reason:"Explicit synthetic B2 review",...patch}};
}
async function templated(kind,t,extra={},nodes=[]){const v=await base.defined(kind,t,extra);const r=await v.f.repo.execute(base.template(v.f.repo,v.task,v.snapshot,nodes));return{...v,sid:r.recurrence.series.id,nodes};}
function prepare(v,patch={}){const repo=v.f.repo,task=repo.getTask(v.task.id),view=repo.getRecurrenceSeries(v.sid,{version:2});return request(repo,task,v.sid,"recurrence.prepareGeneration",{description:"Administrative text",taskContent:taskContent(),nodes:view.template.revision.nodes.map(n=>({state:"existing",...n})),deletions:[],effectiveAfterOccurrenceId:task.id,...patch});}
async function prepared(kind,t,extra={},nodes=[]){const v=await templated(kind,t,extra,nodes);v.preparation=prepare(v);await v.f.repo.execute(v.preparation);return v;}
const complete=(v,id=v.task.id,patch={},op)=>request(v.f.repo,v.f.repo.getTask(id),v.sid,"recurrence.complete",patch,op);
const editTemplate=(v,patch={})=>{const r=v.f.repo.getRecurrenceSeries(v.sid,{version:2}),task=v.f.repo.getTask(r.series.frontierOccurrenceId);return request(v.f.repo,task,v.sid,"recurrence.reviseTemplate",{description:"Future update",taskContent:taskContent(),nodes:r.template.revision.nodes.map(n=>({state:"existing",...n})),deletions:[],effectiveAfterOccurrenceId:task.id,...patch});};
async function atomicReject(assert,f,command,code){const before=await base.stateOf(f),receipt=f.repo.getReceipt(command.operationId);await assert.rejects(async()=>f.repo.execute(command),code?e=>e.code===code:undefined);assert.deepEqual(await base.stateOf(f),before);assert.deepEqual(f.repo.getReceipt(command.operationId),receipt);}
module.exports={...base,atomicReject,taskContent,request,templated,prepare,prepared,complete,editTemplate};
