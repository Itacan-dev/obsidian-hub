"use strict";
const {check}=require("./errors");
const {clone}=require("./value");
const leap=y=>y%4===0&&(y%100!==0||y%400===0);
function civilDay(date){const[y,m,d]=date.split("-").map(Number),p=y-1;return 365*p+Math.floor(p/4)-Math.floor(p/100)+Math.floor(p/400)+[0,31,59,90,120,151,181,212,243,273,304,334][m-1]+(m>2&&leap(y)?1:0)+d;}
function dateFromDay(day){
 check(Number.isSafeInteger(day)&&day>=1&&day<=3652059,"Recurrence date is outside calendar range 0001..9999.");
 let lo=1,hi=9999;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(civilDay(String(mid).padStart(4,"0")+"-01-01")<=day)lo=mid;else hi=mid-1;}
 let rest=day-civilDay(String(lo).padStart(4,"0")+"-01-01")+1,m=1;const lengths=[31,leap(lo)?29:28,31,30,31,30,31,31,30,31,30,31];while(rest>lengths[m-1])rest-=lengths[m++-1];
 return String(lo).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(rest).padStart(2,"0");
}
function calculateRecurrenceEndpoints(revision,nextOrdinal){
 require("./recurrence").validateRuleRevision(revision);
 check(Number.isSafeInteger(nextOrdinal)&&nextOrdinal>=2,"Next ordinal must be a safe integer >=2.");
 const r=revision.rule,o=revision.offsets,stride=r.interval*(r.frequency==="DAILY"?1:7),delta=(nextOrdinal-1)*stride;
 check(Number.isSafeInteger(stride)&&Number.isSafeInteger(delta),"Recurrence arithmetic exceeds safe integer precision.");
 const anchorDay=civilDay(o.date)+delta;check(Number.isSafeInteger(anchorDay),"Unsafe recurrence anchor.");const anchor=dateFromDay(anchorDay);
 const endpoint=offset=>offset===null?null:{date:dateFromDay(anchorDay+offset),time:null};
 const endpoints={start:endpoint(o.startDays),due:endpoint(o.dueDays)};
 for(const e of Object.values(endpoints))require("./domain").dateEndpoint(e);
 check(!endpoints.start||!endpoints.due||endpoints.start.date<=endpoints.due.date,"Calculated endpoints reversed.");
 return{version:1,policy:"fixed-origin-civil-day-v1",ruleId:revision.ruleId,ruleRevision:revision.revision,ruleDigest:revision.digest,frequency:r.frequency,interval:r.interval,origin:clone(revision.origin),ordinal:nextOrdinal,anchor,offsets:clone(o),zone:r.calendar.zone,endpoints};
}
module.exports={calculateRecurrenceEndpoints};
