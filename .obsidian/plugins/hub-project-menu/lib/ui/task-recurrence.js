"use strict";
function mountTaskRecurrence(control,state,onChange,bind){
 const current=state.recurrence?.active?state.recurrence.rule:null;
 state.recurrenceDraft??={frequency:current?.frequency??'none',interval:current?.interval??1,zone:current?.zone??Intl.DateTimeFormat().resolvedOptions().timeZone,updateTemplate:false};
 const refresh=()=>{const d=state.recurrenceDraft;control.update(d.frequency==='none'?'Repeat task':d.frequency==='daily'?'Repeats daily':'Repeats weekly');control.button.classList.toggle('is-configured',d.frequency!=='none')};
 const picker=bind(control,{title:'Repeat',avoidFooter:true,width:320,render({body,close}){
  const draft={...state.recurrenceDraft};
  const frequency=body.createEl('label',{text:'Repeat'}).createEl('select',{attr:{'aria-label':'Repeat frequency'}});
  for(const [value,text]of [['none','Does not repeat'],['daily','Daily'],['weekly','Weekly']])frequency.createEl('option',{value,text});frequency.value=draft.frequency;
  const interval=body.createEl('label',{text:'Every'}).createEl('input',{attr:{type:'number',min:'1',max:'366','aria-label':'Repeat interval'}});interval.value=String(draft.interval);
  const zone=body.createEl('label',{text:'Time zone'}).createEl('input',{attr:{type:'text','aria-label':'Recurrence time zone'}});zone.value=draft.zone;
  let update;
  if(current){const label=body.createEl('label',{text:'Use this title, description and Steps for future occurrences'});update=label.createEl('input',{attr:{type:'checkbox','aria-label':'Update future task template'}});update.checked=draft.updateTemplate;}
  body.createEl('p',{text:'Daily and weekly tasks follow civil dates in this time zone. Choose a Start or Due date and leave times empty.'});
  const error=body.createDiv({cls:'hub-task-error',attr:{role:'alert'}}),actions=body.createDiv({cls:'hub-task-popover-actions'});
  actions.createEl('button',{text:'Cancel',attr:{type:'button'}}).onclick=()=>close();
  actions.createEl('button',{text:'Apply',cls:'mod-cta',attr:{type:'button'}}).onclick=()=>{
   try{if(!interval.reportValidity())return;if(frequency.value!=='none'){new Intl.DateTimeFormat('en',{timeZone:zone.value}).format(0);if(!state.fromDate&&!state.dueDate)throw Error('Choose a Start or Due date first');if(state.fromTime||state.dueTime)throw Error('Recurring tasks use dates without times');}
    state.recurrenceDraft={frequency:frequency.value,interval:Number(interval.value),zone:zone.value,updateTemplate:!!update?.checked};refresh();onChange({recurrenceDraft:state.recurrenceDraft});close();
   }catch(e){error.textContent=e.message}
  };
 }});refresh();return{...picker,refresh};
}
module.exports={mountTaskRecurrence};
