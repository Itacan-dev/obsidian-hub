"use strict";
const W = require("../../writer/tests/support.cjs"), App = require(".."), {TaskService} = require(W.root + "/.obsidian/plugins/hub-project-menu/lib/services/task-service");
async function fixture(t, extra = {}) {
    const f = await W.fixture(t, extra), authority = {backend:"native",authorityId:f.authorityId,applicationContextId:"synthetic-app"};
    let calls = 0;
    const writer = Object.fromEntries(["task","step","recurrence"].map(k=>[k,async(...args)=>{calls++;return f.session.writer[k](...args);} ]));
    const host = extra.readHost ? extra.readHost(f.host) : f.host;
    const createAdapter = () => App.createNativeApplicationAdapter({authority,host,writer,capability:f.cap});
    let adapter = createAdapter(); const readAdapter = W.API.createNativeReadAdapter(f.host), service = new TaskService(readAdapter);
    let app = App.createApplicationMutationService({taskService:service,adapter});
    t?.after(async()=>{app.dispose();await service.close();});
    const v = {...f, get repo(){return f.repo;}, get storage(){return f.storage;}, authority, writer, host, get app(){return app;},get adapter(){return adapter;},get calls(){return calls;}};
    v.target = task => { const i=f.repo.info(); return {version:1,session:{deviceId:"synthetic-device",oathId:"synthetic-oath"},original:{kind:"native-task",taskId:task.id,text:task.title},owner:task.owner,authority:{kind:"native",authorityId:f.authorityId,partitionId:task.partitionId,taskId:task.id,enrollment:{repositoryRevision:i.revision,revisionId:i.revisionId,taskRevision:task.revision},aliasPin:null}}; };
    v.proof = async targets => { const port=W.API.createCompletionEvidencePort(f.host);t?.after(()=>port.dispose());await f.host.refresh();return port.readCurrentCompletionProof({version:1,requestGeneration:1,authorityId:f.authorityId,ownerContextPin:f.host.info().ownerContextPin,targets,enrollmentCut:null}); };
    v.reconnect = async()=>{app.dispose();f.cap=await f.authorize();adapter=createAdapter();app=App.createApplicationMutationService({taskService:service,adapter});};
    v.intent = async(action,patch={})=>{const r=await f.request({type:!action.target?"task.create":"task.update",operationId:W.id(),...(action.target?{taskId:action.target.taskId,expectedRevision:action.target.expectedTaskRevision}:{}),payload:!action.target?{task:{owner:patch.owner??W.owners[2].owner,title:"preflight"}}:{patch:{}}});const {authorityId:ignored,...scope}=r.scope;return{version:1,operationId:r.command.operationId,reason:"Closed synthetic application action",authority,owner:patch.owner??(action.target?f.repo.getTask(action.target.taskId,{includeDeleted:true}).owner:W.owners[2].owner),guard:{expectedRepositoryRevision:r.command.expectedRepositoryRevision,...scope},action:W.clone(action),...patch};};
    v.act = async(action,patch)=>app.mutate(await v.intent(action,patch));
    return v;
}
const target=(f,t,stepId)=>({taskId:t.id,expectedTaskRevision:f.repo.getTask(t.id,{includeDeleted:true}).revision,...(stepId?{stepId}:{})});
const draft=(patch={})=>({title:"Application parent",description:"",necessity:null,start:null,due:null,location:null,phase:null,steps:[],completed:false,...patch});
const recurrenceAction=c=>({kind:"recurrence",target:{taskId:c.taskId,expectedTaskRevision:c.expectedRevision},change:({"recurrence.defineSeries":"define-series","recurrence.reviseRule":"revise-rule","recurrence.defineTemplate":"define-template","recurrence.reviseTemplate":"revise-template","recurrence.prepareGeneration":"prepare-generation","recurrence.complete":"complete-occurrence"})[c.type],values:c.payload});
function structure(f,t,patch={}) { const current=require("../../src/source-content").contentOf(f.repo.getTask(t.id));return{version:1,draft:{version:1,taskId:t.id,expectedRevision:f.repo.getTask(t.id).revision,steps:f.repo.getTask(t.id).steps.map(s=>({state:"existing",id:s.id,parentStepId:s.parentStepId,order:s.order,title:s.title,body:current?.revisions.at(-1).current.stepBodies.find(b=>b.id===s.id)?.body??"",completed:s.completed}))},deletions:[],taskPatch:{},content:{version:1,expectedRevision:current?.revisions.length??0,appendOriginals:[],continuation:current?.revisions.at(-1).current.continuation??""},...patch};}
module.exports={...W,App,fixture,target,draft,recurrenceAction,structure};
