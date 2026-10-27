"use strict";
// Read-only dormant activation. No pairing, key creation or authority creation on import.
const fs=require("node:fs/promises"),path=require("node:path"),A=require("../../../../../ItacanTaskCore/host/private-authority"),V=require("../../../../../ItacanTaskCore/src/value"),B=require("../../../../../ItacanTaskCore/personal/binding"),E=require("../../../../../ItacanTaskCore/personal/enrollment"),{check}=require("../../../../../ItacanTaskCore/src/errors");
function base(local,vaultId){return path.join(local,"Itacan/PersonalSync/v1",A.digest(vaultId).slice(0,24),"owners");}
async function load(plugin,ordinary,onlyOwner=null){
 const vault=await fs.realpath(plugin.app.vault.adapter.getBasePath()),result=ordinary.slice();let vaultId;
 try{vaultId=await A.registration(vault)}catch(_){
  // A changed vault registration cannot hide earlier personal ownership.
  let spaces=[];const parent=path.join(process.env.LOCALAPPDATA,"Itacan/PersonalSync/v1");try{spaces=await fs.readdir(parent)}catch(e){if(e.code!=="ENOENT")throw e}
  for(const space of spaces){let owners=[];try{owners=await fs.readdir(path.join(parent,space,"owners"))}catch(_){continue}
   for(const name of owners)try{const record=JSON.parse(await fs.readFile(path.join(parent,space,"owners",name,"ACTIVATION-v1.json"),"utf8"));if(record.options?.config?.binding?.vaultRoot && await fs.realpath(record.options.config.binding.vaultRoot)===vault){const owner=record.owner;if(onlyOwner&&V.canonical(owner)!==V.canonical(onlyOwner))continue;const i=result.findIndex(o=>V.canonical(o.owner)===V.canonical(owner)),blocked={owner,projectRoot:record.options.projectRoot,dashboard:record.options.dashboard,partitionId:"private",config:{},blocked:true};if(i<0)result.push(blocked);else result[i]=blocked;}}catch(_){}
  }return result;
 }
 const root=base(process.env.LOCALAPPDATA,vaultId);let names;
 try{names=await fs.readdir(root)}catch(e){if(e.code==="ENOENT")return result;throw e}
 for(const name of names){const match=/^(project|resource)-(.+)$/.exec(name);check(match,"Unknown personal activation owner.");const owner={type:match[1],id:match[2]};if(onlyOwner&&(onlyOwner.type!==owner.type||onlyOwner.id!==owner.id))continue;
  const previous=result.findIndex(o=>V.canonical(o.owner)===V.canonical(owner)),current=owner.type==="resource"?plugin.projectWizard.getResourceById(owner.id):plugin.projectWizard.getProjectById(owner.id),reserved={...(previous<0?{}:result[previous]),owner,projectRoot:current?.root??result[previous]?.projectRoot,dashboard:current?.path??result[previous]?.dashboard,partitionId:"private",config:{},blocked:true};
  try{
   const file=path.join(root,name,"ACTIVATION-v1.json");check(await A.ordinaryPath(file)===await fs.realpath(file),"Personal activation link rejected.");const raw=await fs.readFile(file,"utf8"),record=require("./native-task-activation").verify(JSON.parse(raw));
   V.fields(record,["format","version","vaultId","deviceId","owner","authorityId","binding","seed","members","bindingDigest","keyFile","options",...(record.version===2?["legacyFrames"]:[])],["format","version","vaultId","deviceId","owner","authorityId","binding","seed","members","bindingDigest","keyFile","options",...(record.version===2?["legacyFrames"]:[])]);
   check(record.format==="itacan-personal-local-activation"&&[1,2].includes(record.version)&&record.version===record.binding.version&&record.vaultId===vaultId&&record.deviceId===plugin.dataStore.deviceId&&V.canonical(record.owner)===V.canonical(owner),"Personal activation device/owner differs.");B.confirm(record.binding,record.bindingDigest);const seed=E.validate(record.seed,record.binding),bound=(record.binding.base??record.binding).owners.find(o=>o.authorityId===record.authorityId),options=record.options;
   check(bound&&seed.authorityId===record.authorityId&&V.canonical(seed.owner)===V.canonical(owner),"Personal signed owner differs.");
   // Retain only a verified signed path hint while metadata is not ready.
   // This remains blocked; the later admission still verifies physical ownership.
   reserved.projectRoot=bound.root;reserved.dashboard=bound.dashboard;
   check(current&&current.root===bound.root&&current.path===bound.dashboard&&!current.shared&&(!current.status||["active","future","shelved"].includes(current.status)),"Personal physical owner differs.");
   check(options.config.scope==="device-private-project"&&options.config.authorityId===record.authorityId&&options.partitionId==="private"&&V.canonical(options.owner)===V.canonical(owner)&&options.projectRoot===bound.root&&options.dashboard===bound.dashboard&&options.config.binding.vaultId===vaultId&&options.config.binding.deviceId===record.deviceId,"Personal authority configuration differs.");
   await A.validateBinding(options.config.binding,options.config.directory);
   const key=await A.ordinaryPath(record.keyFile),local=await fs.realpath(process.env.LOCALAPPDATA);check(A.inside(path.join(local,"Itacan/PersonalSync/v1"),key)&&!A.inside(vault,key),"Personal key is outside private storage.");
   const protector=plugin.personalKeyProtector??require("@electron/remote").safeStorage,signer=await require("../../../../../ItacanTaskCore/personal/local-identity").loadIdentity(key,protector);
   check(require("../../../../../ItacanTaskCore/personal/membership").members(record.binding,record.members).get(signer.replicaId)===signer.publicKey,"Personal replica membership differs.");
   let creating=false;try{await fs.lstat(path.join(options.config.directory,"CURRENT.json"))}catch(e){if(e.code!=="ENOENT")throw e;check(options.personalEnrollment==="join"&&(await fs.readdir(options.config.directory)).length===0,"Missing personal authority is not an empty reviewed join.");creating=true}
   const stat=await fs.stat(vault,{bigint:true});reserved.config=options.config;
   const admitted={...options,creating,blocked:false,vaultPin:{real:vault,dev:String(stat.dev),ino:String(stat.ino)},personalSync:{binding:record.binding,seed:record.seed,members:record.members,...(record.version===2?{legacyFrames:record.legacyFrames}:{}),pairing:B.confirm(record.binding,record.bindingDigest),signer},assertActivation:async()=>{check(await fs.readFile(file,"utf8")===raw,"Personal activation changed.");await A.validateBinding(options.config.binding,options.config.directory)}};
   if(previous<0)result.push(admitted);else result[previous]=admitted;
  }catch(_){if(previous<0)result.push(reserved);else result[previous]=reserved}
 }
 return result;
}
module.exports={base,load};
