"use strict";
const {N,id,snapshot,publish}=require("./support.cjs");
(async()=>{const[directory,stage]=process.argv.slice(2),repo=await N.openDirectoryIdentity({directory,idFactory:()=>id(9999),fault:s=>{if(s===stage)process.exit(81);}});await repo.execute(publish(repo,snapshot()));throw Error("Crash stage was not reached");})().catch(e=>{console.error(e);process.exitCode=1;});
