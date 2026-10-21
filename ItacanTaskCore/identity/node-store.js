"use strict";
// Deliberately separate entry point; explicit existing OS Temp directories only.
const fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),{randomUUID}=require("node:crypto");
const {NodeDirectory}=require("../src/node-directory"),{check,fail}=require("../src/errors");
const D=require("./domain"),{initialState,IdentityRepository}=require("./repository");
async function tempDirectory(directory){
    check(typeof directory==="string"&&path.isAbsolute(directory),"Explicit disposable absolute directory required.");
    const root=await fs.realpath(os.tmpdir()),real=await fs.realpath(directory),relative=path.relative(root,real);
    check(relative!==""&&!relative.startsWith(".."+path.sep)&&relative!==".."&&!path.isAbsolute(relative),"Identity persistence is restricted to an existing OS Temp subdirectory.");
    const stat=await fs.lstat(directory);check(stat.isDirectory()&&!stat.isSymbolicLink(),"Ordinary disposable directory required.");return real;
}
function pointer(raw){
    let wrapper;try{wrapper=JSON.parse(raw);}catch(_){fail("INTEGRITY","Identity pointer is invalid JSON; preserve evidence.");}
    D.record(wrapper,["payload","sha256"]);check(D.hash(wrapper.payload)===wrapper.sha256,"Identity pointer checksum mismatch.");
    const p=wrapper.payload;D.record(p,["format","version","storeId","revision","file","sha256"]);
    if(p.version!==1)fail("UNSUPPORTED_VERSION","Unsupported identity pointer version.");
    check(p.format==="itacan-private-identity-pointer"&&/^[0-9a-f]{64}$/.test(p.sha256),"Invalid identity pointer.");
    require("../src/value").uuid(p.storeId);require("../src/value").revision(p.revision);
    check(new RegExp("^identity-gen-"+p.revision+"-[0-9a-f-]{36}\\.json$").test(p.file),"Invalid identity generation name.");return p;
}
class DirectoryIdentityStorage {
    constructor(port,options){this.port=port;this.options=options;this.currentRaw=null;this.directorySyncSupported=null;}
    async verify(raw){
        const p=pointer(raw),bytes=await this.port.read(p.file);check(D.hash(bytes)===p.sha256,"Identity generation checksum mismatch.");
        let state;try{state=JSON.parse(bytes);}catch(_){fail("INTEGRITY","Identity generation is invalid JSON.");}
        D.validateState(state);check(state.storeId===p.storeId&&state.revision===p.revision,"Identity generation/pointer mismatch.");return state;
    }
    async load(){
        await this.port.assertWriter();let raw;try{raw=await this.port.read("CURRENT.json");}catch(e){if(e.code==="ENOENT")fail("RECOVERY_REQUIRED","Identity pointer missing; no empty ledger was created.");throw e;}
        if(this.currentRaw!==null&&raw!==this.currentRaw)fail("REVISION_CONFLICT","Identity pointer changed outside this writer.");
        const state=await this.verify(raw);this.currentRaw=raw;return state;
    }
    async commit(state,expectedRevision){
        await this.port.assertWriter();D.validateState(state);
        if(this.currentRaw!==null){const current=await this.load();if(current.revision!==expectedRevision)fail("REVISION_CONFLICT","Identity storage revision changed.");}
        else check(expectedRevision===null,"Creation revision must be null.");
        const hook=stage=>this.options.fault?.(stage),token=randomUUID(),stage="identity-stage-"+token+".tmp",file="identity-gen-"+state.revision+"-"+token+".json";
        const bytes=D.canonical(state)+"\n";await hook("beforeGenerationWrite");
        await this.port.writeNew(stage,bytes,s=>hook("generation:"+s));await hook("afterGenerationFlush");
        check(await this.port.read(stage)===bytes,"Identity staging readback mismatch.");
        await this.port.publish(stage,file);await hook("afterGenerationPublication");
        const payload={format:"itacan-private-identity-pointer",version:1,storeId:state.storeId,revision:state.revision,file,sha256:D.hash(bytes)};
        const raw=D.canonical({payload,sha256:D.hash(payload)})+"\n",temporary="identity-pointer-"+token+".tmp";
        await this.port.writeNew(temporary,raw,s=>hook("pointer:"+s));check(await this.port.read(temporary)===raw,"Identity pointer staging mismatch.");
        // Recheck the old pointer immediately before rename. The exclusive writer
        // lock is advisory; this is not a hostile-filesystem compare-and-swap.
        if(this.currentRaw!==null)check(await this.port.read("CURRENT.json")===this.currentRaw,"Identity pointer changed before commit.");
        await hook("beforePointerReplace");await this.port.replace(temporary,"CURRENT.json");this.currentRaw=raw;
        try{await hook("afterPointerReplace");this.directorySyncSupported=await this.port.syncDirectory();await hook("afterDirectorySync");}
        catch(_){fail("ACKNOWLEDGEMENT_LOST","Identity snapshot committed; reopen/retry original operation.");}
    }
    async close(){await this.port.release();}
}
async function open(options,creating){
    check(options&&typeof options.idFactory==="function","Explicit identity UUID allocator required.");
    const directory=await tempDirectory(options.directory),port=new NodeDirectory(directory);await port.list();await port.acquire();
    const storage=new DirectoryIdentityStorage(port,options);
    try{
        if(creating){check((await port.list()).every(n=>n==="WRITER.lock"),"Identity creation requires an empty disposable directory.");await storage.commit(initialState(options),null);}
        const state=await storage.load();await options.fault?.("duringRecovery");return new IdentityRepository(storage,state,options);
    }catch(error){await storage.close();throw error;}
}
async function inspectIdentityDirectory(directory){
    const port=new NodeDirectory(await tempDirectory(directory)),files=await port.list();let lockRaw=null,state=null,error=null;
    if(files.includes("WRITER.lock"))lockRaw=await port.read("WRITER.lock");
    try{state=await new DirectoryIdentityStorage(port,{}).verify(await port.read("CURRENT.json"));}catch(e){error={code:e.code??"INTEGRITY",message:"No verified identity snapshot; evidence retained."};}
    return{files,lockRaw,state,error};
}
async function preserveAbandonedIdentityLock({directory,expectedRaw,confirmDeadWriter}){
    check(confirmDeadWriter===true,"Explicit abandoned-lock review required.");const port=new NodeDirectory(await tempDirectory(directory));
    const raw=await port.read("WRITER.lock");check(raw===expectedRaw,"Abandoned lock changed after inspection.");
    let lock;try{lock=JSON.parse(raw);}catch(_){fail("RECOVERY_REQUIRED","Unrecognizable lock evidence; no lock moved.");}
    D.record(lock,["format","token","pid","host","createdAt"]);check(lock.format==="itacan-task-writer"&&D.isUUID(lock.token)&&Number.isSafeInteger(lock.createdAt)&&lock.createdAt>=0,"Unrecognized writer lock format; no lock moved.");
    check(lock.host===os.hostname()&&Number.isInteger(lock.pid)&&lock.pid>0&&lock.pid!==process.pid,"Cannot establish abandoned local writer.");
    let dead=false;try{process.kill(lock.pid,0);}catch(e){dead=e.code==="ESRCH";}
    check(dead,"Writer is live or cannot be proven dead.");
    const retained="abandoned-lock-"+randomUUID()+".json";await port.replace("WRITER.lock",retained);return{retained};
}
module.exports={createDirectoryIdentity:options=>open(options,true),openDirectoryIdentity:options=>open(options,false),inspectIdentityDirectory,preserveAbandonedIdentityLock};
