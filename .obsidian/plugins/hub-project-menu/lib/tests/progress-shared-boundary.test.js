"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const { HubDataStore } = require("../services/data-store");
const { saveProgress, stored } = require("../services/progress-report");
const { localISODate } = require("../domain/dates");
async function run() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-report-shared-"));
    const directory = path.join(root, ".obsidian/plugins/test"), file = path.join(directory, "data.json"), sharedFile = path.join(root, "System/Hub-shared-projects.json");
    const date = localISODate(), past = "2020-01-02";
    try {
        await fs.mkdir(directory, { recursive:true }); await fs.mkdir(path.join(root, "System")); await fs.mkdir(path.join(root, "Projects/Itacan"), { recursive:true });
        await fs.writeFile(path.join(root, "Projects/Itacan/Itacan.md"), "---\nprojectId: shared-project\ncategory: custom-application\n---\n");
        const category = { id:"custom-application", name:"Application", custom:true };
        await fs.writeFile(sharedFile, JSON.stringify({ schemaVersion:1, projects:{ "shared-project":{root:"Projects/Itacan",categoryId:category.id} }, categories:[category], projectPlanning:{}, headerImagePlacements:{} }, null, 2));
        const focus = { sourceDate:past, items:[{ projectId:"legacy-unavailable", text:"Retain the archived intention", projectName:"Legacy workspace" }] };
        const initial = { hubState:{ schemaVersion:1, revision:1, updatedAt:new Date().toISOString(), deviceId:"test" }, categories:[], pendingFocus:focus,
            reportFocusByDate:{ [past]:{items:focus.items} }, projectWorkRatings:{ "shared-project":{ [past]:4 } }, projectWorkLogs:{ "shared-project":{ [past]:{ summary:"Historical reflection",timestamp:1,context:{version:1,tasks:[],activity:[],focus:[],tasksAvailability:"current"} } } } };
        await fs.writeFile(file, JSON.stringify(initial));
        const plugin = { app:{vault:{configDir:".obsidian",adapter:{getBasePath:()=>root}}},manifest:{id:"test",dir:directory},loadData:async()=>JSON.parse(await fs.readFile(file,"utf8")) };
        const store = new HubDataStore(plugin), loaded = await store.load(), sharedBefore = await fs.readFile(sharedFile,"utf8");
        assert.ok(loaded.categories.some(c=>c.id===category.id));
        assert.deepEqual(JSON.parse(await fs.readFile(file,"utf8")).categories, [], "Shared category is deliberately absent from private storage");
        const projects=[{projectId:"shared-project",name:"Itacan",categoryId:category.id},{projectId:"other-project",name:"Other",categoryId:"unrelated-missing-category"}];
        const wizard={store,data:loaded,...loaded,activityLog:[],dailyFocus:{},getProjectById:id=>projects.find(w=>w.projectId===id),getResourceById:id=>id==="study"?{resourceType:id,label:"Study"}:null,taskProgressEvidence:()=>({availability:"current",records:[]})};
        // Exact original failure: the local atomic-save candidate was re-exported as if it contained shared categories.
        await assert.rejects(store.sharedProjects.prepare(JSON.parse(await fs.readFile(file,"utf8"))), /Shared Project category custom-application is missing\./);
        for (const [id,rating] of [["shared-project",2],["other-project",1],["resource:study",0]]) {
            await saveProgress(wizard,{date,entries:[{id,rating,summary:"Reflection for "+id,expected:stored(wizard.data,date,id)}]});
        }
        let disk=JSON.parse(await fs.readFile(file,"utf8"));
        assert.equal(disk.projectWorkRatings["shared-project"][date],2); assert.equal(disk.projectWorkRatings["other-project"][date],1); assert.equal(disk.resourceWorkRatings.study[date],0);
        assert.deepEqual(disk.pendingFocus,focus); assert.deepEqual(disk.reportFocusByDate,initial.reportFocusByDate);
        assert.deepEqual(disk.projectWorkLogs["shared-project"][past],initial.projectWorkLogs["shared-project"][past]);
        assert.deepEqual(disk.categories,[]); assert.equal(await fs.readFile(sharedFile,"utf8"),sharedBefore,"Report saving must not export or reorganize shared categories");
        assert.deepEqual(wizard.data.categories,[category],"Merged in-memory category identity remains available");
        const before=await fs.readFile(file,"utf8"), write=store.atomicWrite;
        store.atomicWrite=async()=>{throw Error("Injected atomic write failure")};
        await assert.rejects(saveProgress(wizard,{date,entries:[{id:"shared-project",rating:4},{id:"resource:study",rating:3}],cutoffs:{"shared-project":2}}),/Injected atomic write failure/);
        store.atomicWrite=write;
        assert.equal(await fs.readFile(file,"utf8"),before); assert.equal(stored(wizard.data,date,"shared-project").rating,2);
        await assert.rejects(store.updateProgress(data=>{data.categories=[{id:"unexpected"}]}),/outside progress/);
        assert.equal(await fs.readFile(file,"utf8"),before);
        // Ordinary shared-state export retains its validation and category ownership boundary.
        const next={...wizard.data, categories:[category]}; const prepared=await store.sharedProjects.prepare(next);
        assert.deepEqual(prepared.shared.categories,[category]);assert.deepEqual(prepared.local.categories,[]);
        console.log("PASS: exact missing shared-category reproduction; shared/unrelated Project and Resource saves; Focus isolation; unchanged categories, identities and history; atomic failure and scoped-write guard");
    } finally {
        if (!path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)) throw Error("Unexpected test directory");
        await fs.rm(root,{recursive:true,force:true});
    }
}
run().catch(error=>{console.error(error);process.exitCode=1});
