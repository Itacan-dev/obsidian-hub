"use strict";
// Run asynchronous fixtures to completion rather than ending Chrome's virtual
// time budget before image.decode() has settled. Only isolated local test pages.
const fs = require("fs"), path = require("path"), os = require("os");
const { spawn } = require("child_process"), { pathToFileURL } = require("url");
async function run() {
    const fixture = process.argv[2] || "card-placement";
    if (!/^[a-z-]+$/.test(fixture)) throw Error("Invalid fixture name");
    const [width, height] = (process.argv[3] || "1100x850").split("x").map(Number);
    if (![width, height].every(value => Number.isInteger(value) && value >= 300 && value <= 4000)) throw Error("Invalid fixture viewport");
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hub-browser-test-"));
    const child = spawn(process.env.HUB_TEST_BROWSER || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
        "--headless=new", `--force-device-scale-factor=${process.env.HUB_TEST_DPR || 1}`, "--disable-gpu", "--no-first-run", "--disable-background-networking",
        // These fixtures use only local files and a fresh temporary profile.
        // Windows sandbox sessions cannot initialize Chromium's GPU sandbox.
        "--no-sandbox", "--disable-software-rasterizer", "--disable-features=RendererCodeIntegrity", "--disable-extensions",
        "--allow-file-access-from-files", "--remote-debugging-pipe", `--window-size=${width},${height}`, `--user-data-dir=${profile}`
    ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    let seq = 0, buffer = "";
    const requests = new Map();
    child.stdio[4].on("data", data => {
        buffer += data.toString();
        let end;
        while ((end = buffer.indexOf("\0")) >= 0) {
            const raw = buffer.slice(0, end); buffer = buffer.slice(end + 1);
            if (!raw) continue;
            const message = JSON.parse(raw), pending = requests.get(message.id);
            if (pending) {
                requests.delete(message.id);
                if (message.error) pending.reject(Error(JSON.stringify(message.error)));
                else pending.resolve(message.result);
            }
        }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++seq; requests.set(id, { resolve, reject });
        child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
    const timeout = setTimeout(() => { child.kill(); console.error("Browser test timed out"); process.exitCode = 1; }, 60000);
    try {
        const { targetId } = await send("Target.createTarget", { url: "about:blank" });
        const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
        await send("Emulation.setDeviceMetricsOverride", { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: Number(process.env.HUB_TEST_DPR || 1), mobile: false }, sessionId);
        if (process.env.HUB_TEST_REDUCED_MOTION !== undefined) await send("Emulation.setEmulatedMedia", { features: [
            { name: "prefers-reduced-motion", value: process.env.HUB_TEST_REDUCED_MOTION === "1" ? "reduce" : "no-preference" }
        ] }, sessionId);
        const fixtureUrl = pathToFileURL(path.join(__dirname, fixture + ".html"));
        if (process.env.HUB_TEST_PREVIEW) fixtureUrl.searchParams.set("preview", process.env.HUB_TEST_PREVIEW);
        await send("Page.navigate", { url: fixtureUrl.href }, sessionId);
        let text = "";
        for (let attempt = 0; attempt < 720; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 75));
            const keyboard = await send("Runtime.evaluate", { expression: "window.hubTestKeyRequest || ''", returnByValue: true }, sessionId);
            if (keyboard.result?.value) {
                const key = keyboard.result.value, code = { Enter: 13, Tab: 9, Escape: 27, ArrowDown: 40, ArrowUp: 38 }[key] ?? key.toUpperCase().charCodeAt(0);
                await send("Page.bringToFront", {}, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestKeyRequest = null" }, sessionId);
                await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key === " " ? "Space" : key.length === 1 ? "Key" + key.toUpperCase() : key,
                    text: key === "Enter" ? "\r" : key.length === 1 ? key : undefined, windowsVirtualKeyCode: code }, sessionId);
                await send("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: code }, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestKeyDone()" }, sessionId);
            }
            const accessibility = await send("Runtime.evaluate", { expression: "!!window.hubTestAccessibilityRequest", returnByValue: true }, sessionId);
            if (accessibility.result?.value) {
                await send("Runtime.evaluate", { expression: "window.hubTestAccessibilityRequest = false" }, sessionId);
                const { nodes } = await send("Accessibility.getFullAXTree", {}, sessionId);
                const names = nodes.filter(node => !node.ignored).map(node => ({ role: node.role?.value, name: node.name?.value }));
                await send("Runtime.evaluate", { expression: `window.hubTestAccessibilityDone(${JSON.stringify(names)})` }, sessionId);
            }
            const pointer = await send("Runtime.evaluate", { expression: "window.hubTestPointerRequest || null", returnByValue: true }, sessionId);
            if (pointer.result?.value) {
                const { x, y } = pointer.result.value;
                await send("Page.bringToFront", {}, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestPointerRequest = null" }, sessionId);
                await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId);
                await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, sessionId);
                await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestPointerDone()" }, sessionId);
            }
            const result = await send("Runtime.evaluate", { expression: "document.getElementById('result')?.textContent || ''", returnByValue: true }, sessionId);
            text = result.result?.value || "";
            if (/^(PASS|FAIL|ERROR)/.test(text)) break;
        }
        const screenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
        const output = path.join(os.tmpdir(), "hub-" + fixture + "-verified.png");
        fs.writeFileSync(output, Buffer.from(screenshot.data, "base64"));
        console.log(text, "\nScreenshot:", output);
        if (!text.startsWith("PASS")) throw Error("Browser fixture did not pass");
    } finally {
        clearTimeout(timeout);
        await send("Browser.close").catch(() => child.kill());
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
