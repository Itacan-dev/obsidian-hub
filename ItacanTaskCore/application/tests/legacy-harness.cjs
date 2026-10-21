"use strict";
// Reuse the established fixture seams and actual production methods, never onload.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../../.."),plugin=path.join(root,".obsidian/plugins/hub-project-menu");
const H=require(path.join(plugin,"lib/tests/task-service-fixture.cjs"));
const inboxFile=path.join(plugin,"lib/tests/inbox.test.js"),compiled=new Module(inboxFile,module);compiled.filename=inboxFile;compiled.paths=Module._nodeModulePaths(path.dirname(inboxFile));
const bytes=fs.readFileSync(inboxFile,"utf8"),end=bytes.indexOf("function source(");if(end<0)throw Error("Frozen Inbox seam changed");
compiled._compile(bytes.slice(0,end)+"\nmodule.exports={fixture};",inboxFile);
const {ProjectPlanningService}=require(path.join(plugin,"lib/services/project-planning"));
const observations=[];
function observe(name,initial,intent,result,after,extra={}) { const row={version:1,name,kind:"executed-production-methods",initial,intent,result,after,...extra};observations.push(row);if(process.env.ITACAN_N3B1_AUDIT){const dir=path.join(process.env.ITACAN_N3B1_AUDIT,"legacy-observations");fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name+".json"),JSON.stringify(row,null,2));}return row; }
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function calendar() {
    // Fresh actual modules with only Obsidian icon host methods supplied.
    const iconHost={getIcon:()=>({}),setIcon(){},addIcon(){}};
    function load(name,overrides){const filename=path.join(plugin,"lib",name+".js"),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));const ordinary=m.require.bind(m);m.require=id=>Object.hasOwn(overrides,id)?overrides[id]:ordinary(id);m._compile(fs.readFileSync(filename,"utf8"),filename);return m.exports;}
    const icons=load("ui/icons",{obsidian:iconHost}),primitives=load("ui/task-view-primitives",{obsidian:iconHost}),toolbar=load("ui/schedule-toolbar",{"./icons":icons,"./task-view-primitives":primitives});
    return load("ui/task-view-calendar",{"./schedule-toolbar":toolbar,"./task-view-primitives":primitives});
}
module.exports={calendar,...H,inboxFixture:compiled.exports.fixture,ProjectPlanningService,observe,observations,sha,root,plugin};
