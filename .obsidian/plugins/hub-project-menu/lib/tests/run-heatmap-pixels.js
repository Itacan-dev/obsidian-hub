"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),{spawn}=require("child_process"),{pathToFileURL}=require("url");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"hub-heatmap-pixels-"));
const child=spawn(process.env.HUB_TEST_BROWSER||"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",[
    "--headless=new",`--force-device-scale-factor=${process.env.HUB_TEST_DPR||1}`,"--no-first-run","--disable-background-networking","--no-sandbox","--disable-extensions",
    "--allow-file-access-from-files","--remote-debugging-pipe",`--user-data-dir=${profile}`
],{windowsHide:true,stdio:["ignore","ignore","pipe","pipe","pipe"]});
let seq=0,buffer="";const pending=new Map();
child.stdio[4].on("data",data=>{buffer+=data;let end;while((end=buffer.indexOf("\0"))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}}});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdio[3].write(JSON.stringify({id,method,params,sessionId})+"\0")});
const timeout=setTimeout(()=>{child.kill();process.exitCode=1},120000);
(async()=>{try{
 const {targetId}=await send("Target.createTarget",{url:"about:blank"});const {sessionId}=await send("Target.attachToTarget",{targetId,flatten:true});
 const evaluate=async expression=>{const r=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value};
 await send("Page.navigate",{url:pathToFileURL(path.join(__dirname,"heatmap-pixels.html")).href},sessionId);
 for(let i=0;i<100&&!await evaluate("window.ready");i++)await new Promise(r=>setTimeout(r,30));

 const dpr=Number(process.env.HUB_TEST_DPR||1);
 // Native DPR sets compositor raster density. CDP emulation alone may upscale
 // cached 1x layers, which is not a valid OS-scaling regression test.
 const screen=dpr===2?[1920,1080]:[2560,1440];
 await send("Emulation.setDeviceMetricsOverride",{width:Math.floor(screen[0]/dpr),height:Math.floor(screen[1]/dpr),deviceScaleFactor:dpr,mobile:false},sessionId);
 let failures=0;const results=[];
 async function check(geometry,scenario){
  const shot=await send("Page.captureScreenshot",{format:"png"},sessionId);
  const raster=await evaluate(`inspectPixels(${JSON.stringify(shot.data)},${JSON.stringify(geometry)})`);
  const expected=Math.round(geometry.cells[0].w*dpr);
  const ok=raster.count>100&&raster.sizes.length===1&&raster.sizes[0]===expected+'x'+expected&&raster.xgaps.length===1&&raster.ygaps.length===1&&raster.xgaps[0]===1&&raster.ygaps[0]===1;
  if(!ok)failures++;
  const result={...scenario,dpr,zoom:geometry.zoom,cssCell:geometry.cells[0].w/geometry.zoom,...raster,ok};
  results.push(result);
  if(!ok||scenario.primary)console.log(JSON.stringify(result));
  if(scenario.primary)fs.writeFileSync(path.join(os.tmpdir(),`hub-heatmap-pixels-${dpr}.png`),Buffer.from(shot.data,"base64"));
 }
 for(const kind of (process.argv.includes('--quick')?['home']:['home','project']))for(const year of (process.argv.includes('--quick')?[2026]:[2026,2012]))for(const zoom of (process.argv.includes('--quick')?[1]:[1,.8,1.1,1.25,1.5])){
  const initial={kind,year,zoom,width:447.4};
  const geometry=await evaluate(`mountHeatmap(${JSON.stringify(initial)})`);
  await check(geometry,{...initial,primary:kind==='home'&&year===2026&&zoom===1});
  // Update the same mounted controller, including CSS zoom with unchanged width.
  for(const width of [360.5,280,180,470,640,447.4]){
   const updated=await evaluate(`resizeHeatmap(${JSON.stringify({width})})`);
   await check(updated,{kind,year,width,resized:true});
  }
  const updated=await evaluate(`resizeHeatmap(${JSON.stringify({zoom:zoom===1?1.25:1})})`);
  await check(updated,{kind,year,width:447.4,zoomChanged:true});
 }
 // A DPR change must refresh the same controller even when its CSS width stays
 // unchanged. Test dimensions here; the native-DPR launches above test paint.
 let scaleChanges=0;
 for(const nextDpr of [dpr===2?1.5:2,dpr]){
  await send("Emulation.setDeviceMetricsOverride",{width:1100,height:600,deviceScaleFactor:nextDpr,mobile:false},sessionId);
  // CDP's DPR-only override does not emit native display-change notifications
  // when the viewport size is unchanged. Deliver the normal window notification
  // explicitly; no layout function or controller refresh is called by the test.
  const geometry=await evaluate("dispatchEvent(new Event('resize'));new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(heatmapRects()))))");
  const gap=Number(geometry.style.match(/--hub-heatmap-gap: ([0-9.]+)px/)[1]);
  if(Math.abs(gap*nextDpr*geometry.zoom-1)>1e-7)throw Error('DPR-only change did not update geometry: '+JSON.stringify({nextDpr,dpr:geometry.dpr,zoom:geometry.zoom,gap,style:geometry.style}));
  scaleChanges++;
 }
 fs.writeFileSync(path.join(os.tmpdir(),`hub-heatmap-pixels-${dpr}.json`),JSON.stringify({screen,dpr,scaleChanges,results},null,2));
 console.log(`${failures?"FAIL":"PASS"}: ${results.length} native-DPR ${dpr} raster configurations; ${failures} nonuniform; ${scaleChanges} DPR notification transitions.`);
 if(failures)process.exitCode=1;
}finally{clearTimeout(timeout);await send("Browser.close").catch(()=>child.kill())}})().catch(e=>{console.error(e);process.exitCode=1});
