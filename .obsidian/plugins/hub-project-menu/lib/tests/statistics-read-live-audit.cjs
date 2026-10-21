"use strict";
// Read-only field/type census. Never emit user titles, identities or note paths.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),file=path.join(root,"data.json"),bytes=fs.readFileSync(file),data=JSON.parse(bytes),raw=Array.isArray(data.completedTaskHistory)?data.completedTaskHistory:[];
const records=raw.filter(item=>item&&typeof item==="object"&&typeof item.text==="string"&&typeof item.path==="string");
const {recordedHistoryQuery}=require("../services/task-history-legacy-read"),{statisticsCompletions}=require("../services/statistics");
const Module=require("node:module"),frozen=new Module(path.join(root,"lib/domain/statistics-original.js"),module);frozen.filename=frozen.id;
frozen._compile(fs.readFileSync(path.join(__dirname,"statistics-read-domain-original.cjs"),"utf8"),frozen.filename);
const original=frozen.exports,current=require("../domain/statistics"),{queryHistory}=require("../domain/history");
const fields=["id","kind","timestamp","projectId","projectName","project","contextKind","targetKind","resourceType","path"],types={};
for(const field of fields){types[field]={};for(const row of records){const type=!Object.hasOwn(row,field)?"absent":row[field]===null?"null":typeof row[field];types[field][type]=(types[field][type]??0)+1;}}
const query=recordedHistoryQuery(queryHistory(records)),completions=statisticsCompletions(query),now=Date.now(),before=original.prepareStatistics({completions:records},now),after=current.prepareStatistics({completions},now);
for(const[range]of current.RANGES)for(const workspace of["all",...before.registry.keys()])assert.deepEqual(current.aggregateStatistics(after,range,workspace),original.aggregateStatistics(before,range,workspace));
assert(fs.readFileSync(file).equals(bytes),"No persistent data changed during read-only audit");
const result={sha256:crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),storedRows:raw.length,startupAcceptedRows:records.length,fields:types,projectionDiagnostics:query.diagnostics.length,exactCompletionOnlyRangeCohortParity:true};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
