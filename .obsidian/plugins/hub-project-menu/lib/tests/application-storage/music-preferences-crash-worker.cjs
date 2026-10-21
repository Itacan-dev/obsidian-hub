"use strict";
const S = require("./support.cjs");
const { createMusicPreferences } = require(S.services + "/application-storage/music-preferences");
const { MusicLibrary } = require(S.services + "/music-library");
(async () => {
    const control = JSON.parse(await S.fs.readFile(process.argv[2], "utf8")), stage = process.argv[3];
    const store = S.api.createTransactionalApplicationStore(control.config); await store.open({ version: 1 });
    const port = createMusicPreferences({ store, authorityId: control.config.authorityId, applicationContextId: control.config.applicationContextId });
    let committed = false;
    const pause = async name => { if (stage !== name) return; setInterval(() => {}, 1000); process.send({ kind: "paused", stage: name, pid: process.pid, host: S.os.hostname() }); await new Promise(() => {}); };
    const injected = { ...port,
        prepare(...args) { const p = port.prepare(...args); process.send({ kind: "prepared", prepared: p, pid: process.pid }); return p; },
        async submit(p, signal) { await pause("before-publication"); const out = await port.submit(p, signal); committed = ["committed", "replayed"].includes(out.status); if (committed) process.send({ kind: "committed", outcome: out }); return out; },
        async read() { if (committed) await pause("before-memory-refresh"); return port.read(); }
    };
    const plugin = { app: {}, projectWizard: { data: { music: control.music } }, dataStore: { save() { throw Error("Legacy forbidden"); } } };
    const library = new MusicLibrary(plugin, { transactionalPreferences: injected });
    const rename = S.fs.rename;
    S.fs.rename = async (...args) => { const value = await rename(...args); if (S.path.basename(String(args[1])) === "data.json") await pause("after-publication"); return value; };
    const out = control.provider ? await library.setProviderEnabled(control.provider, false) : await library.setEnabled(true);
    process.send({ kind: "outcome", out }); library.destroy(); await store.close(); process.disconnect();
})().catch(error => { process.send?.({ kind: "error", code: error.code, message: error.message }); process.exitCode = 1; process.disconnect?.(); });
