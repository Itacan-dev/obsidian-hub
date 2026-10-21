"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{randomUUID,createHash}=require("node:crypto"),{spawnSync}=require("node:child_process");
const {calculateRecurrenceEndpoints}=require("../src"),{canonical}=require("../src/value");
function rule(origin={start:null,due:{date:"2026-10-17",time:null}},patch={}){
 const day=d=>{const[y,m,n]=d.split("-").map(Number),date=new Date(0);date.setUTCFullYear(y,m-1,n);date.setUTCHours(0,0,0,0);return date.getTime()/86400000;},anchor=origin.due??origin.start;
 const r={version:1,ruleId:randomUUID(),seriesId:randomUUID(),revision:1,previousDigest:null,rule:{version:1,frequency:"DAILY",interval:1,referencePolicy:"fixed-origin",calendar:{calendar:"gregory",zone:"Europe/Stockholm"},...patch},origin,originOrdinal:1,offsets:{anchor:origin.due?"due":"start",date:anchor.date,startDays:origin.start?day(origin.start.date)-day(anchor.date):null,dueDays:origin.due?0:null},effectiveAfterOccurrenceId:randomUUID(),reason:"Calendar evidence",operationId:"calendar",createdAt:1,originalEvidenceRef:null,digest:null};r.digest=createHash("sha256").update(canonical(r)).digest("hex");return r;
}
const ep=date=>date===null?null:{date,time:null};
const cases=[
 ["daily one",null,"2026-10-17",{},2,null,"2026-10-18"],
 ["daily interval",null,"2026-10-17",{interval:3},3,null,"2026-10-23"],
 ["weekly one",null,"2026-10-17",{frequency:"WEEKLY"},2,null,"2026-10-24"],
 ["weekly interval",null,"2026-10-17",{frequency:"WEEKLY",interval:3},4,null,"2026-12-19"],
 ["start only","2026-10-17",null,{},2,"2026-10-18",null],
 ["due offsets","2026-10-14","2026-10-17",{},2,"2026-10-15","2026-10-18"],
 ["equal endpoints","2026-10-17","2026-10-17",{},2,"2026-10-18","2026-10-18"],
 ["winter",null,"2026-01-10",{},2,null,"2026-01-11"],
 ["summer",null,"2026-07-10",{},2,null,"2026-07-11"],
 ["spring DST",null,"2026-03-28",{},2,null,"2026-03-29"],
 ["autumn DST",null,"2026-10-24",{},2,null,"2026-10-25"],
 ["month end",null,"2026-01-31",{},2,null,"2026-02-01"],
 ["leap day",null,"2024-02-28",{},2,null,"2024-02-29"],
 ["after leap",null,"2024-02-29",{},2,null,"2024-03-01"],
 ["century not leap",null,"2100-02-28",{},2,null,"2100-03-01"],
 ["400 year leap",null,"2000-02-28",{},2,null,"2000-02-29"],
 ["year end",null,"2026-12-31",{},2,null,"2027-01-01"],
 ["range minimum",null,"0001-01-01",{},2,null,"0001-01-02"],
 ["range maximum",null,"9999-12-30",{},2,null,"9999-12-31"],
 ["large interval",null,"0001-01-01",{interval:3652058},2,null,"9999-12-31"]
];
for(const[name,start,due,patch,ordinal,nextStart,nextDue]of cases)test("B2 calculator: "+name,()=>{const r=rule({start:ep(start),due:ep(due)},patch),before=structuredClone(r),v=calculateRecurrenceEndpoints(r,ordinal);assert.deepEqual(v.endpoints,{start:ep(nextStart),due:ep(nextDue)});assert.equal(v.ruleDigest,r.digest);assert.equal(v.ordinal,ordinal);assert.deepEqual(r,before);});
for(const[label,make,ordinal]of[
 ["unsafe interval product",()=>rule(undefined,{interval:Number.MAX_SAFE_INTEGER,frequency:"WEEKLY"}),2],
 ["unsafe ordinal product",()=>rule(undefined,{interval:2}),Number.MAX_SAFE_INTEGER],
 ["range exhausted",()=>rule({start:null,due:ep("9999-12-31")}),2],
 ["unsafe ordinal",()=>rule(),Number.MAX_SAFE_INTEGER+1],
 ["non-successor ordinal",()=>rule(),1],
 ["fractional ordinal",()=>rule(),2.1],
 ["timed midnight",()=>rule({start:null,due:{date:"2026-10-17",time:"00:00"}}),2],
 ["reversed endpoints",()=>rule({start:ep("2026-10-18"),due:ep("2026-10-17")}),2],
 ["unsupported monthly",()=>rule(undefined,{frequency:"MONTHLY"}),2],
 ["unsupported when-done",()=>rule(undefined,{referencePolicy:"when-done"}),2],
 ["unsupported bounds",()=>rule(undefined,{count:3}),2],
 ["invalid date",()=>rule({start:null,due:ep("2026-02-30")}),2]
])test("B2 calculator rejects "+label,()=>assert.throws(()=>calculateRecurrenceEndpoints(make(),ordinal)));
test("B2 calculator successive ordinals match an independent UTC calendar oracle",()=>{const r=rule({start:ep("1999-12-25"),due:ep("2000-01-01")},{frequency:"WEEKLY",interval:13});for(let ordinal=2;ordinal<500;ordinal++){const day=new Date(Date.UTC(2000,0,1));day.setUTCDate(day.getUTCDate()+(ordinal-1)*91);assert.equal(calculateRecurrenceEndpoints(r,ordinal).endpoints.due.date,day.toISOString().slice(0,10));}});
test("B2 calculator is independent of actual device timezone",()=>{const r=rule(),source=`const {calculateRecurrenceEndpoints}=require(${JSON.stringify(require.resolve("../src"))});process.stdout.write(JSON.stringify(calculateRecurrenceEndpoints(${JSON.stringify(r)},200)));`;let expected;for(const TZ of ["UTC","Europe/Stockholm","America/New_York","Pacific/Auckland"]){const p=spawnSync(process.execPath,["-e",source],{env:{...process.env,TZ,ELECTRON_RUN_AS_NODE:"1"},windowsHide:true,encoding:"utf8"});assert.equal(p.status,0,p.stderr);if(expected)assert.equal(p.stdout,expected);expected=p.stdout;}});
module.exports={rule};
