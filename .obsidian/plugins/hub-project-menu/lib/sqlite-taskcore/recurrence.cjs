"use strict";
// Itacan's daily/weekly fixed-origin civil dates. No elapsed-time/DST arithmetic.
const V=require('./validation.cjs'),{randomUUID}=require('node:crypto');
function rule(value){
 V.fields(value,['frequency','interval','zone','startDate','dueDate'],['frequency','interval','zone','startDate','dueDate']);
 V.check(['daily','weekly'].includes(value.frequency),'Daily or weekly recurrence required');
 V.check(Number.isSafeInteger(value.interval)&&value.interval>=1&&value.interval<=366,'Invalid recurrence interval');
 V.text(value.zone,100);V.check(!/^[+-]/.test(value.zone),'IANA time zone required');try{new Intl.DateTimeFormat('en',{timeZone:value.zone}).format(0)}catch{throw new V.TaskError('INVALID_COMMAND','IANA time zone required')}
 V.date(value.startDate);V.date(value.dueDate);V.check(value.startDate||value.dueDate,'Recurrence requires a Start or Due origin');
 V.check(!value.startDate||!value.dueDate||value.startDate<=value.dueDate,'Start must not follow Due');
}
function command(c){
 const target=['type','operationId','taskId','expectedRevision'];
 V.id(c.operationId);V.id(c.taskId);V.check(Number.isSafeInteger(c.expectedRevision)&&c.expectedRevision>0,'Positive Task revision required');
 if(c.type==='recurrence.define'){V.fields(c,[...target,'rule','seriesId'],[...target,'rule']);rule(c.rule);if(c.seriesId!==undefined)V.id(c.seriesId);}
 else if(c.type==='recurrence.edit'){V.fields(c,[...target,'expectedSeriesRevision','rule','updateTemplate'],[...target,'expectedSeriesRevision']);V.check(Number.isSafeInteger(c.expectedSeriesRevision)&&c.expectedSeriesRevision>0,'Positive series revision required');if(c.rule!==undefined)rule(c.rule);if(c.updateTemplate!==undefined)V.check(typeof c.updateTemplate==='boolean','Boolean template update required');V.check(c.rule!==undefined||c.updateTemplate===true,'Rule or template update required');}
 else if(c.type==='recurrence.stop'){V.fields(c,[...target,'expectedSeriesRevision'],[...target,'expectedSeriesRevision']);V.check(Number.isSafeInteger(c.expectedSeriesRevision)&&c.expectedSeriesRevision>0,'Positive series revision required');}
 else throw new V.TaskError('UNSUPPORTED_COMMAND','Unsupported recurrence command');
}
function template(task){return{title:task.title,description:task.description,importance:task.importance,context:task.context,phaseId:task.phaseId,steps:task.steps.map(s=>({templateId:randomUUID(),text:s.text}))};}
function dates(r,ordinal){
 const offset=(ordinal-1)*r.interval*(r.frequency==='weekly'?7:1),out={};
 for(const k of ['startDate','dueDate']){if(r[k]===null){out[k]=null;continue;}const d=new Date(r[k]+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+offset);V.check(Number.isFinite(d.getTime())&&d.getUTCFullYear()<=9999,'Recurrence exceeds supported civil calendar','RECURRENCE_EXHAUSTED');out[k]=d.toISOString().slice(0,10);V.date(out[k]);}
 return out;
}
function observation(e,taskId){const o=e.one('SELECT o.*,s.revision,s.active,s.rule_json FROM occurrences o JOIN recurrence_series s ON s.id=o.series_id WHERE o.task_id=?',taskId);return o?{seriesId:o.series_id,ordinal:o.ordinal,seriesRevision:o.revision,occurrenceRevision:o.series_revision,active:!!o.active,rule:JSON.parse(o.rule_json),successorId:o.successor_id}:null;}
function apply(e,c,task,now){
 V.check(!task.startTime&&!task.dueTime,'Recurring Tasks use civil dates without times');
 if(c.type==='recurrence.define'){
  V.check(!task.completed,'Reopen before defining recurrence');V.check(!observation(e,task.id),'Task already belongs to a series');
  V.check(c.rule.startDate===task.startDate&&c.rule.dueDate===task.dueDate,'Origin must match the initial Task dates');
  const sid=c.seriesId??randomUUID();e.run('INSERT INTO recurrence_series VALUES(?,?,1,1,?,?,?,?)',sid,task.ownerId,JSON.stringify(c.rule),JSON.stringify(template(task)),now,now);
  e.run('INSERT INTO occurrences(task_id,series_id,ordinal,series_revision) VALUES(?,?,1,1)',task.id,sid);return;
 }
 const o=observation(e,task.id);V.check(o,'Task has no recurrence','NOT_FOUND');V.check(o.seriesRevision===c.expectedSeriesRevision,'Series changed; reload','STALE_REVISION');
 const frontier=e.one('SELECT task_id FROM occurrences WHERE series_id=? ORDER BY ordinal DESC LIMIT 1',o.seriesId);
 V.check(frontier.task_id===task.id&&!task.completed,'Edit recurrence on the current incomplete occurrence');
 if(c.type==='recurrence.stop')e.run('UPDATE recurrence_series SET active=0,revision=revision+1,modified_at=? WHERE id=?',now,o.seriesId);
 else{
  // A fixed origin remains immutable after the first successor has been generated.
  if(c.rule){V.check(c.rule.startDate===o.rule.startDate&&c.rule.dueDate===o.rule.dueDate,'Fixed origin cannot be changed');const next=dates(c.rule,o.ordinal+1);V.check((next.dueDate??next.startDate)>(task.dueDate??task.startDate),'The next recurrence must follow the current occurrence');}
  const s=e.one('SELECT * FROM recurrence_series WHERE id=?',o.seriesId);
  e.run('UPDATE recurrence_series SET rule_json=?,template_json=?,revision=revision+1,modified_at=? WHERE id=?',c.rule?JSON.stringify(c.rule):s.rule_json,c.updateTemplate?JSON.stringify(template(task)):s.template_json,now,o.seriesId);
 }
}
function successor(e,task,now,operationId){
 const o=e.one('SELECT * FROM occurrences WHERE task_id=?',task.id);if(!o||o.generated)return null;
 const s=e.one('SELECT * FROM recurrence_series WHERE id=?',o.series_id);if(!s.active)return null;
 const r=JSON.parse(s.rule_json),t=JSON.parse(s.template_json),ordinal=o.ordinal+1;
 let d;try{d=dates(r,ordinal)}catch(error){if(error.code!=='RECURRENCE_EXHAUSTED')throw error;e.run('UPDATE occurrences SET generated=1 WHERE task_id=?',task.id);return null;}
 const id=randomUUID();e.run('INSERT INTO tasks(id,owner_id,revision,title,description,completed,completed_at,start_date,start_time,due_date,due_time,importance,context_json,phase_id,created_at,modified_at,deleted_at) VALUES(?,?,1,?,?,0,NULL,?,NULL,?,NULL,?,?,?,?,?,NULL)',id,s.owner_id,t.title,t.description,d.startDate,d.dueDate,t.importance,t.context===null?null:JSON.stringify(t.context),t.phaseId,now,now);
 const next={id,ownerId:s.owner_id,title:t.title};t.steps.forEach((step,i)=>e.insertStep(next,{text:step.text},i,now,operationId,[]));
 e.run('INSERT INTO occurrences(task_id,series_id,ordinal,series_revision) VALUES(?,?,?,?)',id,s.id,ordinal,s.revision);
 e.run('UPDATE occurrences SET successor_id=?,generated=1 WHERE task_id=?',id,task.id);return id;
}
function move(e,task,merged,now){
 const o=observation(e,task.id);if(!o)return;
 const frontier=e.one('SELECT task_id FROM occurrences WHERE series_id=? ORDER BY ordinal DESC LIMIT 1',o.seriesId);
 // Moving a past occurrence changes that Task only. The frontier controls
 // where future occurrences are created, and spent successors stay spent.
 if(frontier.task_id!==task.id)return;
 e.run('UPDATE recurrence_series SET owner_id=?,template_json=?,revision=revision+1,modified_at=? WHERE id=?',merged.ownerId,JSON.stringify(template(merged)),now,o.seriesId);
}
module.exports={rule,command,dates,observation,apply,successor,move};
