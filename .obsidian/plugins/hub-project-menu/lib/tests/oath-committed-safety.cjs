"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../../../../.."),audit=process.argv[2],installed=process.argv.includes("--installed");if(!audit)throw Error("Supply the resumed phase audit directory");
const json=n=>JSON.parse(fs.readFileSync(path.join(audit,n),"utf8").replace(/^\uFEFF/,"")),hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const baseline=json("baseline.json"),originals=new Map(baseline.files.map(f=>[f.path,f.sha256])),plugin=".obsidian/plugins/hub-project-menu/";
const allowed=new Set(["main.js","lib/services/oath.js","lib/services/task-service.js","lib/services/task-service-legacy.js","lib/services/task-service-contract.d.ts","lib/tests/task-service-types.fixture.ts","lib/tests/oath.test.js","lib/tests/task-service-boundary.test.js","lib/tests/oath-candidate-read.test.js","lib/services/TASK-SERVICE.md","lib/services/TASK-SERVICE-PHASE-2B-2F-2.md"].map(n=>plugin+n));
const changed=[],external=[],backups=[];
for(const[name,before]of originals){const file=path.join(root,name);assert(fs.existsSync(file),"Baseline file retained "+name);const after=hash(file);if(after!==before){if(allowed.has(name))changed.push(name);else if(name===".obsidian/workspace.json")external.push({path:name,before,after,restored:false});else throw Error("Unexpected baseline change "+name);}}
for(const relative of json("original-backups.json")){const name=plugin+relative;assert.equal(hash(path.join(baseline.backup,"before",name)),originals.get(name),"Verified original backup "+name);backups.push(name);}
const run=(cmd,args)=>cp.execFileSync(cmd,args,{cwd:root,windowsHide:true,encoding:"utf8"}).trimEnd().split(/\r?\n/).filter(Boolean),git=args=>run("git",["-c","core.quotepath=false",...args]);
const status=new Set(git(["status","--short"]));assert(baseline.status.every(s=>status.has(s)),"Every initial Git entry retained");
const all=run("rg",["--files","--hidden","--no-ignore","-g","!System/Backups/**","-g","!**/.git/**","-g","!**/node_modules/**","-g","!**/.trash/**"]).map(n=>n.replace(/\\/g,"/"));
const names=[...new Set([...git(["ls-files","--cached","--others","--exclude-standard"]),...all.filter(n=>n.endsWith(".md"))].map(n=>n.replace(/\\/g,"/")))];
const added=names.filter(n=>!originals.has(n)&&!n.startsWith("System/Backups/"));for(const name of added)assert(name.startsWith(plugin+"lib/tests/oath-committed")||["lib/services/task-service-legacy-oath-committed.js","lib/services/TASK-SERVICE-PHASE-2B-CONSOLIDATED-AUDIT.md"].some(n=>plugin+n===name),"Only authorized phase files added "+name);
const nativeFiles=all.filter(n=>/\/(?:CURRENT(?:\.json)?|WRITER\.lock)$|\/generations\//i.test(n));assert.deepEqual(nativeFiles,[]);
const candidate=hash(path.join(audit,"candidate-build/main.js")),beforeBundle=originals.get(plugin+"main.js");assert.equal(hash(path.join(root,plugin+"main.js")),installed?candidate:beforeBundle);
const phaseFiles=[...new Set([...changed,...added])],whitespace=path.join(audit,"whitespace");fs.mkdirSync(whitespace,{recursive:true});
const captures={"oath-committed-original.cjs":"lib/services/oath.js","oath-committed-ui-original.cjs":"lib/ui/oath.js"};
for(const[i,name]of phaseFiles.entries()){
 const file=path.join(root,name),after=fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n"),capture=captures[path.basename(name)];
 let before=originals.has(name)?fs.readFileSync(path.join(baseline.backup,"before",name),"utf8").replace(/\r\n/g,"\n"):"";
 if(capture){assert.equal(hash(file),originals.get(plugin+capture),"Frozen source matches resumed baseline "+capture);before=after;}
 if(name===plugin+"lib/tests/oath-committed.html")before=fs.readFileSync(path.join(root,plugin+"lib/tests/oath-candidate.html"),"utf8").replace(/\r\n/g,"\n");
 const a=path.join(whitespace,i+".before"),b=path.join(whitespace,i+".after");fs.writeFileSync(a,before);fs.writeFileSync(b,after);
 const result=cp.spawnSync("git",["-c","core.autocrlf=false","-c","core.safecrlf=false","diff","--no-index","--check",a,b],{windowsHide:true,encoding:"utf8"});assert([0,1].includes(result.status)&&!result.stdout.trim()&&!result.stderr.trim(),"No introduced whitespace "+name+result.stdout+result.stderr);
}
const result={baselineFiles:originals.size,initialStatusEntries:baseline.status.length,changed,added,externalApplicationManagedChanges:external,verifiedOriginalBackups:backups,nativeFiles,beforeBundle,candidateBundle:candidate,installed,whitespace:"no introduced errors",phaseFiles:phaseFiles.map(n=>({path:n,sha256:hash(path.join(root,n))}))};fs.writeFileSync(path.join(audit,installed?"safety-final.json":"safety-preinstall.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({...result,phaseFiles:undefined,changed:changed.length,added:added.length,verifiedOriginalBackups:backups.length},null,2));
