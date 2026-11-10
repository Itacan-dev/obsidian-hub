"use strict";
// Native styles are read from the installed archive, never copied into source.
const fs=require("fs"),path=require("path"),os=require("os"),{spawnSync}=require("child_process"),{pathToFileURL}=require("url");
const directory=path.join(process.env.APPDATA||"", "obsidian");
const archive=process.env.ITACAN_OBSIDIAN_ARCHIVE||path.join(directory,fs.readdirSync(directory).filter(x=>/^obsidian-[0-9.]+\.asar$/.test(x)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0]||"");
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,"color-native-baseline.json"),"utf8"));
if(!path.basename(archive).includes(baseline.obsidian))throw Error("Review the Default baseline for this Obsidian version before changing its golden values");
const fd=fs.openSync(archive,"r"),header=Buffer.alloc(16);fs.readSync(fd,header,0,16,0);const size=header.readUInt32LE(12),bytes=Buffer.alloc(size);fs.readSync(fd,bytes,0,size,16);const entry=JSON.parse(bytes.toString()).files["app.css"],css=Buffer.alloc(entry.size);fs.readSync(fd,css,0,css.length,8+header.readUInt32LE(4)+Number(entry.offset));fs.closeSync(fd);
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"hub-color-browser-"));fs.writeFileSync(path.join(scratch,"app.css"),css);
const heatmap=process.env.ITACAN_HEATMAP_STYLES||path.resolve(__dirname,"../../../heatmap-calendar/styles.css");fs.copyFileSync(heatmap,path.join(scratch,"heatmap.css"));
const fixture=process.argv[2]||"color-system";if(!["color-system","color-consistency","color-stage-two","color-palettes","color-appearance","color-backgrounds"].includes(fixture))throw Error("Unknown color fixture");
const result=spawnSync(process.execPath,[path.join(__dirname,"run-browser-test.js"),fixture,"1200x1000"],{env:{...process.env,HUB_TEST_PREVIEW:pathToFileURL(scratch+path.sep).href+(process.argv.includes("--capture")?"#capture":"")},windowsHide:true,stdio:"inherit"});
console.log("Color reference:",scratch);process.exitCode=result.status??1;
