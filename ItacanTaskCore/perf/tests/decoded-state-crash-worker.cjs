"use strict";
const J=require("../../src/json-repository"),crypto=require("node:crypto"),fs=require("node:fs/promises"),os=require("node:os");
const pause=async stage=>{const lock=await fs.readFile(require("node:path").join(process.env.P2_DIRECTORY,"WRITER.lock"),"utf8");process.send({stage,pid:process.pid,host:os.hostname(),lock});await new Promise(()=>{});};
process.once("message",async c=>{try{let armed=false;const original=J.JsonGenerationStorage.prototype.verify;if(c.stage==="decoded-reconstruction")J.JsonGenerationStorage.prototype.verify=async function(...args){const result=await original.apply(this,args);await pause(c.stage);return result;};
 const repo=await J.openJsonRepository({directory:c.directory,storageFormat:"private-v4",expectedAuthorityId:c.authorityId,idFactory:crypto.randomUUID,clock:()=>1792400000000,externalReservations:c.inventory,resolvers:{},fault:async stage=>{if(armed&&stage===c.stage)await pause(stage);}});armed=true;await repo.execute(c.command);throw Error("Expected parent interruption stage was not reached");
}catch(e){process.send?.({error:e.stack});process.exitCode=1;process.disconnect();}});
