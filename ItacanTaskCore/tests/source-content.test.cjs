"use strict";
const{test}=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const S=require("./step-content-support.cjs"),{core,privateContent,id,request,clone}=S;
const task={id:id(1),revision:1,owner:S.context("itacan").owner};
const examples=[
    ["LF","- [ ] Task\n    continuation\n"], ["CRLF","- [ ] Task\r\n    continuation\r\n"],
    ["mixed EOL","- [ ] Task\r\n    paragraph\n    - [ ] Child\r\n"], ["no final newline","- [ ] Task\n    prose"],
    ["BOM","\uFEFF- [ ] Task\r\n    prose\n"], ["Unicode combining emoji","- [ ] Å 日本語 مرحبا e\u0301 🙂\n    prose\n"],
    ["tabs spaces trailing whitespace","- [ ] Task  \n\tprose\t \n"], ["blank paragraph","- [ ] Task\n\n    paragraph two\n"],
    ["ordinary nested lists","- [ ] Task\n    - prose\n        1. item\n            - [ ] Child\n"],
    ["HTML and hidden comments","- [ ] Task <!-- hub-task:Exact-ID --> <!-- other: unknown -->\n    - [ ] Step\n"],
    ["native block ID","- [ ] Task <!-- hub-task:old-id --> ^block-id\n"],
    ["links embeds tags","- [ ] **Task** [[Note|label]] ![[image.png]] [link](https://example.invalid) #tag\n    continuation\n"],
    ["fenced and quoted examples","- [ ] Task\n    ```md\n    - [ ] Example\n    ```\n    > - [ ] Quoted\n    - [ ] Actual\n"],
    ["nonstandard markers","- [/] Task\n    - [-] Child\n"], ["Tasks syntax","- [ ] Task 🔁 every day 📅 2026-10-17 [unknown:: retained]\n"],
    ["three levels","- [ ] Task\n    - [ ] First\n        - [ ] Nested\n            - [ ] Third\n    - [ ] Same\n"]
];
for(const[name,block]of examples)test("D06 exact captured byte round trip: "+name,()=>{
    const bytes=Buffer.from(block+(/[\r\n]$/.test(block)?"- [ ] Unrelated\n":"")),e=core.captureSourceEnvelope(bytes,request(task));assert.deepEqual(Buffer.from(core.originalBytes(e)),Buffer.from(block));assert.equal(e.region.start,0);assert.equal(e.region.end,Buffer.byteLength(block));assert.equal(e.document.sha256,crypto.createHash("sha256").update(bytes).digest("hex"));assert.equal(privateContent.sha256(bytes),e.document.sha256);assert(!e.parsed.normalized.includes("Unrelated"));assert.equal(e.parsed.explicitDescription,"Original explicit description");assert(!e.parsed.explicitDescription.includes("continuation"));
});
test("D06 portable SHA256 matches standard empty/long/multibyte vectors",()=>{
    for(const value of["","abc","🙂 日本語\r\n", "x".repeat(10000)])assert.equal(privateContent.sha256(Buffer.from(value)),crypto.createHash("sha256").update(value).digest("hex"));
});
test("D06 byte offsets after multibyte prefix and BOM never use JS code-unit indices",()=>{
    const prefix="\uFEFFpré日本🙂\r\n",block="- [ ] Task\r\n    continuation  \n",bytes=Buffer.from(prefix+block+"Following prose\n"),start=Buffer.byteLength(prefix),end=start+Buffer.byteLength(block);
    const e=core.captureSourceEnvelope(bytes,request(task,{line:1,expectedRange:{start,end}}));assert.deepEqual(Buffer.from(core.originalBytes(e)),Buffer.from(block));assert(start!==prefix.length);assert.throws(()=>core.captureSourceEnvelope(bytes,request(task,{line:1,expectedRange:{start:prefix.length,end}})),x=>x.code==="SOURCE_RANGE_CONFLICT");
});
for(const [name,bytes]of[["invalid UTF8",[255,192,175,0,10]],["UTF16 BOM",[255,254,45,0,32,0,91,0,93,0]]])test("D06 unsupported encoding preserves original bytes: "+name,()=>{
    const raw=Uint8Array.from(bytes),e=core.captureSourceEnvelope(raw,request(task));assert.equal(e.raw.encoding,"unsupported");assert.equal(e.parsed.status,"quarantined");assert.deepEqual(core.originalBytes(e),raw);assert.equal(e.parsed.normalized,null);
});
test("D06 ambiguous unclosed fence retains excluded context separately",()=>{
    const source="- [ ] Task\n    ```md\n    code\n- [ ] Could be code, not a proven sibling\n",e=core.captureSourceEnvelope(Buffer.from(source),request(task));assert(e.parsed.diagnostics.includes("UNCLOSED_FENCE_REGION_AMBIGUOUS"));assert.equal(e.parsed.status,"quarantined");assert(e.unresolvedContext);assert(!Buffer.from(core.originalBytes(e)).toString().includes("Could be code"));assert(Buffer.from(e.unresolvedContext.hex,"hex").toString().includes("Could be code"));
    const bad=clone(e);bad.unresolvedContext=null;assert.throws(()=>core.validateEnvelope(bad),/context missing/);
});
test("D06 fenced/quoted examples never become eligible native Steps",()=>{
    const e=core.captureSourceEnvelope(Buffer.from(examples.find(([n])=>n==="fenced and quoted examples")[1]),request(task));assert.deepEqual(e.parsed.steps.map(s=>s.title),["Actual"]);
    const f=core.captureSourceEnvelope(Buffer.from("```md\n- [ ] Example\n```\n"),request(task,{line:1}));assert(f.parsed.diagnostics.includes("FENCED_EXAMPLE"));const q=core.captureSourceEnvelope(Buffer.from("> - [ ] Example\n"),request(task));assert.equal(q.parsed.status,"quarantined");
});
test("D06 fence length and nested status remain explicit unsupported evidence",()=>{
    const text="- [ ] Task\n    ````md\n    ```\n    - [ ] Still an example\n    ````\n    - [-] Unknown status\n";
    const e=core.captureSourceEnvelope(Buffer.from(text),request(task));assert.deepEqual(e.parsed.steps.map(s=>s.title),["Unknown status"]);assert(e.parsed.diagnostics.includes("CHECKBOX_STATUS_UNINTERPRETED"));assert.equal(e.parsed.status,"quarantined");assert.deepEqual(Buffer.from(core.originalBytes(e)),Buffer.from(text));
});
test("D06 parsed ancestry and sibling orders retain three nested levels",()=>{
    const e=core.captureSourceEnvelope(Buffer.from(examples.find(([n])=>n==="three levels")[1]),request(task));
    assert.deepEqual(e.parsed.steps.map(s=>[s.parentIndex,s.order]),[[null,0],[0,0],[1,0],[null,1]]);assert(e.parsed.steps.every(s=>s.endByte>s.startByte));
});
test("D06 unknown metadata and priority syntax are retained without semantic conversion",()=>{
    for(const suffix of["[unknown:: value]","🔼","✅ 2026-10-17"]){const text="- [ ] Task "+suffix+"\n",e=core.captureSourceEnvelope(Buffer.from(text),request(task));assert(e.parsed.diagnostics.includes("TASKS_SYNTAX_UNINTERPRETED"));assert.equal(e.parsed.status,"quarantined");assert(Buffer.from(core.originalBytes(e)).toString().includes(suffix));}
});
const corruptions={
    "normalized mixed EOL":e=>e.raw.hex=Buffer.from(e.parsed.normalized).toString("hex"),"truncated bytes":e=>e.raw.hex=e.raw.hex.slice(0,-2),
    "dropped continuation":e=>e.parsed.continuation="","unknown metadata removal":e=>delete e.parsed.metadata.unknown,
    "lost hidden ID":e=>e.raw.hex=Buffer.from("- [ ] Changed\n").toString("hex"),"lost block reference":e=>e.parsed.title="Changed",
    "wrong owner":e=>e.source.owner.id="wrong-owner","wrong source file":e=>e.source.path="Projects/Other/Source.md",
    "wrong offsets":e=>e.region.start++,"wrong BOM metadata":e=>e.raw.eol.bom=!e.raw.eol.bom,
    "wrong raw checksum":e=>e.raw.sha256="0".repeat(64),"wrong integrity checksum":e=>e.checksum="0".repeat(64),
    "new envelope version":e=>e.version=2,"missing envelope version":e=>delete e.version,"new parser version":e=>e.parserVersion=2,
    "unknown required field":e=>e.newRequired="unsupported","flattened parsed hierarchy":e=>e.parsed.steps=[]
};
for(const[name,change]of Object.entries(corruptions))test("D06 envelope rejects "+name,()=>{const e=core.captureSourceEnvelope(Buffer.from("- [ ] Task <!-- hub-task:old --> ^block\r\n    continuation  \n    - [ ] Child\n"),request(task));change(e);assert.throws(()=>core.validateEnvelope(e));});
for(const change of["title","indentation","Step move","note rename","note move","file replaced","line shift","ancestry","same-title replacement","deleted source"])test("D06 source conflict never overwrites original: "+change,()=>{
    const raw=Buffer.from("- [ ] Task\n    - [ ] Child\n"),e=core.captureSourceEnvelope(raw,request(task)),before=clone(e),source=clone(e.source);let bytes=raw;
    if(change==="title")bytes=Buffer.from(raw.toString().replace("Task","Renamed"));
    else if(change==="indentation")bytes=Buffer.from(raw.toString().replace("    -","  -"));
    else if(change==="Step move")bytes=Buffer.from("- [ ] Task\n- [ ] Another\n    - [ ] Child\n");
    else if(change==="note rename")source.path=source.root+"/Folder/Renamed.md";
    else if(change==="note move")source.path=source.root+"/Other/Source.md";
    else if(change==="file replaced")source.revision="r2";
    else if(change==="line shift")bytes=Buffer.from("\n"+raw.toString());
    else if(change==="ancestry")bytes=Buffer.from("- [ ] Task\n    - [ ] New ancestor\n        - [ ] Child\n");
    else if(change==="same-title replacement")bytes=Buffer.from("- [ ] Task\n    A replacement with the same title\n");
    else if(change==="deleted source")bytes=new Uint8Array();
    assert.throws(()=>core.verifySourceEnvelope(e,bytes,source),x=>x.code==="SOURCE_CONFLICT");assert.deepEqual(e,before);
});
test("D06 current legacy parser ranges and N1-A source observations remain the comparison boundary",()=>{
    const root=path.resolve(__dirname,"../.."),vectors=JSON.parse(fs.readFileSync(path.join(root,".obsidian/plugins/hub-project-menu/lib/tests/native-migration-compatibility-v1.json"),"utf8"));
    const{taskBlockEnd,readTaskSnapshot}=require(path.join(root,".obsidian/plugins/hub-project-menu/lib/domain/task-planning"));let count=0;
    for(const c of vectors.cases.filter(c=>c.category==="content"&&c.legacyInput.probe==="snapshot")){
        const source=c.legacyInput.source,lines=source.split(/\r?\n/),end=taskBlockEnd(lines,0),prefix=lines.slice(0,end).join(source.includes("\r\n")?"\r\n":"\n");
        const e=core.captureSourceEnvelope(Buffer.from(source),request(task));assert.equal(Buffer.from(core.originalBytes(e)).toString().replace(/\r\n/g,"\n").replace(/\n$/, ""),prefix.replace(/\r\n/g,"\n").replace(/\n$/, ""),c.caseId);
        const old=readTaskSnapshot(source,{path:"Projects/Synthetic/Task.md",line:0,text:c.legacyInput.title??"Parent",hubTaskId:c.legacyInput.id??null});assert.equal(e.parsed.steps.length,old.steps.length,c.caseId);count++;
    }assert(count>=10);
});
