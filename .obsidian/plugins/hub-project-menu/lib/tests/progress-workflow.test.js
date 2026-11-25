"use strict";
const assert = require("node:assert/strict");
const { saveProgress, stored, ReportEligibility } = require("../services/progress-report");
const { recordedWorkSummary } = require("../domain/report-context");
const { localISODate } = require("../domain/dates");
const clone = o => JSON.parse(JSON.stringify(o));
const today = localISODate();
async function run() {
    let disk = {}, writes = 0, fail = false, duringSave = null;
    const wizard = { data: {}, projectWorkRatings: {}, projectWorkLogs: {}, resourceWorkRatings: {}, resourceWorkLogs: {},
        getProjectById: id => ["p", "q"].includes(id) ? { projectId:id,name:id } : null,
        getResourceById: id => ({resourceType:id,label:id}),
        taskProgressEvidence: () => ({availability:"current",records:[]}), activityLog: [], dailyFocus:{} };
    const store = { deviceId:"device", updateProgress: async mutate => {
        const next = clone(disk); await mutate(next); if (duringSave) { const f=duringSave; duringSave=null; f(); }
        if(fail)throw Error("disk failure"); disk=clone(next);writes++;return clone(disk);
    }};
    wizard.store = store;
    const storage = new Map(); global.localStorage = {getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
    const plugin = {projectWizard:wizard,dataStore:store,app:{vault:{adapter:{getBasePath:()=>"test-vault"}}}};
    let eligibility = new ReportEligibility(plugin);
    assert.deepEqual(eligibility.pending(today), [], "Startup alone creates no eligibility");
    eligibility.observe("p","navigation"); await eligibility.flush();
    assert.deepEqual(eligibility.pending(today), ["p"]);
    eligibility.observe("p","task","operation-1");
    const revision=eligibility.cutoff(today).p;
    eligibility.observe("p","task","operation-1");
    assert.equal(eligibility.cutoff(today).p,revision,"Local task retry is deduplicated");
    await eligibility.flush();
    const cutoff = eligibility.cutoff(today,["p"]);
    await saveProgress(wizard,{date:today,entries:[{id:"p",rating:0,summary:"Read a paper",expected:stored(disk,today,"p")}],cutoffs:cutoff});
    assert.equal(stored(disk,today,"p").rating,0); assert.equal(stored(disk,today,"p").log.summary,"Read a paper");
    assert.deepEqual(eligibility.pending(today), [], "Manual reporting suppresses the same observed work");
    eligibility = new ReportEligibility(plugin); assert.deepEqual(eligibility.pending(today), [], "Acknowledgement survives restart");
    eligibility.observe("p","content"); await eligibility.flush();
    assert.deepEqual(eligibility.pending(today), ["p"]);
    const timestamp=stored(disk,today,"p").log.timestamp;
    duringSave=()=>eligibility.observe("p","content");
    await saveProgress(wizard,{date:today,entries:[{id:"p",rating:2,expected:stored(disk,today,"p")}],cutoffs:eligibility.cutoff(today,["p"])});
    assert.equal(stored(disk,today,"p").log.summary,"Read a paper","Omitted reflection is preserved");
    assert.equal(stored(disk,today,"p").log.timestamp,timestamp);
    assert.deepEqual(eligibility.pending(today), ["p"], "Engagement during save remains pending");
    const before=clone(disk), beforeWrites=writes;
    await assert.rejects(saveProgress(wizard,{date:today,entries:[{id:"p",rating:4},{id:"resource:study",summary:"x".repeat(1001)}]}));
    assert.deepEqual(disk,before); assert.equal(writes,beforeWrites,"All validation precedes persistence");
    fail=true;
    await assert.rejects(saveProgress(wizard,{date:today,entries:[{id:"p",rating:4},{id:"resource:study",rating:3}],cutoffs:eligibility.cutoff(today)}));
    fail=false; assert.deepEqual(disk,before,"Mixed-workspace write failure commits nothing");
    await assert.rejects(saveProgress(wizard,{date:today,entries:[{id:"p",rating:4,expected:{rating:null,log:null}}]}),e=>e.code==="REPORT_CONFLICT");
    eligibility.observe("resource:study","navigation"); await eligibility.flush();
    await saveProgress(wizard,{date:today,entries:[{id:"p",rating:3}],cutoffs:eligibility.cutoff(today,["p"]),dismiss:eligibility.cutoff(today)});
    assert.deepEqual(eligibility.pending(today), [],"Save and close resolves untouched represented engagement");
    assert.equal(stored(disk,today,"resource:study").rating,null,"Dismissal creates no rating");
    eligibility.observe("p","content"); const skip=eligibility.cutoff(today); eligibility.dismiss(today,skip);
    clearTimeout(eligibility.timer);
    eligibility=new ReportEligibility(plugin);
    assert.deepEqual(eligibility.pending(today),[],"Synchronous dismissal receipt survives restart before async flush");
    eligibility.observe("p","content"); assert.deepEqual(eligibility.pending(today),["p"],"New revisions exceed recovered receipt");
    await eligibility.flush();
    const oldDate="2020-01-02";
    await saveProgress(wizard,{date:oldDate,entries:[{id:"q",rating:1}],cutoffs:{q:10}});
    assert.deepEqual(eligibility.pending(today),["p"],"Past report cannot acknowledge today's work");
    assert.equal(disk.pendingFocus,undefined,"Report saves leave standalone Focus intact");
    const snapshot=clone(stored(disk,oldDate,"q").log.context);
    wizard.activityLog=[{projectId:"q",action:"edited",title:"later",timestamp:Date.now()}];
    await saveProgress(wizard,{date:oldDate,entries:[{id:"q",summary:"revised"}]});
    assert.deepEqual(stored(disk,oldDate,"q").log.context,snapshot);
    const summary=recordedWorkSummary({tasksAvailability:"current",tasks:[{id:"t",kind:"task"},{id:"t",kind:"task"},{id:"s",kind:"step"}],activity:[{action:"edited",path:"a"},{action:"edited",path:"a"}],oaths:[]});
    assert.equal(summary,"1 task completed · 1 step completed · 1 file edited");
    assert.equal(recordedWorkSummary({tasks:[],activity:[]}),"No recorded activity");
    assert.match(recordedWorkSummary({tasksAvailability:"unavailable",tasks:[],activity:[]}),/unavailable/);
    for(const days of Object.values(disk.reportEngagementByDevice)) for(const rows of Object.values(days)) for(const row of Object.values(rows)) assert.ok(!row.events&&!row.paths&&!row.interactions,"No interaction histories");
    console.log("PASS: zero, explicit patches, atomic failures, stale reports, revision cutoffs, restart recovery, dismissal, dates, snapshots, evidence deduplication and minimal eligibility state");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
