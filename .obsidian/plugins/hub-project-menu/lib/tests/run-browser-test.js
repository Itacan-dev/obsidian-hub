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
        "--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-networking",
        "--allow-file-access-from-files", "--remote-debugging-pipe", `--user-data-dir=${profile}`
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
    const timeout = setTimeout(() => { child.kill(); console.error("Browser test timed out"); process.exitCode = 1; }, 30000);
    try {
        const { targetId } = await send("Target.createTarget", { url: "about:blank" });
        const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
        await send("Page.navigate", { url: pathToFileURL(path.join(__dirname, fixture + ".html")).href }, sessionId);
        let text = "";
        for (let attempt = 0; attempt < 200; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 75));
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
