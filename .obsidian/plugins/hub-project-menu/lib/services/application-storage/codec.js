"use strict";
// Private transactional application envelope; never imported from native task code.
const { createHash } = require("crypto");
const FORMAT = "itacan-application-transactions", CAPABILITY = "scoped-application-transactions-v1";
const EXCLUDED = ["categories", "projectPlanning", "taskMetadata", "headerImagePlacements"];
const KNOWN = ["activityLog","completedTaskChecks","completedTaskHistory","dailyBriefSnapshot","dailyFocus","dirtyContexts","folderUi","homeCoverImages","hubAuditArchive","inbox","inboxSort","lastDailyBriefAutoShownDay","music","oathsByDevice","pendingFocus","projectCardOrder","projectWorkLogs","projectWorkRatings","reportFocusByDate","resourceFolders","resourceWorkLogs","resourceWorkRatings","spotifyConnect","workRatings","workspaceMigration","workspaceMode"];
function fail(code) { const e = Error(code); e.code = code; throw e; }
function check(ok, code = "APPLICATION_CONTRACT") { if (!ok) fail(code); }
const plain = v => v !== null && typeof v === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function portable(v, depth = 0) {
    check(depth <= 64);
    if (v === null || ["string", "boolean"].includes(typeof v)) return;
    if (typeof v === "number") { check(Number.isFinite(v)); return; }
    check(Array.isArray(v) || plain(v));
    if (Array.isArray(v)) { check(Object.keys(v).length === v.length && Reflect.ownKeys(v).length === v.length + 1); for (const item of v) portable(item, depth + 1); }
    else { check(Reflect.ownKeys(v).length === Object.keys(v).length); for (const k of Object.keys(v)) { check(!["__proto__", "constructor", "prototype"].includes(k)); const d = Object.getOwnPropertyDescriptor(v, k); check(!d.get && !d.set); portable(v[k], depth + 1); } }
}
function canonical(v) { portable(v); const sort = x => Array.isArray(x) ? x.map(sort) : plain(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sort(x[k])])) : x; return JSON.stringify(sort(v)); }
const copy = v => JSON.parse(canonical(v)), hash = v => createHash("sha256").update(canonical(v)).digest("hex");
function fields(v, keys, required = keys) { check(plain(v) && Object.keys(v).every(k => keys.includes(k)) && required.every(k => Object.hasOwn(v, k))); }
function text(v) { check(typeof v === "string" && v.length > 0 && v.length <= 512 && v === v.trim() && !/[\u0000-\u001f]/.test(v)); }
function uuid(v) { check(typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)); }
function digest(v) { check(typeof v === "string" && /^[0-9a-f]{64}$/.test(v)); }
function revision(v) { check(Number.isSafeInteger(v) && v >= 0); }
const fact = (data, field) => Object.hasOwn(data, field) ? { present: true, digest: hash(data[field]) } : { present: false, digest: null };
const same = (x, y) => canonical(x) === canonical(y);
function scopes(values) {
    check(Array.isArray(values) && values.length > 0); const seen = new Set();
    for (const s of values) { fields(s, ["field", "dependencies"]); check(KNOWN.includes(s.field) && !seen.has(s.field)); seen.add(s.field); check(Array.isArray(s.dependencies) && new Set(s.dependencies).size === s.dependencies.length && s.dependencies.every(k => KNOWN.includes(k) && k !== s.field)); }
}
function replacement(field, value) {
    if (["activityLog","completedTaskChecks","completedTaskHistory"].includes(field)) check(Array.isArray(value));
    else if (["inboxSort","lastDailyBriefAutoShownDay"].includes(field)) check(typeof value === "string");
    else check(plain(value) || field === "pendingFocus" && value === null);
}
function expected(v) { fields(v, ["present", "digest"]); check(typeof v.present === "boolean"); if (v.present) digest(v.digest); else check(v.digest === null); }
function request(input) {
    portable(input); fields(input, ["version","authorityId","applicationContextId","operationId","reason","participant","observation","changes","dependencies"]);
    check(input.version === 1); uuid(input.authorityId); text(input.applicationContextId); text(input.operationId); text(input.reason);
    check(["local-private","shared-project-data"].includes(input.participant));
    fields(input.observation, ["revision","snapshotDigest","ownerEpoch"]); revision(input.observation.revision); digest(input.observation.snapshotDigest); uuid(input.observation.ownerEpoch);
    check(Array.isArray(input.changes) && input.changes.length > 0 && Array.isArray(input.dependencies)); const names = new Set();
    for (const c of input.changes) { fields(c, ["field","expected","operation","value"], ["field","expected","operation"]); check(KNOWN.includes(c.field) && !names.has(c.field)); names.add(c.field); expected(c.expected); check(["replace","delete"].includes(c.operation)); check(Object.hasOwn(c,"value") === (c.operation === "replace")); if(c.operation === "replace") replacement(c.field,c.value); }
    const deps = new Set(); for (const d of input.dependencies) { fields(d, ["field","expected"]); check(KNOWN.includes(d.field) && !deps.has(d.field) && !names.has(d.field)); deps.add(d.field); expected(d.expected); }
    return copy(input);
}
function seal(body) { const b = copy(body); return { ...b, checksum: hash(b) }; }
function envelope(e, config) {
    portable(e); fields(e, ["format","version","capabilities","hubState","authorityId","applicationContextId","revision","allowedScopes","initialSnapshotDigest","data","receipts","checksum"]);
    check(e.format === FORMAT && e.version === 1 && same(e.capabilities,[CAPABILITY]), "UNSUPPORTED_FORMAT");
    fields(e.hubState,["schemaVersion"]); check(e.hubState.schemaVersion === 2, "UNSUPPORTED_FORMAT");
    uuid(e.authorityId); text(e.applicationContextId); check(e.authorityId === config.authorityId, "AUTHORITY_MISMATCH"); check(e.applicationContextId === config.applicationContextId, "CONTEXT_MISMATCH"); revision(e.revision); scopes(e.allowedScopes); digest(e.initialSnapshotDigest); check(plain(e.data) && Array.isArray(e.receipts));
    const {checksum,...body} = e; digest(checksum); check(hash(body) === checksum,"INTEGRITY"); check(e.receipts.length === e.revision,"INTEGRITY");
    let previous = null, snapshot = e.initialSnapshotDigest; const ids = new Set(), snapshots = [snapshot], latestFacts = new Map();
    for (let i = 0; i < e.receipts.length; i++) {
        const r=e.receipts[i]; fields(r,["request","requestDigest","revision","previousSnapshotDigest","selected","result","previousReceiptDigest","digest"]);
        const q=request(r.request); check(q.participant === "local-private" && q.authorityId === e.authorityId && q.applicationContextId === e.applicationContextId,"INTEGRITY");
        digest(r.requestDigest); check(hash(q)===r.requestDigest && !ids.has(q.operationId),"INTEGRITY"); ids.add(q.operationId);
        check(r.revision===i+1 && r.previousSnapshotDigest===snapshot && r.previousReceiptDigest===previous,"INTEGRITY");
        check(q.observation.revision <= i && snapshots[q.observation.revision] === q.observation.snapshotDigest,"INTEGRITY");
        check(Array.isArray(r.selected) && r.selected.length===q.changes.length,"INTEGRITY");
        for(let j=0;j<r.selected.length;j++) {const f=r.selected[j],c=q.changes[j];fields(f,["field","before","after"]);expected(f.before);expected(f.after);check(f.field===c.field && same(f.before,c.expected) && same(f.after,c.operation==="delete"?{present:false,digest:null}:{present:true,digest:hash(c.value)}),"INTEGRITY");}
        for(const f of r.selected){if(latestFacts.has(f.field))check(same(latestFacts.get(f.field),f.before),"INTEGRITY");latestFacts.set(f.field,f.after);}
        for(const d of q.dependencies)if(latestFacts.has(d.field))check(same(latestFacts.get(d.field),d.expected),"INTEGRITY");
        const allowed=new Map(e.allowedScopes.map(s=>[s.field,s]));check(q.changes.every(c=>allowed.has(c.field)),"INTEGRITY");
        const guards=new Set([...q.changes,...q.dependencies].map(c=>c.field));check(q.changes.every(c=>allowed.get(c.field).dependencies.every(k=>guards.has(k))),"INTEGRITY");
        fields(r.result,["version","authorityId","applicationContextId","operationId","revision","snapshotDigest","selected"]);
        check(r.result.version===1 && r.result.authorityId===e.authorityId && r.result.applicationContextId===e.applicationContextId && r.result.operationId===q.operationId && r.result.revision===r.revision && same(r.result.selected,r.selected),"INTEGRITY");digest(r.result.snapshotDigest);
        const {digest:rd,...rb}=r; check(hash(rb)===rd,"INTEGRITY");previous=rd;snapshot=r.result.snapshotDigest;snapshots.push(snapshot);
    }
    for(const [field,expected] of latestFacts)check(same(fact(e.data,field),expected),"INTEGRITY");
    check(snapshot===hash(e.data),"INTEGRITY"); return copy(e);
}
module.exports = { FORMAT,CAPABILITY,EXCLUDED,KNOWN,fail,check,plain,portable,canonical,copy,hash,fields,text,uuid,digest,revision,fact,same,scopes,request,seal,envelope };
