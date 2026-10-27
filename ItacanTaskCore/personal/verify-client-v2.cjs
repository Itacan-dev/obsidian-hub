"use strict";
// Read-only software consistency check. No enrollment, key, writer or transport action.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const m=JSON.parse(fs.readFileSync(path.join(__dirname,"CLIENT-V2.json"),"utf8")),plugin=path.resolve(process.argv[2]||path.join(__dirname,"../../.obsidian/plugins/hub-project-menu")),vault=path.resolve(plugin,"../../.."),bad=[];
for(const [root,files] of [[plugin,m.assets],[vault,m.dashboardSources],[vault,m.onboardingSources]])for(const [name,expected]of Object.entries(files)){const file=path.join(root,name);try{if(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")!==expected)bad.push(name)}catch(_){bad.push(name)}}
if(bad.length){console.error("WAIT: missing, undownloaded or mismatched files:",bad.join("\n"));process.exitCode=1}else console.log("PASS compatible Personal Sync v2 client: "+m.mainSha256+". This does not verify pairing, cloud delivery or local authority activation.");
