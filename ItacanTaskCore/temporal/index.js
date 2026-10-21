"use strict";
// Inactive, pure Gate A analysis. No repository, host, writer or UUID factory.
const { validateTaskMetadata } = require("../../.obsidian/plugins/hub-project-menu/lib/domain/task-planning");
const { validateTask, workspace } = require("../src/domain");
const { newTask } = require("../src/commands");
const { validateEnvelope } = require("../src/source-content");
const { fields, jsonValue, clone, canonical } = require("../src/value");
const { check, fail } = require("../src/errors");

const FORMAT = "itacan-temporal-candidate", DECISION = "N1-D-A-D07-D09-r1";
const TASKS_HASH = "2b4f9ce24d26f1d0cb191dca9a73477454d256e03e51d81f37faeee7a293ad1b";
const keys = ["format", "version", "policyVersion", "decisionRevision", "identity", "owner", "timezone", "metadata", "completion", "source", "recurrence"];
const own = (o,k) => Object.hasOwn(o,k);
const empty = v => v === undefined || v === null || v === "";
const recurrenceMarker = line => /🔁|[\[(]\s*repeat\s*::/iu.test(line ?? "");

// This examines an already validated endpoint. Intl supplies zone rules; no
// offset is inferred from a completion/migration timestamp or host timezone.
function wallClock(endpoint, timezone) {
    if (!endpoint) return {precision:"missing",status:"not-applicable",candidateInstants:[]};
    if (endpoint.time === null) return {precision:"date-only",status:"not-an-instant",candidateInstants:[]};
    const result = {precision:"minute",status:"unresolved",candidateInstants:[]};
    let formatter;
    try { formatter = new Intl.DateTimeFormat("en-CA", {timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}); }
    catch (_) { return result; }
    const parts = ms => Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
    const utc = p => {const d=new Date(0);d.setUTCFullYear(+p.year,+p.month-1,+p.day);d.setUTCHours(+p.hour,+p.minute,0,0);return d.getTime();};
    const naive = Date.parse(endpoint.date+"T"+endpoint.time+":00Z"), offsets = new Set();
    if (!Number.isFinite(naive)) return result;
    for (let h=-36;h<=36;h++) {const sample=naive+h*3600000;offsets.add(utc(parts(sample))-sample);}
    for (const offset of offsets) {
        const instant=naive-offset,p=parts(instant);
        if (`${p.year.padStart(4,"0")}-${p.month}-${p.day}T${p.hour}:${p.minute}`===endpoint.date+"T"+endpoint.time) result.candidateInstants.push(instant);
    }
    result.candidateInstants=[...new Set(result.candidateInstants)].sort((a,b)=>a-b);
    result.status=result.candidateInstants.length===0?"nonexistent":result.candidateInstants.length===1?"unique":"ambiguous";
    return result;
}

function classifyTemporal(candidate) {
    jsonValue(candidate); // Reject non-JSON/cycles instead of losing evidence.
    const original=clone(candidate), diagnostics=[];
    const add=(code,decision,field)=>diagnostics.push({code,decision,field});
    const result={format:"itacan-temporal-compatibility",version:1,policyVersion:1,decisionRevision:DECISION,privacy:"local-private",original,
        status:"ambiguous-evidence",temporalGate:"blocked",automaticImportAllowed:false,
        legacy:{status:"not-assessed",message:null},native:{status:"not-assessed",endpoints:null},
        wallClocks:{start:null,due:null},completion:{status:"not-assessed",timestamp:null},
        recurrence:{status:"ambiguous",originalRule:null,evidenceLevel:"unverified"},diagnostics};
    const unsupported=code=>{add(code,"D07/D09","contract");result.status="unsupported-format";return result;};
    try {fields(candidate,keys,keys);}catch(_){return unsupported("INCOMPATIBLE_CONTRACT_FIELDS");}
    if(candidate.format!==FORMAT||candidate.version!==1||candidate.policyVersion!==1||candidate.decisionRevision!==DECISION)return unsupported("UNSUPPORTED_TEMPORAL_CONTRACT");
    try {
        workspace(candidate.owner);
        fields(candidate.identity,["legacyId","nativeId"],["legacyId","nativeId"]);
        for(const v of Object.values(candidate.identity))check(v===null||typeof v==="string"&&v.length>0,"Invalid supplied identity evidence.");
        check(typeof candidate.timezone==="string"&&candidate.timezone.length>0,"Explicit timezone required.");
        check(candidate.metadata&&typeof candidate.metadata==="object"&&!Array.isArray(candidate.metadata),"Metadata record required.");
        fields(candidate.completion,["completed","timestamp","evidence"],["completed","timestamp","evidence"]);
        check(typeof candidate.completion.completed==="boolean","Explicit completion state required.");
        fields(candidate.recurrence,["kind","line","rule","syntax","parser"],["kind","line","rule","syntax","parser"]);
        check(["none","source","unknown"].includes(candidate.recurrence.kind),"Unknown recurrence evidence kind.");
        for(const k of["line","rule"])check(candidate.recurrence[k]===null||typeof candidate.recurrence[k]==="string","Invalid recurrence source evidence.");
        check(candidate.recurrence.syntax===null||["tasksPluginEmoji","dataview","unknown"].includes(candidate.recurrence.syntax),"Unknown recurrence syntax contract.");
    } catch (_) {add("INCOMPLETE_TEMPORAL_EVIDENCE","D08","input");return result;}
    let sourceBlocked=false;
    if(candidate.source!==null){
        try {validateEnvelope(candidate.source);}catch(e){if(e.code==="UNSUPPORTED_SCHEMA")return unsupported("UNSUPPORTED_SOURCE_CONTRACT");add("CORRUPT_SOURCE_EVIDENCE","D06","source");return result;}
        if(canonical(candidate.source.source.owner)!==canonical(candidate.owner)){add("SOURCE_OWNER_CONFLICT","D04","source");return result;}
        if(candidate.identity.nativeId!==null&&candidate.source.target.taskId!==candidate.identity.nativeId){add("SOURCE_IDENTITY_CONFLICT","D02","source");return result;}
        if(candidate.source.parsed.status==="quarantined"){sourceBlocked=true;add("SOURCE_CONTENT_QUARANTINED","D06","source");}
        const first=candidate.source.parsed.normalized?.split("\n")[0]??null;
        if(candidate.recurrence.line!==null&&first!==candidate.recurrence.line){add("RECURRENCE_SOURCE_CONFLICT","D09","recurrence.line");return result;}
        // An asserted absence cannot hide recurrence text anywhere in retained evidence.
        if(candidate.recurrence.kind==="none"&&recurrenceMarker(candidate.source.parsed.normalized)){sourceBlocked=true;add("RECURRENCE_ABSENCE_CONFLICT","D09","source");}
    }
    const m=candidate.metadata;
    let normalized;
    try {normalized=validateTaskMetadata(clone(m));result.legacy.status="valid";}
    catch(e){result.legacy={status:"invalid",message:e.message};add("INVALID_LEGACY_DATES","D08","metadata");}
    let incomplete=false;
    try{new Intl.DateTimeFormat("en",{timeZone:candidate.timezone});}catch(_){incomplete=true;add("LOCAL_CLOCK_UNRESOLVED","D08","timezone");}
    for(const key of["fromDate","dueDate","fromTime","dueTime"]){if(own(m,key)&&!empty(m[key])&&typeof m[key]!=="string"){incomplete=true;add("NONSTRING_TEMPORAL_VALUE","D08","metadata."+key);}}
    if(own(m,"necessity")&&!empty(m.necessity)&&!["must","should"].includes(m.necessity)){incomplete=true;add("UNKNOWN_NECESSITY","D08","metadata.necessity");}
    const completion=candidate.completion;
    if(completion.timestamp!==null&&(!Number.isSafeInteger(completion.timestamp)||completion.timestamp<0||!Number.isFinite(new Date(completion.timestamp).getTime())||!completion.completed)){
        incomplete=true;result.completion={status:"invalid",timestamp:completion.timestamp};add("INVALID_COMPLETION_EVIDENCE","D08","completion");
    }else result.completion={status:completion.timestamp!==null?"known-instant":completion.completed?"unknown":"open",timestamp:completion.timestamp};
    if(normalized&&!incomplete){
        const endpoints={start:normalized.fromDate?{date:normalized.fromDate,time:normalized.fromTime??null}:null,due:normalized.dueDate?{date:normalized.dueDate,time:normalized.dueTime??null}:null,importance:normalized.necessity};
        // A validation-only record with a constant probe UUID. No factory or store
        // is called, and this record/UUID is never returned as a planned identity.
        const probe=newTask({id:"00000000-0000-4000-8000-000000000001",owner:candidate.owner,title:"Temporal validation probe",...endpoints,completed:completion.completed,completedAt:completion.timestamp},"validation-only",null,()=>fail("VALIDATION","Identity allocation is forbidden."));
        try{validateTask(probe);result.native={status:"representable",endpoints};}
        catch(_){result.native={status:"incompatible",endpoints};add("LEGACY_NATIVE_DATE_ORDER_MISMATCH","D07","metadata");}
        for(const key of["start","due"]){const w=wallClock(endpoints[key],candidate.timezone);result.wallClocks[key]=w;if(["ambiguous","nonexistent","unresolved"].includes(w.status)){incomplete=true;add("LOCAL_CLOCK_"+w.status.toUpperCase(),"D08",key);}}
    }
    const r=candidate.recurrence,line=r.line??candidate.source?.parsed.normalized?.split("\n")[0]??null;
    const marker=recurrenceMarker(line),present=marker||r.rule!==null;
    result.recurrence.originalRule=r.rule;
    if(r.kind==="none"&&!present&&!sourceBlocked){result.recurrence.status="none";result.recurrence.evidenceLevel="explicit-absence-assertion";}
    else if(r.kind==="unknown"||r.kind==="none"&&present||r.kind==="source"&&line===null){result.recurrence.status="ambiguous";incomplete=true;add("AMBIGUOUS_RECURRENCE_EVIDENCE","D09","recurrence");}
    else if(present){
        if(r.rule!==null&&!r.rule.trim()){result.recurrence.status="malformed";add("MALFORMED_RECURRENCE_EVIDENCE","D09","recurrence.rule");}
        else result.recurrence.status="present-unverified";
        add("NATIVE_RECURRENCE_UNIMPLEMENTED","D09","recurrence");
    }else if(r.kind==="source"){result.recurrence.status="ambiguous";incomplete=true;add("RECURRENCE_INTERPRETATION_UNRESOLVED","D09","recurrence");}
    if(r.parser!==null){
        const p=r.parser;
        try{fields(p,["version","engineVersion","bundleSha256","inputLine","syntax","settings","status","rule"],["version","engineVersion","bundleSha256","inputLine","syntax","settings","status","rule"]);}catch(_){return unsupported("UNSUPPORTED_PARSER_WITNESS");}
        if(p.version!==1||p.engineVersion!=="8.4.0"||p.bundleSha256!==TASKS_HASH)return unsupported("UNSUPPORTED_PARSER_WITNESS");
        if(p.inputLine!==line||p.syntax!==r.syntax||!p.settings||p.settings.taskFormat!==p.syntax||!["recognized","unsupported","none","ineligible"].includes(p.status)||!(p.rule===null||typeof p.rule==="string")||p.status==="recognized"&&!(typeof p.rule==="string"&&p.rule.trim())){
            incomplete=true;add("PARSER_WITNESS_CONFLICT","D09","recurrence.parser");result.recurrence.status="ambiguous";
        }else if(r.kind==="none"&&p.status!=="none"||p.status==="none"&&present){
            incomplete=true;add("PARSER_WITNESS_CONFLICT","D09","recurrence.parser");result.recurrence.status="ambiguous";
        }else if(p.status==="recognized"){
            result.recurrence.status="recognized-unimplemented";result.recurrence.evidenceLevel="supplied-installed-parser-witness";add("NATIVE_RECURRENCE_UNIMPLEMENTED","D09","recurrence");
        }else if(p.status==="unsupported"||p.status==="ineligible"){
            result.recurrence.status="unsupported";result.recurrence.evidenceLevel="supplied-installed-parser-witness";add("UNSUPPORTED_RECURRENCE_RULE","D09","recurrence");
        }
    }
    if(result.legacy.status==="invalid")result.status="invalid-legacy";
    else if(incomplete)result.status="ambiguous-evidence";
    else if(sourceBlocked||result.native.status==="incompatible"||result.recurrence.status!=="none")result.status="quarantined";
    else {result.status="representable";result.temporalGate="clear";}
    return result;
}

function publicTemporalProjection(){fail("PRIVATE_EVIDENCE","Gate A analysis is local/private; no public projection is authorized.");}
module.exports={TEMPORAL_DECISION:DECISION,classifyTemporal,publicTemporalProjection};
