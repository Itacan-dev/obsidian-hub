"use strict";
// Actual editor/checklist modules and native CSS, with an isolated Modal/service
// adapter. CDP supplies trusted pointer, keyboard and touch-capability changes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
async function run(){
 const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-progress-ui-'));
 const built=require('node:child_process').spawnSync(process.execPath,[path.join(root,'build.js'),'--output-dir',output],{encoding:'utf8',windowsHide:true});
 assert.equal(built.status,0,built.stderr||built.stdout);
 // Exercise the actual installed Obsidian Modal lifecycle, including its keyboard scope.
 const archive=fs.openSync(process.env.HUB_TEST_OBSIDIAN_ASAR||path.join(process.env.APPDATA,'obsidian/obsidian-1.15.1.asar'),'r');
 const prefix=Buffer.alloc(16);fs.readSync(archive,prefix,0,16,0);const headerBytes=Buffer.alloc(prefix.readUInt32LE(12));fs.readSync(archive,headerBytes,0,headerBytes.length,16);
 const entry=JSON.parse(headerBytes).files['app.js'],bytes=Buffer.alloc(entry.size);fs.readSync(archive,bytes,0,bytes.length,8+prefix.readUInt32LE(4)+Number(entry.offset));fs.closeSync(archive);
 const application=bytes.toString(),modalStart=application.indexOf('var ei=class{'),modalEnd=application.indexOf(',Sk=class',modalStart);
 assert(modalStart>=0&&modalEnd>modalStart,'Installed Modal extraction must match the inspected host');
 const nativeModal='return '+application.slice(modalStart+'var ei='.length,modalEnd)+';';
 const native=process.env.HUB_TEST_NATIVE_CSS||path.join(os.tmpdir(),'itacan-native-app.css');
 assert(fs.existsSync(native),'Supply native Obsidian CSS through HUB_TEST_NATIVE_CSS');
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=name==='/native.css'?native:name==='/main.js'?path.join(output,'main.js'):path.resolve(root,'.'+name);if(file!==native&&name!=='/main.js'&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}if(name==='/native-modal.js'){res.setHeader('Content-Type','text/javascript');res.end(nativeModal);return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');let content=fs.readFileSync(file);if(name==='/main.js'&&process.env.HUB_TEST_REINTRODUCE_SCOPE_COLLISION==='1')content=content.toString().replace('reportScope: scope,','scope,').replaceAll('this.reportScope','this.scope');res.end(content)}catch{res.writeHead(404).end()}});
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
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/lib/tests/progress-editor.html'});
  for(let i=0;i<200&&!await evaluate('window.testDone');i++)await new Promise(r=>setTimeout(r,25));
  check(await evaluate('window.testDone&&!window.testError'),await evaluate('window.testError')||'Browser initialized');
  const footerWidths = 'Math.max(...[...editor.footer.children].map(b=>b.getBoundingClientRect().width))-Math.min(...[...editor.footer.children].map(b=>b.getBoundingClientRect().width))<.1';
  check(await evaluate(footerWidths), 'Cancel and Save progress use the same width');
  const separators = `(() => {
   const rect = el => el.getBoundingClientRect(), near = (a,b) => Math.abs(a-b) < .1;
   const frame = rect(editor.contentEl), body = editor.contentEl.querySelector('.hub-modal-body');
   const [headerLine, footerLine] = editor.contentEl.querySelectorAll('.hub-modal-separator');
   if (!headerLine || !footerLine) return false;
   const header = rect(headerLine), footer = rect(footerLine);
   return [header,footer].every(line=>near(line.left,frame.left)&&near(line.right,frame.right)&&near(line.height,1)) &&
    near(header.top-rect(headerLine.previousElementSibling).bottom,16) && near(rect(body).top-header.bottom,16) &&
    near(footer.top-rect(body).bottom,16) && near(rect(editor.footer).top-footer.bottom,16) && rect(editor.footer).width<frame.width;
  })()`;
  check(await evaluate(separators), 'Manual report dividers span the window independently of the buttons');
  check(await evaluate('editor.rows.get("p").input.getBoundingClientRect().height>0'),'Reflection visible without another click');
  check(await evaluate('!editor.contentEl.querySelector(".hub-report-recorded-work").open'),'Evidence collapsed');
  check(await evaluate('!editor.contentEl.querySelector(".hub-progress-focus")'),'Current Plan is absent');
  await click('editor.rows.get("p").buttons[0]');
  check(await evaluate('editor.rows.get("p").input.value==="Keep this reflection"'),'Zero preserves reflection');
  await click('editor.saveButton');
  check(await evaluate('(snapshot().projectWorkRatings.p[editor.date]??null)===0&&closeCount()===0'),'Manual save persists zero without closing application');
  await evaluate('openReport();editor.addRow({projectId:"q",name:"Project B",contextKind:"project"});editor.rows.get("q").buttons[3].click();editor.rows.get("p").card.open=false');
  await click('editor.saveButton');
  check(await evaluate('snapshot().projectWorkLogs.p[editor.date].summary==="Keep this reflection"'),'Untouched collapsed comment survives another workspace save');
  await evaluate('openReport(true);editor.rows.get("p").buttons[1].click();window.failSave=true');await click('editor.saveButton');
  check(await evaluate('!editor.saving&&editor.rows.get("p").rating===1&&closeCount()===0&&editor.error.textContent.includes("failure")'),'Failed save retains draft and keeps app open');
  await evaluate('window.failSave=false');await click('editor.saveButton');check(await evaluate('closeCount()===1'),'Successful closing save closes once');
  await evaluate('openReport(true)');check(await evaluate(footerWidths), 'All three close-report actions use the same width');check(await evaluate(separators), 'Close-report dividers keep the same width and spacing');await click('[...editor.footer.querySelectorAll("button")].find(b=>b.textContent==="Skip report")');check(await evaluate('closeCount()===2'),'Skip closes once without requiring ratings');
  await evaluate('editor?.close()');
  await click('document.querySelector(".hub-log-progress-button")');await evaluate('window.editor=reportPlugin.progressEditor;true');
  check(await evaluate('editor.isOpen&&editor.modalEl.getClientRects().length>0&&nativeKeymap.scope===editor.scope&&typeof editor.scope.register==="function"'),'Real Log progress button opens visible modal with native keyboard scope intact');
  await evaluate('document.querySelector(".hub-log-progress-button").click()');
  check(await evaluate('document.querySelectorAll(".modal-container").length===1&&reportPlugin.progressEditor===editor'),'Repeated clicks reuse one modal');
  await key('Escape',27);
  check(await evaluate('!reportPlugin.progressEditor&&!document.querySelector(".modal-container")'),'Native Escape clears report ownership and overlay');
  await evaluate('controllerOpen()');await click('[...reportPlugin.progressEditor.footer.querySelectorAll("button")].find(b=>b.textContent==="Cancel")');
  check(await evaluate('!reportPlugin.progressEditor'),'Manual Cancel clears ownership');
  await evaluate('controllerOpen()');await click('reportPlugin.progressEditor.modalEl.querySelector(".modal-header-button")');
  check(await evaluate('!reportPlugin.progressEditor&&!document.querySelector(".modal-container")'),'Native modal X closes cleanly');
  const countBefore=await evaluate('closeCount()');
  await evaluate('reportPlugin.reportEligibility.pending=()=>[];window.keymapBeforeFailure=nativeKeymap.scope;injectOpenFailure()');
  check(await evaluate('!reportPlugin.progressEditor&&!reportPlugin.hubAdvancementPromptOpen&&!document.querySelector(".modal-container")&&nativeKeymap.scope===keymapBeforeFailure&&notices.length>0'),'Rendering failure removes modal, restores native keymap, clears flags and reports error');
  await evaluate('reportPlugin.openProjectAdvancementPrompt({})');
  check(await evaluate('closeCount()')===countBefore+1,'Application X proceeds after failed manual opening');
  await evaluate('controllerOpen({scope:{kind:"project",id:"p"}})');
  check(await evaluate('reportPlugin.progressEditor.scope===nativeKeymap.scope&&reportPlugin.progressEditor.reportScope.id==="p"'),'Workspace-scoped History editor preserves native keyboard scope');
  await evaluate('reportPlugin.progressEditor.close();controllerOpen();reportPlugin.progressEditor.containerEl.style.display="none"');
  await evaluate('reportPlugin.openProjectAdvancementPrompt({})');
  check(await evaluate('!reportPlugin.progressEditor&&!document.querySelector(".modal-container")&&closeCount()')===countBefore+2,'Invisible stale report cannot trap application close');
  await evaluate('controllerOpen()');
  check(await evaluate('!!reportPlugin.progressEditor&&reportPlugin.progressEditor.isOpen'),'Opening works again after failure and stale-modal recovery');
  await evaluate('reportPlugin.progressEditor.close();window.invalidLegacyFocus=true;window.focusReads=0;controllerOpen();window.editor=reportPlugin.progressEditor;true');
  check(await evaluate('focusReads===0'),'Opening does not validate untouched legacy Next Focus');
  check(await evaluate('!editor.contentEl.querySelector(".hub-progress-focus")&&!editor.focus'),'Report omits obsolete Focus and Plan controls');
  check(await evaluate('editor.contentEl.textContent.includes("Reflect on your progress.")'),'Report uses the shared subtitle');
  await evaluate('(()=>{const row=editor.rows.get("p");const option=row.buttons.find(button=>Number(button.dataset.score)!==row.rating);option.click();option.click();return true})()');
  check(await evaluate('editor.rows.get("p").rating===null'),'Clicking the selected rating clears it');
  await click('editor.saveButton');
  check(await evaluate('!reportPlugin.progressEditor&&focusReads===0'),'Saving does not validate or submit Focus');

  await evaluate('reportPlugin.reportEligibility.pending=()=>["p","resource:study"]');
  for(const id of ['p','resource:study']) for(const mode of ['manual','closing','historical']) {
   const date=mode==='historical'?'2020-01-02':await evaluate('editor.date');
   const options={date,scope:id,...(mode==='closing'?{closeButton:{}}:{})};
   await evaluate(`reportPlugin.progressEditor?.close();controllerOpen(${JSON.stringify(options)});window.editor=reportPlugin.progressEditor;true`);
   await click(`editor.rows.get(${JSON.stringify(id)}).buttons[2]`);
   const draft='Preserved '+id+' '+mode+' draft';
   await evaluate(`(()=>{const input=editor.rows.get(${JSON.stringify(id)}).input;input.value=${JSON.stringify(draft)};input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
   await click(`editor.rows.get(${JSON.stringify(id)}).buttons[0]`);
   check(await evaluate(`(()=>{const row=editor.rows.get(${JSON.stringify(id)});return row.input.disabled&&row.input.getBoundingClientRect().height>0&&!row.noWorkHelp.hidden&&Number(getComputedStyle(row.input).opacity)<1&&row.input.value===${JSON.stringify(draft)}})()`),id+' '+mode+' zero keeps a visible muted disabled reflection and its draft');
   for(const score of [1,2,3,4]) {
    await click(`editor.rows.get(${JSON.stringify(id)}).buttons[${score}]`);
    check(await evaluate(`(()=>{const row=editor.rows.get(${JSON.stringify(id)});return !row.input.disabled&&row.noWorkHelp.hidden&&row.input.value===${JSON.stringify(draft)}})()`),id+' '+mode+' '+score+' restores original draft editing');
    await click(`editor.rows.get(${JSON.stringify(id)}).buttons[0]`);
   }
   await click('editor.saveButton');
   await evaluate(`controllerOpen(${JSON.stringify({date,scope:id})});window.editor=reportPlugin.progressEditor;true`);
   check(await evaluate(`(()=>{const row=editor.rows.get(${JSON.stringify(id)});return row.rating===0&&row.input.disabled&&row.input.value===${JSON.stringify(draft)}&&!row.noWorkHelp.hidden})()`),id+' '+mode+' saved zero reopens with preserved inactive reflection');
   await click(`editor.rows.get(${JSON.stringify(id)}).buttons[3]`);
   check(await evaluate(`!editor.rows.get(${JSON.stringify(id)}).input.disabled&&editor.rows.get(${JSON.stringify(id)}).input.value===${JSON.stringify(draft)}`),id+' '+mode+' reopened zero restores editing at 3');
  }
  await evaluate(`(()=>{
   reportPlugin.progressEditor?.close();const w=reportPlugin.projectWizard,e=reportPlugin.reportEligibility;
   window.suggestionBackup={reports:w.getProgressReports,evidence:w.taskProgressEvidence,activity:w.activityLog,oaths:w.data.oathsByDevice,pending:e.pending,current:reportPlugin.workspaceModes.currentContext,qName:w.getProjectById('q').name};
   w.getProjectById('q').name='Itacan';
   const date=editor.date,timestamp=Date.now();
   w.getProgressReports=()=>[{projectId:'p',date},{projectId:'q',date}];
   w.activityLog=[{projectId:'q',action:'edited',title:'Earlier-session edit',path:'earlier.md',timestamp}];
   w.taskProgressEvidence=()=>({availability:'current',records:[{id:'earlier-task',projectId:'resource:study',text:'Earlier study',kind:'task',timestamp},{id:'day-task',projectId:'p',text:'Whole-day evidence',kind:'task',timestamp}]});
   w.data.oathsByDevice={test:{history:[{id:'earlier-oath',workspace:{type:'project',id:'q'},fulfilledAt:timestamp}]}};
   e.pending=(_date,{currentSession=false}={})=>currentSession?['p']:['p','q'];
   reportPlugin.workspaceModes.currentContext=()=>w.getProjectById('q');
   controllerOpen({closeButton:{}});window.editor=reportPlugin.progressEditor;return true;
  })()`);
  check(await evaluate('JSON.stringify([...editor.rows.keys()])===JSON.stringify(["p"])'),'Closing excludes Itacan with existing reports, earlier file/Oath evidence, and an earlier-session task workspace');
  check(await evaluate('editor.rows.get("p").rating===(snapshot().projectWorkRatings.p[editor.date]??null)&&editor.rows.get("p").input.value===snapshot().projectWorkLogs.p[editor.date].summary'),'Included closing workspace prefills its existing whole-day rating and reflection');
  check(await evaluate('editor.rows.get("p").evidence.textContent.includes("Whole-day evidence")'),'Included workspace retains whole-day recorded evidence');
  check(await evaluate('!editor.body.textContent.includes("Add workspace")'),'Editor has no manual workspace picker');
  check(await evaluate('(()=>{const details=editor.rows.get("p").evidence.querySelector("details");return details.querySelector("summary").textContent==="View work done"&&!details.querySelector("details")})()'),'One disclosure contains the recorded work');
  await evaluate('editor.close();reportPlugin.reportEligibility.pending=()=>["resource:study"];reportPlugin.projectWizard.taskProgressEvidence=()=>({availability:"current",records:[]});controllerOpen({closeButton:{}});window.editor=reportPlugin.progressEditor;true');
  check(await evaluate('editor.rows.size===1&&editor.rows.has("resource:study")&&!editor.rows.get("resource:study").evidence.textContent.includes("Earlier study")'),'Engagement alone qualifies without fabricated evidence');
  await evaluate('reportPlugin.reportEligibility.pending=(_date,{currentSession=false}={})=>currentSession?["p"]:["p","q"];reportPlugin.projectWizard.taskProgressEvidence=()=>({availability:"current",records:[{id:"study",projectId:"resource:study",text:"Study",timestamp:Date.now()}]})');
  await evaluate('editor.close();controllerOpen();window.editor=reportPlugin.progressEditor;true');
  check(await evaluate('["p","q","resource:study"].every(id=>editor.rows.has(id))'),'Manual Log progress retains prior reports, daily engagement and recorded-evidence suggestions');
  const beforeOldSessionClose=await evaluate('closeCount()');
  await evaluate('editor.close();reportPlugin.reportEligibility.pending=(_date,{currentSession=false}={})=>currentSession?[]:["q"];reportPlugin.openProjectAdvancementPrompt({})');
  check(await evaluate('!reportPlugin.progressEditor&&closeCount()')===beforeOldSessionClose+1,'Application closes without a prompt when only prior-session unresolved engagement exists');
  await evaluate(`(()=>{const w=reportPlugin.projectWizard,b=suggestionBackup;w.getProgressReports=b.reports;w.taskProgressEvidence=b.evidence;w.activityLog=b.activity;w.data.oathsByDevice=b.oaths;w.getProjectById('q').name=b.qName;reportPlugin.reportEligibility.pending=b.pending;reportPlugin.workspaceModes.currentContext=b.current;return true})()`);
  for(const width of [1024,640]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate('openReport()');check(await evaluate('editor.modalEl.getBoundingClientRect().right<=innerWidth'),'Modal fits available width');}
  await screenshot('report');
  console.log('PASS:',checks,'production editor browser checks. Evidence:',output);
 }finally{clearTimeout(timeout);socket?.close();child.kill();await new Promise(r=>server.close(r))}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1});
