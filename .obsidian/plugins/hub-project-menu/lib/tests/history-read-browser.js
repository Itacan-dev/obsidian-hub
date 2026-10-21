"use strict";
HTMLElement.prototype.setText=function(text){this.textContent=text;};
HTMLElement.prototype.addClass=function(cls){this.classList.add(cls);};
HTMLElement.prototype.toggleClass=function(cls,value){this.classList.toggle(cls,value);};
window.onload=async()=>{try{
    const input=await(await fetch("history-read-input.json")).json(),sources={},cache={},checks=[],captures=[];
    const resolve=(name,request)=>{const out=[];for(const part of(name.slice(0,name.lastIndexOf("/"))+"/"+request).split("/")){if(part==="..")out.pop();else if(part!==".")out.push(part);}return out.join("/");};
    async function prepare(name){if(name==="obsidian"||sources[name])return;const response=await fetch("../"+name+".js");assert(response.ok,"Existing module "+name);sources[name]=await response.text();for(const match of sources[name].matchAll(/require\(\s*["']([^"']+)["']\s*\)/g))if(match[1].startsWith("."))await prepare(resolve(name,match[1]));}
    const load=name=>{if(name==="obsidian")return obsidian;if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};new Function("module","exports","require",sources[name])(module,module.exports,request=>load(request.startsWith(".")?resolve(name,request):request));return module.exports;};
    for(const name of["domain/history","domain/dates","ui/history-pager","ui/row-activation","ui/task-card","services/task-service","services/task-service-legacy"])await prepare(name);
    const files=new Map(input.files),counts={queries:0,index:0,sources:0,writes:0},registrations=[];
    const vault={getAbstractFileByPath:path=>files.get(path),read:()=>{counts.sources++;throw Error("History display must not read sources");}};
    const plugin={app:{vault},taskEditor:{},taskData:{readPages(){counts.index++;throw Error("History must not enumerate tasks");}},register:fn=>registrations.push(fn),projectWizard:{completedTaskHistory:input.records}};
    const entry=await(await fetch("../../plugin.js")).text(),method=entry.match(/    getCompletedTaskHistory\(projectId = null\) \{[\s\S]*?\n    \}/)[0];
    const getter=new Function("queryHistory","return ({"+method+"}).getCompletedTaskHistory;")(load("domain/history").queryHistory);
    plugin.projectWizard.getCompletedTaskHistory=function(id){counts.queries++;return getter.call(this,id);};
    plugin.taskService=new(load("services/task-service").TaskService)(new(load("services/task-service-legacy").LegacyTaskAdapter)({plugin,dataview:{pages(){throw Error("No task index dependency");}}}));
    const between=(source,a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert(start>=0&&end>start,"Actual History section "+a);return source.slice(start,end);};
    const originalHome=await(await fetch("history-read-home-original.cjs")).text(),originalProject=await(await fetch("history-read-project-original.cjs")).text();
    const currentHome=await(await fetch("../../../../../System/Dashboards/Home/view.js")).text(),currentProject=await(await fetch("../../../../../System/Dashboards/Project/view.js")).text();
    const dates=load("domain/dates"),check=(ok,label)=>{assert(ok,label);checks.push(label);};
    const moment=value=>value===undefined?new Date("2026-10-26T10:00:00+01:00"):value===null?new Date(NaN):typeof value==="string"&&/^\d+$/.test(value)?new Date(NaN):new Date(value);
    const screenshot=name=>new Promise(resolve=>{window.hubTestScreenshotDone=resolve;window.hubTestScreenshotRequest=name;});
    async function mount(kind,owner,source,wait=true){
        const component=new Component(),root=document.getElementById("fixture").createDiv({cls:(kind==="home"?"home-dashboard":"project-dashboard")+" hub-button-scope"});root.style.width="560px";
        const panel=root.createDiv({cls:kind==="home"?"home-panel home-recent":"project-progress-panel"});panel.createDiv({cls:kind==="home"?"home-panel-title":"project-section-title",text:"History"});
        const body=panel.createDiv({cls:kind==="home"?"home-progress-history-body home-progress-activity-body":"project-progress-activity-body"});body.style.height="260px";body.style.overflowY="auto";
        body.hubMarkdown={clear(){},render:async(el,text)=>{el.replaceChildren();el.createEl("p",{text});}};
        const taskHost=root.createDiv({cls:kind==="home"?"home-panel home-upcoming":"project-tasks"});
        load("ui/task-card").createTaskRow(taskHost,{text:"Independent current task",completed:false},false,{variant:kind==="home"?"home":"project"});
        const env={window,app:plugin.app,root,dv:{component},recentBody:body,activityBody:body,moment,historyKind:load("domain/history").historyKind,
            projects:input.owners.filter(owner=>owner.contextKind!=="resource"),resourceTypes:input.owners.filter(owner=>owner.contextKind==="resource"),
            current:owner&&{...owner,file:{path:owner.path,name:owner.name}},projectRoot:owner?.root,isResourceContext:owner?.contextKind==="resource",
            makeActionableRow:load("ui/row-activation").makeActionableRow,el:(parent,tag,cls,text)=>parent.createEl(tag,{cls,text}),
            formatDateTime:dates.formatDateTime,formatTime:dates.formatTime,historyDate:dates.historyDateLabel,
            displayProjectName:name=>String(name??"").replace(/^(Book|MSc Thesis|Novel|Research|Poetry)\s*-\s*/i,""),
            openFileFromHome:async path=>{env.opened=path;},openProjectNote:async file=>{env.opened=file.path;},scheduleRecentActivityHeight(){},scheduleProjectActivityHeight(){},
            removeClearedTasksFromCache(){env.clears=(env.clears??0)+1;},renderTaskContext(){env.taskRenders=(env.taskRenders??0)+1;},renderTaskRows(){env.taskRenders=(env.taskRenders??0)+1;}};
        const home=kind==="home",renderName=home?"renderCompletedTaskHistory":"renderProjectTaskHistory",refreshName=home?"refreshCompletedTaskHistory":"refreshProjectTaskHistory";
        const renderer=between(source,"function "+renderName+"()",home?"function renderActiveProgressView()":"function renderProjectProgressView()");
        const modern=source.includes("async function "+refreshName),setup=modern?between(source,"let historyReadDisposed", "// ---------- ACTIVITY SCROLL HEIGHT ----------"):"";
        const refresh=modern?between(source,"async function "+refreshName,"function "+renderName+"()"):"";
        const normalized=source.replace(/\r\n/g,"\n"),eventIndex=normalized.indexOf('"hub-completed-tasks-changed"');
        const eventCode=modern?normalized.slice(normalized.lastIndexOf("root.addEventListener(",eventIndex),normalized.indexOf("\n);",eventIndex)+4):"";
        const code=`let completedTaskHistory=${modern?"[]":"window.hubGetCompletedTaskHistory()"},projectTaskHistory=[],currentProjectTasks=[],progressView="tasks",progressScope=${JSON.stringify(home?owner:"projects")};
            const historyPager=createHistoryPager(${home?"recentBody":"activityBody"},dv.component);${setup}\n${refresh}\n${renderer}
            ${eventCode}
            return {render:${renderName},refresh:${modern?refreshName:"async()=>{completedTaskHistory=window.hubGetCompletedTaskHistory();return "+renderName+"();}"},
                invalidate:()=>{${modern?"completedHistoryRead.invalidate();":""}},setMode:value=>{progressView=value;},setScope:value=>{progressScope=value;},get records(){return ${home?"completedTaskHistory":"projectTaskHistory"}}};`;
        const controller=new Function("env","createHistoryPager","with(env){"+code+"}")(env,load("ui/history-pager").createHistoryPager);
        const ready=controller.refresh();if(wait){await ready;await settle();}return{root,body,controller,env,component,ready,dispose(){component.unload();root.remove();}};
    }
    window.hubGetCompletedTaskHistory=()=>plugin.projectWizard.getCompletedTaskHistory();window.hubSetIcon=obsidian.setIcon;
    if(!window.historyReadBaselineOnly){await prepare("services/task-history-read");window.hubCreateTaskHistoryRead=options=>load("services/task-history-read").createTaskHistoryRead({plugin,...options});}
    const snapshot=root=>{const origin=root.getBoundingClientRect();return[...root.querySelectorAll("*")].map(el=>({tag:el.tagName,cls:typeof el.className==="string"?el.className:"svg",text:el.children.length?null:el.textContent,title:el.getAttribute("title"),role:el.getAttribute("role"),tab:el.getAttribute("tabindex"),rect:[el.getBoundingClientRect().x-origin.x,el.getBoundingClientRect().y-origin.y,el.getBoundingClientRect().width,el.getBoundingClientRect().height].map(n=>+n.toFixed(2))}));};
    for(const[kind,owner]of[["home","projects"],["home","resources"],...input.owners.map(owner=>["project",owner])]){
        const original=kind==="home"?originalHome:originalProject,current=window.historyReadBaselineOnly?original:kind==="home"?currentHome:currentProject;
        const a=await mount(kind,owner,original),before=snapshot(a.root),rows=a.body.querySelectorAll(".home-completed-task-row,.project-completed-task-row").length;
        check(rows>0,"Original nonempty History "+kind+":"+(owner.projectId??owner));
        for(let i=0;i<3;i++){a.body.scrollTop=a.body.scrollHeight;a.body.dispatchEvent(new Event("scroll"));}await settle();const expanded=snapshot(a.root),expandedRows=a.body.children.length;
        const label=kind+"-"+(owner.projectId??owner).replace(":","-");if(label==="home-projects")await screenshot("history-read-original");a.dispose();
        const b=await mount(kind,owner,current);check(JSON.stringify(snapshot(b.root))===JSON.stringify(before),label+" original/current first-page DOM, dates, attribution and geometry");
        for(let i=0;i<3;i++){b.body.scrollTop=b.body.scrollHeight;b.body.dispatchEvent(new Event("scroll"));}await settle();
        check(JSON.stringify(snapshot(b.root))===JSON.stringify(expanded)&&b.body.children.length===expandedRows,label+" progressive pagination, row order and geometry");
        if(label==="home-projects")await screenshot("history-read-candidate");captures.push({label,rows,expandedRows,dom:expanded});b.dispose();
    }
    if(!window.historyReadBaselineOnly&&window.runHistoryInteractions)await window.runHistoryInteractions({plugin,input,files,counts,registrations,load,prepare,mount,currentHome,currentProject,originalHome,originalProject,check,checks,settle,snapshot});
    await plugin.taskService.close();registrations.forEach(fn=>fn());check(counts.index===0&&counts.sources===0&&counts.writes===0,"Recorded History uses no task index, Markdown reads or writes");
    window.hubTaskOpeningFrames={checks,captures,counts};document.getElementById("result").textContent="PASS: "+checks.length+" actual History checks; original/current Home and 10 workspace DOM/pagination/geometry; recorded query isolation. Host APIs mocked.";
}catch(error){document.getElementById("result").textContent="FAIL: "+error.stack;}};
