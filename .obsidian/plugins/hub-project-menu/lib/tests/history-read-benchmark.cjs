"use strict";
const {performance}=require("node:perf_hooks"),fs=require("node:fs"),path=require("node:path");
const {createHistoryFixture,between}=require("./history-read-fixture.cjs");
const {createTaskHistoryRead}=require("../services/task-history-read");
const {recordedHistoryQuery}=require("../services/task-history-legacy-read");
const {queryHistory}=require("../domain/history"),{createHistoryPager}=require("../ui/history-pager");
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
async function timed(work){const values=[];for(let i=0;i<7;i++){const start=performance.now();await work();values.push(performance.now()-start);}return+median(values).toFixed(3);}
const source=fs.readFileSync(path.join(__dirname,"history-read-project-original.cjs"),"utf8"),body=between(source,"function renderProjectTaskHistory()","function renderProjectProgressView()");
const selection=body.slice(body.indexOf("    const items ="),body.indexOf("    if (items.length"));
const select=new Function("records","owner",`const window={hubGetCompletedTaskHistory:()=>records},isResourceContext=owner.contextKind==="resource",current={...owner,file:{path:owner.path}},projectRoot=owner.root;${selection};return items;`);
function page(records){let renderCount=0,scroll;const body={scrollTop:0,clientHeight:200,scrollHeight:500,addEventListener(_event,fn){scroll=fn;},removeEventListener(){}};
    const pager=createHistoryPager(body,{register(){}});pager.render(records,()=>renderCount++);body.scrollTop=500;scroll();return renderCount;}
(async()=>{const results=[];for(const count of[100,1000,5000]){
    const f=createHistoryFixture(count-11),callbacks=[],make=()=>createTaskHistoryRead({plugin:f.plugin,component:{register:fn=>callbacks.push(fn)}}),reader=make();let old,next;
    const originalCold=await timed(()=>{old=f.wizard.getCompletedTaskHistory();}),currentCold=await timed(async()=>{const c=make();next=await c.read();c.close();});
    next=await reader.read();reader.accept(next);
    const homeCached=await timed(()=>old),workspaceCached=await timed(()=>f.wizard.getCompletedTaskHistory()),cachedStart=f.counts.history,currentCached=await timed(()=>reader.read());
    const cachedQueries=f.counts.history-cachedStart;
    const originalRefresh=await timed(()=>{old=f.wizard.getCompletedTaskHistory();}),refreshStart=f.counts.history,currentRefresh=await timed(async()=>{reader.invalidate();next=await reader.read();}),refreshQueries=f.counts.history-refreshStart;
    const filtering=[await timed(()=>select(old,f.owners[0])),await timed(()=>select(next.records,f.owners[0]))];
    const pagination=[await timed(()=>page(select(old,f.owners[0]))),await timed(()=>page(select(next.records,f.owners[0])))];
    const normalization=[await timed(()=>queryHistory(f.records)),await timed(()=>recordedHistoryQuery(f.records))];
    const taskUpdateStart=f.counts.history;for(let i=0;i<10;i++){f.plugin.taskData.invalidateAll();f.flush();await reader.read();}
    const unnecessaryHistoryQueries=f.counts.history-taskUpdateStart;
    if(f.records.length!==count||cachedQueries||unnecessaryHistoryQueries||f.counts.index||f.counts.sources||f.state.writes)throw Error("History benchmark isolation failed");
    results.push({events:count,ms:{initial:[originalCold,currentCold],cached:{homeOriginal:homeCached,workspaceOriginal:workspaceCached,current:currentCached},refresh:[originalRefresh,currentRefresh],filtering,pagination,normalization},
        queries:{cachedSevenReads:cachedQueries,sevenHistoryInvalidations:refreshQueries,tenTaskInvalidations:unnecessaryHistoryQueries},taskIndexScans:f.counts.index,markdownSourceReads:f.counts.sources,writes:f.state.writes});
    reader.close();callbacks.forEach(fn=>fn());await f.close();
}console.log(JSON.stringify(results,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(results,null,2)+"\n");})().catch(error=>{console.error(error);process.exitCode=1;});
