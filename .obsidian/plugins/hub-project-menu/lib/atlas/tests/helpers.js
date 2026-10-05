"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");
const CONFIG = { accessTiming: { waitMs: 10, confirmationWindowMs: 60, grantDurationMs: 60 },
    vaultTiming: { waitMs: 30, confirmationWindowMs: 60 }, journeyLimits: { lifetimeMs: 300, maxHops: 3 } };
async function fixture(t, policy = { whitelist: ["trusted.test"], blacklist: ["blocked.test"] }) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-obsidian-test-"));
    let time = 1000, failRename = false, loseAck = false;
    const io = Object.create(fs);
    io.renameSync = (from, to) => {
        if (failRename) throw new Error("injected write failure");
        fs.renameSync(from, to);
        if (loseAck) throw new Error("injected acknowledgement loss");
    };
    const repository = new AtlasFileRepository(directory, { io, configuration: CONFIG });
    const runtime = createAtlasRuntime({ repository, clock: { now: () => time }, configuration: CONFIG });
    await runtime.open();
    await runtime.command({ kind: "INITIALIZE", policy, configuration: CONFIG });
    let requestId = 0, nativeId = 0;
    const effects = { blocks: [], opened: [], releases: [], cancelled: [], leases: [] };
    const attach = () => runtime.attach(++nativeId, { block: response => effects.blocks.push(response),
        lease: response => effects.leases.push(response), openHome: origin => effects.opened.push(origin) });
    const navigate = (context, url, facts = {}) => runtime.navigate(context,
        { requestId: `r${++requestId}`, loaderId: `l${requestId}`, method: "GET", url, ...facts },
        response => { effects.releases.push(response); }, () => effects.cancelled.push(url));
    const arrive = context => runtime.arrive(context, { url: context.flight.url, loaderId: context.flight.loaderId });
    const command = (context, kind) => runtime.command({ kind, contextId: context.id, generation: context.generation });
    t.after(() => {
        repository.close();
        const resolved = path.resolve(directory);
        if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("atlas-obsidian-test-")) throw new Error("Unexpected test cleanup path");
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    return { runtime, repository, directory, io, effects, attach, navigate, arrive, command,
        setTime: value => { time = value; }, advance: value => { time += value; },
        failWrites: value => { failRename = value; }, loseAcknowledgement: value => { loseAck = value; },
        snapshot: () => runtime.view().snapshot };
}
module.exports = { fixture, CONFIG };
