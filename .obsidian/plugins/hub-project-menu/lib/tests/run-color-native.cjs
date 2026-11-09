"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),{spawn}=require("child_process");
const plugin=path.resolve(__dirname,"../.."),scratch=fs.mkdtempSync(path.join(os.tmpdir(),"hub-color-native-")),vault=path.join(scratch,"vault"),profile=path.join(scratch,"profile"),copy=path.join(vault,".obsidian/plugins/hub-project-menu");
fs.mkdirSync(copy,{recursive:true});fs.mkdirSync(profile);fs.writeFileSync(path.join(copy,"main.js"),'const {Plugin}=require("obsidian");module.exports=class extends Plugin{onload(){window.__colorApi=require("obsidian")}};');
for(const file of ["manifest.json","styles.css"])fs.copyFileSync(path.join(plugin,file),path.join(copy,file));
for(const [file,data]of [["vault/.obsidian/community-plugins.json",["hub-project-menu"]],["vault/.obsidian/app.json",{safeMode:false}],["vault/.obsidian/appearance.json",{theme:"obsidian",cssTheme:"",nativeMenus:false}],["profile/obsidian.json",{vaults:{colors:{path:vault,ts:1,open:true}},cli:false,updateDisabled:true}]])fs.writeFileSync(path.join(scratch,file),JSON.stringify(data));
fs.writeFileSync(path.join(vault,"Home.md"),"# Synthetic color verification\n");
const archiveDir=path.join(process.env.APPDATA,"obsidian"),archive=process.env.ITACAN_OBSIDIAN_ARCHIVE||path.join(archiveDir,fs.readdirSync(archiveDir).filter(x=>/^obsidian-[0-9.]+\.asar$/.test(x)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0]);
// These are existing third-party test tools, not product integration code.
const nativeTools=process.env.ITACAN_NATIVE_TEST_TOOLS||path.join(plugin,"lib/atlas/tests/native/node_modules");
const binary=process.env.ITACAN_TEST_ELECTRON||path.join(nativeTools,"electron/dist/electron.exe"),remote=process.env.ITACAN_TEST_REMOTE||path.join(nativeTools,"@electron/remote");
if(!fs.existsSync(binary)||!fs.existsSync(remote))throw Error("Provide existing ITACAN_TEST_ELECTRON and ITACAN_TEST_REMOTE test tools");
const env={...process.env,ITACAN_COLOR_NATIVE_ROOT:scratch,ITACAN_COLOR_PLUGIN_ROOT:plugin,ITACAN_OBSIDIAN_ARCHIVE:archive,ITACAN_TEST_REMOTE:remote};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(binary,[path.join(__dirname,"color-obsidian-host.cjs")],{env,windowsHide:true,stdio:["ignore","pipe","pipe"]});child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);child.on("exit",code=>{console.log("Native color evidence:",scratch);process.exitCode=code??1});
