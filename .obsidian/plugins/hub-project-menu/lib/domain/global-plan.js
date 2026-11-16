"use strict";
const { randomUUID } = require("node:crypto");
const clone = value => JSON.parse(JSON.stringify(value));
const emptyPlan = () => ({ version:1, revision:0, entries:[], note:"", legacyReview:"pending", fileOperationCursor:null });
function normalize(value) {
    if (!value) return emptyPlan();
    if (value.version !== 1) throw Error("This plan requires a newer version of Itacan.");
    if (!Array.isArray(value.entries) || typeof value.note !== "string" || !Number.isInteger(value.revision)) throw Error("The saved plan is invalid. Its data has been preserved.");
    const ids = new Set(), keys = new Set();
    for (const entry of value.entries) {
        const key = identity(entry);
        if (!entry.id || ids.has(entry.id) || keys.has(key)) throw Error("The saved plan contains duplicate entries.");
        ids.add(entry.id); keys.add(key);
    }
    return { ...emptyPlan(), ...clone(value) };
}
function identity(entry) {
    const r=entry.reference;
    if(entry.kind==="task" && r?.authorityId && r.taskId) return JSON.stringify(["task",r.authorityId,r.taskId]);
    if(entry.kind==="file" && typeof r?.path==="string" && r.path && !r.path.startsWith("/") && !r.path.includes("\\") && !r.path.split("/").some(p=>p===".."||p===".")) return JSON.stringify(["file",r.path]);
    if(entry.kind==="workspace" && ["project","resource"].includes(r?.type) && r.id) return JSON.stringify(["workspace",r.type,r.id]);
    throw Error("Invalid plan reference.");
}
const entryFor = (kind,reference,values={}) => ({id:randomUUID(),kind,reference:clone(reference),...values});
const refOf = w => w.contextKind === "resource" ? {type:"resource",id:w.resourceType??w.id} : {type:"project",id:w.projectId};
module.exports={clone,emptyPlan,normalize,identity,entryFor,refOf};
