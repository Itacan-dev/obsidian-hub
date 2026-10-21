"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const[beforePath,afterPath]=process.argv.slice(2);
function factories(file){const source=fs.readFileSync(file,"utf8");new Function(source);const end=source.indexOf("const __hubModuleCache");assert(end>0);const context={};vm.runInNewContext(source.slice(0,end)+";globalThis.modules=__hubModules;",context);return Object.fromEntries(Object.entries(context.modules).map(([name,value])=>[name,value.toString().replace(/\r\n/g,"\n")]));}
const before=factories(beforePath),after=factories(afterPath),changed=Object.keys(before).filter(name=>before[name]!==after[name]).sort(),added=Object.keys(after).filter(name=>!(name in before)).sort();
assert.deepEqual(changed,["lib/services/statistics.js","lib/services/task-history-legacy-read.js","lib/ui/statistics.js"]);assert.deepEqual(added,[]);assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
for(const name of["atlas-native.cjs","strict-oath-assets.json"])assert(fs.readFileSync(path.join(path.dirname(beforePath),name)).equals(fs.readFileSync(path.join(path.dirname(afterPath),name))));
assert(!Object.keys(after).some(name=>name.includes("ItacanTaskCore")));
assert.equal(after["lib/domain/statistics.js"],before["lib/domain/statistics.js"]);
assert.equal(after["plugin.js"],before["plugin.js"]);assert.equal(after["lib/services/task-service-legacy.js"],before["lib/services/task-service-legacy.js"]);
console.log(JSON.stringify({modules:Object.keys(after).length,changed,unchanged:Object.keys(before).length-changed.length,added,writers:"identical",domainStatistics:"identical",otherProvidersAndConsumers:"identical",auxiliaryAssets:"identical"},null,2));
