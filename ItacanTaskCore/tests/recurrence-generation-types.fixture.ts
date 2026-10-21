import {type TaskRepository,type RecurrenceGenerationCommand,type CompleteTaskContent,type RuleRevision,type CalculationEvidence,type RecurrenceReadinessV2,type RecurrenceReadiness,calculateRecurrenceEndpoints,RECURRENCE_GENERATION_COMMANDS} from "../src/contracts";
declare const repo:TaskRepository;declare const rule:RuleRevision;
const old:RecurrenceReadiness=repo.recurrenceReadiness();const disabled:false=old.generationSupported;
const readiness:RecurrenceReadinessV2=repo.recurrenceReadiness({version:2,seriesId:"uuid"});const supported:true=readiness.generationSupported;
const evidence:CalculationEvidence=calculateRecurrenceEndpoints(rule,2);
const taskContent:CompleteTaskContent={title:"Future",description:"",continuation:"Body",importance:null,location:null,phase:null};
const command:RecurrenceGenerationCommand={operationId:"op",type:"recurrence.complete",taskId:"uuid",expectedRevision:1,expectedRepositoryRevision:4,payload:{version:2,seriesId:"uuid",owner:{type:"resource",id:"study"},partitionId:"study",expectedPartitionRevision:4,expectedSeriesRevision:3,expectedRuleRevision:1,expectedTemplateRevision:2,expectedInventoryRevision:"inventory",reason:"Explicit completion",completedAt:null}};
repo.execute(command).then(r=>{if(r.recurrence?.version===2&&r.recurrence.completion){const event:string=r.recurrence.completion.completionEventId;const original:string=r.recurrence.completion.outcome.completionEventId;return[event,original];}});
repo.getRecurrenceSeries("uuid",{version:2});RECURRENCE_GENERATION_COMMANDS.commands.includes("recurrence.complete");
// @ts-expect-error B2 command cannot omit repository guard
const missing:RecurrenceGenerationCommand={operationId:"op",type:"recurrence.complete",taskId:"uuid",expectedRevision:1,payload:command.payload};
// @ts-expect-error complete content requires explicit null metadata and content
const incomplete:CompleteTaskContent={title:"Future"};
// @ts-expect-error when-done and lifecycle transitions remain absent
repo.execute({...command,type:"recurrence.advance"});
// @ts-expect-error timed template dates are not a source of recurrence endpoints
const timed:CompleteTaskContent={...taskContent,due:{date:"2026-10-18",time:"00:00"}};
// @ts-expect-error old readiness retains false contract
const generation:true=old.generationSupported;
void [evidence,supported,disabled];
