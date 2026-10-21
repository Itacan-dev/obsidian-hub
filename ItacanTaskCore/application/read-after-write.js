"use strict";
const V = require("../src/value"), { freeze } = require("../src/snapshot-read"), { same } = require("./intents");
const D = require("../src/domain");
const fields = ["id", "revision", "partitionId", "owner", "location", "title", "description", "completed", "completedAt", "importance", "start", "due", "phase", "archivedAt", "deletedAt"];
const stepFields = ["id", "taskId", "parentStepId", "order", "title", "completed", "completedAt", "createdAt", "modifiedAt"];
function taskView(t) { D.workspace(t.owner); D.location(t.location); D.phase(t.phase, t.owner); D.dateEndpoint(t.start); D.dateEndpoint(t.due); D.validateSteps(t.steps, t.id); return { kind: "native-task-snapshot", ...Object.fromEntries(fields.map(k => [k, V.clone(t[k])])), steps: t.steps.map(s => Object.fromEntries(stepFields.map(k => [k, V.clone(s[k])])) ) }; }
function createReadAfterWrite(host, authority) {
    let generation = 0, disposed = false, stop = null; const controllers = new Set();
    return Object.freeze({
        async capture(intent, result) {
            if (disposed) return freeze({ state: "unavailable", code: "ADAPTER_DISPOSED" });
            try { if (!stop) stop = host.subscribe(() => { generation++; }); } catch (_) { return freeze({ state: "unavailable", code: "READ_SUBSCRIPTION_UNAVAILABLE" }); }
            const accepted = ++generation, controller = new AbortController(); controllers.add(controller);
            try {
                const head = { authorityId: authority.authorityId, repositoryRevision: result.receipt.repositoryRevision, revisionId: result.receipt.revisionId };
                const ids = [...new Set([...(intent.action.target ? [intent.action.target.taskId] : []), ...result.tasks.map(t => t.id), ...(result.recurrence?.successorId ? [result.recurrence.successorId] : [])])];
                const selected = ids.map(id => ({ taskId: id, owner: intent.owner, partitionId: result.tasks.find(t => t.id === id)?.partitionId ?? intent.guard.partitions[0].id }));
                const r = await host.read({ version: 1, authorityId: authority.authorityId, ownerContextPin: intent.guard.ownerContextPin, owners: [intent.owner], selection: "targets", targets: selected, cut: head }, controller.signal);
                if (disposed || accepted !== generation) return freeze({ state: "superseded", code: "READ_SUPERSEDED" });
                if (r.status !== "ok") return freeze({ state: "unavailable", code: "COHERENT_READ_UNAVAILABLE" });
                const s = r.snapshot;
                if (!s || s.authorityId !== authority.authorityId || s.readiness.state !== "ready" || s.recovery.state !== "intact" || s.cutEvidence?.state !== "verified-current-lineage" || !same(s.cutEvidence.cut, head) || !same(r.stamp.head, s.head) || r.stamp.ownerContextPin !== intent.guard.ownerContextPin || r.stamp.identityPin !== intent.guard.identityPin || s.head.repositoryRevision < head.repositoryRevision || s.head.repositoryRevision === head.repositoryRevision && s.head.revisionId !== head.revisionId || s.targets.length !== selected.length) throw Error("Unaccepted capture");
                const dispositions = ["resolved", "missing", "deleted", "owner-mismatch", "quarantined", "pending-native-publication", "retired-step", "kind-mismatch", "missing-step"];
                const targets = s.targets.map((t, i) => {
                    if (t.index !== i || t.taskId !== selected[i].taskId || !dispositions.includes(t.disposition) || t.task && (t.task.id !== t.taskId || !same(t.task.owner, intent.owner) || t.task.partitionId !== selected[i].partitionId)) throw Error("Unaccepted target");
                    return { index: i, taskId: t.taskId, disposition: t.disposition, task: t.task ? taskView(t.task) : null, preparation: null };
                });
                const stamp = { version: 1, hostEpoch: r.stamp.hostEpoch, readGeneration: r.stamp.readGeneration, ownerContextPin: r.stamp.ownerContextPin, identityPin: r.stamp.identityPin, head: { authorityId: s.head.authorityId, repositoryRevision: s.head.repositoryRevision, revisionId: s.head.revisionId } };
                return freeze({ state: "current", stamp, targets, navigation: targets.map(t => ({ taskId: t.taskId, target: t.disposition === "resolved" ? { kind: "native-task", id: t.taskId } : null })) });
            } catch (_) { return freeze({ state: "unavailable", code: "COHERENT_READ_UNAVAILABLE" }); }
            finally { controllers.delete(controller); }
        },
        dispose() { if (disposed) return; disposed = true; generation++; for (const c of controllers) c.abort(); controllers.clear(); try { stop?.(); } catch (_) {} stop = null; }
    });
}
module.exports = Object.freeze({ createReadAfterWrite });
