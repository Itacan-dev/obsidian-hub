"use strict";
// Portable private evidence: no Node, filesystem, application or identity-ledger imports.
const {check,fail}=require("./errors"),{fields,canonical,clone,text,uuid,revision,jsonValue}=require("./value");
const FORMAT="itacan-private-task-content",DECISION="N1-C-D05-D06-r1";
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const utf8=value=>new TextEncoder().encode(value),hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
function unhex(value){check(typeof value==="string"&&/^(?:[0-9a-f]{2})*$/.test(value),"Invalid lossless byte encoding.");return Uint8Array.from(value.match(/../g)??[],v=>parseInt(v,16));}
function sha256(value){
    const input=typeof value==="string"?utf8(value):value;check(input instanceof Uint8Array,"Byte input required.");
    const n=Math.ceil((input.length+9)/64)*64,b=new Uint8Array(n);b.set(input);b[input.length]=128;const view=new DataView(b.buffer);
    view.setUint32(n-8,Math.floor(input.length/0x20000000));view.setUint32(n-4,(input.length*8)>>>0);
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),r=(v,n)=>(v>>>n)|(v<<(32-n));
    for(let p=0;p<n;p+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(p+4*i);for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(r(x,7)^r(x,18)^(x>>>3))+w[i-7]+(r(y,17)^r(y,19)^(y>>>10)))>>>0;}
        let[a,c,d,e,f,g,j,k]=h;for(let i=0;i<64;i++){const t=(k+(r(f,6)^r(f,11)^r(f,25))+((f&g)^(~f&j))+K[i]+w[i])>>>0,u=((r(a,2)^r(a,13)^r(a,22))+((a&c)^(a&d)^(c&d)))>>>0;k=j;j=g;g=f;f=(e+t)>>>0;e=d;d=c;c=a;a=(t+u)>>>0;}[a,c,d,e,f,g,j,k].forEach((v,i)=>h[i]=(h[i]+v)>>>0);}
    return h.map(v=>v.toString(16).padStart(8,"0")).join("");
}
const digest=value=>sha256(utf8(canonical(value))),record=(v,names)=>fields(v,names,names);
function supported(value,label){if(value!==1)fail("UNSUPPORTED_SCHEMA","Unsupported "+label+" version; no downgrade.");}
function owner(ref){record(ref,["type","id"]);check(["project","resource"].includes(ref.type),"Invalid physical owner.");text(ref.id);}
const sameOwner=(a,b)=>a?.type===b?.type&&a?.id===b?.id;
function decode(bytes){try{return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes);}catch(_){return null;}}
function linesOf(bytes){
    const lines=[];let start=0;
    for(let i=0;i<bytes.length;i++)if(bytes[i]===10||bytes[i]===13){const end=i;if(bytes[i]===13&&bytes[i+1]===10)i++;lines.push({start,end,next:i+1,text:decode(bytes.slice(start,end))});start=i+1;}
    if(start<bytes.length||!lines.length)lines.push({start,end:bytes.length,next:bytes.length,text:decode(bytes.slice(start))});
    return lines;
}
const indentation=line=>(line.match(/^[ \t]*/)?.[0]??"").replace(/\t/g,"    ").length;
const details=line=>/^\s*(?:[-*+]|\d+[.)])\s+\[([^\]])\](?:[ \t]+(.*))?$/.exec(line??"");
function nextFence(line,current){const token=line.trim().match(/^(`{3,}|~{3,})(.*)$/);if(!token)return current;if(!current)return{character:token[1][0],length:token[1].length};return token[1][0]===current.character&&token[1].length>=current.length&&!token[2].trim()?null:current;}
function blockEnd(lines,start){let end=start+1;const level=indentation(lines[start].text??"");while(end<lines.length){if(!lines[end].text.trim()){let next=end+1;while(next<lines.length&&!lines[next].text.trim())next++;if(next>=lines.length||indentation(lines[next].text)<=level)break;end=next;}if(indentation(lines[end].text)<=level)break;end++;}return end;}
function eol(bytes){let lf=0,crlf=0,cr=0;for(let i=0;i<bytes.length;i++)if(bytes[i]===13){if(bytes[i+1]===10){crlf++;i++;}else cr++;}else if(bytes[i]===10)lf++;return{lf,crlf,cr,finalNewline:bytes.length>0&&[10,13].includes(bytes.at(-1)),bom:bytes[0]===239&&bytes[1]===187&&bytes[2]===191};}
function interpretation(bytes,base,insideFence,metadata,description){
    const decoded=decode(bytes),diagnostics=[];
    if(decoded===null)return{encoding:"unsupported",normalized:null,marker:null,title:null,continuation:null,steps:[],metadata:clone(metadata),explicitDescription:description,diagnostics:["UNSUPPORTED_UTF8"],status:"quarantined"};
    const lines=linesOf(bytes),first=details(lines[0]?.text),steps=[],prose=[];let fence=null;
    if(!first)diagnostics.push("NOT_TASK_LINE");if(insideFence)diagnostics.push("FENCED_EXAMPLE");
    if(first&&!/^[ xX]$/.test(first[1]))diagnostics.push("CHECKBOX_STATUS_UNINTERPRETED");
    if(/🔁|📅|⏳|🛫|✅|➕|❌|⏫|🔼|🔽|⏬|🔺|🆔|⛔|\[[^\]\r\n]*::/u.test(decoded))diagnostics.push("TASKS_SYNTAX_UNINTERPRETED");
    if(/<!--\s*hub-task:/.test(decoded)&&!/<!-- hub-task:[a-zA-Z0-9-]+ -->/.test(decoded))diagnostics.push("HUB_ID_UNRECOGNIZED");
    if(/<!--(?! hub-task:[a-zA-Z0-9-]+ -->)/.test(decoded))diagnostics.push("HTML_COMMENT_UNINTERPRETED");
    if(eol(bytes).cr)diagnostics.push("LONE_CR_UNSUPPORTED");
    const stack=[],orders=new Map();
    for(let i=1;i<lines.length;i++){
        const line=lines[i].text,token=line.trim().match(/^(`{3,}|~{3,})/);if(token){fence=nextFence(line,fence);prose.push(line);continue;}
        const child=!fence&&details(line);
        if(child&&!insideFence&&first){while(stack.length&&i>=stack.at(-1).endLine)stack.pop();const parentIndex=stack.at(-1)?.index??null,order=orders.get(parentIndex)??0;orders.set(parentIndex,order+1);
            if(!/^[ xX]$/.test(child[1]))diagnostics.push("CHECKBOX_STATUS_UNINTERPRETED");
            const endLine=blockEnd(lines,i);steps.push({line:i,startByte:base+lines[i].start,endByte:base+(lines[endLine]?.start??bytes.length),parentIndex,order,title:(child[2]??"").replace(/[ \t]*<!-- hub-task:[a-zA-Z0-9-]+ -->/g,""),marker:child[1]});stack.push({index:steps.length-1,endLine});
        }else prose.push(line);
    }
    if(fence)diagnostics.push("UNCLOSED_FENCE_REGION_AMBIGUOUS");
    return{encoding:"utf-8",normalized:decoded.replace(/\r\n|\r/g,"\n"),marker:first?.[1]??null,title:first?(first[2]??"").replace(/[ \t]*<!-- hub-task:[a-zA-Z0-9-]+ -->/g,""):null,continuation:prose.join("\n"),steps,metadata:clone(metadata),explicitDescription:description,diagnostics:[...new Set(diagnostics)],status:diagnostics.length?"quarantined":"supported-region"};
}
function sourceInfo(source){record(source,["documentId","path","root","revision","owner"]);text(source.documentId);text(source.path);text(source.root);text(source.revision);owner(source.owner);check(source.path.startsWith(source.root+"/")&&!source.path.includes("\\")&&!source.path.split("/").some(p=>!p||p==="."||p===".."),"Wrong physical source root/path.");}
function captureSourceEnvelope(bytes,request){
    check(bytes instanceof Uint8Array,"Original source bytes required.");record(request,["id","version","parserVersion","source","target","line","expectedRange","metadata","explicitDescription"]);
    supported(request.version,"source envelope");supported(request.parserVersion,"source parser");text(request.id);sourceInfo(request.source);record(request.target,["taskId","stepId","taskRevision"]);uuid(request.target.taskId);if(request.target.stepId!==null)uuid(request.target.stepId);revision(request.target.taskRevision);check(request.target.taskRevision>=1,"Capture needs a native revision association.");revision(request.line);jsonValue(request.metadata);check(request.explicitDescription===null||typeof request.explicitDescription==="string","Explicit description must remain separate.");
    let start=0,end=bytes.length,insideFence=false;const valid=decode(bytes)!==null;
    if(valid){const lines=linesOf(bytes);check(request.line<lines.length,"Source line unavailable.");start=lines[request.line].start;end=lines[blockEnd(lines,request.line)]?.start??bytes.length;let fence=null;
        for(let i=0;i<request.line;i++)fence=nextFence(lines[i].text,fence);insideFence=!!fence;
    }
    if(request.expectedRange!==null){record(request.expectedRange,["start","end"]);if(request.expectedRange.start!==start||request.expectedRange.end!==end)fail("SOURCE_RANGE_CONFLICT","Byte range differs from the complete captured list-item region.");}
    const raw=bytes.slice(start,end),parsed=interpretation(raw,start,insideFence,request.metadata,request.explicitDescription);
    const unresolvedContext=parsed.diagnostics.includes("UNCLOSED_FENCE_REGION_AMBIGUOUS")&&end<bytes.length?{start:end,end:bytes.length,hex:hex(bytes.slice(end)),sha256:sha256(bytes.slice(end))}:null;
    const result={format:"itacan-private-source-envelope",version:1,parserVersion:1,decisionRevision:DECISION,id:request.id,privacy:"local-private",source:clone(request.source),target:clone(request.target),document:{sha256:sha256(bytes),byteLength:bytes.length},region:{line:request.line,start,end,insideFence},raw:{encoding:parsed.encoding,hex:hex(raw),sha256:sha256(raw),eol:eol(raw)},unresolvedContext,folderContext:{type:"source-parent-folder-evidence",path:request.source.path.slice(0,request.source.path.lastIndexOf("/")),noteAssociation:false},parsed,checksum:""};
    result.checksum=digest({...result,checksum:null});validateEnvelope(result);return result;
}
function validateEnvelope(e){
    record(e,["format","version","parserVersion","decisionRevision","id","privacy","source","target","document","region","raw","unresolvedContext","folderContext","parsed","checksum"]);supported(e.version,"source envelope");supported(e.parserVersion,"source parser");if(e.format!=="itacan-private-source-envelope"||e.decisionRevision!==DECISION)fail("UNSUPPORTED_SCHEMA","Unsupported source envelope contract.");check(e.privacy==="local-private","Source evidence must be private.");text(e.id);sourceInfo(e.source);
    record(e.target,["taskId","stepId","taskRevision"]);uuid(e.target.taskId);if(e.target.stepId!==null)uuid(e.target.stepId);revision(e.target.taskRevision);check(e.target.taskRevision>0,"Invalid capture revision.");
    record(e.document,["sha256","byteLength"]);revision(e.document.byteLength);check(typeof e.document.sha256==="string"&&/^[0-9a-f]{64}$/.test(e.document.sha256),"Invalid source document checksum.");record(e.region,["line","start","end","insideFence"]);for(const k of["line","start","end"])revision(e.region[k]);check(typeof e.region.insideFence==="boolean"&&e.region.start<=e.region.end&&e.region.end<=e.document.byteLength,"Invalid byte offsets.");
    record(e.raw,["encoding","hex","sha256","eol"]);const raw=unhex(e.raw.hex);check(raw.length===e.region.end-e.region.start&&sha256(raw)===e.raw.sha256&&canonical(e.raw.eol)===canonical(eol(raw)),"Original bytes or EOL evidence corrupted.");
    if(e.unresolvedContext!==null){record(e.unresolvedContext,["start","end","hex","sha256"]);const extra=unhex(e.unresolvedContext.hex);check(e.unresolvedContext.start===e.region.end&&e.unresolvedContext.end===e.document.byteLength&&extra.length===e.unresolvedContext.end-e.unresolvedContext.start&&sha256(extra)===e.unresolvedContext.sha256,"Ambiguous source context corrupted.");}
    record(e.folderContext,["type","path","noteAssociation"]);check(e.folderContext.type==="source-parent-folder-evidence"&&e.folderContext.noteAssociation===false&&e.folderContext.path===e.source.path.slice(0,e.source.path.lastIndexOf("/")),"Folder context differs from note parent.");
    record(e.parsed,["encoding","normalized","marker","title","continuation","steps","metadata","explicitDescription","diagnostics","status"]);jsonValue(e.parsed.metadata);check(e.parsed.explicitDescription===null||typeof e.parsed.explicitDescription==="string","Invalid explicit description.");
    const parsed=interpretation(raw,e.region.start,e.region.insideFence,e.parsed.metadata,e.parsed.explicitDescription);check(canonical(parsed)===canonical(e.parsed)&&parsed.encoding===e.raw.encoding,"Parsed interpretation differs from preserved source.");
    check(!!e.unresolvedContext===(parsed.diagnostics.includes("UNCLOSED_FENCE_REGION_AMBIGUOUS")&&e.region.end<e.document.byteLength),"Ambiguous source context missing or misattributed.");
    check(e.checksum===digest({...e,checksum:null}),"Source envelope integrity checksum mismatch.");return e;
}
function originalBytes(e){validateEnvelope(e);return unhex(e.raw.hex);}
function verifySourceEnvelope(e,bytes,source){
    validateEnvelope(e);sourceInfo(source);if(!sameOwner(source.owner,e.source.owner))fail("OWNER_CONFLICT","Physical source owner changed.");
    if(canonical(source)!==canonical(e.source)||sha256(bytes)!==e.document.sha256)fail("SOURCE_CONFLICT","Source revision/location/bytes changed; no rebase or identity allocation.");
    const next=captureSourceEnvelope(bytes,{id:e.id,version:1,parserVersion:1,source,target:e.target,line:e.region.line,expectedRange:{start:e.region.start,end:e.region.end},metadata:e.parsed.metadata,explicitDescription:e.parsed.explicitDescription});check(canonical(next)===canonical(e),"Source capture no longer verifies.");return true;
}
function contentOf(task){const evidence=task.migration?.evidence;return evidence&&typeof evidence==="object"&&!Array.isArray(evidence)&&evidence.format===FORMAT?evidence:null;}
function fingerprint(task){return digest({...task,migration:task.migration?{...task.migration,evidence:null}:null});}
function validatePrivateContent(task){
    const c=contentOf(task);if(!c)return;
    record(c,["format","version","decisionRevision","requiredCapabilities","previousEvidence","originals","revisions"]);supported(c.version,"private content");if(c.decisionRevision!==DECISION||canonical(c.requiredCapabilities)!==canonical(["private-source-content-v1"]))fail("UNSUPPORTED_SCHEMA","Unsupported private content capability/decision.");jsonValue(c.previousEvidence);check(Array.isArray(c.originals)&&Array.isArray(c.revisions)&&c.revisions.length>0,"Missing content evidence/revisions.");
    const ids=new Set(),targets=new Set();for(const e of c.originals){validateEnvelope(e);const target=canonical({taskId:e.target.taskId,stepId:e.target.stepId});check(e.target.taskId===task.id&&e.target.taskRevision<=task.revision&&!ids.has(e.id)&&!targets.has(target),"Conflicting original source target.");ids.add(e.id);targets.add(target);}
    let previous=null,lastNative=0;
    for(const [i,r]of c.revisions.entries()){
        record(r,["version","revision","taskRevision","operationId","current","removedStepIds","nativeFingerprint","originalChecksums","previousEvidenceDigest","previousDigest","digest"]);supported(r.version,"content revision");check(r.revision===i+1&&r.taskRevision>lastNative&&r.taskRevision<=task.revision&&r.previousDigest===previous,"Invalid content revision chain.");text(r.operationId);record(r.current,["continuation","stepBodies"]);check(typeof r.current.continuation==="string"&&Array.isArray(r.current.stepBodies),"Invalid current content.");const bodies=new Set();for(const b of r.current.stepBodies){record(b,["id","body"]);uuid(b.id);check(typeof b.body==="string"&&!bodies.has(b.id),"Invalid Step body.");bodies.add(b.id);}check(Array.isArray(r.removedStepIds)&&new Set(r.removedStepIds).size===r.removedStepIds.length,"Invalid deletion evidence.");r.removedStepIds.forEach(uuid);
        check(Array.isArray(r.originalChecksums)&&r.originalChecksums.length<=c.originals.length&&canonical(r.originalChecksums)===canonical(c.originals.slice(0,r.originalChecksums.length).map(e=>({id:e.id,checksum:e.checksum})))&&r.previousEvidenceDigest===digest(c.previousEvidence),"Original/private evidence disappeared or changed.");
        check(r.digest===digest({...r,digest:null}),"Corrupt content revision checksum.");previous=r.digest;lastNative=r.taskRevision;
    }
    const latest=c.revisions.at(-1);check(latest.taskRevision===task.revision&&latest.nativeFingerprint===fingerprint(task),"Native structure/content revisions diverged.");
    check(latest.originalChecksums.length===c.originals.length,"Original source list differs from committed content revision.");
    check(canonical(latest.current.stepBodies.map(b=>b.id).sort())===canonical(task.steps.map(s=>s.id).sort()),"Current content has missing/retired Step targets.");
}
function setContentIntent(task,before,intent,bodies){
    const old=contentOf(before);if(intent===null){check(!old&&bodies.every(b=>b.body===""),"Current private content needs an explicit revision guard.");return;}
    record(intent,["version","expectedRevision","appendOriginals","continuation"]);supported(intent.version,"content edit");if(intent.expectedRevision!==(old?.revisions.length??0))fail("CONTENT_REVISION_CONFLICT","Content evidence revision changed.");check(typeof intent.continuation==="string"&&Array.isArray(intent.appendOriginals),"Invalid content edit.");
    const c=old?clone(old):{format:FORMAT,version:1,decisionRevision:DECISION,requiredCapabilities:["private-source-content-v1"],previousEvidence:clone(before.migration?.evidence??null),originals:[],revisions:[]};
    for(const e of intent.appendOriginals){validateEnvelope(e);if(!sameOwner(e.source.owner,before.owner))fail("OWNER_CONFLICT","Source owner differs from the native physical owner.");check(e.target.taskId===task.id&&e.target.taskRevision<=before.revision,"Source target/revision conflict.");check(e.target.stepId===null||before.steps.some(s=>s.id===e.target.stepId)||task.steps.some(s=>s.id===e.target.stepId),"Source Step belongs to another task.");
        const previous=c.originals.find(o=>o.id===e.id||o.target.stepId===e.target.stepId);if(previous){if(canonical(previous)!==canonical(e))fail("SOURCE_CONFLICT","Original evidence is immutable; relabelled rebase unsupported.");}else c.originals.push(clone(e));}
    // Current intent is staged only inside the detached candidate. The final
    // revision is appended after the core increments the task revision.
    task.migration=before.migration?{...clone(before.migration),evidence:c}:{source:"private-native-content-v1",sourceId:task.id,importedAt:null,evidence:c};
    return{continuation:intent.continuation,stepBodies:clone(bodies)};
}
function finishContentRevision(task,before,operationId,current){
    const c=contentOf(task);if(!c)return;
    const prior=contentOf(before)?.revisions.at(-1),next=current??{continuation:prior?.current.continuation??"",stepBodies:task.steps.map(s=>({id:s.id,body:prior?.current.stepBodies.find(b=>b.id===s.id)?.body??""}))};
    const r={version:1,revision:c.revisions.length+1,taskRevision:task.revision,operationId,current:clone(next),removedStepIds:before.steps.filter(s=>!task.steps.some(n=>n.id===s.id)).map(s=>s.id),nativeFingerprint:fingerprint(task),originalChecksums:c.originals.map(e=>({id:e.id,checksum:e.checksum})),previousEvidenceDigest:digest(c.previousEvidence),previousDigest:c.revisions.at(-1)?.digest??null,digest:""};r.digest=digest({...r,digest:null});c.revisions.push(r);
}
function validateContentContinuity(state){
    const prior=new Map();for(const receipt of state.receipts)for(const task of receipt.result.tasks){const c=contentOf(task);if(c&&(!prior.has(task.id)||task.revision>prior.get(task.id).revision))prior.set(task.id,task);}
    for(const task of state.tasks){const old=prior.get(task.id);if(!old)continue;const a=contentOf(old),b=contentOf(task);check(b&&b.revisions.length>=a.revisions.length&&canonical(b.revisions.slice(0,a.revisions.length))===canonical(a.revisions)&&canonical(b.originals.slice(0,a.originals.length))===canonical(a.originals),"Committed private content cannot be dropped or rewritten relative to receipts.");}
}
function currentSearchProjection(task,expectedOwner){
    require("./domain").validateTask(task);owner(expectedOwner);check(sameOwner(expectedOwner,task.owner),"Current content belongs to another physical owner.");
    const current=contentOf(task)?.revisions.at(-1).current;
    return clone({version:1,kind:"current-native-search-specimen",id:task.id,owner:task.owner,title:task.title,description:task.description,continuation:current?.continuation??"",steps:task.steps.map(s=>({id:s.id,parentStepId:s.parentStepId,order:s.order,title:s.title,body:current?.stepBodies.find(b=>b.id===s.id)?.body??""})),metadata:{importance:task.importance,start:task.start,due:task.due,phase:task.phase},parity:"unverified; no production Search routing or ranking"});
}
module.exports={CONTENT_DECISION:DECISION,captureSourceEnvelope,validateEnvelope,originalBytes,verifySourceEnvelope,currentSearchProjection,sha256,contentOf,validatePrivateContent,validateContentContinuity,setContentIntent,finishContentRevision,canonical,clone};
