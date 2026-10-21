"use strict";
const assert=require("node:assert/strict"),{createHarness}=require("./harness.cjs"),{cases,chainCases,clockCases}=require("./cases.cjs"),{classifyTemporal}=require("../index"),{candidate}=require("../tests/fixtures.cjs");
const tasks=require("../../../.obsidian/plugins/hub-project-menu/lib/domain/tasks"),planning=require("../../../.obsidian/plugins/hub-project-menu/lib/domain/task-planning");
async function capture(zone){
 assert(["Europe/Stockholm","UTC","America/New_York"].includes(zone));assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone,zone,"Timezone must be selected before process launch");
 const result={zone,cases:[],chains:[],nested:[],clocks:[],legacyMetadata:[]};
 for(const c of cases){const h=createHarness(c);let observed;try{observed={kind:"returned",inspection:h.inspect(c.line,{query:c.query}),execution:h.run(c.line)}}catch(e){observed={kind:"threw",message:e.message}}result.cases.push({...c,settings:h.settings,statuses:h.statuses,provenance:h.provenance,observed,isolation:h.isolation(),evidenceLevel:"executed-installed"});}
 for(const c of chainCases){const h=createHarness(),records=[];let line=c.line;for(const action of c.actions){const before=line;if(action==="replace-rule")line=line.replace("every day","every week");else if(action==="replace-due")line=line.replace(/📅 \d{4}-\d{2}-\d{2}/u,"📅 2026-11-01");else{const output=h.run(line),inspection=h.inspect(line);records.push({action,input:line,inspection,output});const selected=action==="completed"?output.after.find(x=>x.parsed?.statusType==="DONE"):output.after.find(x=>x.parsed?.statusType==="TODO");if(!selected){records.push({stopped:"No selected occurrence",action});break;}line=selected.line;continue;}records.push({action,input:before,output:line});}result.chains.push({...c,records,provenance:h.provenance,evidenceLevel:"executed-installed-transforms"});}
 for(const settings of[{}, {recurrenceOnNextLine:true}])for(const deletion of[false,true]){
  const h=createHarness({settings}),parent="- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 "+(deletion?"every day until 2026-10-17 🏁 delete":"every day")+" 📅 2026-10-17";
  const source="- [ ] Previous <!-- hub-task:previous -->\n"+parent+"\n    - [ ] Child <!-- hub-task:child -->\n        - [x] Grandchild <!-- hub-task:grandchild -->\n- [ ] Following <!-- hub-task:following -->\n",output=h.run(parent);
  const edit=tasks.editTaskContent(source,{path:"Projects/Synthetic/B0.md",line:1,text:tasks.taskDisplayText(tasks.taskLineDetails(parent).text),hubTaskId:"b0-parent",completed:true},()=>output.output.text),snapshots=[];
  const lines=edit.content.split("\n");for(let i=0;i<lines.length;i++){if(!/^\S/.test(lines[i])||!tasks.taskLineDetails(lines[i]))continue;const details=tasks.taskLineDetails(lines[i]),snapshot=planning.readTaskSnapshot(edit.content,{path:"Projects/Synthetic/B0.md",line:i,text:tasks.taskDisplayText(details.text),hubTaskId:null});snapshots.push({hubId:tasks.taskIdentity(lines[i]),line:i,completed:snapshot.completed,steps:snapshot.steps});}
  result.nested.push({settings:h.settings,deletion,input:source,tasksOutput:output,splice:edit,snapshots,evidenceLevel:"executed-installed-plus-pure-itacan-splice"});
 }
 for(const c of clockCases){const analyze=endpoint=>classifyTemporal(candidate({timezone:zone,metadata:{dueDate:endpoint.date,...(endpoint.time===null?{}:{dueTime:endpoint.time})}}));const from=analyze(c.from),to=analyze(c.to);let elapsedHours=null,after24Hours=null;
  if(from.wallClocks.due?.status==="unique"&&to.wallClocks.due?.status==="unique"){const first=from.wallClocks.due.candidateInstants[0];elapsedHours=(to.wallClocks.due.candidateInstants[0]-first)/3600000;after24Hours=new Intl.DateTimeFormat("sv-SE",{timeZone:zone,dateStyle:"short",timeStyle:"short",hourCycle:"h23"}).format(new Date(first+86400000));}
  result.clocks.push({...c,from,to,elapsedHours,after24Hours,evidenceLevel:"executed-gate-a-classifier-on-explicit-candidate-pair",limitation:"Candidate dates/times are manually specified policy comparisons, not native recurrence generation."});
 }
 const{fixture}=require("../../../.obsidian/plugins/hub-project-menu/lib/tests/task-service-fixture.cjs"),previousNow=Date.now;Date.now=()=>1792224000000;
 try{for(const[id,metadata]of[["TIME-metadata-timed",{fromDate:"2026-10-17",fromTime:"09:00",dueDate:"2026-10-17",dueTime:"18:00"}],["TIME-metadata-midnight",{dueDate:"2026-10-17",dueTime:"00:00"}],["TIME-metadata-reversed",{fromDate:"2026-10-17",fromTime:"18:00",dueDate:"2026-10-17",dueTime:"09:00"}],["TIME-metadata-date-only",{dueDate:"2026-10-17"}]]){
  const f=fixture({metadata:{"b0-parent":metadata}}),h=createHarness(),file="Projects/Private/B0.md",line="- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17";f.add(file,line+"\n");f.plugin.app.plugins.plugins["obsidian-tasks-plugin"]={apiV1:{executeToggleTaskDoneCommand:(line,p)=>h.run(line,p).output.text}};
  try{const read=()=>f.plugin.taskData.readPages({pages:()=>({array:()=>[...f.pages.values()]})}).flatMap(p=>p.file.tasks).map(t=>({line:t.line,id:t.hubTaskId,completed:t.completed,identityConflict:t.identityConflict,fromDate:t.fromDate??null,fromTime:t.fromTime??null,dueDate:t.dueDate??null,dueTime:t.dueTime??null}));
   const before=f.snapshot(),beforeReader=read(),edit=await f.plugin.toggleTask(file,0,tasks.taskDisplayText(tasks.taskLineDetails(line).text),true,"b0-parent"),after=f.snapshot(),reader=read();
   result.legacyMetadata.push({id,metadata,beforeMetadata:before.metadata,afterMetadata:after.metadata,beforeReader,afterSource:after.contents[file],reader,edit,historyCount:after.history.length,evidenceLevel:"executed-current-itacan-map-writer-with-installed-tasks-callback",limitation:"Synthetic metadata/index only; no native timed recurrence engine or real settings. Duplicate-ID metadata withholding is observed, not bypassed."});
  }finally{await f.close();}
 }}finally{Date.now=previousNow;}
 return result;
}
if(require.main===module)capture(process.argv[2]).then(result=>process.stdout.write(JSON.stringify(result)+"\n")).catch(e=>{process.stderr.write(e.message+"\n");process.exitCode=1;});
module.exports={capture};
