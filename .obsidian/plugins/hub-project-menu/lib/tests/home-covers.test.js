"use strict";
const assert = require("assert");
const { HOME_COVER_PERIODS, HomeCovers } = require("../services/home-covers");
async function run() {
    const legacy = { x: 65, y: 27, zoom: 1.4 }, files = new Map(HOME_COVER_PERIODS.map(p => [p.cover, {}]));
    const data = { headerImagePlacements: { "home::Assets/Covers/night.jpeg": legacy } };
    let persisted, imports = [];
    const plugin = { projectWizard: { data, ensureFolder: async () => {} },
        dataStore: { save: async value => { persisted = JSON.stringify(value); } },
        app: { vault: { getAbstractFileByPath: path => files.get(path), createBinary: async (path, bytes) => { files.set(path, {}); imports.push({ path, bytes }); } } } };
    const service = new HomeCovers(plugin);
    assert.deepEqual(HOME_COVER_PERIODS.map(p => p.name), ["morning","afternoon","evening","night"]);
    assert.deepEqual(service.config("evening").placement, legacy);
    assert.deepEqual(service.config("night").placement, legacy);
    for (const [i,period] of HOME_COVER_PERIODS.entries()) {
        await service.placementOptions(period.name).save({ x: i*20, y: 10+i, zoom: 1+i*.2 });
    }
    assert.deepEqual(data.headerImagePlacements["home::Assets/Covers/night.jpeg"],legacy,"Legacy placements unchanged");
    plugin.projectWizard.data = JSON.parse(persisted);
    const reloaded = new HomeCovers(plugin);
    for (const [i,period] of HOME_COVER_PERIODS.entries()) assert.equal(reloaded.config(period.name).placement.x,i*20,"Independent period placements survive reload");
    const bytes = new Uint8Array([1,2,3]).buffer;
    await reloaded.changeImage("evening",{ name:"Sunset.jpg", arrayBuffer:async()=>bytes });
    assert(reloaded.config("evening").path.startsWith("Assets/Covers/Home/evening-"));
    assert.equal(imports[0].bytes, bytes,"Import preserves original image bytes");
    assert.equal(reloaded.config("evening").placement,null,"New image uses default cover crop");
    assert.equal(reloaded.config("night").path,"Assets/Covers/night.jpeg");
    assert.equal(reloaded.config("night").placement.x,60,"Evening does not affect Night");
    files.delete(reloaded.config("evening").path);
    assert.equal(reloaded.config("evening").path,"Assets/Covers/night.jpeg","Missing selection falls back to default");
    await assert.rejects(()=>reloaded.changeImage("night",{name:"bad.txt"}),/supported image/);
    console.log("Home cover persistence passed: ordered periods, independent per-period image/placement state, legacy fallback, reload, unchanged source bytes, image changes and missing-file fallback.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
