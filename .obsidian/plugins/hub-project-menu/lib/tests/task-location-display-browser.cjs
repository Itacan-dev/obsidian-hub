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
  for(const [width,height,theme]of [[1024,900,'dark'],[600,780,'dark'],[390,720,'dark'],[560,900,'light']]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:'+port+'/lib/tests/task-location-display.html'+(theme==='light'?'?light':'')});
   let ready=false;for(let i=0;i<200;i++){const r=await call('Runtime.evaluate',{expression:'Boolean(window.testDone)',returnByValue:true});if(r.result.value){ready=true;break}await new Promise(r=>setTimeout(r,25))}assert(ready,'Harness loads');
   const result=await call('Runtime.evaluate',{expression:'window.testDone',awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
   const settleAnimations=()=>call('Runtime.evaluate',{expression:'Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))',awaitPromise:true});
   await settleAnimations();

   const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};

   const controlGeometry=()=>evaluate('(()=>{const p=preview,r=e=>{const b=e.getBoundingClientRect();return[b.x,b.y,b.width,b.height]};return JSON.stringify([r(p.icon),r(p.text)])})()');
   for(const state of ['showRoot','showPath']){
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await evaluate('preview.'+state+'()');await settleAnimations();
    const before=await controlGeometry();
    const pos=await evaluate('(()=>{const r=preview.button.getBoundingClientRect();return{x:r.x+2,y:r.y+2}})()');
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await settleAnimations();
    assert.equal(await controlGeometry(),before,state+' hover does not move icon or text');
    await evaluate('preview.button.focus()');assert.equal(await controlGeometry(),before,state+' focus does not move icon or text');
    assert(await evaluate('getComputedStyle(preview.icon.querySelector("svg")).color===getComputedStyle(document.body).color&&getComputedStyle(preview.icon.querySelector("svg")).opacity==="1"'),'SVG foreground remains normal during hover/focus');
    if(state==='showRoot')assert(await evaluate('getComputedStyle(preview.text).color===getComputedStyle(document.body).color'),'Root text remains normal during hover/focus');
   }
   const point=await evaluate('(()=>{const r=preview.button.getBoundingClientRect();return{x:r.x+2,y:r.y+2}})()');
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await settleAnimations();
   assert(await evaluate('getComputedStyle(preview.button).backgroundColor!=="rgba(0, 0, 0, 0)"'),'Hover fills the combined control');
   await evaluate('preview.button.focus()');
   assert(await evaluate('getComputedStyle(preview.button).outlineStyle!=="none"'),'Visible keyboard focus');
   const initial=await evaluate('preview.clicks');
   for(const [key,code,vk]of [['Enter','Enter',13],[' ','Space',32]]){
    await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(vk===13?{text:'\r'}:{text:' '})});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});
   }
   assert.equal(await evaluate('preview.clicks'),initial+2,'Enter and Space activate location');
   const rootPoint=await evaluate('(()=>{const r=alignmentPreview.parts.row.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
   await call('Input.dispatchMouseEvent',{type:'mouseMoved',...rootPoint});await settleAnimations();
   assert(await evaluate('alignmentPreview.delta()<0.6'),'Hovered root keeps title and checkbox centered');
   await evaluate('alignmentPreview.parts.row.setAttribute("aria-pressed","true");alignmentPreview.parts.checkbox.checked=true;alignmentPreview.card.update({...alignmentPreview.task,completed:true})');
   assert(await evaluate('alignmentPreview.delta()<0.6&&alignmentPreview.parts.checkbox.checked'),'Selected completed root stays centered');
   const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'display-'+width+'-'+theme+'.png'),Buffer.from(shot.data,'base64'));
   console.log('PASS',JSON.stringify({...result.result.value,theme,keyboardAndHover:true}));
  }
  console.log('Browser evidence:',output);
 }finally{socket?.close();child.kill();await new Promise(r=>server.close(r));}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1});
