"use strict";
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), os = require("os");
const Core = require("../../core/index"), { initialApplication } = require("../../obsidian/application");
const { createPresentation } = require("../../obsidian/presentation");
const { mountAtlasSettings } = require("../../obsidian/settings-ui"), { mountAtlasHome } = require("../../obsidian/home-ui");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const control = (parent, label) => [...parent.querySelectorAll("button")].find(b => b.textContent === label);
function luminance(color) { const values = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { const c = v/255; return c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4; }); return .2126*values[0]+.7152*values[1]+.0722*values[2]; }
function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
module.exports = async function qualityRenderer() {
    const win = window.electron.remote.getCurrentWindow(), size = win.getContentSize(), zoom = win.webContents.getZoomFactor(), dark = document.body.classList.contains("theme-dark"), light = document.body.classList.contains("theme-light");
    const root = document.createElement("main"); document.body.append(root); let disposeSettings = () => {}, disposeHome = () => {};
    const ratios = []; win.webContents.debugger.attach("1.3"); await win.webContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
    try {
        win.webContents.setZoomFactor(1); win.setContentSize(1300,940); await delay(30);
        for (const appearance of ["light","dark"]) {
            document.body.classList.toggle("theme-dark",appearance==="dark");document.body.classList.toggle("theme-light",appearance==="light");
            root.replaceChildren();root.style.cssText="position:fixed;inset:0;z-index:200;display:grid;grid-template-columns:420px 420px;gap:20px;align-content:start;overflow:auto";
            const settings=document.createElement("section"),home=document.createElement("main"),note=document.createElement("textarea");settings.className="hub-settings-panel";home.className="hub-atlas-home";settings.style.cssText="height:500px;width:420px";home.style.cssText="height:500px;width:420px";root.append(settings,home,note);
            const configuration={accessTiming:{waitMs:10000,confirmationWindowMs:60000,grantDurationMs:60000},vaultTiming:{waitMs:30000,confirmationWindowMs:60000},journeyLimits:{lifetimeMs:300000,maxHops:12}};
            const policy={whitelist:["trusted.test","other.test"],blacklist:["blocked.test"]},snapshot=Core.validateAtlasSnapshot({policy,policyRevision:0,configuration,configurationRevision:0,accessState:Core.createAccessState(),vaultState:Core.createVaultState(),journeyState:Core.createJourneyState()}).snapshot;
            const application=initialApplication(policy),describe=createPresentation(),listeners=new Set();
            application.destinations[0].label="A long destination label that remains readable";application.destinations[0].aliases=["a-very-long-but-valid-hostname.for-a-readable-review.example.test"];
            const state={status:"READY",enabled:true,snapshot,application,contexts:[],storageVersion:"isolated",starter:{policy},temporaryDestinations:[]};
            let subscribed=0,unsubscribed=0;
            const bridge={view:()=>({...state,...describe(state,application,true,Date.now(),undefined,false)}),subscribe:fn=>{subscribed++;listeners.add(fn);return()=>{unsubscribed++;listeners.delete(fn);}},command:async()=>({type:"REJECTED",reason:"FIXTURE_ONLY"})};
            note.focus();disposeSettings=mountAtlasSettings(settings,bridge);disposeHome=mountAtlasHome(home,bridge,()=>{});assert.equal(document.activeElement,note,"Background mounting does not steal note focus");
            control(settings,"Add a destination").click();await delay(20);const draft=settings.querySelector(".hub-atlas-draft"),field=draft.querySelector('[aria-label="Name"]');field.value="Retained selection";field.focus();field.setSelectionRange(2,7);
            assert.equal(getComputedStyle(draft.querySelector(".hub-atlas-form-grid")).gridTemplateColumns.split(" ").length,1,"Narrow container reflows inside a wide window");
            assert.ok(field.getBoundingClientRect().width>150&&field.getBoundingClientRect().width<420,"Readable field width");
            field.blur(); const style=getComputedStyle(field),surface=getComputedStyle(settings),muted=getComputedStyle(settings.querySelector("small"));
            assert.equal(style.colorScheme,appearance);const values={appearance,text:contrast(style.color,style.backgroundColor),muted:contrast(muted.color,surface.backgroundColor),boundary:contrast(style.borderTopColor,style.backgroundColor)};
            assert.ok(values.text>=4.5&&values.muted>=4.5,JSON.stringify(values));assert.ok(values.boundary>=3,JSON.stringify(values));ratios.push(values); field.focus(); field.setSelectionRange(2,7);
            for (const tone of ["error","warning","success","unresolved"]) {
                const message=document.createElement("p");message.dataset.tone=tone;message.textContent=tone;settings.append(message);assert.ok(contrast(getComputedStyle(message).color,surface.backgroundColor)>=4.5,"Readable "+tone+" in "+appearance);message.remove();
            }
            listeners.forEach(fn=>fn());await delay(20);assert.equal(document.activeElement,field);assert.equal(field.selectionStart,2);assert.equal(field.selectionEnd,7);
            assert.ok(home.scrollWidth<=home.clientWidth+1,"Narrow Home has no horizontal page overflow");
            const tab=settings.querySelector('nav [aria-selected="true"]');tab.focus();await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "End", code: "End", windowsVirtualKeyCode: 35 }); await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "End", code: "End", windowsVirtualKeyCode: 35 });assert.equal(document.activeElement.textContent,"Diagnostics / Recovery");assert.equal(document.activeElement.getAttribute("aria-selected"),"true");
            const outline=getComputedStyle(document.activeElement);assert.notEqual(outline.outlineStyle,"none","Keyboard focus indication");
            control(settings,"Sites & Access").click();await delay(20);field.focus();field.scrollIntoView({block:"center"});await delay(20);
            const rect=field.getBoundingClientRect();assert.ok(field.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)),"Narrow field can be reached and hit tested");
            assert.equal(document.activeElement, field, "Explicit field focus is preserved"); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const image=await win.capturePage();fs.writeFileSync(path.join(os.tmpdir(),"hub-atlas-m3-quality-"+appearance+".png"),image.toPNG());
            disposeSettings();disposeHome();disposeSettings=()=>{};disposeHome=()=>{};assert.equal(subscribed,unsubscribed);assert.equal(listeners.size,0);
        }
        fs.writeFileSync(path.join(os.tmpdir(),"atlas-m3-quality-metrics.json"),JSON.stringify(ratios,null,2));
        console.log("PASS M3 actual-theme narrow containers, light/dark contrast, caret, focus and subscriptions: "+JSON.stringify(ratios.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==="number"?+v.toFixed(2):v])))));
        return "PASS M3 quality";
    } finally { win.webContents.debugger.detach(); disposeSettings();disposeHome();root.remove();document.body.classList.toggle("theme-dark",dark);document.body.classList.toggle("theme-light",light);win.webContents.setZoomFactor(zoom);win.setContentSize(size[0],size[1]); }
};
