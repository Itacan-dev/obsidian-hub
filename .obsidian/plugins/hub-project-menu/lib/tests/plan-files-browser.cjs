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
 // Real existing file bytes and the production shared-vault host guard back this fixture.
 const vault=path.join(output,'vault');fs.mkdirSync(path.join(vault,'Projects/P'),{recursive:true});fs.mkdirSync(path.join(vault,'Resources/Research'),{recursive:true});
 fs.writeFileSync(path.join(vault,'Projects/P/Notes.md'),'# Project notes\nReal Markdown fixture.\n');fs.writeFileSync(path.join(vault,'Resources/Research/Reference.md'),'# Resource reference\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'];let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';fs.writeFileSync(path.join(vault,'Resources/Research/Shared Paper.pdf'),pdf);
 fs.writeFileSync(path.join(vault,'Resources/Research/Image.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
 const {EventEmitter}=require('node:events'),vm=require('node:vm'),{TaskEngine}=require('../../../../../ItacanTaskCore/vnext/engine.cjs');const engine=new TaskEngine(path.join(output,'tasks.sqlite')),handlers=new Map(),hostWindow=new EventEmitter(),app=new EventEmitter();hostWindow.id=1;hostWindow.webContents=Object.assign(new EventEmitter(),{send(){}});hostWindow.isDestroyed=()=>false;app.isReady=()=>true;const hostModule={exports:{}},childProcess=new EventEmitter(),client={ready:Promise.resolve(),subscribe:(...args)=>engine.subscribe(...args),call:(method,...args)=>engine[method](...args),async close(){await engine.close();this.exited=true;childProcess.emit('exit',0);}};
 let hostSource=fs.readFileSync(path.resolve(root,'../../../ItacanTaskCore/vnext/host/main.cjs'),'utf8');if(process.env.HUB_TEST_REINTRODUCE_PLAN_FILE_ADMISSION==='1')hostSource=hostSource.replace("action!=='list'&&action!=='receiptsSince'&&","action!=='list'&&");
 vm.runInNewContext(hostSource,{module:hostModule,process,setTimeout,console,require(name){if(name==='node:path')return path;if(name==='electron')return{ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},utilityProcess:{fork(){}},BrowserWindow:{fromId:()=>hostWindow},app};if(name==='./electron.cjs')return{openTaskService:()=>({child:childProcess,client})};throw Error(name);}});
 const binding=hostModule.exports.attach(1,path.join(output,'tasks.sqlite'));const hostCall=(method,...args)=>handlers.get(binding.channel)({sender:hostWindow.webContents},{method,args});
 const server=http.createServer((req,res)=>{if(req.url==='/receipt-audit'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',async()=>{try{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await hostCall('fileOperation',JSON.parse(body))));}catch(error){res.writeHead(500).end(error.message);}});return;}if(req.url.startsWith('/vault/')){const target=path.resolve(vault,decodeURIComponent(req.url.slice(7)));if(!target.startsWith(vault+path.sep)){res.writeHead(403).end();return;}try{res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}return;}const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=name==='/native.css'?native:name==='/main.js'?path.join(output,'main.js'):path.resolve(root,'.'+name);if(file!==native&&name!=='/main.js'&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}if(name==='/native-modal.js'){res.setHeader('Content-Type','text/javascript');res.end(nativeModal);return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');let content=fs.readFileSync(file);if(name==='/main.js'&&process.env.HUB_TEST_REINTRODUCE_PLAN_SCOPE_COLLISION==='1')content=content.toString().replaceAll('this.workspaceScope','this.scope');if(name==='/main.js'&&process.env.HUB_TEST_REINTRODUCE_SCOPE_COLLISION==='1')content=content.toString().replace('reportScope: scope,','scope,').replaceAll('this.reportScope','this.scope');res.end(content)}catch{res.writeHead(404).end()}});
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
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/lib/tests/plan-files.html'});
  for(let i=0;i<200&&!await evaluate('window.testDone');i++)await new Promise(r=>setTimeout(r,25));
  check(await evaluate('window.testDone&&!window.testError'),await evaluate('window.testError')||'Browser initialized');
  const addExisting=async(path,projectScope=false)=>{
   await click('planEditor.contentEl.querySelector(".hub-planner-add")');await evaluate('new Promise(r=>setTimeout(r,40))');
   await evaluate(`(()=>{const p=planPlugin.planPicker;p.categoryEl.value="file";p.categoryEl.onchange();${projectScope?'p.workspaceScope.value=JSON.stringify({type:"project",id:"p"});p.workspaceScope.onchange();':''}p.search.value=${JSON.stringify(path.split('/').at(-1))};p.search.oninput();return true})()`);
   await click('document.querySelector(".hub-plan-picker-row")');await click('planPlugin.planPicker.add');await evaluate('new Promise(r=>setTimeout(r,40))');
   check(await evaluate(`(()=>{const e=plan.draft.entries.find(e=>e.reference.path===${JSON.stringify(path)});return !!e&&!planEditor.contentEl.querySelector('[data-plan-id="'+e.id+'"] .hub-plan-title').disabled})()`),'Existing '+path+' is clickable after Add selected');
   await click(`[...planEditor.contentEl.querySelectorAll(".hub-plan-row")].find(r=>r.querySelector(".hub-plan-title").textContent===${JSON.stringify(path.split("/").at(-1))}).querySelector(".hub-plan-title")`);
   await evaluate('new Promise(r=>setTimeout(r,40))');
   check(await evaluate(`navigations.at(-1)?.path===${JSON.stringify(path)}&&navigations.at(-1).bytes>0`),'Existing file bytes open through workspace navigation: '+path);
  };
  await click('planEditor.contentEl.querySelector(".hub-planner-add")');await evaluate('new Promise(r=>setTimeout(r,40))');
  await evaluate('(()=>{const p=planPlugin.planPicker;p.categoryEl.value="file";p.categoryEl.onchange();p.workspaceScope.value=JSON.stringify({type:"project",id:"p"});p.workspaceScope.onchange();return true})()');
  check(await evaluate('planPlugin.planPicker.breadcrumbs.parentElement!==planPlugin.planPicker.results&&planPlugin.planPicker.workspaceScope.value.includes("p")'),'Initial Files fallback selects first available workspace and fixed breadcrumb');
  await click('[...planPlugin.planPicker.results.querySelectorAll(".hub-plan-folder")].find(b=>b.textContent.includes("Empty"))');
  check(await evaluate('planPlugin.planPicker.results.textContent.includes("No matching items")&&planPlugin.planPicker.breadcrumbs.textContent.includes("Empty")'),'Empty physical folder remains navigable with visible route');
  await click('planPlugin.planPicker.breadcrumbs.querySelector("button")');
  await screenshot('picker-files');
  check(await evaluate('[...planPlugin.planPicker.results.querySelectorAll(".hub-plan-folder")].some(b=>b.textContent.includes("Research"))'),'Project browsing exposes linked Resource roots without raw vault navigation');
  await click('[...planPlugin.planPicker.results.querySelectorAll(".hub-plan-folder")].find(b=>b.textContent.includes("Research"))');
  check(await evaluate('planPlugin.planPicker.results.textContent.includes("Shared Paper.pdf")&&planPlugin.planPicker.breadcrumbs.textContent.includes("Research")'),'Linked Resource navigation lists real files and physical workspace breadcrumb');
  check(await evaluate('(()=>{const nav=planPlugin.planPicker.breadcrumbs;return nav.querySelectorAll("[aria-current=location]").length===1&&nav.lastElementChild.querySelector(".hub-task-location-segment-label")&&nav.querySelector(".hub-task-location-separator")})()'),'Breadcrumb uses native current-folder, segment, and separator conventions');
  await evaluate('planPlugin.planPicker.close();true');
  await addExisting('Projects/P/Notes.md');
  await addExisting('Resources/Research/Shared Paper.pdf',true);
  await addExisting('Resources/Research/Reference.md',true);
  await addExisting('Resources/Research/Image.png');
  check(await evaluate('snapshot().plansById[snapshot().activePlanId].content.entries[1].intendedContext.id==="p"&&snapshot().plansById[snapshot().activePlanId].content.entries[1].reference.sourceWorkspace.id==="literature"'),'Project intent and physical Resource identity stay separate');
  check(await evaluate('!planEditor.contentEl.textContent.includes("Temporarily unavailable")'),'No valid file remains stuck in temporary unavailability');
  await evaluate('failAudit(true);plan.references.audit().catch(()=>{});new Promise(r=>setTimeout(r,30))');
  check(await evaluate('(async()=>{const items=await plan.references.resolve();return items.every(i=>i.fileState==="temporary"&&i.availability==="unavailable")})()'),'Genuine transient audit failure remains unavailable');
  await evaluate('failAudit(false);plan.references.audit();new Promise(r=>setTimeout(r,40))');
  check(await evaluate('(async()=> (await plan.references.resolve()).every(i=>i.availability==="current"))()'),'A successful retry restores valid references');
  await evaluate('plan.mutate(p=>{p.entries[1].unavailableReason="unresolved";p.entries[2].unavailableReason="deleted"});plan.flush()');
  check(await evaluate('(async()=>{const items=await plan.references.resolve();return items[1].fileState==="unresolved"&&items[2].fileState==="deleted"&&items[0].availability==="current"})()'),'Unresolved and deleted stay distinct from accessible files');
  check(await evaluate('planEditor.contentEl.textContent.includes("File deleted")&&planEditor.contentEl.textContent.includes("File reference needs relinking")'),'Row text distinguishes deletion and unresolved identity');
  await screenshot('planned-files');
  console.log('PASS:',checks,'planned-file resolver/navigation browser checks. Evidence:',output);
 }finally{clearTimeout(timeout);socket?.close();child.kill();await new Promise(r=>server.close(r));await hostCall('close');}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1});
