"use strict";
const fs = require("node:fs"), { randomUUID } = require("node:crypto");
const { openJsonRepository, createJsonRepository } = require("../src/json-repository");
const [directory, stage, requestFile] = process.argv.slice(2), request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
(async () => {
    let draw = request.idSeed ?? 1000000;
    const options = { directory, storageFormat: "private-v4", expectedAuthorityId: request.authorityId, storeId: request.authorityId, partitions: request.partitions,
        idFactory: request.idSeed === undefined ? randomUUID : () => "10000000-0000-4000-8000-" + (++draw).toString(16).padStart(12, "0"), clock: () => request.clock,
        externalReservations: request.observation.externalInventory, historyImportEvidence: { version: 1, mode: "closed-synthetic", read: () => request.observation },
        resolvers: { location: r => { const owner = request.observation.capture.registry.find(x => "folder-" + (x.owner.type === "project" ? x.owner.id : { study: "knowledge", literature: "research", references: "explorations", inspiration: "inspiration" }[x.owner.id]) === r.id)?.owner; return owner ? { ...r, owner } : null; } },
        fault: async at => { if (at === stage) { if (request.interruptMode === "parent-kill") { process.send({ stage: at, pid: process.pid }); await new Promise(() => {}); } else process.exit(73); } } };
    const repo = await (request.creating ? createJsonRepository(options) : openJsonRepository(options));
    if (request.command !== "OPEN") await repo.execute(request.command);
    await repo.close(); process.stderr.write("Requested interruption stage was not reached\n"); process.exitCode = 2;
})().catch(e => { process.stderr.write(e.stack); process.exitCode = 1; });
