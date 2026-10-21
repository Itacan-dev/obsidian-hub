"use strict";
// One completion implementation for ordinary commands and inactive recurrence.
const {check}=require("./errors");
const {clone,timestamp}=require("./value");
function completionTransition(state,command,{now,nextId,reserve,eventIds}){
 const addEvent=(task,step=null)=>{
  const target=step??task;
  const event={id:nextId(),operationId:command.operationId,partitionId:task.partitionId,kind:step?"step":"task",taskId:task.id,stepId:step?.id??null,timestamp:target.completedAt,recordedAt:now,ownerAtEvent:clone(task.owner),workingContext:command.context?.workingContext??null,oathId:command.context?.oathId??null,sessionId:command.context?.sessionId??null,snapshot:{title:target.title,parentTitle:step?task.title:null},counted:true,reopenedAt:null,legacy:null};
  if(state.schemaVersion>=2)reserve(event.id);
  state.history.push(event);state.bindings.push({taskId:task.id,stepId:step?.id??null,eventId:event.id});eventIds.push(event.id);
 };
 const transition=(task,step,completed,completedAt)=>{
  const target=step??task;check(typeof completed==="boolean","Completion must be boolean.");
  if(completedAt!==undefined){timestamp(completedAt);check(completed||completedAt===null,"An open target cannot have a completion time.");}
  if(target.completed===completed)return;
  if(completed){target.completed=true;target.completedAt=completedAt===undefined?now:completedAt;addEvent(task,step);}
  else{const binding=state.bindings.find(b=>b.taskId===task.id&&b.stepId===(step?.id??null));check(!!binding,"Completed target is missing its completion binding.");const event=state.history.find(h=>h.id===binding.eventId);event.counted=false;event.reopenedAt=now;eventIds.push(event.id);state.bindings=state.bindings.filter(b=>b!==binding);target.completed=false;target.completedAt=null;}
  if(step)step.modifiedAt=now;
 };
 return{addEvent,transition};
}
module.exports={completionTransition};
