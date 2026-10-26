"use strict";
// Private captured-evidence acceptance run. Fixtures never open the captured roots.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const J=require('../../../.obsidian/plugins/hub-project-menu/lib/services/native-git-transition'),R=require('../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-activation'),A=require('../../host/private-authority'),C=require('../../src/private-storage-codec'),V=require('../../src/value');
const baseline=process.env.ITACAN_SECOND_CLIENT_BASELINE;
const ids=['4b597e3b-b588-4a29-969b-70db3a684112','9325047c-eb3d-43e7-92f2-a9bf630afe13'];
const originalOperation='15427fcf-468b-478b-80f4-0765f1b552b5';
async function fixture(t,{interrupted=true}={}){
 assert(baseline,'Set ITACAN_SECOND_CLIENT_BASELINE to the verified private backup.');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itacan-second-client-test-')),vault=path.join(root,'vault'),local=path.join(root,'local'),roaming=path.join(root,'roaming'),vaultId=crypto.randomBytes(8).toString('hex'),deviceId=crypto.randomUUID(),previous={LOCALAPPDATA:process.env.LOCALAPPDATA,APPDATA:process.env.APPDATA};
 assert(!root.toLowerCase().startsWith(path.resolve(process.env.OneDrive??'Z:/no-cloud').toLowerCase()+path.sep));
 await fs.mkdir(vault);await fs.mkdir(local);await fs.mkdir(path.join(roaming,'obsidian'),{recursive:true});await fs.writeFile(path.join(roaming,'obsidian/obsidian.json'),JSON.stringify({vaults:{[vaultId]:{path:vault}}}));
 process.env.LOCALAPPDATA=local;process.env.APPDATA=roaming;t.after(()=>{Object.assign(process.env,previous)});
 for(const name of ['Projects/Itacan','Projects/Obsidian Hub'])await fs.cp(path.join(baseline,'worktree',name),path.join(vault,name),{recursive:true});
 await fs.cp(path.join(baseline,'critical/portable'),path.join(vault,'.itacan-native'),{recursive:true});await fs.mkdir(path.join(vault,'.obsidian/plugins/hub-project-menu'),{recursive:true});await fs.copyFile(path.join(baseline,'critical/data.json'),path.join(vault,'.obsidian/plugins/hub-project-menu/data.json'));
 await fs.mkdir(path.join(vault,'System'),{recursive:true});await fs.copyFile(path.join(baseline,'worktree/System/Hub-shared-projects.json'),path.join(vault,'System/Hub-shared-projects.json'));
 await fs.writeFile(path.join(vault,'.gitignore'),'/.obsidian/\n');await fs.mkdir(path.join(root,'hooks'));await fs.writeFile(path.join(root,'gitconfig'),'');
 const git=(...args)=>execFileSync('git',['-C',vault,'-c','user.name=Isolated test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath='+path.join(root,'hooks'),...args],{windowsHide:true,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(root,'gitconfig')},stdio:['ignore','pipe','pipe']});git('init');git('add','.');git('commit','-m','Isolated captured shared baseline');
 const projects=ids.map((id,i)=>({projectId:id,root:'Projects/'+['Itacan','Obsidian Hub'][i],path:'Projects/'+['Itacan/Itacan.md','Obsidian Hub/Obsidian Hub.md'][i],name:['Itacan','Obsidian Hub'][i],contextKind:'project',status:'active',shared:true}));
 const nodes=new Map();async function index(rel){const stat=await fs.stat(path.join(vault,rel)),name=path.posix.basename(rel);const node=stat.isDirectory()?{path:rel,name,children:[]}:{path:rel,name,extension:rel.endsWith('.md')?'md':''};nodes.set(rel,node);if(node.children)for(const n of await fs.readdir(path.join(vault,rel)))node.children.push(await index(rel+'/'+n));return node;}
 async function reindex(){nodes.clear();await index('Projects');}
 await reindex();const plugin={register:()=>{},app:{vault:{adapter:{getBasePath:()=>vault},getAbstractFileByPath:n=>nodes.get(n),on:()=>({}),offref:()=>{}}},dataStore:{deviceId},projectWizard:{getProjectById:id=>projects.find(p=>p.projectId===id),getProjectRecords:()=>projects,getResourceTypes:()=>[]}};
 const plans=[];for(const id of ids){const source=path.join(baseline,'critical/NativeActivation/v1/7d3b144bb84c8c3e0b6c6939/owners/project-'+id),saved=await R.readOrdinary(path.join(source,'CUTOVER-v1.json')),p=V.clone(R.verify(saved));p.vaultId=vaultId;p.deviceId=deviceId;Object.assign(p.options.config.binding,{vaultRoot:vault,vaultId,deviceId,localDataRoot:local});p.options.config.directory=require('../../host/git-authority').repositoryPath(p.options.config.binding);p.options.gitSharing.replicaId=crypto.randomUUID();
  const archive=path.join(local,'archive-'+id),relative=path.relative(path.join(path.dirname(path.dirname(path.dirname(path.dirname(saved.archive))))),saved.archive);
  const capturedArchive=path.join(baseline,'critical/CutoverArchives',...saved.archive.split(/[\\/]/).slice(saved.archive.split(/[\\/]/).indexOf('CutoverArchives')+1));await fs.cp(capturedArchive,archive,{recursive:true});p.archive=archive;
  const plan=R.seal(p),folder=R.ownerFolder(local,vaultId,p.owner);plans.push(plan);
  if(interrupted||id===ids[1]){await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'CUTOVER-v1.json'),V.canonical(plan));const originalRepo=saved.options.config.directory.split(/[\\/]/),at=originalRepo.indexOf('NativeTasks');await fs.cp(path.join(baseline,'critical/NativeTasks',...originalRepo.slice(at+1)),p.options.config.directory,{recursive:true});
   if(id===ids[1]){const active=R.seal({version:3,kind:'itacan-owner-activation',state:'active',planDigest:R.checksum(p),authorityId:p.options.config.authorityId});await fs.writeFile(path.join(folder,'ACTIVATION-v1.json'),V.canonical(active));}
  }
 }
 const snapshot=async dir=>{const out={};for(const n of await fs.readdir(dir))if(n!=='WRITER.lock')out[n]=A.digest(await fs.readFile(path.join(dir,n)));return out;};
 return{root,vault,local,plugin,plans,reindex,snapshot};
}

module.exports={fixture,ids,originalOperation};
