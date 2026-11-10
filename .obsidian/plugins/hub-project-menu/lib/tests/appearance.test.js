"use strict";
const assert=require("node:assert/strict"),fs=require("fs"),os=require("os"),path=require("path");
const {PALETTES,resolvePalette,validatePalette,contrast,DEFAULT_PREFERENCES}=require("../ui/color-palettes");
const {AppearanceService}=require("../services/appearance");
const {validateDockColors}=require("../domain/oath-dock-colors");
async function run(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"itacan-appearance-test-")), file=path.join(root,"appearance.json"), applied=[],errors=[];
 const colors={applyResolvedColors(c){applied.push(c);return applied.length;},attachColorDocument(){}};
 const make=(options={})=>new AppearanceService({file,colors,onError:e=>errors.push(e),...options});
 for(const p of PALETTES){validatePalette(p);for(const full of [false,true]){const c=resolvePalette({version:1,paletteId:p.id,coordinateInterfaceColors:full});assert(!Object.keys(c.tokens).some(k=>k.startsWith('--hub-progress')||k.includes('status-')));}}
 assert.deepEqual(resolvePalette(DEFAULT_PREFERENCES).tokens,{});
 assert.throws(()=>validatePalette({...PALETTES[1],accent:{}}));
 assert.throws(()=>validatePalette({...PALETTES[1],accent:{...PALETTES[1].accent,'--text-normal':'#ffffff'}}));
 assert.throws(()=>validateDockColors({version:1,revision:1,colors:{...PALETTES[1].dock,focus:'url(bad)'}}));
 let service=await make().initialize();assert(!fs.existsSync(file));assert.deepEqual(service.value,DEFAULT_PREFERENCES);
 const changes=['blue','green','amber','gray'].map(paletteId=>service.set({paletteId,coordinateInterfaceColors:true}));
 assert.equal(service.value.paletteId,'gray');assert((await Promise.all(changes)).every(Boolean));assert.equal(JSON.parse(fs.readFileSync(file)).paletteId,'gray');await service.destroy();
 service=await make().initialize();assert.equal(service.value.paletteId,'gray');await service.set({paletteId:'blue',coordinateInterfaceColors:false});await service.destroy();
 service=await make().initialize();assert.equal(service.value.coordinateInterfaceColors,false);
 await service.set(DEFAULT_PREFERENCES);assert.deepEqual(JSON.parse(fs.readFileSync(file)),DEFAULT_PREFERENCES);
 const before=fs.readFileSync(file,'utf8');fs.writeFileSync(file,JSON.stringify({...DEFAULT_PREFERENCES,paletteId:'amber'}));
 assert.equal(await service.set({paletteId:'green',coordinateInterfaceColors:true}),false);assert.equal(JSON.parse(fs.readFileSync(file)).paletteId,'amber');assert.equal(service.available,false);await service.destroy();
 service=await make().initialize();assert.equal(service.value.paletteId,'amber');fs.writeFileSync(file,JSON.stringify({...DEFAULT_PREFERENCES,paletteId:'blue'}));await service.refresh();assert.equal(service.value.paletteId,'blue');await service.destroy();
 fs.writeFileSync(file,JSON.stringify({...DEFAULT_PREFERENCES,paletteId:'obsolete'}));service=await make().initialize();assert.equal(service.value.paletteId,'default');assert.equal(JSON.parse(fs.readFileSync(file)).paletteId,'obsolete');await service.destroy();
 for(const raw of ['bad','null','[]',JSON.stringify({version:2,paletteId:'blue',coordinateInterfaceColors:true})]){fs.writeFileSync(file,raw);service=await make().initialize();assert.equal(service.available,false);assert.equal(await service.set(DEFAULT_PREFERENCES),false);assert.equal(fs.readFileSync(file,'utf8'),raw);await service.destroy();}
 fs.writeFileSync(file,before);
 const failing=Object.create(fs.promises);failing.rename=async()=>{throw Error('disk full')};service=await make({io:failing}).initialize();assert.equal(await service.set({paletteId:'green',coordinateInterfaceColors:true}),false);assert.equal(service.value.paletteId,'default');assert.equal(fs.readFileSync(file,'utf8'),before);assert(!fs.readdirSync(root).some(n=>n.endsWith('.tmp')));await service.destroy();
 const uncertain=Object.create(fs.promises);uncertain.rename=async(a,b)=>{await fs.promises.rename(a,b);throw Error('ack lost')};service=await make({io:uncertain}).initialize();assert.equal(await service.set({paletteId:'green',coordinateInterfaceColors:true}),true);assert.equal(service.value.paletteId,'green');await service.destroy();
 assert.deepEqual(fs.readdirSync(root),['appearance.json']);
 console.log('PASS palette completeness, contrast, semantic independence, dock validation, startup, rapid changes, reload, reset, external conflicts, unknown/corrupt/future records, failure rollback, uncertain publication and Appearance-only writes');
 console.log(PALETTES.slice(1).map(p=>({id:p.id,normal:contrast(p.accent['--hub-color-primary-action-background'],'#ffffff').toFixed(2),hover:contrast(p.accent['--hub-color-primary-action-background-hover'],'#ffffff').toFixed(2)})));
}
run().catch(e=>{console.error(e);process.exitCode=1});
