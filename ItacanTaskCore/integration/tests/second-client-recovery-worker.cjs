"use strict";
// Runs only against an explicitly created isolated test fixture.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),J=require('../../../.obsidian/plugins/hub-project-menu/lib/services/native-git-transition');
const input=JSON.parse(process.argv[2]);
async function main(){
 const relative=path.relative(await fs.realpath(os.tmpdir()),await fs.realpath(input.root));
 if(!relative||relative.startsWith('..')||!path.basename(input.root).startsWith('itacan-second-client-test-'))throw Error('Owned isolated fixture required.');
 process.env.LOCALAPPDATA=path.join(input.root,'local');process.env.APPDATA=path.join(input.root,'roaming');
 const nodes=new Map();async function index(rel){const s=await fs.stat(path.join(input.vault,rel)),n=s.isDirectory()?{path:rel,name:path.posix.basename(rel),children:[]}:{path:rel,name:path.posix.basename(rel),extension:rel.endsWith('.md')?'md':''};nodes.set(rel,n);if(n.children)for(const f of await fs.readdir(path.join(input.vault,rel)))n.children.push(await index(rel+'/'+f));return n;}await index('Projects');
 const projects=['Itacan','Obsidian Hub'].map((name,i)=>({projectId:['4b597e3b-b588-4a29-969b-70db3a684112','9325047c-eb3d-43e7-92f2-a9bf630afe13'][i],root:'Projects/'+name,path:'Projects/'+name+'/'+name+'.md',name,status:'active',shared:true,contextKind:'project'}));
 const plugin={register:()=>{},app:{vault:{adapter:{getBasePath:()=>input.vault},getAbstractFileByPath:p=>nodes.get(p),on:()=>({}),offref:()=>{}}},dataStore:{deviceId:input.plan.deviceId},projectWizard:{getProjectById:id=>projects.find(p=>p.projectId===id),getProjectRecords:()=>projects,getResourceTypes:()=>[]}};
 if(input.mode==='conclude') { const s=await J.openJoinRecovery(plugin,input.plan.owner);try{await s.conclude(await s.review(input.operationId));}finally{await s.close();}process.stdout.write('terminal-rejection-durable');process.exit(0); }
 await J.initialize(input.plan,plugin);const runtime=await J.openLocal(input.plan,plugin);try{const list=await runtime.list();process.stdout.write(JSON.stringify({tasks:list.tasks.length,ids:list.tasks.map(t=>t.id).sort(),old:(await runtime.recovery.inspect(input.operationId)).classification}));}finally{await runtime.close();}
}
main().catch(e=>{process.stderr.write(e.stack);process.exitCode=1;});
