"use strict";
const {test}=require("node:test"),S=require("./support.cjs");
// Execute all thirteen original probes unchanged with the original HubDataStore.
const Module=require("node:module"),original=Module._load;
Module._load=function(request,parent,isMain){const resolved=Module._resolveFilename(request,parent,isMain);if(resolved===S.path.join(S.services,"data-store.js"))return S.frozen();return original.apply(this,arguments);};
require(S.path.resolve(__dirname,"../../../../../../ItacanTaskCore/coordination/tests/application-save.test.cjs"));
Module._load=original;
test("frozen graph preserves actual original bytes and source origins",()=>{const g=require("./source-graph-v1.json");for(const r of g.files)S.assert.equal(S.crypto.createHash("sha256").update(r.bytes).digest("hex"),r.sha256);const v=require("./decision-vectors-v1.json");S.assert.equal(v.sourceGraphDigest,S.crypto.createHash("sha256").update(S.sync.readFileSync(S.path.join(__dirname,"source-graph-v1.json"))).digest("hex"));S.assert.equal(v.interruptionStages.length,7);});
