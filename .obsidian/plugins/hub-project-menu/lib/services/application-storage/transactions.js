"use strict";
const fs=require("fs").promises,path=require("path"),{randomUUID}=require("crypto"),C=require("./codec"),L=require("./lease");
function createManagedApplicationStore(input) {
    C.portable(input);C.fields(input,["version","scope","directory","authorityId","applicationContextId"]);C.check(input.version===1&&input.scope==="inactive-disposable");C.uuid(input.authorityId);C.text(input.applicationContextId);C.check(typeof input.directory==="string");const config=C.copy(input);
    let phase="configured",pin=null,lease=null,accepted=null,opening=null,queue=Promise.resolve(),pending=null,closing=false,closePromise=null;
    const observations=new Map();
    const file=()=>path.join(pin.root,"data.json");
    const result=(status,code,extra={})=>C.copy({version:1,privacy:"local-private",status,code,...extra});
    const remember=e=>observations.set(e.revision,{digest:C.hash(e.data),fields:Object.fromEntries(C.KNOWN.map(k=>[k,C.fact(e.data,k)]))});
    function observation(e) {remember(e);return C.copy({version:1,privacy:"local-private",authorityId:e.authorityId,applicationContextId:e.applicationContextId,revision:e.revision,snapshotDigest:C.hash(e.data),ownerEpoch:lease.epoch,allowedScopes:e.allowedScopes});}
    const bounded=e=>["LEASE_LOST","ROOT_CHANGED","ROOT_REJECTED","STORAGE_REJECTED","INTEGRITY","UNSUPPORTED_FORMAT","AUTHORITY_MISMATCH","CONTEXT_MISMATCH","EXTERNAL_CHANGE","OBSERVATION_INVALID","DEPENDENCY_REQUIRED","SCOPE_UNSUPPORTED","SNAPSHOT_UNSTABLE"].includes(e.code)?e.code:"APPLICATION_UNAVAILABLE";
    async function load(permitCandidate=false) {
        await L.assertOwned(lease);await L.ordinary(file());const raw=await fs.readFile(file(),"utf8");let e;
        try{e=C.envelope(JSON.parse(raw),config);}catch(error){if(error.code)throw error;C.fail("INTEGRITY");}
        if(accepted!==null && raw!==accepted && !(permitCandidate && pending?.raw===raw))C.fail("EXTERNAL_CHANGE");
        await L.assertOwned(lease);C.check(await fs.readFile(file(),"utf8")===raw,"SNAPSHOT_UNSTABLE");await L.assertOwned(lease);return {e,raw};
    }
    async function publish(e,creating=false) {
        await L.assertOwned(lease);const raw=C.canonical(e)+"\n",tmp=path.join(pin.root,`.application.${process.pid}.${randomUUID()}.tmp`);let handle=null;
        if(pending)pending.raw=raw;
        try{
            handle=await fs.open(tmp,"wx");await handle.writeFile(raw,"utf8");await handle.sync();await handle.close();handle=null;
            C.check(await fs.readFile(tmp,"utf8")===raw,"INTEGRITY");await L.assertOwned(lease);
            if(creating){try{await fs.lstat(file());C.fail("PROFILE_EXISTS");}catch(error){if(error.code!=="ENOENT")throw error;}}
            else{await L.ordinary(file());C.check(await fs.readFile(file(),"utf8")===accepted,"EXTERNAL_CHANGE");}
            await fs.rename(tmp,file());
            await L.assertOwned(lease);const readback=await fs.readFile(file(),"utf8");C.check(readback===raw,"ACKNOWLEDGEMENT_UNCERTAIN");C.envelope(JSON.parse(readback),config);await L.assertOwned(lease);
            accepted=raw;remember(e);return raw;
        }finally{await handle?.close().catch(()=>{});await fs.unlink(tmp).catch(()=>{});}
    }
    const enqueue=work=>{C.check(phase==="open"&&!closing,"STORE_CLOSED");const job=queue.catch(()=>{}).then(work);queue=job;return job;};
    async function start(options,create) {
        C.check(!closing && phase!=="closing","STORE_CLOSING");C.fields(options,create?["version","data","allowedScopes"]:["version"]);C.check(options.version===1);
        if(opening){C.check(!create,"PROFILE_EXISTS");return opening;}
        C.check(phase==="configured"||phase==="closed","PROFILE_EXISTS");phase="opening";
        opening=(async()=>{let creationPublication=false;try{
            const next=await L.pin(config.directory,config.authorityId);if(pin)C.check(C.same(pin.id,next.id),"ROOT_CHANGED");pin=next;
            if(create)C.check((await fs.readdir(pin.root)).length===0,"PROFILE_NOT_EMPTY");
            if(!create){try{await fs.lstat(path.join(pin.root,"APPLICATION.lock"));C.fail("LOCK_HELD");}catch(error){if(error.code!=="ENOENT")throw error;}await L.ordinary(file());C.envelope(JSON.parse(await fs.readFile(file(),"utf8")),config);}
            lease=await L.acquire(pin,config.authorityId);
            if(create){C.check(C.same(await fs.readdir(pin.root),["APPLICATION.lock"]),"PROFILE_NOT_EMPTY");C.scopes(options.allowedScopes);C.portable(options.data);C.check(C.plain(options.data));
                const e=C.seal({format:C.FORMAT,version:1,capabilities:[C.CAPABILITY],hubState:{schemaVersion:2},authorityId:config.authorityId,applicationContextId:config.applicationContextId,revision:0,allowedScopes:C.copy(options.allowedScopes),initialSnapshotDigest:C.hash(options.data),data:C.copy(options.data),receipts:[]});creationPublication=true;await publish(e,true);
            }else{accepted=null;const r=await load();accepted=r.raw;}
            const {e}=await load();C.check(!closing,"STORE_CLOSING");phase="open";return observation(e);
        }catch(error){if(lease){try{await L.release(lease);lease=null;}catch(_){phase="closing";throw error;}}phase="closed";accepted=null;if(creationPublication)C.fail("PUBLICATION_UNCERTAIN");throw error;}finally{opening=null;}})();return opening;
    }
    function scoped(e,names) {C.check(Array.isArray(names)&&names.length>0&&new Set(names).size===names.length);const allowed=new Set(e.allowedScopes.flatMap(s=>[s.field,...s.dependencies]));C.check(names.every(k=>allowed.has(k)),"SCOPE_UNSUPPORTED");}
    function match(r) {C.check(r.authorityId===config.authorityId,"AUTHORITY_MISMATCH");C.check(r.applicationContextId===config.applicationContextId,"CONTEXT_MISMATCH");}
    function retained(e,r) {const receipt=e.receipts.find(x=>x.request.operationId===r.operationId);if(!receipt)return null;if(receipt.requestDigest!==C.hash(r))return result("conflict","OPERATION_CONFLICT");return result("replayed","RECEIPT_CONFIRMED",{replayed:true,result:receipt.result,receiptDigest:receipt.digest});}
    async function transact(input,signal) {
        const r=C.request(input);match(r);
        if(r.participant!=="local-private")return result("unsupported-participant","SHARED_PARTICIPANT_UNSUPPORTED");
        return enqueue(async()=>{
            let publication=false;
            try{
                const {e,raw}=await load(true),old=retained(e,r);if(old){if(old.status==="replayed"){accepted=raw;if(pending?.operationId===r.operationId)pending=null;}return old;}
                if(pending)return result("uncertain","RECONCILIATION_REQUIRED",{operationId:pending.operationId});
                if(r.observation.ownerEpoch!==lease.epoch)return result("unknown","OWNER_EPOCH_CHANGED",{retry:"review"});
                const observed=observations.get(r.observation.revision);C.check(observed&&observed.digest===r.observation.snapshotDigest,"OBSERVATION_INVALID");
                const declarations=new Map(e.allowedScopes.map(s=>[s.field,s]));scoped(e,[...r.changes,...r.dependencies].map(x=>x.field));C.check(r.changes.every(c=>declarations.has(c.field)),"SCOPE_UNSUPPORTED");
                const all=[...r.changes,...r.dependencies],guarded=new Set(all.map(c=>c.field));C.check(r.changes.every(c=>declarations.get(c.field).dependencies.every(k=>guarded.has(k))),"DEPENDENCY_REQUIRED");
                for(const c of all){C.check(C.same(observed.fields[c.field],c.expected),"OBSERVATION_INVALID");if(!C.same(C.fact(e.data,c.field),c.expected))return result("conflict","FIELD_CONFLICT");}
                if(signal?.aborted)return result("cancelled","BEFORE_PUBLICATION");
                const data=C.copy(e.data),selected=r.changes.map(c=>{const before=C.fact(data,c.field);if(c.operation==="delete")delete data[c.field];else data[c.field]=C.copy(c.value);return {field:c.field,before,after:C.fact(data,c.field)};});
                const value={version:1,authorityId:config.authorityId,applicationContextId:config.applicationContextId,operationId:r.operationId,revision:e.revision+1,snapshotDigest:C.hash(data),selected};
                const receiptBody={request:r,requestDigest:C.hash(r),revision:value.revision,previousSnapshotDigest:C.hash(e.data),selected,result:value,previousReceiptDigest:e.receipts.at(-1)?.digest??null},receipt={...receiptBody,digest:C.hash(receiptBody)};
                const {checksum:ignored,...body}=e,candidate=C.seal({...body,revision:value.revision,data,receipts:[...e.receipts,receipt]});C.envelope(candidate,config);
                if(signal?.aborted)return result("cancelled","BEFORE_PUBLICATION");
                pending={operationId:r.operationId,digest:C.hash(r),raw:null};publication=true;await publish(candidate);pending=null;
                return result("committed","READBACK_CONFIRMED",{replayed:false,result:value,receiptDigest:receipt.digest});
            }catch(error){return result(publication?"uncertain":"recovery-required",publication?"PUBLICATION_UNCERTAIN":bounded(error),{operationId:r.operationId,retry:publication?"identical-request-after-reconciliation":"review"});}
        });
    }
    return Object.freeze({
        create:options=>start(C.copy(options),true),open:options=>start(C.copy(options),false),
        readScopes(input){C.portable(input);C.fields(input,["version","authorityId","applicationContextId","fields"]);C.check(input.version===1);match(input);const r=C.copy(input);return enqueue(async()=>{const {e}=await load();scoped(e,r.fields);return {observation:observation(e),fields:r.fields.map(field=>({field,...C.fact(e.data,field),...(Object.hasOwn(e.data,field)?{value:C.copy(e.data[field])}:{})}))};});},
        transact,
        reconcile(input){const r=C.request(input);match(r);if(r.participant!=="local-private")return Promise.resolve(result("unsupported-participant","SHARED_PARTICIPANT_UNSUPPORTED"));return enqueue(async()=>{try{const {e,raw}=await load(true),old=retained(e,r);if(old?.status==="replayed"){accepted=raw;if(pending?.operationId===r.operationId)pending=null;remember(e);return old;}return old??result("unknown","RECEIPT_UNAVAILABLE",{operationId:r.operationId,retry:"review"});}catch(error){return result("recovery-required",bounded(error),{operationId:r.operationId,retry:"review"});}});},
        close(){if(closePromise)return closePromise;if(phase==="closed"&&!lease)return Promise.resolve();closing=true;phase="closing";closePromise=(async()=>{try{await opening?.catch(()=>{});await queue.catch(()=>{});if(lease){await L.release(lease);lease=null;}accepted=null;pending=null;observations.clear();phase="closed";closing=false;}finally{closePromise=null;}})();return closePromise;}
    });
}
module.exports={createManagedApplicationStore};
