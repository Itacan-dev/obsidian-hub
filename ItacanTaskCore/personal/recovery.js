"use strict";
// Bootstrap recovery has no task-creation API and never allocates a replacement operation.
const {createNativeWriterSession}=require("../writer"),{check}=require("../src/errors");
async function openPersonalRecovery(config,options){
 check(options.personalSync&&options.requestRetention?.version===(options.personalSync.binding.version===2?4:3),"Explicit personal recovery admission required.");
 const session=createNativeWriterSession(config,options);
 try{await session.host.open({version:1,expectedAuthorityId:config.authorityId,...(config.scope==="inactive-disposable"?{syntheticOnly:true}:{verifiedCutover:true})})}catch(e){await session.dispose();throw e}
 let closed=false;async function withGrant(fn){check(!closed,"Personal recovery closed.");const cap=await session.authorize({version:1,owners:options.writerPolicy.owners,commands:options.writerPolicy.commands});try{return await fn(cap)}finally{session.revoke(cap)}}
 return Object.freeze({personal:{recoveryOnly:true},retained:()=>withGrant(cap=>session.requests.list(cap)),recovery:Object.freeze({inspect:id=>withGrant(cap=>session.requests.inspect(cap,id)),reconcile:async id=>withGrant(async cap=>{await session.requests.reconcile(cap,id);return{inspection:await session.requests.inspect(cap,id),presentation:{state:"not-requested",code:"PERSONAL_RECOVERY_REOPEN_REQUIRED"}}}),replay:review=>withGrant(cap=>session.requests.replay(cap,review))}),async close(){if(closed)return;closed=true;await session.dispose()}});
}
module.exports={openPersonalRecovery};
