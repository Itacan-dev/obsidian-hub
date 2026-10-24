"use strict";
// Git transports immutable evidence, never locks, local receipts or task outcomes.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const V=require('../src/value'),G=require('../src/git-shared'),{check}=require('../src/errors'),{deserializeSharedPacketV3}=require('../src/serialization');
const LIMIT=64*1024*1024,NAME=/^[a-f0-9]{64}\.json$/;
const equalPath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
async function directory(p){const s=await fs.lstat(p);check(s.isDirectory()&&!s.isSymbolicLink()&&equalPath(await fs.realpath(p),p),'Ordinary canonical Git directory required.');}
async function createGitPacketTransport(input){
 V.fields(input,['version','root','authorityId','projectId'],['version','root','authorityId','projectId']);check(input.version===1&&path.isAbsolute(input.root),'Explicit Git root required.');V.uuid(input.authorityId);V.referenceId(input.projectId);
 check(!(await fs.lstat(input.root)).isSymbolicLink(),'Git root cannot be a link.');const root=await fs.realpath(path.resolve(input.root));await directory(root);await directory(path.join(root,'.git'));
 async function location(create){
  await directory(root);await directory(path.join(root,'.git'));
  const old=path.join(root,'.itacan-native','v2',input.authorityId);
  try{await directory(old);check((await fs.readdir(old)).length===0,'Incompatible packet-v2 transport requires explicit review.');}catch(e){if(e.code!=='ENOENT')throw e;}
  let p=root;for(const n of ['.itacan-native','v3',input.authorityId]){p=path.join(p,n);if(create)await fs.mkdir(p).catch(e=>{if(e.code!=='EEXIST')throw e});try{await directory(p)}catch(e){if(!create&&e.code==='ENOENT')return null;throw e}}
  for(const n of ['objects','heads']){const dir=path.join(p,n);if(create)await fs.mkdir(dir).catch(e=>{if(e.code!=='EEXIST')throw e});await directory(dir);}
  check((await fs.readdir(p)).every(n=>['objects','heads'].includes(n)),'Unexpected compact transport entry.');return p;
 }
 function owner(p){check(p.genesis.authorityId===input.authorityId&&p.genesis.partition.owner.id===input.projectId,'Git packet owner/authority differs.');}
 async function validate(p){owner(p);return deserializeSharedPacketV3(V.canonical(p));}
 async function file(dir,name){check(NAME.test(name),'Unexpected content-addressed entry.');const target=path.join(dir,name),s=await fs.lstat(target);check(s.isFile()&&!s.isSymbolicLink()&&s.size<=LIMIT,'Bounded ordinary evidence file required.');const raw=await fs.readFile(target,'utf8');check(Buffer.byteLength(raw)<=LIMIT,'Evidence grew beyond limit.');const value=JSON.parse(raw);check(raw===V.canonical(value)+'\n','Canonical evidence required.');return {value,raw,bytes:Buffer.byteLength(raw)};}
 async function publishFile(dir,id,value){
  const target=path.join(dir,id+'.json'),raw=V.canonical(value)+'\n';check(Buffer.byteLength(raw)<=LIMIT,'Evidence exceeds packet bound.');
  try{const existing=await file(dir,id+'.json');check(existing.raw===raw,'Changed immutable shared evidence.');return target;}catch(e){if(e.code!=='ENOENT')throw e;}
  const temp=await fs.realpath(os.tmpdir());check(!equalPath(temp,root)&&!temp.startsWith(root+path.sep),'Private transport staging required.');
  for(const cloud of [process.env.OneDrive,process.env.OneDriveConsumer,process.env.OneDriveCommercial].filter(Boolean))check(!equalPath(path.resolve(cloud),temp)&&!temp.startsWith(path.resolve(cloud)+path.sep),'Cloud staging rejected.');
  const staging=await fs.mkdtemp(path.join(temp,'itacan-n4-export-')),source=path.join(staging,'evidence.json');let handle;
  try{handle=await fs.open(source,'wx');await handle.writeFile(raw,'utf8');await handle.sync();await handle.close();handle=null;try{await fs.link(source,target);}catch(e){if(e.code!=='EEXIST')throw e;}}
  finally{await handle?.close();await fs.unlink(source).catch(e=>{if(e.code!=='ENOENT')throw e});await fs.rmdir(staging);}
  check((await file(dir,id+'.json')).raw===raw,'Immutable evidence readback differs.');return target;
 }
 async function read(){
  const dir=await location(false);if(dir===null)return Object.freeze([]);
  const objects=new Map(),heads=[],closures=new Map();let bytes=0;
  for(const kind of ['objects','heads']){const names=(await fs.readdir(path.join(dir,kind))).sort();check(names.length<=1024,'Shared evidence capacity exceeded.');for(const name of names){const f=await file(path.join(dir,kind),name);bytes+=f.bytes;check(bytes<=LIMIT,'Shared collection byte limit exceeded.');const id=name.slice(0,-5);
   if(kind==='objects'){const {id:claimed,...body}=f.value;check(claimed===id&&G.hash(body)===id,'Changed immutable origin object.');objects.set(id,f.value);}
   else{const h=f.value;V.fields(h,['format','version','genesis','head'],['format','version','genesis','head']);check(h.format==='itacan-git-head'&&h.version===3&&G.hash(h)===id,'Invalid compact head declaration.');owner(h);heads.push(h);}
  }}
  function closure(h){if(closures.has(h))return closures.get(h);const ids=new Set(),visiting=new Set();function visit(id){if(id===null||ids.has(id))return;check(!visiting.has(id)&&objects.has(id),'Missing/cyclic shared object.');visiting.add(id);const f=objects.get(id);visit(f.parent);for(const ref of f.packet?.frameIds??[])visit(ref);visiting.delete(id);ids.add(id);}visit(h.head);closures.set(h,ids);return ids;}
  for(const h of heads)closure(h);
  const maximal=heads.filter(h=>!heads.some(other=>other!==h&&other.head!==h.head&&(h.head===null||closure(other).has(h.head))));
  // Every historical head must bind the exact genesis of a maximal proof that
  // includes it. Validating that proof validates the complete historical prefix.
  for(const h of heads)check(maximal.some(m=>(m===h||h.head===null||closure(m).has(h.head))&&V.canonical(m.genesis)===V.canonical(h.genesis)), 'Historical head genesis differs.');
  const packets=new Map();for(const h of maximal){const ids=closure(h),p={format:'itacan-git-native',version:3,genesis:h.genesis,head:h.head,frames:[...ids].sort().map(id=>objects.get(id))};packets.set(h,await validate(p));}
  await location(false);return Object.freeze(maximal.map(h=>packets.get(h)));
 }
 async function capacity(){
  const dir=await location(false),result={version:1,objects:0,heads:0,bytes:0,objectLimit:1024,headLimit:1024,byteLimit:LIMIT};
  if(dir!==null)for(const kind of ['objects','heads']){const names=await fs.readdir(path.join(dir,kind));result[kind]=names.length;for(const name of names){check(NAME.test(name),'Unexpected shared capacity entry.');const stat=await fs.lstat(path.join(dir,kind,name));check(stat.isFile()&&!stat.isSymbolicLink(),'Ordinary evidence required.');result.bytes+=stat.size;}}
  // Diagnostic only: counts never establish provenance or task acceptance.
  return Object.freeze(result);
 }
 return Object.freeze({
  async publish(packet){const p=await validate(packet),dir=await location(true);for(const f of p.frames)await publishFile(path.join(dir,'objects'),f.id,f);
   const h={format:'itacan-git-head',version:3,genesis:p.genesis,head:p.head},target=await publishFile(path.join(dir,'heads'),G.hash(h),h);await location(false);
   return Object.freeze({version:1,digest:G.hash(p),relativePath:path.relative(root,target).split(path.sep).join('/')});},read,capacity
 });
}
module.exports={createGitPacketTransport};
