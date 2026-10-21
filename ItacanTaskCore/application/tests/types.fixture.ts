import {createNativeApplicationAdapter,createApplicationMutationService,ActionEnvelopeV1,CreationDraftV1,ApplicationActionV1} from "..";
import type {NativeApplicationOptionsV1,ServiceOptionsV1} from "..";
declare const options:NativeApplicationOptionsV1,readService:ServiceOptionsV1["taskService"],intent:ActionEnvelopeV1;
const adapter=createNativeApplicationAdapter(options),service=createApplicationMutationService({taskService:readService,adapter});
service.mutate(intent).then(r=>{if(r.status==="committed"||r.status==="replayed"){r.receipt.revisionId;if(r.readAfterWrite.state==="current")r.readAfterWrite.targets[0].task?.steps;}else if(r.status==="uncertain")r.retry;});
service.capabilities(intent).then(r=>r.state);service.dispose();
// @ts-expect-error no generic executor
service.execute({});
// @ts-expect-error no storage lifecycle
adapter.open({});
// @ts-expect-error Necessity is not numeric
const priority:ApplicationActionV1={kind:"set-necessity",target:{taskId:"x",expectedTaskRevision:1},necessity:1};
// @ts-expect-error parent revision required for Step
const step:ApplicationActionV1={kind:"edit-step",target:{taskId:"x",stepId:"s"},title:"x"};
// @ts-expect-error rich content is not silently ignored on ordinary creation
const rich:CreationDraftV1={title:"x",description:"",necessity:null,start:null,due:null,location:null,phase:null,steps:[],completed:false,continuation:"body"};
// @ts-expect-error no completion patch bypass
const patch:ApplicationActionV1={kind:"edit-metadata",target:{taskId:"x",expectedTaskRevision:1},patch:{completed:true}};
// @ts-expect-error no source clocks on application creation
const clocks:CreationDraftV1={title:"x",description:"",necessity:null,start:null,due:null,location:null,phase:null,steps:[],completed:false,createdAt:0};
// @ts-expect-error no import action
const importer:ApplicationActionV1={kind:"history.importBundle",values:{}};

import type {TaskHandle,EditToken,TaskDraft} from "../../../.obsidian/plugins/hub-project-menu/lib/services/task-service-contract";
declare const handle:Extract<TaskHandle,{kind:"legacy"}>,token:Extract<EditToken,{kind:"legacy-snapshot"}>,draft:TaskDraft;
const legacy:ActionEnvelopeV1={version:1,operationId:"old",reason:"Review",owner:{type:"project",id:"p"},authority:{backend:"legacy-markdown",applicationContextId:"app"},action:{kind:"legacy-editable",handle,token,draft}};
