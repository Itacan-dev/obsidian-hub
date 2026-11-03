"use strict";
const {Modal,Notice}=require('obsidian');
function mountTaskSync(plugin,host,service){
 const item=plugin.addStatusBarItem();item.style.cursor='pointer';item.dataset.taskSyncStatus='';let closed=false,loading=false,status={state:'starting'};
 const labels={starting:'starting',syncing:'working',current:'ready',waiting:'waiting for earlier changes',conflict:'review conflicts','enrollment-required':'review enrollment',error:'needs attention',disabled:'off'};
 async function refresh(){if(closed||loading)return;loading=true;try{status=await service.syncStatus();await host.setSyncStatus(status);const gitError=status.gitProjects?.find(p=>p.state==='error');item.setText('Task sync: '+(gitError?'Git needs attention':labels[status.state]??status.state));item.title=gitError?.error??status.error??'OneDrive synchronizes personal devices; explicitly shared Projects exchange tasks through your manual Git workflow. Click for details.';}catch{item.setText('Task sync: reconnecting');}finally{loading=false;}}
 class SyncModal extends Modal{
  async onOpen(){const body=this.contentEl;body.empty();body.createEl('h2',{text:'Task synchronization'});body.createEl('p',{text:'Task databases stay on each computer. OneDrive carries committed task changes through Work/.itacan-task-sync. Shared Project tasks also travel through their .itacan-tasks folders using your manual Git commits and pulls. Ready means this device has reconciled the files currently available here.'});
   body.createEl('p',{text:'Status: '+(labels[status.state]??status.state)});if(status.error)body.createEl('p',{text:status.error});for(const project of status.gitProjects??[]){body.createEl('h3',{text:'Git Project: '+(project.path??project.projectId??'configuration')});body.createEl('p',{text:(labels[project.state]??project.state)+(project.error?' ? '+project.error:'')});}
   if(status.state==='enrollment-required'){
    body.createEl('p',{text:'This computer already has independent tasks. Merge preserves their Task identities and History in this database, adds the shared baseline, and publishes these tasks to your other devices. Task identities overlapping the baseline stop enrollment for manual review. Conflicting later changes are preserved for review.'});
    const button=body.createEl('button',{text:'Merge this computer’s tasks and join'});button.onclick=async()=>{button.disabled=true;try{await service.syncEnroll('merge');await refresh();await this.onOpen();}catch(e){new Notice(e.message);button.disabled=false;}};
   }
   const conflicts=await service.syncConflicts();for(const conflict of conflicts){
    const section=body.createDiv();section.createEl('h3',{text:'Conflicting task changes'});section.createEl('p',{text:'Both versions are preserved. Choose the version to use for the affected task or recurring series. The rejected completion events remain as uncounted audit History. Later unseen offline edits can require another review.'});
    section.createEl('p',{text:'Incoming writer: '+conflict.deviceId});
    for(const[label,values]of [['This computer',conflict.local],['Incoming changes',conflict.incoming]]){section.createEl('h4',{text:label});const version=section.createDiv();version.style.maxHeight='300px';version.style.overflow='auto';for(const task of values){
     version.createEl('strong',{text:task.title});version.createEl('p',{text:[task.deletedAt!==null?'Deleted':task.completed?'Completed':'Open',task.ownerLabel,task.importance==='must'?'Must do':task.importance==='should'?'Should do':null].filter(Boolean).join(' · ')});
     if(task.description)version.createEl('p',{text:task.description});for(const[label,date,time]of [['Start',task.startDate,task.startTime],['Due',task.dueDate,task.dueTime]])if(date)version.createEl('p',{text:label+': '+date+(time?' '+time:'')});
     if(task.context)version.createEl('p',{text:'Saved '+task.context.kind+' context: '+task.context.reference});if(task.phaseId)version.createEl('p',{text:'Project Phase: '+task.phaseId});
     if(task.steps.length){const list=version.createEl('ol');for(const step of task.steps)list.createEl('li',{text:(step.completed?'Completed: ':'')+step.text});}
     if(task.recurrence){const r=task.recurrence;version.createEl('p',{text:(r.active?'Repeats':'Stopped recurrence')+': every '+r.rule.interval+' '+(r.rule.frequency==='daily'?'day(s)':'week(s)')+', occurrence '+r.ordinal+', '+r.rule.zone});if(task.futureTemplate)version.createEl('p',{text:'Future template: '+task.futureTemplate.title+(task.futureTemplate.description?' — '+task.futureTemplate.description:'')+'; Steps: '+task.futureTemplate.steps.map(s=>s.text).join(', ')});}
    }}
    const buttons=[];for(const[choice,label]of [['local','Use this computer’s version'],['incoming','Use incoming version']]){const button=section.createEl('button',{text:label});button.dataset.syncChoice=choice;buttons.push(button);button.onclick=async()=>{buttons.forEach(b=>b.disabled=true);try{await service.syncResolve({operationId:conflict.operationId,choice});await service.syncNow();await refresh();await this.onOpen();}catch(e){new Notice(e.message);buttons.forEach(b=>b.disabled=false);}};}
   }
   const retry=body.createEl('button',{text:'Check available files now'});retry.onclick=async()=>{retry.disabled=true;try{await service.syncNow();await refresh();await this.onOpen();}catch(e){new Notice(e.message);retry.disabled=false;}};
  }
 }
 const show=()=>{plugin.taskSyncModal?.close();plugin.taskSyncModal=new SyncModal(plugin.app);plugin.taskSyncModal.open();};
 item.onclick=()=>{void refresh().then(show);};
 plugin.addCommand({id:'git-task-sync',name:'Review shared Project task synchronization',callback:show});
 plugin.addCommand({id:'personal-task-sync',name:'Review personal task synchronization',callback:show});
 const timer=setInterval(()=>void refresh(),5000);void host.ready.then(refresh,()=>{});
 plugin.register(()=>{closed=true;clearInterval(timer);plugin.taskSyncModal?.close();item.remove();});
}
module.exports={mountTaskSync};
