"use strict";
// Actual editor/checklist modules and native CSS, with an isolated Modal/service
// adapter. CDP supplies trusted pointer, keyboard and touch-capability changes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
async function run(){
 const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-progress-ui-'));
 // Exercise the actual installed Obsidian Modal lifecycle, including its keyboard scope.
 const archive=fs.openSync(process.env.HUB_TEST_OBSIDIAN_ASAR||path.join(process.env.APPDATA,'obsidian/obsidian-1.15.1.asar'),'r');
 const prefix=Buffer.alloc(16);fs.readSync(archive,prefix,0,16,0);const headerBytes=Buffer.alloc(prefix.readUInt32LE(12));fs.readSync(archive,headerBytes,0,headerBytes.length,16);
 const entry=JSON.parse(headerBytes).files['app.js'],bytes=Buffer.alloc(entry.size);fs.readSync(archive,bytes,0,bytes.length,8+prefix.readUInt32LE(4)+Number(entry.offset));fs.closeSync(archive);
 const application=bytes.toString(),modalStart=application.indexOf('var ei=class{'),modalEnd=application.indexOf(',Sk=class',modalStart);
 assert(modalStart>=0&&modalEnd>modalStart,'Installed Modal extraction must match the inspected host');
 const nativeModal='return '+application.slice(modalStart+'var ei='.length,modalEnd)+';';
 const native=process.env.HUB_TEST_NATIVE_CSS||path.join(os.tmpdir(),'itacan-native-app.css');
 assert(fs.existsSync(native),'Supply native Obsidian CSS through HUB_TEST_NATIVE_CSS');
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=name==='/home.css'?path.resolve(root,'../../../System/Dashboards/Home/view.css'):name==='/native.css'?native:name==='/main.js'?path.join(os.tmpdir(),'itacan-progress-build/main.js'):path.resolve(root,'.'+name);if(file!==native&&name!=='/home.css'&&name!=='/main.js'&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}if(name==='/native-modal.js'){res.setHeader('Content-Type','text/javascript');res.end(nativeModal);return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');let content=fs.readFileSync(file);if(name==='/main.js'&&process.env.HUB_TEST_REINTRODUCE_PLAN_SCOPE_COLLISION==='1')content=content.toString().replaceAll('this.workspaceScope','this.scope');if(name==='/main.js'&&process.env.HUB_TEST_REINTRODUCE_SCOPE_COLLISION==='1')content=content.toString().replace('reportScope: scope,','scope,').replaceAll('this.reportScope','this.scope');res.end(content)}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const child=spawn(process.env.HUB_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(output,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket,checks=0;const check=(v,message)=>{assert(v,message);checks++},near=(a,b)=>Math.abs(a-b)<.1;
 const timeout=setTimeout(()=>{child.kill();server.close();console.error('Step browser test timed out');process.exit(1)},60000);
 try{
  let devtools;for(let i=0;i<200;i++){try{devtools=fs.readFileSync(path.join(output,'profile/DevToolsActivePort'),'utf8').split(/\r?\n/);break}catch{await new Promise(r=>setTimeout(r,50))}}
  assert(devtools,'Browser starts');const targets=await(await fetch('http://127.0.0.1:'+devtools[0]+'/json/list')).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  const move=(x=1,y=1)=>call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
  const point=expression=>evaluate(`(()=>{const e=(${expression});e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2}})()`);
  const hover=async expression=>{const p=await point(expression);await move(p.x,p.y)};
  const click=async expression=>{const p=await point(expression);await move(p.x,p.y);await call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await evaluate('new Promise(r=>requestAnimationFrame(r))')};
  const key=async(key,vk,modifiers=0)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:vk,modifiers,...(key==='Enter'?{text:'\r'}:{})});await call('Input.dispatchKeyEvent',{type:'keyUp',key,windowsVirtualKeyCode:vk,modifiers});await evaluate('new Promise(r=>requestAnimationFrame(r))')};
  const screenshot=async name=>{const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(result.data,'base64'))};
  await call('Page.enable');await call('Runtime.enable');
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/lib/tests/global-plan.html'});
  for(let i=0;i<200&&!await evaluate('window.testDone');i++)await new Promise(r=>setTimeout(r,25));
  check(await evaluate('window.testDone&&!window.testError'),await evaluate('window.testError')||'Browser initialized');
  check(await evaluate('planEditor.contentEl.getBoundingClientRect().height>0'),'Plan visibly mounts with native Modal scope');
  check(await evaluate('openEditor()===planEditor&&document.querySelectorAll(".hub-plan-modal").length===1'),'Repeated clicks reuse one modal');
  check(await evaluate('planEditor.note.value===""&&planEditor.note.getBoundingClientRect().height>0'),'Empty optional note remains visible in full editor');
  check(await evaluate('getComputedStyle(planEditor.body.querySelector(".hub-plan-collection")).borderLeftWidth==="0px"'),'Empty editor omits its rail');
  await evaluate('window.homePreview=mountPreview("home");window.reportPreview=mountPreview("report");true');
  check(await evaluate('homePreview.host.querySelector(".hub-plan-note-excerpt").hidden&&reportPreview.host.querySelector(".hub-plan-note-excerpt").hidden'),'Empty notes are omitted in Home and Report previews');
  check(await evaluate('[homePreview.host,reportPreview.host,planEditor.body].every(r=>!r.querySelector("h3,.hub-plan-section-heading"))'),'Shared Plan presentation contains no period heading or replacement');
  check(await evaluate('Math.abs(homePreview.host.querySelector(".hub-plan-collection").getBoundingClientRect().top-homePreview.host.getBoundingClientRect().top)<1'),'Empty Home note leaves the collection directly below the panel header');
  check(await evaluate('planEditor.body.firstElementChild.contains(planEditor.note)&&getComputedStyle(planEditor.body).paddingTop==="12px"&&planEditor.note.parentElement.nextElementSibling===planEditor.scroller'),'Editor starts with its note and conventional separator spacing');

  check(await evaluate('planEditor.contentEl.textContent.includes("Choose work to include in your plan.")&&planEditor.note.rows===2&&getComputedStyle(planEditor.note).minHeight==="56px"&&getComputedStyle(planEditor.note.parentElement).marginBottom==="12px"'),'Subtitle and note layout follow approved typography without changing the editor field');
  await evaluate('const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");planEditor.addButton.querySelector(".hub-capture-icon").append(svg);true');
  check(await evaluate('(()=>{const button=planEditor.addButton,icon=button.firstElementChild,label=button.lastElementChild,b=button.getBoundingClientRect(),i=icon.getBoundingClientRect(),l=label.getBoundingClientRect(),s=getComputedStyle(icon);return i.width===16&&i.height===16&&s.lineHeight==="0px"&&s.flexShrink==="0"&&getComputedStyle(icon.firstElementChild).display==="block"&&Math.abs(l.left-i.right-8)<1&&Math.abs((i.left+l.right)/2-(b.left+b.right)/2)<1&&Math.abs((i.top+i.bottom)/2-(l.top+l.bottom)/2)<1})()'),'Add icon and label form a centered group without SVG baseline space');
  await evaluate('homePreview.dispose();reportPreview.dispose();true');
  await click('planEditor.addButton');await evaluate('new Promise(r=>setTimeout(r,30))');
  check(await evaluate('!!document.querySelector(".hub-plan-picker-row")'),await evaluate('planPlugin.planPicker.error.textContent'));
  await click('document.querySelector(".hub-plan-picker-row")');
  check(await evaluate('(()=>{const p=planPlugin.planPicker;return !p.results.querySelector("input")&&p.results.querySelector(".hub-task-decorative-checkbox[aria-hidden=true]")&&p.results.querySelector(".hub-task-necessity-bar.is-must")&&p.results.querySelector("[aria-pressed=true]").textContent.includes("New")&&!fixtureTask().completed&&p.reviewToggle.textContent==="Review selection"})()'),'Decorative native task indicator and importance remain visible while row owns selection');
  await click('planPlugin.planPicker.results.querySelector(".hub-task-decorative-checkbox")');
  check(await evaluate('planPlugin.planPicker.selected.size===0&&!fixtureTask().completed'),'Clicking task indicator area only deselects the row');
  await evaluate('planPlugin.planPicker.results.querySelector("[data-selection-key]").focus();true');await key('Enter',13);
  check(await evaluate('planPlugin.planPicker.selected.size===1&&!fixtureTask().completed'),'Enter selects a task without completing it');
  await click('planPlugin.planPicker.reviewToggle');
  check(await evaluate('!planPlugin.planPicker.reviewList.hidden&&planPlugin.planPicker.reviewList.textContent.includes("Native Task")&&planPlugin.planPicker.modalEl.getBoundingClientRect().height<=680'),'Selection review shows pending names within fixed modal dimensions');
  await click('planPlugin.planPicker.reviewList.querySelector("button")');
  check(await evaluate('planPlugin.planPicker.selected.size===0&&planPlugin.planPicker.review.hidden&&document.activeElement===planPlugin.planPicker.categoryButtons[0].b'),'Removing final pending selection hides review and restores accessible focus');
  await click('planPlugin.planPicker.results.querySelector("[data-selection-key]")');
  check(await evaluate('(()=>{const p=planPlugin.planPicker,base=p.items.find(i=>i.task),now=new Date(),tomorrow=new Date(now.getTime()+86400000).toISOString().slice(0,10),past="2000-01-01",make=(label,extra)=>({...base,label,task:{...base.task,text:label,...extra}});return p.orderTasks([make("undated",{necessity:null}),make("future",{fromDate:tomorrow}),make("must",{necessity:"must"}),make("overdue",{dueDate:past})]).map(i=>i.label).join(",")==="overdue,must,undated,future"})()'),'Picker reuses Home date, necessity, and future ordering');
  check(await evaluate('(()=>{const p=planPlugin.planPicker,fn=p.ensureFileLocation,explore={contextKind:"resource",resourceType:"references",root:"Resources/Explorations"},project={contextKind:"project",projectId:"p",root:"Projects/P"},run=(owners,existing,invocation=null)=>{const v={fileInitialized:false,invocation,plan:{references:{workspaces:()=>owners}},plugin:{app:{vault:{getAbstractFileByPath:path=>existing.includes(path)?{children:[]}:null}}},workspaceScope:{},sharedIn:()=>false};fn.call(v);return v.folder};return run([project,explore],[project.root,explore.root])===explore.root&&run([project,explore],[project.root])===project.root&&run([project,explore],[project.root,explore.root],project)===project.root&&run([project,explore],[])===undefined})()'),'Defaults validate actual Explorations, first workspace, invocation context, and empty availability');
  check(await evaluate('(()=>{const p=planPlugin.planPicker,b=p.results.querySelector(".hub-task-decorative-checkbox").getBoundingClientRect(),footer=p.add.getBoundingClientRect(),modal=p.modalEl.getBoundingClientRect();return b.width>10&&b.height>10&&footer.bottom<=modal.bottom&&p.body.getBoundingClientRect().height>=64})()'),'Task indicator and fixed footer remain visible at compact window height');
  check(await evaluate('(()=>{const p=planPlugin.planPicker,indicator=p.results.querySelector(".hub-task-decorative-checkbox"),task=p.results.querySelector(".home-task-row"),s=getComputedStyle(task);return indicator.parentElement===task&&!p.results.querySelector(".hub-plan-leading")&&getComputedStyle(indicator).width==="15px"&&s.paddingLeft==="12px"&&s.columnGap==="12px"})()'),'Picker task indicator inherits native modal sizing and original Home Tasks row layout');
  await screenshot('picker-tasks');
  await evaluate('setFixtureCompleted(true);planPlugin.planPicker.commit();new Promise(r=>setTimeout(r,30))');
  check(await evaluate('plan.draft.entries.length===0&&planPlugin.planPicker.selected.size===0&&planPlugin.planPicker.error.textContent.includes("completed")'),'Commit rejects newly completed selection without partial additions');
  await key('Escape',27);await evaluate('setFixtureCompleted(false);true');
  check(await evaluate('planEditor.legacyButton.hidden===false&&!planEditor.contentEl.textContent.includes("More")'),'Legacy review is contextual with no More control');
  await click('planEditor.legacyButton');await evaluate('new Promise(r=>setTimeout(r,30))');
  check(await evaluate('planEditor.legacy.textContent.includes("Preserve this description")'),'Contextual action retains the legacy review workflow');
  await evaluate('planEditor.reviewLegacy();true');
  check(await evaluate('planEditor.note.placeholder==="Add a note for today..."&&!planEditor.body.textContent.includes("Note ? optional")'),'Visible note uses placeholder without a label');
  check(await evaluate('planEditor.addButton.parentElement===planEditor.body&&!planEditor.addButton.closest(".hub-plan-collection")&&planEditor.addButton.textContent==="Add to plan"'),'Full-width Add stays outside the collection scroller');
  await evaluate('(async()=>{plan.add((await plan.references.candidates()).slice(0,2).map(i=>i.entry));await new Promise(r=>setTimeout(r,30))})()');
  await evaluate(`new Promise(r=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/home.css';l.onload=r;document.head.append(l)})`);
  await evaluate(`window.headerSizing=document.body.createDiv({cls:'home-dashboard hub-button-scope'});const h=headerSizing.createDiv({cls:'home-panel-title'});for(const [cls,text]of [['home-focus-edit hub-panel-action','Edit'],['home-calendar-today hub-panel-action','Today'],['hub-task-add hub-panel-action','Task']])h.createEl('button',{cls,text});true`);
  check(await evaluate(`(()=>{const b=[...headerSizing.querySelectorAll('button')],r=b.map(e=>e.getBoundingClientRect());b[0].textContent='+ Plan';const changed=b[0].getBoundingClientRect();return r.every(v=>Math.abs(v.width-r[0].width)<1&&Math.abs(v.height-r[0].height)<1)&&changed.width===r[0].width&&changed.height===r[0].height})()`),'Home Edit and + Plan share Calendar and Tasks header dimensions');await evaluate('headerSizing.remove();true');
  await evaluate('window.leadingHome=mountPreview("home");new Promise(r=>setTimeout(r,30))');
  await evaluate('leadingHome.host.style.removeProperty("line-height");true');
  check(await evaluate('(()=>{const roots=[leadingHome.host,planEditor.body],reference=16;return roots.every(root=>{const rows=[...root.querySelectorAll(".hub-plan-row")],offsets=rows.map(row=>{const title=row.querySelector(".hub-plan-title").getBoundingClientRect(),slot=row.querySelector(".hub-plan-leading").getBoundingClientRect(),box=row.getBoundingClientRect();return {start:title.left-box.left,gap:title.left-slot.right,center:slot.top+slot.height/2-title.top-16}});return rows.every(r=>r.querySelector(".hub-plan-leading").getBoundingClientRect().width===reference)&&getComputedStyle(root.querySelector("input[type=checkbox]")).width==="16px"&&Math.abs(offsets[0].start-offsets[1].start)<1&&offsets.every(x=>Math.abs(x.gap-12)<1&&Math.abs(x.center)<1)})})()'),'Home/editor share native-sized leading slots, title alignment, twelve-pixel gap and native top inset');
  await evaluate(`window.nativeAlignmentHost=document.body.createDiv({cls:'home-dashboard hub-button-scope home-tasks-body'});nativeAlignmentHost.style.width='420px';const card=fixtureRequire('lib/ui/task-card.js');window.nativeAlignment=card.createTaskRow(nativeAlignmentHost,fixtureTask(),false,{variant:'home'});card.mountTaskCardPresentation(nativeAlignment.row,nativeAlignment.textEl,fixtureTask(),()=>'',{});window.nativeLeadingCenter=()=>{const b=nativeAlignment.checkbox.getBoundingClientRect(),t=nativeAlignment.textEl.getBoundingClientRect();return b.top+b.height/2-t.top};true`);
  for(const line of [1.35,1.5,1.8]){
   await evaluate(`leadingHome.host.style.lineHeight='${line}';planEditor.body.style.lineHeight='${line}';true`);
   check(await evaluate(`(()=>{return [leadingHome.host,planEditor.body].every(root=>[...root.querySelectorAll('.hub-plan-row')].every(row=>{const title=row.querySelector('.hub-plan-title'),slot=row.querySelector('.hub-plan-leading'),t=title.getBoundingClientRect(),b=slot.getBoundingClientRect(),glyph=slot.firstElementChild;return Math.abs(b.top+b.height/2-t.top-nativeLeadingCenter())<.1&&(!glyph||Math.abs(glyph.getBoundingClientRect().top+glyph.getBoundingClientRect().height/2-b.top-b.height/2)<.1)}))})()`),'Actual checkbox/SVG centers match native Tasks at inherited line-height '+line);
   check(await evaluate(`(()=>{return [leadingHome.host,planEditor.body].every(root=>{const row=root.querySelector('button.hub-plan-title').closest('.hub-plan-row'),title=row.querySelector('.hub-plan-title'),meta=row.querySelector('.hub-plan-metadata'),height=row.getBoundingClientRect().height,metaTop=meta.getBoundingClientRect().top;title.style.verticalAlign='baseline';const unchanged=row.getBoundingClientRect().height===height&&meta.getBoundingClientRect().top===metaTop;title.style.removeProperty('vertical-align');return unchanged})})()`),'Alignment preserves row height and metadata placement at line-height '+line);
  }
  await evaluate(`leadingHome.host.style.removeProperty('line-height');planEditor.body.style.removeProperty('line-height');true`);
  await evaluate(`leadingHome.dispose();nativeAlignmentHost.style.position="fixed";nativeAlignmentHost.style.visibility="hidden";document.querySelector('link[href="/home.css"]').remove();true`);
  check(await evaluate('(()=>{return [...planEditor.body.querySelectorAll(".hub-plan-row")].every(row=>{const title=row.querySelector(".hub-plan-title").getBoundingClientRect(),b=row.getBoundingClientRect();return [...row.querySelectorAll(".hub-plan-hover")].every(button=>{const c=button.getBoundingClientRect();return Math.abs(c.top+c.height/2-(b.top+b.height/2))<1&&getComputedStyle(button).alignSelf==="center"})&&b.right-row.querySelector("[data-plan-control=remove]").getBoundingClientRect().right>=12})})()'),'Task and file controls center within the full row and retain the right inset');
  // The isolated icon adapter records names only; paint native-sized glyphs for visual QA.
  await evaluate(`for(const b of planEditor.body.querySelectorAll('.hub-plan-hover')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',b.dataset.planControl==='remove'?'M6 6l12 12M18 6L6 18':'M9 5h0m6 0h0M9 12h0m6 0h0M9 19h0m6 0h0');path.setAttribute('stroke-linecap','round');svg.append(path);b.append(svg);}true`);
  await hover('planEditor.body.querySelectorAll(".hub-plan-row")[1]');await screenshot('plan-row-controls');
  await evaluate('window.controlRow=planEditor.body.querySelectorAll(".hub-plan-row")[1];window.savedControlTitle=controlRow.querySelector(".hub-plan-title").textContent;controlRow.querySelector(".hub-plan-title").textContent="A long planned file title that wraps across several lines to verify full-row control alignment ".repeat(3);true');
  check(await evaluate('(()=>{const row=controlRow,b=row.getBoundingClientRect(),controls=[...row.querySelectorAll(".hub-plan-hover")],centers=controls.map(button=>{const c=button.getBoundingClientRect();return c.top+c.height/2});return b.height>100&&centers.every(y=>Math.abs(y-(b.top+b.height/2))<1)&&Math.abs(centers[0]-centers[1])<1&&b.right-controls[1].getBoundingClientRect().right>=12})()'),'Wrapped title and metadata keep both controls centered together within the full highlight');
  check(await evaluate('(()=>{const row=controlRow,before=row.getBoundingClientRect().height,buttons=[...row.querySelectorAll(".hub-plan-hover")];buttons.forEach(b=>b.style.alignSelf="flex-start");const same=row.getBoundingClientRect().height===before;buttons.forEach(b=>b.style.removeProperty("align-self"));return same})()'),'Control alignment does not change row height');
  await hover('controlRow');await screenshot('plan-row-controls-wrapped');
  await evaluate('controlRow.querySelector(".hub-plan-title").textContent=savedControlTitle;true');

  await evaluate('plan.draft.entries.map(e=>e.id).forEach(id=>plan.remove(id));plan.flush();new Promise(r=>setTimeout(r,30))');
  // Every dismissal route must pop the native scope, remove the child, and preserve its parent.
  for(const state of ['empty','selected','categories']) for(const route of ['Cancel','X','Escape']) {
   await click('planEditor.addButton');await evaluate('new Promise(r=>setTimeout(r,30))');
   await evaluate('window.dismissedPicker=planPlugin.planPicker;window.originalPlan=JSON.stringify({entries:plan.read().entries,note:plan.read().note});true');
   if(state!=='empty')await click('document.querySelector(".hub-plan-picker-row")');
   if(state==='categories')await evaluate('dismissedPicker.categoryEl.value="file";dismissedPicker.categoryEl.onchange();dismissedPicker.search.value="a.pdf";dismissedPicker.search.oninput();dismissedPicker.workspaceScope.value=JSON.stringify({type:"project",id:"p"});dismissedPicker.workspaceScope.onchange();true');
   if(route==='Escape')await key('Escape',27);
   else await click(route==='Cancel'?'[...dismissedPicker.contentEl.querySelectorAll("button")].find(b=>b.textContent==="Cancel")':'dismissedPicker.modalEl.querySelector(".modal-header-button")');
   check(await evaluate('!dismissedPicker.isOpen&&!dismissedPicker.containerEl.isConnected'),route+' removes picker after '+state);
   check(await evaluate('planPlugin.planPicker===null&&dismissedPicker.selected.size===0'),'Dismissal releases ownership and unconfirmed selection');
   check(await evaluate('planPlugin.planModal===planEditor&&planEditor.isOpen&&JSON.stringify({entries:plan.read().entries,note:plan.read().note})===originalPlan'),'Parent entries and note remain intact');
   check(await evaluate('fixtureKeymap.scope===planEditor.scope&&document.activeElement===planEditor.addButton'),'Native scope and focus return to parent');
   check(await evaluate('document.querySelectorAll(".modal-container").length===1'),'No duplicate or invisible child remains');
  }
  await evaluate('planPlugin.openProjectAdvancementPrompt({});true');
  check(await evaluate('applicationCloseCount===0&&planEditor.isOpen'),'Application X focuses the visible parent without a stale picker');
  check(await evaluate('dismissalErrors.length===0'),'No dismissal exceptions or rejected promises');
  await evaluate('planEditor.addButton.click();new Promise(r=>setTimeout(r,50))');
  await click('document.querySelector(".hub-plan-picker-row")');
  await evaluate('planPlugin.planPicker.categoryEl.value="file";planPlugin.planPicker.categoryEl.onchange();planPlugin.planPicker.search.value="a.pdf";planPlugin.planPicker.search.oninput()');
  await click('document.querySelector(".hub-plan-picker-row")');
  check(await evaluate('(()=>{const p=planPlugin.planPicker,icon=p.results.querySelector(".hub-plan-icon");return !p.results.querySelector(".hub-plan-leading")&&getComputedStyle(icon).flexBasis==="18px"&&getComputedStyle(p.results.querySelector(".hub-plan-picker-row")).gap==="8px"})()'),'Picker restores independent file-icon sizing and spacing');
  check(await evaluate('planPlugin.planPicker.selected.size===2'),'Mixed selection survives category and search: '+await evaluate('[...planPlugin.planPicker.selected.values()].map(e=>e.kind).join(",")'));
  check(await evaluate('planPlugin.planPicker.add.textContent==="Add selected (2)"&&document.querySelector(".hub-plan-picker-row.is-new").textContent.includes("New")'),'Only new selections are counted and labeled');
  await click('planPlugin.planPicker.reviewToggle');
  check(await evaluate('planPlugin.planPicker.reviewList.textContent.includes("Native Task")&&planPlugin.planPicker.reviewList.textContent.includes("a.pdf")&&planPlugin.planPicker.reviewList.querySelectorAll("button").length===2'),'Review groups mixed pending additions across categories');
  check(await evaluate('(()=>{const p=planPlugin.planPicker;return p.add.getBoundingClientRect().bottom<=p.modalEl.getBoundingClientRect().bottom&&p.reviewList.scrollHeight>p.reviewList.clientHeight&&p.body.getBoundingClientRect().height>=64})()'),'Expanded review scrolls without obscuring results or footer in a short window');
  await screenshot('picker-review');
  await click('planPlugin.planPicker.add');
  check(await evaluate('snapshot().plansById[snapshot().activePlanId].content.entries.length===2'),'Batch saves task and PDF');
  await evaluate('new Promise(r=>setTimeout(r,40))');
  await call('Emulation.setDeviceMetricsOverride',{width:760,height:900,deviceScaleFactor:1,mobile:false});
  {const start=await point('planEditor.contentEl.querySelector("[data-plan-control=grip]")');const end=await evaluate('(()=>{const r=[...planEditor.contentEl.querySelectorAll(".hub-plan-row")].at(-1).getBoundingClientRect();return {x:r.right-40,y:r.bottom-3}})()');
   await move(start.x,start.y);await call('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseMoved',...end,buttons:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});await evaluate('new Promise(r=>setTimeout(r,60))');}
  check(await evaluate('plan.draft.entries[1].kind==="task"'),'Trailing grip preserves trusted pointer reorder');
  await evaluate('plan.undo();plan.flush()');

  await evaluate('planEditor.note.value="Latest exact reflection draft";planEditor.note.dispatchEvent(new Event("input"))');
  await evaluate('plan.flush()');
  check(await evaluate('snapshot().plansById[snapshot().activePlanId].content.note==="Latest exact reflection draft"'),'Note saves through actual service');
  await evaluate('planEditor.note.value="Parent note draft must survive";planEditor.note.dispatchEvent(new Event("input"));true');
  // Repeat with committed entries and the latest parent note input.
  for(const state of ['empty','selected','categories']) for(const route of ['Cancel','X','Escape']) {
   await click('planEditor.addButton');await evaluate('new Promise(r=>setTimeout(r,30))');
   await evaluate('window.dismissedPicker=planPlugin.planPicker;window.originalPlan=JSON.stringify({entries:plan.read().entries,note:plan.read().note});dismissedPicker.categoryEl.value="workspace";dismissedPicker.categoryEl.onchange();true');
   if(state!=='empty')await click('document.querySelector(".hub-plan-picker-row")');
   if(state==='categories')await evaluate('dismissedPicker.categoryEl.value="file";dismissedPicker.categoryEl.onchange();dismissedPicker.search.value="a.pdf";dismissedPicker.search.oninput();dismissedPicker.workspaceScope.value=JSON.stringify({type:"project",id:"p"});dismissedPicker.workspaceScope.onchange();true');
   if(route==='Escape')await key('Escape',27);
   else await click(route==='Cancel'?'[...dismissedPicker.contentEl.querySelectorAll("button")].find(b=>b.textContent==="Cancel")':'dismissedPicker.modalEl.querySelector(".modal-header-button")');
   check(await evaluate('!dismissedPicker.isOpen&&!dismissedPicker.containerEl.isConnected'),route+' removes picker after '+state);
   check(await evaluate('planPlugin.planPicker===null&&dismissedPicker.selected.size===0'),'Dismissal releases ownership and unconfirmed selection');
   check(await evaluate('planPlugin.planModal===planEditor&&planEditor.isOpen&&JSON.stringify({entries:plan.read().entries,note:plan.read().note})===originalPlan&&planEditor.note.value===plan.read().note'),'Parent entries and note remain intact');
   check(await evaluate('fixtureKeymap.scope===planEditor.scope&&document.activeElement===planEditor.addButton'),'Native scope and focus return to parent');
   check(await evaluate('document.querySelectorAll(".modal-container").length===1'),'No duplicate or invisible child remains');
  }

  await click('planEditor.contentEl.querySelector("input[type=checkbox]")');
  await evaluate('new Promise(r=>setTimeout(r,100))');
  check(await evaluate('planEditor.contentEl.querySelector(".hub-plan-row").classList.contains("is-completed")&&plan.draft.entries.length===2'),'Native completion retains position');
  await evaluate('window.failSave=true;planEditor.note.value="Recover me";planEditor.note.dispatchEvent(new Event("input"));planEditor.close()');
  await evaluate('new Promise(r=>setTimeout(r,100))');
  check(await evaluate('!planPlugin.planModal&&plan.draft.note==="Recover me"'),'Failed primary save permits dismissal with protected draft');
  await evaluate('openEditor();true');
  check(await evaluate('planEditor.note.value==="Recover me"&&planEditor.status.textContent.includes("Retry")'),'Reopening retains draft and visible recovery');
  await evaluate('window.failSave=false;plan.flush()');
  await key('Escape',27);await evaluate('new Promise(r=>setTimeout(r,50))');
  check(await evaluate('!planPlugin.planModal'),'Escape dismisses native modal');
  for(const width of [1024,640]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate('openEditor();true');check(await evaluate('planEditor.modalEl.getBoundingClientRect().right<=innerWidth'),'Plan fits available viewport');}
  await evaluate('planEditor.contentEl.querySelector("[data-plan-control=grip]").focus();true');
  await key('End',35,1);await evaluate('new Promise(r=>setTimeout(r,40))');
  check(await evaluate('plan.draft.entries[1].kind==="task"'),'Alt+End moves the selected entry to the end');
  await click('planEditor.contentEl.querySelector("[data-plan-control=remove]")');
  check(await evaluate('plan.draft.entries.length===1'),'Remove changes only the plan list');
  await evaluate('plan.undo();plan.flush()');
  check(await evaluate('plan.draft.entries.length===2'),'Undo restores the removed reference');
  await evaluate('planEditor.addButton.click();new Promise(r=>setTimeout(r,40))');
  check(await evaluate('!document.querySelector(".hub-plan-picker-row .hub-task-decorative-checkbox")'),'Completed planned tasks are omitted from Add picker');
  await evaluate('planPlugin.planPicker.categoryEl.value="file";planPlugin.planPicker.categoryEl.onchange();planPlugin.planPicker.search.value="a.pdf";planPlugin.planPicker.search.oninput();true');
  check(await evaluate('(()=>{const box=document.querySelector(".hub-plan-picker-row");return box.getAttribute("aria-pressed")==="true"&&box.getAttribute("aria-disabled")==="true"&&box.classList.contains("is-in-plan")&&planPlugin.planPicker.add.textContent==="Add selected (0)"})()'),'Existing entries are checked, locked, styled, and excluded from count');
  await key('Escape',27);
  check(await evaluate('planPlugin.planPicker===null&&planPlugin.planModal.containerEl.isConnected'),'Escape closes only the child picker');
  check(await evaluate('(()=>{const marker=document.body.createSpan({cls:"hub-task-necessity-bar is-must"});const equal=getComputedStyle(marker).width===getComputedStyle(planEditor.body.querySelector(".hub-plan-collection")).borderLeftWidth;marker.remove();return equal})()'),'Plan rail matches the authoritative native task row thickness');
  check(await evaluate('!planEditor.body.querySelector(".hub-task-necessity-bar")'),'Plan suppresses task importance rails without changing task values');
  await evaluate('window.nativeHost=document.body.createDiv();const native=fixtureRequire("lib/ui/task-card.js");const parts=native.createTaskRow(nativeHost,fixtureTask());native.mountTaskCardPresentation(parts.row,parts.textEl,fixtureTask(),()=>"Project/Work");true');
  check(await evaluate('nativeHost.querySelector(".hub-task-necessity-bar.is-must")&&fixtureTask().necessity==="must"'),'Ordinary native task presentation keeps authoritative Must importance');
  await evaluate('nativeHost.remove();true');
  await evaluate('window.homePreview=mountPreview("home");window.reportPreview=mountPreview("report");true');
  check(await evaluate('!homePreview.host.querySelector(".hub-plan-note-excerpt").hidden&&reportPreview.host.querySelector(".hub-plan-note-excerpt").textContent.includes("Recover me")'),'Nonempty notes appear consistently in both previews');
  await evaluate('homePreview.dispose();reportPreview.dispose();true');
  await evaluate('planEditor.body.style.setProperty("--interactive-accent","rgb(20, 140, 100)");true');
  check(await evaluate('getComputedStyle(planEditor.body.querySelector(".hub-plan-collection")).borderLeftColor==="rgb(20, 140, 100)"'),'Collection rail follows the active accent token');
  await evaluate('planEditor.body.style.removeProperty("--interactive-accent");planEditor.addButton.click();new Promise(r=>setTimeout(r,30))');
  await evaluate('planPlugin.planPicker.categoryEl.value="workspace";planPlugin.planPicker.categoryEl.onchange();true');
  check(await evaluate('planPlugin.planPicker.workspaceButton.hidden&&!planPlugin.planPicker.contentEl.textContent.includes("Include completed")'),'Picker hides irrelevant scope and completed-task controls');
  check(await evaluate('(()=>{const buttons=planPlugin.planPicker.categoryButtons.map(x=>x.b.getBoundingClientRect());return Math.max(...buttons.map(b=>b.width))-Math.min(...buttons.map(b=>b.width))<1})()'),'Category segments use equal widths');
  await evaluate('(()=>{const p=planPlugin.planPicker;const item=p.items.find(i=>i.entry.kind==="workspace");p.items.push({...item,label:"Research",workspace:{type:"resource",id:"literature"},entry:{...item.entry,id:"fixture-resource",reference:{type:"resource",id:"literature"}}});p.render();return true})()');
  check(await evaluate('(()=>{return [...planPlugin.planPicker.results.querySelectorAll(".hub-plan-picker-row")].every(row=>{const thumbnail=row.querySelector(".hub-capture-workspace-thumbnail");return thumbnail.parentElement===row&&thumbnail.getBoundingClientRect().width===36&&thumbnail.getBoundingClientRect().height===36&&getComputedStyle(row).gap==="8px"})})()'),'Picker restores native workspace thumbnails and comfortable row spacing');
  await click('planPlugin.planPicker.results.querySelectorAll("[data-selection-key]")[0]');await click('planPlugin.planPicker.results.querySelectorAll("[data-selection-key]")[1]');
  check(await evaluate('(()=>{const rows=[...planPlugin.planPicker.results.querySelectorAll(".is-new")].map(r=>r.getBoundingClientRect());return rows.length===2&&rows[1].top-rows[0].bottom>=3})()'),'Adjacent selected rows retain separate bounded highlights');
  await screenshot('picker');await key('Escape',27);
  check(await evaluate('getComputedStyle(planEditor.note).textAlign==="start"||getComputedStyle(planEditor.note).textAlign==="left"'),'Editor note remains left aligned');
  await screenshot('plan');
  await evaluate('window.lightStyle=document.createElement("style");lightStyle.textContent=".modal{--background-primary:#fff;--background-secondary:#f4f4f4;--text-normal:#222;--text-muted:#666;--background-modifier-border:#ccc;--interactive-accent:#157c69;background:#fff;color:#222}.modal button,.modal textarea{background:#f4f4f4;color:#222}.modal button.mod-cta{background:#157c69;color:#fff}";document.head.append(lightStyle);true');
  check(await evaluate('getComputedStyle(planEditor.body.querySelector(".hub-plan-collection")).borderLeftColor==="rgb(21, 124, 105)"&&planEditor.modalEl.getBoundingClientRect().right<=innerWidth'),'Light palette and alternate accent retain responsive geometry');
  await screenshot('plan-light');await evaluate('lightStyle.remove();true');
  await evaluate('planEditor.close();new Promise(r=>setTimeout(r,30))');
  check(await evaluate('fixtureKeymap.scope===fixtureRootScope&&document.querySelectorAll(".modal-container").length===0'),'Parent closes with the original scope restored');
  await evaluate('planPlugin.openProjectAdvancementPrompt({})');
  check(await evaluate('applicationCloseCount===1'),'Application X closes normally after all modals dismiss');
  await evaluate('window.homePreview=mountPreview("home");window.homePanel=document.body.createDiv({cls:"home-glance"});homePanel.style.cssText="width:420px;height:320px;padding:12px;box-sizing:border-box;border:1px solid #555";const header=homePanel.createDiv({text:"Plan",cls:"home-panel-title"});header.createEl("button",{text:"Edit"});homePanel.append(homePreview.host);homePreview.host.style.cssText="min-height:0";new Promise(r=>setTimeout(r,30))');
  check(await evaluate('(()=>{const n=getComputedStyle(homePreview.host.querySelector(".hub-plan-note-excerpt")),r=getComputedStyle(homePreview.host.querySelector(".hub-plan-row")),m=getComputedStyle(homePreview.host.querySelector(".home-task-location"));return n.paddingTop==="6px"&&n.paddingLeft==="8px"&&n.marginBottom==="8px"&&n.webkitLineClamp==="2"&&r.paddingTop==="8px"&&r.paddingBottom==="8px"&&m.marginTop==="2px"&&parseFloat(n.fontSize)>parseFloat(m.fontSize)})()'),'Home note, route hierarchy, and row density match compact dashboard conventions');
  check(await evaluate('(()=>{const n=homePreview.host.querySelector(".hub-plan-note-excerpt"),s=getComputedStyle(n),title=getComputedStyle(homePreview.host.querySelector(".hub-plan-title"));return s.color===getComputedStyle(homePreview.host).color&&s.fontSize===title.fontSize&&s.fontWeight==="400"&&s.textAlign==="center"})()'),'Home intention note uses centered normal body typography');
  await evaluate('homePreview.host.querySelector(".hub-plan-note-text").textContent="Read and reflect.";true');
  check(await evaluate('(()=>{const n=homePreview.host.querySelector(".hub-plan-note-excerpt"),c=homePreview.host.querySelector(".hub-plan-collection");return homePreview.host.firstElementChild===n&&n.nextElementSibling===c&&Math.abs(n.getBoundingClientRect().top-homePreview.host.getBoundingClientRect().top)<1&&Math.abs(c.getBoundingClientRect().top-n.getBoundingClientRect().bottom-8)<1})()'),'Populated Home note begins naturally and retains its eight-pixel collection gap');

  check(await evaluate('(()=>{const n=homePreview.host.querySelector(".hub-plan-note-excerpt"),label=n.querySelector(".hub-plan-note-caption"),text=n.querySelector(".hub-plan-note-text"),b=n.getBoundingClientRect(),t=text.getBoundingClientRect(),l=label.getBoundingClientRect();return label.textContent==="Today"&&getComputedStyle(label).color===getComputedStyle(homePreview.host.querySelector(".hub-plan-metadata")??label).color&&parseFloat(getComputedStyle(label).fontSize)<parseFloat(getComputedStyle(text).fontSize)&&Math.abs((t.left+t.right)/2-(b.left+b.right)/2)<1&&l.right<t.left&&Math.abs((l.top+l.bottom)/2-(t.top+t.bottom)/2)<1})()'),'Today is secondary and shares a line with the note centered across the entire rectangle');
  await screenshot('home-note-short');
  await evaluate('homePreview.host.querySelector(".hub-plan-note-text").textContent="Read the lecture notes carefully, review the outstanding questions, and prepare a clear summary of the ideas to discuss at the next meeting. ".repeat(5);true');
  check(await evaluate('(()=>{const n=homePreview.host.querySelector(".hub-plan-note-excerpt"),s=getComputedStyle(n);return n.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)<=parseFloat(s.lineHeight)*2+1&&n.querySelector(".hub-plan-note-text").scrollHeight>n.querySelector(".hub-plan-note-text").clientHeight&&n.getBoundingClientRect().right<=homePreview.host.getBoundingClientRect().right})()'),'Long centered notes retain two-line truncation without horizontal overflow');
  await screenshot('home-note-long');
  await evaluate('const n=homePreview.host.querySelector(".hub-plan-note-text");n.textContent="First line\\nSecond line\\nThird line";true');
  check(await evaluate('(()=>{const n=homePreview.host.querySelector(".hub-plan-note-excerpt"),s=getComputedStyle(n);return n.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)<=parseFloat(s.lineHeight)*2+1})()'),'Multiline Home notes remain capped at two visible lines');
  await evaluate('[...homePreview.host.querySelectorAll(".hub-plan-row")].forEach(r=>r.style.minHeight="150px");true');
  check(await evaluate('homePanel.getBoundingClientRect().height===320&&homePreview.host.querySelector(".hub-plan-collection").scrollHeight>homePreview.host.querySelector(".hub-plan-collection").clientHeight&&homePreview.host.scrollHeight<=homePreview.host.clientHeight&&homePanel.scrollHeight<=homePanel.clientHeight'),'Home keeps fixed footprint and one independently scrolling content region');
  check(await evaluate('!homePreview.host.querySelector(".hub-plan-note-excerpt").textContent.startsWith("Note")'),'Home note displays its original text without a prefix');
  await evaluate('window.homeScroll=homePreview.host.querySelector(".hub-plan-collection");window.beforeScroll={note:homePreview.host.firstElementChild.getBoundingClientRect().top,header:homePanel.firstElementChild.getBoundingClientRect().top,rail:homeScroll.getBoundingClientRect().top,row:homeScroll.querySelector(".hub-plan-row").getBoundingClientRect().top};true');
  {const p=await point('homeScroll');await call('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:180});await evaluate('new Promise(r=>setTimeout(r,100))');}
  check(await evaluate('homeScroll.scrollTop>0&&homePreview.host.scrollTop===0&&homePanel.scrollTop===0&&Math.abs(homePreview.host.firstElementChild.getBoundingClientRect().top-beforeScroll.note)<1&&Math.abs(homePanel.firstElementChild.getBoundingClientRect().top-beforeScroll.header)<1'),'Wheel scrolling moves only planned items while note and header remain fixed');
  check(await evaluate('Math.abs(homeScroll.getBoundingClientRect().top-beforeScroll.rail)<1&&homeScroll.querySelector(".hub-plan-row").getBoundingClientRect().top<beforeScroll.row&&getComputedStyle(homeScroll).borderLeftWidth==="3px"'),'Accent rail stays aligned with the visible collection viewport');
  await screenshot('home');
  await evaluate('window.withNoteHeight=homeScroll.clientHeight;plan.setNote("");plan.flush();new Promise(r=>setTimeout(r,30))');
  check(await evaluate('homePreview.host.firstElementChild.hidden&&Math.abs(homeScroll.getBoundingClientRect().top-homePreview.host.getBoundingClientRect().top)<1&&homePreview.host.scrollHeight<=homePreview.host.clientHeight'),'Blank note disappears and frees its entire fixed region for the list');
  await screenshot('home-empty-note');
  await evaluate('[...homeScroll.querySelectorAll(".hub-plan-row")].forEach(r=>r.style.minHeight="200px");homeScroll.scrollTop=homeScroll.scrollHeight;true');
  check(await evaluate('homeScroll.scrollTop>0'), 'Removal regression starts with an overflowing scrolled collection');
  await evaluate('window.railEntries=structuredClone(plan.draft.entries);plan.remove(plan.draft.entries[0].id);new Promise(r=>setTimeout(r,40))');
  check(await evaluate('(()=>{const rows=homeScroll.querySelectorAll(".hub-plan-row"),b=homeScroll.getBoundingClientRect();return rows.length===1&&Math.abs(b.bottom-rows[0].getBoundingClientRect().bottom)<1&&homeScroll.scrollTop===0&&homePanel.getBoundingClientRect().height===320})()'),'Removing entries from a scrolled long list retracts the rail to the remaining row');
  await evaluate('plan.remove(plan.draft.entries[0].id);new Promise(r=>setTimeout(r,40))');
  check(await evaluate('!homeScroll.querySelector(".hub-plan-row")&&getComputedStyle(homeScroll).borderLeftColor==="rgba(0, 0, 0, 0)"'),'Removing the final entry leaves no visible empty rail');
  await evaluate('plan.add(railEntries);new Promise(r=>setTimeout(r,40))');
  check(await evaluate('Math.abs(homeScroll.getBoundingClientRect().bottom-homeScroll.querySelector(".hub-plan-row:last-child").getBoundingClientRect().bottom)<1'),'Readded short collection naturally ends at its last row');
  await evaluate('plan.setNote("A fixed planning note");plan.flush();homePanel.style.width="280px";new Promise(r=>setTimeout(r,40))');
  check(await evaluate('Math.abs(homeScroll.getBoundingClientRect().bottom-homeScroll.querySelector(".hub-plan-row:last-child").getBoundingClientRect().bottom)<1&&homePreview.host.firstElementChild.offsetHeight>0'),'Rail follows wrapped content after resizing and showing the fixed note');
  await screenshot('home-rail-short');
  await evaluate('homePreview.dispose();homePreview=mountPreview("home");homePreview.host.style.cssText="min-height:0";homePanel.append(homePreview.host);new Promise(r=>setTimeout(r,40))');
  check(await evaluate('(()=>{const c=homePreview.host.querySelector(".hub-plan-collection");return Math.abs(c.getBoundingClientRect().bottom-c.querySelector(".hub-plan-row:last-child").getBoundingClientRect().bottom)<1})()'),'Reopening Home retains a content-height rail');
  await evaluate('homePreview.dispose();homePanel.remove();true');
  // Mixed item geometry at multiple inherited checkbox sizes and themes.
  await evaluate(`window.savedResolve=plan.references.resolve;const entryFor=fixtureRequire('lib/domain/global-plan.js').entryFor;window.mixedItems=[{entry:entryFor('task',{authorityId:'a',taskId:'t'}),task:{...fixtureTask(),completed:false},label:'Task',availability:'current'},...['Note.md','Image.png','Paper.pdf'].map(path=>({entry:entryFor('file',{path:'Research/'+path,sourceWorkspace:{type:'resource',id:'literature'}}),label:path,availability:'current'})),...['project','resource'].map(type=>({entry:entryFor('workspace',{type,id:type==='project'?'p':'literature'}),label:type==='project'?'Project':'Resource',availability:'current',context:{icon:type==='project'?'folder':'library'}}))];plan.references.resolve=async()=>mixedItems;openEditor();window.mixedHome=mountPreview('home');mixedHome.host.style.cssText='position:fixed;left:0;top:0;width:350px;height:340px;background:var(--background-secondary)';new Promise(r=>setTimeout(r,40))`);
  for(const size of [16,20])for(const theme of ['dark','light']){
   await evaluate(`document.body.style.setProperty('--font-preferred-size','${size}px');document.body.classList.remove('theme-dark','theme-light');document.body.classList.add('theme-${theme}');new Promise(r=>setTimeout(r,30))`);
   check(await evaluate(`(()=>{return [mixedHome.host,planEditor.body].every(root=>{const rows=[...root.querySelectorAll('.hub-plan-row')],columns=rows.map(r=>r.querySelector('.hub-plan-title').getBoundingClientRect().left-r.getBoundingClientRect().left);return rows.length===6&&Math.max(...columns)-Math.min(...columns)<1&&rows.every(row=>row.querySelector('.hub-plan-leading').getBoundingClientRect().width===${size})&&root.querySelector('input[type=checkbox]').getBoundingClientRect().width===${size}&&root.scrollWidth<=root.clientWidth})})()`),'Mixed task/file/workspace slots align without overflow at '+size+'px in '+theme);
  }
  await evaluate(`for(const root of [mixedHome.host,planEditor.body]){root.style.lineHeight='1.8';root.querySelectorAll('.hub-plan-row')[1].querySelector('.hub-plan-title').textContent='A long planned note title that wraps across multiple lines with metadata below '.repeat(3);}true`);
  check(await evaluate(`(()=>{return [mixedHome.host,planEditor.body].every(root=>[...root.querySelectorAll('.hub-plan-row')].every(row=>{const title=row.querySelector('.hub-plan-title'),slot=row.querySelector('.hub-plan-leading'),b=slot.getBoundingClientRect();return Math.abs(b.top+b.height/2-title.getBoundingClientRect().top-nativeLeadingCenter())<.1}))})()`),'Wrapped file and workspace titles retain the native Tasks top inset');
  await evaluate(`document.body.style.removeProperty('--font-preferred-size');for(const root of [mixedHome.host,planEditor.body])for(const slot of root.querySelectorAll('.hub-plan-icon')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',slot.dataset.icon==='folder'?'M3 7h6l2-3h9v16H3z':'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h8');svg.append(path);slot.append(svg);}planEditor.containerEl.style.visibility='hidden';true`);
  await screenshot('mixed-leading-home');await evaluate("planEditor.containerEl.style.visibility='';mixedHome.host.style.visibility='hidden';true");await screenshot('mixed-leading-editor');
  await evaluate("mixedHome.dispose();nativeAlignmentHost.remove();planEditor.close();plan.references.resolve=savedResolve;true");
  // Stable editor shell: note/header/footer never join the collection scroller.
  await evaluate(`window.layoutResolve=plan.references.resolve;window.layoutCount=0;plan.references.resolve=async()=>Array.from({length:layoutCount},(_,i)=>({entry:{id:'layout-'+i,kind:'file',reference:{path:'Research/Note-'+i+'.md',sourceWorkspace:{type:'resource',id:'literature'}}},label:'Planned note '+i,availability:'current'}));openEditor();true`);
  for(const viewport of [{width:760,height:900},{width:380,height:485}])for(const scale of [16,20]){
   await call('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
   await evaluate(`document.documentElement.style.fontSize='${scale}px';true`);
   let fixedHeight;
   for(const count of [0,1,2,4,10,30]){
    await evaluate(`layoutCount=${count};plan.emit();planEditor.scroller.scrollTop=0;new Promise(r=>setTimeout(r,30))`);
    const geometry=await evaluate(`(()=>{const m=planEditor.modalEl.getBoundingClientRect(),s=planEditor.scroller,n=planEditor.note.getBoundingClientRect(),f=planEditor.footer.getBoundingClientRect();return {height:m.height,bounded:m.top>=0&&m.bottom<=innerHeight&&m.left>=0&&m.right<=innerWidth,note:n.top>=m.top&&n.bottom<=s.getBoundingClientRect().top,footer:f.top>=s.getBoundingClientRect().bottom&&f.bottom<=m.bottom,overflow:s.scrollHeight>s.clientHeight,outer:planEditor.body.scrollHeight<=planEditor.body.clientHeight+1&&planEditor.contentEl.scrollHeight<=planEditor.contentEl.clientHeight+1}})()`);
    fixedHeight??=geometry.height;
    if(count===0)check(await evaluate(`planEditor.scroller.textContent.includes('Add at least one item to save this plan.')&&getComputedStyle(planEditor.scroller.querySelector('.hub-plan-collection')).borderLeftWidth==='0px'&&planEditor.status.hidden&&planEditor.footer.children.length===1`),'Empty editor guidance replaces rail and footer has only Done');
    if(count===4&&viewport.width===760&&scale===16){check(await evaluate(`(()=>{const s=planEditor.scroller.getBoundingClientRect(),c=planEditor.scroller.querySelector('.hub-plan-collection').getBoundingClientRect();return s.height>=c.height-1&&s.height-c.height<8})()`),'Four ordinary rows fit without unused collection space');await screenshot('plan-four-items-fixed');};
    check(Math.abs(geometry.height-fixedHeight)<1&&geometry.height<=Math.min(554,viewport.height-48)&&geometry.bounded&&geometry.note&&geometry.footer&&geometry.outer,'Fixed-height bounded editor shell for '+count+' entries at '+viewport.width+'px / '+scale+'px scale');
    if(count===30)check(geometry.overflow,'Long plan owns vertical overflow');
    await evaluate(`window.fixedNoteTop=planEditor.note.getBoundingClientRect().top;window.fixedFooterTop=planEditor.footer.getBoundingClientRect().top;planEditor.scroller.scrollTop=planEditor.scroller.scrollHeight;true`);
    check(await evaluate(`(()=>{const s=planEditor.scroller.getBoundingClientRect(),a=planEditor.addButton.getBoundingClientRect(),c=planEditor.body.querySelector('.hub-plan-collection'),last=c.querySelector('.hub-plan-row:last-child');return a.top>=s.bottom&&a.bottom<=planEditor.footer.getBoundingClientRect().top&&planEditor.note.getBoundingClientRect().top===fixedNoteTop&&planEditor.footer.getBoundingClientRect().top===fixedFooterTop&&(!last||Math.abs(c.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom)<1)})()`),'Add remains reachable, fixed regions stay put, and rail follows content');
   }
  }
  await evaluate(`planEditor.scroller.scrollTop=0;true`);
  const dragStart=await point('planEditor.scroller.querySelector("[data-plan-control=grip]")');
  await move(dragStart.x,dragStart.y);await call('Input.dispatchMouseEvent',{type:'mousePressed',...dragStart,button:'left',clickCount:1});
  const dragEdge=await evaluate(`(()=>{const b=planEditor.scroller.getBoundingClientRect();return {x:b.left+b.width/2,y:b.bottom-4}})()`);
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',...dragEdge,button:'left',buttons:1});
  await evaluate('new Promise(r=>setTimeout(r,180))');
  check(await evaluate('planEditor.scroller.scrollTop>0&&planEditor.body.scrollTop===0'),'Pointer reorder auto-scrolls the collection without moving the fixed note');
  await key('Escape',27);await call('Input.dispatchMouseEvent',{type:'mouseReleased',...dragEdge,button:'left',clickCount:1});
  await screenshot('plan-stable-small');
  await evaluate(`document.documentElement.style.removeProperty('font-size');planEditor.close();plan.references.resolve=layoutResolve;true`);
  await call('Emulation.setDeviceMetricsOverride',{width:760,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`window.taskHeightResolve=plan.references.resolve;plan.references.resolve=async()=>Array.from({length:4},(_,i)=>({entry:{id:'ordinary-'+i,kind:'task',reference:{authorityId:'a',taskId:'ordinary-'+i}},label:'Ordinary task '+i,availability:'current',task:{...fixtureTask(),text:'Ordinary task '+i}}));openEditor();new Promise(r=>setTimeout(r,40))`);
  check(await evaluate(`(()=>{const s=planEditor.scroller,c=s.querySelector('.hub-plan-collection');return s.clientHeight>=c.getBoundingClientRect().height&&s.clientHeight-c.getBoundingClientRect().height<=9})()`),'Four native task rows fit with only conventional trailing space');
  await screenshot('plan-four-native-tasks');
  await evaluate(`planEditor.close();plan.references.resolve=taskHeightResolve;true`);
  await call('Emulation.setDeviceMetricsOverride',{width:760,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`window.lifecycleHeader=document.body.createDiv({cls:'home-panel-title'});lifecycleHeader.createEl('button',{text:'Edit'});window.lifecycleComponent=new(fixtureRequire('obsidian').Component)();window.lifecycleRoot=document.body.createDiv({cls:'hub-button-scope home-focus-body'});lifecycleRoot.style.cssText='position:fixed;left:0;top:0;width:420px;height:320px;background:var(--background-secondary)';fixtureRequire('lib/ui/plan-home.js').mountPlanHome({root:lifecycleRoot,component:lifecycleComponent,plugin:planPlugin});openEditor();new Promise(r=>setTimeout(r,40))`);
  check(await evaluate(`lifecycleRoot.querySelector('.hub-plan-finish')&&lifecycleRoot.querySelector('.hub-plan-note-caption').textContent==='Today'`),'Active Home shows fixed Finish and Today');check(await evaluate(`lifecycleHeader.querySelector('button').textContent==='Edit'&&!lifecycleRoot.textContent.includes('Earlier plans')`),'Active header keeps Edit without history');
  check(await evaluate(`Math.abs(lifecycleRoot.querySelector('.hub-plan-home-footer').getBoundingClientRect().bottom-lifecycleRoot.getBoundingClientRect().bottom)<1`),'Home Finish footer stays at the panel bottom for a short collection');
  check(await evaluate(`(()=>{const f=lifecycleRoot.querySelector('.hub-plan-home-footer'),b=f.querySelector('button'),r=f.getBoundingClientRect(),q=b.getBoundingClientRect(),c=getComputedStyle(b);window.footerHeight=r.height;return c.backgroundColor==='rgba(0, 0, 0, 0)'&&c.borderTopWidth==='0px'&&q.width<r.width&&Math.abs(q.x+q.width/2-r.x-r.width/2)<1&&getComputedStyle(f).borderTopWidth==='1px'})()`),'Finish footer has one separator and a compact transparent centered target');

  for(const text of ['Short intention','First intention line\nSecond intention line']){
   await evaluate(`plan.setNote(${JSON.stringify(text)});plan.flush();new Promise(r=>setTimeout(r,40))`);
   await evaluate(`window.noteBefore=lifecycleRoot.querySelector('.hub-plan-note-excerpt').getBoundingClientRect().toJSON();window.captionBefore=lifecycleRoot.querySelector('.hub-plan-note-caption').getBoundingClientRect().toJSON();window.collectionBefore=lifecycleRoot.querySelector('.hub-plan-collection').getBoundingClientRect().top;plan.setNote('');plan.flush();new Promise(r=>setTimeout(r,40))`);
   check(await evaluate(`(()=>{const n=lifecycleRoot.querySelector('.hub-plan-note-excerpt'),c=n.querySelector('.hub-plan-note-caption'),r=n.getBoundingClientRect(),s=getComputedStyle(n);return !n.hidden&&n.querySelector('.hub-plan-note-text').textContent===''&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.borderTopColor!=='rgba(0, 0, 0, 0)'&&s.borderTopWidth==='1px'&&Math.abs(r.height-noteBefore.height)<1&&Math.abs(c.getBoundingClientRect().top-captionBefore.top)<1&&c.getBoundingClientRect().left===captionBefore.left&&Math.abs(lifecycleRoot.querySelector('.hub-plan-collection').getBoundingClientRect().top-collectionBefore)<1})()`),'Clearing '+(text.includes('\n')?'multiline':'short')+' note keeps its geometry and Today label with permanent frame and blank text');
  }
  await evaluate(`planEditor.containerEl.style.visibility='hidden';document.activeElement?.blur();true`);await move(740,850);
  check(await evaluate(`(()=>{const b=lifecycleRoot.querySelector('.hub-plan-finish'),p=document.createElement('span');p.style.color='var(--text-muted)';lifecycleRoot.append(p);const expected=getComputedStyle(p).color;p.remove();return getComputedStyle(b).color===expected&&getComputedStyle(b.querySelector('.hub-capture-icon')).color===expected})()`),'Finish icon and text use muted foreground at rest');
  await hover('lifecycleRoot.querySelector(".hub-plan-finish")');await evaluate('new Promise(r=>setTimeout(r,160))');
  check(await evaluate(`(()=>{const b=lifecycleRoot.querySelector('.hub-plan-finish'),p=document.createElement('span');p.style.color='var(--text-normal)';lifecycleRoot.append(p);const expected=getComputedStyle(p).color;p.remove();return getComputedStyle(b).color===expected&&getComputedStyle(b.querySelector('.hub-capture-icon')).color===expected&&b.querySelector('.hub-capture-icon').dataset.icon==='circle-check'})()`),'Finish icon and text brighten together on hover');
  await evaluate(`planEditor.containerEl.style.visibility='';true`);
  await evaluate(`planEditor.containerEl.style.visibility='hidden';true`);await screenshot('lifecycle-home-active');await evaluate(`planEditor.containerEl.style.visibility='';true`);
  check(await evaluate(`![...planEditor.contentEl.querySelectorAll('.hub-plan-footer button')].some(b=>['Undo','Finish plan','New plan'].includes(b.textContent))`),'Editor footer contains only Done');
  await evaluate(`planEditor.containerEl.style.visibility='hidden';true`);await click('lifecycleRoot.querySelector(".hub-plan-finish")');
  check(await evaluate(`planPlugin.planFinishConfirmation.contentEl.textContent.includes('Unfinished tasks will remain unchanged')&&document.activeElement.textContent==='Keep working'`),'Shared Finish confirmation explains semantics and focuses Keep working');
  await key('Escape',27);await evaluate('new Promise(r=>setTimeout(r,30))');
  check(await evaluate(`!!plan.active()&&!planPlugin.planFinishConfirmation`),'Escape cancels Finish without lifecycle mutation');await evaluate(`planEditor.containerEl.style.visibility='';true`);
  await evaluate(`window.finishingId=plan.active().id;window.frozenNote=plan.draft.note;window.failSave=true;plan.finishPlan(finishingId).catch(()=>{});new Promise(r=>setTimeout(r,40))`);
  check(await evaluate(`!!plan.pendingTransition&&plan.readPlan(finishingId).status==='active'&&!!lifecycleRoot.querySelector('.hub-plan-finish')`),'Failed durable Finish preserves active presentation and retryable transition');
  await evaluate(`window.failSave=false;plan.ensureLifecycle();new Promise(r=>setTimeout(r,50))`);
  check(await evaluate(`!plan.active()&&plan.readPlan(finishingId).status==='finished'&&plan.readPlan(finishingId).snapshot.note===frozenNote&&!planEditor.note&&!planEditor.body.querySelector('input[type=checkbox]')`),'Retry durably freezes content and changes editor to read-only');
  check(await evaluate(`lifecycleRoot.textContent.includes('Hide')&&!lifecycleRoot.textContent.includes('Earlier plans')&&lifecycleRoot.textContent.includes('Finished')&&!lifecycleRoot.querySelector('.hub-plan-collection button,.hub-plan-collection input')`),'Just-finished Home retains a non-interactive collection with Hide');check(await evaluate(`lifecycleHeader.querySelector('button').textContent==='Plan'&&lifecycleHeader.querySelector('.hub-task-add-icon').dataset.icon==='plus'&&lifecycleHeader.querySelector('button').classList.contains('hub-panel-add')&&(()=>{const a=lifecycleRoot.querySelector('.hub-plan-home-footer').getBoundingClientRect(),b=lifecycleRoot.querySelector('.hub-plan-finished-status').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<1})()`),'Finished status centers against the whole rectangle and header offers + Plan');
  check(await evaluate(`lifecycleRoot.querySelector('.hub-plan-note-excerpt').classList.contains('is-empty-note')&&lifecycleRoot.querySelector('.hub-plan-note-text').textContent===''&&lifecycleRoot.querySelector('.hub-plan-note-caption').textContent==='Today'`),'Just-finished empty note keeps Today and its rectangle without a placeholder');
  await evaluate('planEditor.close();new Promise(r=>setTimeout(r,30))');await screenshot('lifecycle-home-finished');
  check(await evaluate(`Math.abs(lifecycleRoot.querySelector('.hub-plan-home-footer').getBoundingClientRect().height-footerHeight)<1`),'Finished footer matches active footer height');

  await click(`[...lifecycleRoot.querySelectorAll('button')].find(b=>b.textContent==='Hide')`);
  check(await evaluate(`lifecycleRoot.textContent.includes('No active plan for today')&&plan.listHistorical().some(p=>p.id===finishingId)`),'Dismiss hides presentation without deleting history');
  await evaluate(`window.disclosure=lifecycleRoot.querySelector('.hub-task-group-toggle');window.chevronX=disclosure.querySelector('.hub-task-group-chevron').getBoundingClientRect().x;window.disclosureWidth=disclosure.getBoundingClientRect().width;true`);
  await click('lifecycleRoot.querySelector(".hub-task-group-toggle")');
  check(await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-row').textContent.includes('planned items')&&!lifecycleRoot.textContent.includes('Back')&&lifecycleRoot.querySelector('.hub-task-group-toggle').getAttribute('aria-expanded')==='true'`),'Earlier plans expands inline above a fixed disclosure');
  check(await evaluate(`(()=>{const f=lifecycleRoot.querySelector('.hub-plan-home-footer').getBoundingClientRect(),b=lifecycleRoot.querySelector('.hub-task-group-toggle').getBoundingClientRect();return Math.abs(f.height-footerHeight)<1&&b.width<f.width&&Math.abs(f.x+f.width/2-b.x-b.width/2)<1})()`),'History disclosure shares footer height and centered compact target');
  check(await evaluate(`disclosure===lifecycleRoot.querySelector('.hub-task-group-toggle')&&disclosure.matches(':hover')&&getComputedStyle(disclosure).backgroundColor!=='rgba(0, 0, 0, 0)'&&disclosure.querySelector('.hub-task-group-chevron').getBoundingClientRect().x===chevronX&&disclosure.getBoundingClientRect().width===disclosureWidth`),'Expansion preserves hovered disclosure identity, background, width and chevron position');
  await evaluate(`plan.emit();true`);check(await evaluate(`disclosure===lifecycleRoot.querySelector('.hub-task-group-toggle')&&disclosure.matches(':hover')`),'Service rerender retains the hovered footer control');
  await screenshot('lifecycle-home-history');
  await click('lifecycleRoot.querySelector(".hub-plan-history-row")');
  await evaluate('new Promise(r=>setTimeout(r,40))');
  check(await evaluate(`!planPlugin.planModal&&lifecycleRoot.querySelector('.hub-plan-history-row').getAttribute('aria-expanded')==='true'&&lifecycleRoot.querySelectorAll('.hub-plan-history-content:not([hidden])').length===1`),'History expands one Plan inline without a modal');
  check(await evaluate(`!lifecycleRoot.querySelector('.hub-plan-history-content input,.hub-plan-history-content [data-plan-control]')&&getComputedStyle(lifecycleRoot.querySelector('.hub-plan-history-row')).borderTopWidth==='0px'`),'History uses borderless summaries and read-only item controls');
  await screenshot('lifecycle-history-expanded');
  await key('Enter',13);check(await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-row').getAttribute('aria-expanded')==='false'`),'Enter collapses focused summary');
  await key(' ',32);await evaluate('new Promise(r=>setTimeout(r,30))');check(await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-row').getAttribute('aria-expanded')==='true'`),'Space expands focused summary');
  await click('lifecycleRoot.querySelector(".hub-task-group-toggle")');check(await evaluate(`lifecycleRoot.textContent.includes('No active plan for today')&&lifecycleRoot.textContent.includes('Show earlier plans')`),'Hide restores empty state and Show label');
  check(await evaluate(`disclosure===lifecycleRoot.querySelector('.hub-task-group-toggle')&&disclosure.matches(':hover')&&disclosure.getBoundingClientRect().width===disclosureWidth&&disclosure.querySelector('.hub-task-group-chevron').getBoundingClientRect().x===chevronX`),'Collapse preserves the same hovered control and fixed chevron position');
  await click('lifecycleRoot.querySelector(".hub-task-group-toggle")');check(await evaluate(`lifecycleRoot.textContent.includes('Hide earlier plans')&&lifecycleRoot.querySelector('.hub-plan-history-row').getAttribute('aria-expanded')==='true'`),'Show restores the expanded Plan');


  await evaluate(`window.historyOriginal=JSON.parse(JSON.stringify(plan.state));for(let i=0;i<65;i++){const p=JSON.parse(JSON.stringify(plan.readPlan(finishingId)));p.id='history-test-'+i;p.endedAt=new Date(Date.parse(p.endedAt)-(i+1)*60000).toISOString();p.snapshot={note:'',entries:[]};p.navigation=[];plan.state.plansById[p.id]=p;}plan.emit();true`);

  await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-list').scrollTop=0;new Promise(r=>setTimeout(r,40))`);
  for(const target of ['.hub-plan-history-row','.hub-plan-history-note','.hub-plan-history-status > span:first-child','.hub-plan-history-content:not([hidden]) .hub-plan-row','.hub-plan-history-content:not([hidden]) .hub-plan-title','.hub-plan-history-content:not([hidden]) .hub-plan-metadata']){
   await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-list').scrollTop=0;new Promise(r=>setTimeout(r,20))`);
   const p=await point(`lifecycleRoot.querySelector(${JSON.stringify(target)})`);await move(p.x,p.y);await call('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:70});await evaluate('new Promise(r=>setTimeout(r,80))');
   check(await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-list').scrollTop>0&&[...lifecycleRoot.querySelectorAll('.hub-plan-history-content,.hub-plan-history-content .hub-plan-collection')].every(e=>e.scrollTop===0&&getComputedStyle(e).overflowY==='visible')`),'Wheel over '+target+' scrolls only outer history');
  }
  await evaluate(`lifecycleRoot.querySelector('.hub-plan-history-list').scrollTop=0;true`);
  await click('lifecycleRoot.querySelectorAll(".hub-plan-history-row")[1]');
  check(await evaluate(`lifecycleRoot.querySelectorAll('.hub-plan-history-content:not([hidden])').length===1&&lifecycleRoot.querySelectorAll('.hub-plan-history-row')[0].getAttribute('aria-expanded')==='false'&&!lifecycleRoot.querySelector('.hub-plan-history-content:not([hidden])').textContent`),'Expanding an empty record closes the prior Plan without a placeholder or rail');
  await evaluate(`window.historyScroll=lifecycleRoot.querySelector('.hub-plan-history-list');historyScroll.scrollTop=historyScroll.scrollHeight;historyScroll.dispatchEvent(new Event('scroll'));true`);
  check(await evaluate(`lifecycleRoot.querySelectorAll('.hub-plan-history-row').length===66`),'Long history paginates within the single scroller');
  await evaluate(`plan.emit();true`);check(await evaluate(`lifecycleRoot.querySelectorAll('.hub-plan-history-row').length===66&&lifecycleRoot.querySelectorAll('.hub-plan-history-row')[1].getAttribute('aria-expanded')==='true'`),'Service rerender preserves loaded page depth and single expansion');
  await evaluate(`plan.state=historyOriginal;plan.emit();true`);
  await evaluate(`(async()=>{window.nextId=await plan.createPlan();window.planEditor=fixtureRequire('lib/ui/plan.js').openPlan(planPlugin,nextId);return true})()`);
  check(await evaluate(`nextId!==finishingId&&plan.listHistorical().some(p=>p.id===finishingId)&&plan.active().id===nextId`),'New Plan is sequential and preserves earlier history');
  await evaluate(`window.realPlanClock=plan.now;plan.now=()=>new Date(plan.state.plansById[nextId].endsAt);plan.ensureLifecycle();new Promise(r=>setTimeout(r,40))`);
  check(await evaluate(`!plan.active()&&!plan.readPlan(nextId)`),'Untouched empty Plan rolls over without history');
  await evaluate(`(async()=>{plan.now=realPlanClock;window.noteOnlyId=await plan.createPlan();plan.setNote('Note-only lifecycle record');await plan.flush();plan.now=()=>new Date(plan.state.plansById[noteOnlyId].endsAt);await plan.ensureLifecycle();return true})()`);
  check(await evaluate(`plan.readPlan(noteOnlyId).status==='day-ended'&&plan.readPlan(noteOnlyId).snapshot.note==='Note-only lifecycle record'`),'Note-only Plan is retained as day-ended');
  await evaluate(`plan.now=realPlanClock;lifecycleComponent.unload();lifecycleRoot.remove();lifecycleHeader.remove();planEditor.close();true`);
  await evaluate('new Promise(r=>setTimeout(r,40))');
  check(await evaluate('fixtureKeymap.scope===fixtureRootScope&&!document.querySelector(".modal-container")'),'Lifecycle dialogs leave no stale native Modal scope or invisible overlay');

  for(const route of ['Done','X','Escape']){
   await evaluate(`(async()=>{window.emptyCloseId=await plan.createPlan();openEditor();planEditor.note.value='Preserved until abandonment commits';planEditor.note.oninput();await plan.flush();return true})()`);
   if(route==='Escape')await key('Escape',27);else await click(route==='X'?'planEditor.modalEl.querySelector(".modal-header-button")':'[...planEditor.contentEl.querySelectorAll(".hub-plan-footer button")].find(b=>b.textContent==="Done")');
   await evaluate('new Promise(r=>setTimeout(r,40))');
   check(await evaluate(`!plan.active()&&!plan.readPlan(emptyCloseId)&&!planPlugin.planModal`),route+' abandons a zero-item note-only Plan without history');
  }
  await evaluate(`(async()=>{window.emptyCloseId=await plan.createPlan();openEditor();planEditor.note.value='Retain after failed close';planEditor.note.oninput();await plan.flush();window.failSave=true;planEditor.close();return new Promise(r=>setTimeout(r,40))})()`);
  check(await evaluate(`planEditor.isOpen&&plan.active().content.note==='Retain after failed close'&&plan.pendingTransition.kind==='abandon'`),'Failed abandonment keeps editor and exact note visible');
  await evaluate(`window.failSave=false;planEditor.close();new Promise(r=>setTimeout(r,40))`);
  check(await evaluate(`!plan.active()&&!planPlugin.planModal&&fixtureKeymap.scope===fixtureRootScope`),'Retry commits abandonment and releases native modal ownership');

  await evaluate(`window.coldState=JSON.parse(JSON.stringify(plan.state));window.mountColdHome=()=>{window.coldPanel=document.body.createDiv({cls:'home-glance hub-button-scope'});coldPanel.style.cssText='position:fixed;left:0;top:0;width:420px;height:320px;padding:12px;box-sizing:border-box;background:var(--background-secondary)';const header=coldPanel.createDiv({cls:'home-panel-title',text:'Plan'});header.createEl('button',{text:'+ Plan'});window.coldBody=coldPanel.createDiv({cls:'home-focus-body'});window.coldComponent=new(fixtureRequire('obsidian').Component)();coldComponent.load();fixtureRequire('lib/ui/plan-home.js').mountPlanHome({root:coldBody,component:coldComponent,plugin:planPlugin});};window.coldGeometry=()=>{const panel=coldPanel.getBoundingClientRect(),body=coldBody.getBoundingClientRect(),empty=coldBody.querySelector('.hub-plan-empty').getBoundingClientRect(),footer=coldBody.querySelector('.hub-plan-home-footer').getBoundingClientRect(),header=coldPanel.querySelector('.home-panel-title').getBoundingClientRect();return getComputedStyle(coldPanel).display==='flex'&&Math.abs(body.top-header.bottom)<1&&Math.abs(body.bottom-(panel.bottom-12))<1&&Math.abs(footer.bottom-body.bottom)<1&&empty.height>150&&Math.abs(empty.bottom-footer.top)<1;};mountColdHome();true`);
  check(await evaluate(`!coldBody.classList.contains('hub-plan-presentation')&&coldGeometry()&&coldBody.textContent.includes('Show earlier plans')`),'Cold empty Home with history fills real panel shell before any Plan presentation');
  await screenshot('home-cold-empty');
  await evaluate(`(async()=>{window.coldId=await plan.createPlan();window.planEditor=fixtureRequire('lib/ui/plan.js').openPlan(planPlugin,coldId);planEditor.close();return new Promise(r=>setTimeout(r,40))})()`);
  check(await evaluate(`coldGeometry()&&!plan.active()`),'Creating and abandoning an empty Plan preserves the initial correct geometry');
  for(const width of [320,500])for(const scale of [16,20]){
   await evaluate(`coldComponent.unload();coldPanel.remove();plan.state={...JSON.parse(JSON.stringify(coldState)),plansById:{},activePlanId:null};document.documentElement.style.fontSize='${scale}px';mountColdHome();coldPanel.style.width='${width}px';true`);
   check(await evaluate(`coldGeometry()&&!coldBody.classList.contains('hub-plan-presentation')&&!coldBody.textContent.includes('Show earlier plans')`),'Cold Home without history fills its shell at width '+width+' and scale '+scale);
  }

  await evaluate(`document.documentElement.style.removeProperty('font-size');coldPanel.style.width='420px';window.stableButton=coldPanel.querySelector('.home-panel-title button');window.stableIcon=stableButton.firstElementChild;window.stableSVG=stableIcon.firstElementChild;window.stableLabel=stableButton.lastElementChild;window.stableClasses=stableButton.className;true`);
  for(let round=0;round<3;round++){
   await click('stableButton');await evaluate('new Promise(r=>setTimeout(r,40))');
   check(await evaluate(`planPlugin.planModal?.isOpen&&stableButton.firstElementChild===stableIcon&&stableIcon.firstElementChild===stableSVG&&stableButton.lastElementChild===stableLabel&&stableButton.className===stableClasses&&stableLabel.textContent==='Edit'&&getComputedStyle(stableIcon).display==='none'`),'Creation retains header nodes/classes and hides icon, round '+round);
   await key('Escape',27);await evaluate('new Promise(r=>setTimeout(r,40))');
   check(await evaluate(`!plan.active()&&!planPlugin.planModal&&stableButton.firstElementChild===stableIcon&&stableIcon.firstElementChild===stableSVG&&stableButton.lastElementChild===stableLabel&&stableButton.className===stableClasses&&stableLabel.textContent==='Plan'&&(()=>{const b=stableButton.getBoundingClientRect(),i=stableIcon.getBoundingClientRect(),t=stableLabel.getBoundingClientRect();return Math.abs(i.y+i.height/2-t.y-t.height/2)<1&&t.x>=i.right&&t.bottom<=b.bottom&&i.top>=b.top})()`),'Abandonment preserves horizontal real-SVG header, round '+round);
  }
  await screenshot('stable-header-after-transitions');
  await evaluate(`coldComponent.unload();coldPanel.remove();mountColdHome();window.remounted=coldPanel.querySelector('.home-panel-title button');true`);
  check(await evaluate(`remounted!==stableButton&&remounted.lastElementChild.textContent==='Plan'&&remounted.querySelector('svg')&&getComputedStyle(remounted).flexDirection==='row'`),'Home navigation remount uses the same header construction');
  await evaluate(`coldComponent.unload();coldPanel.remove();plan.state=coldState;document.documentElement.style.removeProperty('font-size');true`);
  console.log('PASS:',checks,'Plan native-modal browser checks. Evidence:',output);
 }finally{clearTimeout(timeout);socket?.close();child.kill();await new Promise(r=>server.close(r))}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1});
