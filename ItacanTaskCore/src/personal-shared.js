"use strict";
// Version dispatch only. Original v1 proof interpretation remains frozen.
const old=require("./personal-shared-v1"),modern=()=>require("./personal-shared-v2");
const out={TYPES:old.TYPES,PERSONAL:[...old.PERSONAL,"personal.upgrade","personal.resolve"],hash:old.hash};
for(const name of ["packet","namespace","graph"])out[name]=(...args)=>(args[0]?.version===2?modern():old)[name](...args);
for(const name of ["checked","validateState","validateRelations","receiptEvidence","atomicReceipt","eventPublication","inspectConflict","storageScope"])out[name]=(...args)=>(args[0]?.personalShared?.version===2?modern():old)[name](...args);
out.validateCommand=c=>(c.payload?.version===2?modern():old).validateCommand(c);
out.apply=(s,c,x)=>(c.payload?.version===2||s.personalShared?.version===2?modern():old).apply(s,c,x);
out.record=(s,...args)=>(s.personalShared?.version===2?modern():old).record(s,...args);
out.previewReceive=(a,b)=>(a.version===2?modern():old).previewReceive(a,b);
for(const name of ["reviewResolution","inspectResolution"])out[name]=(...args)=>modern()[name](...args);
module.exports=out;
