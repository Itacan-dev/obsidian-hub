"use strict";
// Actual editor/checklist modules and native CSS, with an isolated Modal/service
// adapter. CDP checks DOM, accessibility, keyboard navigation and native layout.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
async function run(){
 const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-repeat-visibility-'));
 const native=process.env.HUB_TEST_NATIVE_CSS||path.join(os.tmpdir(),'itacan-native-app.css');
 assert(fs.existsSync(native),'Supply native Obsidian CSS through HUB_TEST_NATIVE_CSS');
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=name==='/lib/tests/native-app.css'?native:path.resolve(root,'.'+name);if(file!==native&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');let content=fs.readFileSync(file);if(file.endsWith('task-editor-step-context.html'))content=content.toString().replace('window.openEditor=async','window.recurrenceTestService=service; window.openEditor=async').replace('const unchanged=fields.checklist.host.parentElement===fields.card.info;', `const unchanged=fields.checklist.host.parentElement===fields.card.info && !!host.querySelector('[data-task-property="recurrence"]');`);res.end(content)}catch{res.writeHead(404).end()}});
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
  const click=async expression=>{const p=await point(expression);await move(p.x,p.y);await call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await evaluate('frames()')};
  const key=async(key,vk,modifiers=0)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:vk,modifiers,...(key==='Enter'?{text:'\r'}:{})});await call('Input.dispatchKeyEvent',{type:'keyUp',key,windowsVirtualKeyCode:vk,modifiers});await evaluate('frames()')};
  const screenshot=async name=>{const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(result.data,'base64'))};
  await call('Page.enable');await call('Runtime.enable');
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/lib/tests/task-editor-step-context.html'});
  for(let i=0;i<200&&!await evaluate('Boolean(window.testDone)');i++)await new Promise(r=>setTimeout(r,25));await evaluate('testDone');
  await call('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});
  for(const mode of ['Add','Edit'])for(const description of ['', 'Existing description']){
   await evaluate(`openEditor('${mode}',0);`);
   await evaluate(`editor.taskFields.state.description=${JSON.stringify(description)};editor.taskFields.refresh();recurrenceTestService.phases=()=>[];editor.taskFields.phase.refresh()`);
   check(await evaluate('!editor.contentEl.querySelector(\'[data-task-property="recurrence"]\')'),mode+' recurrence absent from DOM');
   const properties=await evaluate('[...editor.contentEl.querySelectorAll(".hub-task-config-action")].filter(e=>!e.hidden).map(e=>e.dataset.taskProperty)');
   assert.deepEqual(properties,['start','due','necessity','description']);checks++;
   // Refresh the description label through its existing editor.
   await click('editor.contentEl.querySelector(\'[data-task-property="description"]\')');
   await click('[...editor.contentEl.querySelectorAll("button")].find(e=>e.textContent==="Done")');
   check(await evaluate(`editor.contentEl.querySelector('[data-task-property="description"]').textContent.includes('${description?'Edit':'Add'} description')`),mode+' description remains final action');
   check(await evaluate('!editor.contentEl.textContent.includes("Repeat task")&&!editor.contentEl.querySelector(".hub-task-config-actions").textContent.includes("Repeat")'),mode+' no repeat text or placeholder');
   const ax=await call('Accessibility.getFullAXTree');check(!ax.nodes.some(n=>/Repeat task|Repeats daily|Repeat frequency/.test(n.name?.value||'')),mode+' recurrence absent from accessibility tree');
   const layout=await evaluate(`(()=>{const actions=editor.contentEl.querySelector('.hub-task-config-actions'),modal=editor.modalEl,buttons=[...actions.querySelectorAll('.hub-task-config-action')].filter(e=>!e.hidden),before=box(modal).h,row=buttons.at(-1).cloneNode(true);actions.append(row);const expanded=box(modal).h,added=box(row).h;row.remove();return{before,after:box(modal).h,expanded,added,padding:parseFloat(getComputedStyle(actions).paddingBottom)+parseFloat(getComputedStyle(actions).paddingTop),actions:box(actions).h,rows:buttons.reduce((sum,b)=>sum+box(b).h,0)}})()`);
   check(near(layout.before,layout.after)&&near(layout.expanded-layout.before,layout.added),mode+' dialog/footer shrink naturally by removed row height');
   check(near(layout.actions-layout.padding,layout.rows),mode+' no unused action space or separator');
   for(let i=0;i<16;i++){await key('Tab',9);check(await evaluate('!document.activeElement.closest(\'[data-task-property="recurrence"]\')'),mode+' Tab excludes repeat');}
   await screenshot(mode+'-'+(description?'description':'empty'));
  }
  // Use actual editor state + Save handlers; the isolated service records the payload.
  await evaluate(`window.originalRule={active:true,seriesId:'series-1',seriesRevision:3,ordinal:2,rule:{frequency:'weekly',interval:2,zone:'Europe/Stockholm',startDate:'2026-11-06',dueDate:'2026-11-07'}};window.baseRead=recurrenceTestService.read;recurrenceTestService.read=async()=>({...await baseRead(),recurrence:structuredClone(originalRule)});openEditor('Edit',1)`);
  check(await evaluate('JSON.stringify(editor.taskFields.state.recurrence)===JSON.stringify(originalRule)&&!Object.hasOwn(editor.taskFields.state,"recurrenceDraft")'),'opening preserves rule without synthesizing defaults');
  await click('editor.contentEl.querySelector(".hub-task-dialog-actions .mod-cta")');
  check(await evaluate('editor.closed&&JSON.stringify(JSON.parse(fingerprint()).recurrence)===JSON.stringify(originalRule)'),'unchanged save preserves recurrence');
  await evaluate('openEditor("Edit",1,false,true)');
  await evaluate(`input(editor.taskFields.input,'Edited title');Object.assign(editor.taskFields.state,{dueDate:'2026-11-08',description:'Edited description',necessity:'should',nativeLocation:'Notes/Changed.md'});editor.taskFields.state.steps[0].text='Edited step'`);
  await click('editor.contentEl.querySelector(".hub-task-dialog-actions .mod-cta")');
  check(await evaluate('editor.closed&&JSON.stringify(JSON.parse(fingerprint()).recurrence)===JSON.stringify(originalRule)'),'unrelated edits preserve recurrence');
  check(await evaluate('JSON.parse(fingerprint()).text==="Edited title"&&JSON.parse(fingerprint()).steps[0].text==="Edited step"&&JSON.parse(fingerprint()).nativeLocation==="Notes/Changed.md"'),'unrelated edits saved normally');
  // Default visibility for other composers and the retained recurrence component.
  check(await evaluate('legacyComposer()'),'other composers retain recurrence action and checklist hierarchy');
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,status:'passed',host:'mocked Obsidian Modal/service with actual editor modules and native CSS'},null,2));console.log('PASS:',checks,'browser checks. Evidence:',output);
 }finally{clearTimeout(timeout);socket?.close();child.kill();await new Promise(r=>server.close(r))}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1});
