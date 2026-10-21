import {type TaskRepository,type RecurrenceRule,type RecurrenceCommand,type TemplateNodeDraft,type GenerationGraph,type RecurrenceReadiness,generationKey,validateGenerationGraph,RECURRENCE_COMMANDS} from "../src/contracts";
declare const repo:TaskRepository;
const rule:RecurrenceRule={version:1,frequency:"DAILY",interval:2,referencePolicy:"fixed-origin",calendar:{calendar:"gregory",zone:"Europe/Stockholm"}};
const node:TemplateNodeDraft={state:"new",id:"uuid",parentNodeId:null,order:0,title:"Step",body:"Lossless"};
const define:RecurrenceCommand={operationId:"op",type:"recurrence.defineSeries",taskId:"uuid",expectedRevision:1,expectedRepositoryRevision:1,payload:{version:1,expectedInventoryRevision:"captured-1",owner:{type:"project",id:"p"},partitionId:"p",reason:"Explicit creation",rule}};
repo.execute(define).then(result=>{const id:string|undefined=result.recurrence?.series.id;return id;});
const readiness:RecurrenceReadiness=repo.recurrenceReadiness();const notGenerator:false=readiness.generationSupported;
repo.getRecurrenceSeries("uuid");generationKey({type:"resource",id:"study"},"series-uuid","task-uuid");RECURRENCE_COMMANDS.includes("recurrence.defineTemplate");
declare const graph:GenerationGraph;const valid:true=validateGenerationGraph(graph);
// @ts-expect-error when-done deliberately unsupported
const whenDone:RecurrenceRule={...rule,referencePolicy:"when-done"};
// @ts-expect-error monthly deliberately unsupported
const monthly:RecurrenceRule={...rule,frequency:"MONTHLY"};
// @ts-expect-error unsupported bounds cannot be discarded
const bounded:RecurrenceRule={...rule,count:3};
// @ts-expect-error version discriminator mandatory
const noVersion:RecurrenceRule={frequency:"DAILY",interval:1,referencePolicy:"fixed-origin",calendar:{calendar:"gregory",zone:"UTC"}};
// @ts-expect-error expectedRepositoryRevision required
const noGuard:RecurrenceCommand={operationId:"op",type:"recurrence.defineSeries",taskId:"id",expectedRevision:1,payload:define.payload};
// @ts-expect-error template definitions cannot carry Step completion state
const completed:TemplateNodeDraft={...node,completed:true};
// @ts-expect-error absent generator is not an API
repo.generateNextOccurrence("id");
// @ts-expect-error generation command not advertised
repo.execute({...define,type:"recurrence.generateNextOccurrence"});
// @ts-expect-error series owners cannot be mounts
generationKey({type:"mount",id:"m"},"s","p");
// @ts-expect-error timed origins excluded
const timed:import("../src/recurrence").OriginalEndpoints={start:null,due:{date:"2026-10-17",time:"00:00"}};
void [rule,node,notGenerator,valid];
