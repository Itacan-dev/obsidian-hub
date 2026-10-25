"use strict";
const L = require("../domain/native-task-location");
const ownerKey = owner => JSON.stringify([owner.type, owner.id]);
const workspaceRef = value => value.contextKind === "resource" ? { type: "resource", id: value.resourceType ?? value.id } : { type: "project", id: value.projectId };
const providers = new WeakMap();
const sameRef = (a, b) => a === null && b === null || !!a && !!b && a.type === b.type && a.id === b.id;
function createNativeTaskLocations(plugin) {
    if (providers.has(plugin)) return providers.get(plugin);
    const vault = plugin.app.vault, wizard = plugin.projectWizard;
    let epoch = 0;
    const indexes = new Map(), stops = [];
    for (const event of ["create", "delete", "rename"]) if (vault.on) { const ref = vault.on(event, () => { epoch++; }); stops.push(() => vault.offref(ref)); }
    if (plugin.app.metadataCache?.on) { const cache = plugin.app.metadataCache, ref = cache.on("changed", file => { if (cache.getFileCache(file)?.frontmatter?.type === "project" || cache.getFileCache(file)?.frontmatter?.type === "resource" || [...indexes.values()].some(i => i.workspace.path === file.path)) epoch++; }); stops.push(() => cache.offref(ref)); }
    plugin.register?.(() => { stops.forEach(stop => stop()); indexes.clear(); providers.delete(plugin); });
    let workspaceEpoch = -1, workspaceRecords = [];
    const workspaces = (fresh = false) => {
        if (fresh || workspaceEpoch !== epoch) { workspaceRecords = [...wizard.getProjectRecords(), ...wizard.getResourceTypes()].map(w => ({ ...w, owner: workspaceRef(w) })); workspaceEpoch = epoch; }
        return workspaceRecords;
    };
    function workspace(owner, fresh = false) {
        const all = workspaces(fresh), matches = all.filter(w => L.sameOwner(w.owner, owner));
        if (matches.length !== 1) throw Error("Workspace is unavailable or ambiguous.");
        return { ...matches[0], physicalOwners: all };
    }
    const typeOf = file => Array.isArray(file?.children) ? "folder" : file?.extension === "md" ? "note" : null;
    function physical(w, path) {
        L.relativePath(w.root, path);
        const file = vault.getAbstractFileByPath(path), type = typeOf(file);
        const owners = w.physicalOwners.filter(candidate => path === candidate.root || path.startsWith(candidate.root + "/")).sort((a, b) => b.root.length - a.root.length);
        if (!type || !owners.length || owners.length > 1 && owners[0].root === owners[1].root || !L.sameOwner(owners[0].owner, w.owner)) throw Error("Location is unavailable or belongs to another workspace.");
        return { file, type };
    }
    function entry(w, path) {
        const { file, type } = physical(w, path);
        return { path, type, name: file.name ?? path.split("/").at(-1), reference: L.locationReference(w.owner, w.root, path, type) };
    }
    function legacyReference(w, path, type) {
        if (w.owner.type !== "resource") return null;
        const hash = require("../../../../../ItacanTaskCore/writer/policy").hash;
        return { type, id: "resource-location:" + hash([w.owner, type, path]) };
    }
    function index(owner, fresh = false) {
        const key = ownerKey(owner), previous = indexes.get(key);
        if (!fresh && previous?.epoch === epoch) return previous;
        const w = workspace(owner, fresh), root = vault.getAbstractFileByPath(w.root), refs = [], byId = new Map(), stack = [...(root?.children ?? [])];
        if (!root || !Array.isArray(root.children)) throw Error("Workspace root is unavailable.");
        const rootLegacy = legacyReference(w, w.root, "folder");
        if (rootLegacy) { refs.push(rootLegacy); byId.set(rootLegacy.id, entry(w, w.root)); }
        while (stack.length) {
            const file = stack.pop(); if (!typeOf(file)) continue;
            let item; try { item = entry(w, file.path); } catch (_) { continue; }
            refs.push(item.reference); byId.set(item.reference.id, item);
            const legacy = legacyReference(w, item.path, item.type);
            if (legacy) { refs.push(legacy); byId.set(legacy.id, item); }
            if (item.type === "folder") stack.push(...file.children);
        }
        const value = { epoch, workspace: w, refs: refs.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)), byId };
        indexes.set(key, value); return value;
    }
    // Admission always captures the current indexed physical tree. Only
    // presentation lookup reuses the event-invalidated reference index.
    function catalog(owner) { return index(owner, true).refs.map(ref => ({ ...ref })); }
    function resolve(owner, reference) {
        const current = index(owner), w = current.workspace;
        if (reference === null) return entry(w, w.root);
        const item = current.byId.get(reference?.id);
        return item && item.type === reference.type ? { ...item, reference: { ...reference } } : null;
    }
    function describe(owner, reference) {
        try { const current = index(owner), w = current.workspace, item = resolve(owner, reference);
            return { workspaceName: w.name ?? w.label ?? (owner.type === "resource" ? "Resource" : "Project"), available: !!item,
                segments: item ? L.relativePath(w.root, item.path).split("/").filter(Boolean) : [] };
        } catch (_) { return { workspaceName: indexes.get(ownerKey(owner))?.workspace.name ?? (owner.type === "resource" ? "Resource" : "Project"), segments: [], available: false }; }
    }
    const provider = { workspace, describe, resolve, catalog,
        resolveId(owner, id) { try { const item = index(owner).byId.get(id); return item ? { ...item, reference: { type: item.type, id } } : null; } catch (_) { return null; } },
        workspaces: () => { const status = plugin.nativeTaskHost?.status(), states = status?.owners ?? (status ? [status] : []);
            return workspaces().map(w => ({ owner: w.owner, name: w.name ?? w.label, root: w.root,
                available: !!plugin.nativeTaskHost?.matches(w.owner) && states.some(s => L.sameOwner(s.owner, w.owner) && s.state === "ready") })); },
        browse(owner, path) {
            const w = workspace(owner), current = entry(w, path ?? w.root);
            if (current.type !== "folder") throw Error("Folder is unavailable.");
            const rows = (vault.getAbstractFileByPath(current.path).children ?? []).flatMap(file => {
                try { return typeOf(file) ? [entry(w, file.path)] : []; } catch (_) { return []; }
            }).sort((a, b) => (a.type === b.type ? 0 : a.type === "folder" ? -1 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true }));
            return { workspace: w, current, rows };
        },
        select(owner, path, type) { const w = workspace(owner), selected = entry(w, path); if (selected.type !== type) throw Error("Location changed. Choose it again."); return { owner: w.owner, reference: selected.reference, path: selected.path, type, display: describe(owner, selected.reference) }; }
    };
    providers.set(plugin, provider); return provider;
}
function locationService(service, plugin, owner) {
    const locations = createNativeTaskLocations(plugin), services = new Map(), key = ownerKey;
    services.set(key(owner), service);
    let creationOwner = null;
    const choose = target => {
        if (!plugin.nativeTaskHost?.matches(target)) throw Error("Native workspace is unavailable. Markdown fallback is disabled.");
        if (!services.has(key(target))) services.set(key(target), plugin.nativeTaskHost.runtime(target).formService(plugin.app));
        return services.get(key(target));
    };
    return { ...service, nativeLocations: locations, nativeOwner: owner,
        formContext: snapshot => ({ ...service.formContext(snapshot), nativeOwner: owner }),
        async create(destination, text, values) {
            const target = values.nativeOwner ?? owner;
            if (creationOwner && !L.sameOwner(creationOwner, target)) throw Error("Keep the original creation request until reviewed.");
            const selected = choose(target); creationOwner = { ...target };
            return selected.create(selected.formContext(values).destination, text, values);
        },
        save(snapshot, values) {
            if (!L.sameOwner(values.nativeOwner ?? owner, owner)) return Promise.reject(Error("Moving an existing task between workspaces is unavailable. Its identity is preserved."));
            return service.save(snapshot, values);
        }
    };
}
function nativeCreationOwner(plugin, options = {}) {
    const explicit = options.location ?? options.path ?? options.root;
    const context = explicit != null ? plugin.taskEditor.context(explicit) : plugin.taskEditor.currentContext();
    let owner = options.owner ?? (context ? workspaceRef(context) : null);
    // Match Add's existing Home default, without entering a Markdown editor.
    if (!owner && explicit == null) owner = { type: "resource", id: "references" };
    return owner && plugin.nativeTaskHost?.matches(owner) ? owner : null;
}
module.exports = { createNativeTaskLocations, locationService, workspaceRef, nativeCreationOwner };
