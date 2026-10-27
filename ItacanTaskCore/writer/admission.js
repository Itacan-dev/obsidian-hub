"use strict";
const V=require("../src/value"),P=require("./policy"),{fail,check}=require("../src/errors");
function compile(request) {
 const command=V.clone(request.command);command.coordination={service:"itacan-native-writer-v1",id:command.operationId,evidence:{version:1,requestDigest:P.hash(request),...V.clone(request.scope)}};return command;
}
function partitions(request,state,policy,grant) {
 const c=request.command, tasks=c.type.startsWith("personal.")?state.partitions:c.type==="git.receive"?[state.partitions.find(p=>p.id===c.payload.partitionId)].filter(Boolean):c.type==="task.createRich"?[c.payload.scope]:c.type==="task.create"?[c.payload.task]:c.type==="task.createMany"?c.payload.tasks:[state.tasks.find(t=>t.id===c.taskId)].filter(Boolean);
 if(!tasks.length)fail("NOT_FOUND","Native target is missing.");
 const expected=new Map();for(const t of tasks){const p=state.partitions.find(p=>P.same(p.owner,t.owner));check(p,"Owner partition is missing.");expected.set(p.id,p);if(c.type==="task.relocate")check(P.same(c.payload.owner,t.owner),"Owner transfer is deferred.");}
 check(expected.size===request.scope.partitions.length,"Partition guard set differs.");
 for(const g of request.scope.partitions){const p=expected.get(g.id);check(p&&P.same(p.owner,g.owner),"Owner/partition mismatch.");check(policy.owners.some(x=>x.partitionId===g.id&&P.same(x.owner,g.owner))&&grant.owners.some(x=>x.partitionId===g.id&&P.same(x.owner,g.owner)),"Owner is outside writer capability.");if(p.revision!==g.expectedRevision)fail("PARTITION_CONFLICT","Partition revision changed.");expected.delete(g.id);}
}
module.exports=Object.freeze({compile,partitions});
