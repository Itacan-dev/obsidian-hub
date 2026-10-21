import type { Json, WorkspaceRef } from "../src/contracts";
import type { SourceEnvelope } from "../src/step-content";
export type RecurrenceStatus = "none" | "ambiguous" | "malformed" | "present-unverified" | "recognized-unimplemented" | "unsupported";
export interface TasksParserWitness {
    version:1; engineVersion:"8.4.0"; bundleSha256:string; inputLine:string;
    syntax:"tasksPluginEmoji"|"dataview"; settings:{taskFormat:"tasksPluginEmoji"|"dataview";[key:string]:Json};
    status:"recognized"|"unsupported"|"none"|"ineligible"; rule:string|null;
}
export interface TemporalCandidate {
    format:"itacan-temporal-candidate"; version:1; policyVersion:1; decisionRevision:string;
    identity:{legacyId:string|null;nativeId:string|null};owner:WorkspaceRef;timezone:string;
    metadata:{[key:string]:Json};completion:{completed:boolean;timestamp:number|null;evidence:Json};source:SourceEnvelope|null;
    recurrence:{kind:"none"|"source"|"unknown";line:string|null;rule:string|null;syntax:"tasksPluginEmoji"|"dataview"|"unknown"|null;parser:TasksParserWitness|null};
}
export type TemporalStatus="representable"|"quarantined"|"invalid-legacy"|"ambiguous-evidence"|"unsupported-format";
export interface WallClockEvidence {precision:"missing"|"date-only"|"minute";status:"not-applicable"|"not-an-instant"|"unique"|"nonexistent"|"ambiguous"|"unresolved";candidateInstants:number[]}
export type TemporalReason = "INCOMPATIBLE_CONTRACT_FIELDS"|"UNSUPPORTED_TEMPORAL_CONTRACT"|"INCOMPLETE_TEMPORAL_EVIDENCE"|
    "UNSUPPORTED_SOURCE_CONTRACT"|"CORRUPT_SOURCE_EVIDENCE"|"SOURCE_OWNER_CONFLICT"|"SOURCE_IDENTITY_CONFLICT"|"SOURCE_CONTENT_QUARANTINED"|
    "RECURRENCE_SOURCE_CONFLICT"|"RECURRENCE_ABSENCE_CONFLICT"|"INVALID_LEGACY_DATES"|"NONSTRING_TEMPORAL_VALUE"|"UNKNOWN_NECESSITY"|
    "INVALID_COMPLETION_EVIDENCE"|"LEGACY_NATIVE_DATE_ORDER_MISMATCH"|"LOCAL_CLOCK_AMBIGUOUS"|"LOCAL_CLOCK_NONEXISTENT"|"LOCAL_CLOCK_UNRESOLVED"|
    "AMBIGUOUS_RECURRENCE_EVIDENCE"|"MALFORMED_RECURRENCE_EVIDENCE"|"NATIVE_RECURRENCE_UNIMPLEMENTED"|"RECURRENCE_INTERPRETATION_UNRESOLVED"|
    "UNSUPPORTED_PARSER_WITNESS"|"PARSER_WITNESS_CONFLICT"|"UNSUPPORTED_RECURRENCE_RULE";
export interface TemporalCompatibility {
    format:"itacan-temporal-compatibility";version:1;policyVersion:1;decisionRevision:string;privacy:"local-private";original:Json;
    status:TemporalStatus;temporalGate:"clear"|"blocked";automaticImportAllowed:false;
    legacy:{status:"not-assessed"|"valid"|"invalid";message:string|null};
    native:{status:"not-assessed"|"representable"|"incompatible";endpoints:null|{start:{date:string;time:string|null}|null;due:{date:string;time:string|null}|null;importance:"must"|"should"|null}};
    wallClocks:{start:WallClockEvidence|null;due:WallClockEvidence|null};completion:{status:"not-assessed"|"known-instant"|"unknown"|"open"|"invalid";timestamp:number|null};
    recurrence:{status:RecurrenceStatus;originalRule:string|null;evidenceLevel:"unverified"|"explicit-absence-assertion"|"supplied-installed-parser-witness"};
    diagnostics:{code:TemporalReason;decision:string;field:string}[];
}
export const TEMPORAL_DECISION:string;
export function classifyTemporal(candidate:TemporalCandidate|Json):TemporalCompatibility;
export function publicTemporalProjection():never;
