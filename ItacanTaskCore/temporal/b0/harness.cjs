"use strict";
// B0 test-only observer. Reuse Gate A's exact fake host and installed engine.
// The in-memory change exposes the test host's VM; no existing file or installed
// parser/recurrence/status/serializer function is changed.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),vm=require("node:vm"),crypto=require("node:crypto");
const filename=require.resolve("../tests/tasks-harness.cjs"),source=fs.readFileSync(filename,"utf8"),token="return{run,witness,settings:configured";
if(source.split(token).length!==2)throw Error("Gate A harness shape changed; review B0 accessor before execution.");
const compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(path.dirname(filename));
compiled._compile(source.replace(token,"return{context,run,witness,settings:configured"),filename);
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
function createHarness(options={}){
 const base=compiled.exports.createHarness(options),context=base.context;
 if(base.provenance.momentVersion!=="2.29.4"||base.provenance.momentSha256!=="ecb84d57d5a7e3ec5f115bef667656f2b9ede90a03020525a2af3573ea277453")throw Error("Unreviewed Moment dependency; stop, do not recapture old evidence.");
 function inspect(line,{query=null}={}){
  context.syntheticLine=line;context.syntheticPath="Projects/Synthetic/B0.md";context.b0Query=query;
  return JSON.parse(vm.runInContext(String.raw`JSON.stringify((()=>{
   const t=gateA.ye.fromLine({line:syntheticLine,taskLocation:gateA.Jt.fromUnknownPosition(new gateA.ut(syntheticPath)),fallbackDate:null});
   const stamp=v=>{if(v==null)return {kind:'null',iso:null,local:null};const m=window.moment(v);return m.isValid()?{kind:'valid',iso:m.toISOString(),local:m.format('YYYY-MM-DDTHH:mm:ssZ')}:{kind:'invalid',iso:null,local:null};};
   if(!t)return {eligible:false,recurrence:null};const r=t.recurrence;
   if(!r)return {eligible:true,description:t.description,recurrence:null};
   const reference=r.occurrence.referenceDate,cutoff=r.baseOnToday?window.moment().endOf('day').utc(true):reference?window.moment(reference).endOf('day').utc(true):window.moment().endOf('day').utc(true);
   const options=o=>({freq:o.freq,interval:o.interval??1,count:o.count??null,dtstart:stamp(o.dtstart),until:stamp(o.until),byweekday:o.byweekday??null});
   const original=options(r.rrule.origOptions),effective=options(r.rrule.options);
   let rawAfter,nextReference;
   try{rawAfter=stamp(r.rrule.after(b0Query?new Date(b0Query):cutoff.toDate()));}catch(e){rawAfter={kind:'error',message:e.message};}
   try{nextReference=stamp(r.nextReferenceDate(window.moment()));}catch(e){nextReference={kind:'error',message:e.message};}
   return {eligible:true,description:t.description,recurrence:{normalizedRule:r.toText(),baseOnToday:r.baseOnToday,reference:stamp(reference),
    originalOptions:original,effectiveOptions:effective,optionsAfterNextReference:options(r.rrule.origOptions),
    query:stamp(b0Query?new Date(b0Query):cutoff.toDate()),queryMeaning:b0Query?'explicit raw RRule probe, not Tasks reference override':r.baseOnToday?'Tasks completion-local-day UTC-preserving-wall-clock cutoff':'Tasks fixed-reference end-of-day UTC-preserving-wall-clock cutoff',rawAfter,nextReference}};
  })())`,context,{timeout:5000}));
 }
 return{run:base.run,witness:base.witness,inspect,settings:base.settings,statuses:base.statuses,isolation:base.isolation,
  provenance:{...base.provenance,phase:"B0 evidence only",gateAHarnessSha256:hash(source),observer:"Gate A host VM exposed only in memory; actual RRule/Tasks methods observed without algorithm replacement"}};
}
module.exports={createHarness};
