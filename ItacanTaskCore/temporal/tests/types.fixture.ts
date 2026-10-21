import {classifyTemporal,TemporalCandidate,TemporalCompatibility,TasksParserWitness,publicTemporalProjection} from "../contracts";
const candidate:TemporalCandidate={format:"itacan-temporal-candidate",version:1,policyVersion:1,decisionRevision:"N1-D-A-D07-D09-r1",identity:{legacyId:null,nativeId:null},owner:{type:"resource",id:"study"},timezone:"Europe/Stockholm",metadata:{dueDate:"2026-10-17",necessity:"must"},completion:{completed:true,timestamp:null,evidence:null},source:null,recurrence:{kind:"none",line:null,rule:null,syntax:null,parser:null}};
const result:TemporalCompatibility=classifyTemporal(candidate);
const neverApproved:false=result.automaticImportAllowed;
const precision=result.wallClocks.due?.precision;
// @ts-expect-error Gate A never returns an approved automatic import.
const approved:true=result.automaticImportAllowed;
// @ts-expect-error No generation command is part of Gate A.
result.generateNextOccurrence();
// @ts-expect-error Precision needs explicit null rather than fabricated missing timestamp.
const missingCompletion:TemporalCandidate["completion"]={completed:true,evidence:null};
// @ts-expect-error Parser evidence versions are independent and exact.
const futureWitness:TasksParserWitness={version:2};
const unavailable:never=publicTemporalProjection();
void [neverApproved,precision,unavailable];
