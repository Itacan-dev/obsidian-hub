"use strict";
// OneDrive transports immutable files. Missing dependencies are not native corruption.
const fs=require("node:fs/promises"),path=require("node:path"),crypto=require("node:crypto"),{execFile}=require("node:child_process");
const V=require("../src/value"),M=require("./membership"),B=require("./binding"),E=require("./enrollment"),G=require("../src/personal-shared-v2"),{check}=require("../src/errors");
const LIMIT=64*1024*1024,NAME=/^[a-f0-9]{64}\.json$/;
const equal=(a,b)=>process.platform==="win32"?a.toLowerCase()===b.toLowerCase():a===b;
const git=(cwd,args)=>new Promise((resolve,reject)=>execFile("git",["-C",cwd,...args],{windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"},encoding:"utf8",maxBuffer:1024*1024},(e,out)=>e?reject(e):resolve(out.trim())));
async function ordinary(p,kind){const s=await fs.lstat(p);check(!s.isSymbolicLink()&&equal(await fs.realpath(p),path.resolve(p))&&(kind==="directory"?s.isDirectory():s.isFile()),"Ordinary personal transport path required.");return s;}
async function createOneDriveTransport(input){
 const {vaultRoot,binding,seed,pairing,signer}=input;B.confirm(binding,pairing?.bindingDigest);const owner=E.validate(seed,binding),root=await require("../host/private-authority").ordinaryPath(vaultRoot);check(equal(root,await fs.realpath(vaultRoot)),"Vault transport root differs.");await ordinary(root,"directory");
 let knownMembers=V.clone(input.members);const incomplete=new Map();check(M.members(binding,knownMembers).get(signer.replicaId)===signer.publicKey,"Personal publisher is not enrolled.");
 const transportRoot=path.join(root,".itacan-personal-sync"),space=path.join(transportRoot,"v2/spaces",binding.base.spaceId),base=path.join(space,"owners",owner.authorityId);
 async function privacy(){
  await ordinary(root,"directory");let gitRoot;try{gitRoot=await git(root,["rev-parse","--show-toplevel"])}catch(e){if(e.code===128)return;throw e}
  const rel=path.relative(gitRoot,transportRoot).split(path.sep).join("/");check(rel&&!rel.startsWith("../")&&!path.isAbsolute(rel),"Personal transport Git boundary differs.");
  check((await git(gitRoot,["ls-files","--",rel])).length===0,"Personal evidence is tracked by Git; publication blocked.");
  check((await git(gitRoot,["check-ignore","--",rel+"/v1/probe.json"])).length>0,"Personal evidence is not ignored by Git.");
 }
 async function directory(p,create){const rel=path.relative(root,p);check(rel&&!rel.startsWith("..")&&!path.isAbsolute(rel),"Personal transport escaped vault.");let part=root;for(const n of rel.split(path.sep)){part=path.join(part,n);if(create)await fs.mkdir(part).catch(e=>{if(e.code!=="EEXIST")throw e});try{await ordinary(part,"directory")}catch(e){if(!create&&e.code==="ENOENT")return false;throw e}}return true;}
 async function readFile(file){const stat=await ordinary(file,"file");check(stat.size<=LIMIT,"Personal file exceeds capacity.");const raw=await fs.readFile(file,"utf8");check(Buffer.byteLength(raw)<=LIMIT,"Personal file grew beyond capacity.");let value;try{value=JSON.parse(raw)}catch(e){e.evidenceDigest=crypto.createHash("sha256").update(raw).digest("hex");throw e}check(raw===V.canonical(value)+"\n","Canonical personal file required.");return{value,raw,bytes:Buffer.byteLength(raw)};}
 async function publishFile(dir,id,value){
  const target=path.join(dir,id+".json"),raw=V.canonical(value)+"\n";check(Buffer.byteLength(raw)<=LIMIT,"Personal record exceeds capacity.");
  // Existing immutable bytes are read back, never republished. The enclosing
  // publication checks Git privacy at both ends; each actual new write still
  // checks it here and immediately before exclusive final-file creation.
  try{if(await directory(dir,false)){check((await readFile(target)).raw===raw,"Changed immutable personal file.");return}}catch(e){if(e.code!=="ENOENT")throw e}
  await privacy();await directory(dir,true);
  const staging=path.join(transportRoot,".staging");await directory(staging,true);const temp=path.join(staging,crypto.randomUUID()+".tmp");let handle;
  try{handle=await fs.open(temp,"wx");await handle.writeFile(raw,"utf8");await handle.sync();await handle.close();handle=null;await privacy();await ordinary(dir,"directory");try{await fs.link(temp,target)}catch(e){if(e.code!=="EEXIST")throw e}check((await readFile(target)).raw===raw,"Personal publication readback differs.");}
  finally{await handle?.close();await fs.unlink(temp).catch(e=>{if(e.code!=="ENOENT")throw e})}
 }
 async function entries(dir){if(!await directory(dir,false))return[];const names=await fs.readdir(dir);check(names.length<=1024,"Personal collection exceeds capacity.");return names.sort();}
 async function publish(packet){
  await privacy();check(V.canonical(packet.binding)===V.canonical(binding)&&V.canonical(packet.seed)===V.canonical(seed),"Personal publication binding differs.");
  const ns=G.namespace(packet),g=G.graph(ns);await G.validateState({...Object.fromEntries(Object.entries(g.current).filter(([k])=>!["known","accepted","frontier","taskHeads","conflicts","accounting","personalHead"].includes(k))),personalShared:ns});
  await publishFile(path.join(space,"profiles"),binding.profile.digest,binding.profile);await publishFile(path.join(space,"bindings"),M.hash(binding),binding);for(const r of packet.members)await publishFile(path.join(space,"members"),r.digest,r);
  await publishFile(path.join(base,"seeds"),seed.digest,seed);for(const f of packet.frames)await publishFile(path.join(base,"objects"),f.id,f);
  const head=M.seal({format:"itacan-personal-head",version:2,profileDigest:binding.profile.digest,spaceId:binding.base.spaceId,bindingDigest:M.hash(binding),authorityId:owner.authorityId,seedDigest:seed.digest,head:packet.head},signer);
  await publishFile(path.join(base,"heads"),head.digest,head);await privacy();return{version:1,state:"locally-published",head:packet.head,declaration:head.digest};
 }
 async function read(){
  const result={version:1,packets:[],waiting:[],invalid:[],aliases:[],acknowledgements:[]};await privacy();let bytes=0;
  const records=async(dir,validate)=>{const out=[];for(const name of await entries(dir)){try{check(name.endsWith(".json"),"Unexpected personal record name.");const r=await readFile(path.join(dir,name));bytes+=r.bytes;check(bytes<=LIMIT,"Personal transport byte capacity exceeded.");const id=validate(r.value);if(name!==id+".json")result.aliases.push({file:name,digest:id});out.push(r.value)}catch(e){const key=path.join(dir,name),old=incomplete.get(key),attempts=e.evidenceDigest?(old?.digest===e.evidenceDigest?old.count+1:1):0;if(e.evidenceDigest)incomplete.set(key,{digest:e.evidenceDigest,count:attempts});if(["ENOENT","EBUSY","EACCES","EIO","ENODATA","UNKNOWN"].includes(e.code)||e instanceof SyntaxError&&attempts<3)result.waiting.push({file:name,code:e.code??"INCOMPLETE_JSON"});else result.invalid.push({file:name,code:e.code??"INVALID_RECORD"})}}return out;};
  for(const [file,expected] of [[path.join(space,"profiles",binding.profile.digest+".json"),binding.profile],[path.join(space,"bindings",M.hash(binding)+".json"),binding],[path.join(base,"seeds",seed.digest+".json"),seed]])try{check((await readFile(file)).raw===V.canonical(expected)+"\n","Transport binding/seed differs.");}catch(e){(e.code==="ENOENT"?result.waiting:result.invalid).push({file:path.basename(file),code:e.code??"INVALID_ENROLLMENT"});return result;}
  const observed=await records(path.join(space,"members"),r=>{check(r.digest===M.hash(r.body),"Changed member bytes.");return r.digest});
  const all=new Map(knownMembers.map(r=>[r.digest,r]));for(const r of observed){try{const trial=[...all.values()].filter(x=>x.digest!==r.digest).concat(r);M.members(binding,trial);all.set(r.digest,r)}catch(e){result.invalid.push({file:r.digest,code:"UNTRUSTED_MEMBER"})}}
  knownMembers=[...all.values()].sort((a,b)=>a.digest.localeCompare(b.digest));const keys=M.members(binding,knownMembers);
  const objects=new Map();for(const f of await records(path.join(base,"objects"),f=>{const{id,signature,...body}=f;check(id===M.hash(body)&&keys.has(f.replicaId),"Foreign personal object.");M.verify(keys.get(f.replicaId),f.version===1?["itacan-personal-frame-v1",binding.base.spaceId,seed.digest,id]:["itacan-personal-frame-v2",binding.base.spaceId,M.hash(binding),seed.digest,id],signature);return id})){check(!objects.has(f.id)||V.canonical(objects.get(f.id))===V.canonical(f),"Conflicting object alias.");objects.set(f.id,f)}
  const heads=await records(path.join(base,"heads"),r=>{check(keys.has(r.signer),"Unknown head signer.");const b=M.open(r,keys.get(r.signer),r.signer);M.exact(b,["format","version","profileDigest","spaceId","bindingDigest","authorityId","seedDigest","head"]);check(b.format==="itacan-personal-head"&&b.version===2&&b.profileDigest===binding.profile.digest&&b.spaceId===binding.base.spaceId&&b.bindingDigest===M.hash(binding)&&b.authorityId===owner.authorityId&&b.seedDigest===seed.digest,"Foreign personal head.");return r.digest});
  const packets=new Map();for(const h of heads){const ids=new Set(),visiting=new Set();try{const visit=id=>{if(id===null||ids.has(id))return;check(!visiting.has(id),"Cyclic personal transport proof.");if(!objects.has(id)){const e=Error("Missing dependency");e.code="MISSING_DEPENDENCY";throw e}visiting.add(id);const f=objects.get(id);visit(f.parent);for(const ref of f.packet?.frameIds??[])visit(ref);visiting.delete(id);ids.add(id)};visit(h.body.head);for(const c of binding.profile.body.legacyCuts.find(c=>c.authorityId===owner.authorityId).heads)visit(c);const packet={format:"itacan-personal-native",version:2,binding:V.clone(binding),seed:V.clone(seed),members:V.clone(knownMembers),head:h.body.head,frames:[...ids].sort().map(id=>objects.get(id))};packets.set(packet.head,packet)}catch(e){(e.code==="MISSING_DEPENDENCY"?result.waiting:result.invalid).push({file:h.digest,code:e.code??"INVALID_ANCESTRY"})}}
  result.packets=[...packets.values()].filter(p=>!([...packets.values()].some(q=>q.head!==p.head&&q.frames.some(f=>f.id===p.head))));
  for(const r of await records(path.join(base,"acknowledgements"),r=>{check(keys.has(r.signer),"Unknown acknowledgement signer.");const b=M.open(r,keys.get(r.signer),r.signer);M.exact(b,["format","version","profileDigest","spaceId","authorityId","bindingDigest","head","application"]);check(b.format==="itacan-personal-ack"&&b.version===2&&b.profileDigest===binding.profile.digest&&b.spaceId===binding.base.spaceId&&b.authorityId===owner.authorityId&&b.bindingDigest===M.hash(binding),"Foreign acknowledgement.");return r.digest}))result.acknowledgements.push(r);
  return result;
 }
 async function acknowledge(head,application){await privacy();check(application&&Number.isSafeInteger(application.repositoryRevision)&&typeof application.operationId==="string","Authoritative application receipt required.");const record=M.seal({format:"itacan-personal-ack",version:2,profileDigest:binding.profile.digest,spaceId:binding.base.spaceId,authorityId:owner.authorityId,bindingDigest:M.hash(binding),head,application:V.clone(application)},signer);await publishFile(path.join(base,"acknowledgements"),record.digest,record);await privacy();return record.digest;}
 async function capacity(){const counts={objects:0,heads:0,acknowledgements:0,bytes:0,recordLimit:1024,byteLimit:LIMIT};for(const kind of ["objects","heads","acknowledgements"]){const names=await entries(path.join(base,kind));counts[kind]=names.length;for(const name of names){const stat=await ordinary(path.join(base,kind,name),"file");counts.bytes+=stat.size;}}return Object.freeze(counts);}
 return Object.freeze({publish,read,acknowledge,capacity,assertPrivacy:privacy,paths:Object.freeze({root:transportRoot,space,owner:base})});
}
module.exports={createOneDriveTransport};
