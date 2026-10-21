"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../../../../.."),audit=process.argv[2],installed=process.argv.includes("--installed");
if(!audit)throw Error("Supply fresh audit directory");
const json=name=>JSON.parse(fs.readFileSync(path.join(audit,name),"utf8").replace(/^\uFEFF/,"")),hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const baseline=json("baseline.json"),originals=new Map(baseline.files.map(f=>[f.path,f.sha256.toUpperCase()])),plugin=".obsidian/plugins/hub-project-menu/";
const allowed=new Set(["main.js","lib/services/statistics.js","lib/ui/statistics.js","lib/services/task-history-legacy-read.js","lib/services/task-service-contract.d.ts","lib/services/TASK-SERVICE.md","lib/services/TASK-SERVICE-PHASE-2B-2E-2.md","lib/services/TASK-SERVICE-PHASE-2B-2F.md","lib/tests/statistics.test.js","lib/tests/history-read-writers.test.js","lib/tests/task-service-types.fixture.ts","lib/tests/statistics.html"].map(n=>plugin+n));
const changed=[],external=[],backups=[];
for(const name of["phase-c-interactions.html","task-configured-feedback.html"])allowed.add(plugin+"lib/tests/"+name);
for(const[name,before]of originals){const file=path.join(root,name);assert(fs.existsSync(file),"No baseline file disappeared: "+name);if(hash(file)!==before){if(allowed.has(name))changed.push(name);else if(name===".obsidian/workspace.json")external.push(name);else throw Error("Unexpected change: "+name);}if(allowed.has(name)){const backup=path.join(baseline.backup,"before",name);assert.equal(hash(backup),before,"Verified original backup: "+name);backups.push(name);}}
const run=(cmd,args)=>cp.execFileSync(cmd,args,{cwd:root,windowsHide:true,encoding:"utf8"}).trimEnd().split(/\r?\n/).filter(Boolean),git=args=>run("git",["-c","core.quotepath=false",...args]);
const status=new Set(git(["status","--short"]));assert(baseline.status.every(s=>status.has(s)),"Every initial Git status entry retained");
const allFiles=run("rg",["--files","--hidden","--no-ignore","-g","!System/Backups/**","-g","!**/.git/**","-g","!**/node_modules/**","-g","!**/.trash/**"]).map(n=>n.replace(/\\/g,"/"));
const names=[...new Set([...git(["ls-files","--cached","--others","--exclude-standard"]),...allFiles.filter(n=>n.endsWith(".md"))].map(n=>n.replace(/\\/g,"/")))];
const added=names.filter(n=>!originals.has(n)&&!n.startsWith("System/Backups/"));for(const name of added)assert(name.startsWith(plugin+"lib/tests/statistics-read"),"Only phase files added: "+name);
const nativeFiles=allFiles.filter(n=>/\/(?:CURRENT(?:\.json)?|WRITER\.lock)$|\/generations\//i.test(n));assert.equal(nativeFiles.length,0);
const beforeBundle=originals.get(plugin+"main.js"),candidate=hash(path.join(audit,"candidate-build/main.js"));assert.equal(hash(path.join(root,plugin+"main.js")),installed?candidate:beforeBundle);
const captures={"statistics-read-service-original.cjs":"lib/services/statistics.js","statistics-read-ui-original.cjs":"lib/ui/statistics.js","statistics-read-domain-original.cjs":"lib/domain/statistics.js"};
const phaseFiles=[...new Set([...changed,...added])],whitespace=path.join(audit,"whitespace");fs.mkdirSync(whitespace,{recursive:true});
for(const[i,name]of phaseFiles.entries()){
 let before=originals.has(name)?fs.readFileSync(path.join(baseline.backup,"before",name),"utf8").replace(/\r\n/g,"\n"):"";
 const file=path.join(root,name),after=fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n"),capture=captures[path.basename(name)];
 if(capture){assert.equal(hash(file),originals.get(plugin+capture),"Frozen original matches initial baseline: "+capture);before=after;}
 const a=path.join(whitespace,i+".before"),b=path.join(whitespace,i+".after");fs.writeFileSync(a,before);fs.writeFileSync(b,after);
 const result=cp.spawnSync("git",["-c","core.autocrlf=false","-c","core.safecrlf=false","diff","--no-index","--check",a,b],{windowsHide:true,encoding:"utf8"});assert([0,1].includes(result.status)&&!result.stdout.trim()&&!result.stderr.trim(),"Introduced whitespace: "+name+result.stdout+result.stderr);
}
const result={baselineFiles:originals.size,initialStatusEntries:baseline.status.length,changed,added,externalApplicationManagedChanges:external,verifiedOriginalBackups:backups,nativeFiles,beforeBundle,candidateBundle:candidate,installed,whitespace:"no introduced errors",phaseFiles:phaseFiles.map(n=>({path:n,sha256:hash(path.join(root,n))}))};
fs.writeFileSync(path.join(audit,installed?"safety-final.json":"safety-preinstall.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({...result,phaseFiles:undefined,changed:changed.length,added:added.length,verifiedOriginalBackups:backups.length},null,2));
