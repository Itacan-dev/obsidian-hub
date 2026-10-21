"use strict";
const http = require("node:http"), fs = require("node:fs/promises"), path = require("node:path"), { randomBytes, timingSafeEqual } = require("node:crypto");
const V = require("../src/value");
async function createDemoServer(runtime, { port = 0, browserTests = false } = {}) {
    const token = randomBytes(32).toString("hex"), root = path.join(__dirname, "public"); let closing = false, origin, closeServer;
    const files = new Map([["/", [path.join(root, "index.html"), "text/html"]], ["/app.mjs", [path.join(root, "app.mjs"), "text/javascript"]], ["/model.mjs", [path.join(root, "model.mjs"), "text/javascript"]], ["/style.css", [path.join(root, "style.css"), "text/css"]]]);
    if (browserTests) for (const name of ["browser-smoke.html", "browser-smoke.js"]) files.set("/" + name, [path.join(__dirname, "tests", name), name.endsWith("html") ? "text/html" : "text/javascript"]);
    const send = (res, code, value) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(value)); };
    const server = http.createServer(async (req, res) => {
        res.setHeader("cache-control", "no-store"); res.setHeader("referrer-policy", "no-referrer"); res.setHeader("x-content-type-options", "nosniff");
        res.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
        try {
            if (closing || req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin) return send(res, 403, { code: "DEMO_ORIGIN_REJECTED" });
            const url = new URL(req.url, origin);
            if (req.method === "GET" && files.has(url.pathname)) { const [file, type] = files.get(url.pathname); res.writeHead(200, { "content-type": type + "; charset=utf-8" }); res.end(await fs.readFile(file)); return; }
            const supplied = req.headers["x-itacan-demo"];
            if (typeof supplied !== "string" || supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return send(res, 403, { code: "DEMO_CAPABILITY_REQUIRED" });
            if (req.method === "GET" && url.pathname === "/api/info") return send(res, 200, runtime.info());
            if (req.method !== "POST" || req.headers.origin !== origin || !String(req.headers["content-type"]).startsWith("application/json")) return send(res, 400, { code: "DEMO_REQUEST_REJECTED" });
            const chunks = []; let size = 0;
            for await (const b of req) { size += b.length; if (size > 1024 * 1024) { send(res, 413, { code: "DEMO_REQUEST_TOO_LARGE" }); return; } chunks.push(b); }
            const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); V.jsonValue(body);
            if (url.pathname === "/api/close") { V.fields(body, [], []); send(res, 200, { closed: true }); queueMicrotask(() => closeServer().catch(() => {})); return; }
            if (url.pathname === "/api/list" || url.pathname === "/api/create-context") { V.fields(body, ["owner"], ["owner"]); return send(res, 200, await runtime[url.pathname === "/api/list" ? "list" : "creationContext"](body.owner)); }
            if (url.pathname === "/api/editor") { V.fields(body, ["owner", "taskId"], ["owner", "taskId"]); return send(res, 200, await runtime.editor(body.taskId, body.owner)); }
            if (url.pathname === "/api/mutate") return send(res, 200, await runtime.mutate(body));
            if (url.pathname === "/api/reconcile") { V.fields(body, ["operationId"], ["operationId"]); return send(res, 200, await runtime.reconcile(body.operationId)); }
            return send(res, 404, { code: "DEMO_ROUTE_UNAVAILABLE" });
        } catch (e) { return send(res, 400, { code: ["APPLICATION_CONTRACT", "VALIDATION", "DEMO_ACTION_UNSUPPORTED"].includes(e.code) ? e.code : "DEMO_READ_OR_REQUEST_UNAVAILABLE" }); }
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); }); origin = "http://127.0.0.1:" + server.address().port;
    closeServer = async () => { if (closing) return; closing = true; await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); await runtime.close(); };
    return Object.freeze({ origin, token, url: origin + "/#token=" + token, close: closeServer });
}
module.exports = { createDemoServer };
