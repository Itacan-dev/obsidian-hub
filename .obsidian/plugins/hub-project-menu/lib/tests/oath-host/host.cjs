"use strict";
const electron = require("electron"), fs = require("fs"), path = require("path"), os = require("os"), { EventEmitter } = require("events");
const root = process.env.ITACAN_OATH_FIXTURE, token = process.env.ITACAN_OATH_TOKEN;
if (!root || path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("itacan-oath-phase1-") || !process.send) throw Error("Use the isolated Phase 1 launcher");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "fixture.json"), "utf8"));
if (fixture.token !== token || fixture.scratch !== root) throw Error("Invalid fixture token");
const { app } = electron;
// Obsidian's normal startup attempts protocol registration. A fixture must never
// register this test executable as the real obsidian:// handler or change login settings.
const preventedHostSideEffects = [];
for (const name of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient", "setLoginItemSettings", "setUserTasks", "setJumpList", "addRecentDocument", "clearRecentDocuments"]) {
    app[name] = () => { preventedHostSideEffects.push(name); return false; };
}
// Separate Obsidian CLI pipe, profile, caches and default file locations.
os.userInfo = () => ({ username: "itacan-oath-fixture-" + process.pid, homedir: root, uid: -1, gid: -1, shell: null });
app.setName("Itacan Oath Phase 1"); app.setAppUserModelId("itacan.oath.phase1." + token);
app.setPath("userData", fixture.profile); app.setPath("sessionData", fixture.profile);
for (const name of ["logs", "crashDumps", "documents", "desktop", "downloads"]) {
    const folder = path.join(root, name); fs.mkdirSync(folder, { recursive: true }); app.setPath(name, folder);
}
const remote = require("../../atlas/tests/native/node_modules/@electron/remote/main"); remote.initialize();
const ownedWindows = [], NativeWindow = electron.BrowserWindow;
function FixtureWindow(options = {}) {
    if (options.webPreferences?.preload) throw Error("Host has an existing preload; refusing to replace it");
    const win = new NativeWindow({ ...options, webPreferences: { ...options.webPreferences, preload: path.join(__dirname, "host-preload.cjs") } });
    ownedWindows.push(win); return win;
}
Object.setPrototypeOf(FixtureWindow, NativeWindow); FixtureWindow.prototype = NativeWindow.prototype;
const facade = { ...electron, BrowserWindow: FixtureWindow, remote: { enable: contents => remote.enable(contents) } };
electron.protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: {
    standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true, corsEnabled: true } }]);
const Module = require("module"), originalLoad = Module._load;
Module._load = function (name, parent, ...args) {
    return name === "electron" && parent?.filename.startsWith(fixture.archive) ? facade : originalLoad.call(this, name, parent, ...args);
};
const report = { phase: fixture.strictRelease || fixture.preview ? 5 : fixture.strictUI ? 4 : fixture.strictLifecycle ? 3 : fixture.windowsAdapter ? 2 : 1, runtime: { electron: process.versions.electron, node: process.versions.node, platform: process.platform, arch: process.arch },
    preventedHostSideEffects,
    checks: [], limitations: ["Separate-process Electron companion is a controlled external app, not coverage of arbitrary third-party apps.",
        "Injected Alt+Tab is not a physical-keyboard acceptance test.", "Installed Obsidian archive runs in test Electron; installed-launcher equivalence is unproven."] };
let experiment, stopping = false;
async function stop(error) {
    if (stopping) return; stopping = true; clearTimeout(deadline);
    if (error) { report.fatal = error.stack ?? String(error); console.error(report.fatal); }
    try { await experiment?.cleanup(); } catch (problem) { report.cleanupError = problem.stack; }
    report.feasibilityMet = !report.fatal && !report.cleanupError && report.checks.length > 0 && report.checks.every(check => check.status === "pass") && !fixture.safetyOnly;
    const code = report.fatal || report.cleanupError || report.checks.some(check => check.status === "fail") ? 1 : 0;
    if (process.connected) process.send({ type: "report", token, report }, () => app.exit(code));
    else app.exit(1);
}
const deadline = setTimeout(() => void stop(fixture.preview && !fixture.previewSmoke ? undefined : Error("Host deadline reached")), fixture.preview && !fixture.previewSmoke ? 20 * 60000 : 160000);
process.on("message", message => { if (message?.type === "abort" && message.token === token) void stop(Error("Launcher requested cleanup")); });
process.on("disconnect", () => { void stop(Error("Launcher disconnected")); setTimeout(() => app.exit(1), 2000); });
process.on("uncaughtException", error => void stop(error)); process.on("unhandledRejection", error => void stop(error));
app.on("window-all-closed", event => { /* runner owns termination */ });
app.whenReady().then(async () => {
    try {
        const { createExperiment } = require("./experiment.cjs");
        const { run } = require(fixture.preview ? "../oath-phase5/preview.cjs" : fixture.strictRelease ? "../oath-phase5/experiment.cjs" : fixture.strictUI ? "../oath-phase4/experiment.cjs" : fixture.strictLifecycle ? "../oath-lifecycle/experiment.cjs" : fixture.windowsAdapter ? "../oath-windows/experiment.cjs" : "./experiment.cjs");
        experiment = createExperiment({ electron, ownedWindows, fixture, report, stop });
        await run(experiment); await stop();
    } catch (error) { await stop(error); }
});
try {
    report.runtime.obsidian = JSON.parse(fs.readFileSync(path.join(fixture.archive, "package.json"), "utf8")).version;
    const events = new EventEmitter(); events.on("check-start", () => events.emit("check-end"));
    require(path.join(fixture.archive, "main.js"))(fixture.archive, events);
} catch (error) { void stop(error); }
