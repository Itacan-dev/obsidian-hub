"use strict";
const fs = require("node:fs/promises");
async function connect(port) {
    const target = (await (await fetch("http://127.0.0.1:" + port + "/json/list")).json()).find(t => t.type === "page" && t.url === "app://obsidian.md/index.html");
    if (!target) throw Error("No ordinary Obsidian renderer");
    const ws = new WebSocket(target.webSocketDebuggerUrl), pending = new Map(); let sequence = 0;
    await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
    ws.addEventListener("message", ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (p) { pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result); } });
    ws.addEventListener("close", () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error("Renderer closed")); } pending.clear(); });
    const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error("CDP timeout: " + method)); }, 120000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
    return { call, close: () => ws.close(), async evaluate(expression) { const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; } };
}
if (require.main === module) (async () => { const c = await connect(Number(process.argv[2])); try { console.log(JSON.stringify(await c.evaluate(await fs.readFile(process.argv[3], "utf8")))); } finally { c.close(); } })().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { connect };
