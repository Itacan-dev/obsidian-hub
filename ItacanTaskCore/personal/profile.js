"use strict";
const V=require("../src/value"),M=require("./membership"),{check}=require("../src/errors");
const protocol=Object.freeze({packet:2,frame:2,namespace:2,enrollment:1,membership:1,retention:4,capability:"personal-sync-proofs-v2"});
const base=b=>b?.version===2?b.base:b;
function validate(binding){
 M.exact(binding,["format","version","base","profile"]);check(binding.format==="itacan-personal-binding"&&binding.version===2,"Personal binding v2 required.");require("./binding").validate(binding.base);
 const b=binding.base,p=M.open(binding.profile,b.root.publicKey,b.root.replicaId);M.exact(p,["format","version","spaceId","baseBindingDigest","protocol","legacyCuts"]);
 check(p.format==="itacan-personal-profile"&&p.version===2&&p.spaceId===b.spaceId&&p.baseBindingDigest===M.hash(b)&&V.canonical(p.protocol)===V.canonical(protocol),"Personal profile differs.");
 check(Array.isArray(p.legacyCuts)&&p.legacyCuts.length===b.owners.length,"Complete personal legacy cuts required.");let last=null;
 for(const c of p.legacyCuts){M.exact(c,["authorityId","heads"]);V.uuid(c.authorityId);check(b.owners.some(o=>o.authorityId===c.authorityId)&&(!last||last<c.authorityId),"Personal cutoff owner/order differs.");last=c.authorityId;check(Array.isArray(c.heads)&&c.heads.length<=1024&&V.canonical(c.heads)===V.canonical([...new Set(c.heads)].sort())&&c.heads.every(h=>typeof h==="string"&&/^[a-f0-9]{64}$/.test(h)),"Canonical personal cut heads required.");}
 return V.clone(binding);
}
function create(binding,signer,cuts=binding.owners.map(o=>({authorityId:o.authorityId,heads:[]}))){require("./binding").validate(binding);check(binding.version===1&&signer.replicaId===binding.root.replicaId&&signer.publicKey===binding.root.publicKey,"Original root profile signature required.");return validate({format:"itacan-personal-binding",version:2,base:V.clone(binding),profile:M.seal({format:"itacan-personal-profile",version:2,spaceId:binding.spaceId,baseBindingDigest:M.hash(binding),protocol,legacyCuts:V.clone(cuts).sort((a,b)=>a.authorityId.localeCompare(b.authorityId))},signer)});}
module.exports={protocol,base,validate,create};
