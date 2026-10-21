"use strict";
// Disposable test child. Intentional process exit leaves the real writer lock
// as evidence; only the parent, after verifying PID/token, moves that lock.
const {openJsonRepository}=require("../src/json-repository"),{inventory}=require("./recurrence-support.cjs");
const [directory,stage,serialized]=process.argv.slice(2);
(async()=>{const repo=await openJsonRepository({directory,externalReservations:inventory(),fault:at=>{if(at===stage)process.exit(73);}});if(serialized!=="OPEN")await repo.execute(JSON.parse(serialized));await repo.close();process.exitCode=0;})().catch(e=>{process.stderr.write(e.stack+"\n");process.exitCode=1;});
