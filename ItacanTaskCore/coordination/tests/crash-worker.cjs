"use strict";
// Child-only interception delegates actual writes/flush/rename and actual services.
const S = require("./support.cjs"), H = require("./legacy-harness.cjs"), input = JSON.parse(S.sync.readFileSync(process.argv[2], "utf8"));
let app, service, native = null, command = null, armed = false;
async function pause(stage) {
    const lock = native ? await S.fs.readFile(S.path.join(native.directory, "WRITER.lock"), "utf8") : null;
    await S.fs.writeFile(input.signal, JSON.stringify({ stage, pid: process.pid, host: S.os.hostname(), lock, native: native ? { directory: native.directory, authorityId: native.options.storeId, command } : null }));
    await new Promise(() => { setInterval(() => {}, 1000); });
}
(async () => {
    await S.guarded(input.directory);
    if (input.mode.startsWith("oath-")) {
        if (input.mode === "oath-enrollment") {
            const f = H.O.legacy().fixture(); app = await S.application(null, { directory: input.directory }); app.store.deviceId = f.oath.deviceId; f.plugin.dataStore = app.store; await app.store.save(f.wizard.data); service = { f };
        } else service = await H.oath(null, { directory: input.directory });
        app ??= service.app;
        service.f.oath.fullscreen.exit = async () => S.fs.writeFile(S.path.join(input.directory, "release.json"), "true");
        if (input.mode === "oath-fulfillment") { H.checked(service.f); await service.f.oath.resolveWork(); }
    } else if (input.mode === "native-inbox") {
        const i = await H.inbox(null, { directory: input.directory }); app = i.app; service = { ...i, capture: await i.service.capture({ text: "Original retained Inbox draft" }) };
        const A = require("../../atomic-task/tests/runtime-support.cjs"), directory = S.path.join(input.directory, "native"); await S.fs.mkdir(directory);
        const options = { directory, storageFormat: "private-v4", taskMutationVersion: 1, storeId: A.id(), partitions: A.owners, idFactory: A.id, clock: () => A.NOW, externalReservations: A.inventory, fault: async stage => { if (armed && stage === input.stage) await pause(stage); } };
        const repo = await A.J.createJsonRepository(options); native = { repo, directory, options }; command = A.rich({ repo, options }, { id: A.id(), initial: { completed: true, completedAt: null } });
        await S.fs.writeFile(S.path.join(input.directory, "native-request.json"), JSON.stringify({ options: { storeId: options.storeId, partitions: options.partitions, externalReservations: options.externalReservations }, command }));
    } else app = await S.application(null, { directory: input.directory, shared: ["shared", "rollback"].includes(input.mode) });
    await S.fs.copyFile(app.file, S.path.join(input.directory, "before-data.json"));
    if (["shared", "rollback"].includes(input.mode)) await S.fs.copyFile(app.sharedFile, S.path.join(input.directory, "before-shared.json"));
    const rename = S.fs.rename.bind(S.fs), open = S.fs.open.bind(S.fs); let localRenames = 0;
    S.fs.open = async (...args) => { const handle = await open(...args); if (String(args[0]).endsWith(".tmp")) { const flush = handle.sync.bind(handle); handle.sync = async () => { if (armed && input.stage === "before-flush") await pause(input.stage); await flush(); if (armed && input.stage === "after-flush") await pause(input.stage); }; } return handle; };
    S.fs.rename = async (from, to) => {
        if (to === app.file) {
            localRenames++;
            const before = localRenames === 2 && input.mode === "rollback" ? "before-rollback" : "before-local-rename";
            const after = localRenames === 2 && input.mode === "rollback" ? "after-rollback" : "after-local-rename";
            if (armed && input.stage === before) await pause(input.stage); await rename(from, to); if (armed && input.stage === after) await pause(input.stage); return;
        }
        if (to === app.sharedFile) { if (input.mode === "rollback") throw Error("Injected shared failure before actual rollback"); if (armed && input.stage === "before-shared-rename") await pause(input.stage); await rename(from, to); if (armed && input.stage === "after-shared-rename") await pause(input.stage); return; }
        return rename(from, to);
    };
    armed = true;
    if (input.mode === "oath-enrollment") { const f = service.f, first = f.oath.workspaceTasks({ type: "project", id: "private" })[0]; await f.oath.take(f.draft([first])); }
    else if (input.mode === "oath-fulfillment") await service.f.oath.markFulfilled();
    else if (input.mode === "oath-terminal") await service.f.oath.end(service.f.oath.current.id, "broken");
    else if (input.mode === "native-inbox") { await native.repo.execute(command); if (input.stage === "after-native-return") await pause(input.stage); await service.service.finish(service.capture); }
    else await app.store.save({ ...app.data, marker: "new", ...(["shared", "rollback"].includes(input.mode) ? { projectPlanning: { itacan: { version: 1, revision: 1, phases: [], milestones: [] } } } : {}) });
    if (input.stage === "after-caller-return") await pause(input.stage);
    throw Error("Requested stage was not reached");
})().catch(e => { process.stderr.write(e.stack); process.exitCode = 1; });
