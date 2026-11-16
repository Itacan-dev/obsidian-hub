"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { localISODate } = require("../domain/dates");
const { saveProgress } = require("../services/progress-report");
const { reportDay } = require("../domain/report-context");
const filename = path.resolve(__dirname,"../../plugin.js"), compiled = new Module(filename,module), load = Module._load;
compiled.filename=filename;compiled.paths=Module._nodeModulePaths(path.dirname(filename));
Module._load=function(name){return name==="obsidian"?{Plugin:class{},Modal:class{},FuzzySuggestModal:class{},TFile:class{},TFolder:class{}}:load.apply(this,arguments)};
try { compiled._compile(fs.readFileSync(filename,"utf8")+"\nmodule.exports.Wizard=ProjectWizardService;",filename); }
finally { Module._load=load; }
const clone = value => JSON.parse(JSON.stringify(value));
function historyItems(file,name,bodyName,reportsName,reports) {
    const source=fs.readFileSync(path.resolve(__dirname,"../../../../../System/Dashboards",file,"view.js"),"utf8").replace(/\r\n/g,"\n");
    const start=source.indexOf(`function ${name}(`),end=source.indexOf("\nfunction ",start+1);
    assert(start>=0&&end>start,"Locate actual History renderer");
    let visible=[],empty=false;
    new Function("historyPager",bodyName,reportsName,"el",source.slice(start,end)+`;${name}();`)(
        {reset(){},render(items){visible=items}}, {empty(){}},reports,()=>{empty=true});
    return {visible,empty};
}
async function run() {
    const date=localISODate(),past="2020-01-02";
    let disk={},wizard;
    const projects=[{projectId:"p",name:"Project",status:"active"},{projectId:"positive",name:"Positive",status:"active"}];
    const resources=[{projectId:"resource:study",resourceType:"study",label:"Study",contextKind:"resource"}];
    const options={getProjectRecords:()=>projects,getProjectById:id=>projects.find(p=>p.projectId===id),getResourceTypes:()=>resources,getResourceById:()=>resources[0],taskProgressEvidence:()=>({availability:"current",records:[]}),activityLog:[],dailyFocus:{}};
    const reopen=()=>{wizard=Object.assign(Object.create(compiled.exports.Wizard.prototype),options,{data:clone(disk),projectWorkRatings:clone(disk.projectWorkRatings??{}),projectWorkLogs:clone(disk.projectWorkLogs??{}),resourceWorkRatings:clone(disk.resourceWorkRatings??{}),resourceWorkLogs:clone(disk.resourceWorkLogs??{}),store:{deviceId:"test",async updateProgress(mutate){const next=clone(disk);await mutate(next);disk=clone(next);return next}}});};
    reopen();
    await saveProgress(wizard,{date,entries:[{id:"positive",rating:3,summary:"Keep positive"},{id:"p",rating:2,summary:"Keep original"},{id:"resource:study",rating:4,summary:"Resource original"}]});
    const positiveBefore=clone(disk.projectWorkLogs.positive),momentumWithPositive=wizard.getHomeMomentumProgress("all");
    await saveProgress(wizard,{date,entries:[{id:"p",rating:0,summary:"Newly written Project draft"},{id:"resource:study",rating:0,summary:"Newly written Resource draft"}]});
    reopen();
    let reports=wizard.getProgressReports({kind:"all"});
    for(const [id,text]of [["p","Newly written Project draft"],["resource:study","Newly written Resource draft"]]) {
        const report=reports.find(r=>r.projectId===id);assert.equal(report.score,0);assert.equal(report.summary,text);
        assert.equal(reportDay(wizard,date,id).reports[0].score,0,"Explicit zero remains inspectable/editable through the unfiltered report API");
    }
    assert.deepEqual(disk.projectWorkLogs.positive,positiveBefore,"Existing positive reports are unchanged");
    const positiveOnly=Object.assign(Object.create(compiled.exports.Wizard.prototype),options,{projectWorkRatings:{positive:{[date]:3}},resourceWorkRatings:{}});
    assert.deepEqual(wizard.getHomeMomentumProgress("all"),positiveOnly.getHomeMomentumProgress("all"),"Zero contributes no Momentum");
    assert.ok(momentumWithPositive.ratings[date]>=wizard.getHomeMomentumProgress("all").ratings[date]);
    const fixtures=[...reports,...[1,2,3,4].map(score=>({projectId:"score-"+score,score})),{projectId:"comment-only",score:null,summary:"Unrated"}];
    const before=JSON.stringify(fixtures);
    for(const args of [["Home","renderRecentReports","recentBody","progressReports"],["Project","renderProjectReports","activityBody","projectReports"]]) {
        const result=historyItems(...args,fixtures);
        assert.deepEqual(result.visible.map(r=>r.score),[3,1,2,3,4]);
        assert.equal(historyItems(...args,reports.filter(r=>r.score===0)).empty,true,"Zero-only History uses the existing empty state");
        assert.equal(JSON.stringify(fixtures),before,"History filtering cannot modify stored records");
    }
    // Rating-only historical edits preserve reflections, and explicit clearing remains possible.
    await saveProgress(wizard,{date:past,entries:[{id:"p",rating:0,summary:"Historical reflection"},{id:"resource:study",rating:0,summary:"Historical Resource reflection"}]});
    await saveProgress(wizard,{date:past,entries:[{id:"p",rating:1},{id:"resource:study",rating:2}]});reopen();
    assert.equal(wizard.getProgressReports("p").find(r=>r.date===past).summary,"Historical reflection");
    assert.equal(wizard.getProgressReports("resource:study").find(r=>r.date===past).summary,"Historical Resource reflection");
    await saveProgress(wizard,{date:past,entries:[{id:"p",summary:""}]});
    assert.equal(disk.projectWorkLogs.p[past].summary,"");
    console.log("PASS: Project/Resource zero reflection persistence and reopen, historical editing, explicit clearing, actual Home/workspace History filtering, raw zero inspection and unchanged positive reports/Momentum");
}
run().catch(error=>{console.error(error);process.exitCode=1});
