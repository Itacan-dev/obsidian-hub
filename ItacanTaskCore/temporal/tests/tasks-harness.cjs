"use strict";
// Test-only actual installed logic in VM. No plugin constructor/onload, vault,
// process, filesystem, network, real settings, timers or DOM enter either VM.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../../.."),plugin=path.join(root,".obsidian/plugins/obsidian-tasks-plugin");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const EXPECTED="2b4f9ce24d26f1d0cb191dca9a73477454d256e03e51d81f37faeee7a293ad1b";
const momentPath=process.env.ITACAN_TEST_MOMENT_PATH||"C:/Users/El_Baraka 2025/AppData/Local/Programs/Obsidian/resources/obsidian.asar/lib/moment.min.js";
const bundle=fs.readFileSync(path.join(plugin,"main.js")),manifest=JSON.parse(fs.readFileSync(path.join(plugin,"manifest.json"),"utf8"));
if(sha(bundle)!==EXPECTED||manifest.version!=="8.4.0")throw Error("Unreviewed Tasks version/hash; preserve old evidence, do not recapture automatically.");
const momentBytes=fs.readFileSync(momentPath);
const settingsKeys=["taskFormat","globalFilter","setCreatedDate","setDoneDate","setCancelledDate","recurrenceOnNextLine","removeScheduledDateOnRecurrence","useFilenameAsScheduledDate","filenameAsScheduledDateFormat","filenameAsDateFolders"];
function createHarness({now=1792224000000,settings={},statuses=[]}={}){
    for(const key of Object.keys(settings))if(!settingsKeys.includes(key))throw Error("Unreviewed synthetic setting: "+key);
    class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
    const quiet={log(){},warn(){},error(){},debug(){}};
    const momentContext=vm.createContext({module:{exports:{}},exports:{},console:quiet,Date:FixedDate});
    vm.runInContext(momentBytes.toString("utf8"),momentContext,{filename:"installed-moment.min.js",timeout:5000});
    const moment=momentContext.module.exports;moment.now=()=>now;
    const imported=new Set();let hostConstructions=0;
    class HostUnavailable{constructor(){hostConstructions++;throw Error("Obsidian host construction forbidden");}}
    const obsidian=new Proxy({getLanguage:()=>"en",moment,Platform:{isDesktopApp:false,isMobile:false}}, {get(o,k){if(k in o)return o[k];imported.add(String(k));return HostUnavailable;}});
    const noView=new Proxy({WidgetType:HostUnavailable},{get(o,k){if(k in o)return o[k];throw Error("CodeMirror execution forbidden: "+String(k));}});
    const context=vm.createContext({module:{exports:{}},exports:{},window:{moment,navigator:{userAgent:"Synthetic Gate A"}},console:quiet,Date:FixedDate,
        require(name){if(name==="obsidian")return obsidian;if(name==="@codemirror/view")return noView;throw Error("Forbidden VM import: "+name);},
        setTimeout(){throw Error("VM timer forbidden");},clearTimeout(){},URL,URLSearchParams,TextEncoder,TextDecoder,AbortController});
    // Append accessors only. Installed parsing/recurrence/status/serialization
    // bodies are not replaced, copied, instrumented or reimplemented.
    vm.runInContext(bundle.toString("utf8")+"\n;globalThis.gateA={Cb,ye,Jt,ut,X,it,at,Ce,Tt,Re};",context,{filename:"installed-tasks-8.4.0.js",timeout:10000});
    context.syntheticSettings=JSON.parse(JSON.stringify(settings));context.syntheticStatuses=JSON.parse(JSON.stringify(statuses));
    vm.runInContext("vt();Gr();gateA.it(syntheticSettings);gateA.Re.getInstance().set(gateA.X().globalFilter);gateA.Re.getInstance().setRemoveGlobalFilter(false);for(const s of syntheticStatuses)gateA.at.getInstance().add(new gateA.Tt(s.symbol,s.name,s.nextStatusSymbol,true,s.type));",context,{timeout:5000});
    const configured=JSON.parse(vm.runInContext("JSON.stringify(Object.fromEntries("+JSON.stringify(settingsKeys)+".map(k=>[k,gateA.X()[k]])))",context));
    function run(line,sourcePath="Projects/Synthetic/Tasks.md"){
        context.syntheticLine=line;context.syntheticPath=sourcePath;
        return JSON.parse(vm.runInContext(String.raw`JSON.stringify((()=>{
            const summary=t=>t?{status:t.status.symbol,statusType:t.status.type,description:t.description,tasksId:t.id,blockLink:t.blockLink,dependsOn:t.dependsOn,
                rule:t.recurrence?t.recurrence.toText():null,start:t.startDate?.format('YYYY-MM-DD')??null,scheduled:t.scheduledDate?.format('YYYY-MM-DD')??null,
                due:t.dueDate?.format('YYYY-MM-DD')??null,done:t.doneDate?.format('YYYY-MM-DD')??null,created:t.createdDate?.format('YYYY-MM-DD')??null}:null;
            const parse=line=>gateA.ye.fromLine({line,taskLocation:gateA.Jt.fromUnknownPosition(new gateA.ut(syntheticPath)),fallbackDate:null});
            const before=summary(parse(syntheticLine)),output=gateA.Cb(syntheticLine,syntheticPath);
            return {before,output,after:output.text===''?[]:output.text.split('\n').map(line=>({line,parsed:summary(parse(line))}))};
        })())`,context,{timeout:5000}));
    }
    function witness(line){const observed=run(line),p=observed.before,marker=/🔁|[\[(]\s*repeat\s*::/iu.test(line);return{version:1,engineVersion:manifest.version,bundleSha256:sha(bundle),inputLine:line,syntax:configured.taskFormat,settings:configured,status:p?.rule?"recognized":!p?"ineligible":marker?"unsupported":"none",rule:p?.rule??null};}
    return{run,witness,settings:configured,statuses:JSON.parse(JSON.stringify(statuses)),provenance:{tasksVersion:manifest.version,bundleSha256:sha(bundle),momentVersion:moment.version,momentSha256:sha(momentBytes),momentOrigin:"installed Obsidian obsidian.asar/lib/moment.min.js",clock:now,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,entry:"Cb -> ye.fromLine -> toggleWithRecurrenceInUsersOrder -> toFileLineString",instrumentation:"appended accessors only; algorithm unchanged",settingsSource:"synthetic only; installed Tasks data.json never loaded"},isolation(){return{hostConstructions,imported:[...imported].sort(),pluginConstructed:false,onload:false,realSettingsRead:false,liveVault:false};}};
}
module.exports={createHarness};
