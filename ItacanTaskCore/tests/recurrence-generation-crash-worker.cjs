"use strict";
// Only invoked against guarded OS Temp by the parent; leaves its actual lock.
const {openJsonRepository}=require("../src/json-repository"),{inventory}=require("./recurrence-generation-support.cjs");
const [directory,stage,serialized]=process.argv.slice(2);
(async()=>{const repo=await openJsonRepository({directory,externalReservations:inventory(),fault:at=>{if(at===stage)process.exit(73);}});if(serialized!=="OPEN")await repo.execute(JSON.parse(serialized));await repo.close();})().catch(e=>{process.stderr.write(e.stack+"\n");process.exitCode=1;});
