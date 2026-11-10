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
        if (process.env.HUB_TEST_HOME_SOURCE) fixtureUrl.searchParams.set("home-source", process.env.HUB_TEST_HOME_SOURCE);
        await send("Page.navigate", { url: fixtureUrl.href }, sessionId);
        let text = "", pointerButtons = 0;
        for (let attempt = 0; attempt < 720; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 75));
            const motion = await send("Runtime.evaluate", { expression: "window.hubTestMotionRequest || false", returnByValue: true }, sessionId);
            if (motion.result?.value) {
                const value = motion.result.value;
                if (!["reduce", "no-preference"].includes(value)) throw Error("Invalid fixture reduced-motion request");
                await send("Runtime.evaluate", { expression: "window.hubTestMotionRequest = false" }, sessionId);
                await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value }] }, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestMotionDone()" }, sessionId);
            }
            const resize = await send("Runtime.evaluate", { expression: "window.hubTestViewportRequest || false", returnByValue: true }, sessionId);
            if (resize.result?.value) {
                const next = resize.result.value;
                if (![next.width, next.height].every(value => Number.isInteger(value) && value >= 300 && value <= 4000)) throw Error("Invalid fixture resize");
                await send("Runtime.evaluate", { expression: "window.hubTestViewportRequest = false" }, sessionId);
                await send("Emulation.setDeviceMetricsOverride", { width: next.width, height: next.height, screenWidth: next.width,
                    screenHeight: next.height, deviceScaleFactor: Number(process.env.HUB_TEST_DPR || 1), mobile: false }, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestViewportDone()" }, sessionId);
            }
            const capture = await send("Runtime.evaluate", { expression: "window.hubTestScreenshotRequest || false", returnByValue: true }, sessionId);
            if (capture.result?.value) {
                await send("Runtime.evaluate", { expression: "window.hubTestScreenshotRequest = false" }, sessionId);
                const frame = await send("Page.captureScreenshot", { format: "png" }, sessionId);
                if (typeof capture.result.value === "string" && /^[a-z0-9.-]+$/.test(capture.result.value)) {
                    fs.writeFileSync(path.join(os.tmpdir(), "hub-" + capture.result.value + ".png"), Buffer.from(frame.data, "base64"));
                }
                await send("Runtime.evaluate", { expression: `window.hubTestScreenshotDone(${JSON.stringify(frame.data)})` }, sessionId);
            }
            const keyboard = await send("Runtime.evaluate", { expression: "window.hubTestKeyRequest || ''", returnByValue: true }, sessionId);
            if (keyboard.result?.value) {
                const request = keyboard.result.value, key = typeof request === "string" ? request : request.key;
                const modifiers = typeof request === "string" ? 0 : request.modifiers || 0;
                const code = { Enter: 13, Tab: 9, Escape: 27, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, Backspace: 8, Delete: 46, ContextMenu: 93, F10: 121 }[key] ?? key.toUpperCase().charCodeAt(0);
                await send("Page.bringToFront", {}, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestKeyRequest = null" }, sessionId);
                await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key === " " ? "Space" : key.length === 1 ? "Key" + key.toUpperCase() : key,
                    text: key === "Enter" ? "\r" : key.length === 1 ? key : undefined, windowsVirtualKeyCode: code, modifiers }, sessionId);
                await send("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: code, modifiers }, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestKeyDone()" }, sessionId);
            }
            const accessibility = await send("Runtime.evaluate", { expression: "!!window.hubTestAccessibilityRequest", returnByValue: true }, sessionId);
            if (accessibility.result?.value) {
                await send("Runtime.evaluate", { expression: "window.hubTestAccessibilityRequest = false" }, sessionId);
                const { nodes } = await send("Accessibility.getFullAXTree", {}, sessionId);
                const names = nodes.filter(node => !node.ignored).map(node => ({ role: node.role?.value, name: node.name?.value }));
                await send("Runtime.evaluate", { expression: `window.hubTestAccessibilityDone(${JSON.stringify(names)})` }, sessionId);
            }
            const nativeFields = await send("Runtime.evaluate", { expression: "window.hubTestNativeFieldsRequest || null", returnByValue: true }, sessionId);
            if (nativeFields.result?.value) {
                const labels = nativeFields.result.value;
                if (!Array.isArray(labels) || labels.length > 4 || labels.some(label => !/^(Start date|Due date)( time)?$/.test(label))) throw Error("Invalid native field measurement request");
                await send("Runtime.evaluate", { expression: "window.hubTestNativeFieldsRequest = null" }, sessionId);
                const { root } = await send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
                const walk = node => [node, ...(node.children ?? []).flatMap(walk), ...(node.shadowRoots ?? []).flatMap(walk)];
                const nodes = walk(root), results = [];
                for (const label of labels) {
                    const field = nodes.find(node => node.nodeName === "INPUT" && node.attributes?.some((value, i, values) => value === "aria-label" && values[i + 1] === label));
                    const children = field ? walk(field).filter(node => node.attributes?.some((value, i, values) => value === "id" && /picker|datetime-edit$/.test(values[i + 1]))) : [];
                    const parts = [];
                    for (const child of children) {
                        const { object } = await send("DOM.resolveNode", { nodeId: child.nodeId }, sessionId);
                        const { result } = await send("Runtime.callFunctionOn", { objectId: object.objectId, returnByValue: true,
                            functionDeclaration: "function(){const s=getComputedStyle(this),b=this.getBoundingClientRect();return {id:this.id,x:b.x,y:b.y,width:b.width,height:b.height,hidden:s.display==='none'||s.visibility==='hidden'||!b.width||!b.height}}" }, sessionId);
                        parts.push(result.value);
                    }
                    results.push({ label, parts });
                }
                await send("Runtime.evaluate", { expression: `window.hubTestNativeFieldsDone(${JSON.stringify(results)})` }, sessionId);
            }
            const pointer = await send("Runtime.evaluate", { expression: "window.hubTestPointerRequest || null", returnByValue: true }, sessionId);
            if (pointer.result?.value) {
                const { x, y, action } = pointer.result.value;
                if (!pointerButtons) await send("Page.bringToFront", {}, sessionId);
                await send("Runtime.evaluate", { expression: "window.hubTestPointerRequest = null" }, sessionId);
                await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: pointerButtons ? "left" : "none", buttons: pointerButtons }, sessionId);
                if (action !== "move" && action !== "up") {
                    pointerButtons = 1;
                    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: pointerButtons, clickCount: 1 }, sessionId);
                }
                if (action !== "move" && action !== "down") {
                    pointerButtons = 0;
                    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: pointerButtons, clickCount: 1 }, sessionId);
                }
                await send("Runtime.evaluate", { expression: "window.hubTestPointerDone()" }, sessionId);
            }
            const pixels = await send("Runtime.evaluate", { expression: "window.hubTestPixelRequest || null", returnByValue: true }, sessionId);
            if (pixels.result?.value) {
                const points = pixels.result.value;
                if (!Array.isArray(points) || points.length > 128 || points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0))) throw Error("Invalid raster sample points");
                const screenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
                // Read actual Chromium raster pixels in a canvas; no DOM paint approximation.
                await send("Runtime.evaluate", { expression: `(async () => {
                    const bytes = Uint8Array.from(atob(${JSON.stringify(screenshot.data)}), c => c.charCodeAt(0));
                    const bitmap = await createImageBitmap(new Blob([bytes], {type:'image/png'}));
                    const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
                    const ctx=canvas.getContext('2d'); ctx.drawImage(bitmap,0,0); bitmap.close();
                    const samples=${JSON.stringify(points)}.map(([x,y]) => [...ctx.getImageData(Math.floor(x*devicePixelRatio),Math.floor(y*devicePixelRatio),1,1).data]);
                    window.hubTestPixelRequest=null; window.hubTestPixelDone(samples);
                })()`, awaitPromise: true }, sessionId);
            }
            const result = await send("Runtime.evaluate", { expression: "document.getElementById('result')?.textContent || ''", returnByValue: true }, sessionId);
            text = result.result?.value || "";
            if (/^(PASS|FAIL|ERROR)/.test(text)) break;
        }
        const screenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
        const output = path.join(os.tmpdir(), "hub-" + fixture + "-verified.png");
        fs.writeFileSync(output, Buffer.from(screenshot.data, "base64"));
        const evidence = await send("Runtime.evaluate", { expression: "window.hubTaskOpeningFrames ? { frames: window.hubTaskOpeningFrames, problems: window.hubTaskOpeningProblems ?? [] } : null", returnByValue: true }, sessionId);
        if (evidence.result?.value) {
            const tracePath = path.join(os.tmpdir(), "hub-" + fixture + "-frames.json");
            fs.writeFileSync(tracePath, JSON.stringify(evidence.result.value, null, 2));
            console.log("Frame evidence:", tracePath);
        }
        console.log(text, "\nScreenshot:", output);
        if (!text.startsWith("PASS")) throw Error("Browser fixture did not pass");
    } finally {
        clearTimeout(timeout);
        await send("Browser.close").catch(() => child.kill());
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
