"use strict";
// Actual shared card and Add/Edit modules with native CSS; isolated Modal/service.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const { spawn } = require("node:child_process"), assert = require("node:assert/strict");
async function run() {
    const root = path.resolve(__dirname, "../.."), vault = path.resolve(root, "../../..");
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "itacan-header-alignment-"));
    const native = process.env.HUB_TEST_NATIVE_CSS || path.join(os.tmpdir(), "itacan-native-app.css");
    assert(fs.existsSync(native), "Supply native Obsidian CSS through HUB_TEST_NATIVE_CSS");
    const server = http.createServer((req, res) => {
        const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const file = name === "/lib/tests/native-app.css" ? native : name === "/lib/tests/home-view.css" ? path.join(vault, "System/Dashboards/Home/view.css") : path.resolve(root, "." + name);
        if (file !== native && file !== path.join(vault, "System/Dashboards/Home/view.css") && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        try { res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html"); res.end(fs.readFileSync(file)); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const child = spawn(process.env.HUB_TEST_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", "--user-data-dir=" + path.join(output, "profile"), "about:blank"], { windowsHide: true, stdio: "ignore" });
    let socket, checks = 0;
    const check = (v, message) => { assert(v, message); checks++; };
    const timeout = setTimeout(() => { child.kill(); server.close(); console.error("Header browser test timed out"); process.exit(1); }, 60000);
    try {
        let devtools;
        for (let i = 0; i < 200; i++) { try { devtools = fs.readFileSync(path.join(output, "profile/DevToolsActivePort"), "utf8").split(/\r?\n/); break; } catch { await new Promise(r => setTimeout(r, 50)); } }
        assert(devtools, "Browser starts");
        const targets = await (await fetch("http://127.0.0.1:" + devtools[0] + "/json/list")).json();
        socket = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
        let sequence = 0; const pending = new Map();
        socket.addEventListener("message", event => { const m = JSON.parse(event.data); if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
        const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
        const evaluate = async expression => { const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
        const point = expression => evaluate(`(() => {const e=(${expression});e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
        const click = async expression => { const p = await point(expression); await call("Input.dispatchMouseEvent", { type: "mousePressed", ...p, button: "left", clickCount: 1 }); await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...p, button: "left", clickCount: 1 }); await evaluate("frames()"); };
        const key = async (key, vk, text) => { await call("Input.dispatchKeyEvent", { type: "keyDown", key, windowsVirtualKeyCode: vk, text }); await call("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: vk }); await evaluate("frames()"); };
        const screenshot = async name => { const r = await call("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(output, name + ".png"), Buffer.from(r.data, "base64")); };
        await call("Page.enable"); await call("Runtime.enable");
        for (const [width, height, scale, theme] of [[1024, 900, 1, "dark"], [390, 720, 1.5, "dark"], [320, 720, 1, "dark"], [600, 900, 1, "light"]]) {
            await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
            await call("Page.navigate", { url: "http://127.0.0.1:" + server.address().port + "/lib/tests/task-header-alignment.html?theme=" + theme });
            for (let i = 0; i < 200 && !await evaluate("Boolean(window.testDone)"); i++) await new Promise(r => setTimeout(r, 25));
            const result = await evaluate("testDone"); checks += result.checks;
            await evaluate(`document.body.className='theme-${theme}';frames()`);
            await screenshot("panels-" + width + "-" + theme);
            for (const mode of ["Add", "Edit"]) {
                await evaluate(`openEditor('${mode}')`); await evaluate("editorAssessment()");
                const parts = "editor.taskFields.card";
                const info = parts + ".info.querySelector('.hub-task-description-indicator')";
                const p = await point(info); await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...p }); await evaluate("frames()");
                check(await evaluate("!!document.querySelector('.hub-task-description-tooltip')"), mode + " description hover works");
                await click(info); check(await evaluate("!!document.querySelector('.hub-task-description-tooltip')"), mode + " description click works");
                await evaluate(info + ".focus()"); await key(" ", 32, " "); await key(" ", 32, " ");
                check(await evaluate("!!document.querySelector('.hub-task-description-tooltip')"), mode + " description keyboard interaction works");
                const geometry = await evaluate(`JSON.stringify((${info}).getBoundingClientRect().toJSON())`);
                await evaluate(info + ".classList.add('hub-attention')");
                check(await evaluate(`JSON.stringify((${info}).getBoundingClientRect().toJSON())`) === geometry, mode + " feedback keeps icon geometry");
                await evaluate(info + ".classList.remove('hub-attention')");
                await evaluate("editor.taskFields.checklist.toggle.focus()"); await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
                await click(parts + ".textEl"); check(await evaluate("document.activeElement===editor.taskFields.input"), mode + " title editing accessible");
                await evaluate("editor.taskFields.input.value='A long editable title that wraps with its due date and information icon. '.repeat(4);editor.taskFields.input.dispatchEvent(new Event('input',{bubbles:true}));frames()");
                await evaluate("editorAssessment()");
                await screenshot(mode + "-long-" + width + "-" + theme);
                await evaluate("editor.taskFields.input.value='Updated Assignment';editor.taskFields.input.dispatchEvent(new Event('input',{bubbles:true}));editor.taskFields.checklist.toggle.focus();frames()");
                await evaluate("editorAssessment()");
                await click("editor.taskFields.completion"); check(await evaluate("editor.taskFields.state.completed"), mode + " checkbox still works");
                await click("editor.contentEl.querySelector('.hub-task-dialog-actions .mod-cta')");
                check(await evaluate("!editor.modalEl.isConnected"), mode + " Save closes dialog");
            }
            const current = await evaluate("results()"); check(current.writes === 2, "Add and Edit each persist once"); checks += current.checks - result.checks;
            console.log("PASS", width, theme, "fixture checks:", current.checks);
        }
        fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ checks, host: "Mocked Obsidian Modal/service with actual task modules and native CSS" }, null, 2));
        console.log("PASS:", checks, "checks. Evidence:", output);
    } finally { clearTimeout(timeout); socket?.close(); child.kill(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
