"use strict";
window.hubTestProjectPolish = async f => {
    const { plugin, load, assert, settle, container } = f;
    const { localISODate } = load("domain/dates"), planning = load("domain/project-planning");
    const rect = el => el.getBoundingClientRect();
    const near = (a,b,message) => assert(Math.abs(a-b)<1,message+` (${a}, ${b})`);
    const shift = days => { const date=new Date();date.setDate(date.getDate()+days);return localISODate(date); };
    const project={...f.project,projectId:"full-polish"}, getProject=plugin.projectWizard.getProjectById;
    plugin.projectWizard.getProjectById=id=>id===project.projectId?project:getProject(id);
    await plugin.planning.savePhase(project.projectId,{name:"Prototype Foundation",start:shift(-60),end:shift(200)});
    const dates=[-60,-59,-58,-57,-56,-55,30,31,32,33,34,35,195,196,197,198,199,200];
    for(const [i,day] of dates.entries()) await plugin.planning.saveMilestone(project.projectId,{name:i%3?"Complete build-ready specifications and validation for the entire application":"Milestone "+i,date:shift(day)});
    const viewport=document.body.createDiv({cls:"markdown-preview-view dashboard"});viewport.style.cssText="position:fixed;inset:20px 20px 40px;overflow:auto";viewport.append(container);
    const mount=async()=>{f.mount(project);f.root.querySelector(".project-cover").style.display="none";load("ui/full-view-layout").mountFullViewLayout({root:f.root,component:f.component,app:plugin.app});await settle();};
    const panel=()=>f.root.querySelector(".hub-roadmap-panel"), toolbar=()=>panel().querySelector(".hub-planning-toolbar"), rangeButton=()=>panel().querySelector('[aria-label="Roadmap range"]');
    const menuItems=()=>[...document.querySelectorAll(".hub-fixture-menu button")];
    const choose=async value=>{rangeButton().click();const title={all:"Entire project",3:"3 months",6:"6 months",12:"1 year"}[value];menuItems().find(button=>button.textContent===title).click();await settle();};
    function checkCards(){
        const scroll=panel().querySelector(".hub-roadmap-scroll"), track=panel().querySelector(".hub-roadmap-milestones .hub-roadmap-track"), column=panel().querySelector(".hub-roadmap-label");
        const left=rect(scroll).left+rect(column).width,right=rect(scroll).left+scroll.clientWidth;
        assert([...panel().querySelectorAll(".hub-roadmap-milestone-caption[hidden]")].every(label=>getComputedStyle(label).display==="none"),"Offscreen and excess cards are actually hidden");
        const labels=[...panel().querySelectorAll(".hub-roadmap-milestone-caption")].filter(el=>!el.hidden);
        assert(Number(panel().querySelector(".hub-roadmap-milestones").dataset.lanes)<=3,"Milestone section bounded to three lanes");
        for(const [i,label] of labels.entries()){
            assert(rect(label).left>=left-.5&&rect(label).right<=right+.5,"Cards fit the visible horizontally scrolled viewport");
            assert(getComputedStyle(label).borderTopWidth==="1px"&&getComputedStyle(label).boxShadow==="none","Thin outlined label cards without glow");
            assert(getComputedStyle(label).backgroundColor === "rgba(0, 0, 0, 0)", "Milestone annotations remain transparent");
            assert(getComputedStyle(label.querySelector(".hub-roadmap-milestone-title")).webkitLineClamp==="2","Milestone title clamped to two lines");
            assert(!label.querySelector(".hub-roadmap-milestone-date"),"Resting milestone card contains title only");
            near(rect(label).height,rect(labels[0]).height,"Short and long title cards have the same compact height");
            const title=label.querySelector(".hub-roadmap-milestone-title");
            near(rect(title).height,2*parseFloat(getComputedStyle(title).lineHeight),"Card reserves exactly two title lines");
            assert(label.tabIndex===0&&label.dataset.tooltipPosition==="bottom"&&!label.hasAttribute("title"),"Card is keyboard-accessible with one native bottom hover tooltip");
            const milestone=plugin.planning.read(project.projectId).milestones.find(item=>item.id===label.dataset.milestoneId);
            const exact=new Date(milestone.date+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
            assert(label.getAttribute("aria-label").includes(exact)&&label.dataset.hubFocusTooltip===exact,"Exact date survives title truncation");
            for(const other of labels.slice(i+1)){const a=rect(label),b=rect(other);assert(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,"Dense labels never overlap");}
        }
        const range=planning.roadmapViewport(plugin.planning.read(project.projectId),f.controller.state);
        for(const marker of panel().querySelectorAll(".hub-roadmap-milestone")){
            const item=plugin.planning.read(project.projectId).milestones.find(item=>item.id===marker.dataset.planningId);
            const glyph=[...panel().querySelectorAll(".hub-roadmap-diamond")].find(el=>el.dataset.milestoneId===item.id).querySelector("polygon");
            near(glyph.points.getItem(0).x/glyph.ownerSVGElement.viewBox.baseVal.width*100,range.position(item.date),"Diamond exact date preserved");
        }
        for(const path of panel().querySelectorAll(".hub-roadmap-leaders path")){
            const card=labels.find(label=>label.dataset.milestoneId===path.dataset.milestoneId), marker=[...panel().querySelectorAll(".hub-roadmap-milestone")].find(marker=>marker.dataset.planningId===path.dataset.milestoneId);
            const values=path.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number), points=[];for(let i=0;i<values.length;i+=2)points.push([values[i],values[i+1]]);
            const glyph=[...panel().querySelectorAll(".hub-roadmap-diamond")].find(el=>el.dataset.milestoneId===path.dataset.milestoneId),diamond=rect(glyph);
            assert(Math.abs(points[0][0]+rect(track).left-(diamond.left+diamond.right)/2)<.001,"Leader begins exactly on the rendered tip x, including subpixel layout");
            assert(Math.abs(points[0][1]+rect(track).top-diamond.bottom)<.001,"Leader begins exactly at the rendered bottom tip y");
            assert(Math.abs(points.at(-1)[1]+rect(track).top-rect(card).top)<.001,"Leader terminates exactly at the rendered card boundary");
            for(let i=1;i<points.length;i++){
                const a=points[i-1],b=points[i];assert(a[0]===b[0]||a[1]===b[1],"Rendered leaders contain no diagonals");
                for(const other of labels.filter(label=>label!==card)){const r=rect(other);assert(!load("domain/roadmap-milestones").segmentHitsCard(a,b,{left:r.left-rect(track).left,top:r.top-rect(track).top,width:r.width,height:r.height}),"Rendered leader avoids other label cards");}
            }
        }
    }
    for(const width of [900,1040,1440]){
        container.style.width=width+"px";await mount();f.click("Work");await settle();
        const heading=f.root.querySelector(".hub-explorer-heading"), separator=rect(heading).bottom, surfaceTop=rect(f.root.querySelector(".hub-workspace-explorer")).top;
        const tasks=f.root.querySelector(".project-tasks");tasks.replaceChildren();
        const title=tasks.createDiv({cls:"project-panel-title project-tasks-title"});load("ui/icons").setHubIcon(title.createSpan({cls:"project-tasks-title-icon"}),"list-todo");title.createSpan({text:"Tasks"});const titleStyle=getComputedStyle(title);const clear=title.createEl("button",{text:"Clear",cls:"hub-panel-action hub-compact-panel-action"});
        const body=tasks.createDiv({cls:"project-tasks-body"});load("ui/tasks").createTaskUi({app:plugin.app,component:f.component,body,createTask:()=>{}}).addButton(title,{});
        const center=rect(clear).top+rect(clear).height/2;
        const modeSearch=[...f.root.querySelectorAll(".hub-task-mode,.hub-context-search")].map(el=>[rect(el).left,rect(el).top,rect(el).width,rect(el).height]);
        const checkHeader=selector=>{const header=f.root.querySelector(selector);near(rect(header).bottom,separator,"Separator aligns with Work Files");near(rect(header).top,surfaceTop+1,"Panel starts at shared Work position");const action=header.querySelector(".hub-full-add-task,.hub-roadmap-add-phase");near(rect(action).top+rect(action).height/2,center,"Utility controls share Work Clear/add centerline");assert(JSON.stringify([...f.root.querySelectorAll(".hub-task-mode,.hub-context-search")].map(el=>[rect(el).left,rect(el).top,rect(el).width,rect(el).height]))===JSON.stringify(modeSearch),"Primary mode/search geometry unchanged");};
        f.click("Schedule");
        for(const view of ["Overview","Week","Month","Overview"]){
            f.click(view);await settle();checkHeader(".hub-schedule-toolbar");
            const header=f.root.querySelector(".hub-schedule-toolbar"),scheduleTitle=header.querySelector(".hub-schedule-title"),style=getComputedStyle(scheduleTitle);
            assert(scheduleTitle.textContent==="Schedule"&&scheduleTitle.querySelector('[data-icon="clipboard-list"]'),"Schedule title uses Lucide clipboard-list on the control row");
            for(const key of ["fontSize","fontWeight","gap"])assert(style[key]===titleStyle[key],"Schedule title matches Tasks "+key);
            near(rect(scheduleTitle.querySelector("svg")).width,16,"Schedule title reuses Tasks icon scale");
            const controls=[...header.querySelectorAll(".hub-panel-selectors button"),header.querySelector(".hub-full-add-task")];
            for(const control of controls)near(rect(control).width,rect(controls[0]).width,"All four Schedule controls share the intrinsic widest width");
            assert(rect(scheduleTitle).right<=rect(header.querySelector(".hub-planning-actions")).left,"Title and controls never overlap");
            assert(!header.textContent.includes("Upcoming"),"Old display label removed");
        }
        const buttons=[...f.root.querySelectorAll(".hub-schedule-toolbar .hub-panel-selectors button")], task=f.root.querySelector(".hub-full-add-task");
        assert(buttons.map(button=>button.textContent).join("|")==="Overview|Week|Month"&&task.textContent==="Task","Final Schedule order and action label");
        near(rect(buttons[1]).left-rect(buttons[0]).right,rect(task).left-rect(buttons[2]).right,"Overview and Task separation use the same gap");
        assert(rect(buttons[1]).left-rect(buttons[0]).right>rect(buttons[2]).left-rect(buttons[1]).right,"Week and Month form tight pair");
        const expected=["clock-alert","sun","clock-arrow-right","calendar-clock","calendar-off"];
        [...f.root.querySelectorAll(".hub-task-column-heading")].forEach((heading,i)=>{const icon=heading.querySelector(".hub-overview-heading-icon");assert(icon.dataset.icon===expected[i]||icon.querySelector(".lucide-"+expected[i]),"Actual requested Lucide heading icon");near(rect(icon.querySelector("svg")).width,16,"Home History heading icon scale");const style=getComputedStyle(heading.querySelector("h3"));assert(style.fontSize==="14.4px"&&style.fontWeight==="700"&&style.gap==="6px","Home History subtitle typography and spacing");assert(rect(heading.querySelector(".hub-task-count")).left>rect(heading.querySelector("h3")).right,"Counts remain aligned separately");});
        const overviewGap=rect(buttons[1]).left-rect(buttons[0]).right;
        task.click();await settle();assert(window.lastModal.contentEl.querySelector("form"),"+ Task opens existing task creation form");window.lastModal.close();
        f.click("Roadmap");await settle();checkHeader(".hub-roadmap-panel .hub-planning-toolbar");
        const group=[...panel().querySelectorAll(".hub-roadmap-creation > button")];
        const roadmapTitle=toolbar().querySelector(".hub-roadmap-title"), roadmapStyle=getComputedStyle(roadmapTitle);
        assert(roadmapTitle.textContent==="Roadmap"&&roadmapTitle.querySelector('[data-icon="route"]'),"Roadmap title uses actual Lucide route");
        for(const key of ["fontSize","fontWeight","gap"])assert(roadmapStyle[key]===titleStyle[key],"Roadmap title matches Tasks "+key);
        near(rect(roadmapTitle.querySelector("svg")).width,16,"Roadmap heading reuses 16px icon scale");
        assert(rect(roadmapTitle).right<rect(rangeButton()).left,"Title remains left with right-aligned actions");
        assert(!toolbar().querySelector(".hub-planning-navigation,h3"),"Time navigation and range string leave the top band");
        const axis=panel().querySelector(".hub-roadmap-axis"), corner=axis.querySelector(".hub-roadmap-label"), navigation=corner.querySelector(".hub-planning-navigation");
        assert(navigation.children.length===3&&navigation.lastChild.textContent==="Today","Axis corner owns previous/next/Today");
        for(const control of navigation.children){near(rect(control).height,23,"Axis controls retain compact height");near(rect(control).top+rect(control).height/2,rect(axis).top+(rect(axis).height-1)/2,"Navigation centers against the complete two-row axis");}
        near(rect(corner).width,rect(panel().querySelector(".hub-roadmap-phase .hub-roadmap-label")).width,"Axis and phase labels share unchanged column width");
        near(rect(group[0]).width,rect(group[1]).width,"Phase and Milestone share the widest action width");
        near(rect(group[0]).left-rect(rangeButton()).right,overviewGap,"Roadmap viewport separation matches Overview separation");
        assert(rect(rangeButton()).width>rect(group[0]).width,"Range selector keeps its independent Entire project width");
        const initialWidth=rect(rangeButton()).width;rangeButton().click();await settle();assert(rangeButton().getAttribute("aria-expanded")==="true","Range menu owns open state");assert(getComputedStyle(rangeButton().querySelector(".is-open")).display!=="none"&&getComputedStyle(rangeButton().querySelector(".is-closed")).display==="none","Presets open chevron-down");document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}));assert(rangeButton().getAttribute("aria-expanded")==="false","Escape resets disclosure");
        for(const zoom of ["all","3","6","12"]){await choose(zoom);near(rect(rangeButton()).width,initialWidth,"Range width remains based on Entire project");checkHeader(".hub-roadmap-panel .hub-planning-toolbar");checkCards();const scroll=panel().querySelector(".hub-roadmap-scroll");scroll.scrollLeft=scroll.scrollWidth;await settle();checkCards();scroll.scrollLeft=0;await settle();}
    }
    await choose("all");
    const titles=[...panel().querySelectorAll(".hub-roadmap-milestone-caption:not([hidden]) .hub-roadmap-milestone-title")];
    assert(titles.some(title=>title.scrollHeight>title.clientHeight),"Long title overflows the two-line box for native ellipsis clamping");
    assert(titles.some(title=>title.textContent.startsWith("Milestone ")),"Short one-line titles share the same annotation sizing");
    const track=panel().querySelector(".hub-roadmap-milestones .hub-roadmap-track"), range=planning.roadmapViewport(plugin.planning.read(project.projectId),f.controller.state);
    const x=rect(track).left+rect(track).width*.42,y=rect(track).bottom-8;
    const event=new MouseEvent("contextmenu",{clientX:x,clientY:y,bubbles:true,cancelable:true});track.dispatchEvent(event);
    assert(event.defaultPrevented&&menuItems().map(item=>item.textContent).join("|")==="Add phase|Add milestone","Empty grid menu has exactly the two creation choices");
    const expected=new Date(range.start);expected.setDate(expected.getDate()+Math.floor(range.total*.42));
    menuItems()[0].click();await settle();let modal=window.lastModal;
    assert(modal.contentEl.querySelector("h2").textContent==="Add phase","Context uses the same creation form");assert(modal.contentEl.querySelector('[aria-label="Start"]').value===localISODate(expected),"Phase start inferred from pointer");assert(modal.contentEl.querySelector('[aria-label="End"]').value===localISODate(expected),"Conventional same-day phase end retained");
    modal.contentEl.querySelector('[aria-label="Title"]').value="Contextual phase";modal.contentEl.querySelector('[type="submit"]').click();await settle();assert(plugin.planning.read(project.projectId).phases.some(item=>item.name==="Contextual phase"&&item.start===localISODate(expected)),"Context phase persists through existing service");
    const freshTrack=panel().querySelector(".hub-roadmap-milestones .hub-roadmap-track");freshTrack.dispatchEvent(new MouseEvent("contextmenu",{clientX:x,clientY:rect(freshTrack).bottom-8,bubbles:true,cancelable:true}));menuItems()[1].click();await settle();modal=window.lastModal;
    assert(modal.contentEl.querySelector("h2").textContent==="Add milestone"&&modal.contentEl.querySelector('[aria-label="Date"]').value===localISODate(expected),"Contextual milestone prefill uses the same form");modal.contentEl.querySelector('[aria-label="Title"]').value="Contextual milestone";modal.contentEl.querySelector('[type="submit"]').click();await settle();assert(plugin.planning.read(project.projectId).milestones.some(item=>item.name==="Contextual milestone"&&item.date===localISODate(expected)),"Context milestone persistence retained");
    const interactive=panel().querySelector(".hub-roadmap-phase-bar");const ignored=new MouseEvent("contextmenu",{bubbles:true,cancelable:true});interactive.dispatchEvent(ignored);assert(!ignored.defaultPrevented&&!menuItems().length,"Interactive items retain their own context behavior");
    f.click("Phase");await settle();assert(window.lastModal.contentEl.querySelector("h2").textContent==="Add phase","Top action shares phase modal");window.lastModal.close();f.click("Milestone");await settle();assert(window.lastModal.contentEl.querySelector("h2").textContent==="Add milestone","Top action shares milestone modal");window.lastModal.close();
    const card=[...panel().querySelectorAll(".hub-roadmap-milestone-caption")].find(el=>!el.hidden);
    const marker=[...panel().querySelectorAll(".hub-roadmap-milestone")].find(el=>el.dataset.planningId===card.dataset.milestoneId);
    for(const target of [marker,card]){
        target.focus({preventScroll:true});await new Promise(resolve=>setTimeout(resolve,1100));
        const help=document.getElementById(target.getAttribute("aria-describedby"));
        assert(help?.classList.contains("tooltip")&&help.textContent===target.dataset.hubFocusTooltip,"Keyboard focus shows concise exact date in the native tooltip surface");
        document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));assert(!help.isConnected,"Escape dismisses keyboard date tooltip");
        target.blur();
    }
    card.click();await settle();assert(window.lastModal.contentEl.querySelector("h2").textContent==="Edit milestone","Clicking a label retains milestone editing");window.lastModal.close();
    // Physical capacity stays bounded without losing the excess milestone items.
    const normal=structuredClone(plugin.projectWizard.data.projectPlanning[project.projectId]);
    const stored=plugin.projectWizard.data.projectPlanning[project.projectId];
    stored.milestones=Array.from({length:60},(_,i)=>({id:"capacity-"+i,name:"Dense milestone "+i,date:localISODate(),achieved:false}));
    f.click("Roadmap");await settle();checkCards();
    const more=panel().querySelector(".hub-roadmap-more");assert(more&&panel().querySelectorAll(".hub-roadmap-milestone").length===60,"Excess labels stay available with every exact diamond retained");more.click();await settle();assert(menuItems().length>0,"Bounded overflow opens accessible native item list");menuItems()[0].click();await settle();assert(window.lastModal.contentEl.querySelector("h2").textContent==="Edit milestone","Overflow reaches existing item editor");window.lastModal.close();
    stored.milestones=[{id:"isolated",name:"A single isolated milestone",date:localISODate(),achieved:false}];f.click("Roadmap");await settle();assert(!panel().querySelector(".hub-roadmap-leaders path"),"Isolated milestone remains visually simple");checkCards();
    stored.phases=[];stored.milestones=[];f.click("Roadmap");await settle();const empty=panel().querySelector(".hub-task-view-empty");assert(rect(empty).height>200,"Empty Roadmap creation hit area fills the body");empty.dispatchEvent(new MouseEvent("contextmenu",{clientX:innerWidth-1,clientY:innerHeight-1,bubbles:true,cancelable:true}));await settle();const menu=document.querySelector(".hub-fixture-menu");assert(rect(menu).right<=innerWidth&&rect(menu).bottom<=innerHeight,"Native menu remains inside viewport");assert(menuItems().map(item=>item.textContent).join("|")==="Add phase|Add milestone","Empty plan supports the same creation menu");document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}));
    plugin.projectWizard.data.projectPlanning[project.projectId]=normal;
    // Preserve screenshots/interactive previews for the actual mounted controls.
    window.projectPolishPreview=async(view="Roadmap",zoom="all")=>{
        if(window.lastModal?.containerEl?.isConnected)window.lastModal.close();
        container.style.width="1400px";await mount();
        if(view==="Roadmap"){f.click("Roadmap");await choose(zoom);}
        else if(view==="Work"){
            f.click("Work");const tasks=f.root.querySelector(".project-tasks");tasks.replaceChildren();
            const header=tasks.createDiv({cls:"project-panel-title project-tasks-title",text:"Tasks"});header.createEl("button",{text:"Clear",cls:"hub-panel-action hub-compact-panel-action"});
            load("ui/tasks").createTaskUi({app:plugin.app,component:f.component,body:tasks.createDiv({cls:"project-tasks-body"}),createTask:()=>{}}).addButton(header,{});
        }else{f.click("Schedule");f.click(view);}await settle();viewport.scrollTop=0;
    };
    await window.projectPolishPreview();
    console.log("Project Full-view polish verified");
};
