"use strict";
const S = require('./support.cjs'), H = require('../../host/tests/support.cjs'), W = require('../../writer'), P = require('../../writer/policy');
async function attach(t, f, i, extra = {}, create = null) {
    await f.repos[i].close();
    const reg = H.registry(); reg.change(v => { v.owners = [{ owner:f.owner, partitionId:'shared', root:'Projects/Shared', dashboard:'Projects/Shared/Dashboard.md', shared:true, available:true, status:'active', locations:[], mounts:[], shareApproval:{version:1,projectId:f.owner.id,root:'Projects/Shared',reviewDigest:'a'.repeat(64)} }]; },false);
    const config = { version:1,scope:'inactive-disposable',storageFormat:'private-v4',authorityId:f.authority,directory:f.dirs[i],applicationContextId:'synthetic-app',registryId:'synthetic-registry' };
    const policy = { version:1, owners:[{owner:f.owner,partitionId:'shared'}], commands:[...S.G.TYPES,'git.receive'], inventory:S.S.inventory, phases:{version:1,revision:'shared-no-phases',values:[]} };
    const options={registry:reg,writerPolicy:policy,gitSharing:{version:1,replicaId:S.crypto.randomUUID()},repositoryOptions:{idFactory:S.crypto.randomUUID,clock:()=>1792661003000,...extra}};
    const session=W.createNativeWriterSession(config,options); t.after(()=>session.dispose());
    if(create)await session.host.create(create);else await session.host.open({version:1,expectedAuthorityId:f.authority,syntheticOnly:true});
    const cap=await session.authorize({version:1,owners:policy.owners,commands:policy.commands}), repo=H.held.get(f.dirs[i]); f.repos[i]=repo;
    async function request(command){await session.host.refresh(); const info=repo.info();return {version:1,reason:'Explicit synthetic Git action',scope:{authorityId:f.authority,ownerContextPin:reg.snapshot().digest,identityPin:null,inventoryPin:P.hash(policy.inventory),phasePin:P.hash(policy.phases),partitions:[{id:'shared',owner:f.owner,expectedRevision:info.partitions[0].revision}]},command};}
    return {session,cap,reg,repo,config,policy,options,request,submit:async c=>session.writer[c.type.startsWith('step.')?'step':'task'](cap,await request(c))};
}
module.exports={...S,H,P,attach};
