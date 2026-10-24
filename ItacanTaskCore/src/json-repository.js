"use strict";
const { randomUUID, createHash } = require("node:crypto");
const { NodeDirectory } = require("./node-directory");
const { RepositoryError, check, fail } = require("./errors");
const { canonical, clone, fields, uuid, revision } = require("./value");
const { validateState } = require("./domain");
const { initialState, TaskRepository } = require("./repository");
const digest = text => createHash("sha256").update(text, "utf8").digest("hex");
const privateCodec = require("./private-storage-codec");
const Admission = require("./command-admission");

function descriptor(value) {
    fields(value, ["file", "sha256", "revision", "revisionId", "parentRevisionId"], ["file", "sha256", "revision", "revisionId", "parentRevisionId"]);
    revision(value.revision); uuid(value.revisionId); if (value.parentRevisionId !== null) uuid(value.parentRevisionId);
    check(value.file === `gen-${value.revision}-${value.revisionId}.json`, "Invalid generation filename.");
    check(typeof value.sha256 === "string" && /^[0-9a-f]{64}$/.test(value.sha256), "Invalid generation checksum.");
    check((value.revision === 0) === (value.parentRevisionId === null), "Invalid descriptor ancestry.");
}
function encodeManifest(payload) { return canonical({ payload, sha256: digest(canonical(payload)) }) + "\n"; }
function decodeManifest(raw) {
    let wrapper; try { wrapper = JSON.parse(raw); } catch (_) { fail("INTEGRITY", "Manifest is not valid JSON."); }
    fields(wrapper, ["payload", "sha256"], ["payload", "sha256"]);
    check(digest(canonical(wrapper.payload)) === wrapper.sha256, "Manifest checksum mismatch.");
    const m = wrapper.payload;
    if (m?.schemaVersion === 4 && m.ancestry?.format === "itacan-private-lineage") {
        const decoded = privateCodec.decodePrivateManifest(raw, m.storeId);
        return { ...decoded.manifest, requiredCapabilities: decoded.barrier.requiredCapabilities, importRecoveryScope: decoded.barrier.importRecoveryScope };
    }
    if (![1, 2, 3, 4].includes(m.schemaVersion)) fail("UNSUPPORTED_SCHEMA", "Unsupported manifest schema; refusing downgrade recovery.");
    const keys = ["format", "schemaVersion", "storeId", "retention", "current", "ancestry", ...(m.schemaVersion === 4 ? ["requiredCapabilities", "importRecoveryScope"] : [])];
    fields(m, keys, keys);
    if (m.schemaVersion === 4) {
        if (canonical(m.requiredCapabilities ?? null) !== canonical(["private-history-import-v1"]) || !m.importRecoveryScope) fail("UNSUPPORTED_SCHEMA", "Missing/unknown mandatory import manifest capability.");
        require("./history-import").validateScope(m.importRecoveryScope);
    }
    check(m.format === "itacan-task-manifest", "Invalid manifest format."); uuid(m.storeId);
    check(Number.isInteger(m.retention) && m.retention >= 2 && m.retention <= 32, "Invalid retention bound.");
    check(Array.isArray(m.ancestry) && m.ancestry.length < m.retention, "Invalid manifest ancestry.");
    const chain = [m.current, ...m.ancestry]; chain.forEach(descriptor);
    for (let i = 1; i < chain.length; i++) check(chain[i - 1].revision === chain[i].revision + 1 && chain[i - 1].parentRevisionId === chain[i].revisionId, "Broken committed ancestry.");
    return m;
}
function io(error, message) {
    if (error instanceof RepositoryError) return error;
    return new RepositoryError("IO_ERROR", message, { systemCode: error.code ?? null, cause: String(error.message ?? error) });
}
function recoverable(error) {
    if (error.code === "UNSUPPORTED_SCHEMA") throw error;
    if (error.code && !["ENOENT", "INTEGRITY", "VALIDATION"].includes(error.code)) throw io(error, "Cannot read repository evidence.");
}
class JsonGenerationStorage {
    #admission; #taskMutationVersion; #atomicRecoveryKnown; #gitSharedVersion; #gitVerification;
    constructor(port, options) {
        this.#admission = Admission.repositoryGate(this, Admission.storageGate(port, options.commandAdmission));
        this.port = port; this.options = options; this.retention = options.retention ?? 4;
        check(Number.isInteger(this.retention) && this.retention >= 2 && this.retention <= 32, "Retain between 2 and 32 generations.");
        this.currentRaw = null; this.manifest = null; this.recovery = null; this.warnings = []; this.preservePrimary = false;
        this.recurrenceFence = null;
        this.importRecoveryScope = null; this.highestSchema = 1;
        this.private = options.storageFormat === "private-v4";
        check(options.storageFormat === undefined || ["legacy", "private-v4"].includes(options.storageFormat), "Explicit supported storage format required.");
        this.authorityId = options.expectedAuthorityId ?? options.storeId;
        check(options.taskMutationVersion === undefined || this.private && options.taskMutationVersion === 1, "Atomic task capability requires explicit private creation.");
        this.#gitSharedVersion = options.gitSharedVersion; this.#taskMutationVersion = options.taskMutationVersion; this.#atomicRecoveryKnown = false;
    }
    gitSharedCapability() { return this.#gitSharedVersion === 2; }
    atomicTaskCapability() { return this.#taskMutationVersion === 1; }
    atomicTaskRecoveryKnown() { if (this.atomicTaskCapability() && (this.recurrenceFence || this.recovery)) this.#atomicRecoveryKnown = true; return this.atomicTaskCapability() && this.#atomicRecoveryKnown; }
    storageInfo() { return this.private ? { format: "private-v4", wireVersion: 4, authorityId: this.authorityId, minimumLogicalSchemaVersion: this.highestSchema, fenced: !!this.recurrenceFence, ...(this.atomicTaskCapability() ? { taskMutationVersion: 1 } : {}), ...(this.gitSharedCapability() ? { gitSharedVersion: 2 } : {}) } : null; }
    adoptBarrier(b) { this.highestSchema = Math.max(this.highestSchema, b.minimumLogicalSchemaVersion); if (b.version >= 2) this.#taskMutationVersion = 1; if (b.version === 3) this.#gitSharedVersion = 2; this.importRecoveryScope = require("./history-import").mergeScope(this.importRecoveryScope, b.importRecoveryScope); }
    barrierFor(state = null) { return privateCodec.makeBarrier(this.authorityId, Math.max(this.highestSchema, state?.schemaVersion ?? 1), require("./history-import").mergeScope(this.importRecoveryScope, state ? require("./history-import").scopeOf(state) : null), this.#taskMutationVersion, this.#gitSharedVersion); }
    parseStoredManifest(raw) {
        if (this.private) {
            let w; try { w = JSON.parse(raw); } catch (_) { fail("INTEGRITY", "Invalid private pointer JSON."); }
            if ([1, 2, 3].includes(w.payload?.schemaVersion) || w.payload?.schemaVersion === 4 && w.payload.ancestry?.format !== "itacan-private-lineage") fail("STORAGE_PROFILE_MISMATCH", "Private opening cannot substitute a legacy/flat authority.");
            try { const v = privateCodec.decodePrivateManifest(raw, this.authorityId); this.adoptBarrier(v.barrier); return v.manifest; }
            catch (error) { if (w.sha256 === digest(canonical(w.payload)) && w.payload?.ancestry?.barrier?.minimumLogicalSchemaVersion === 4 && error.code !== "UNSUPPORTED_SCHEMA") this.unprovenScope = true; throw error; }
        }
        const m = decodeManifest(raw);
        if (m.schemaVersion === 4) fail("STORAGE_PROFILE_REQUIRED", "Stopped flat schema-4 repositories are forensic-read-only; every write is prohibited.");
        this.rememberBarrier(m); return m;
    }
    encodeStoredManifest(m, barrier = null) { return this.private ? privateCodec.encodePrivateManifest(m, barrier ?? this.barrierFor()) : encodeManifest(m); }
    assertScopeEstablished() {
        if (this.private && (this.unprovenScope || this.recurrenceFence && !this.importRecoveryScope && (this.highestSchema === 4 || ["invalid-recovery-fence", "unreadable-recovery-fence"].includes(this.recurrenceFence.reason)))) fail("RECOVERY_REQUIRED", "Import identity scope cannot be established; no writer authority is exposed.");
    }
    async assertAllWritable(state, { allowRecoveredRead = false } = {}) {
        if (!this.private && (state.schemaVersion === 4 || this.highestSchema === 4 || this.importRecoveryScope)) fail("STORAGE_PROFILE_REQUIRED", "All writes to stopped flat schema-4 state are prohibited.");
        if (this.private) {
            // Reconstructed storage handles must observe the persisted capability;
            // caller-supplied cached manifest/properties cannot disable the fence.
            const headers = [];
            for (const name of ["CURRENT.json", "RECOVERY.json"]) {
                const raw = await this.readOptional(name); if (raw === null) continue;
                let parsed; try { parsed = JSON.parse(raw); } catch (_) { continue; }
                const b = parsed.payload?.ancestry?.barrier;
                if (b?.version >= 2 || b?.requiredCapabilities?.includes("atomic-task-mutations-v1")) { const verified = privateCodec.decodePrivateManifest(raw, this.authorityId); this.adoptBarrier(verified.barrier); headers.push(verified.barrier); }
                else if (this.atomicTaskCapability() && parsed.payload?.ancestry?.format === "itacan-private-lineage") headers.push(privateCodec.decodePrivateManifest(raw, this.authorityId).barrier);
            }
            if (this.atomicTaskCapability() && headers.length && !headers.some(b => b.version >= 2)) fail("UNSUPPORTED_SCHEMA", "An existing root cannot acquire atomic task capability through publication.");
            if (this.manifest) await this.readRecurrenceFence(this.manifest.storeId);
            if (this.atomicTaskCapability() && (this.recurrenceFence || this.recovery)) this.#atomicRecoveryKnown = true;
            if (!allowRecoveredRead && this.atomicTaskCapability() && this.#atomicRecoveryKnown) fail("ATOMIC_TASK_RECOVERY_FENCED", "Every mutation and mutation replay is blocked after known atomic-root recovery.");
        }
        this.assertScopeEstablished();
    }
    async assertLegacyEvidence() {
        if (this.private) return;
        for (const name of await this.port.list()) if (name === "CURRENT.json" || name === "RECOVERY.json" || /^evidence-current-[a-f0-9-]+\.json$/.test(name) || /^gen-\d+-[a-f0-9-]+\.json$/.test(name)) {
            const raw = await this.port.read(name); let value; try { value = JSON.parse(raw); } catch (_) { continue; }
            if (value.payload?.schemaVersion === 4) {
                decodeManifest(raw); // Preserve terminal unsupported-contract classification.
                fail("STORAGE_PROFILE_REQUIRED", "Schema-4 pointer evidence makes this legacy root forensic-read-only.");
            }
            if (value.schemaVersion === 4) {
                if (value.receipts?.format !== "itacan-private-state") validateState(value);
                fail("STORAGE_PROFILE_REQUIRED", "Schema-4 generation evidence prohibits every legacy write, including ancestor fallback.");
            }
        }
    }
    async readOptional(file) { try { return await this.port.read(file); } catch (error) { if (error.code === "ENOENT") return null; throw error; } }
    async verify(ref, storeId, remember = false) {
        const raw = await this.port.read(ref.file);
        if (digest(raw) !== ref.sha256) fail("INTEGRITY", "Generation checksum mismatch.", { file: ref.file });
        // Reuse proof only for identical, previously fully validated Git bytes.
        // Physical reads/checksums, descriptor identity, lease, pointer and fence
        // checks remain live. No caller can populate this private cache; every
        // returned state is detached and private/Resource roots never use it.
        const prior=this.#gitVerification;
        if(this.private&&prior&&prior.authorityId===this.authorityId&&prior.storeId===storeId&&prior.descriptor===canonical(ref)&&prior.raw===raw){if(remember)this.adoptBarrier(prior.barrier);return clone(prior.state);}
        let state;
        if (this.private) { const v = privateCodec.decodePrivateGeneration(raw, this.authorityId); if (this.atomicTaskCapability() && v.barrier.version < 2) fail("UNSUPPORTED_SCHEMA", "Atomic authority cannot select a pre-capability generation."); if (this.gitSharedCapability() && v.barrier.version !== 3) fail("UNSUPPORTED_SCHEMA", "Git authority cannot select a pre-provenance generation."); state = v.state; if (remember) this.adoptBarrier(v.barrier); }
        else { try { state = JSON.parse(raw); } catch (_) { fail("INTEGRITY", "Generation is not valid JSON."); } }
        validateState(state);
        if (state.gitShared) await require("./git-shared").validateState(state);
        if (!this.private && state.schemaVersion === 4) fail("STORAGE_PROFILE_REQUIRED", "Flat schema-4 generations cannot grant legacy writer authority.");
        check(state.storeId === storeId && state.revision === ref.revision && state.revisionId === ref.revisionId && state.parentRevisionId === ref.parentRevisionId, "Generation identity differs from manifest.");
        if(this.private&&state.gitShared&&raw.length<=16*1024*1024)this.#gitVerification={authorityId:this.authorityId,storeId,descriptor:canonical(ref),raw,state:clone(state),barrier:this.barrierFor(state)};
        return state;
    }
    async select(manifest, failures) {
        const chain = [manifest.current, ...manifest.ancestry];
        for (let index = 0; index < chain.length; index++) {
            try {
                const state = await this.verify(chain[index], manifest.storeId, true);
                return { state, manifest: { ...manifest, current: chain[index], ancestry: chain.slice(index + 1) }, index };
            } catch (error) { recoverable(error); failures.push({ file: chain[index].file, reason: error.code ?? "INTEGRITY" }); }
        }
        return null;
    }
    async recover(raw) {
        if (this.private) return this.recoverPrivate(raw);
        await this.assertLegacyEvidence();
        const failures = []; let primary = null, backup = null, chosen = null;
        if (raw !== null) {
            try { primary = this.parseStoredManifest(raw); chosen = await this.select(primary, failures); }
            catch (error) { recoverable(error); failures.push({ file: "CURRENT.json", reason: error.code ?? "INTEGRITY" }); }
        }
        if (!chosen) {
            const previousRaw = await this.readOptional("RECOVERY.json");
            if (previousRaw !== null) {
                try { backup = this.parseStoredManifest(previousRaw); chosen = await this.select(backup, failures); }
                catch (error) { recoverable(error); failures.push({ file: "RECOVERY.json", reason: error.code ?? "INTEGRITY" }); }
            }
        }
        if (!chosen) fail("RECOVERY_REQUIRED", "No verified committed generation is recoverable. Preserve this directory and restore a verified backup.", { failures });
        this.currentRaw = raw; this.manifest = chosen.manifest; this.retention = chosen.manifest.retention;
        if (backup || chosen.index > 0 || raw === null) {
            this.recovery = { recoveredRevision: chosen.state.revision, recoveredRevisionId: chosen.state.revisionId, failures,
                source: backup ? "RECOVERY.json" : "CURRENT.json ancestry", requestedRevision: primary?.current.revision ?? null };
            this.preservePrimary = raw !== null;
            // Persist before returning any recovered ancestor, including task-only
            // ancestors that may predate acknowledged recurrence state.
            await this.ensureRecurrenceFence(chosen.state.storeId);
        }
        await this.readRecurrenceFence(chosen.state.storeId);
        await this.assertAllWritable(chosen.state);
        return chosen.state;
    }
    async recoverPrivate(raw) {
        const failures = [], pointers = [];
        for (const [name, value] of [["CURRENT.json", raw], ["RECOVERY.json", await this.readOptional("RECOVERY.json")]]) {
            if (value === null) continue;
            try { pointers.push({ name, manifest: this.parseStoredManifest(value) }); }
            catch (error) { recoverable(error); failures.push({ file: name, reason: error.code ?? "INTEGRITY" }); }
        }
        const referenced = new Set(pointers.flatMap(p => [p.manifest.current, ...p.manifest.ancestry].map(d => d.file)));
        // A damaged committed generation may outlive the retention window.
        // Only a checksummed, authority-matched saved CURRENT manifest can
        // prove that it is retained historical evidence. It is never selected.
        for (const name of await this.port.list()) if (/^evidence-current-[a-f0-9-]+\.json$/.test(name)) {
            try {
                const saved = privateCodec.decodePrivateManifest(await this.port.read(name), this.authorityId);
                this.adoptBarrier(saved.barrier);
                for (const d of [saved.manifest.current, ...saved.manifest.ancestry]) referenced.add(d.file);
            } catch (error) { recoverable(error); /* Unverified evidence grants no exemption or authority. */ }
        }
        for (const file of await this.port.list()) if (/^gen-\d+-[a-f0-9-]+\.json$/.test(file)) {
            let w; try { w = JSON.parse(await this.port.read(file)); } catch (error) { if (referenced.has(file)) continue; fail("STORAGE_PROFILE_MISMATCH", "Unrecognized generation in private root."); }
            if (w.schemaVersion !== 4) { if ([1, 2, 3].includes(w.schemaVersion)) fail("STORAGE_PROFILE_MISMATCH", "Mixed-format private root."); fail("UNSUPPORTED_SCHEMA", "Unknown generation wire version."); }
            if (w.receipts?.format !== "itacan-private-state") fail("STORAGE_PROFILE_MISMATCH", "Flat generation in private root.");
            if (w.storeId !== this.authorityId) fail("STORAGE_AUTHORITY_MISMATCH", "Foreign generation in private root.");
        }
        let chosen = null, source = null;
        for (const p of pointers) { chosen = await this.select(p.manifest, failures); if (chosen) { source = p.name; break; } }
        if (!chosen) fail("RECOVERY_REQUIRED", "No verified private authority can be opened.", { failures });
        this.currentRaw = raw; this.manifest = chosen.manifest; this.retention = chosen.manifest.retention;
        const lostImport = this.highestSchema === 4 && !chosen.state.historyImport;
        if (source !== "CURRENT.json" || chosen.index > 0 || failures.length || lostImport) {
            if (!this.importRecoveryScope && (lostImport || failures.length)) fail("RECOVERY_REQUIRED", "Recovery cannot prove import identity scope; authority remains closed.");
            this.recovery = { recoveredRevision: chosen.state.revision, recoveredRevisionId: chosen.state.revisionId, failures, source: source === "CURRENT.json" ? "CURRENT.json ancestry" : "RECOVERY.json", requestedRevision: pointers.find(p => p.name === "CURRENT.json")?.manifest.current.revision ?? null };
            this.preservePrimary = raw !== null; await this.ensureRecurrenceFence(chosen.state.storeId);
        }
        await this.readRecurrenceFence(chosen.state.storeId); this.assertScopeEstablished();
        await this.mirrorRecoveryBarrier(); return chosen.state;
    }
    async mirrorRecoveryBarrier() {
        if (!this.private || this.highestSchema !== 4 && !this.atomicTaskCapability()) return;
        let saved = null; const raw = await this.readOptional("RECOVERY.json");
        if (raw !== null) { try { saved = this.parseStoredManifest(raw); } catch (error) { recoverable(error); } }
        this.assertScopeEstablished();
        const mirror = saved ?? this.manifest, encoded = this.encodeStoredManifest(mirror);
        if (encoded !== raw) { await this.options.fault?.("private:beforeRecoveryBarrierMirror"); await this.atomicManifest("RECOVERY.json", encoded); await this.options.fault?.("private:afterRecoveryBarrierMirror"); }
    }
    async readRecurrenceFence(storeId) {
        const raw = await this.readOptional("RECURRENCE-FENCE.json");
        if (raw === null) return; // A previously observed fence is never cleared in memory.
        let wrapper;
        try { wrapper = JSON.parse(raw); } catch (_) { this.recurrenceFence = { reason: "unreadable-recovery-fence", storeId }; return; }
        if (wrapper.payload?.version === 2) {
            const p = wrapper.payload;
            if (p.format !== "itacan-recurrence-recovery-fence" || p.minimumSchemaVersion !== 4 || canonical(p.requiredCapabilities ?? null) !== canonical(["private-history-import-v1"])) fail("UNSUPPORTED_SCHEMA", "Unsupported scoped recovery fence contract.");
            if (p.storeId !== storeId || wrapper.sha256 !== digest(canonical(p))) { this.recurrenceFence = { reason: "invalid-recovery-fence", storeId }; return; }
            try { require("./history-import").validateScope(p.importScope); } catch (error) { if (error.code === "UNSUPPORTED_SCHEMA") throw error; this.recurrenceFence = { reason: "invalid-recovery-fence", storeId }; return; }
            this.importRecoveryScope = require("./history-import").mergeScope(this.importRecoveryScope, p.importScope); this.highestSchema = Math.max(this.highestSchema, 4); this.recurrenceFence = clone(p); return;
        }
        if (wrapper.payload?.version !== 1 && wrapper.payload?.version !== undefined) fail("UNSUPPORTED_SCHEMA", "Unsupported recurrence recovery fence version.");
        const p = wrapper.payload;
        if (!p || p.format !== "itacan-recurrence-recovery-fence" || p.version !== 1 || p.storeId !== storeId || wrapper.sha256 !== digest(canonical(p))) {
            this.recurrenceFence = { reason: "invalid-recovery-fence", storeId }; return;
        }
        this.recurrenceFence = clone(p);
    }
    async ensureRecurrenceFence(storeId) {
        const existing = await this.readOptional("RECURRENCE-FENCE.json");
        if (existing !== null) { await this.readRecurrenceFence(storeId); return; }
        const payload = { format: "itacan-recurrence-recovery-fence", version: this.importRecoveryScope ? 2 : 1, storeId, reason: "verified-ancestor-fallback", recovery: clone(this.recovery),
            ...(this.importRecoveryScope ? { minimumSchemaVersion: 4, requiredCapabilities: ["private-history-import-v1"], importScope: clone(this.importRecoveryScope) } : {}) };
        const raw = canonical({ payload, sha256: digest(canonical(payload)) }) + "\n";
        await this.options.fault?.("beforeRecurrenceFenceWrite");
        await this.port.writeNew("RECURRENCE-FENCE.json", raw, stage => this.options.fault?.("fence:" + stage));
        check(await this.port.read("RECURRENCE-FENCE.json") === raw, "Persistent recurrence fence write verification failed.");
        await this.port.syncDirectory(); this.recurrenceFence = payload;
        await this.options.fault?.("afterRecurrenceFenceWrite");
    }
    async assertRecurrenceWritable() {
        await this.port.assertWriter(); await this.readRecurrenceFence(this.manifest.storeId);
        if (this.recurrenceFence) fail("RECURRENCE_RECOVERY_FENCED", "Recurrence writes blocked; no B1 fence-clear operation exists.", { fence: clone(this.recurrenceFence) });
    }
    rememberBarrier(manifest) {
        this.highestSchema = Math.max(this.highestSchema, manifest.schemaVersion);
        if (manifest.importRecoveryScope) this.importRecoveryScope = require("./history-import").mergeScope(this.importRecoveryScope, manifest.importRecoveryScope);
    }
    async assertHistoryImportWritable(command, state) {
        await this.port.assertWriter(); await this.readRecurrenceFence(this.manifest.storeId);
        await this.assertAllWritable(state);
        if (!this.private && require("./history-import").isImport(command.type)) fail("STORAGE_PROFILE_REQUIRED", "JSON imports require an explicitly created private-v4 authority.");
        require("./history-import").assertWritable(command, state, this.recurrenceFence, require("./history-import").mergeScope(this.importRecoveryScope, require("./history-import").scopeOf(state)));
    }
    async load() {
        this.#admission = Admission.storageGate(this.port, this.#admission);
        await this.port.assertWriter();
        await this.assertLegacyEvidence();
        await this.readRecurrenceFence(this.manifest.storeId);
        const raw = await this.readOptional("CURRENT.json");
        if (raw !== this.currentRaw) fail("REPOSITORY_CONFLICT", "Current manifest changed outside the writer.");
        // Revalidate the committed generation before every command. A damaged
        // live instance fails closed; ancestry recovery happens only at open.
        const state = await this.verify(this.manifest.current, this.manifest.storeId, true); await this.assertAllWritable(state, { allowRecoveredRead: true }); await this.mirrorRecoveryBarrier(); return state;
    }
    async atomicManifest(name, raw, publication) {
        const temporary = `manifest-${name}-${randomUUID()}.tmp`;
        await this.port.writeNew(temporary, raw);
        check(await this.port.read(temporary) === raw, "Manifest write verification failed.");
        if (publication) await publication();
        await this.port.replace(temporary, name);
    }
    async beginReadObservation() {
        await this.port.assertWriter();
        const current = await this.readOptional("CURRENT.json"), recovery = await this.readOptional("RECOVERY.json"), fence = await this.readOptional("RECURRENCE-FENCE.json");
        if (current !== this.currentRaw) fail("REPOSITORY_CONFLICT", "Current evidence changed during snapshot.");
        if (this.readEvidence && recovery !== this.readEvidence.recovery) fail("REPOSITORY_CONFLICT", "Recovery evidence changed outside publication; explicit reopening required.");
        const priorBarrier = canonical(this.private ? this.barrierFor() : { schemaVersion: this.highestSchema });
        // Parse readable headers to preserve terminal capability/authority rejection.
        // Known corrupt pointers selected at open remain diagnostics under a fence.
        for (const raw of [current, recovery]) if (raw !== null) {
            try { const manifest = this.parseStoredManifest(raw); if (this.private && manifest.current.revision > this.manifest.current.revision && !this.recurrenceFence) fail("REPOSITORY_CONFLICT", "Newer pointer evidence requires explicit reopening."); }
            catch (error) { if (!this.recurrenceFence || !["INTEGRITY", "VALIDATION"].includes(error.code)) throw error; }
        }
        await this.readRecurrenceFence(this.manifest.storeId); this.assertScopeEstablished();
        const barrier = canonical(this.private ? this.barrierFor() : { schemaVersion: this.highestSchema });
        if (barrier !== priorBarrier && !this.recurrenceFence) fail("REPOSITORY_CONFLICT", "Stronger barrier requires explicit reopening.");
        return { current, recovery, fence, barrier };
    }
    async rememberReadEvidence() { this.readEvidence = { recovery: await this.readOptional("RECOVERY.json") }; }
    async assertReadObservation(observation) {
        await this.port.assertWriter();
        const latest = await this.beginReadObservation();
        if (canonical(latest) !== canonical(observation)) fail("SNAPSHOT_UNSTABLE", "Storage evidence changed during snapshot.");
        // Detect in-place generation damage too; no ancestry selection occurs here.
        await this.verify(this.manifest.current, this.manifest.storeId);
        await this.port.assertWriter();
    }
    async commit(state, expectedRevisionId, intent) {
        let committed = false, publicationAttempted = false, preparedManifest = null, preparedRaw = null;
        const prior = this.manifest, priorRaw = this.currentRaw;
        try {
            this.#admission = Admission.storageGate(this.port, this.#admission);
            await Admission.publication(this.#admission, intent, state, this.manifest === null);
            await this.port.assertWriter();
            await this.assertLegacyEvidence();
            await this.assertAllWritable(state);
            if (!this.atomicTaskCapability() && state.receipts.some(r => Object.hasOwn(r.result, "atomicTask"))) fail("ATOMIC_TASK_CAPABILITY_REQUIRED", "Atomic effects require capability enabled at creation.");
            if (await this.readOptional("CURRENT.json") !== priorRaw || (prior?.current.revisionId ?? null) !== expectedRevisionId) fail("REPOSITORY_CONFLICT", "Manifest changed before commit.");
            check(prior ? state.storeId === prior.storeId && state.revision === prior.current.revision + 1 && state.parentRevisionId === prior.current.revisionId :
                state.revision === 0 && state.parentRevisionId === null, "Candidate does not extend this store's committed generation.");
            await this.options.fault?.("beforeSerialize"); validateState(state);
            const candidateBarrier = this.private ? this.barrierFor(state) : null;
            await this.options.fault?.("private:beforeGenerationEncoding");
            const raw = this.private ? privateCodec.encodePrivateGeneration(state, candidateBarrier) : canonical(state) + "\n", file = `gen-${state.revision}-${state.revisionId}.json`;
            const next = { file, sha256: digest(raw), revision: state.revision, revisionId: state.revisionId, parentRevisionId: state.parentRevisionId };
            const temporary = `candidate-${randomUUID()}.tmp`;
            await this.options.fault?.("beforeTemporaryWrite");
            await this.port.writeNew(temporary, raw, stage => this.options.fault?.(stage));
            await this.options.fault?.("beforeGenerationVerify");
            if (digest(await this.port.read(temporary)) !== next.sha256) fail("INTEGRITY", "Written candidate checksum mismatch.");
            await this.port.publish(temporary, file); await this.verify(next, state.storeId);
            await this.options.fault?.("afterGenerationPublish");
            // Never downgrade the manifest's capability barrier after recovery
            // selects a schema-1 ancestor of a schema-2 store.
            const schemaVersion = this.private ? 4 : Math.max(state.schemaVersion, prior?.schemaVersion ?? 1, this.highestSchema, this.recurrenceFence ? 2 : 1);
            const importScope = require("./history-import").mergeScope(this.importRecoveryScope, require("./history-import").scopeOf(state));
            const manifest = { format: "itacan-task-manifest", schemaVersion, storeId: state.storeId, retention: this.retention,
                current: next, ancestry: prior ? [prior.current, ...prior.ancestry].slice(0, this.retention - 1) : [],
                ...(!this.private && schemaVersion === 4 ? { requiredCapabilities: ["private-history-import-v1"], importRecoveryScope: importScope } : {}) };
            const encoded = this.encodeStoredManifest(manifest, candidateBarrier); decodeManifest(encoded);
            preparedManifest = manifest; preparedRaw = encoded;
            let oldRecovery = null;
            try { const saved = await this.readOptional("RECOVERY.json"); if (saved) oldRecovery = this.parseStoredManifest(saved); }
            catch (error) { if (error.code === "UNSUPPORTED_SCHEMA") throw error; this.warnings.push("An older recovery manifest is damaged; preserved its generations."); }
            if (this.preservePrimary && priorRaw !== null) {
                await this.port.writeNew(`evidence-current-${randomUUID()}.json`, priorRaw); this.preservePrimary = false;
            }
            if (prior) await this.atomicManifest("RECOVERY.json", this.encodeStoredManifest(prior));
            await this.options.fault?.("beforeManifestReplace");
            if (intent) {
                await this.assertHistoryImportWritable(intent.command, intent.priorState);
                if (intent.command.type.startsWith("recurrence.") || ["task.complete", "task.save"].includes(intent.command.type) && intent.priorState.recurrence?.memberships.some(o => o.taskId === intent.command.taskId)) await this.assertRecurrenceWritable();
            }
            await this.port.assertWriter();
            if (await this.readOptional("CURRENT.json") !== priorRaw) fail("REPOSITORY_CONFLICT", "Manifest changed during commit.");
            await this.atomicManifest("CURRENT.json", encoded, async () => {
                await this.assertAllWritable(state);
                if (this.#admission && this.recurrenceFence) fail("RECOVERY_REQUIRED", "Writer publication requires intact ready state.");
                await Admission.publication(this.#admission, intent, state, prior === null);
                if (intent) { await this.assertHistoryImportWritable(intent.command, intent.priorState);
                    if (intent.command.type.startsWith("recurrence.") || ["task.complete", "task.save"].includes(intent.command.type) && intent.priorState.recurrence?.memberships.some(o => o.taskId === intent.command.taskId)) await this.assertRecurrenceWritable(); }
                await this.port.assertWriter();
                if (await this.readOptional("CURRENT.json") !== priorRaw) fail("REPOSITORY_CONFLICT", "Manifest changed at publication boundary.");
                if (this.#admission && this.recurrenceFence) fail("RECOVERY_REQUIRED", "Observed recovery fence blocks writer publication.");
                publicationAttempted = true;
            });
            committed = true; this.currentRaw = encoded; this.manifest = manifest; if (this.private) this.adoptBarrier(candidateBarrier); else this.rememberBarrier(manifest);
            const directorySynced = await this.port.syncDirectory();
            if (!directorySynced && !this.warnings.includes("Directory fsync unavailable.")) this.warnings.push("Directory fsync unavailable.");
            await this.mirrorRecoveryBarrier();
            await this.rememberReadEvidence();
            await this.options.fault?.("afterManifestCommit");
            await this.prune(oldRecovery, manifest, prior);
        } catch (error) {
            // A storage port/OS acknowledgment may fail after replacement. If
            // our exact verified manifest is visible, this is a committed retry,
            // never a pre-commit rollback or an invitation to recreate the task.
            if (!committed && preparedRaw !== null) {
                try {
                    if (await this.readOptional("CURRENT.json") === preparedRaw) {
                        await this.verify(preparedManifest.current, state.storeId);
                        committed = true; this.currentRaw = preparedRaw; this.manifest = preparedManifest;
                        if (this.private) this.adoptBarrier(privateCodec.decodePrivateManifest(preparedRaw, this.authorityId).barrier); else this.rememberBarrier(preparedManifest);
                    }
                } catch (_) { /* Preserve evidence and the original failure. */ }
            }
            if (committed) throw new RepositoryError("ACKNOWLEDGEMENT_LOST", "Generation committed; retry the identical operation to retrieve its receipt.", { committed: true, cause: String(error.message ?? error) });
            if (publicationAttempted && this.#admission) throw new RepositoryError("PUBLICATION_UNCERTAIN", "Publication outcome requires authoritative reconciliation and identical replay.");
            throw io(error, "Native task commit failed before publication.");
        }
    }
    async prune(oldRecovery, current, recovery) {
        if (!oldRecovery || oldRecovery.storeId !== current.storeId) return;
        const retained = new Set([current, recovery].filter(Boolean).flatMap(m => [m.current, ...m.ancestry].map(d => d.file)));
        for (const ref of [oldRecovery.current, ...oldRecovery.ancestry]) if (!retained.has(ref.file)) {
            try {
                // Delete only exact, verified, previously committed files from
                // our recorded ancestry; unfamiliar candidates are evidence.
                await this.verify(ref, current.storeId); await this.port.remove(ref.file);
            } catch (error) { this.warnings.push(`Retained old generation ${ref.file}: ${error.code ?? "IO_ERROR"}`); }
        }
    }
    async close() { this.#gitVerification=null; await this.port.release(); }
}
async function openRepository(options, creating) {
    check(options && typeof options === "object", "Repository options are required.");
    check(options.taskMutationVersion === undefined || creating && options.storageFormat === "private-v4" && options.taskMutationVersion === 1, "Atomic capability is a private creation-only option; opening never upgrades.");
    check(options.gitSharedVersion === undefined || creating && options.gitSharedVersion === 2 && options.taskMutationVersion === 1 && options.storageFormat === "private-v4", "Git capability is explicit creation-only.");
    check(options.sharedGenesis === undefined || creating && options.gitSharedVersion === 2, "Shared genesis is Git creation-only.");
    if (options.gitSharedVersion === 2) { uuid(options.sharedReplicaId); check(options.externalReservations, "Shared inventory required."); }
    // Even an injected port must be paired with an explicit directory.
    const defaultPort = new NodeDirectory(options.directory), port = options.storagePort ?? defaultPort;
    if (creating && options.taskMutationVersion === 1) {
        // Closed Temp fixtures remain supported. Outside Temp, require the
        // exact physical port enrolled by validated device-private admission;
        // no caller-supplied boolean or lookalike port can authorize creation.
        // Both paths check before lease/identity allocation and again under lock.
        const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
        const entry = await fs.lstat(options.directory), root = await fs.realpath(options.directory), temporary = await fs.realpath(os.tmpdir()), relative = path.relative(temporary, root);
        const temporaryChild = !!relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
        if (!entry.isDirectory() || entry.isSymbolicLink() || root.startsWith("\\\\")) fail("ATOMIC_TASK_DISPOSABLE_REQUIRED", "Atomic creation requires an ordinary admitted directory.");
        if (!temporaryChild && !await require("../host/authority").assertPrivateAtomicCreation(port, options)) fail("ATOMIC_TASK_DISPOSABLE_REQUIRED", "Atomic creation requires Temp isolation or validated device-private admission.");
        if ((await fs.readdir(root)).length) fail("ALREADY_EXISTS", "Atomic creation requires a verified empty directory.");
    }
    const settings = { ...options, idFactory: options.idFactory ?? randomUUID };
    check(typeof settings.idFactory === "function", "UUID factory must be a function.");
    if (settings.storageFormat === "private-v4") {
        uuid(creating ? settings.storeId : settings.expectedAuthorityId);
        if (creating && settings.expectedAuthorityId !== undefined && settings.expectedAuthorityId !== settings.storeId) fail("STORAGE_AUTHORITY_MISMATCH", "Creation authority arguments disagree.");
        // A custom port cannot turn a missing or non-directory private path
        // into an implicitly created authority.
        try { await defaultPort.list(); } catch (error) { if (error.code === "ENOENT") fail("RECOVERY_REQUIRED", "Private directory is missing; creation is a separate operation."); throw error; }
        if (options.storagePort && !creating) {
            const physical = (await defaultPort.list()).filter(n => n !== "WRITER.lock").sort(), injected = (await port.list()).filter(n => n !== "WRITER.lock").sort();
            if (canonical(physical) !== canonical(injected)) fail("STORAGE_AUTHORITY_MISMATCH", "Injected storage cannot substitute another physical root.");
            for (const name of physical) if (await defaultPort.read(name) !== await port.read(name)) fail("STORAGE_AUTHORITY_MISMATCH", "Injected evidence differs from the explicitly selected root.");
        }
    }
    const storage = new JsonGenerationStorage(port, settings);
    try { await port.list(); }
    catch (error) {
        if (!creating && error.code === "ENOENT") fail("RECOVERY_REQUIRED", "Expected storage directory is missing; no store was initialized.");
        throw io(error, "Storage directory must already exist.");
    }
    await port.acquire();
    try {
        let state;
        if (creating) {
            const names = await port.list();
            if (names.some(name => name !== "WRITER.lock")) fail("ALREADY_EXISTS", "Creation requires an explicitly supplied empty directory. Existing evidence is never overwritten.");
            if (settings.storageFormat === "private-v4" && (await defaultPort.list()).some(name => name !== "WRITER.lock")) fail("ALREADY_EXISTS", "Private creation requires a verified empty physical directory.");
            state = initialState(settings.partitions, settings.storeId ?? settings.idFactory(), settings.idFactory, settings.gitSharedVersion, settings.sharedGenesis);
            await storage.commit(state, null);
        } else state = await storage.recover(await storage.readOptional("CURRENT.json"));
        await storage.rememberReadEvidence();
        return new TaskRepository(storage, state, settings);
    } catch (error) { await storage.close(); throw io(error, "Cannot open native task repository."); }
}
const createJsonRepository = options => openRepository(options, true);
const openJsonRepository = options => openRepository(options, false);
async function inspectJsonRepository(options) {
    check(options?.sourceFormat === "stopped-e2-flat-v1", "Explicit stopped-format forensic inspection required."); uuid(options.expectedAuthorityId);
    const port = new NodeDirectory(options.directory), result = { version: 1, authority: "forensic", writable: false, sourceFormat: options.sourceFormat, storeId: options.expectedAuthorityId, snapshot: null, diagnostics: [] };
    const names = await port.list(); if (names.includes("WRITER.lock")) fail("LOCK_HELD", "Forensic snapshot requires a closed source; locks are never removed.");
    try {
        const raw = await port.read("CURRENT.json"), w = JSON.parse(raw);
        if (w.payload?.ancestry?.format === "itacan-private-lineage") fail("STORAGE_PROFILE_MISMATCH", "This inspector accepts only preserved flat E2 evidence.");
        const m = decodeManifest(raw); if (m.schemaVersion !== 4) fail("STORAGE_PROFILE_MISMATCH", "Forensic E2 format requires schema 4.");
        if (m.storeId !== options.expectedAuthorityId) fail("STORAGE_AUTHORITY_MISMATCH", "Forensic authority differs from the reviewed source.");
        const generation = await port.read(m.current.file); check(digest(generation) === m.current.sha256, "Forensic generation checksum differs.");
        const state = JSON.parse(generation); validateState(state);
        check(state.schemaVersion === 4 && state.storeId === m.storeId && state.revisionId === m.current.revisionId && state.revision === m.current.revision && state.parentRevisionId === m.current.parentRevisionId, "Forensic generation identity mismatch.");
        check(await port.read("CURRENT.json") === raw && !(await port.list()).includes("WRITER.lock"), "Forensic observations changed.");
        result.snapshot = clone(state); result.manifestSha256 = digest(raw);
    } catch (error) {
        if (["UNSUPPORTED_SCHEMA", "STORAGE_PROFILE_MISMATCH", "STORAGE_AUTHORITY_MISMATCH"].includes(error.code)) throw error;
        result.diagnostics.push({ code: error.code ?? "INTEGRITY", message: String(error.message) });
    }
    return result;
}
module.exports = { createJsonRepository, openJsonRepository, inspectJsonRepository, JsonGenerationStorage, encodeManifest, decodeManifest, digest };
