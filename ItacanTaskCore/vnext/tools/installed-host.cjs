"use strict";
// Launch the genuine installed executable with an owned, isolated profile/vault.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {connect}=require('./cdp-client.cjs');
const label=process.argv[2];
if(!label||!/^[a-z0-9-]+$/.test(label))throw Error('New evidence label required');
const root=path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext',label);
if(fs.existsSync(root))throw Error('Evidence directory already exists');
const profile=path.join(root,'profile'),vault=path.join(root,'vault'),exe=path.join(process.env.LOCALAPPDATA,'Programs/obsidian/Obsidian.exe');
const stage=process.argv[3]?path.resolve(process.argv[3]):null,gitOnly=process.argv[4]==='--git-only';
fs.mkdirSync(path.join(vault,'.obsidian'),{recursive:true});fs.mkdirSync(profile);
const archiveDirectory=path.join(process.env.APPDATA,'obsidian'),archiveName=fs.readdirSync(archiveDirectory).filter(n=>/^obsidian-\d+\.\d+\.\d+\.asar$/.test(n)).sort((a,b)=>{const av=a.match(/\d+/g).map(Number),bv=b.match(/\d+/g).map(Number);return bv[0]-av[0]||bv[1]-av[1]||bv[2]-av[2]})[0];
if(!archiveName)throw Error('Installed updated Obsidian archive required');
fs.copyFileSync(path.join(archiveDirectory,archiveName),path.join(profile,archiveName));
fs.writeFileSync(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{vnextinstalledhost:{path:vault,ts:Date.now(),open:true}},cli:false,updateDisabled:true}));
fs.writeFileSync(path.join(profile,'vnextinstalledhost.json'),'{}');
fs.writeFileSync(path.join(vault,'.obsidian/app.json'),JSON.stringify({safeMode:true}));
fs.writeFileSync(path.join(vault,'Home.md'),'# Installed-host SQLite acceptance\n\nSynthetic vault; no Work tasks.\n');
if(stage){
 if(!stage.startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Owned stage required');
 const manifest=JSON.parse(fs.readFileSync(path.join(stage,'STAGE.json')));
 const target=path.join(vault,'.obsidian/plugins/hub-project-menu');fs.cpSync(manifest.output,target,{recursive:true});
 if(gitOnly){cp.execFileSync('git',['-C',vault,'init'],{windowsHide:true,stdio:'ignore'});fs.mkdirSync(path.join(vault,'System'),{recursive:true});fs.writeFileSync(path.join(vault,'System/Hub-shared-projects.json'),JSON.stringify({schemaVersion:1,categories:[],projectPlanning:{},headerImagePlacements:{},projects:{'82b767fe-682b-4184-8918-3a5c47b45a25':{root:'Projects/Itacan'}}}));}
 const helper=path.join(vault,'.obsidian/plugins/sqlite-acceptance');fs.mkdirSync(helper,{recursive:true});
 fs.writeFileSync(path.join(helper,'manifest.json'),JSON.stringify({id:'sqlite-acceptance',name:'Synthetic acceptance helper',version:'1.0.0',minAppVersion:'1.0.0',isDesktopOnly:true}));
 fs.writeFileSync(path.join(helper,'main.js'),'const api=require("obsidian");module.exports=class extends api.Plugin{onload(){window.__sqliteAcceptanceApi=api;}}');
 fs.writeFileSync(path.join(vault,'.obsidian/community-plugins.json'),JSON.stringify(['sqlite-acceptance','hub-project-menu']));fs.writeFileSync(path.join(vault,'.obsidian/app.json'),JSON.stringify({safeMode:false}));
 const fixtureRoot=gitOnly?'Projects/Itacan':'Projects/Fixture';fs.mkdirSync(path.join(vault,fixtureRoot,'Notes'),{recursive:true});fs.writeFileSync(path.join(vault,fixtureRoot,'Fixture.md'),'---\ntype: project\nprojectId: 82b767fe-682b-4184-8918-3a5c47b45a25\nstatus: active\ncategory: physics-research\n---\n# Fixture\n');fs.writeFileSync(path.join(vault,fixtureRoot,'Notes/Example.md'),'# Example\n');
 fs.cpSync(path.resolve(__dirname,'../../../System/Dashboards'),path.join(vault,'System/Dashboards'),{recursive:true});
 for(const rel of Object.keys(manifest.dashboardFiles??{}))fs.copyFileSync(path.join(manifest.source,rel),path.join(vault,rel));
 fs.writeFileSync(path.join(root,'stage.json'),JSON.stringify({stage,manifestHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,'STAGE.json'))).digest('hex')},null,2));
}
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const pins={exe:{file:exe,sha256:hash(exe)},bootstrap:{file:path.join(path.dirname(exe),'resources/app.asar')},archive:{file:path.join(profile,archiveName),installedSource:path.join(archiveDirectory,archiveName)}};
for(const k of ['bootstrap','archive'])pins[k].sha256=hash(pins[k].file);
fs.writeFileSync(path.join(root,'software.json'),JSON.stringify(pins,null,2));
const port=19281;
const child=cp.spawn(exe,['--user-data-dir='+profile,'--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port],{windowsHide:true,stdio:['ignore','pipe','pipe'],cwd:root});
let stdout='',stderr='',client,verified=false;
child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
fs.writeFileSync(path.join(root,'launch.json'),JSON.stringify({pid:child.pid,exe,profile,vault,port},null,2));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{
 for(let i=0;i<100;i++){try{client=await connect(port);break}catch{}await delay(200)}
 if(!client)throw Error('Installed executable did not expose an isolated Obsidian renderer');
 let identity;
 for(let i=0;i<150;i++){
  identity=await client.evaluate('({vault:window.app?.vault?.adapter?.basePath,plugins:!!window.app?.plugins,versions:process.versions,exe:process.execPath,remote:!!window.electron?.remote,profile:window.electron?.remote?.app.getPath("userData")})');
  if(identity.vault&&identity.remote&&identity.plugins)break;await delay(100);
 }
 fs.writeFileSync(path.join(root,'renderer.json'),JSON.stringify(identity,null,2));
 if(path.resolve(identity.vault??'')!==path.resolve(vault)||path.resolve(identity.profile??'')!==path.resolve(profile))throw Error('Refusing to run outside synthetic vault/profile');
 verified=true;
 if(stage){
  // Only the new synthetic vault is allowed to enable these authored test assets.
  await client.evaluate(`window.__sqliteConsole=[];for(const kind of ['error','warn']){const original=console[kind];console[kind]=(...args)=>{window.__sqliteConsole.push({kind,args:args.map(a=>a?.stack??String(a))});original.apply(console,args)}};true`);
  // Accept the authored synthetic vault's normal first-open trust prompt.
  for(let i=0;i<100;i++){
   const point=await client.evaluate(`(()=>{const b=[...document.querySelectorAll('.modal-container button')].find(b=>/^(Confiar en el autor|Trust author)/i.test(b.textContent.trim()));if(b&&!b.disabled){const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}}})()`);
   if(point){
    const position={x:Math.round(point.x),y:Math.round(point.y)};fs.writeFileSync(path.join(root,'trust-input.json'),JSON.stringify(position));
    await client.evaluate(`(()=>{const w=window.electron.remote.getCurrentWebContents(),p=${JSON.stringify(position)};w.sendInputEvent({type:'mouseMove',...p});w.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});w.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});return true})()`);await delay(500);break;
   }
   if(await client.evaluate(`!!app.plugins.plugins['hub-project-menu']`))break;await delay(100);
  }
  // The normal trust action starts the configured plugins. Do not race it with
  // a second enablePlugin call (which can duplicate application-state writers).
  for(let i=0;i<200;i++){
   if(await client.evaluate(`!!app.plugins.plugins['hub-project-menu']&&!!window.__sqliteAcceptanceApi`))break;
   await delay(100);
  }
  fs.writeFileSync(path.join(root,'plugin-startup.json'),JSON.stringify(await client.evaluate(`({loaded:Object.keys(app.plugins.plugins),manifests:Object.keys(app.plugins.manifests),console:window.__sqliteConsole})`),null,2));
  const fixture=path.resolve(__dirname,gitOnly?'../tests/git-ui.cjs':'../tests/production-ui.cjs');
  const result=await client.evaluate(`require(${JSON.stringify(fixture)})({app,api:window.__sqliteAcceptanceApi,plugin:app.plugins.plugins['hub-project-menu']},${JSON.stringify(root)})`);
  fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));
 }else{
  const entry=path.resolve(__dirname,'../tests/installed-probe.cjs');
  await client.evaluate(`window.electron.remote.require(${JSON.stringify(entry)}).run(${JSON.stringify(root)}); true`);
 }
 for(let i=0;i<200&&!fs.existsSync(path.join(root,'result.json'));i++)await delay(100);
 if(!fs.existsSync(path.join(root,'result.json')))throw Error('Installed utility probe did not finish');
 const result=JSON.parse(fs.readFileSync(path.join(root,'result.json')));console.log(JSON.stringify({root,...result},null,2));
 if(!result.pass)process.exitCode=1;
 }catch(e){fs.writeFileSync(path.join(root,'error.txt'),e.stack);console.error(e.stack);process.exitCode=1}
 finally{
  // The probe drains its only synthetic writer before writing result.json.
  if(client){if(verified){try{fs.writeFileSync(path.join(root,'renderer-console.json'),JSON.stringify(await client.evaluate('window.__sqliteConsole??[]'),null,2));const screenshot=await client.call('Page.captureScreenshot');fs.writeFileSync(path.join(root,'final.png'),Buffer.from(screenshot.data,'base64'));await client.evaluate('window.close(); true')}catch{}}client.close();}
  fs.writeFileSync(path.join(root,'process.json'),JSON.stringify({pid:child.pid,stdout,stderr},null,2));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
