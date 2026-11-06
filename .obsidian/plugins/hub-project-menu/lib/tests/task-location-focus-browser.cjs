"use strict";
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
async function run(){
 const root=path.resolve(__dirname,'../..'),output=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-location-browser-'));
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data)}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=process.argv[2]??'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const child=spawn(browser,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(output,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket;try{
  let devtools;for(let i=0;i<200;i++){try{devtools=fs.readFileSync(path.join(output,'profile/DevToolsActivePort'),'utf8').split(/\r?\n/);break}catch{await new Promise(r=>setTimeout(r,50))}}
  assert(devtools,'Headless browser starts');const targets=await(await fetch('http://127.0.0.1:'+devtools[0]+'/json/list')).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result)}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});await call('Page.enable');await call('Runtime.enable');

  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  const key=async(key,code,vk)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(vk===13?{text:'\r'}:vk===32?{text:' '}:{})});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk})};
  const move=async(x=1,y=1)=>call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
  const click=async expression=>{const p=await evaluate(`(()=>{const r=(${expression}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await move(p.x,p.y);await call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1})};
  for(const theme of ['dark','light']){
   await call('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});
   await call('Page.navigate',{url:'http://127.0.0.1:'+port+'/lib/tests/task-location-focus.html'+(theme==='light'?'?light':'')});
   for(let i=0;i<200&&!await evaluate('Boolean(window.testDone)');i++)await new Promise(r=>setTimeout(r,25));
   await evaluate('testDone');
   for(const mode of ['Add','Edit'])for(const kind of ['root','folder','note']){
    assert(await evaluate(`openEditor('${mode}','${kind}')`),'Editor mounted');
    const initial=await evaluate('trigger().textContent');
    for(const dismissal of ['confirm','cancel','x','escape'])for(let repeat=0;repeat<2;repeat++){
     await click('trigger()');assert(await evaluate('Boolean(editor.locationPicker)'),'Pointer opens picker');
     if(dismissal==='escape')await key('Escape','Escape',27);
     else await click(dismissal==='confirm'?'editor.locationPicker.confirm':dismissal==='x'?'editor.locationPicker.closeButton':"editor.locationPicker.contentEl.querySelector('.hub-task-dialog-actions button')");
     await move();
     assert(await evaluate('!editor.locationPicker&&document.activeElement===trigger()'),'Native Modal restores opener focus: '+dismissal);
     assert(await evaluate('!trigger().matches(":hover,:active")&&getComputedStyle(trigger()).boxShadow==="none"&&getComputedStyle(trigger()).backgroundColor==="rgba(0, 0, 0, 0)"'),'No persistent trigger state: '+dismissal);
     assert.equal(await evaluate('trigger().textContent'),initial,'Unchanged selection/cancellation preserves location');
    }
    await click('trigger()');
    await click('[...editor.locationPicker.list.querySelectorAll("button")].find(b=>b.dataset.locationType==="note"&&!b.classList.contains("is-selected"))');
    const chosen=await evaluate('editor.locationPicker.proposed.reference.id');
    await click('editor.locationPicker.confirm');await move();
    assert(await evaluate(`trigger().title.includes(${JSON.stringify(chosen.split('/').pop())})`),'Selection updates editor draft');
    assert(await evaluate('document.activeElement===trigger()&&!trigger().matches(":hover,:active")&&getComputedStyle(trigger()).boxShadow==="none"'),'Changed selection restores opener without a shadow');
    await click('trigger()');
    const point=await evaluate('(()=>{const r=trigger().getBoundingClientRect();return{x:r.x+2,y:r.y+2}})()');
    await move(point.x,point.y);await key('Escape','Escape',27);await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    assert(await evaluate('trigger().matches(":hover")&&getComputedStyle(trigger()).backgroundColor!=="rgba(0, 0, 0, 0)"'),'Genuine hover remains after close');
    await move();assert(await evaluate('getComputedStyle(trigger()).backgroundColor==="rgba(0, 0, 0, 0)"'),'Pointer leave removes hover');
    // Tab from the actual preceding input, then activate the native button.
    await evaluate('editor.taskFields.input.focus()');for(let i=0;i<5&&!await evaluate('document.activeElement===trigger()');i++)await key('Tab','Tab',9);
    assert(await evaluate('document.activeElement===trigger()&&trigger().matches(":focus-visible")'),'Tab visibly focuses trigger');
    assert(await evaluate('getComputedStyle(trigger()).outlineStyle!=="none"&&parseFloat(getComputedStyle(trigger()).outlineWidth)>0'),'Visible keyboard outline');
    for(const [name,code,vk]of [['Enter','Enter',13],[' ','Space',32]]){
     await key(name,code,vk);assert(await evaluate('Boolean(editor.locationPicker)'),'Keyboard activation: '+code);
     await key('Escape','Escape',27);
     assert(await evaluate('document.activeElement===trigger()&&trigger().matches(":focus-visible")'),'Keyboard dismissal restores visible trigger focus');
    }
    console.log('PASS',theme,mode,kind,'all dismissal paths, repetition, selection, hover, Tab, Enter, Space');
   }
   await evaluate('editor.close()');
  }
 }finally{socket?.close();child.kill();await new Promise(r=>server.close(r));}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1});
