"use strict";
const assert = require("node:assert/strict");
const { ReportEligibility, saveProgress } = require("../services/progress-report");
const { localISODate } = require("../domain/dates");
const clone = value => JSON.parse(JSON.stringify(value));
async function run() {
    const today = localISODate(), receipts = new Map(), services = [];
    const previousStorage = global.localStorage;
    global.localStorage = { getItem:key=>receipts.get(key), setItem:(key,value)=>receipts.set(key,value) };
    let disk = { reportEngagementByDevice:{device:{[today]:{
        itacan:{observedRevision:5}, p:{observedRevision:10,reportedThrough:8}, "resource:study":{observedRevision:4,dismissedThrough:4}
    }}}, projectWorkRatings:{p:{[today]:2},itacan:{[today]:3}}, projectWorkLogs:{p:{[today]:{summary:"Preserve today's reflection",timestamp:1}}} };
    let duringSave = null;
    const store = { deviceId:"device", async updateProgress(mutate) {
        const next=clone(disk);await mutate(next);
        if(duringSave){const fn=duringSave;duringSave=null;fn();}
        disk=clone(next);return next;
    }};
    function start() {
        const wizard = {data:clone(disk),store,activityLog:[],dailyFocus:{},taskProgressEvidence:()=>({availability:"current",records:[]}),getProjectById:id=>["p","itacan"].includes(id)?{projectId:id,name:id}:null,getResourceById:id=>id==="study"?{resourceType:id,label:id}:null};
        const plugin = {projectWizard:wizard,dataStore:store,app:{vault:{adapter:{getBasePath:()=>"session-test"}}}};
        const eligibility = new ReportEligibility(plugin);services.push(eligibility);return {wizard,plugin,eligibility};
    }
    const closing = eligibility => eligibility.pending(today,{currentSession:true});
    try {
        let {wizard,plugin,eligibility}=start();
        assert.deepEqual(closing(eligibility),[],"Prior-session unresolved engagement does not trigger closing");
        assert.deepEqual(eligibility.pending(today),["itacan","p"],"Manual daily suggestions retain prior unresolved engagement");
        const before=clone(disk);
        eligibility.observe("p","navigation");await eligibility.flush();
        assert.deepEqual(closing(eligibility),["p"],"Only the newly engaged workspace is eligible");
        assert.deepEqual(disk.projectWorkRatings,before.projectWorkRatings);assert.deepEqual(disk.projectWorkLogs,before.projectWorkLogs);
        const reconstructed=new ReportEligibility(plugin);services.push(reconstructed);
        assert.deepEqual(closing(reconstructed),["p"],"Reconstructing the service inside the running app does not reset its session");
        eligibility.destroy();reconstructed.destroy();
        ({wizard,plugin,eligibility}=start());
        assert.deepEqual(closing(eligibility),[],"Restart begins a fresh baseline even if the last session was never reported");
        eligibility.observe("resource:study","content");await eligibility.flush();
        assert.deepEqual(closing(eligibility),["resource:study"]);
        await saveProgress(wizard,{date:today,entries:[{id:"resource:study",rating:2}],cutoffs:eligibility.cutoff(today,["resource:study"])});
        assert.deepEqual(closing(eligibility),[],"Manual reporting acknowledges current-session engagement");
        eligibility.observe("p","content");await eligibility.flush();
        const cutoff=eligibility.cutoff(today,["p"]);
        duringSave=()=>eligibility.observe("p","content");
        await saveProgress(wizard,{date:today,entries:[{id:"p",rating:3}],cutoffs:cutoff});
        assert.deepEqual(closing(eligibility),["p"],"New engagement during saving remains eligible");
        assert.equal(wizard.data.projectWorkLogs.p[today].summary,"Preserve today's reflection");
        eligibility.dismiss(today,eligibility.cutoff(today,closing(eligibility)));
        assert.deepEqual(closing(eligibility),[],"Dismissal suppresses current-session work");
        eligibility.destroy();
        ({wizard,plugin,eligibility}=start());
        assert.deepEqual(closing(eligibility),[],"Restart and recovered dismissal do not reintroduce old work");
        eligibility.observe("p","content");await eligibility.flush();
        assert.deepEqual(closing(eligibility),["p"],"New work exceeds both recovered dismissal and startup baseline");
        eligibility.observe("resource:study","task","operation-new");
        assert.deepEqual(closing(eligibility),["p","resource:study"],"Multiple newly engaged workspaces remain eligible");
        // Calendar rollover remains independent of session startup and prior-day counters.
        const NativeDate=global.Date, time=new NativeDate();
        let now=new NativeDate(time.getFullYear(),time.getMonth(),time.getDate(),23,59).getTime();
        try {
            global.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
            now+=120000;const tomorrow=localISODate();
            eligibility.observe("p","content");
            assert.deepEqual(eligibility.pending(tomorrow,{currentSession:true}),["p"],"Engagement after midnight belongs to the new date in the same session");
            assert.deepEqual(closing(eligibility),["p","resource:study"],"New-day engagement does not rewrite the prior day's eligibility");
        } finally { global.Date=NativeDate; }
        console.log("PASS: startup/restart session baselines, same-session service reload, manual daily suggestions, acknowledgement/dismissal recovery, new work during save, Project/Resource identities and midnight");
    } finally { for(const service of services)service.destroy();global.localStorage=previousStorage; }
}
run().catch(error=>{console.error(error);process.exitCode=1});
