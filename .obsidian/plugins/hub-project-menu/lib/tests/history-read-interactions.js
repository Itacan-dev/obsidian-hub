"use strict";
window.runHistoryInteractions=async ctx=>{
    const {plugin,input,mount,currentHome,currentProject,check,settle,files,counts}=ctx;
    const actual=plugin.taskService,gates=[];let delay=false,fail=false;
    plugin.taskService={queryHistory:async query=>{if(fail)throw Error("Deterministic recorded History failure");const result=await actual.queryHistory(query);if(delay)await new Promise((resolve,reject)=>gates.push({resolve,reject}));return result;},close:actual.close.bind(actual)};
    const waitGate=async()=>{for(let i=0;i<200&&!gates.length;i++)await Promise.resolve();assert(gates.length,"Delayed History query started");};
    const notify=async(instance,detail={})=>{instance.root.dispatchEvent(new CustomEvent("hub-completed-tasks-changed",{detail}));await settle();};
    const historyRows=instance=>[...instance.body.querySelectorAll(".home-completed-task-row,.project-completed-task-row")];
    const stored=plugin.projectWizard.completedTaskHistory;plugin.projectWizard.completedTaskHistory=[];
    for(const[kind,owner]of[["home","projects"],["home","resources"],["project",input.owners[0]],["project",input.owners.find(owner=>owner.resourceType==="study")]]){
        const a=await mount(kind,owner,kind==="home"?ctx.originalHome:ctx.originalProject),before=ctx.snapshot(a.root);a.dispose();
        const b=await mount(kind,owner,kind==="home"?currentHome:currentProject);check(JSON.stringify(ctx.snapshot(b.root))===JSON.stringify(before),kind+" legitimate empty History retains original message and geometry");b.dispose();
    }
    plugin.projectWizard.completedTaskHistory=stored;
    for(const[kind,owner,source]of[["home","projects",currentHome],["project",input.owners[0],currentProject]]){
        fail=true;const view=await mount(kind,owner,source);
        check(view.root.querySelector('[data-task-history-status]')&&!view.body.textContent.includes("No task progress"),kind+" initial query failure is not an authoritative empty History");
        fail=false;await notify(view);check(historyRows(view).length>0&&!view.root.querySelector('[data-task-history-status]'),kind+" initial query failure recovers to valid recorded rows");view.dispose();
    }
    for(const[kind,owner,source]of[["home","projects",currentHome],["project",input.owners[0],currentProject]]){
        const view=await mount(kind,owner,source),adjacent=view.root.querySelector(".home-task-row,.project-task-row"),first=historyRows(view)[0];
        await notify(view);check(historyRows(view)[0]===first,kind+" unchanged History event retains DOM/pagination");
        check((view.env.taskRenders??0)===0&&view.root.contains(adjacent),kind+" History-only event leaves simultaneous task card and task render count unchanged");
        view.body.scrollTop=view.body.scrollHeight;view.body.dispatchEvent(new Event("scroll"));await settle();
        const count=historyRows(view).length,focused=historyRows(view).findLast(row=>row.matches('[role="button"]'));assert(focused,"History keyboard row available");focused.focus();const key=focused.historyReadKey,scroll=view.body.scrollTop;
        delay=true;await notify(view);await waitGate();
        // Pagination remains interactive while the recorded snapshot is pending.
        view.body.scrollTop=view.body.scrollHeight;view.body.dispatchEvent(new Event("scroll"));await settle();const paged=historyRows(view).length;
        check(paged>=count&&focused.isConnected,kind+" pagination/focus remain usable during History query");
        const event={...plugin.projectWizard.completedTaskHistory.find(record=>record.projectId==="private"),id:"new-history-"+kind,text:"Fresh recorded "+kind,timestamp:2000000000000};
        plugin.projectWizard.completedTaskHistory.unshift(event);delay=false;await notify(view);
        check(view.body.textContent.includes(event.text),kind+" newer History B publishes before pending A");
        check(historyRows(view).length>=paged&&document.activeElement.historyReadKey===key,kind+" changed History preserves expanded pages and focused event");
        gates.splice(0).forEach(gate=>gate.resolve());await settle();check(view.body.textContent.includes(event.text),kind+" obsolete History A cannot overwrite B");
        check((view.env.taskRenders??0)===0&&view.root.contains(adjacent),kind+" concurrent recorded completion does not rebuild Tasks/Progress");
        fail=true;await notify(view);const retained=historyRows(view)[0];check(retained&&view.root.querySelector('[data-task-history-status]'),kind+" store failure retains valid recorded rows and shows restrained status");
        await notify(view);check(view.root.querySelectorAll('[data-task-history-status]').length===1,kind+" repeated failure creates one status");
        fail=false;await notify(view);check(!view.root.querySelector('[data-task-history-status]')&&historyRows(view)[0]===retained,kind+" recovery removes status without replacing unchanged rows");
        const clickable=historyRows(view).find(row=>row.matches('[role="button"]'));clickable.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));await settle();
        check(typeof view.env.opened==="string",kind+" keyboard reveal opens the exact recorded existing note");
        const opened=view.env.opened,oldFile=files.get(opened);files.delete(opened);view.env.opened=null;clickable.click();await settle();
        check(view.env.opened===null&&clickable.isConnected,kind+" source deletion disables navigation without removing the historical event");files.set(opened,oldFile);
        delay=true;await notify(view);await waitGate();view.controller.setMode("reports");view.body.empty();view.body.createDiv({text:"Independent Reports"});
        gates.splice(0).forEach(gate=>gate.resolve());delay=false;await settle();
        check(view.body.textContent==="Independent Reports",kind+" mode switch during query does not publish obsolete History into Reports");
        view.controller.setMode("tasks");view.controller.render();view.controller.invalidate();await view.controller.refresh();
        await notify(view,{deleted:[{path:"Synthetic/Cleared.md",line:0}]});
        check((view.env.taskRenders??0)===1,kind+" actual clear notification reconciles Tasks exactly once while History remains independent");
        delay=true;view.controller.invalidate();const pending=view.controller.refresh();await waitGate();view.dispose();gates.splice(0).forEach(gate=>gate.resolve());delay=false;await pending;
        check(!view.root.isConnected,kind+" disposed consumer cannot publish a pending History result");
    }
    delay=true;const retired=await mount("project",input.owners[0],currentProject,false);await waitGate();retired.dispose();delay=false;
    const resource=await mount("project",input.owners.find(owner=>owner.resourceType==="literature"),currentProject),before=resource.body.innerHTML;
    gates.splice(0).forEach(gate=>gate.resolve());await settle();check(resource.body.innerHTML===before&&!resource.body.textContent.includes("Fresh recorded"),"Late Project query cannot overwrite a Resource mount");resource.dispose();
    const a=await mount("home","projects",currentHome),b=await mount("home","resources",currentHome);a.dispose();const original=historyRows(b)[0];await notify(b);check(historyRows(b)[0]===original,"Closing one Home consumer leaves another History consumer and facade working");b.dispose();
    for(let i=0;i<12;i++){const view=await mount(i%2?"home":"project",i%2?"projects":input.owners[i%input.owners.length],i%2?currentHome:currentProject);view.dispose();}
    const closing=await mount("home","projects",currentHome);const html=closing.body.innerHTML;ctx.registrations.forEach(fn=>fn());await notify(closing);
    check(closing.body.innerHTML===html,"Plugin cleanup cancels active History sessions without a late publication");closing.dispose();
    check(counts.index===0&&counts.sources===0&&counts.writes===0,"History races, pagination, navigation and mount/unmount never scan tasks or write data");
    plugin.taskService=actual;
};
