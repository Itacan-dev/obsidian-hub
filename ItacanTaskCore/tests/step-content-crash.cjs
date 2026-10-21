"use strict";
const{openJsonRepository}=require("../src/json-repository"),{id,NOW}=require("./step-content-support.cjs");
(async()=>{const[directory,stage,payload]=process.argv.slice(2);let seq=9000;const r=await openJsonRepository({directory,idFactory:()=>id(++seq),clock:()=>NOW,fault:s=>{if(s===stage)process.exit(84);}});await r.execute(JSON.parse(payload));throw Error("Crash stage not reached");})().catch(e=>{console.error(e);process.exitCode=1;});
