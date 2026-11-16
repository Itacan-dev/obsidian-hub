"use strict";
const {createHash,randomUUID}=require('node:crypto');
const {clone,normalize:normalizeLegacy,identity}=require('./global-plan');
const {localISODate}=require('./dates');
const iso=value=>new Date(value).toISOString();
function boundary(now=new Date()) {
 const date=new Date(now);if(!Number.isFinite(date.getTime()))throw Error('Invalid Plan clock.');
 const end=new Date(date);end.setHours(24,0,0,0);
 return {createdAt:date.toISOString(),calendarDate:localISODate(date),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,endsAt:end.toISOString()};
}
function empty(){return {version:2,revision:0,activePlanId:null,plansById:{},legacyReview:'pending',fileOperationCursor:null};}
function newRecord({now=new Date(),id=randomUUID(),content={note:'',entries:[]},provenance='created'}={}) {
 return {id,...boundary(now),creationProvenance:provenance,status:'active',touched:false,content:clone(content),navigation:clone(content.entries)};
}
function normalize(value) {
 if(!value)return empty();
 if(value.version!==2)throw Error('Unsupported Plan lifecycle version. Data has been preserved.');
 const result=clone(value);
 if(!Number.isInteger(result.revision)||result.revision<0||!result.plansById||Array.isArray(result.plansById)||typeof result.plansById!=='object')throw Error('Invalid Plan lifecycle data.');
 let active=0;
 for(const [id,p]of Object.entries(result.plansById)){
  if(p.id!==id||!['active','finished','day-ended'].includes(p.status)||!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.endsAt))||Date.parse(p.endsAt)<=Date.parse(p.createdAt)||!/^\d{4}-\d{2}-\d{2}$/.test(p.calendarDate)||typeof p.timeZone!=='string'||typeof p.touched!=='boolean')throw Error('Invalid Plan record.');
  new Intl.DateTimeFormat('en',{timeZone:p.timeZone});
  const c=p.status==='active'?p.content:p.snapshot;
  if(!c||typeof c.note!=='string'||!Array.isArray(c.entries)||!Array.isArray(p.navigation))throw Error('Invalid Plan content.');
  const ids=new Set(),keys=new Set();
  for(const e of c.entries){const key=identity(e);if(!e.id||ids.has(e.id)||keys.has(key))throw Error('Duplicate Plan entry.');ids.add(e.id);keys.add(key);}
  if(p.navigation.length!==c.entries.length||p.navigation.some(e=>!ids.has(e.id)))throw Error('Invalid Plan navigation bindings.');
  const navIds=new Set();for(const e of p.navigation){identity(e);if(navIds.has(e.id))throw Error('Duplicate Plan navigation binding.');navIds.add(e.id);}
  if(p.status==='active'){active++;if(result.activePlanId!==id)throw Error('Conflicting active Plans require review.');}
  else if(!Number.isFinite(Date.parse(p.endedAt))||!Number.isFinite(Date.parse(p.recordedAt))||!p.transitionId)throw Error('Invalid ended Plan.');
 }
 if(active>1||Boolean(result.activePlanId)!==Boolean(active))throw Error('Conflicting active Plans require review.');
 return result;
}
function migrate(value,{now=new Date()}={}) {
 if(value?.version===2)return normalize(value);
 const old=normalizeLegacy(value),result=empty();result.revision=old.revision;result.legacyReview=old.legacyReview;result.fileOperationCursor=clone(old.fileOperationCursor);
 if(old.note.trim()||old.entries.length){const id='legacy-'+createHash('sha256').update(JSON.stringify(old)).digest('hex');const p=newRecord({now,id,content:{note:old.note,entries:old.entries},provenance:'migration-original-start-unknown'});p.touched=true;result.activePlanId=id;result.plansById[id]=p;}
 return normalize(result);
}
function migrateRecovery(record,{now=new Date()}={}) {
 if(!record)return null;
 if(record.version===2){normalize(record.desired);return clone(record);}
 if(record.version!==1)throw Error('Unsupported Plan recovery version.');
 const base=migrate(record.base,{now}),desired=migrate(record.desired,{now});
 // The baseline and its edited draft represent one Plan, even though hashing
 // their different legacy contents independently produces different IDs.
 const id=base.activePlanId||desired.activePlanId;
 if(id){
  const current=desired.activePlanId?desired.plansById[desired.activePlanId]:newRecord({now,id});
  current.id=id;current.touched=true;desired.plansById={[id]:current};desired.activePlanId=id;
 }
 return {version:2,base:clone(record.base??null),desired:normalize(desired),pending:null,deferredInput:null,sequence:record.sequence??0,pendingFile:clone(record.pendingFile??null),legacyInflight:record.inflight??null};
}
function create(state,{now=new Date(),id=randomUUID(),entries=[]}={}) {
 const next=normalize(state);if(next.activePlanId)throw Error('Finish the active Plan before starting another.');
 const p=newRecord({now,id,content:{note:'',entries}});p.touched=entries.length>0;next.activePlanId=id;next.plansById[id]=p;return normalize(next);
}
function end(state,{planId,status='finished',now=new Date(),snapshot,transitionId}={}) {
 const next=normalize(state),p=next.plansById[planId];
 if(p&&p.status!=='active'){if(p.transitionId===transitionId)return next;throw Error('This Plan already ended.');}
 if(!p||next.activePlanId!==planId)throw Error('The active Plan changed.');
 if(!['finished','day-ended'].includes(status))throw Error('Invalid Plan transition.');
 if(status==='day-ended'&&Date.parse(iso(now))<Date.parse(p.endsAt))throw Error('The Plan day has not ended.');
 if(status==='finished'&&Date.parse(iso(now))>=Date.parse(p.endsAt))throw Error('The Plan day ended. Apply rollover first.');
 next.activePlanId=null;
 if(status==='day-ended'&&!p.touched&&!p.content.note.trim()&&!p.content.entries.length){delete next.plansById[planId];return normalize(next);}
 if(!snapshot||snapshot.note!==p.content.note||snapshot.entries.length!==p.content.entries.length||snapshot.entries.some((e,i)=>e.id!==p.content.entries[i].id||identity(e)!==identity(p.content.entries[i])))throw Error('Snapshot does not match the protected Plan draft.');
 p.status=status;p.endedAt=status==='day-ended'?p.endsAt:iso(now);p.recordedAt=iso(now);p.transitionId=transitionId||planId+':'+status;p.snapshot=clone(snapshot);p.navigation=clone(p.content.entries);delete p.content;
 return normalize(next);
}
function abandon(state,planId){
 const next=normalize(state),p=next.plansById[planId];
 if(!p)return next;
 if(p.status!=='active'||next.activePlanId!==planId)throw Error('The active Plan changed.');
 if(p.content.entries.length)throw Error('This Plan still contains planned items.');
 delete next.plansById[planId];next.activePlanId=null;return normalize(next);
}
function history(state){return Object.values(state.plansById).filter(p=>p.status!=='active').sort((a,b)=>b.endedAt.localeCompare(a.endedAt)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));}
module.exports={boundary,empty,newRecord,normalize,migrate,migrateRecovery,create,end,abandon,history};
