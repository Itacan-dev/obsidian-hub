"use strict";
const fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os");
const D=require("../domain"),M=require("../repository"),N=require("../node-store");
const id=n=>"10000000-0000-4000-8000-"+String(n).padStart(12,"0");
const registry=[
    ["private","project","private","Projects/Private",false],["itacan","project","itacan","Projects/Itacan",true],
    ["hub","project","hub","Projects/Obsidian Hub",true],["knowledge","resource","study","Resources/Knowledge",false],
    ["research","resource","literature","Resources/Research",false],["explorations","resource","references","Resources/Explorations",false],
    ["inspiration","resource","inspiration","Resources/Inspiration",false]
].map(([key,type,id,root,shared])=>({key,owner:{type,id},root,shared}));
const owner=key=>registry.find(r=>r.key===key)?.owner??null;
function snapshot(items=[{entryId:"parent",legacyId:"old-parent"}],patch={}) {
    const files=[],occurrences=[];
    for(const [ordinal,item]of items.entries()) {
        const key=item.ownerKey??"private",r=registry.find(r=>r.key===key),sourcePath=item.path??(r?.root??"Outside")+"/Tasks.md";
        let file=files.find(f=>f.path===sourcePath);if(!file){file={id:"source:"+sourcePath,path:sourcePath,revision:"source-r1",content:""};files.push(file);}
        const line=file.content?file.content.split("\n").length-1:0,kind=item.kind??"task";
        file.content+=(item.raw??((kind==="step"?(item.stepParent?"        ":"    "):"")+"- [ ] "+(item.title??"Same title")+(item.legacyId===undefined||item.legacyId===null?"":" <!-- hub-task:"+item.legacyId+" -->")))+"\n";
        occurrences.push({entryId:item.entryId,kind,fileId:file.id,line,end:line+1,ordinal,parentEntryId:item.parent??null,parentStepEntryId:item.stepParent??null,order:item.order??0,
            owner:Object.hasOwn(item,"owner")?item.owner:owner(key),folder:{path:sourcePath.slice(0,sourcePath.lastIndexOf("/")),locationId:item.unresolved?null:"folder-"+key,state:item.unresolved?"unresolved":"resolved"},blockers:item.blockers??[],privateEvidence:item.privateEvidence??null});
    }
    for(const o of occurrences) {
        const file=files.find(f=>f.id===o.fileId),later=occurrences.filter(n=>n.fileId===o.fileId&&n.line>o.line);
        if(o.kind==="task")o.end=later.find(n=>n.kind==="task")?.line??file.content.split("\n").length-1;
        else o.end=later.find(n=>n.kind==="task"||(!o.parentStepEntryId&&n.kind==="step"&&n.parentStepEntryId===null)||o.parentStepEntryId!==null&&n.parentStepEntryId!==o.entryId)?.line??file.content.split("\n").length-1;
    }
    return{version:1,id:"snapshot-1",revision:"capture-r1",registryRevision:"registry-r1",parserVersion:1,scope:"global-synthetic",files,occurrences,...patch};
}
function command(repo,type,payload,operationId=type+"-1") {return{version:1,decisionRevision:D.DECISION_REVISION,type,operationId,expectedRevision:repo.snapshot().revision,payload};}
const prepare=(repo,s=snapshot(),planId="plan-1",operationId="prepare-1")=>command(repo,"prepare",{planId,snapshot:s,publishOperationId:"publish-"+planId},operationId);
const approve=(repo,s=snapshot(),planId="plan-1",operationId="approve-1")=>command(repo,"approve",{planId,snapshot:s,reviewer:"synthetic-reviewer",syntheticOnly:true},operationId);
const publish=(repo,s=snapshot(),planId="plan-1")=>command(repo,"publish",{planId,snapshot:s},"publish-"+planId);
async function fixture(kind,t,extra={}) {
    let seq=1000,repo,directory=null;const storage=new M.MemoryIdentityStorage();
    if(kind==="directory"){const temp=await fs.realpath(os.tmpdir());directory=await fs.mkdtemp(path.join(temp,"itacan-identity-test-"));}
    const options={registry:registry.map(({key,...r})=>r),registryRevision:"registry-r1",storeId:id(900),idFactory:()=>id(++seq),clock:()=>1792224000000,storage,...(directory?{directory}:{}),...extra};
    repo=kind==="directory"?await N.createDirectoryIdentity(options):await M.createMemoryIdentity(options);
    const f={get repo(){return repo;},directory,options,storage,async reopen(){await repo.close();repo=kind==="directory"?await N.openDirectoryIdentity(options):await M.openMemoryIdentity(options);return repo;},async close(){await repo.close();},async cleanup(){try{await repo.close();}finally{if(directory){const real=await fs.realpath(directory),temp=await fs.realpath(os.tmpdir());if(path.dirname(real)!==temp||!path.basename(real).startsWith("itacan-identity-test-"))throw Error("Unsafe test cleanup");await fs.rm(real,{recursive:true,force:true});}}}};
    t?.after(()=>f.cleanup());return f;
}
async function prepared(repo,s=snapshot(),planId="plan-1") {return repo.execute(prepare(repo,s,planId,"prepare-"+planId));}
async function published(repo,s=snapshot(),planId="plan-1") {await prepared(repo,s,planId);await repo.execute(approve(repo,s,planId,"approve-"+planId));return repo.execute(publish(repo,s,planId));}
module.exports={D,M,N,id,registry,owner,snapshot,command,prepare,approve,publish,fixture,prepared,published};
