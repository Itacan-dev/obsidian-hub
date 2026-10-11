"use strict";

const fs = require("fs");
const path = require("path");
const { DEFAULT_CATEGORIES } = require("../config");

const SHARED_STATE_PATH = "System/Hub-shared-projects.json";
const SHARED_PROJECT_ROOTS = ["Projects/Itacan", "Projects/Obsidian Hub"];
const SHARED_IMAGE_ROOT = "Assets/ProjectCards/Shared";
const clone = value => JSON.parse(JSON.stringify(value));
const serialize = value => `${JSON.stringify(value, null, 2)}\n`;

function portablePath(value) {
    return typeof value === "string" && value.length > 0 &&
        !/^(?:[a-z]+:|[\\/])/i.test(value) && !value.includes("\\") &&
        !value.split("/").some(part => part === ".." || part === "." || !part);
}

// The boundary is explicit: never discover Projects outside the Git allowlist.
async function sharedOwnership(vaultRoot) {
    const projects = {}, taskIds = new Set();
    for (const root of SHARED_PROJECT_ROOTS) {
        const walk = async relative => {
            let entries;
            try { entries = await fs.promises.readdir(path.join(vaultRoot, relative), { withFileTypes: true }); }
            catch (error) { if (error.code === "ENOENT") return; throw error; }
            for (const entry of entries) {
                if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
                const file = `${relative}/${entry.name}`;
                if (entry.isDirectory()) await walk(file);
                else if (entry.isFile() && entry.name.endsWith(".md")) {
                    const text = await fs.promises.readFile(path.join(vaultRoot, file), "utf8");
                    for (const match of text.matchAll(/<!--\s*hub-task:([\w-]+)\s*-->/g)) taskIds.add(match[1]);
                    // Only the root dashboard defines a Project, not copied examples in Meta.
                    if (relative === root) {
                        const fm = text.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
                        const id = fm?.[1].match(/^projectId:\s*([\w-]+)\s*$/m)?.[1];
                        const categoryId = fm?.[1].match(/^category:\s*([\w-]+)\s*$/m)?.[1];
                        if (id) projects[id] = { root, categoryId: categoryId ?? null };
                    }
                }
            }
        };
        await walk(root);
    }
    return { projects, taskIds };
}

function ownsPlacement(key, projects) {
    const context = key.split("::")[0].replace(/^card:project:/, "");
    return Object.hasOwn(projects, context);
}

function selectShared(data, ownership) {
    const { projects, taskIds } = ownership;
    const categoryIds = new Set(Object.values(projects).map(project => project.categoryId).filter(Boolean));
    const categories = (data.categories ?? []).filter(category => categoryIds.has(category.id)).map(category => {
        // Share category behavior, not arbitrary legacy/plugin fields or personal Resource links.
        const result = {};
        if (!/^[\w-]+$/.test(category.id)) throw Error("Invalid shared category ID.");
        for (const key of ["id", "name", "kind", "custom", "image", "templateFolder", "shortcuts", "shortcutOrder"]) {
            if (category[key] !== undefined) result[key] = clone(category[key]);
        }
        for (const key of ["image", "templateFolder"]) {
            if (result[key] && !portablePath(result[key])) throw Error(`Shared category ${category.id} has a non-portable ${key}.`);
        }
        return result;
    });
    for (const id of categoryIds) {
        if (!categories.some(category => category.id === id)) throw Error(`Shared Project category ${id} is missing.`);
    }
    const select = (values, predicate) => Object.fromEntries(Object.entries(values ?? {}).filter(([key]) => predicate(key)));
    const headerImagePlacements = select(data.headerImagePlacements, key => ownsPlacement(key, projects));
    for (const key of Object.keys(headerImagePlacements)) {
        if (!portablePath(key.split("::").slice(1).join("::"))) throw Error("Shared image placement has a non-portable image path.");
    }
    return clone({
        schemaVersion: 1,
        projects,
        categories,
        projectPlanning: select(data.projectPlanning, id => Object.hasOwn(projects, id)),
        taskMetadata: select(data.taskMetadata, id => taskIds.has(id)),
        headerImagePlacements
    });
}

class SharedProjectStore {
    constructor(vaultRoot) {
        this.vaultRoot = vaultRoot;
        this.filePath = vaultRoot ? path.join(vaultRoot, SHARED_STATE_PATH) : null;
        this.lastText = null;
    }

    async readText() {
        if (!this.filePath) return null;
        try { return await fs.promises.readFile(this.filePath, "utf8"); }
        catch (error) { if (error.code === "ENOENT") return null; throw error; }
    }

    async load(data) {
        this.lastText = await this.readText();
        if (this.lastText === null) return data; // Existing installations without a shared manifest retain their store.
        const shared = JSON.parse(this.lastText);
        if (shared.schemaVersion !== 1 || !Array.isArray(shared.categories) ||
            ["projects", "projectPlanning", "taskMetadata", "headerImagePlacements"].some(key =>
                !shared[key] || typeof shared[key] !== "object" || Array.isArray(shared[key]))) {
            throw Error("Invalid shared Project state. Restore the Git file before loading Hub.");
        }
        const ownership = await sharedOwnership(this.vaultRoot);
        const projects = { ...shared.projects, ...ownership.projects };
        const categoryIds = new Set(shared.categories.map(category => category.id));
        data.categories = [...(data.categories ?? DEFAULT_CATEGORIES).filter(category => !categoryIds.has(category.id)), ...clone(shared.categories)];
        const mergeMap = (key, owned) => {
            data[key] = { ...Object.fromEntries(Object.entries(data[key] ?? {}).filter(([id]) => !owned(id))), ...clone(shared[key]) };
        };
        mergeMap("projectPlanning", id => Object.hasOwn(projects, id));
        mergeMap("taskMetadata", id => ownership.taskIds.has(id) || Object.hasOwn(shared.taskMetadata, id));
        mergeMap("headerImagePlacements", key => ownsPlacement(key, projects));
        return data;
    }

    async prepare(data) {
        if (this.lastText === null) return null;
        if (await this.readText() !== this.lastText) {
            const error = Error("Shared Project data changed on disk. Reload Obsidian after Git synchronization before saving.");
            error.code = "HUB_STATE_CONFLICT";
            throw error;
        }
        const ownership = await sharedOwnership(this.vaultRoot);
        const shared = selectShared(data, ownership);
        // A newly assigned custom category may have been created as personal.
        // Publish only its selected image, never the entire private upload folder.
        for (const category of shared.categories) {
            const template = category.templateFolder;
            const builtInTemplates = ["Physics Research", "Nonfiction Book", "Fiction Book"].map(name => `System/Project Templates/${name}`);
            if (template && !builtInTemplates.includes(template) && !template.startsWith("System/Project Templates/Shared/")) {
                if (!template.startsWith("System/Project Templates/")) throw Error("Shared template must be a vault Project template.");
                const target = `System/Project Templates/Shared/${category.id}`;
                await fs.promises.cp(path.join(this.vaultRoot, template), path.join(this.vaultRoot, target), {
                    recursive: true,
                    filter: async source => {
                        const info = await fs.promises.lstat(source);
                        const name = path.basename(source);
                        return !info.isSymbolicLink() && !name.startsWith(".") && name !== "node_modules" &&
                            (info.isDirectory() || /\.(md|png|jpe?g|webp|gif|svg)$/i.test(name));
                    }
                });
                category.templateFolder = target;
            }
            const original = category.image;
            if (!original?.startsWith("Assets/ProjectCards/Categories/")) continue;
            const target = `${SHARED_IMAGE_ROOT}/${path.posix.basename(original)}`;
            const bytes = await fs.promises.readFile(path.join(this.vaultRoot, original));
            await fs.promises.mkdir(path.join(this.vaultRoot, SHARED_IMAGE_ROOT), { recursive: true });
            let existing;
            try { existing = await fs.promises.readFile(path.join(this.vaultRoot, target)); }
            catch (error) { if (error.code !== "ENOENT") throw error; }
            if (!existing?.equals(bytes)) await fs.promises.writeFile(path.join(this.vaultRoot, target), bytes);
            category.image = target;
            shared.headerImagePlacements = Object.fromEntries(Object.entries(shared.headerImagePlacements).map(([key, value]) =>
                [key.endsWith(`::${original}`) ? `${key.slice(0, -original.length)}${target}` : key, value]));
        }
        const local = clone(data);
        const categoryIds = new Set(shared.categories.map(category => category.id));
        local.categories = (local.categories ?? []).filter(category => !categoryIds.has(category.id));
        for (const key of ["projectPlanning", "taskMetadata", "headerImagePlacements"]) {
            local[key] = Object.fromEntries(Object.entries(local[key] ?? {}).filter(([id]) => !Object.hasOwn(shared[key], id)));
        }
        // Empty/deleted planning or placement values are still owned by shared Projects.
        local.projectPlanning = Object.fromEntries(Object.entries(local.projectPlanning).filter(([id]) => !Object.hasOwn(ownership.projects, id)));
        local.headerImagePlacements = Object.fromEntries(Object.entries(local.headerImagePlacements).filter(([key]) => !ownsPlacement(key, ownership.projects)));
        local.taskMetadata = Object.fromEntries(Object.entries(local.taskMetadata).filter(([id]) => !ownership.taskIds.has(id)));
        return { local, shared, text: serialize(shared) };
    }
}

module.exports = { SHARED_STATE_PATH, SHARED_PROJECT_ROOTS, SHARED_IMAGE_ROOT, SharedProjectStore, sharedOwnership, selectShared, portablePath };
