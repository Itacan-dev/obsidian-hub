"use strict";
// Test fixture uses the actual command interpreter and publication-result path.
// Fixture assembly is not timed as a storage write. Cold acceptance runs in a
// fresh process, including all structural and native command proof validation.
const crypto=require('node:crypto'),R=require('../../src/repository'),G=require('../../src/git-shared'),V=require('../../src/value'),S=require('../../atomic-task/tests/runtime-support.cjs');
async function append(state,command){
 const prior={...state,tasks:state.tasks.map(t=>t.id===command.taskId?V.clone(t):t),history:state.history.map(e=>e.taskId===command.taskId?V.clone(e):e),bindings:state.bindings.slice(),retiredStepIds:state.retiredStepIds.slice(),receipts:state.receipts.slice(),gitShared:{...state.gitShared}},allocations=[],now=1792661000000+state.revision;
 const nextId=()=>{const id=crypto.randomUUID();allocations.push(id);return id};
 const changes=await require('../../src/commands').applyCommand(state,command,{now,nextId,externalReservations:S.inventory,recoveryReservedIds:[],resolvers:{}});
 state.revision++;state.parentRevisionId=state.revisionId;state.revisionId=nextId();const p=state.partitions[0];p.revision++;p.parentHead=p.head;p.head=nextId();
 const result=R.publicationResult(state,command,changes),receipt={operationId:command.operationId,payload:V.canonical(command),result,partitionIds:changes.partitionIds,coordination:null};state.receipts.push(receipt);G.record(state,prior,receipt,{allocations,now,replicaId:state.storeId,inventory:S.inventory});return result;
}
async function population(n,mixed=false){const owner={type:'project',id:crypto.randomUUID()},state=R.initialState([{id:'shared',kind:'git-project',owner}],crypto.randomUUID(),crypto.randomUUID,2),ctx={repo:{info:()=>state,queryHistory:({taskId,counted}={})=>state.history.filter(e=>(taskId===undefined||e.taskId===taskId)&&(counted===undefined||e.counted===counted))},options:{externalReservations:S.inventory},storage:{state}};
 for(let i=0;i<n;i++){const command=S.rich(ctx,{id:crypto.randomUUID(),metadata:S.metadata({title:'Representative task '+i,description:'Description retained by the native task interface with ordinary project context.'}),steps:[0,1].map(order=>({id:crypto.randomUUID(),parentStepId:null,order,title:order?'Second step':'First step',body:'',initial:{completed:false,completedAt:null}}))},owner,crypto.randomUUID());await append(state,command);}
 if(mixed)for(const task of state.tasks.slice(0,Math.min(n,12))){await append(state,S.save(ctx,task,{metadata:S.metadata({title:task.title+' edited',description:'Edited native body'})},crypto.randomUUID()));for(const completed of [true,false,true])await append(state,{type:'step.complete',operationId:crypto.randomUUID(),expectedRepositoryRevision:state.revision,taskId:task.id,expectedRevision:task.revision,payload:{stepId:task.steps[0].id,completed,completedAt:completed?1792661005000:null}});}
 if(mixed)for(const task of state.tasks.slice(-3))await append(state,{type:'task.delete',operationId:crypto.randomUUID(),expectedRepositoryRevision:state.revision,taskId:task.id,expectedRevision:task.revision,payload:{}});
 return state;
}
module.exports={population,append};
