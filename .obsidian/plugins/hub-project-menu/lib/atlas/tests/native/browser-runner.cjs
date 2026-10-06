"use strict";
const { app, BrowserWindow } = require("electron"), fs = require("fs"), path = require("path"), os = require("os");
const profile = path.resolve(process.env.ATLAS_BROWSER_TEST_ROOT ?? "");
if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith("hub-electron-fixture-")) throw Error("Unexpected fixture profile");
app.setPath("userData", profile); app.disableHardwareAcceleration(); app.commandLine.appendSwitch("allow-file-access-from-files");
app.on("window-all-closed", () => {}); // each fixture owns a fresh hidden window
const directory = path.resolve(__dirname, "../../../tests"), args = process.argv.slice(2);
// These two pages compare personal artwork visually; they have no PASS marker.
const visualOnly = new Set(["card-image-detail.html", "card-images.html"]);
const names = args.includes("--all") ? fs.readdirSync(directory).filter(name => name.endsWith(".html") && !visualOnly.has(name) && /id=["']result["']/.test(fs.readFileSync(path.join(directory, name), "utf8"))).map(name => name.slice(0, -5)) : args.length ? args : ["settings", "workspace-navigation", "workspace-explorer", "workspace-covers", "atlas-product"];
if (!names.length || names.some(name => !/^[a-z-]+$/.test(name))) throw Error("Invalid fixture selection");
app.whenReady().then(async () => {
    let baselineRequests = 0;
    if (process.env.HUB_TEST_STYLES) {
        const { pathToFileURL } = require("url"), styleUrl = pathToFileURL(path.resolve(__dirname, "../../../../styles.css")).href;
        const baseline = path.resolve(process.env.HUB_TEST_STYLES);
        if (path.dirname(baseline) !== profile) throw Error("Unexpected baseline style path");
        require("electron").session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
            if (details.url === styleUrl) { baselineRequests++; callback({ redirectURL: pathToFileURL(baseline).href }); }
            else callback({});
        });
    }
    let passed = 0, failed = 0;
    for (const name of names) {
        const win = new BrowserWindow({ show: false, width: 1300, height: 940, webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: false, backgroundThrottling: false, offscreen: true } });
        win.webContents.on("console-message", details => { if (details.level === "error") console.error(`${name}: ${details.message}`); });
        try {
            // Hidden fixtures still need native keyboard modality and document
            // focus for :focus-visible and tooltip assertions.
            await win.loadURL("about:blank");
            win.webContents.debugger.attach("1.3");
            await win.webContents.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
            await win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
            await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
            await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
            await win.loadFile(path.join(directory, name + ".html"), { query: { preview: process.env.HUB_TEST_PREVIEW ?? "home" } });
            let result = ""; const deadline = Date.now() + 60_000;
            while (Date.now() < deadline) {
                result = await win.webContents.executeJavaScript("document.getElementById('result')?.textContent || ''");
                if (/^(PASS|FAIL|ERROR)/.test(result)) break;
                await new Promise(resolve => setTimeout(resolve, 60));
            }
            await win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
            const image = await win.webContents.capturePage();
            fs.writeFileSync(path.join(os.tmpdir(), `hub-${name}-${process.env.HUB_TEST_PREVIEW ?? "home"}-verified.png`), image.toPNG());
            if (!result.startsWith("PASS")) throw Error(result || "No completion marker");
            passed++; console.log(`PASS ${name}`);
        } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
        finally { win.destroy(); }
    }
    if (process.env.HUB_TEST_STYLES) console.log(`Committed baseline stylesheet requests: ${baselineRequests}`);
    console.log(`Hub browser fixtures: ${passed} passed, ${failed} failed`); app.exit(failed ? 1 : 0);
}).catch(error => { console.error(error.message); app.exit(1); });
