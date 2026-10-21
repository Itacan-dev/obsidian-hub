"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const {unchangedOath}=require("./oath-committed-boundaries.cjs");
const[beforePath,afterPath]=process.argv.slice(2);
function factories(file){const source=fs.readFileSync(file,"utf8");new Function(source);const end=source.indexOf("const __hubModuleCache"),context={};assert(end>0);vm.runInNewContext(source.slice(0,end)+";globalThis.modules=__hubModules;",context);return Object.fromEntries(Object.entries(context.modules).map(([key,value])=>[key,value.toString().replace(/\r\n/g,"\n")]));}
const before=factories(beforePath),after=factories(afterPath),changed=Object.keys(before).filter(n=>before[n]!==after[n]).sort(),added=Object.keys(after).filter(n=>!(n in before)).sort();
assert.deepEqual(changed,["lib/services/oath.js","lib/services/task-service-legacy.js","lib/services/task-service.js"]);assert.deepEqual(added,["lib/services/task-service-legacy-oath-committed.js"]);assert(Object.keys(before).every(n=>n in after));
unchangedOath(before["lib/services/oath.js"],after["lib/services/oath.js"]);
const adapter=after["lib/services/task-service-legacy.js"],start=adapter.indexOf("    async resolveOathWork("),end=adapter.indexOf("    async resolveLegacyAction(");assert(start>=0&&end>start);
assert.equal((adapter.slice(0,start)+adapter.slice(end)).replace("resolveOathWork: true, ",""),before["lib/services/task-service-legacy.js"],"All existing adapter queries, History, identity/action validators, writers and lifecycle unchanged");
assert.equal(after["lib/services/task-service.js"].replace('"resolveOathWork", ',""),before["lib/services/task-service.js"],"Only the read operation was added to facade dispatch");
for(const name of["atlas-native.cjs","strict-oath-assets.json"])assert(fs.readFileSync(path.join(path.dirname(beforePath),name)).equals(fs.readFileSync(path.join(path.dirname(afterPath),name))),"Auxiliary asset unchanged "+name);
assert(!Object.keys(after).some(n=>n.includes("ItacanTaskCore")));
console.log(JSON.stringify({originalModules:Object.keys(before).length,candidateModules:Object.keys(after).length,changed,added,unchangedExistingModules:Object.keys(before).length-changed.length,enrollmentReadNewWorkAndWriters:"byte-identical",previousQueriesAndConsumers:"byte-identical",candidatePolicy:"byte-identical",nativeStrictAssets:"byte-identical"},null,2));
