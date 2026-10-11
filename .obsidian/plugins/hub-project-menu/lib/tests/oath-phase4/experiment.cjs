"use strict";
const assert = require("node:assert/strict"), path = require("node:path"), fs = require("node:fs");
const { fixture } = require("../oath.test");
const { OathProcessObserver } = require("../../services/oath-process-observer");
const { snapshot } = require("../oath-host/recovery.cjs");
const { installEscape } = require("../oath-lifecycle/development-escape.cjs");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let testFixture;
module.exports.tasks = () => testFixture.readTasks();
module.exports.contexts = () => testFixture.contexts;
async function run(ctx) {
    ctx.fixture.safetyOnly = true;
    try { await require("../oath-host/experiment.cjs").run(ctx); }
    finally { ctx.fixture.safetyOnly = false; }
    const win = ctx.host, before = snapshot(win), observer = new OathProcessObserver();
    const results = path.join(__dirname, "results"); fs.mkdirSync(results, { recursive: true });
    const js = async code => {
        const result = await win.webContents.executeJavaScript(`(async()=>{try{return {value:await eval(${JSON.stringify(code)})};}catch(error){return {failure:error.stack};}})()`);
        if (result.failure) throw Error(result.failure); return result.value;
    };
    const until = async (code, label) => {
        for (let i = 0; i < 120; i++) { if (await js(code)) return; await delay(50); }
        throw Error("Timed out: " + label);
    };
    const click = text => js(`window.phase4Click(${JSON.stringify(text)})`);
    let safety, external, expectedEscape = false, syntheticBlocker = false;
    module.exports.setBlocker = value => { syntheticBlocker = !!value; };
    const strict = win.__hubStrictOathCoordinator;
    assert(strict && !strict.enabled);
    await ctx.check("Phase 4: freshly built plugin keeps product opt-in disabled by default", async () => {
        assert.equal(await js("app.plugins.plugins['hub-project-menu'].oath.strictEnabled"), false);
        assert.equal(strict.enabled, false);
    });
    strict.observer = { listWindows: async () => [
        ...(await observer.listWindows()).filter(row => row.pid === process.pid || row.pid === external?.pid),
        ...(syntheticBlocker ? [{ pid: 987654, handle: "987654", title: "Synthetic unsaved document", executable: "c:\\fixture\\blocked.exe" }] : [])
    ], cancel: () => observer.cancel() };
    const cleanup = ctx.cleanup;
    ctx.cleanup = async () => { safety?.dispose(); await strict.release(strict.current?.id); testFixture?.destroy(); await cleanup(); };
    safety = installEscape(win, () => strict.release(strict.current?.id), reason => {
        ctx.report.developmentAudit = { reason, restored: JSON.stringify(snapshot(win)) === JSON.stringify(before) };
        if (!expectedEscape) void ctx.stop(Error("Development escape used; remaining checks cancelled"));
    });
    testFixture = fixture();
    testFixture.files.set("Projects/A/Tasks.md", "- [ ] First <!-- hub-task:first -->\n- [ ] Second <!-- hub-task:second -->\n");
    for (const [file, content] of testFixture.files) {
        const target = path.join(ctx.fixture.vault, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
    }
    const helper = __filename;
    await js(`(async()=>{
        const plugin=app.plugins.plugins['hub-project-menu'], helper=window.electron.remote.require(${JSON.stringify(helper)});
        window.phase4Plugin=plugin; window.phase4Service=plugin.oath;
        const contexts=helper.contexts().map(c=>({...c}));
        plugin.projectWizard.getProjectRecords=()=>contexts;
        plugin.projectWizard.getProjectById=id=>contexts.find(c=>c.projectId===id);
        plugin.workspaceModes.currentContext=()=>contexts[0]; plugin.workspaceModes.openProjectFull=async()=>{};
        plugin.oath.ready=()=>true; plugin.oath.api=()=>({});
        plugin.taskData.readPages=()=>[{file:{tasks:helper.tasks().map(t=>({...t}))}}];
        window.phase4Now=Date.now(); plugin.oath.now=()=>window.phase4Now;
        window.phase4Modal=()=>[...document.querySelectorAll('.modal-content')].at(-1);
        window.phase4Click=text=>{const scope=window.phase4Modal();const control=[...scope.querySelectorAll('button,input')].find(el=>el.textContent===text||el.getAttribute('aria-label')===text||el.type==='radio'&&el.value===text);if(!control)throw Error('Missing control '+text);control.click();};
    })()`);
    await until("!!app.vault.getAbstractFileByPath('Projects/A/A.md')", "test workspace indexed");
    external = await ctx.launchCompanion({ x: 180, y: 120, width: 640, height: 440 });
    const whoami = path.join(process.env.SystemRoot, "System32/whoami.exe");
    await ctx.check("Phase 4: real Settings opt-in and verified defaults persist in the isolated vault", async () => {
        await js("phase4Plugin.settingsControl.open('oath')");
        assert.equal(await js("phase4Modal().querySelector('input[type=checkbox]').checked"), false);
        await click("Enable Strict Oath on this device"); await until("phase4Service.strictEnabled", "opt-in saved");
        for (const executable of [process.execPath, whoami]) {
            await until("![...phase4Modal().querySelectorAll('button')].find(b=>b.textContent==='Add path').disabled", "application editor ready");
            await js(`phase4Modal().querySelector('input[type=text]').value=${JSON.stringify(executable)}`);
            await click("Add path"); await until(`phase4Service.strictApplications.includes(${JSON.stringify(executable.toLowerCase())})`, "default saved");
        }
        await js("document.querySelector('.hub-settings-dialog').closest('.modal-container').querySelector('.modal-close-button,.modal-header-button').click()");
        const bucket = await js("phase4Service.bucket"); assert.equal(bucket.strictEnabled, true); assert.equal(bucket.strictApplications.length, 2);
        const state = fs.readFileSync(path.join(ctx.fixture.vault, ".obsidian/plugins/hub-project-menu/data.json"), "utf8");
        assert(state.includes("strictEnabled"));
    });
    await ctx.check("Phase 4: setup offers ordinary by default, per-Oath override, and task selection", async () => {
        await js("phase4Plugin.oathControl.open()");
        assert.equal(await js("phase4Modal().querySelector('input[value=ordinary]').checked"), true);
        await click("strict"); await click("Override application defaults for this Oath");
        assert.equal(await js("phase4Modal().querySelector('.hub-oath-applications ul').children.length"), 2);
        // Inherit again: the confirmed default snapshot must be shown at review.
        await click("Override application defaults for this Oath");
        await js("phase4Modal().querySelector('.hub-oath-task-option').click()"); await click("25");
        module.exports.setBlocker(true);
        await click("Review Oath"); await until("!!document.querySelector('.hub-oath-strict-accept')", "Strict review");
        assert.equal(await js("[...phase4Modal().querySelectorAll('button')].find(b=>b.textContent==='Take the Oath').disabled"), true);
        assert((await js("phase4Modal().textContent")).includes("Ordinary early exit is unavailable"));
    });
    await ctx.check("Phase 4: blocker review prevents immediate Take and refresh requires a fresh acknowledgment", async () => {
        assert((await js("phase4Modal().textContent")).includes("Synthetic unsaved document"));
        await click("I understand and accept the Strict Oath restrictions");
        assert.equal(await js("[...phase4Modal().querySelectorAll('button')].find(b=>b.textContent==='Take the Oath').disabled"), true);
        module.exports.setBlocker(false); await click("Refresh application checks");
        await until("![...phase4Modal().querySelectorAll('button')].find(b=>b.textContent==='Refresh application checks').disabled", "ready recheck");
        assert.equal(await js("phase4Modal().querySelector('.hub-oath-strict-accept input').checked"), false);
        assert((await js("phase4Modal().textContent")).includes("No known blockers detected"));
        await js("phase4Modal().closest('.modal').style.width='330px'"); await delay(100);
        assert(await js("phase4Modal().closest('.modal').scrollWidth<=phase4Modal().closest('.modal').clientWidth+1"), "Strict review overflows at 330px");
        await js("phase4Modal().closest('.modal').style.width=''");
        await js("phase4Modal().closest('.modal').scrollTop=phase4Modal().closest('.modal').scrollHeight");
        fs.writeFileSync(path.join(results, "strict-review.png"), (await win.webContents.capturePage()).toPNG());
    });
    await ctx.check("Phase 4: final confirmation activates the real plugin and a separate secure dock", async () => {
        await click("I understand and accept the Strict Oath restrictions"); await click("Take the Oath");
        await until("phase4Service.active", "actual service activated");
        assert(win.isFullScreen()); assert.equal(win.isAlwaysOnTop(), false);
        const dock = ctx.electron.BrowserWindow.getAllWindows().find(w => w.getTitle() === "Strict Oath dock"); assert(dock);
        const prefs = dock.webContents.getLastWebPreferences();
        for (const key of ["sandbox", "contextIsolation", "webSecurity"]) assert.equal(prefs[key], true);
        for (const key of ["nodeIntegration", "webviewTag"]) assert.equal(prefs[key], false);
        assert.equal(dock.getParentWindow(), null); assert.equal(dock.isAlwaysOnTop(), true); assert.equal(dock.isFocusable(), false);
        assert.equal(await dock.webContents.executeJavaScript("typeof require"), "undefined");
        const labels = await dock.webContents.executeJavaScript("[...document.querySelectorAll('button')].map(b=>b.textContent)");
        assert(labels.some(label => label.includes("whoami.exe"))); assert(!labels.some(label => /minimize|restore/i.test(label)));
        fs.writeFileSync(path.join(results, "strict-dock.png"), (await dock.webContents.capturePage()).toPNG());
        ctx.report.dockPreferences = prefs; ctx.dock = dock;
    });
    if (!strict.current) throw Error("UI activation failed; cannot test guarded actions");
    await ctx.check("Phase 4: dock launches a permitted built-in executable and rejects unapproved actions", async () => {
        const dock = ctx.dock;
        const list = await js("phase4Service.current.policy.applications"); const index = list.indexOf(whoami.toLowerCase());
        const launched = await dock.webContents.executeJavaScript(`window.oathDock.request('launch',${index})`); assert(launched.pid > 0);
        const rejected = await dock.webContents.executeJavaScript("window.oathDock.request('launch',999).then(()=>false,()=>true)"); assert(rejected);
        assert(await dock.webContents.executeJavaScript("window.oathDock.request('minimize',0).then(()=>false,()=>true)"));
        await dock.webContents.executeJavaScript("document.getElementById('focus').click()");
        assert(win.isFullScreen());
        const footer = await js("[...document.querySelectorAll('.hub-shell-shortcut')].map(b=>({label:b.getAttribute('aria-label'),tab:b.tabIndex}))");
        assert(footer.some(b=>b.label.includes("whoami.exe")&&b.tab===0)); ctx.report.footer = footer;
    });
    await ctx.check("Phase 4: ordinary external minimization/restore and Alt+Tab remain available", async () => {
        let prevented = false; win.webContents.emit("before-input-event", { preventDefault() { prevented = true; } }, { key: "Tab", alt: true, type: "keyDown" });
        assert.equal(prevented, false); await ctx.rpc("focus"); await ctx.rpc("minimize"); await delay(150);
        assert((await ctx.rpc("state")).minimized); await ctx.rpc("restore"); await delay(150);
        assert.equal((await ctx.rpc("state")).minimized, false); assert(win.isFullScreen());
        ctx.report.stacking = { hostFocused: win.isFocused(), external: await ctx.rpc("state"), dockVisible: ctx.dock.isVisible(), physicalAltTabVerified: false };
    });
    await ctx.check("Phase 4: real status UI refuses early exit and fulfillment restores state and removes dock", async () => {
        await js("phase4Plugin.oathControl.open()");
        assert.equal(await js("[...phase4Modal().querySelectorAll('button')].find(b=>b.textContent==='Available after fulfillment').disabled"), true);
        assert.equal(await js("phase4Service.end(phase4Service.current.id,'broken')"), "strict-unfulfilled");
        await js("window.phase4Now+=25*60000;phase4Service.refresh()"); await until("phase4Service.fulfilled", "fulfilled");
        await click("End Oath"); await until("!phase4Service.active", "ended"); await delay(300);
        assert.deepEqual(snapshot(win), before); assert(ctx.dock.isDestroyed());
        assert.equal(await js("phase4Service.bucket.history.length"), 1);
    });
    await ctx.check("Phase 4: confirmed second UI activation remains recoverable with isolated development escape", async () => {
        await js("phase4Plugin.oathControl.open()"); await click("strict");
        await js("phase4Modal().querySelector('.hub-oath-task-option').click()"); await click("25"); await click("Review Oath");
        await until("!!document.querySelector('.hub-oath-strict-accept')", "second review");
        await click("Refresh application checks"); await until("![...phase4Modal().querySelectorAll('button')].find(b=>b.textContent==='Refresh application checks').disabled", "checks refreshed");
        await click("I understand and accept the Strict Oath restrictions"); await click("Take the Oath"); await until("phase4Service.active", "second activation");
        const lostDock = ctx.electron.BrowserWindow.getAllWindows().find(w => w.getTitle() === "Strict Oath dock");
        lostDock.destroy(); await strict.poll();
        assert(ctx.electron.BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.getTitle() === "Strict Oath dock"));
        assert.equal(await js("phase4Service.active"), true);
        assert.equal(await js("phase4Service.end(phase4Service.current.id,'broken')"), "strict-unfulfilled");
        expectedEscape = true;
        win.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
        win.webContents.sendInputEvent({ type: "keyUp", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
        for (let i = 0; i < 60 && !safety.pending; i++) await delay(50); assert(safety.pending); await safety.pending;
        assert.deepEqual(snapshot(win), before); await js("phase4Service.refresh()");
        assert.equal(await js("phase4Service.current.state"), "interrupted"); expectedEscape = false;
    });
    ctx.report.limitations = ["Actual freshly built Settings/setup/review/status and Oath service run in isolated Obsidian; tasks/workspace/index and navigation use synthetic fixture adapters.",
        "Only owned fixture windows are included in preflight; no user application is closed or terminated.",
        "Dock launch exercises Windows whoami.exe, a harmless short-lived built-in executable; arbitrary GUI launch behavior is not guaranteed.",
        "External focus/stacking flags are observations, not OS foreground proof. Physical Alt+Tab and third-party desktop acceptance remain manual.",
        "Installed Obsidian archive runs in existing test Electron 39.8.3; normal installed launcher was not changed."];
}
module.exports.run = run;
