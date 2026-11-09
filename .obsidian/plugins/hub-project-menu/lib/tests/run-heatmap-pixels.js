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
  await evaluate('prepareWeekdayReference()');
  let reference;
  try{reference=await send("Page.captureScreenshot",{format:"png"},sessionId)}
  finally{await evaluate('restoreWeekdayReference()')}
  const labels=await evaluate(`inspectWeekdayPixels(${JSON.stringify(shot.data)},${JSON.stringify(reference.data)},${JSON.stringify(geometry)})`);
  const expected=Math.round(geometry.cells[0].w*dpr);
  // Local scrolling intentionally shows fewer columns at narrow widths. Check
  // every fully visible cell, rather than assuming at least 100 fit on screen.
  const visibleCount=geometry.cells.filter(r=>r.x>=geometry.viewport.left-.01&&r.x+r.w<=geometry.viewport.right+.01&&(r.x+r.w)*dpr<=raster.imageWidth&&(r.y+r.h)*dpr<=raster.imageHeight).length;
  const ok=raster.count===visibleCount&&raster.count>=14&&raster.sizes.length===1&&raster.sizes[0]===expected+'x'+expected&&raster.xgaps.length===1&&raster.ygaps.length===1&&raster.xgaps[0]===1&&raster.ygaps[0]===1;
  if(!ok)failures++;
  const result={...scenario,dpr,zoom:geometry.zoom,cssCell:geometry.cells[0].w/geometry.zoom,labels,...raster,ok};
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
 if(!process.argv.includes('--quick')){
  // Sunday/Monday can occupy adjacent rows for other native week starts.
  // Verify complete text painting and the existing narrow scroll fallback too.
  for(const kind of ['home','project'])for(const year of [2026,2012])for(const weekStart of [0,2])for(const zoom of [1,1.25])for(const width of [180,447.4]){
   const scenario={kind,year,weekStart,zoom,width};
   await check(await evaluate(`mountHeatmap(${JSON.stringify(scenario)})`),scenario);
  }
 }
 // Fit the largest whole-device-pixel squares after reserving the optical
 // weekday gap; the complete assembly must remain centered in the separator.
 if([1.5,2].includes(dpr))for(const kind of ['home','project']){
  const width=dpr===1.5?482+2/3:482;
  const geometry=await evaluate(`mountHeatmap(${JSON.stringify({kind,width})})`);
  const square=Math.round(geometry.cells[0].w*dpr);
  const weekdayGap=Number(geometry.style.match(/--hub-heatmap-weekday-gap: ([0-9.]+)px/)[1]);
  const weeks=geometry.cells.length/7;
  const available=width-8-geometry.weekdayColumn.width-weekdayGap;
  if(square!==Math.floor((available*dpr-(weeks-1))/weeks+1e-9))throw Error('Full desktop squares do not maximize the reserved width');
  const left=geometry.weekdayColumn.left-geometry.viewport.left;
  const right=geometry.viewport.right-Math.max(...geometry.cells.map(cell=>cell.x+cell.w));
  if(Math.abs(left-right)>.04||Math.min(left,right)<4-.04)throw Error('Desktop assembly is not centered within the separator insets');
  await check(geometry,{kind,width,fullDesktop:true,primary:kind==='home',leftInset:left,rightInset:right});
 }
 const paintedPalettes=[];
 for(const kind of ['home','project']){
  const entries=[1,2,3,4].map((intensity,i)=>({date:'2026-01-0'+(i+5),intensity}));
  const geometry=await evaluate(`mountHeatmap(${JSON.stringify({kind,width:447.4,entries})})`);
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  paintedPalettes.push({kind,...await evaluate(`inspectProgressColors(${JSON.stringify(shot.data)},${JSON.stringify(geometry)})`)});
  fs.writeFileSync(path.join(os.tmpdir(),`hub-heatmap-colors-${dpr}-${kind}.png`),Buffer.from(shot.data,'base64'));
 }
 console.log('PASS painted palettes:',JSON.stringify(paintedPalettes));
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
 fs.writeFileSync(path.join(os.tmpdir(),`hub-heatmap-pixels-${dpr}.json`),JSON.stringify({screen,dpr,scaleChanges,paintedPalettes,results},null,2));
 console.log(`${failures?"FAIL":"PASS"}: ${results.length} native-DPR ${dpr} raster configurations; ${failures} nonuniform; ${scaleChanges} DPR notification transitions.`);
 if(failures)process.exitCode=1;
}finally{clearTimeout(timeout);await send("Browser.close").catch(()=>child.kill())}})().catch(e=>{console.error(e);process.exitCode=1});
