"use strict";
const path=require("node:path"),fs=require("node:fs/promises");
const core=require("../src"),privateContent=require("../src/source-content"),old=require("./support.cjs");
const id=n=>"20000000-0000-4000-8000-"+String(n).padStart(12,"0"),NOW=1792224000000;
const contexts=[
    {key:"itacan",owner:old.owners.a,root:"Projects/Itacan",kind:"git-project",partition:"git-a"},
    {key:"hub",owner:old.owners.b,root:"Projects/Obsidian Hub",kind:"git-project",partition:"git-b"},
    {key:"private",owner:old.owners.private,root:"Projects/Private",kind:"private-project",partition:"private-a"},
    ...[["knowledge","study","Knowledge"],["research","literature","Research"],["explorations","references","Explorations"],["inspiration","inspiration","Inspiration"]].map(([key,rid,name])=>({key,owner:{type:"resource",id:rid},root:"Resources/"+name,kind:"resource",partition:"resource-"+rid}))
];
const context=key=>contexts.find(c=>c.key===key);
function initialSteps(completed=false){return[{id:id(101),title:"Same",order:0,completed,completedAt:null},{id:id(102),parentStepId:id(101),title:"Child",order:0},{id:id(103),parentStepId:id(102),title:"Grandchild",order:0},{id:id(104),title:"Same",order:1}];}
async function fixture(kind,t,extra={}){
    let seq=2000;const f=await old.fixture(kind,t,{clock:()=>NOW,idFactory:()=>id(++seq),partitions:contexts.map(c=>({id:c.partition,kind:c.kind,owner:c.owner})),...extra});
    const ownerContext=context(extra.ownerKey??"itacan"),result=await f.repo.execute({type:"task.create",operationId:"seed-task",payload:{task:{id:id(1),owner:ownerContext.owner,title:"Native parent",description:"Native explicit description",createdAt:null,modifiedAt:null,steps:initialSteps(extra.completedStep),...extra.task}}});
    return Object.assign(f,{ownerContext,initial:result.task});
}
function drafts(task){const bodies=privateContent.contentOf(task)?.revisions.at(-1).current.stepBodies??[];return task.steps.map(s=>({state:"existing",id:s.id,parentStepId:s.parentStepId,order:s.order,title:s.title,body:bodies.find(b=>b.id===s.id)?.body??"",completed:s.completed}));}
function edit(task,patch={},operationId="edit-1"){
    const c=privateContent.contentOf(task),current=c?.revisions.at(-1).current;
    const payload={version:1,draft:{version:1,taskId:task.id,expectedRevision:task.revision,steps:drafts(task)},deletions:[],taskPatch:{},content:c?{version:1,expectedRevision:c.revisions.length,appendOriginals:[],continuation:current.continuation}:null,...patch};
    return{type:"task.editStructure",taskId:task.id,expectedRevision:task.revision,operationId,payload};
}
function request(task,patch={}){const c=contexts.find(c=>c.owner.type===task.owner.type&&c.owner.id===task.owner.id)??context("itacan");return{id:"source-original",version:1,parserVersion:1,source:{documentId:"synthetic-source",path:c.root+"/Folder/Source.md",root:c.root,revision:"source-r1",owner:c.owner},target:{taskId:task.id,stepId:null,taskRevision:task.revision},line:0,expectedRange:null,metadata:{unknown:"PRIVATE_METADATA",historyRef:"PRIVATE_HISTORY",oathRef:"PRIVATE_OATH"},explicitDescription:"Original explicit description",...patch};}
const source="- [ ] Original <!-- hub-task:legacy-source -->\r\n    HISTORICAL_ONLY_SENTINEL  \n    - [ ] Child\n- [ ] Unrelated\n";
function envelope(task,text=source,patch={}){return core.captureSourceEnvelope(Buffer.from(text,"utf8"),request(task,patch));}
function attachment(task,patch={},operationId="attach-1"){const e=envelope(task),c={version:1,expectedRevision:0,appendOriginals:[e],continuation:"CURRENT_CONTINUATION"};const command=edit(task,{content:c,...patch},operationId);command.payload.draft.steps[0].body="CURRENT_STEP_BODY";return command;}
const newStep=(n,parentStepId,order,title="New")=>({state:"new",id:id(n),parentStepId,order,title,body:"",completed:false});
function visible(repo){return{info:repo.info(),tasks:repo.queryTasks({includeArchived:true,includeDeleted:true}),history:repo.queryHistory()};}
async function diskState(directory){const pointer=JSON.parse(await fs.readFile(path.join(directory,"CURRENT.json"),"utf8"));return JSON.parse(await fs.readFile(path.join(directory,pointer.payload.current.file),"utf8"));}
module.exports={core,privateContent,id,NOW,contexts,context,fixture,drafts,edit,request,envelope,attachment,newStep,visible,diskState,source,clone:privateContent.clone};
