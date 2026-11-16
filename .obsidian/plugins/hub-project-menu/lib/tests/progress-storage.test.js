"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const { HubDataStore } = require("../services/data-store");
async function run() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-report-storage-"));
    const directory = path.join(root, ".obsidian/plugins/test"), file = path.join(directory, "data.json");
    try {
        await fs.mkdir(directory, {recursive:true}); await fs.writeFile(file, JSON.stringify({ projectWorkRatings:{p:{"2026-01-01":1}}, music:{volume:1} }));
        const plugin = {app:{vault:{configDir:".obsidian",adapter:{getBasePath:()=>root}}},manifest:{id:"test",dir:directory},loadData:async()=>JSON.parse(await fs.readFile(file,"utf8"))};
        const store = new HubDataStore(plugin), initial=await store.load();
        const scoped = store.updateProgress(data=>{data.projectWorkRatings.p["2026-01-01"]=3;});
        const unrelated = store.save({...initial,music:{volume:2}});
        await Promise.all([scoped,unrelated]);
        let disk=JSON.parse(await fs.readFile(file,"utf8"));
        assert.equal(disk.projectWorkRatings.p["2026-01-01"],3);assert.equal(disk.music.volume,2);
        await store.save({...initial,music:{volume:4}});
        disk=JSON.parse(await fs.readFile(file,"utf8"));assert.equal(disk.projectWorkRatings.p["2026-01-01"],3,"Previously captured state cannot replay old progress after a commit");
        const before=JSON.stringify(disk), atomic=store.atomicWrite;
        store.atomicWrite=async()=>{throw Error("injected replacement failure")};
        await assert.rejects(store.updateProgress(data=>{data.projectWorkRatings.p["2026-01-01"]=0;data.resourceWorkRatings={study:{"2026-01-01":4}};}));
        assert.equal(await fs.readFile(file,"utf8"),JSON.stringify(disk,null,2)+"\n");
        store.atomicWrite=atomic;
        await store.updateProgress(data=>{data.projectWorkRatings.p["2026-01-01"]=0;data.resourceWorkRatings={study:{"2026-01-01":4}};});
        disk=JSON.parse(await fs.readFile(file,"utf8")); assert.equal(disk.projectWorkRatings.p["2026-01-01"],0);assert.equal(disk.resourceWorkRatings.study["2026-01-01"],4);
        const restarted=new HubDataStore(plugin);assert.equal((await restarted.load()).projectWorkRatings.p["2026-01-01"],0);
        console.log("PASS: scoped progress survives unrelated queued/stale saves, failed replacement is atomic, and zero survives restart");
    } finally {
        if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw Error("Unexpected test directory");
        await fs.rm(root,{recursive:true,force:true});
    }
}
run().catch(error=>{console.error(error);process.exitCode=1});
