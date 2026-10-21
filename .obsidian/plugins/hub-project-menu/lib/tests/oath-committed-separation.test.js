"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {fixture,commit,projection,request,bridge,scenarios}=require("./oath-committed-fixture.cjs");
const {legacyOathCommitted}=require("../services/task-service-legacy-oath-committed");
for(const[name,change]of Object.entries(scenarios))test("separate original writer and committed projection: "+name,async()=>{
 const f=fixture({original:true});try{commit(f);change(f);const before=f.snapshot();await f.oath.resolveWork();const expected=projection(f.oath.work);const result=await legacyOathCommitted(f.plugin,f.oath.tasks(),request(f));assert.deepEqual(projection(result.rows.map(r=>({ref:r.reference,task:r.task}))),expected);assert.deepEqual(f.snapshot(),before);assert.equal(f.state.writes,0);}finally{await f.close();}
});
for(const options of[{},{preexisting:true},{preexisting:true,indexed:true}])test("both enrollment histories survive read-only separation "+JSON.stringify(options),async()=>{
 const f=fixture({original:true});try{const b=await bridge(f,options),before=f.snapshot(),refs=structuredClone(f.oath.current.tasks);await f.oath.resolveWork();let query=await legacyOathCommitted(f.plugin,f.oath.tasks(),request(f));assert(query.rows[0].task);assert.deepEqual(projection(query.rows.map(r=>({ref:r.reference,task:r.task}))),projection(f.oath.work));b.import();await f.oath.resolveWork();query=await legacyOathCommitted(f.plugin,f.oath.tasks(),request(f));assert.equal(query.rows[0].state,"resolved");assert.equal(query.rows[0].retireAwaitingIndex,true);assert.deepEqual(f.oath.current.tasks,refs);assert.deepEqual(f.snapshot(),before);}finally{await f.close();}
});
test("recovered missing ID has no invented bridge",async()=>{const f=fixture({original:true});try{commit(f,["absent"]);const q=await legacyOathCommitted(f.plugin,f.oath.tasks(),request(f));assert.equal(q.rows[0].task,null);assert.equal(q.rows[0].diagnostics[0].code,"ID_NOT_INDEXED");}finally{await f.close();}});
