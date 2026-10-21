"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const[beforePath,afterPath]=process.argv.slice(2);
function factories(file){const source=fs.readFileSync(file,"utf8");new Function(source);const end=source.indexOf("const __hubModuleCache");assert(end>0);const context={};vm.runInNewContext(source.slice(0,end)+";globalThis.modules=__hubModules;",context);return Object.fromEntries(Object.entries(context.modules).map(([name,value])=>[name,value.toString().replace(/\r\n/g,"\n")]));}
const before=factories(beforePath),after=factories(afterPath),changed=Object.keys(before).filter(name=>before[name]!==after[name]).sort(),added=Object.keys(after).filter(name=>!(name in before)).sort();
assert.deepEqual(changed,["lib/services/task-service-legacy.js","plugin.js"]);assert.deepEqual(added,["lib/services/task-history-legacy-read.js","lib/services/task-history-read.js"]);
assert(Object.keys(before).every(name=>name in after));
const factory='        window.hubCreateTaskHistoryRead = options => __hubRequire("lib/services/task-history-read.js").createTaskHistoryRead({ plugin: this, ...options });\n';
assert(after["plugin.js"].replace(factory,"").replace('        delete window.hubCreateTaskHistoryRead;\n',"")===before["plugin.js"],"Only History host factory/cleanup changed; Wizard normalization/getters, writers, notifications and every other plugin method are identical");
assert(after["lib/services/task-service-legacy.js"].replace('        requireTaskValue(!query.projection || query.projection === "recorded", "Unsupported History projection.");\n',"")
    .replace('        if (query.projection === "recorded") return __hubRequire("lib/services/task-history-legacy-read.js").recordedHistoryQuery(records, id);\n',"")===before["lib/services/task-service-legacy.js"],
    "Only explicit recorded History dispatch changed; default History API, all previous task policies, validators, subscriptions and facade writers identical");
for(const name of["atlas-native.cjs","strict-oath-assets.json"])assert(fs.readFileSync(path.join(path.dirname(beforePath),name)).equals(fs.readFileSync(path.join(path.dirname(afterPath),name))));
assert(!Object.keys(after).some(name=>name.includes("ItacanTaskCore")));
const root=path.resolve(__dirname,"../../../../.."),text=file=>fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n"),between=(source,a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const home=text(path.join(root,"System/Dashboards/Home/view.js")),project=text(path.join(root,"System/Dashboards/Project/view.js")),oldHome=text(path.join(__dirname,"history-read-home-original.cjs")),oldProject=text(path.join(__dirname,"history-read-project-original.cjs"));
assert.equal(between(home,"// ---------- Tasks to Do ----------","// ---------- CALENDAR ----------"),between(oldHome,"// ---------- Tasks to Do ----------","// ---------- CALENDAR ----------"),"Entire Home Tasks UI/read/action integration unchanged");
assert.equal(between(home,"async function loadTaskData(","async function loadSecondaryData()"),between(oldHome,"async function loadTaskData(","async function loadSecondaryData()"),"Home task enumeration/read publication unchanged");
assert.equal(between(home,"function renderTaskContext()","frame.defer("),between(oldHome,"function renderTaskContext()","frame.defer("),"Home task grouping/counts unchanged");
assert.equal(between(project,"// ---------- CURRENT TASKS ----------","// ---------- PROGRESS ----------"),between(oldProject,"// ---------- CURRENT TASKS ----------","// ---------- PROGRESS ----------"),"Entire Project/Resource Tasks panel integration unchanged");
for(const[actual,original,name]of[[home,oldHome,"renderCompletedTaskHistory"],[project,oldProject,"renderProjectTaskHistory"]]){
    const portion=source=>between(source,"function "+name+"()","function "+(name==="renderCompletedTaskHistory"?"renderActiveProgressView":"renderProjectProgressView")+"()");
    const filter=source=>{const code=portion(source);return code.slice(code.indexOf(".filter(item => {"),code.indexOf("    if (items.length"));};
    assert.equal(filter(actual),filter(original),"Recorded ownership/filter/sort semantics unchanged: "+name);
}
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;new AsyncFunction(home);new AsyncFunction(project);
console.log(JSON.stringify({originalModules:Object.keys(before).length,candidateModules:Object.keys(after).length,unchangedExistingModules:Object.keys(before).length-changed.length,changed,added,
    allWritersAndPreviousConsumers:"identical",statisticsProgressOath:"identical",homeAndWorkspaceTasks:"identical",historicalFilteringAndOrdering:"identical",otherAssets:"identical"},null,2));
