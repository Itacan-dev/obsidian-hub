"use strict";
const isBlocked = button => button.disabled || button.getAttribute("aria-disabled") === "true";
const progressValue = progress => Number(progress.getAttribute('aria-valuenow'));
const progressMax = progress => Number(progress.getAttribute('aria-valuemax'));
const colorContext = document.createElement('canvas').getContext('2d');
function rgba(color) {
    colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = color; colorContext.fillRect(0, 0, 1, 1);
    return [...colorContext.getImageData(0, 0, 1, 1).data];
}
function contrast(first, second) {
    const luminance = color => rgba(color).slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const a = luminance(first), b = luminance(second); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
// Native modules against an isolated in-memory vault. No production data is used.
HTMLElement.prototype.createEl = function (tag, options = {}) {
    const element = document.createElement(tag);
    element.className = options.cls || "";
    if (options.text != null) element.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr || {})) element.setAttribute(key, value);
    if (options.type) element.type = options.type;
    this.append(element); return element;
};
HTMLElement.prototype.createDiv = function (options) { return this.createEl("div", options); };
HTMLElement.prototype.createSpan = function (options) { return this.createEl("span", options); };
HTMLElement.prototype.empty = function () { this.replaceChildren(); };
HTMLElement.prototype.addClass = function (...classes) { this.classList.add(...classes); };
HTMLElement.prototype.removeClass = function (...classes) { this.classList.remove(...classes); };
HTMLElement.prototype.toggleClass = function (name, force) { this.classList.toggle(name, force); };
HTMLElement.prototype.setText = function (text) { this.textContent = text; };

class Component {
    constructor() { this.cleanup = []; this.children = new Set(); }
    register(fn) { this.cleanup.push(fn); }
    registerEvent(ref) { this.register(() => ref.emitter.offref(ref)); }
    registerDomEvent(element, event, callback, options) { element.addEventListener(event, callback, options); this.register(() => element.removeEventListener(event, callback, options)); }
    addChild(child) { this.children.add(child); }
    removeChild(child) { child.unload(); this.children.delete(child); }
    load() { this.onload?.(); }
    unload() { this.cleanup.splice(0).forEach(fn => fn()); this.children.forEach(child => child.unload()); this.children.clear(); this.onunload?.(); }
}
class Emitter {
    constructor() { this.events = new Map(); }
    on(name, fn) { const ref = { emitter: this, name, fn }; if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(ref); return ref; }
    offref(ref) { this.events.get(ref.name)?.delete(ref); }
    emit(name, ...args) { for (const ref of this.events.get(name) || []) ref.fn(...args); }
}
class Modal {
    constructor(app) {
        this.app = app; this.previousFocus = document.activeElement;
        this.containerEl = document.body.createDiv({ cls: "modal-container" });
        this.modalEl = this.containerEl.createDiv({ cls: "modal", attr: { role: "dialog", "aria-modal": "true" } });
        this.titleEl = this.modalEl.createDiv({ cls: "modal-title" });
        this.closeButton = this.modalEl.createEl("button", { cls: "modal-close-button", text: "×", attr: { type: "button", "aria-label": "Close dialog" } });
        this.closeButton.onclick = () => this.close();
        this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
        this.scope = { register() {}, unregister() {} };
        this.key = event => {
            if (event.defaultPrevented || !this.containerEl.isConnected || document.querySelector(".modal-container:last-of-type") !== this.containerEl) return;
            if (event.key === "Escape") { event.preventDefault(); this.close(); }
            if (event.key === "Tab") {
                const controls = [...this.modalEl.querySelectorAll("button,input,select,textarea,[tabindex]")]
                    .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && !element.closest("[hidden]"));
                const current = controls.indexOf(document.activeElement);
                if (!controls.length) return;
                if (event.shiftKey && current <= 0) { event.preventDefault(); controls.at(-1).focus(); }
                else if (!event.shiftKey && (current === controls.length - 1 || current === -1)) { event.preventDefault(); controls[0].focus(); }
            }
        };
    }
    setTitle(title) { this.titleEl.textContent = title; this.modalEl.setAttribute("aria-label", title); }
    open() { window.lastModal = this; document.addEventListener("keydown", this.key); this.onOpen?.(); }
    close() {
        if (this._closed) return; this._closed = true;
        this.onClose?.(); this.containerEl.remove(); document.removeEventListener("keydown", this.key);
        if (this.previousFocus?.isConnected) this.previousFocus.focus();
    }
}
class FuzzySuggestModal extends Modal {
    onOpen() { for (const item of this.getItems()) this.contentEl.createEl("button", { text: this.getItemText(item) }).onclick = () => { this.onChooseItem(item); this.close(); }; }
}
// Native Menu lifecycle and keyboard routing, simulated only in this fixture.
class Menu {
    constructor() { this.items = []; this.hideHandlers = []; }
    addItem(build) {
        const item = { title: "", checked: false, action: null,
            setTitle(title) { this.title = title; return this; },
            setChecked(checked) { this.checked = checked; return this; },
            setDisabled(disabled) { this.disabled = disabled; return this; },
            setWarning(warning) { this.warning = warning; return this; },
            setIcon(icon) { this.icon = icon; return this; },
            onClick(action) { this.action = action; return this; } };
        build(item); this.items.push(item); return this;
    }
    addSeparator() { this.items.push({ separator: true }); return this; }
    onHide(callback) { this.hideHandlers.push(callback); return this; }
    showAtPosition({ x, y }) {
        window.lastMenu = this;
        this.element = document.body.createDiv({ cls: "menu hub-fixture-menu", attr: { role: "menu", "aria-label": "Sort items" } });
        this.items.forEach(item => {
            if (item.separator) { this.element.createDiv({ cls: "menu-separator", attr: { role: "separator" } }); return; }
            item.element = this.element.createEl("button", { cls: "menu-item" + (item.warning ? " is-warning" : ""),
                attr: { type: "button", role: "menuitemcheckbox", "aria-checked": String(item.checked) } });
            if (item.icon) obsidian.setIcon(item.element.createSpan({ cls: "menu-item-icon" }), item.icon);
            item.element.createSpan({ text: item.title });
            item.element.disabled = !!item.disabled;
            item.element.onclick = () => { this.hide(); item.action?.(); };
        });
        const rect = this.element.getBoundingClientRect();
        this.element.style.left = Math.max(4, Math.min(x, innerWidth - rect.width - 4)) + "px";
        this.element.style.top = Math.max(4, Math.min(y, innerHeight - rect.height - 4)) + "px";
        this.key = event => {
            if (!this.element?.isConnected) return;
            const buttons = this.items.filter(item => !item.separator && !item.disabled).map(item => item.element), index = buttons.indexOf(document.activeElement);
            const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null;
            if (next !== null) { event.preventDefault(); event.stopPropagation(); buttons[next].focus(); }
            else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.hide(); }
            else if (["Enter", " "].includes(event.key) && index >= 0) { event.preventDefault(); event.stopPropagation(); buttons[index].click(); }
        };
        this.outside = event => { if (!this.element.contains(event.target)) this.hide(); };
        document.addEventListener("keydown", this.key, true);
        document.addEventListener("pointerdown", this.outside);
        this.items[0]?.element.focus(); return this;
    }
    hide() {
        if (!this.element?.isConnected) return;
        this.element.remove(); document.removeEventListener("keydown", this.key, true);
        document.removeEventListener("pointerdown", this.outside);
        this.hideHandlers.forEach(callback => callback());
    }
}
const notices = [], results = [];
const assert = (condition, message) => { if (!condition) throw Error(message); results.push(message); };
async function assertSharedTaskForm(host) {
    await new Promise(resolve=>setTimeout(resolve,160));
    const form = host.querySelector(".hub-task-fields");
    assert([...form.children].map(field => field.dataset.taskField).join("|") === "destination|necessity|dates|steps|phase", "Capture task fields use the canonical shared order");
    const phase = form.querySelector('[aria-label="Project phase"]');
    assert(phase.options[0].text === "No phase" && phase.closest("section").querySelector("h3").textContent === "Project phase" && !form.textContent.includes("(optional)"), "Project phase has one shared label and No phase default");
    const choice = form.querySelector('.hub-task-necessity-choice[aria-pressed=true]');
    if (choice) {
        const style = getComputedStyle(choice);
        assert(rgba(style.color).join() === rgba("white").join() && rgba(style.backgroundColor).join() === rgba("#8b5cf6").join(), "Selected necessity matches the existing purple selection convention");
    }
}
const neutralColor = color => { const rgb = color.match(/\d+(?:\.\d+)?/g)?.map(Number); return rgb && Math.max(...rgb.slice(0, 3)) - Math.min(...rgb.slice(0, 3)) < 16; };
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); };
async function itemMenu(inbox, id, label) {
    const row = inbox.rows.get(id).button, bounds = row.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: bounds.left + 25, clientY: bounds.top + 15 }));
    await settle();
    const menu = window.lastMenu;
    if (label) { const item = menu.items.find(item => item.title === label); assert(item && !item.disabled, "Available item action: " + label); item.element.click(); await settle(); }
    return menu;
}
async function changeType(inbox, id, label) {
    await itemMenu(inbox, id, inbox.service.get(id).intent?.type ? "Change type" : "Choose type");
    const item = window.lastMenu.items.find(item => item.title === label);
    assert(item, "Contextual type option: " + label); item.element.click(); await settle();
}
const registeredIcons = new Map();
const obsidian = {
    Component, Modal, FuzzySuggestModal, Menu, Platform: { isMacOS: false, isDesktop: true },
    Notice: class { constructor(message) { notices.push(message); } },
    normalizePath: path => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
    addIcon: (name, svg) => registeredIcons.set(name, svg),
    getIcon: name => {
        if (registeredIcons.has(name)) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 100 100'); svg.innerHTML = registeredIcons.get(name); return svg;
        }
        return /^(lucide-)?(clock-arrow-down|clock-arrow-up|files)$/.test(name) ? document.createElementNS("http://www.w3.org/2000/svg", "svg") : null;
    },
    setTooltip(element, title) { element.title = title; },
    setIcon(element, name) {
        element.replaceChildren(); element.dataset.icon = name.replace(/^lucide-/, "");
        if (registeredIcons.has(name)) { element.append(obsidian.getIcon(name)); return; }
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(key, value);
        const path = document.createElementNS(svg.namespaceURI, "path");
        const paths = { "circle-plus": "M12 8v8M8 12h8M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20", inbox: "M4 4h16l2 10v6H2v-6L4 4zM2 14h6l2 3h4l2-3h6", file: "M5 3h9l5 5v13H5zM14 3v5h5", x: "M5 5l14 14M5 19L19 5", square: "M3 3h18v18H3z", "list-todo": "M9 6h11M9 12h11M9 18h11M3 6h2M3 12h2M3 18h2", "notebook-text": "M6 3h13v18H6zM3 6h4M3 12h4M3 18h4M10 7h6M10 11h6", folder: "M3 7h6l2-3h9v16H3z" };
        Object.assign(paths, {
            "chevron-down": "m6 9 6 6 6-6", "chevron-right": "m9 6 6 6-6 6", "chevron-left": "m15 6-6 6 6 6",
            search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16m6 14 5 5",
            image: "M3 3h18v18H3zM8 7h.01m-5 10 5-5 4 4 4-6 5 7",
            "external-link": "M15 3h6v6m0-6-9 9M9 3H3v18h18v-6",
            "trash-2": "M3 6h18M10 11v6M14 11v6M5 6l1 15h12l1-15M9 6V3h6v3",
            paperclip: "m21 11-9 9a6 6 0 0 1-8-8l10-10a4 4 0 0 1 6 6L10 18a2 2 0 0 1-3-3l9-9",
            music: "M9 18V5l12-2v13M9 5l12-2M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
            shield: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4",
            settings: "M9 3h6l1 4 4 1 1 6-4 2-1 5H9l-1-5-5-2 1-6 4-1 1-4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
            plus: "M12 5v14M5 12h14", zap: "m13 2-9 12h7l-1 8 10-12h-7l1-8",
            "arrow-up-down": "m3 16 4 4 4-4M7 20V4m14 4-4-4-4 4m4-4v16",
            "arrow-right": "M4 12h16m-6-6 6 6-6 6",
            "arrow-down-wide-narrow": "m3 16 4 4 4-4M7 20V4M14 4h8m-8 8h6m-6 8h4",
            "arrow-up-wide-narrow": "m3 8 4-4 4 4M7 4v16M14 4h8m-8 8h6m-6 8h4",
            "clock-arrow-down": "M12 6v6l2 1M22 12a10 10 0 1 0-10 10M18 14v8m-4-4 4 4 4-4",
            "clock-arrow-up": "M12 6v6l2 1M22 12a10 10 0 1 0-10 10M18 22v-8m-4 4 4-4 4 4",
            files: "M15 2H6v14h14V7l-5-5M14 2v6h6M2 6v15a1 1 0 0 0 1 1h12",
            shapes: "m5 3 4 6H1zm8 10h8v8h-8zM9 17a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
            check: "m5 12 4 4L19 6", "panel-right-open": "M3 3h18v18H3zM15 3v18m-9-12 3 3-3 3M9 12H3",
            send: "m22 2-7 20-4-9-9-4 20-7zM22 2 11 13", "repeat-2": "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"
        });
        Object.assign(paths, { notebook: "M6 3h13v18H6zM3 6h4M3 12h4M3 18h4",
            "notebook-pen": "M6 3h13v7M6 3v18h4M3 6h4M3 12h4M3 18h4m7 1 7-7 3 3-7 7-4 1z" });
        path.setAttribute("d", paths[element.dataset.icon] || paths.file); svg.append(path); element.append(svg);
    },
    MarkdownRenderer: { render: async (app, text, element) => element.createEl("p", { text }) },
    TFile: class {}, TFolder: class {}
};
window.onerror = (message, source, line, column, error) => { document.getElementById("result").textContent = "FAIL: " + (error?.stack || message); };
window.onunhandledrejection = event => { document.getElementById("result").textContent = "FAIL: " + (event.reason?.stack || event.reason); };

async function modules() {
    const sources = {}, pending = new Map(), cache = {};
    const resolve = (name, request) => {
        const parts = (name.slice(0, name.lastIndexOf("/")) + "/" + request).split("/"), output = [];
        for (const part of parts) { if (part === "..") output.pop(); else if (part !== ".") output.push(part); }
        return output.join("/").replace(/\.js$/, "");
    };
    const preload = name => {
        if (["obsidian", "crypto", "path", "electron"].includes(name)) return Promise.resolve();
        if (pending.has(name)) return pending.get(name);
        const work = (async () => {
            const response = await fetch("../" + name + ".js").catch(error => { throw Error("Could not load browser module " + name + ": " + error.message); });
            if (!response.ok) throw Error("Missing browser module " + name);
            sources[name] = await response.text();
            const dependencies = [...sources[name].matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1]);
            await Promise.all(dependencies.map(request => preload(request.startsWith(".") ? resolve(name, request) : request)));
        })();
        pending.set(name, work); return work;
    };
    await Promise.all(["ui/quick-add", "ui/inbox", "ui/capture-controls", "services/inbox", "services/task-editor"].map(preload));
    return name => {
        const load = name => {
            if (name === "obsidian") return obsidian;
            if (name === "crypto") return {
                randomUUID: () => crypto.randomUUID(),
                // Stable content identities; cryptographic implementation is covered by Node service tests.
                createHash: () => { let bytes; return { update(value) { bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value); return this; }, digest() {
                    let hash = 2166136261; for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
                    return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
                } }; }
            };
            if (name === "path") return { isAbsolute: path => /^(?:[A-Za-z]:[\\/]|\/)/.test(path), relative: (base, path) => path.startsWith(base) ? path.slice(base.length).replace(/^[\\/]/, "") : "../" + path };
            if (name === "electron") return { webUtils: { getPathForFile: source => source.path || "" } };
            if (cache[name]) return cache[name].exports;
            if (!sources[name]) throw Error("Unloaded browser module " + name);
            const module = cache[name] = { exports: {} };
            new Function("module", "require", "process", "Buffer", sources[name])(module, request => load(request.startsWith(".") ? resolve(name, request) : request), { env: {} }, { from: value => typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value) });
            return module.exports;
        };
        return load(name);
    };
}

function isolatedVault() {
    const vault = new Emitter(), objects = new Map(), contents = new Map();
    const parentPath = path => path.slice(0, path.lastIndexOf("/"));
    const folder = path => {
        const entry = { path, name: path.split("/").at(-1), children: [] };
        objects.set(path, entry); entry.parent = objects.get(parentPath(path)); entry.parent?.children.push(entry); return entry;
    };
    const file = (path, text, binary = false) => {
        if (objects.has(path)) throw Error("File already exists: " + path);
        const entry = { path, name: path.split("/").at(-1), basename: path.split("/").at(-1).replace(/\.[^.]+$/, ""), extension: path.split(".").at(-1), stat: { ctime: Date.now(), mtime: Date.now(), size: binary ? text.byteLength : text.length } };
        objects.set(path, entry); contents.set(path, text); entry.parent = objects.get(parentPath(path)); entry.parent?.children.push(entry); vault.emit("create", entry); return entry;
    };
    const rename = async (entry, destination) => {
        if (vault.failMove) { vault.failMove = false; throw Error("Simulated file move failure"); }
        if (objects.has(destination)) throw Error("Destination exists");
        const oldPath = entry.path, data = contents.get(oldPath); objects.delete(oldPath); contents.delete(oldPath);
        entry.parent?.children.splice(entry.parent.children.indexOf(entry), 1);
        entry.path = destination; entry.name = destination.split("/").at(-1); entry.basename = entry.name.replace(/\.[^.]+$/, ""); entry.parent = objects.get(parentPath(destination));
        entry.parent?.children.push(entry); objects.set(destination, entry); contents.set(destination, data); vault.emit("rename", entry, oldPath);
    };
    Object.assign(vault, {
        getAbstractFileByPath: path => objects.get(path), getAllLoadedFiles: () => [...objects.values()], getMarkdownFiles: () => [...objects.values()].filter(entry => entry.extension === "md"),
        getRoot: () => objects.get(""), createFolder: async path => folder(path), create: async (path, text) => file(path, text), createBinary: async (path, bytes) => file(path, bytes, true),
        read: async entry => contents.get(entry.path), cachedRead: async entry => contents.get(entry.path), readBinary: async entry => contents.get(entry.path),
        modify: async (entry, text) => { contents.set(entry.path, text); vault.emit("modify", entry); },
        process: async (entry, transform) => { const text = transform(contents.get(entry.path)); contents.set(entry.path, text); vault.emit("modify", entry); return text; },
        rename,
        delete: async entry => { if (entry.parent) entry.parent.children = entry.parent.children.filter(child => child !== entry); objects.delete(entry.path); contents.delete(entry.path); vault.emit("delete", entry); },
        getResourcePath: entry => /^(png|jpe?g)$/.test(entry.extension) ? "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect fill="${entry.name === "custom-project-cover.png" ? "#8d7452" : entry.name === "wip.jpg" ? "#555" : "#8b5cf6"}" width="40" height="40"/></svg>`) : "",
        adapter: { exists: async path => objects.has(path), mkdir: async path => folder(path) }
    });
    folder(""); folder("Projects"); folder("Resources"); folder("System");
    return { vault, objects, contents, folder, file, rename };
}

window.onload = async () => {
    try {
        const load = await modules();
        const { HubInboxService } = load("services/inbox"), { HubTaskEditor } = load("services/task-editor");
        const { QuickAddModal } = load("ui/quick-add"), { InboxModal } = load("ui/inbox");
        const { mountCaptureControls, currentSource } = load("ui/capture-controls");
        const memory = isolatedVault(), { vault, objects, contents, folder, file } = memory;
        const project = { root: "Projects/Thesis", projectId: "p1", name: "Pulsed Optomechanics", contextKind: "project", status: "active", subtitle: "Master's thesis", categoryId: "research" };
        const resource = { root: "Resources/Research", projectId: "resource:research", id: "research", resourceType: "research", name: "Research", contextKind: "resource", status: "active", subtitle: "Papers and source material" };
        const longProject = { root: "Projects/Long", projectId: "long", name: "A long project name with enough words to verify that destination controls remain within the modal and never extend beyond the available width", contextKind: "project", status: "active" };
        for (const path of [project.root, project.root + "/Design", project.root + "/Design/Nested folder", project.root + "/Atlas", resource.root, resource.root + "/Quantum Gravity", longProject.root, longProject.root + "/Meta"]) folder(path);
        const coverPath = "System/fixture-cover.png"; file(coverPath, new Uint8Array([1]).buffer, true); resource.image = coverPath;
        const customCoverPath = "System/custom-project-cover.png"; file(customCoverPath, new Uint8Array([2]).buffer, true);
        folder("Assets"); folder("Assets/ProjectCards"); file("Assets/ProjectCards/wip.jpg", new Uint8Array([3]).buffer, true);
        const projectFile = file(project.root + "/Thesis.md", "---\ncover: " + customCoverPath + "\n---\n"); project.path = projectFile.path;
        const original = file(resource.root + "/original.pdf", new Uint8Array([1, 2, 3]).buffer, true);
        const activeFile = file(project.root + "/Work.md", "# Current work\n");
        let metadataSaves = 0, failSave = false, failTaskResolutionText = null, restoredData, taskEvents = 0, oathChanges = 0;
        const oathListeners = new Set(), notifyOath = () => { for (const callback of oathListeners) callback(); };
        const workspace = new Emitter();
        workspace.activeLeaf = { view: { containerEl: document.getElementById("fixture"), file: activeFile, context: "Project" } };
        workspace.getActiveFile = () => activeFile;
        workspace.getLeaf = () => ({ openFile: async opened => { workspace.lastOpened = opened.path; } });
        workspace.openLinkText = async path => { workspace.lastOpened = path; };
        const metadataCache = new Emitter();
        metadataCache.getFileCache = entry => entry === projectFile ? { frontmatter: { cover: customCoverPath } } : {};
        metadataCache.fileToLinktext = entry => entry.path;
        const cleanup = new Component();
        const plugin = {
            app: { vault, workspace, metadataCache, fileManager: {
                renameFile: memory.rename,
                generateMarkdownLink: (entry, sourcePath) => `[[${entry.path}]]`
            } },
            dataStore: { save: async data => {
                if (failTaskResolutionText && !data.inbox?.captures?.some(item => item.text === failTaskResolutionText)) {
                    failTaskResolutionText = null; throw Error("Simulated final Capture removal failure");
                }
                if (failSave) { failSave = false; throw Error("Simulated persistence failure"); }
                metadataSaves++; restoredData = JSON.parse(JSON.stringify(data));
            } },
            register: fn => cleanup.register(fn), registerEvent: ref => cleanup.registerEvent(ref),
            registerDomEvent: (element, event, callback) => { element.addEventListener(event, callback); cleanup.register(() => element.removeEventListener(event, callback)); },
            enqueueTaskMutation: work => { const result = (plugin.queue ?? Promise.resolve()).then(work); plugin.queue = result.catch(() => {}); return result; },
            markProjectChangedByPath: path => { plugin.changedPath = path; },
            notifyCompletedTasksChanged() {}, oath: { canOpen: () => true, active: null, onChange: callback => { oathListeners.add(callback); return () => { oathListeners.delete(callback); }; }, changed() { oathChanges++; } },
            workspaceModes: { currentContext: () => project, openFile: async path => { workspace.lastOpened = path; } },
            openExternalUrl: async url => { workspace.lastURL = url; },
            planning: { phases: () => [{ id: "phase1", name: "Research" }], milestones: () => [], read: () => ({ phases: [{ id: "phase1", name: "Research" }], milestones: [] }) }
        };
        plugin.projectWizard = {
            data: { taskMetadata: {} },
            getProjectRecords: () => [project, longProject], getResourceTypes: () => [resource],
            getCategories: () => [{ id: "research", name: "Master's thesis", image: coverPath }],
            getProjectById: id => [project, longProject].find(item => item.projectId === id),
            getResourceById: id => id === resource.projectId || id === resource.id ? resource : null,
            getContextForPath: path => [project, resource, longProject].find(item => path === item.root || path.startsWith(item.root + "/")),
            recordTaskMutation: async () => { taskEvents++; return false; }
        };
        plugin.taskEditor = new HubTaskEditor(plugin);
        const service = plugin.inbox = new HubInboxService(plugin);
        if (new URLSearchParams(location.search).get("preview") === "initial-filter") {
            await verifyInboxInitialFilter({ plugin, load });
            service.destroy(); cleanup.unload();
            document.getElementById("result").textContent = "PASS: " + results.length + " Inbox initial filter checks\n" + results.join("\n");
            return;
        }
        const controlHost = document.querySelector(".status-bar").createDiv({ cls: "hub-oath-control" });
        const shellButton = (label, icon) => {
            const element = controlHost.createEl("button", { cls: "hub-oath-button", attr: { type: "button", "aria-label": label } });
            obsidian.setIcon(element.createSpan({ cls: "hub-oath-icon" }), icon); element.createSpan({ text: label }); return element;
        };
        shellButton("The Oath", "shield");
        const controls = mountCaptureControls(plugin, service, controlHost);
        shellButton("Music", "music"); shellButton("Settings", "settings");
        const badge = controls.inboxButton.querySelector(".hub-inbox-badge");
        assert(badge.hidden, "Global Inbox badge is hidden at zero");
        assert([...controlHost.querySelectorAll("button")].map(element => element.getAttribute("aria-label")).join("|") === "The Oath|Quick Add|Inbox|Music|Settings", "Capture controls fit the existing five-action global shell ordering");
        assert(controls.quickButton.querySelector('[data-icon="zap"]') && controls.inboxButton.querySelector('[data-icon="inbox"]'), "Global Quick Add uses zap while Inbox retains its conventional inbox icon");
        assert(controls.quickButton.textContent.trim() === "Quick Add", "The global Quick Add label remains unchanged beside zap");
        const source = currentSource(plugin);
        assert(source.origin === "Quick Add" && source.workspaceId === project.projectId && source.path === activeFile.path, "Current context metadata comes from native leaf and workspace state");
        workspace.activeLeaf.getViewState = () => ({ type: "webviewer", state: { url: "https://example.org/source", title: "Atlas source" } });
        const atlasSource = currentSource(plugin);
        assert(atlasSource.origin === "Atlas" && atlasSource.url === "https://example.org/source", "Atlas metadata reuses clean native webviewer state");
        delete workspace.activeLeaf.getViewState;
        vault.adapter.getBasePath = () => "C:/FixtureVault";
        const nativeVaultFile = new File([new Uint8Array([1, 2, 3])], "original.pdf", { type: "application/pdf" });
        Object.defineProperty(nativeVaultFile, "path", { value: "C:/FixtureVault/" + original.path });
        const existingFileRefs = await service.stageFiles([nativeVaultFile]);
        assert(existingFileRefs.length === 1 && existingFileRefs[0].ownership === "reference" && existingFileRefs[0].path === original.path, "Native vault file drops retain an existing-file reference instead of duplicating bytes");
        await service.releaseAttachments(existingFileRefs);
        assert(objects.has(original.path), "Releasing an existing-file attachment never deletes its original");
        const quickTrigger = document.getElementById("quick-trigger"), inboxTrigger = document.getElementById("inbox-trigger");
        quickTrigger.onclick = () => { new QuickAddModal(plugin.app, service, { returnFocus: quickTrigger }).open(); };
        inboxTrigger.onclick = () => { new InboxModal(plugin.app, service, { returnFocus: inboxTrigger, openLink: async url => { workspace.lastURL = url; } }).open(); };
        const openQuick = async () => { quickTrigger.focus(); quickTrigger.click(); await settle(); return window.lastModal; };
        const openInbox = async () => { inboxTrigger.focus(); inboxTrigger.click(); await settle(); return window.lastModal; };
        const button = (host, label) => [...host.querySelectorAll("button")].find(item =>
            (item.textContent.trim() === label || item.closest(".hub-inbox-filters") && item.textContent.trim().startsWith(label + " (")) && !item.closest("[hidden]"));
        const click = async (host, label) => {
            const kind = ["At the end of the note", "At the start of the note", "Under heading", "In list"].includes(label) ? "mode" :
                ["End of section", "Top of section", "Last item", "First item"].includes(label) ? "position" : null;
            const trigger = kind && host.querySelector(`[data-note-selector="${kind}"]`);
            if (trigger) {
                trigger.click(); await settle();
                const item = window.lastMenu.items.find(item => item.title === label);
                assert(item?.element && !item.element.disabled, "Position option available: " + label);
                item.element.click(); await settle(); return item.element;
            }
            const found = button(host, label); assert(found, "Action available: " + label); assert(!found.disabled, "Action enabled: " + label); found.click(); await settle(); return found;
        };
        const input = (element, text) => { element.value = text; element.dispatchEvent(new Event("input", { bubbles: true })); };
        const verifiedTextFields = new Set();
        const checkTextFocus = element => {
            const name = element.getAttribute("aria-label") ?? element.tagName;
            if (verifiedTextFields.has(name)) return; verifiedTextFields.add(name);
            const previous = document.activeElement, value = element.value;
            element.blur(); const unfocused = getComputedStyle(element), border = unfocused.borderColor, width = unfocused.borderWidth, shadow = unfocused.boxShadow;
            element.focus(); const focused = getComputedStyle(element);
            assert((parseFloat(width) === 0 || focused.borderColor === border) && focused.borderWidth === width && focused.boxShadow === shadow && (focused.outlineStyle === "none" || neutralColor(focused.outlineColor)), "Text-entry focus retains its neutral surface: " + name);
            assert(element.value === value && document.activeElement === element, "Keyboard/caret focus preserves content: " + name);
            if (previous?.isConnected) previous.focus();
        };
        const select = async (host, label, value) => {
            if (label === "Sort items") {
                const trigger = host.querySelector('button[aria-label="Sort items"]');
                assert(trigger && !host.querySelector('select[aria-label="Sort items"]'), "Inbox sorting uses a native menu trigger instead of select");
                trigger.click(); await settle();
                const title = ({ "most-complete": "Most complete", "least-complete": "Least complete", newest: "Newest first", oldest: "Oldest first", type: "Item type" })[value];
                const item = window.lastMenu.items.find(item => item.title === title);
                assert(item?.element && !item.element.disabled, "Native sort menu contains " + title);
                item.element.click(); await settle();
                assert(trigger.dataset.value === value && trigger.getAttribute("aria-expanded") === "false", "Sort selection updates label state and closes its native menu");
                assert(document.activeElement === trigger, "Native sort selection returns keyboard focus to the trigger");
                return;
            }
            if (["Save to", "Destination folder", "Location"].includes(label)) {
                const trigger = host.querySelector(`button[aria-label="${label}"]`);
                assert(trigger && !host.querySelector(`select[aria-label="${label}"]`), "Native picker trigger replaces generic select: " + label);
                trigger.focus(); trigger.click(); await settle();
                const picker = window.lastModal;
                const pickerClass = label === "Save to" ? "hub-capture-workspace-picker" : "hub-capture-location-picker";
                assert(picker.modalEl.classList.contains(pickerClass), "Itacan picker opens for " + label);
                const pickerRect = picker.modalEl.getBoundingClientRect();
                assert(pickerRect.left >= 0 && pickerRect.top >= 0 && pickerRect.right <= innerWidth && pickerRect.bottom <= innerHeight, "Picker remains within viewport bounds: " + label);
                assert(picker.contentEl.scrollWidth <= picker.contentEl.clientWidth + 1, "Picker content never overflows horizontally: " + label);
                checkTextFocus(picker.contentEl.querySelector("input[type=search]"));
                const attribute = label === "Save to" ? "data-capture-workspace-id" : "data-capture-path";
                let option = picker.contentEl.querySelector(`[${attribute}="${value}"]`);
                if (!option && label !== "Save to") {
                    const search = picker.contentEl.querySelector("input[type=search],input[aria-label^=Search]");
                    assert(search, "Hierarchy picker supports searching descendants");
                    input(search, value.split("/").at(-1)); await settle();
                    option = picker.contentEl.querySelector(`[${attribute}="${value}"]`);
                }
                assert(option && !option.disabled, "Picker contains an available real destination: " + label);
                option.click(); await settle();
                assert(!picker.containerEl.isConnected, "Choosing " + label + " returns to the existing capture modal");
                assert(document.activeElement === host.querySelector(`button[aria-label="${label}"]`), "Picker selection returns keyboard focus to " + label);
                const focused = getComputedStyle(document.activeElement);
                assert(neutralColor(focused.borderColor) && (focused.outlineStyle === "none" || neutralColor(focused.outlineColor)), "Picker interaction returns to a neutral focused trigger: " + label);
                return;
            }
            const element = host.querySelector(`select[aria-label="${label}"]`); assert(element, "Selector available: " + label);
            assert([...element.options].some(option => option.value === value), "Destination exists: " + label);
            element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); await settle();
        };
        const setField = (host, label, text) => {
            const trigger = host.querySelector(`button.hub-date-time-trigger[aria-label="${label}"]`);
            if (trigger) {
                trigger.click(); const picker = window.lastModal, [date, time = ""] = text.split("T");
                input(picker.date, date); if (date) input(picker.time, time); picker.close(); return;
            }
            const element = host.querySelector(`input[aria-label="${label}"]`); assert(element, "Field available: " + label); if (element.type === "text") checkTextFocus(element); input(element, text);
        };
        const count = () => service.count;
        const stage = async (name = "figure.png", type = "image/png") => service.stageFiles([new File([new Uint8Array([1, 2, 3])], name, { type })]);
        const capture = async (text, attachments = []) => service.capture({ text, attachments, source: { origin: "Quick Add" } });
        // Seed old content-plus-files records exactly as older persisted data.
        // New Capture creation deliberately rejects this combination.
        const legacyCapture = async (text, attachments = []) => {
            const item = { id: crypto.randomUUID(), createdAt: Date.now(), text, attachments,
                kind: load("domain/inbox").captureKind(text, attachments), source: { origin: "Quick Add" } };
            await service.save([...service.captures, item]); return item;
        };
        const chooseWorkspace = async (modal, owner, type, destination = owner.contextKind === "resource" ? owner.root : owner.root + (owner === longProject ? "/Meta" : "/Design")) => {
            if (type !== "File") await click(modal.contentEl, type);
            await select(modal.contentEl, "Save to", owner.projectId);
            await select(modal.contentEl, type === "Task" ? "Location" : "Destination folder", destination);
        };
        const assertViewport = modal => {
            const rect = modal.modalEl.getBoundingClientRect();
            assert(rect.width <= innerWidth && rect.height <= innerHeight && rect.left >= 0 && rect.top >= 0, "Modal stays within viewport");
            assert(modal.contentEl.scrollWidth <= modal.contentEl.clientWidth + 1, "Long content never forces horizontal modal overflow");
        };

        let quick = await openQuick();
        assert(quick.contentEl.querySelector(".hub-capture-header p").textContent === "Write down a thought, or add a file", "Compact Quick Add uses the existing thought/file subtitle");
        assert(quick.label.hidden && quick.input.placeholder === "Start typing..." && !quick.contentEl.querySelector(".hub-capture-or"), "Compact Quick Add has no heading or or separator above its inputs");
        assert(quick.attach.textContent.trim() === "Add a file" && quick.attach.querySelector('[data-icon="paperclip"]'), "Neutral file action uses the requested label and paperclip");
        const inputRect = quick.input.getBoundingClientRect(), attachRect = quick.attach.getBoundingClientRect();
        assert(Math.abs(attachRect.width - inputRect.width) < 1 && attachRect.height >= 44 && attachRect.height <= 48, "Add a file is full-width and a compact 44–48px secondary action");
        const attachIcon = quick.attach.firstElementChild.getBoundingClientRect(), attachText = quick.attach.lastElementChild.getBoundingClientRect();
        assert(Math.abs((attachIcon.left + attachText.right) / 2 - (attachRect.left + attachRect.right) / 2) < 1, "Add a file centers its paperclip and label together");
        assert(attachRect.top - inputRect.bottom >= 4 && attachRect.top - inputRect.bottom <= 12, "Initial input surfaces have compact conventional spacing");
        quick.input.style.height = "150px";
        assert(quick.attach.getBoundingClientRect().height === attachRect.height, "Resizing the textarea does not resize the file surface"); quick.input.style.height = "";
        assert(getComputedStyle(quick.attach).transitionDuration === "0s" && getComputedStyle(quick.attach).transform === "none", "Neutral file action has no animation or decorative motion");
        const quickHeader = quick.contentEl.querySelector(".hub-capture-header");
        assert(quickHeader && quickHeader.querySelector(".hub-window-header [data-icon=zap]") && quickHeader.querySelector("h2").textContent === "Quick Add", "Quick Add title uses its feature icon");
        assert(document.activeElement === quick.input, "Content field receives initial focus");
        const focusedInputStyle = getComputedStyle(quick.input);
        const focusBorder = focusedInputStyle.borderTopColor.match(/\d+/g)?.map(Number);
        assert(focusBorder && Math.max(...focusBorder.slice(0, 3)) - Math.min(...focusBorder.slice(0, 3)) < 16, "Automatically focused capture textarea keeps a subtle neutral border");
        assert((focusedInputStyle.outlineStyle === "none" || neutralColor(focusedInputStyle.outlineColor)) && focusedInputStyle.boxShadow === "none", "Capture autofocus keeps the normal neutral surface without an accent ring");
        quick.cancel.focus(); const unfocusedBorder = getComputedStyle(quick.input).borderColor; quick.input.focus();
        assert(getComputedStyle(quick.input).borderColor === unfocusedBorder && document.activeElement === quick.input, "Text focus leaves the border unchanged and preserves keyboard/caret access");
        quick.cancel.focus(); assert(getComputedStyle(quick.cancel).outlineStyle === "solid", "Non-text buttons retain accessible keyboard focus"); quick.input.focus();
        assert(!quick.contentEl.querySelector("select,.hub-capture-form,button[aria-label='Save to']") && quick.expanded.hidden, "Initial capture shows no type or destination metadata");
        assert(quick.send.disabled && quick.more.disabled && !quick.cancel.disabled && quick.clear.hidden && !quick.clear.getClientRects().length, "Empty Quick Add disables both actions and visually hides Clear while keeping Cancel enabled");
        quick.expand(); assert(!quick.form && quick.expanded.hidden, "Empty Quick Add cannot enter configuration programmatically");
        input(quick.input, "Clear this thought");
        assert(quick.attach.hidden && !quick.attach.getClientRects().length && !quick.clear.hidden && quick.clear.getClientRects().length && !quick.more.disabled && !quick.send.disabled, "Meaningful text visually hides Add a file, shows Clear and enables both compact actions");
        assert(quick.clear.getAttribute("aria-label") === "Clear" && quick.clear.title === "Clear" && quick.clear.querySelector('[data-icon="x"]'), "Compact clear control has the requested icon and accessible name");
        const clearRect = quick.clear.getBoundingClientRect(), textRect = quick.input.getBoundingClientRect();
        assert(clearRect.top >= textRect.top && clearRect.right <= textRect.right && clearRect.bottom < textRect.bottom, "Clear sits inside the textarea's upper-right corner away from its resize handle");
        quick.clear.click();
        assert(quick.input.value === "" && quick.draft.text === "" && !quick.attach.hidden && quick.attach.getClientRects().length && !quick.clear.getClientRects().length && quick.more.disabled && quick.send.disabled && document.activeElement === quick.input, "Clear visually restores both empty surfaces and keeps textarea focus");
        input(quick.input, "Readout idea");
        assert(quick.attach.hidden && quick.attach.disabled && quick.fileInput.disabled, "Meaningful text hides and disables the file path without clearing text");
        const newline = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
        quick.input.dispatchEvent(newline);
        assert(!newline.defaultPrevented && count() === 0, "Shift+Enter remains a native newline and never submits");
        input(quick.input, "Readout idea\nCompare the detector noise");
        const composing = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
        quick.input.dispatchEvent(composing);
        assert(!composing.defaultPrevented && count() === 0, "IME Enter never submits a Capture");
        const ime229 = new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true, cancelable: true });
        quick.input.dispatchEvent(ime229);
        assert(!ime229.defaultPrevented && count() === 0, "Legacy IME key code 229 remains untouched");
        const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
        quick.input.dispatchEvent(enter); await settle();
        assert(enter.defaultPrevented && count() === 1, "Enter creates one unresolved Capture");
        assert(!badge.hidden && badge.textContent === "1", "Global badge updates immediately to unresolved count");
        const badgeStyle = getComputedStyle(badge), badgeBounds = badge.getBoundingClientRect(), navBounds = controls.inboxButton.getBoundingClientRect();
        // An inline-flex item computes to flex inside the navigation flex row.
        assert(['flex', 'inline-flex'].includes(badgeStyle.display) && badgeStyle.alignItems === 'center' && badgeStyle.justifyContent === 'center' && badgeStyle.paddingLeft === badgeStyle.paddingRight && badgeBounds.height === 16 && Math.abs(badgeBounds.top + badgeBounds.height / 2 - navBounds.top - navBounds.height / 2) < 1, 'Inbox badge centers its number and compact sixteen-pixel box beside the navigation label');
        for (const digits of ['1', '14', '128']) {
            badge.textContent = digits;
            const number = document.createRange(); number.selectNodeContents(badge);
            const numberBounds = number.getBoundingClientRect(), bounds = badge.getBoundingClientRect();
            assert(bounds.height === 16 && Math.abs(numberBounds.left + numberBounds.width / 2 - bounds.left - bounds.width / 2) < 1 && Math.abs(numberBounds.top + numberBounds.height / 2 - bounds.top - bounds.height / 2) < 1, 'Rendered badge number ' + digits + ' is centered horizontally and vertically');
        }
        badge.textContent = '1';
        assert(!quick.containerEl.isConnected && document.activeElement === quickTrigger, "Successful capture closes and restores trigger focus");
        assert(workspace.activeLeaf.view.file === activeFile && oathChanges === 0, "Capturing preserves current work and Oath state");
        assert(metadataSaves > 0 && restoredData, "Captures are written through the canonical persistence boundary");
        const reloaded = new HubInboxService({ ...plugin, projectWizard: { ...plugin.projectWizard, data: JSON.parse(JSON.stringify(restoredData)) } });
        assert(reloaded.count === 1 && reloaded.list()[0].text === "Readout idea\nCompare the detector noise", "Reloading persisted metadata restores the unresolved multiline Capture");
        assert(!reloaded.list()[0].intent, "Compact text sent without More options remains an untyped Capture");
        for (const context of ["Home", "Project", "Resource", "Note-view", "Atlas"]) {
            workspace.activeLeaf.view.context = context; quick = await openQuick();
            const before = workspace.activeLeaf;
            quick.input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await settle();
            assert(!quick.containerEl.isConnected && workspace.activeLeaf === before && workspace.activeLeaf.view.context === context, "Escape restores unchanged " + context + " context");
        }
        plugin.oath.active = { id: "active-oath" }; notifyOath();
        assert(controls.inboxButton.disabled && !controls.quickButton.disabled, "Active Oath blocks deliberate Inbox review and permits Quick Add");
        controls.quickButton.focus(); controls.quickButton.click(); await settle(); quick = window.lastModal;
        assert(quick instanceof QuickAddModal && quick.expanded.hidden, "Global Quick Add stays compact during an active Oath");
        quick.close(); plugin.oath.active = null; notifyOath();
        controls.openQuickAdd(); await settle(); quick = window.lastModal;
        assert(quick instanceof QuickAddModal, "Command callback opens the exact same global Quick Add flow"); quick.close();

        quick = await openQuick(); input(quick.input, "Interesting detector figure");
        const transfer = new DataTransfer();
        transfer.items.add(new File([new Uint8Array([4, 5])], "figure.png", { type: "image/png" }));
        transfer.items.add(new File([new Uint8Array([6, 7])], "paper.pdf", { type: "application/pdf" }));
        quick.body.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true })); await settle();
        assert(!quick.draft.attachments.length && quick.input.value === "Interesting detector figure" && quick.error.textContent.includes("Clear the text"), "Dropping files into meaningful text preserves input and prevents mixed Captures");
        input(quick.input, "");
        assert(!quick.attach.disabled, "Clearing text makes the file path available again");
        quick.body.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true })); await settle();
        assert(quick.draft.attachments.length === 2 && quick.contentEl.querySelectorAll(".hub-capture-attachment").length === 2, "Drop preserves every attachment in compact rows");
        assert(!quick.contentEl.querySelector("select") && quick.expanded.hidden && quick.draft.type === "file", "Dropping files remains compact and establishes File intent immediately");
        assert(quick.input.disabled && quick.textPath.hidden && quick.attach.hidden, "Selected files disable and hide the text path");
        const droppedText = new DataTransfer(); droppedText.setData("text/plain", "Do not overwrite these files");
        quick.body.dispatchEvent(new DragEvent("drop", { dataTransfer: droppedText, bubbles: true, cancelable: true })); await settle();
        assert(!quick.draft.text && quick.draft.attachments.length === 2 && quick.error.textContent.includes("Remove the file"), "File path rejects text drops without discarding either file");
        const capturedRefs = [...quick.draft.attachments];
        await click(quick.contentEl, "More options");
        assert(!quick.input.value && quick.draft.attachments.length === 2, "More options preserves all file references");
        assert(quick.draft.type === "file" && !quick.contentEl.querySelector(".hub-capture-types"), "More options enters File routing directly with no redundant Type choice");
        await click(quick.contentEl, "Send to Inbox");
        assert(count() === 2 && capturedRefs.every(ref => objects.has(ref.path)), "Inbox capture owns durable staged attachments");
        assert(service.list().find(item => item.attachments[0]?.id === capturedRefs[0].id)?.intent?.type === "file", "Compact file routing persists inherent File intent");

        quick = await openQuick(); await quick.addAttachments([new File(["remove"], "remove-me.pdf", { type: "application/pdf" })]); await settle();
        assert(!quick.more.disabled && !quick.send.disabled && quick.textPath.hidden && quick.attach.hidden && !quick.input.getClientRects().length && !quick.attach.getClientRects().length, "A selected file enables both compact actions and visually replaces both empty input surfaces");
        const removable = quick.draft.attachments[0]; quick.attachmentList.querySelector('button[aria-label="Remove remove-me.pdf"]').click(); await settle();
        assert(!quick.draft.attachments.length && !quick.textPath.hidden && !quick.input.disabled && !quick.attach.disabled && !objects.has(removable.path), "Existing remove x restores the text path and cleans only unused staging");
        assert(!quick.attach.hidden && quick.more.disabled && quick.send.disabled && quick.clear.hidden, "Removing the final file restores the empty surfaces and disables both actions");
        input(quick.input, "Text after removing the file"); await click(quick.contentEl, "Cancel");

        quick = await openQuick(); input(quick.input, "Clipboard capture: "); quick.input.setSelectionRange(quick.input.value.length, quick.input.value.length);
        const clipboard = new DataTransfer(); clipboard.setData("text/plain", "pasted context");
        clipboard.items.add(new File(["image"], "pasted-image.png", { type: "image/png" }));
        clipboard.items.add(new File(["PDF"], "pasted-document.pdf", { type: "application/pdf" }));
        const paste = new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true });
        quick.input.dispatchEvent(paste); await settle();
        assert(paste.defaultPrevented && quick.input.value === "Clipboard capture: " && !quick.draft.attachments.length, "Pasting files into meaningful text preserves the selected text path");
        input(quick.input, "");
        quick.input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true })); await settle();
        assert(quick.draft.attachments.length === 2 && quick.expanded.hidden, "Pasting multiple files preserves them without expanding metadata");
        const pasteRefs = [...quick.draft.attachments]; await click(quick.contentEl, "Send to Inbox");
        assert(service.list().some(item => !item.text && item.attachments[0]?.id === pasteRefs[0].id && item.attachments.length === 2) && pasteRefs.every(ref => objects.has(ref.path)), "Clipboard file Capture preserves every attachment without silently inserting accompanying text");

        quick = await openQuick(); const textClipboard = new DataTransfer(); textClipboard.setData("text/plain", "Native paste remains supported");
        const textPaste = new ClipboardEvent("paste", { clipboardData: textClipboard, bubbles: true, cancelable: true }); quick.input.dispatchEvent(textPaste);
        assert(!textPaste.defaultPrevented && !quick.draft.attachments.length, "Ordinary text paste remains a native editor interaction"); await click(quick.contentEl, "Cancel");

        quick = await openQuick();
        let releaseImport;
        const importGate = new Promise(resolve => { releaseImport = resolve; });
        const delayedFile = { name: "queued-first.png", type: "image/png", size: 2, arrayBuffer: async () => { await importGate; return new Uint8Array([1, 2]).buffer; } };
        const firstImport = quick.addAttachments([delayedFile]);
        const secondImport = quick.addAttachments([new File(["second"], "queued-second.png", { type: "image/png" })]);
        quick.close();
        assert(quick.containerEl.isConnected && quick.send.disabled, "Pending imports block closing and saving until every staged attachment is ready");
        releaseImport(); await Promise.all([firstImport, secondImport]); await settle();
        assert(quick.draft.attachments.length === 2, "A second attachment drop during staging is queued instead of silently discarded");
        await click(quick.contentEl, "Send to Inbox");

        quick = await openQuick(); input(quick.input, "https://example.org/paper"); await click(quick.contentEl, "Send to Inbox");
        assert(service.list().some(item => item.text.includes("https://example.org/paper") && item.kind === "link"), "URL capture records inferred link kind");
        quick = await openQuick();
        const droppedLink = new DataTransfer(); droppedLink.setData("text/uri-list", "https://example.org/dropped-link"); droppedLink.setData("text/plain", "https://example.org/dropped-link");
        const linkDrag = new DragEvent("dragover", { dataTransfer: droppedLink, bubbles: true, cancelable: true }); quick.body.dispatchEvent(linkDrag);
        const linkDrop = new DragEvent("drop", { dataTransfer: droppedLink, bubbles: true, cancelable: true }); quick.body.dispatchEvent(linkDrop); await settle();
        assert(linkDrag.defaultPrevented && linkDrop.defaultPrevented && quick.input.value === "https://example.org/dropped-link", "Dropping a link into compact Quick Add captures text and prevents browser navigation");
        assert(quick.expanded.hidden && !quick.draft.attachments.length, "Dropped links remain compact text captures without file metadata");
        await click(quick.contentEl, "Send to Inbox");
        assert(service.list().some(item => item.text === "https://example.org/dropped-link" && item.kind === "link"), "Dropped URL persists as an unresolved link Capture");
        quick = await openQuick(); input(quick.input, "A configured thought to clear"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Task");
        await select(quick.contentEl, "Save to", project.projectId); quick.clear.click();
        assert(!quick.form && quick.expanded.hidden && !quick.more.hidden && quick.more.disabled && quick.send.disabled && !quick.attach.hidden && document.activeElement === quick.input, "Clearing expanded content returns to the disabled compact empty state");
        input(quick.input, "Continue with the retained choices"); await click(quick.contentEl, "More options");
        assert(quick.form.value().type === "task" && quick.form.value().workspaceId === project.projectId, "Clearing content retains prior routing decisions for later text without silently losing them");
        await click(quick.contentEl, "Cancel");
        quick = await openQuick(); input(quick.input, "Canonical task"); await click(quick.contentEl, "More options");
        assert(!quick.draft.type, "Plain text never receives an arbitrary type");
        assert([...quick.contentEl.querySelectorAll(".hub-capture-type")].map(item => item.textContent.trim()).join("|") === "Task|Note", "Text More options exposes only Task and Note choices");
        assert(quick.contentEl.querySelector('.hub-capture-type[aria-label="Task"] [data-icon="square"]') && quick.contentEl.querySelector('.hub-capture-type[aria-label="Note"] [data-icon="notebook-text"]'), "Text types use one-task square and notebook-text icons");
        assert(!quick.contentEl.textContent.includes("Choose a type to add it now"), "Type selection has no redundant explanation");
        await chooseWorkspace(quick, project, "Task"); assertViewport(quick);
        assert(quick.input.getAttribute("aria-label") === "Task" && quick.contentEl.querySelectorAll('textarea,input[aria-label="Task"]').length === 1, "Task mode morphs the captured text into one canonical task editor");
        assert(![...quick.contentEl.querySelectorAll("h3")].some(item => ["Task details", "Dates"].includes(item.textContent)), "Task mode removes redundant Task details and Dates headings");
        assert(quick.add.textContent.trim() === "Add to Itacan" && !isBlocked(quick.add) && quick.send.disabled, "Text plus workspace and location enables only direct Add to Itacan");
        const image = quick.contentEl.querySelector('button[aria-label="Save to"] .hub-capture-workspace-thumbnail');
        assert(image?.tagName === "IMG" && getComputedStyle(image).width === getComputedStyle(image).height && getComputedStyle(image).objectFit === "cover" && getComputedStyle(image).clipPath === "none", "Selected Project uses a clean square image crop without its card mask");
        assert(load("ui/workspace-thumbnail").workspaceImagePath(plugin, service.destinations().find(item => item.id === project.projectId)) === customCoverPath, "Selected Project thumbnail resolves its user cover from canonical cached metadata");
        assert(!quick.contentEl.querySelector('button[aria-label="Save to"] [data-icon="folder"]'), "Selected Project has no generic workspace icon");
        verifyTaskDateTime(quick.contentEl, quick.form);
        await click(quick.contentEl, "Must do"); setField(quick.contentEl, "Due date", "2026-10-10");
        await new Promise(resolve=>setTimeout(resolve,160));
        assert(getComputedStyle(quick.contentEl.querySelector('.hub-capture-type.is-active')).backgroundColor === "rgb(139, 92, 246)" && getComputedStyle(quick.contentEl.querySelector('.hub-task-necessity-choice[aria-pressed=true]')).backgroundColor === "rgb(139, 92, 246)", "Type and Necessity share the existing purple selected fill");
        assert(quick.contentEl.querySelectorAll('.hub-date-time-trigger').length === 2 && !quick.contentEl.querySelector('.hub-date-time-precision') && !quick.contentEl.textContent.includes("Include time"), "Start and Due date each use the shared picker with no external time toggle");
        assert([...quick.contentEl.querySelectorAll('.hub-capture-form .hub-task-section,.hub-capture-form-group')].every(section => getComputedStyle(section).borderTopWidth === "0px"), "Task internal fields use spacing without divider lines");
        assert(getComputedStyle(quick.expanded).borderTopWidth === "1px" && getComputedStyle(quick.contentEl.querySelector('.hub-capture-header')).borderBottomWidth === "1px" && getComputedStyle(quick.contentEl.querySelector('.hub-capture-actions')).borderTopWidth === "1px", "Quick Add keeps the content and footer separators");
        assert(!quick.contentEl.textContent.includes("Break the task into smaller actions"), "Steps keeps its label and Add control without helper copy");
        const dateLabel = quick.contentEl.querySelector('.hub-date-time-field > label'), saveLabel = quick.contentEl.querySelector('.hub-capture-field-title');
        assert(getComputedStyle(dateLabel).fontWeight === getComputedStyle(saveLabel).fontWeight && getComputedStyle(dateLabel).fontSize === getComputedStyle(saveLabel).fontSize, "Date labels share the semibold field-label typography");
        await select(quick.contentEl, "Project phase", "phase1");
        await assertSharedTaskForm(quick.contentEl);
        await click(quick.contentEl, "Add step"); setField(quick.contentEl, "Step text", "Read source material");
        await click(quick.contentEl, "Add to Itacan");
        const tasks = contents.get(project.root + "/Design/Tasks.md");
        assert(tasks.includes("Canonical task") && tasks.includes("Read source material"), "Direct task writes the normal Markdown task and Steps");
        assert(Object.values(plugin.projectWizard.data.taskMetadata).some(item => item.necessity === "must" && item.dueDate === "2026-10-10" && !item.dueTime && item.phaseId === "phase1"), "Direct date-only task preserves priority, phase and date without storing a time");
        assert(taskEvents === 1, "Direct task follows the normal task mutation event path");
        quick = await openQuick(); input(quick.input, "  Trimmed Quick Add retry  "); await click(quick.contentEl, "More options"); await chooseWorkspace(quick, project, "Task");
        const beforeTaskRecovery = count(), beforeTaskEvents = taskEvents; failTaskResolutionText = quick.input.value;
        await click(quick.contentEl, "Add to Itacan");
        assert(quick.captureId && service.get(quick.captureId)?.operation?.state === "ready" && count() === beforeTaskRecovery + 1 && quick.input.value === "  Trimmed Quick Add retry  ", "Failed final Task removal preserves a ready receipt and the original whitespace-bearing Quick Add text");
        assert(contents.get(project.root + "/Design/Tasks.md").split("Trimmed Quick Add retry").length - 1 === 1 && taskEvents === beforeTaskEvents + 1, "Failed final Capture removal still creates the canonical Task exactly once");
        await click(quick.contentEl, "Add to Itacan");
        assert(!quick.containerEl.isConnected && count() === beforeTaskRecovery && taskEvents === beforeTaskEvents + 1 && contents.get(project.root + "/Design/Tasks.md").split("Trimmed Quick Add retry").length - 1 === 1, "Retrying unchanged whitespace-bearing Quick Add text resolves its Capture without duplicate Task/history events");
        quick = await openQuick(); input(quick.input, "A very long captured task title ".repeat(12)); await click(quick.contentEl, "More options"); await chooseWorkspace(quick, longProject, "Task"); assertViewport(quick);
        assert(quick.contentEl.querySelector('[aria-label="Task"]').value.length > 300, "Long task titles retain full text in native inputs");
        assert(load("ui/workspace-thumbnail").workspaceImagePath(plugin, service.destinations().find(item => item.id === longProject.projectId)) === "Assets/ProjectCards/wip.jpg" && quick.contentEl.querySelector('button[aria-label="Save to"] img').getAttribute("src") === vault.getResourcePath(objects.get("Assets/ProjectCards/wip.jpg")), "Project without a user/category image displays the built-in placeholder image");
        await click(quick.contentEl, "Cancel");
        quick = await openQuick(); input(quick.input, "Resource task"); await click(quick.contentEl, "More options"); await chooseWorkspace(quick, resource, "Task");
        assert(quick.contentEl.querySelector('[aria-label="Project phase"]').closest("section").hidden, "Resource task hides Project-only phase controls");
        assert(quick.contentEl.querySelector('button[aria-label="Save to"] img.hub-capture-workspace-thumbnail') && !quick.contentEl.querySelector('button[aria-label="Save to"] [data-icon="library"]'), "Selected Resource always displays its actual square image");
        setField(quick.contentEl, "Due date", "2026-10-11T00:00");
        await click(quick.contentEl, "Add to Itacan");
        assert(contents.get(resource.root + "/Tasks.md").includes("Resource task"), "Resource task uses its own normal Tasks note");
        assert(Object.values(plugin.projectWizard.data.taskMetadata).some(item => item.dueDate === "2026-10-11" && item.dueTime === "00:00"), "Direct creation preserves explicitly chosen midnight");

        for (const owner of [project, resource, project]) {
            quick = await openQuick(); input(quick.input, "Captured note text"); await click(quick.contentEl, "More options"); await chooseWorkspace(quick, owner, "Note");
            setField(quick.contentEl, "Note title", "Captured note"); await click(quick.contentEl, "Add to Itacan");
        }
        assert(objects.has(project.root + "/Design/Captured note.md") && objects.has(resource.root + "/Captured note.md"), "Direct Markdown notes use valid Project workspace folders and Resource root semantics");
        assert([...objects.keys()].filter(path => path.startsWith(project.root + "/Design/Captured note") && path.endsWith(".md")).length === 2, "Note filename collisions keep both notes");
        quick = await openQuick();
        assert(quick.more.disabled && quick.send.disabled, "Empty Quick Add keeps configuration and submission disabled");
        await quick.addAttachments([new File(["one"], "evidence.pdf", { type: "application/pdf" }), new File(["two"], "evidence.pdf", { type: "application/pdf" })]); await settle();
        await click(quick.contentEl, "More options");
        await chooseWorkspace(quick, resource, "File", resource.root + "/Quantum Gravity");
        assert(!quick.contentEl.querySelector(".hub-capture-types,.hub-capture-file-help") && isBlocked(quick.add) === false && quick.send.disabled, "File mode requires only actual files and routing without redundant types or helper copy");
        await click(quick.contentEl, "Add to Itacan");
        assert([...objects.keys()].filter(path => path.startsWith(resource.root + "/Quantum Gravity/evidence") && path.endsWith(".pdf")).length === 2, "Multiple imported files preserve safe collision handling");
        assert(original.path === resource.root + "/original.pdf" && objects.has(original.path), "Direct imports preserve original existing user files");

        quick = await openQuick(); input(quick.input, "Picker content survives nested selection"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
        const destinationTrigger = quick.contentEl.querySelector("button[aria-label='Save to']"); destinationTrigger.click(); await settle();
        let picker = window.lastModal;
        assert(picker.contentEl.querySelector(".home-project-card[data-capture-workspace-id='p1']") && picker.contentEl.querySelector(".home-resource-card[data-capture-workspace-id='resource:research']"), "Combined Save to picker reuses native Project and Resource card markup");
        assert([...picker.contentEl.querySelectorAll("h3")].map(heading => heading.textContent).includes("Projects") && [...picker.contentEl.querySelectorAll("h3")].map(heading => heading.textContent).includes("Resources"), "Combined card picker clearly separates actual Projects and Resources");
        assert(picker.contentEl.querySelector(".home-project-category").textContent === "Master's thesis" && picker.contentEl.querySelector(".home-resource-thumbnail"), "Destination cards retain established category subtitles and resource imagery");
        const destinationSearch = picker.contentEl.querySelector("input[aria-label='Search destinations']"); input(destinationSearch, "Pulsed"); await settle();
        assert(picker.contentEl.querySelectorAll("[data-capture-workspace-id]").length === 1, "Native destination picker search filters real card choices");
        picker.contentEl.querySelector("[data-capture-workspace-id='p1']").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await settle();
        assert(!picker.containerEl.isConnected && quick.input.value === "Picker content survives nested selection", "Keyboard Project selection returns to the same Quick Add content");
        quick.contentEl.querySelector("button[aria-label='Destination folder']").click(); await settle(); picker = window.lastModal;
        assert(!picker.contentEl.querySelector(`[data-capture-path="${project.root}"]`), "Project synthetic root is never offered as a folder destination");
        assert(!picker.contentEl.querySelector("[data-capture-path$='.md']"), "Note/file folder picker contains folders rather than unrelated files");
        const nested = picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder"]`);
        const topFolder = picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design"]`);
        assert(nested && topFolder && Number(nested.getAttribute("aria-level")) > Number(topFolder.getAttribute("aria-level")) && nested.closest("[role=group]"), "Folder picker preserves the native nested tree hierarchy");
        assert(topFolder.querySelector("[data-icon='folder']") && nested.querySelector("[data-icon='folder']"), "Folder destinations use conventional folder glyphs at every hierarchy depth");
        const folderSearch = picker.contentEl.querySelector("input[aria-label='Search folders']"); input(folderSearch, "Nested folder"); await settle();
        assert(picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design"]`) && picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder"]`), "Searching folder descendants retains their structural ancestor");
        picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder"]`).click(); await settle();
        assert(quick.form.value().folder === project.root + "/Design/Nested folder" && quick.input.value === "Picker content survives nested selection", "Choosing a nested workspace folder preserves captured input");
        quick.form.update({ folder: project.root }); quick.sync();
        assert(isBlocked(quick.add), "Programmatic Project-root folder selection cannot enable Add note");
        const rootCapture = await capture("Programmatic destination validation");
        let rejectedRoot;
        try { await service.createNote({ workspaceId: project.projectId, folder: project.root, title: "Forbidden root note", text: rootCapture.text, attachments: [], source: rootCapture.source }, rootCapture.id); } catch (error) { rejectedRoot = error; }
        assert(rejectedRoot && !objects.has(project.root + "/Forbidden root note.md") && service.get(rootCapture.id), "Underlying note flow rejects Project root and retains the Capture");
        await service.delete(rootCapture.id); await click(quick.contentEl, "Cancel");

        quick = await openQuick(); input(quick.input, "Task picker root validation"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Task"); await select(quick.contentEl, "Save to", project.projectId);
        quick.contentEl.querySelector("button[aria-label='Location']").click(); await settle(); picker = window.lastModal;
        assert(!picker.contentEl.querySelector(`[data-capture-path="${project.root}"]`) && !picker.contentEl.querySelector(`[data-capture-path="${activeFile.path}"]`), "Feature task picker excludes Project-root folder and root note locations");
        assert(picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Tasks.md"]`) && picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design"]`), "Task picker distinguishes available workspace Markdown notes and folders");
        assert(picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Tasks.md"]`).textContent.includes("Markdown note") && picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design"]`).textContent.includes("Folder"), "Location rows identify notes and folders with clear native captions");
        picker.close(); quick.form.update({ location: activeFile.path }); quick.sync(); assert(isBlocked(quick.add), "Programmatic root-note task selection cannot enable Add task"); await click(quick.contentEl, "Cancel");

        quick = await openQuick(); await quick.addAttachments([new File(["retry bytes"], "direct-retry.pdf", { type: "application/pdf" })]); await settle();
        await click(quick.contentEl, "More options"); await select(quick.contentEl, "Save to", project.projectId); await select(quick.contentEl, "Destination folder", project.root + "/Design");
        const beforeDirectFailure = count(); vault.failMove = true; await click(quick.contentEl, "Add to Itacan");
        assert(quick.captureId && service.get(quick.captureId) && count() === beforeDirectFailure + 1, "Failed direct routing journals one persistent recovery Capture");
        assert(quick.error.textContent.includes("Simulated file move failure"), "Direct file failure remains in the same modal with conventional error feedback");
        await click(quick.contentEl, "Add to Itacan");
        assert(count() === beforeDirectFailure && [...objects.keys()].filter(path => path.endsWith("/direct-retry.pdf")).length === 1, "Retrying direct Add uses the same Capture and transfers the file exactly once");

        quick = await openQuick(); await quick.addAttachments([new File(["recover bytes"], "direct-cancel.pdf", { type: "application/pdf" })]); await settle();
        await click(quick.contentEl, "More options"); await select(quick.contentEl, "Save to", resource.projectId); await select(quick.contentEl, "Destination folder", resource.root + "/Quantum Gravity");
        vault.failMove = true; await click(quick.contentEl, "Add to Itacan");
        const recoveryId = quick.captureId, recoveryPath = quick.draft.attachments[0].path; await click(quick.contentEl, "Cancel");
        assert(service.get(recoveryId) && objects.has(recoveryPath), "Cancelling a failed direct save preserves its Inbox recovery Capture and staged binary");

        await verifyInboxInitialFilter({ plugin, load });
        // Inbox interactions follow after neutral selection is mounted.
        await verifyPartialCaptures({ service, plugin, memory, project, resource, openQuick, openInbox, load, capture, stage, select, click, setField, count, assertViewport, getPersisted: () => restoredData, setFailSave: () => { failSave = true; } });
        await verifyPersistentInboxEdits({ service, plugin, project, resource, openInbox, load, stage, select, click, setField, getPersisted: () => restoredData });
        await verifyInboxOrganisation({ plugin, project, resource, load, stage, select, click, setField });
        await verifyQuickAddGuidance({ service, project, resource, openQuick, select, click, setField });
        await verifyInteractionPolish({ service, project, resource, openInbox, select, click, setField, stage });
        await verifyExistingNoteFlow({ service, plugin, memory, project, resource, openQuick, openInbox, load, select, click, setField, checkTextFocus, assertViewport,
            getPersisted: () => restoredData, setFailResolutionText: text => { failTaskResolutionText = text; } });
        await verifyInbox({ service, plugin, memory, project, resource, openQuick, openInbox, capture, legacyCapture, stage, select, click, setField, count, assertViewport, setFailSave: () => { failSave = true; }, quickTrigger, recoveryId, controlHost });
        window.addEventListener("unload", () => { controls.destroy(); cleanup.unload(); }, { once: true });
        document.getElementById("result").textContent = "PASS: " + results.length + " Quick Add and Inbox browser checks\n" + results.join("\n");
    } catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; }
};

async function verifyInboxInitialFilter({ plugin, load }) {
    const { HubInboxService } = load("services/inbox"), { InboxModal } = load("ui/inbox");
    const data = { inbox: { version: 1, captures: [] } };
    const service = new HubInboxService({ ...plugin, projectWizard: { ...plugin.projectWizard, data } });
    try {
        for (const count of [0, 1, 120]) {
            data.inbox.captures = Array.from({ length: count }, (_, index) => ({
                id: "initial-filter-" + index, text: "Item " + index, createdAt: index + 1,
                attachments: index % 2 ? [{ name: "File.pdf", path: "missing.pdf" }] : []
            }));
            for (let opening = 0; opening < 2; opening++) {
                const inbox = new InboxModal(plugin.app, service), refresh = inbox.refresh;
                let initial = true;
                inbox.refresh = function (...args) {
                    if (initial) {
                        initial = false;
                        const all = this.filterButtons[0].button;
                        assert(all.classList.contains("is-selected") && all.getAttribute("aria-pressed") === "true" && all.textContent === `All (${count})`,
                            `All is initialized before first refresh (${count} items, opening ${opening + 1})`);
                        assert(rgba(getComputedStyle(all).backgroundColor).join() === rgba("#8b5cf6").join(), "Initial style calculation already resolves to purple");
                    }
                    return refresh.apply(this, args);
                };
                inbox.open();
                const all = inbox.filterButtons[0].button;
                for (let frame = 0; frame < 3; frame++) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    assert(rgba(getComputedStyle(all).backgroundColor).join() === rgba("#8b5cf6").join() && all.getAnimations().length === 0,
                        "All stays fully selected without an initial animation on frame " + frame);
                }
                assert(inbox.rows.size === count && inbox.filterButtons[1].button.textContent === `Texts (${Math.ceil(count / 2)})` &&
                    inbox.filterButtons[2].button.textContent === `Files (${Math.floor(count / 2)})`, "Initial All list and mixed-item filter counts are preserved");
                await inbox.changeFilter("text");
                const text = inbox.filterButtons[1].button;
                getComputedStyle(text).backgroundColor;
                const animations = text.getAnimations();
                assert(text.getAttribute("aria-pressed") === "true" && animations.some(animation => animation.transitionProperty === "background-color"),
                    "User filter changes retain the color transition");
                await Promise.all(animations.map(animation => animation.finished));
                assert(rgba(getComputedStyle(text).backgroundColor).join() === rgba("#8b5cf6").join() && !all.classList.contains("is-selected"), "User-selected Texts finishes purple and clears All");
                assert(inbox.rows.size === Math.ceil(count / 2), "Texts still filters the item list");
                await inbox.changeFilter("files");
                assert(inbox.rows.size === Math.floor(count / 2) && inbox.filterButtons[2].button.getAttribute("aria-pressed") === "true", "Files still filters the item list and updates selection");
                inbox.close();
            }
        }
    } finally { service.destroy(); }
}

function verifyTaskDateTime(host, form) {
    const before = form.value(), trigger = host.querySelector('button.hub-date-time-trigger[aria-label="Start date"]');
    trigger.click(); const picker = window.lastModal;
    const enter = (element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); };
    assert(picker.modalEl.classList.contains("hub-task-date-time-picker") && picker.date.type === "date" && picker.time.type === "time" && !picker.contentEl.querySelector('input[type=checkbox]'), "One shared Task picker owns date and optional time without a toggle");
    enter(picker.date, "");
    assert(!form.value().fromDate && !form.value().fromTime && picker.time.disabled, "Clearing the picker date clears its time too");
    enter(picker.date, "2026-10-12");
    assert(form.value().fromDate === "2026-10-12" && !form.value().fromTime, "Selecting only a date does not invent a time");
    enter(picker.time, "00:00");
    assert(form.value().fromTime === "00:00", "Choosing midnight explicitly preserves time precision");
    enter(picker.time, "09:30");
    assert(form.value().fromDate === "2026-10-12" && form.value().fromTime === "09:30", "Selecting date and time stores both values");
    picker.clearTime.click();
    assert(form.value().fromDate === "2026-10-12" && !form.value().fromTime, "Picker Clear time returns the value to date-only");
    enter(picker.time, "10:45"); enter(picker.time, "");
    assert(form.value().fromDate === "2026-10-12" && !form.value().fromTime, "Clearing the native time input also returns to date-only");
    const first = picker.date, border = getComputedStyle(first).borderColor; first.focus();
    assert(getComputedStyle(first).borderColor === border && neutralColor(border) && neutralColor(getComputedStyle(first).outlineColor), "Picker fields preserve neutral keyboard focus");
    enter(picker.date, before.fromDate ?? ""); if (before.fromDate) enter(picker.time, before.fromTime ?? "");
    picker.close();
    assert(document.activeElement === trigger && trigger.getAttribute("aria-expanded") === "false", "Closing the date picker restores keyboard focus to the date field");
}

function verifyPositionLayout(picker) {
    const row = picker.positions.querySelector('.hub-note-target-row'), target = row.querySelector('[data-note-selector="target"]'), position = row.querySelector('[data-note-selector="position"]');
    assert(row.children.length === 2 && picker.positions.querySelectorAll('button').length === 3 && target.parentElement === position.parentElement, "Heading and list use one target/position row beneath the main selector");
    const targetRect = target.getBoundingClientRect(), positionRect = position.getBoundingClientRect(), bounds = picker.positions.getBoundingClientRect();
    assert(targetRect.width > positionRect.width && positionRect.right <= bounds.right + 1 && targetRect.right <= bounds.right + 1 && position.scrollWidth <= position.clientWidth + 1, "Target receives more width and the complete position label stays inside the modal");
    for (const control of [picker.positions.querySelector('[data-note-selector="mode"]'), target, position]) {
        control.focus(); const style = getComputedStyle(control);
        assert(neutralColor(style.borderColor) && (style.outlineStyle === "none" || neutralColor(style.outlineColor)) && !control.hasAttribute('title') && !control.hasAttribute('aria-label'), "Position dropdown has neutral focus and no unconditional hover tooltip");
    }
    target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    const text = target.firstElementChild;
    assert((text.scrollWidth > text.clientWidth) === text.hasAttribute('aria-label'), "Target tooltip exists only when its selected label is truncated");
}

async function verifyExistingNoteFlow({ service, plugin, memory, project, resource, openQuick, openInbox, load, select, click, setField, checkTextFocus, assertViewport, getPersisted, setFailResolutionText }) {
    const { vault, file, contents, objects } = memory;
    const path = project.root + "/Design/Nested folder/Position targets.md";
    const original = "---\nkind: reference\n---\n\n# Quick Add\nExisting body\n\n## Open questions\n* First question\n* Second question\n\n# Next\nUntouched\n";
    const target = file(path, original);
    const plainPath = project.root + "/Design/Plain note.md"; file(plainPath, "Plain body without headings or lists\n");
    const longPath = project.root + "/Design/Long position labels.md";
    file(longPath, "# " + "A detailed heading about detector sensitivity and readout methods ".repeat(3) + "\n\n* First item\n* Second item\n");
    file(project.root + "/Design/Nested folder/Not a note.pdf", new Uint8Array([1]).buffer, true);
    const enter = (element, text) => { element.value = text; element.dispatchEvent(new Event("input", { bubbles: true })); };
    const openPicker = async host => {
        const trigger = host.querySelector('button[aria-label="Location"]'); trigger.focus(); trigger.click(); await settle();
        const picker = window.lastModal;
        assert(picker.modalEl.classList.contains("hub-note-position-picker"), "Location opens the shared hierarchy note-and-position modal");
        assertViewport(picker); checkTextFocus(picker.contentEl.querySelector("input[type=search]"));
        return picker;
    };
    const pickNote = async picker => {
        const row = picker.contentEl.querySelector(`[data-capture-path="${path}"]`); assert(row, "Nested Markdown note is available in the tree");
        row.focus(); row.click(); await settle();
        assert(picker.containerEl.isConnected && picker.contentEl.querySelector(`[data-capture-path="${path}"]`).getAttribute("aria-selected") === "true", "Selecting a note highlights it without closing the position picker");
    };
    let quick = await openQuick(); enter(quick.input, "Captured body"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Task");
    assert(quick.label.hidden && quick.input.getAttribute("aria-label") === "Task", "Quick Add Task has an accessible canonical editor without a visible content heading");
    await click(quick.contentEl, "Note");
    const actions = quick.contentEl.querySelector('.hub-capture-note-actions');
    assert(actions.getAttribute("aria-label") === "Action" && actions.querySelector('[aria-label="New note"]').getAttribute("aria-pressed") === "true", "First Note selection defaults to New note in the Action section");
    assert(getComputedStyle(actions.querySelector('[aria-pressed=true]')).backgroundColor === "rgb(139, 92, 246)", "Note Action retains its purple semantic selection");
    assert(actions.querySelector('[data-icon="notebook"]') && actions.querySelector('[data-icon="plus"]') && actions.querySelector('[data-icon="notebook-pen"]'), "Note Action uses the notebook-plus composite and notebook-pen icons");
    assert(quick.label.hidden && quick.input.value === "Captured body", "Note content heading is removed and the canonical content value is preserved");
    await select(quick.contentEl, "Save to", project.projectId); await select(quick.contentEl, "Destination folder", project.root + "/Design");
    setField(quick.contentEl, "Note title", "Remember this title"); await settle();
    await click(quick.contentEl, "Add text to existing note");
    assert(!quick.contentEl.querySelector('[aria-label="Destination folder"],[aria-label="Note title"]') && quick.contentEl.querySelector('button[aria-label="Location"]').textContent.includes("Choose note and position..."), "Existing-note mode replaces Folder and Title with Location");
    assert(quick.contentEl.querySelector('button[aria-label="Location"] [data-icon="notebook-text"]') && !quick.send.disabled && isBlocked(quick.add), "Incomplete existing-note mode keeps Send to Inbox available and uses the Markdown-note location icon");
    let picker = await openPicker(quick.contentEl);
    const emptyMode = picker.positions.querySelector('[data-note-selector="mode"]');
    assert(picker.positions.querySelector('h3').textContent === "Place in note" && emptyMode.disabled && emptyMode.textContent === "Select a note first" && picker.positions.querySelectorAll('button').length === 1, "Place in note is visible immediately with one disabled neutral prompt before note selection");
    assert(picker.contentEl.querySelector("h2").textContent === "Choose note and position" && !picker.contentEl.querySelector("h2 svg") && picker.contentEl.querySelector("p").textContent === project.name, "Picker header preserves the native title and understated workspace name");
    assert(picker.contentEl.querySelector("input").placeholder === "Search notes and folders..." && picker.use.disabled, "Picker search uses exact copy and Use this position starts disabled");
    assert(!picker.contentEl.querySelector('[data-capture-path$=".pdf"]') && !picker.contentEl.querySelector(`[data-capture-path="${project.root}"]`), "Only Markdown notes and actual workspace folders appear; Project root stays excluded");
    let folderRow = picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder"]`);
    folderRow.click(); await settle();
    assert(folderRow.getAttribute("aria-selected") === "false" && picker.use.disabled && !picker.contentEl.querySelector(`[data-capture-path="${path}"]`), "Folders collapse for navigation without completing a note destination");
    folderRow = picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder"]`); folderRow.focus();
    folderRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })); await settle();
    assert(picker.contentEl.querySelector(`[data-capture-path="${path}"]`) && document.activeElement.dataset.capturePath.endsWith("Nested folder"), "Keyboard ArrowRight expands a folder and retains tree focus");
    folderRow = document.activeElement; folderRow.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })); await settle();
    enter(picker.contentEl.querySelector("input"), "Position targets"); await settle();
    assert(picker.contentEl.querySelector(`[data-capture-path="${path}"]`) && picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder"]`), "Search discovers nested notes and keeps their ancestors even when collapsed");
    await pickNote(picker);
    const mode = picker.positions.querySelector('[data-note-selector="mode"]');
    assert(picker.positions.querySelectorAll('button').length === 1 && !picker.positions.querySelector('select') && mode.textContent === "At the end of the note", "Place in note uses one conventional dropdown and defaults to note end");
    mode.focus(); mode.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); await settle();
    assert(window.lastMenu.items.map(item => item.title).join("|") === "At the end of the note|At the start of the note|Under heading|In list", "Mode menu preserves the required option order");
    assert(window.lastMenu.items[0].checked && !picker.use.disabled && !window.lastMenu.items[2].disabled && !window.lastMenu.items[3].disabled, "A newly selected note defaults to End and enables detected headings and lists");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await settle();
    assert(mode.getAttribute("aria-expanded") === "false" && document.activeElement === mode && picker.containerEl.isConnected, "Escape dismisses only the selector menu and returns keyboard focus");
    await click(picker.contentEl, "At the start of the note");
    assert(picker.selection.position === "start" && !picker.use.disabled && picker.positions.querySelectorAll('button').length === 1, "Note start is immediately complete without secondary controls");
    await click(picker.contentEl, "At the end of the note");
    picker.use.focus(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    assert(document.activeElement === picker.closeButton, "Tab from the picker footer stays trapped in the topmost modal");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    assert(document.activeElement === picker.use, "Shift+Tab wraps inside the active note-position picker");
    assert(!quick.form.value().noteLocation, "Selecting a note inside the picker does not commit a partial Location");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await settle();
    assert(!picker.containerEl.isConnected && quick.containerEl.isConnected && !quick.form.value().noteLocation && document.activeElement === quick.contentEl.querySelector('[aria-label="Location"]'), "Escape closes only the nested picker and restores Location focus without committing");
    picker = await openPicker(quick.contentEl); await pickNote(picker); await click(picker.contentEl, "Under heading");
    assert(picker.selection.targetType === "heading" && picker.selection.position === "end" && picker.positions.querySelector('[data-note-selector="position"]').textContent === "End of section", "Heading selection defaults to End of section");
    verifyPositionLayout(picker);
    const heading = picker.positions.querySelector('[data-note-selector="target"]'); heading.click(); await settle();
    assert(window.lastMenu.items.some(item => item.title === "Quick Add") && window.lastMenu.items.some(item => item.title === "Open questions"), "Detected headings appear without Markdown markers in the native target menu");
    window.lastMenu.items.find(item => item.title === "Quick Add").element.click(); await settle();
    await click(picker.contentEl, "Top of section"); await click(picker.contentEl, "Under heading");
    assert(picker.selection.position === "top" && picker.selection.label === "Quick Add", "Clicking the already selected heading choice preserves its target and contextual position");
    await click(picker.contentEl, "Use this position");
    assert(quick.form.value().noteLocation.position === "top" && quick.contentEl.querySelector('[aria-label="Location"]').textContent.includes("Position targets · Quick Add · Top of section"), "Use this position commits a concise atomic heading-location summary");
    assert(!isBlocked(quick.add) && quick.send.disabled && document.activeElement === quick.contentEl.querySelector('[aria-label="Location"]'), "A complete existing-note Location enables Add, disables Send and restores field focus");
    picker = await openPicker(quick.contentEl);
    assert(picker.selection.position === "top" && picker.selection.targetType === "heading", "Reopening restores the committed note and contextual position");
    picker.contentEl.querySelector(`[data-capture-path="${plainPath}"]`).click(); await settle();
    picker.positions.querySelector('[data-note-selector="mode"]').click(); await settle();
    assert(picker.selection.targetType === "note" && picker.selection.position === "end" && window.lastMenu.items.find(item => item.title === "Under heading").disabled && window.lastMenu.items.find(item => item.title === "In list").disabled,
        "Selecting another note resets End by default and disables unavailable structural targets");
    window.lastMenu.hide();
    picker.contentEl.querySelector(`[data-capture-path="${longPath}"]`).click(); await settle();
    for (const label of ["Under heading", "In list"]) {
        await click(picker.contentEl, label); verifyPositionLayout(picker);
        const text = picker.positions.querySelector('[data-note-selector="target"] > span:first-child');
        assert(text.scrollWidth > text.clientWidth && text.hasAttribute('aria-label') && picker.modalEl.getBoundingClientRect().width <= Math.min(560, innerWidth - 32), "Long structural labels truncate with useful tooltips without widening the modal");
    }
    await pickNote(picker);
    await click(picker.contentEl, "In list");
    assert(picker.selection.position === "last" && picker.positions.querySelector('[data-note-selector="target"]').textContent.includes("Open questions"), "List targets use their containing heading and default to Last item");
    verifyPositionLayout(picker);
    await click(picker.contentEl, "First item"); await click(picker.contentEl, "Cancel");
    assert(quick.form.value().noteLocation.targetType === "heading" && quick.form.value().noteLocation.position === "top", "Cancel preserves the previously committed Location instead of the modal draft");
    await click(quick.contentEl, "New note");
    assert(quick.form.value().folder === project.root + "/Design" && quick.contentEl.querySelector('[aria-label="Note title"]').value === "Remember this title", "Switching back restores New note Folder and Title");
    await click(quick.contentEl, "Add text to existing note");
    assert(quick.form.value().noteLocation.position === "top" && quick.input.value === "Captured body", "Switching actions preserves the existing-note Location and canonical content");
    await select(quick.contentEl, "Save to", resource.projectId);
    assert(!quick.form.value().folder && !quick.form.value().noteLocation && isBlocked(quick.add) && !quick.send.disabled, "Changing workspace clears both mode-specific destinations and updates completeness");
    await select(quick.contentEl, "Save to", project.projectId);
    picker = await openPicker(quick.contentEl); await pickNote(picker); await click(picker.contentEl, "Use this position");
    const fileCount = objects.size; await click(quick.contentEl, "Add to Itacan");
    assert(!quick.containerEl.isConnected && objects.size === fileCount && contents.get(path) === original + "\nCaptured body\n", "Direct existing-note Add appends raw captured text once and creates no new file or source-metadata body");
    assert(plugin.changedPath === path, "Existing-note mutation marks its workspace as changed through the normal hook");

    quick = await openQuick(); enter(quick.input, "A partial existing-note capture"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
    await click(quick.contentEl, "Add text to existing note"); await select(quick.contentEl, "Save to", project.projectId);
    await click(quick.contentEl, "Send to Inbox");
    const capture = service.list().find(item => item.text === "A partial existing-note capture");
    assert(capture.intent.noteAction === "existing" && capture.intent.workspaceId === project.projectId && !capture.intent.noteLocation, "Send to Inbox preserves Note Action and workspace without inventing a Location");
    let inbox = await openInbox(); await inbox.select(capture.id); await settle();
    assert(inbox.mode === "note" && inbox.form.value().noteAction === "existing" && inbox.form.value().workspaceId === project.projectId && !inbox.detail.querySelector('.hub-capture-types') && !inbox.detail.querySelector('[aria-label="Destination folder"],[aria-label="Note title"]'), "Typed Note resumes its existing-note continuation without intrusive Type buttons");
    assert(isBlocked(inbox.save) && ![...inbox.detail.querySelectorAll('button')].some(button => button.textContent.trim() === "Cancel"), "Incomplete existing-note Inbox continuation has disabled Add and no Cancel");
    picker = await openPicker(inbox.detail); await pickNote(picker); await click(picker.contentEl, "In list"); await click(picker.contentEl, "First item");
    assert(!getPersisted().inbox.captures.find(item => item.id === capture.id).intent.noteLocation, "In-modal note and list choices never leak into Capture persistence");
    await click(picker.contentEl, "Use this position");
    assert(getPersisted().inbox.captures.find(item => item.id === capture.id).intent.noteLocation.position === "first" && !isBlocked(inbox.save), "Atomic Location immediately autosaves and enables Inbox completion");
    enter(inbox.detail.querySelector('textarea'), "Persistent inserted line\nContinuation"); await settle(); await inbox.close(); await settle();
    plugin.projectWizard.data = JSON.parse(JSON.stringify(getPersisted()));
    const reloaded = new (load("services/inbox").HubInboxService)(plugin);
    inbox = new (load("ui/inbox").InboxModal)(plugin.app, reloaded); inbox.open(); await inbox.select(capture.id); await settle();
    assert(inbox.mode === "note" && inbox.form.value().noteAction === "existing" && inbox.form.value().noteLocation.position === "first" && inbox.detail.querySelector('textarea').value === "Persistent inserted line\nContinuation" && !isBlocked(inbox.save), "Restart restores Action, workspace, committed list Location and content after revalidation");
    await click(inbox.detail, "Add to Itacan");
    assert(!reloaded.get(capture.id) && contents.get(path).includes("* Persistent inserted line\n  Continuation\n* First question"), "Inbox completion creates one multiline first list item and resolves its Capture");
    await inbox.close(); await settle(); reloaded.destroy(); service.emit();

    quick = await openQuick(); enter(quick.input, "Retry existing insertion once"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
    await click(quick.contentEl, "Add text to existing note"); await select(quick.contentEl, "Save to", project.projectId);
    picker = await openPicker(quick.contentEl); await pickNote(picker); await click(picker.contentEl, "In list"); await click(picker.contentEl, "Use this position");
    setFailResolutionText("Retry existing insertion once"); await click(quick.contentEl, "Add to Itacan");
    const retryId = quick.captureId;
    assert(retryId && service.get(retryId).operation.state === "ready" && !isBlocked(quick.add) && quick.input.disabled && contents.get(path).split("Retry existing insertion once").length === 2, "Failed final save retains a retryable receipt while locking already-inserted content");
    await click(quick.contentEl, "Cancel"); inbox = await openInbox(); await inbox.select(retryId); await settle();
    assert(inbox.mode === "note" && inbox.form.value().noteAction === "existing" && !isBlocked(inbox.save), "Inbox resumes an existing-note receipt even though insertion changed the original list anchor");
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(retryId) && contents.get(path).split("Retry existing insertion once").length === 2, "Retry finishes Capture removal without duplicating the insertion");
    await inbox.close(); await settle();

    quick = await openQuick(); enter(quick.input, "Do not insert into a missing heading"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
    await click(quick.contentEl, "Add text to existing note"); await select(quick.contentEl, "Save to", project.projectId);
    picker = await openPicker(quick.contentEl); await pickNote(picker); await click(picker.contentEl, "Under heading"); await click(picker.contentEl, "Use this position");
    await vault.modify(target, contents.get(path).replace("# Quick Add", "# Renamed")); await settle();
    assert(!quick.form.value().noteLocation && isBlocked(quick.add) && !quick.send.disabled && !contents.get(path).includes("Do not insert into a missing heading"), "Changed structural target becomes incomplete without guessing another insertion position");
    await quick.close(); await settle();
}

async function verifyPartialCaptures({ service, plugin, memory, project, resource, openQuick, openInbox, load, select, click, setField, count, assertViewport, getPersisted, setFailSave }) {
    const { HubInboxService } = load("services/inbox"), { InboxModal } = load("ui/inbox");
    const enter = (element, text) => { element.value = text; element.dispatchEvent(new Event("input", { bubbles: true })); };
    const find = text => service.list().find(item => item.text === text);
    let quick = await openQuick(); enter(quick.input, "Partial Task continuation"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Task");
    await select(quick.contentEl, "Save to", project.projectId); await click(quick.contentEl, "Must do");
    setField(quick.contentEl, "Start date", "2026-10-12T00:00"); setField(quick.contentEl, "Start date", "2026-10-12T09:30");
    setField(quick.contentEl, "Due date", "2026-10-14T00:00"); setField(quick.contentEl, "Due date", "2026-10-14T15:45");
    await select(quick.contentEl, "Project phase", "phase1"); await click(quick.contentEl, "Add step"); setField(quick.contentEl, "Step text", "Preserved partial Step");
    assert(isBlocked(quick.add) && !quick.send.disabled, "A partial Task with missing location can only be sent to Inbox");
    await click(quick.contentEl, "Send to Inbox"); const task = find("Partial Task continuation");
    assert(task?.intent?.type === "task" && task.intent.workspaceId === project.projectId && !task.intent.location, "Sending a partial Task preserves its type/workspace and missing location");
    assert(task.intent.necessity === "must" && task.intent.fromDate === "2026-10-12" && task.intent.fromTime === "09:30" && task.intent.dueDate === "2026-10-14" && task.intent.dueTime === "15:45" && task.intent.phaseId === "phase1" && task.intent.steps[0].text === "Preserved partial Step", "Partial Task preserves necessity, both date/time pairs, phase and Steps: " + JSON.stringify(task.intent));

    quick = await openQuick(); enter(quick.input, "Partial Note content\nPreserve the second line"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
    await select(quick.contentEl, "Save to", resource.projectId); setField(quick.contentEl, "Note title", "Partial Note title");
    assert(isBlocked(quick.add) && !quick.send.disabled && quick.contentEl.querySelectorAll("textarea").length === 1, "Partial Note requires a folder and has only one canonical content editor");
    await click(quick.contentEl, "Send to Inbox"); const note = find("Partial Note content\nPreserve the second line");
    assert(note?.intent?.type === "note" && note.intent.workspaceId === resource.projectId && note.intent.title === "Partial Note title", "Partial Note preserves workspace, entered title and full content");

    quick = await openQuick(); enter(quick.input, "Preserve selected folder"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
    await select(quick.contentEl, "Save to", resource.projectId); await select(quick.contentEl, "Destination folder", resource.root + "/Quantum Gravity");
    setField(quick.contentEl, "Note title", "");
    assert(isBlocked(quick.add) && !quick.send.disabled, "Clearing the required Note title immediately restores only Send to Inbox");
    await click(quick.contentEl, "Send to Inbox"); const routedNote = find("Preserve selected folder");
    assert(routedNote.intent.folder === resource.root + "/Quantum Gravity" && routedNote.intent.title === "", "A partial Note preserves its selected folder and intentionally cleared title");

    quick = await openQuick(); enter(quick.input, "Preserve both Task lines\nUntil deliberately edited"); await click(quick.contentEl, "More options"); await click(quick.contentEl, "Task");
    await select(quick.contentEl, "Save to", project.projectId); await select(quick.contentEl, "Location", project.root + "/Design");
    assert(isBlocked(quick.add) && !quick.send.disabled, "Multiline Task text remains incomplete under the canonical single-line Task rule");
    await click(quick.contentEl, "Send to Inbox"); const multilineTask = find("Preserve both Task lines\nUntil deliberately edited");

    quick = await openQuick(); await quick.addAttachments([new File(["partial bytes"], "partial-file.pdf", { type: "application/pdf" })]); await settle();
    await click(quick.contentEl, "More options"); await select(quick.contentEl, "Save to", project.projectId);
    const fileRef = quick.draft.attachments[0]; assert(isBlocked(quick.add) && !quick.send.disabled, "Partial File waits for a valid folder while Send to Inbox remains available");
    await click(quick.contentEl, "Send to Inbox"); const file = service.list().find(item => item.attachments[0]?.id === fileRef.id);
    assert(file?.intent?.type === "file" && file.intent.workspaceId === project.projectId && memory.objects.has(fileRef.path), "Partial File preserves its binary reference and workspace routing choice");

    const reloadedPlugin = { ...plugin, projectWizard: { ...plugin.projectWizard, data: JSON.parse(JSON.stringify(getPersisted())) } };
    const reloaded = new HubInboxService(reloadedPlugin);
    const restored = new InboxModal(plugin.app, reloaded); restored.open(); await settle();
    const selectRestored = async id => { restored.list.querySelector(`[data-capture-id="${id}"]`).click(); await settle(); assertViewport(restored); };
    await selectRestored(task.id);
    assert(restored.mode === "task" && !restored.detail.querySelector(".hub-inbox-actions-section,.hub-capture-types") && restored.taskInput.value === task.text, "Reloaded pre-typed Task opens its continuation without Type buttons");
    assert(restored.form.value().workspaceId === project.projectId && restored.form.value().necessity === "must" && restored.form.value().fromTime === "09:30" && restored.form.value().dueTime === "15:45" && restored.form.value().phaseId === "phase1" && restored.form.value().steps[0].text === "Preserved partial Step" && isBlocked(restored.save), "Reloaded Task continuation retains all optional values and requires only its missing location");
    assert(restored.detail.querySelectorAll('.hub-date-time-trigger').length === 2 && !restored.detail.textContent.includes("Include time") && !restored.detail.textContent.includes("Break the task into smaller actions"), "Inbox Task inherits the shared date and Steps polish");
    verifyTaskDateTime(restored.detail, restored.form);
    await selectRestored(note.id);
    assert(!restored.detail.querySelector('.hub-capture-label') && restored.detail.querySelector('textarea[aria-label="Note content"]'), "Inbox Note has an accessible content field without a visible Note content heading");
    assert(restored.mode === "note" && restored.detail.querySelector('[aria-label="Note title"]').value === "Partial Note title" && restored.detail.querySelector("textarea").value === note.text && restored.form.value().workspaceId === resource.projectId && isBlocked(restored.save), "Reloaded pre-typed Note resumes its preserved title/content/workspace with missing folder");
    await selectRestored(routedNote.id);
    assert(restored.mode === "note" && restored.form.value().folder === resource.root + "/Quantum Gravity" && restored.detail.querySelector('[aria-label="Note title"]').value === "" && isBlocked(restored.save), "Reloaded partial Note retains selected folder and still requires its cleared title");
    await selectRestored(multilineTask.id);
    assert(restored.mode === "task" && restored.taskInput.tagName === "TEXTAREA" && restored.taskInput.value === multilineTask.text && restored.detail.querySelectorAll(':is(input,textarea)[aria-label="Task"]').length === 1 && isBlocked(restored.save), "Reloaded pre-typed multiline Task preserves every line in one canonical editor without silent truncation");
    enter(restored.taskInput, "Preserve both Task lines until deliberately edited");
    assert(!isBlocked(restored.save) && restored.form.value().location === project.root + "/Design", "Deliberately editing Task text to one line enables creation with its preserved routing");
    await selectRestored(file.id);
    const titleRect = restored.detail.querySelector('.hub-inbox-action-heading').getBoundingClientRect(), fileRect = restored.detail.querySelector('.hub-capture-attachment').getBoundingClientRect();
    const previewGap = fileRect.top + restored.detail.querySelector('.hub-inbox-action-body').scrollTop - titleRect.bottom;
    assert(previewGap >= 0 && previewGap <= 14, "Inbox File preview retains its compact intrinsic gap even when guidance scrolls to Folder");
    assert(restored.mode === "file" && !restored.detail.querySelector("textarea,.hub-capture-types,.hub-inbox-actions-section") && restored.form.value().workspaceId === project.projectId && restored.form.value().attachments[0].id === fileRef.id && isBlocked(restored.save), "Reloaded File opens routing directly and preserves file/workspace without classification");
    restored.close();

    const inbox = await openInbox();
    const choose = async id => { inbox.list.querySelector(`[data-capture-id="${id}"]`).click(); await settle(); };
    await choose(task.id); await select(inbox.detail, "Location", project.root + "/Design");
    assert(!isBlocked(inbox.save) && inbox.save.textContent.trim() === "Add to Itacan", "Completing the missing Location enables Add to Itacan immediately");
    const beforeTask = count(); setFailSave(); await click(inbox.detail, "Add to Itacan");
    assert(service.get(task.id) && count() === beforeTask && inbox.form.value().fromTime === "09:30" && inbox.error.textContent.includes("Simulated persistence failure"), "Failed partial Task persistence keeps the Capture and optional form values intact");
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(task.id) && count() === beforeTask - 1 && inbox.selectedId && inbox.selectedId !== task.id && memory.contents.get(project.root + "/Design/Tasks.md").includes(task.text), "Successful Task continuation persists the canonical Task, resolves Capture and selects the next item");
    await choose(note.id); await select(inbox.detail, "Destination folder", resource.root + "/Quantum Gravity");
    assert(!isBlocked(inbox.save), "Completing the missing Note folder enables Add to Itacan"); await click(inbox.detail, "Add to Itacan");
    assert(!service.get(note.id) && memory.contents.get(resource.root + "/Quantum Gravity/Partial Note title.md").includes(note.text), "Note continuation persists preserved content before resolving its Capture");
    await choose(routedNote.id); setField(inbox.detail, "Note title", "Completed routed Note");
    assert(!isBlocked(inbox.save) && inbox.form.value().folder === resource.root + "/Quantum Gravity", "Completing only the missing Note title reuses its preserved folder"); await click(inbox.detail, "Add to Itacan");
    await choose(multilineTask.id); enter(inbox.taskInput, "Preserve both Task lines until deliberately edited");
    assert(!isBlocked(inbox.save) && inbox.detail.querySelectorAll(':is(input,textarea)[aria-label="Task"]').length === 1, "A pre-typed multiline Task has one source of truth when completed"); await click(inbox.detail, "Add to Itacan");
    assert(!service.get(multilineTask.id) && memory.contents.get(project.root + "/Design/Tasks.md").includes("Preserve both Task lines until deliberately edited"), "Completing pre-typed multiline text creates one canonical Task and resolves its Capture");
    await choose(file.id); await select(inbox.detail, "Destination folder", project.root + "/Design");
    assert(!isBlocked(inbox.save), "Completing only the File folder enables Add to Itacan"); const beforeFile = count(); memory.vault.failMove = true;
    await click(inbox.detail, "Add to Itacan");
    assert(service.get(file.id) && count() === beforeFile && memory.objects.has(fileRef.path), "Failed File continuation keeps its Capture and staged bytes intact");
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(file.id) && count() === beforeFile - 1 && memory.objects.has(project.root + "/Design/partial-file.pdf") && !memory.objects.has(fileRef.path), "File continuation moves its canonical file once and resolves its Capture after persistence");
    assert(inbox.filterButtons[0].button.textContent.trim() === `All (${count()})` && document.querySelector(".hub-inbox-badge").textContent === String(count()), "Continuation completion updates the filter count and global badge immediately");
    inbox.close();
}

async function verifyPersistentInboxEdits({ service, plugin, project, resource, openInbox, load, stage, select, click, setField, getPersisted }) {
    const source = { origin: "Quick Add", path: "Home.md", title: "Home" };
    const task = await service.capture({ text: "An unfinished thought", source });
    const note = await service.capture({ text: "Note before classification", source });
    const refs = await stage("persist-routing.pdf", "application/pdf"), file = await service.capture({ type: "file", attachments: refs });
    let inbox = await openInbox();
    const choose = async id => { await inbox.select(id); await settle(); };
    const enter = (element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); };
    await choose(task.id);
    enter(inbox.detail.querySelector("textarea"), ""); await inbox.flushEdits();
    assert(service.get(task.id).text === "" && service.count > 0, "Clearing an existing unsorted item persists without deleting the Capture");
    await click(inbox.detail, "Task");
    assert(inbox.mode === "task" && isBlocked(inbox.save) && service.get(task.id).intent.type === "task", "An empty persistent item may be classified but cannot be created");
    enter(inbox.taskInput, "A persistent Task edit");
    await select(inbox.detail, "Save to", project.projectId); await click(inbox.detail, "Should do");
    setField(inbox.detail, "Start date", "2026-10-18T00:00"); setField(inbox.detail, "Start date", "2026-10-18T10:30");
    await click(inbox.detail, "Add step"); setField(inbox.detail, "Step text", "An edited saved Step");
    await select(inbox.detail, "Project phase", "phase1");
    await assertSharedTaskForm(inbox.detail);
    await choose(note.id); await click(inbox.detail, "Note");
    enter(inbox.detail.querySelector("textarea"), "Edited persistent Note content\nSecond line");
    setField(inbox.detail, "Note title", "Persistent title");
    await select(inbox.detail, "Save to", resource.projectId); await select(inbox.detail, "Destination folder", resource.root + "/Quantum Gravity");
    await choose(file.id);
    await select(inbox.detail, "Save to", project.projectId); await select(inbox.detail, "Destination folder", project.root + "/Design");
    await choose(task.id);
    assert(inbox.taskInput.value === "A persistent Task edit" && inbox.form.value().necessity === "should" && inbox.form.value().fromTime === "10:30" && inbox.form.value().steps[0].text === "An edited saved Step" && inbox.form.value().phaseId === "phase1", "Switching Captures retains all edited Task details");
    enter(inbox.taskInput, "Last edit immediately before closing"); await inbox.close();
    const { HubInboxService } = load("services/inbox");
    const reloadedPlugin = { ...plugin, projectWizard: { ...plugin.projectWizard, data: JSON.parse(JSON.stringify(getPersisted())) } };
    const reloaded = new HubInboxService(reloadedPlugin);
    assert(reloaded.get(task.id).text === "Last edit immediately before closing" && reloaded.get(task.id).intent.necessity === "should" && reloaded.get(task.id).intent.steps[0].text === "An edited saved Step", "Closing waits for the latest Task edits and a fresh service restores them");
    assert(reloaded.get(note.id).intent.type === "note" && reloaded.get(note.id).intent.title === "Persistent title" && reloaded.get(note.id).text === "Edited persistent Note content\nSecond line" && reloaded.get(note.id).intent.folder === resource.root + "/Quantum Gravity", "Note classification, title, content and folder edits survive restart");
    assert(reloaded.get(file.id).intent.workspaceId === project.projectId && reloaded.get(file.id).intent.folder === project.root + "/Design" && reloaded.get(file.id).attachments[0].id === refs[0].id, "File routing edits persist without changing the binary reference");
    assert(JSON.stringify(reloaded.get(task.id).source) === JSON.stringify(source), "Source metadata stays persisted while absent from the Unsorted decision surface");
    inbox = await openInbox(); await choose(note.id);
    assert(inbox.mode === "note" && inbox.detail.querySelector('[aria-label="Note title"]').value === "Persistent title" && !inbox.detail.textContent.includes("Cancel") && !isBlocked(inbox.save), "Reopening a complete Note preserves its fields and footer validation");
    const save = plugin.dataStore.save;
    plugin.dataStore.save = async () => { throw Error("Simulated persistent edit failure"); };
    try {
        enter(inbox.detail.querySelector("textarea"), "Do not discard this failed edit"); await settle();
        await inbox.select(file.id); await inbox.close();
        assert(inbox.containerEl.isConnected && inbox.selectedId === note.id && inbox.detail.querySelector("textarea").value === "Do not discard this failed edit" && inbox.error.textContent.includes("Simulated persistent edit failure"), "A failed edit blocks navigation/close and keeps its visible text for recovery");
    } finally { plugin.dataStore.save = save; }
    await inbox.close();
    assert(!inbox.containerEl.isConnected && service.get(note.id).text === "Do not discard this failed edit", "Retrying close after persistence recovers saves the pending edit");
    const remainder = await service.capture({ text: "Already completed legacy Task\nKeep its remaining source content", source });
    await service.makeTask({ text: remainder.text, taskTitle: "Already completed legacy Task", workspaceId: project.projectId, location: project.root + "/Design" }, remainder.id);
    inbox = await openInbox(); await choose(remainder.id);
    assert(inbox.mode === "unsorted" && inbox.detail.querySelector("h3").textContent === "Text" && inbox.detail.querySelector('button[aria-label="Task"]').disabled && !inbox.detail.querySelector(".hub-inbox-actions-section,.hub-capture-source"), "Legacy text remainders use the Text surface while preventing a duplicate already-created Task");
    const remainderMenu = await itemMenu(inbox, remainder.id);
    assert(!remainderMenu.items.some(item => item.title === "Change type"), "Already-created legacy remainders omit invalid Task/Note conversion"); remainderMenu.hide();
    await click(inbox.detail, "Note");
    assert(inbox.mode === "note" && service.get(remainder.id).intent.type === "note" && inbox.detail.querySelector("textarea").value === remainder.text, "Legacy remaining text can immediately continue as a persistent Note without losing content");
    await inbox.close(); await service.delete(remainder.id);
    for (const item of [task, note, file]) await service.delete(item.id);
}

async function verifyInboxOrganisation({ plugin, project, resource, load, stage, select, click, setField }) {
    const { HubInboxService } = load("services/inbox"), { InboxModal } = load("ui/inbox");
    let persisted = {}, writes = 0;
    const testPlugin = { ...plugin, projectWizard: { ...plugin.projectWizard, data: {} },
        dataStore: { save: async data => { writes++; persisted = JSON.parse(JSON.stringify(data)); } } };
    const service = new HubInboxService(testPlugin);
    const open = async () => { const modal = new InboxModal(plugin.app, service); modal.open(); await settle(); return modal; };
    let inbox = await open();
    const rowIds = () => [...inbox.list.querySelectorAll("[data-capture-id]")].map(row => row.dataset.captureId);
    const row = id => inbox.rows.get(id);
    const counts = () => inbox.filterButtons.map(item => item.button.textContent.trim());
    const checkCounts = () => {
        const files = service.captures.filter(item => item.attachments.length).length;
        assert(counts().join("|") === `All (${service.count})|Texts (${service.count - files})|Files (${files})`, "All three filter counts remain global and live");
    };
    const checkCompletion = id => {
        const capture = service.get(id), state = service.getInboxCompletion(capture, id === inbox.selectedId ? inbox.form?.value() ?? inbox.draft : undefined);
        const remaining = state.totalRequired - state.completedRequired;
        const indicator = row(id), expected = state.ready ? "Ready" : state.totalRequired ? `${remaining} ${remaining === 1 ? "detail" : "details"} left` : "Choose type";
        assert(indicator.status.textContent === expected && progressValue(indicator.progress) / progressMax(indicator.progress) === state.ratio, "Status and accessible progress match the shared submission validator");
        assert(indicator.progress.children.length === state.totalRequired && indicator.progress.querySelectorAll('.is-complete').length === state.completedRequired, 'One segment per required detail and one filled segment per completed requirement');
        if (id === inbox.selectedId && inbox.form) assert(!isBlocked(inbox.save) === state.ready && inbox.form.valid() === state.ready, "Ready and Add to Itacan eligibility agree for the selected form");
        const description = indicator.progress.getAttribute("aria-label");
        assert(description && indicator.button.getAttribute("aria-describedby") === indicator.progress.id && indicator.progress.getAttribute("aria-valuetext") === description, "Each row exposes an accessible completeness description");
        assert(!inbox.detail.querySelector("progress,.hub-inbox-completion-label,.hub-inbox-completion-progress"), "Completeness exists only in the left list");
        const style = getComputedStyle(indicator.progress), heading = indicator.status.getBoundingClientRect(), title = indicator.title.getBoundingClientRect();
        assert(parseFloat(style.height) >= 3 && parseFloat(style.height) <= 4 && style.transitionDuration === "0s" && style.animationName === "none" && parseFloat(style.borderWidth) === 0, "Segmented progress retains its thin footprint without animation or extra border");
        assert([...indicator.progress.children].every(segment => getComputedStyle(segment).backgroundColor === (segment.classList.contains('is-complete') ? 'rgb(139, 92, 246)' : 'rgb(52, 52, 52)')), 'Segment fill and track retain the established accent/neutral colors');
        if (state.totalRequired) {
            const segments = [...indicator.progress.children].map(segment => segment.getBoundingClientRect());
            assert(rgba(style.backgroundColor)[3] === 0 && segments.every((rect, index) => Math.abs(rect.width - segments[0].width) < 1 && (!index || Math.abs(rect.left - segments[index - 1].right - 3) < 1)), 'Purple and gray segments have equal widths and open three-pixel gaps without a continuous track underneath');
        }
        assert(heading.left >= title.right - 1 && indicator.progress.getBoundingClientRect().width >= indicator.title.parentElement.clientWidth - 1, "Secondary status stays right of the title and progress spans the usable content width");
        return state;
    };
    checkCounts();
    assert(inbox.sortOrder === "most-complete" && writes === 0 && inbox.list.textContent.includes("Your Inbox is empty"), "First use defaults to Most complete without writing a preference");
    assert(inbox.contentEl.querySelector(".hub-inbox-footer").textContent.trim() === "Close", "Empty Inbox footer contains only Close");
    const first = await service.capture({ text: "Unclassified older thought" }), second = await service.capture({ text: "Unclassified newer thought" });
    await service.save(service.captures.map((item, index) => ({ ...item, createdAt: index + 1 })));
    checkCounts();
    assert(rowIds().join("|") === [first.id, second.id].join("|"), "Untyped-only Most complete ties use oldest first");
    for (const item of [first, second]) {
        const state = checkCompletion(item.id);
        assert(state.ratio === 0 && row(item.id).status.textContent === "Choose type" && progressValue(row(item.id).progress) === 0 && row(item.id).progress.getAttribute("aria-label") === "Type not selected", "Untyped text asks to choose its type and retains an empty accessible track");
    }
    const rawFile = await service.capture({ attachments: await stage('Unclassified.pdf', 'application/pdf') });
    await inbox.select(rawFile.id); await settle();
    assert(checkCompletion(rawFile.id).totalRequired === 0 && row(rawFile.id).status.textContent === 'Choose type' && !row(rawFile.id).progress.children.length, 'Untyped files retain zero progress and no invented segments');
    await click(inbox.detail, 'File');
    assert(checkCompletion(rawFile.id).completedRequired === 0 && checkCompletion(rawFile.id).totalRequired === 2 && inbox.mode === 'file', 'Classifying a file establishes Workspace and Folder details without a payload point');
    await service.delete(rawFile.id);
    await inbox.select(first.id); await click(inbox.detail, "Task");
    assert(checkCompletion(first.id).completedRequired === 0 && checkCompletion(first.id).totalRequired === 2 && row(first.id).status.textContent === "2 details left", "Selecting Task establishes exactly two organisational details without a Type point");
    await click(inbox.detail, "Must do");
    setField(inbox.detail, "Start date", "2026-10-19T09:30");
    await click(inbox.detail, "Add step"); setField(inbox.detail, "Step text", "Optional step"); await settle();
    assert(checkCompletion(first.id).ratio === 0, "Necessity, date, time and Steps never add organisation progress");
    await select(inbox.detail, "Save to", project.projectId);
    assert(checkCompletion(first.id).ratio === 1 / 2, "Choosing the required workspace updates the indicator");
    await select(inbox.detail, "Location", project.root + "/Design");
    assert(checkCompletion(first.id).ready && progressValue(row(first.id).progress) === progressMax(row(first.id).progress) && row(first.id).progress.getAttribute("aria-label") === "All required details complete", "Complete required details show Ready and a full bar");
    const refs = await stage("organisation-file.pdf", "application/pdf");
    const file = await service.capture({ attachments: refs, workspaceId: project.projectId });
    const partialTask = await service.capture({ text: "One of two details", type: "task", workspaceId: project.projectId });
    const note = await service.capture({ text: "Three of four details", type: "note", noteAction: "new", workspaceId: resource.projectId,
        folder: resource.root + "/Quantum Gravity", title: "" });
    const emptyTask = await service.capture({ text: 'Two Task details remain', type: 'task' });
    const halfNote = await service.capture({ text: 'Two Note details remain', type: 'note', workspaceId: resource.projectId, title: '' });
    checkCompletion(emptyTask.id); checkCompletion(halfNote.id); checkCompletion(file.id); checkCompletion(note.id);
    assert(row(emptyTask.id).status.textContent === '2 details left' && row(halfNote.id).status.textContent === '2 details left' && row(emptyTask.id).progress.children.length === 2 && row(halfNote.id).progress.children.length === 4 && row(emptyTask.id).progress.querySelectorAll('.is-complete').length === 0 && row(halfNote.id).progress.querySelectorAll('.is-complete').length === 2, 'Equal details-left labels correspond to two gray segments in both the two-detail Task and four-detail Note schema');
    const targetFile = await plugin.app.vault.create(project.root + "/Design/Organisation targets.md", "# Organisation heading\n\n- Item\n");
    const parsed = await service.readNotePositions(project.projectId, targetFile.path);
    const insertion = await service.capture({ text: "Append under this heading", type: "note", noteAction: "existing", workspaceId: project.projectId,
        noteLocation: { path: targetFile.path, targetType: "heading", anchor: parsed.headings[0].anchor, position: "end" } });
    service.noteCache.clear(); inbox.refresh(); await settle();
    assert(checkCompletion(insertion.id).ready && service.noteCache.has(targetFile.path) && inbox.selectedId === first.id,
        "Unselected structural Note locations reload through the existing cache and become Ready without changing selection");
    await plugin.app.vault.modify(targetFile, "The heading was removed\n"); await settle();
    assert(!checkCompletion(insertion.id).ready && row(insertion.id).status.textContent === "1 detail left", "A changed Note target updates the left indicator through the same structural validator");
    await plugin.app.vault.modify(targetFile, "# Organisation heading\n\n- Item\n"); await settle();
    assert(checkCompletion(insertion.id).ready, "Revalidated structural Note identity restores readiness without another Location definition");
    for (let i = 0; i < 24; i++) await service.capture({ text: "Thought " + (i + 1) });
    await service.save(service.captures.map((item, index) => ({ ...item, createdAt: index + 1 })));
    await settle();
    checkCounts();
    assert(rowIds().indexOf(note.id) < rowIds().indexOf(partialTask.id) && rowIds().indexOf(file.id) < rowIds().indexOf(partialTask.id) && checkCompletion(note.id).ratio === 3 / 4 && checkCompletion(partialTask.id).ratio === 1 / 2 && checkCompletion(file.id).ratio === 1 / 2,
        "Most complete compares corrected denominators and breaks equal Task/File ratios by oldest first");
    await inbox.select(first.id); await settle();
    const form = inbox.form, editor = inbox.taskInput, selectedRow = row(first.id).button;
    editor.focus(); inbox.list.scrollTop = Math.min(80, inbox.list.scrollHeight - inbox.list.clientHeight);
    const orderBefore = rowIds().join("|"), scrollBefore = inbox.list.scrollTop;
    editor.value = ""; editor.dispatchEvent(new Event("input", { bubbles: true }));
    assert(row(first.id).status.textContent === "0 details left" && checkCompletion(first.id).ratio === 1 && isBlocked(inbox.save), "Invalid payload blocks creation without changing organisational progress");
    await settle();
    assert(rowIds().join("|") === orderBefore && !inbox.reorderPending && inbox.list.scrollTop === scrollBefore, "Payload edits leave completeness order and scroll stable without scheduling a redundant reorder");
    assert(inbox.selectedId === first.id && inbox.form === form && inbox.taskInput === editor && row(first.id).button === selectedRow && document.activeElement === editor,
        "Live progress preserves selection, row identity, form identity and caret focus");
    const anchor = [...inbox.list.children].find(element => element.getBoundingClientRect().bottom > inbox.list.getBoundingClientRect().top), anchorTop = anchor.getBoundingClientRect().top;
    inbox.sort.focus(); await settle();
    assert(rowIds().join("|") === service.list({ sort: "most-complete" }).map(item => item.id).join("|") && !inbox.reorderPending && inbox.selectedId === first.id && inbox.form === form,
        "Blurring the text field safely reorders without switching the detail pane");
    assert(Math.abs(anchor.getBoundingClientRect().top - anchorTop) <= 1, "Automatic reordering preserves the visible scroll anchor");
    editor.focus(); editor.value = "Ready again"; editor.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    assert(checkCompletion(first.id).ready && rowIds().join('|') === orderBefore, "Restoring valid payload restores Ready without inventing a progress step or moving the row");
    inbox.sort.focus(); await settle();
    assert(rowIds()[0] === first.id && inbox.selectedId === first.id, "Ready joins the 100% group when the edit commits");
    await select(inbox.contentEl, "Sort items", "least-complete");
    assert(rowIds().join("|") === service.list({ sort: "least-complete" }).map(item => item.id).join("|"), "Least complete places untyped items first with oldest-first ties");
    await click(inbox.filters, "Texts"); checkCounts();
    assert(inbox.sortOrder === "least-complete" && rowIds().every(id => !service.get(id).attachments.length), "Changing filter retains sort and only filters the visible list");
    await select(inbox.contentEl, "Sort items", "type");
    assert(inbox.filter === "text" && rowIds().join("|") === service.list({ sort: "type", filter: "text" }).map(item => item.id).join("|"), "Type sorting composes with Texts and keeps the filter");
    await click(inbox.filters, "All");
    assert(rowIds().join("|") === service.list({ sort: "type" }).map(item => item.id).join("|"), "Type groups untyped, Task, Note and File with oldest-first ties");
    await select(inbox.contentEl, "Sort items", "oldest");
    assert(rowIds().join("|") === service.list({ sort: "oldest" }).map(item => item.id).join("|"), "Oldest first is purely chronological");
    await select(inbox.contentEl, "Sort items", "newest");
    assert(rowIds().join("|") === service.list({ sort: "newest" }).map(item => item.id).join("|"), "Newest first is purely chronological");
    await inbox.close(); await settle();
    assert(persisted.inboxSort === "newest", "Manual sort is saved in the existing plugin-data store");
    inbox = await open();
    assert(inbox.sortOrder === "newest" && inbox.sortLabel.textContent === "Newest first", "Inbox restores the manually selected sort on reopening");
    const restored = new HubInboxService({ ...testPlugin, projectWizard: { ...testPlugin.projectWizard, data: JSON.parse(JSON.stringify(persisted)) } });
    assert(restored.sortPreference === "newest", "Sort preference survives a fresh service/plugin-data reload"); restored.destroy();
    await inbox.select(note.id); await settle();
    setField(inbox.detail, "Note title", "Ready note"); await settle();
    assert(checkCompletion(note.id).ready && !inbox.detail.querySelector("label[for$='-content']"), "Note title updates shared readiness and preserves the removed visible content heading");
    await click(inbox.filters, "Files"); checkCounts();
    await inbox.select(file.id); await settle();
    assert(checkCompletion(file.id).completedRequired === 1, "File progress counts workspace and folder without the raw payload");
    await select(inbox.detail, "Destination folder", project.root + "/Design");
    assert(checkCompletion(file.id).ready, "Selecting Folder makes File Ready through the same validation");
    const beforeAdd = service.count;
    await click(inbox.detail, "Add to Itacan"); checkCounts();
    assert(service.count === beforeAdd - 1 && !rowIds().includes(file.id) && inbox.filter === "files" && inbox.sortOrder === "newest", "Add to Itacan updates counts and list without resetting filter or sort");
    await click(inbox.filters, "All"); await inbox.select(second.id); await settle();
    const beforeDelete = service.count;
    await click(inbox.detail, "Delete"); await click(inbox.confirmation.contentEl, "Delete"); checkCounts();
    assert(service.count === beforeDelete - 1 && !rowIds().includes(second.id) && inbox.selectedId && inbox.selectedId !== second.id, "Delete updates counts/order and retains sensible selection");
    await inbox.close(); await settle();
    for (const item of [...service.captures]) await service.delete(item.id);
    service.destroy();
    await plugin.app.vault.delete(targetFile);
}

async function verifyQuickAddGuidance({ service, project, resource, openQuick, select, click, setField }) {
    const before = service.count, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let quick = await openQuick();
    quick.input.value = 'Organise this thought'; quick.input.dispatchEvent(new Event('input', { bubbles: true }));
    await click(quick.contentEl, 'More options');
    assert(!quick.body.querySelector('.hub-attention') && !quick.add.disabled && isBlocked(quick.add), 'Incomplete Quick Add accepts an explicit validation attempt without guiding on open');
    const type = quick.body.querySelector('[data-capture-field="Type"]'), bounds = type.getBoundingClientRect();
    const labelColor = getComputedStyle(type.querySelector('.hub-capture-field-title')).color;
    const buttonColor = getComputedStyle(type.querySelector('button')).backgroundColor;
    await click(quick.contentEl, 'Add to Itacan');
    assert(quick.body.querySelector('.hub-attention') === type && service.count === before, 'Untyped direct Add guides Type without creating a Capture');
    const fill = getComputedStyle(type, '::after');
    assert(fill.outlineStyle === 'none' && fill.borderTopWidth === '0px' && fill.backgroundImage === 'none' && fill.boxShadow.includes('0px 0px 0px 5px') && fill.boxShadow.startsWith(fill.backgroundColor), 'Amber fill expands 5px with identical color, without a border, outline, blur or gradient');
    assert(Math.abs(type.getBoundingClientRect().height - bounds.height) < 1 && Math.abs(type.getBoundingClientRect().width - bounds.width) < 1 && getComputedStyle(type.querySelector('.hub-capture-field-title')).color === labelColor && quick.body.scrollWidth === quick.body.clientWidth, 'Quick Add guidance preserves geometry, foreground and scrollbar width');
    const foreground = getComputedStyle(type.querySelector('button')).color, iconForeground = getComputedStyle(type.querySelector('svg')).color;
    const restingSurface = type.querySelector('button').style.getPropertyValue('--hub-attention-base-surface');
    if (!reduced) {
        const pulse = type.getAnimations({ subtree: true })[0]; pulse.pause();
        for (const [time, expected] of [[0, 0], [450, 1], [1000, 0], [1250, 0], [1700, 1], [2250, 0]]) {
            pulse.currentTime = time; await settle();
            assert(Math.abs(Number(getComputedStyle(type, '::after').opacity) - expected) < .01, 'Actual amber animation follows two calm peaks and resting intervals at ' + time + 'ms');
            const current = rgba(getComputedStyle(type.querySelector('button')).backgroundColor).join();
            assert((current !== rgba(restingSurface).join()) === !!expected && getComputedStyle(type.querySelector('button')).color === foreground && getComputedStyle(type.querySelector('svg')).color === iconForeground, 'Child surfaces follow the shared pulse while text and icons stay crisp at ' + time + 'ms');
        }
        pulse.currentTime = 0; pulse.play();
    } else assert(getComputedStyle(type).animationName === 'none' && Number(fill.opacity) > 0 && rgba(getComputedStyle(type.querySelector('button')).backgroundColor).join() !== rgba(restingSurface).join(), 'Reduced motion uses a transient static emphasis on group and control surfaces');
    await new Promise(resolve => setTimeout(resolve, reduced ? 850 : 2750));
    assert(!quick.body.querySelector('.hub-attention') && !type.querySelector('[aria-describedby],[data-hub-attention-surface]') && getComputedStyle(type.querySelector('button')).backgroundColor === buttonColor, 'Quick Add guidance, surface overrides and accessible description expire completely');
    await click(quick.contentEl, 'Add to Itacan');
    const first = type.getAnimations({ subtree: true })[0];
    await click(quick.contentEl, 'Add to Itacan');
    assert(type.classList.contains('hub-attention') && (reduced || type.getAnimations({ subtree: true })[0] !== first), 'Repeated direct Add restarts the same missing requirement');
    await click(quick.contentEl, 'Task');
    assert(!quick.body.querySelector('.hub-attention'), 'Fixing Type clears guidance without automatically pulsing the next field');
    await click(quick.contentEl, 'Add to Itacan');
    assert(quick.body.querySelector('.hub-attention')?.dataset.captureField === 'Workspace', 'Task direct Add guides Workspace before Location or optional metadata');
    await select(quick.contentEl, 'Save to', project.projectId);
    await click(quick.contentEl, 'Add to Itacan');
    assert(quick.body.querySelectorAll('.hub-attention').length === 1 && quick.body.querySelector('.hub-attention')?.dataset.captureField === 'Location', 'Fixing Workspace advances only the next missing required Location');
    await select(quick.contentEl, 'Location', project.root + '/Design');
    quick.input.value = 'Invalid\nTask content'; quick.input.dispatchEvent(new Event('input', { bubbles: true }));
    await click(quick.contentEl, 'Add to Itacan');
    assert(quick.body.querySelector('.hub-attention') === quick.textPath && service.count === before, 'Invalid Task content guides the highest visible Content group using canonical validation');
    quick.input.value = 'Organise this thought'; quick.input.dispatchEvent(new Event('input', { bubbles: true }));
    quick.form.update({ steps: [{ text: '' }] }); await settle();
    await click(quick.contentEl, 'Add to Itacan');
    assert(!quick.body.querySelector('.hub-attention') && quick.error.textContent && service.count === before, 'Optional invalid Task edits retain meaningful errors without amber required-field guidance');
    quick.close();
    quick = await openQuick(); quick.input.value = 'Incomplete note'; quick.input.dispatchEvent(new Event('input', { bubbles: true }));
    await click(quick.contentEl, 'More options'); await click(quick.contentEl, 'Note');
    await select(quick.contentEl, 'Save to', resource.projectId);
    await click(quick.contentEl, 'Add to Itacan');
    assert(quick.body.querySelector('.hub-attention')?.dataset.captureField === 'Folder', 'New note guides required Folder before Title');
    const folder = quick.body.querySelector('.hub-attention'), folderPulse = folder.getAnimations()[0];
    if (folderPulse) { folderPulse.pause(); folderPulse.currentTime = 450; await settle(); }
    const folderSurface = folder.querySelector('button'), base = rgba(folderSurface.style.getPropertyValue('--hub-attention-base-surface')), amber = rgba(getComputedStyle(folder).getPropertyValue('--hub-attention-color').trim());
    const strength = Number(getComputedStyle(folder).getPropertyValue('--hub-attention-strength'));
    const expectedSurface = base.slice(0, 3).map((value, index) => value * (1 - .22 * strength) + amber[index] * .22 * strength);
    const actualSurface = rgba(getComputedStyle(folderSurface).backgroundColor);
    assert(actualSurface[3] === 255 && expectedSurface.every((value, index) => Math.abs(actualSurface[index] - value) <= 1), 'Transparent picker surfaces blend from their opaque resting appearance without doubling the parent amber');
    const paintBounds = folder.getBoundingClientRect(), clipBounds = quick.body.getBoundingClientRect();
    assert(paintBounds.left - clipBounds.left >= 5 && clipBounds.right - paintBounds.right >= 5, 'Quick Add reserves the shared five-pixel highlight footprint outside both sides of the semantic group');
    await click(quick.contentEl, 'Add to Itacan');
    assert(rgba(folderSurface.style.getPropertyValue('--hub-attention-base-surface')).join() === base.join(), 'Repeating a failed attempt at peak emphasis captures the same resting surface without accumulating amber');
    await select(quick.contentEl, 'Destination folder', resource.root); setField(quick.contentEl, 'Note title', '');
    quick.body.scrollTop = 0; await click(quick.contentEl, 'Add to Itacan');
    const title = quick.body.querySelector('.hub-attention');
    assert(title?.dataset.captureField === 'Title', 'Cleared Note title becomes the next required Quick Add target');
    await new Promise(resolve => setTimeout(resolve, reduced ? 1 : 600));
    const viewport = quick.body.getBoundingClientRect(), titleBounds = title.getBoundingClientRect();
    assert(titleBounds.top >= viewport.top - 1 && titleBounds.bottom <= viewport.bottom + 1, 'Direct Add scrolls its missing field into the Quick Add viewport');
    quick.close();
    quick = await openQuick(); quick.input.value = 'Keep this incomplete capture'; quick.input.dispatchEvent(new Event('input', { bubbles: true }));
    await click(quick.contentEl, 'More options'); await click(quick.contentEl, 'Note'); await click(quick.contentEl, 'Add text to existing note');
    await select(quick.contentEl, 'Save to', resource.projectId); await click(quick.contentEl, 'Add to Itacan');
    assert(quick.body.querySelector('.hub-attention')?.dataset.captureField === 'Location', 'Existing note uses canonical atomic Location guidance');
    quick.guidance.update();
    const attentionStarts = []; const observe = event => { if (event.animationName === 'hub-attention-pulse') attentionStarts.push(event); };
    document.addEventListener('animationstart', observe);
    // Let the earlier attempted cue finish; Send itself must never start one.
    await new Promise(resolve => setTimeout(resolve, reduced ? 850 : 2750));
    attentionStarts.length = 0;
    await click(quick.contentEl, 'Send to Inbox'); document.removeEventListener('animationstart', observe);
    const saved = service.list().find(item => item.text === 'Keep this incomplete capture');
    assert(saved && !quick.containerEl.isConnected && !attentionStarts.length && !quick.body.querySelector('.hub-attention'), 'Send to Inbox accepts incomplete existing-note intent without any validation guidance');
    await service.delete(saved.id);
}

async function verifyInteractionPolish({ service, project, resource, openInbox, select, click, setField, stage }) {
    const ids = [], capture = async values => { const item = await service.capture(values); ids.push(item.id); return item; };
    const note = await capture({ text: "Complete the missing title", type: "note", workspaceId: resource.projectId,
        folder: resource.root, title: "", source: { origin: "Quick Add" } });
    const task = await capture({ text: "Review these details", type: "task", workspaceId: project.projectId });
    const ready = await capture({ text: "A fully organised task", type: "task", workspaceId: project.projectId, location: project.root + "/Design" });
    const inbox = await openInbox(); await inbox.select(note.id); await settle();
    const width = inbox.sort.getBoundingClientRect().width;
    const sortIcons = { "least-complete": "list-sort-ascending", newest: "clock-arrow-down", oldest: "clock-arrow-up", type: "files", "most-complete": "list-sort-descending" };
    for (const value of ["least-complete", "newest", "oldest", "type", "most-complete"]) {
        await select(inbox.contentEl, "Sort items", value);
        assert(Math.abs(inbox.sort.getBoundingClientRect().width - width) < 1, "Sort reserves the widest label for " + value);
        assert(inbox.sort.querySelector(`[data-icon="${sortIcons[value]}"]`), "Trigger icon matches " + value);
    }
    assert(inbox.sort.querySelector('[data-icon="list-sort-descending"]') && !inbox.sortMenu, "Sort trigger matches the active ranking mode");
    inbox.sort.click(); await settle();
    const sortMenu = inbox.sortMenu;
    assert(sortMenu.items.map(item => item.icon).join('|') === 'list-sort-descending|list-sort-ascending|clock-arrow-down|clock-arrow-up|files' && sortMenu.items.filter(item => item.checked).length === 1 && sortMenu.items.at(-1).title === 'Item type', "Every sort option uses the exact requested icon, Item type label and one active checkmark");
    assert(registeredIcons.has('list-sort-descending') && registeredIcons.has('list-sort-ascending') && inbox.sort.querySelector('svg').getAttribute('viewBox') === '0 0 100 100', 'Older native registries render exact registered Lucide list-sort paths at the correct custom-icon scale');
    assert(inbox.sort.getAttribute('aria-expanded') === 'true' && getComputedStyle(inbox.sort.querySelector('.is-open')).display === 'flex', "Open sort shows the down chevron");
    inbox.sort.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); inbox.sort.click(); await settle();
    assert(!inbox.sortMenu && !sortMenu.element.isConnected && window.lastMenu === sortMenu && inbox.sort.getAttribute('aria-expanded') === 'false', "Pointer-down click-away cannot close and reopen the same sort trigger");
    inbox.sort.click(); await settle(); inbox.sort.click(); await settle();
    assert(!inbox.sortMenu && getComputedStyle(inbox.sort.querySelector('.is-closed')).display === 'flex', "A second keyboard click also toggles sort closed");
    inbox.sort.click(); await settle(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
    assert(!inbox.sortMenu && inbox.containerEl.isConnected, "Escape closes sort without closing Inbox");
    inbox.sort.click(); await settle(); inbox.detail.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await settle();
    assert(!inbox.sortMenu, "Outside pointer closes sort");
    const filterWidth = inbox.filterButtons[0].button.getBoundingClientRect().width;
    for (const label of ["Texts", "Files", "All"]) {
        await click(inbox.filters, label);
        await new Promise(resolve => setTimeout(resolve, 150));
        const widths = inbox.filterButtons.map(item => item.button.getBoundingClientRect().width);
        assert(widths.every(value => Math.abs(value - filterWidth) < 1), "All filter alternatives keep equal widths after selecting " + label);
        assert(getComputedStyle(inbox.filters.querySelector('.is-selected')).backgroundColor === "rgb(139, 92, 246)", "Selected filter is filled accent for " + label);
    }
    await inbox.select(note.id); await settle();
    await new Promise(resolve => setTimeout(resolve, 150));
    const row = inbox.rows.get(note.id), rowHeight = row.button.getBoundingClientRect().height;
    assert(!row.metadata.textContent.includes("Quick Add") && service.get(note.id).source.origin === "Quick Add", "Normal metadata omits capture origin while preserving it internally");
    const icon = row.icon.querySelector("svg");
    assert(icon.getBoundingClientRect().width === 30 && Math.abs(row.icon.getBoundingClientRect().top + 16 - (row.button.getBoundingClientRect().top + rowHeight / 2)) < 1, "Thirty-pixel Inbox type icons are vertically centered");
    icon.style.width = "17px"; icon.style.height = "17px"; row.icon.style.width = "17px"; row.icon.style.height = "17px"; row.icon.style.flexBasis = "17px";
    assert(row.button.getBoundingClientRect().height === rowHeight, "Larger type icons preserve item-row height");
    icon.removeAttribute("style"); row.icon.removeAttribute("style");
    assert(getComputedStyle(row.button).borderTopColor === "rgba(0, 0, 0, 0)" && getComputedStyle(row.button).backgroundColor !== "rgb(139, 92, 246)" && getComputedStyle(row.button).boxShadow === "none", "Selected content uses a quiet tint without a border or shadow");
    const hoverStyles = document.createElement('style');
    hoverStyles.textContent = (await (await fetch('../../styles.css')).text()).replaceAll(':hover', '.fixture-hover'); document.head.append(hoverStyles);
    await Promise.all(row.button.getAnimations().map(animation => animation.finished.catch(() => {})));
    const selectedBackground = getComputedStyle(row.button).backgroundColor;
    row.button.classList.add('fixture-hover'); await new Promise(resolve => setTimeout(resolve, 180));
    assert(getComputedStyle(row.button).backgroundColor === selectedBackground && getComputedStyle(row.button).borderTopColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(row.button).boxShadow === 'none' && getComputedStyle(row.button).transform === 'none', "Selected hover keeps its calm selection treatment");
    const unselected = inbox.rows.get(task.id).button;
    unselected.classList.add('fixture-hover'); await new Promise(resolve => setTimeout(resolve, 180));
    const hover = getComputedStyle(unselected);
    assert(hover.backgroundColor !== selectedBackground && hover.borderTopColor === 'rgba(0, 0, 0, 0)' && hover.boxShadow === 'none' && hover.transform === 'none' && (matchMedia('(prefers-reduced-motion: reduce)').matches ? hover.transitionDuration === '0s' : hover.transitionProperty === 'background-color'), "Unselected hover changes only a soft neutral background");
    row.button.classList.remove('fixture-hover'); unselected.classList.remove('fixture-hover'); hoverStyles.remove();
    await inbox.select(task.id); await inbox.select(note.id); await settle();
    const body = inbox.detail.querySelector('.hub-inbox-action-body');
    const warning = inbox.detail.querySelector('.hub-attention');
    assert(warning?.dataset.captureField === service.getInboxCompletion(service.get(note.id), inbox.form.value()).missing[0] && warning.dataset.captureField === "Title", "Opening highlights the service's first missing required field");
    const paint = getComputedStyle(warning, '::after'), animation = getComputedStyle(warning), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    assert(paint.outlineStyle === 'none' && paint.boxShadow.includes('0px 0px 0px 5px') && paint.borderTopWidth === '0px', 'Inbox uses the shared expanded fill without a brighter amber edge');
    assert(reducedMotion ? animation.animationName === "none" : animation.animationIterationCount === "2" && parseFloat(animation.animationDuration) === 1.25,
        "Missing-field attention is two restrained pulses (or respects reduced motion): " + [animation.animationName, animation.animationIterationCount, warning.className, reducedMotion].join(" / "));
    const title = inbox.detail.querySelector('[aria-label="Note title"]');
    assert(title.getAttribute('aria-describedby')?.includes('hub-inbox-guidance-'), "Transient required-field guidance is accessible to the field control");
    await new Promise(resolve => setTimeout(resolve, reducedMotion ? 850 : 2750));
    const bounds = body.getBoundingClientRect(), field = warning.getBoundingClientRect();
    assert(field.top >= bounds.top - 1 && field.bottom <= bounds.bottom + 1, "Opening brings the missing Title into the scrolling editor viewport");
    assert(!warning.classList.contains('hub-attention') && getComputedStyle(warning).animationName === "none" && getComputedStyle(warning).outlineStyle === "none" && neutralColor(getComputedStyle(warning.querySelector('.hub-capture-field-title')).color), "Attention expires fully with no amber outline or label");
    inbox.sync(); await settle();
    assert(!warning.classList.contains('hub-attention'), "Repeated completeness updates do not replay a missing-field pulse");
    assert(!title.hasAttribute('aria-describedby'), "Transient guidance also clears its accessible description after expiring");
    assert(!inbox.save.disabled && isBlocked(inbox.save), "Incomplete primary action accepts a validation attempt");
    assert(!inbox.readyArrow.hidden && getComputedStyle(inbox.readyArrow).color === 'rgb(255, 255, 255)' && Number(getComputedStyle(inbox.save).opacity) < 1, 'Incomplete action keeps its white arrow and muted interactive guidance state');
    await click(inbox.detail, 'Add to Itacan');
    assert(inbox.detail.querySelector('.hub-attention') === warning && service.get(note.id), "Incomplete Add replays the first required field without submitting");
    const firstAttempt = warning.getAnimations({ subtree: true })[0];
    await click(inbox.detail, 'Add to Itacan');
    assert(inbox.detail.querySelector('.hub-attention') === warning && (reducedMotion || warning.getAnimations({ subtree: true })[0] !== firstAttempt), "Repeated incomplete Add restarts the two pulses");
    title.focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); title.dispatchEvent(enter); await settle();
    assert(enter.defaultPrevented && inbox.detail.querySelector('.hub-attention') === warning && service.get(note.id), "Single-line title Enter replays required guidance");
    title.focus(); const scrollBefore = body.scrollTop; setField(inbox.detail, "Note title", "Completed guidance note"); await settle();
    assert(!inbox.detail.querySelector('.hub-attention') && !title.hasAttribute('aria-describedby'), "Completing a required field leaves ordinary styling and no stale hint");
    assert(document.activeElement === title && body.scrollTop === scrollBefore && inbox.readyArrow.classList.contains('hub-ready-nudge') && !isBlocked(inbox.save), "Entering Ready cues Add while keeping editing focus and scroll");
    const arrowColor = getComputedStyle(inbox.readyArrow).color, actionColor = getComputedStyle(inbox.save).backgroundColor;
    assert(getComputedStyle(inbox.save).borderTopColor === actionColor && getComputedStyle(inbox.save).outlineStyle === 'none', 'Ready primary action has no bright border or outline');
    assert(arrowColor === 'rgb(255, 255, 255)' && actionColor === 'rgb(139, 92, 246)' && getComputedStyle(inbox.save.querySelector('span')).color === 'rgb(255, 255, 255)' && contrast(arrowColor, actionColor) >= 3, 'White arrow and text retain at least 3:1 contrast against the normal purple action');
    if (!reducedMotion) {
        const cue = inbox.readyArrow.getAnimations()[0]; cue.pause();
        for (const [time, expected] of [[0, 0], [400, 7], [900, 0], [1200, 0], [1600, 7], [2100, 0]]) {
            cue.currentTime = time; await settle();
            const transform = getComputedStyle(inbox.readyArrow).transform, distance = transform === 'none' ? 0 : new DOMMatrix(transform).m41;
            assert(Math.abs(distance - expected) < .01, 'Ready arrow travels 7px twice with calm returns and pauses at ' + time + 'ms');
        }
        cue.currentTime = 0; cue.play();
    } else assert(getComputedStyle(inbox.readyArrow).animationName === 'none' && getComputedStyle(inbox.readyArrow).transform === 'none', 'Reduced-motion Ready arrow stays white and static');
    await new Promise(resolve => setTimeout(resolve, reducedMotion ? 850 : 2650)); inbox.sync();
    assert(getComputedStyle(inbox.readyArrow).animationName === "none" && getComputedStyle(inbox.readyArrow).color === arrowColor && !isBlocked(inbox.save), "Ready attention stops, retaining its white arrow and enabled purple action");
    for (let repeat = 0; repeat < 3; repeat++) { inbox.sync(); inbox.refresh(); await settle(); }
    assert(!inbox.readyArrow.hidden && inbox.readyArrow.dataset.icon === 'arrow-right' && !inbox.readyArrow.classList.contains('hub-ready-nudge') && getComputedStyle(inbox.save).backgroundColor === 'rgb(139, 92, 246)', "Ordinary Ready rerenders retain the arrow and primary fill without replaying its cue");
    const menu = await itemMenu(inbox, task.id);
    assert(menu.items.map(item => item.separator ? "separator" : item.title).join("|") === "Open|Send to Itacan|Change type|separator|Delete" && menu.items[1].disabled && menu.items[4].warning, "Right-click exposes the conventional actions, incomplete Send is disabled, and Delete is destructive");
    assert(menu.items.filter(item => !item.separator).map(item => item.icon).join("|") === "panel-right-open|send|repeat-2|trash-2" && inbox.selectedId === note.id, "Item menu uses fitting Lucide icons and targets the clicked row without changing the editor");
    menu.items[0].element.click(); await settle();
    assert(inbox.selectedId === task.id && document.activeElement === inbox.detail, "Open selects the contextual item and reveals its details");
    assert(inbox.detail.querySelector('.hub-attention')?.dataset.captureField === "Location" && !inbox.detail.querySelector('.hub-task-section.hub-attention:is([data-task-field=necessity],[data-task-field=dates],[data-task-field=steps])'), "Empty optional Task dates, Necessity and Steps never receive required attention");
    assert(!inbox.detail.querySelector('.hub-capture-types'), "Typed specifications omit permanent Task/Note buttons");
    await itemMenu(inbox, task.id, "Change type");
    assert(window.lastMenu.items[0].checked && !window.lastMenu.items[1].checked, "Change type checks the current Task");
    window.lastMenu.items[1].element.click(); await settle();
    assert(inbox.mode === "note" && !inbox.confirmation && service.get(task.id).text === task.text && inbox.form.value().workspaceId === project.projectId, "Type can switch directly when only shared text and workspace are present");
    await changeType(inbox, task.id, "Task");
    assert(inbox.mode === "task" && !inbox.confirmation, "Auto-generated Note titles need no loss confirmation");
    inbox.form.update({ location: project.root + "/Design", necessity: "must", fromDate: "2026-10-08", steps: [{ text: "Retain this step" }] }); await settle();
    await changeType(inbox, task.id, "Note");
    assert(inbox.confirmation?.contentEl.textContent.includes('task details') && service.get(task.id).intent.type === "task", "Switching away from meaningful Task details opens confirmation before changing data");
    await click(inbox.confirmation.contentEl, "Cancel");
    assert(inbox.mode === "task" && inbox.form.value().steps[0].text === "Retain this step" && inbox.form.value().necessity === "must", "Canceling Type change preserves all Task details");
    await changeType(inbox, task.id, "Note"); await click(inbox.confirmation.contentEl, "Continue");
    assert(inbox.mode === "note" && !service.get(task.id).intent.steps && !service.get(task.id).intent.location && service.get(task.id).text === task.text && inbox.form.value().workspaceId === project.projectId, "Confirmed Task-to-Note switch clears only type-specific data and persists the new classification");
    inbox.form.update({ title: "My chosen note title", folder: project.root + "/Design" }); await settle();
    await changeType(inbox, task.id, "Task"); await click(inbox.confirmation.contentEl, "Cancel");
    assert(inbox.mode === "note" && inbox.form.value().title === "My chosen note title" && inbox.form.value().folder === project.root + "/Design", "Canceling Note-to-Task switch preserves the entered title and folder");
    await changeType(inbox, task.id, "Task"); await click(inbox.confirmation.contentEl, "Continue");
    assert(inbox.mode === "task" && !service.get(task.id).intent.folder && !service.get(task.id).intent.title, "Confirmed Note-to-Task switch drops Note routing without stale fields");
    await inbox.select(ready.id); await settle();
    assert(inbox.readyArrow.classList.contains('hub-ready-nudge') && inbox.rows.get(ready.id).status.querySelector('[data-icon=check]') && inbox.rows.get(ready.id).status.textContent === "Ready" && progressValue(inbox.rows.get(ready.id).progress) === progressMax(inbox.rows.get(ready.id).progress), "Opening Ready shows a Lucide check, a full progress track and a brief Add cue");
    const readyMenu = await itemMenu(inbox, ready.id);
    assert(!readyMenu.items.find(item => item.title === "Send to Itacan").disabled, "Ready items enable the contextual Send action"); readyMenu.hide();
    const editor = inbox.taskInput, taskBody = editor.closest(".hub-inbox-action-body");
    taskBody.scrollTop = Math.min(50, taskBody.scrollHeight - taskBody.clientHeight); editor.focus({ preventScroll: true });
    const editingScroll = taskBody.scrollTop;
    editor.value = ""; editor.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    assert(!inbox.detail.querySelector('.hub-attention') && !inbox.readyArrow.classList.contains('hub-ready-nudge') && taskBody.scrollTop === editingScroll && document.activeElement === editor, "Becoming incomplete clears Ready attention without replaying missing guidance or moving the active editor");
    editor.value = ready.text; editor.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    assert(!inbox.detail.querySelector('.hub-attention') && inbox.readyArrow.classList.contains('hub-ready-nudge') && !isBlocked(inbox.save), "A new Ready transition cues only the arrow while editing");
    inbox.form.update({ steps: [{ text: "" }] }); await settle();
    assert(isBlocked(inbox.save) && !inbox.detail.querySelector('.hub-attention'), "Invalid optional data can block Ready without being falsely marked required");
    inbox.form.update({ steps: [] }); await settle();
    const key = target => { const event = new KeyboardEvent("keydown", { key: "Delete", code: "Delete", bubbles: true, cancelable: true }); target.dispatchEvent(event); return event; };
    for (const control of [editor, ...["textarea", "select"].map(tag => taskBody.createEl(tag)), taskBody.createDiv({ attr: { contenteditable: "true" } }), taskBody.createDiv({ attr: { role: "textbox", tabindex: "0" } }), taskBody.createDiv({ attr: { role: "combobox", tabindex: "0" } })]) {
        control.focus(); const event = key(control);
        assert(!inbox.confirmation && !event.defaultPrevented && service.get(ready.id), "Delete shortcut ignores the active " + control.tagName + " text-entry control");
        if (control !== editor) control.remove();
    }
    const selectedRow = inbox.rows.get(ready.id).button; selectedRow.focus(); const event = key(selectedRow); await settle();
    assert(event.defaultPrevented && inbox.confirmation?.options.title === "Delete this inbox item?" && service.get(ready.id), "Physical Delete opens the same confirmation and never deletes immediately");
    const confirmation = inbox.confirmation;
    key(selectedRow); assert(inbox.confirmation === confirmation, "Repeated Delete cannot open another confirmation");
    assert(confirmation.options.destructive && confirmation.contentEl.querySelector('.mod-warning') && document.activeElement.textContent === "Cancel", "Delete confirmation uses native destructive styling and initially focuses Cancel");
    await click(confirmation.contentEl, "Cancel");
    assert(service.get(ready.id) && document.activeElement === selectedRow, "Canceling keyboard deletion preserves the item and restores focus");
    const deleteButton = inbox.detail.querySelector('.hub-capture-delete');
    assert(parseFloat(getComputedStyle(deleteButton).columnGap) === 8, "Delete icon/text gap matches the standard eight-pixel button spacing");
    await click(inbox.detail, "Delete");
    const dialog = inbox.confirmation; dialog.contentEl.querySelector('button').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await settle();
    assert(!inbox.confirmation && service.get(ready.id) && inbox.containerEl.isConnected, "Escape cancels deletion and keeps Inbox open");
    await click(inbox.detail, "Delete"); await click(inbox.confirmation.contentEl, "Delete");
    assert(!service.get(ready.id), "The destructive second click confirms deletion");
    const file = await capture({ type: "file", attachments: await stage("type-locked-file.pdf", "application/pdf") }); await inbox.select(file.id); await settle();
    assert(inbox.mode === "file" && !inbox.detail.querySelector('.hub-capture-types'), "Files keep inherent classification and omit editable Type");
    const fileMenu = await itemMenu(inbox, file.id);
    assert(!fileMenu.items.some(item => item.title === "Change type"), "Files omit Change type from the context menu"); fileMenu.hide();
    const image = await capture({ type: "file", attachments: await stage("stable-layout.png", "image/png") });
    const geometry = () => [inbox.modalEl, inbox.contentEl.querySelector('.hub-inbox-sidebar'), inbox.detail].flatMap(element => {
        const r = element.getBoundingClientRect(); return [r.left, r.top, r.width, r.height];
    });
    const fixedGeometry = geometry();
    for (const item of [task, note, file, image, task]) {
        await inbox.select(item.id); await settle();
        assert(geometry().every((value, index) => Math.abs(value - fixedGeometry[index]) < 1), "Modal and master-detail geometry remain fixed for " + inbox.mode + "/" + (item.attachments[0]?.mime ?? "text") + ": " + JSON.stringify([fixedGeometry, geometry()]));
        const detailBody = inbox.detail.querySelector('.hub-inbox-action-body'), footer = inbox.detail.querySelector('.hub-inbox-action-footer');
        assert(getComputedStyle(detailBody).flexGrow === "1" && getComputedStyle(detailBody).minHeight === "0px" && getComputedStyle(detailBody).overflowY === "auto" && getComputedStyle(footer).flexShrink === "0", "Every detail uses a flexible scrolling body and a fixed footer");
        const groups = [...detailBody.querySelectorAll('.hub-field-group,.hub-capture-field,.hub-task-section')].filter(group => group.getClientRects().length && !group.closest('[hidden]'));
        for (const group of groups) {
            const label = group.querySelector(':scope > .hub-capture-field-title,:scope > h3,:scope > .hub-task-necessity-heading,:scope > .hub-capture-label');
            const control = group.querySelector(':scope > button,:scope > input,:scope > textarea,:scope > select,:scope > .hub-capture-choices,:scope > .hub-task-necessity-choices,:scope > .hub-task-add-step');
            if (label && control) assert(Math.abs(control.getBoundingClientRect().top - label.getBoundingClientRect().bottom - 8) < 1, "Label/control rhythm is eight pixels for " + (group.dataset.captureField || label.textContent));
        }
        const contentField = [...detailBody.children].find(child => child.getClientRects().length && !child.closest('[hidden]'));
        const firstFormLabel = detailBody.querySelector('.hub-capture-form .hub-capture-field-title,.hub-task-destination-fields > section > h3');
        assert(Math.abs(firstFormLabel.getBoundingClientRect().top - contentField.getBoundingClientRect().bottom - 24) < 1, "Content or File metadata to first field uses one twenty-four pixel gap");
        const listScroll = inbox.list.scrollTop, footerTop = footer.getBoundingClientRect().top;
        detailBody.scrollTop = detailBody.scrollHeight;
        assert(inbox.list.scrollTop === listScroll && Math.abs(footer.getBoundingClientRect().top - footerTop) < 1, "Right scrolling keeps the list and action footer stationary");
        const detailScroll = detailBody.scrollTop;
        inbox.list.scrollTop = inbox.list.scrollHeight;
        assert(detailBody.scrollTop === detailScroll, "Left scrolling keeps detail position independent");
    }
    const sidebar = inbox.contentEl.querySelector('.hub-inbox-sidebar').getBoundingClientRect(), detailRect = inbox.detail.getBoundingClientRect();
    if (innerWidth > 680) assert(Math.abs(sidebar.width / (sidebar.width + detailRect.width) - .47) < .002 && Math.abs(sidebar.height - detailRect.height) < 1, "Desktop uses one 47/53 split and equal-height pane region");
    const untyped = await capture({ text: 'Choose a classification' }); await inbox.select(untyped.id); await settle();
    assert(inbox.rows.get(untyped.id).status.textContent === 'Choose type' && inbox.detail.querySelector('.hub-attention')?.dataset.captureField === 'Type', "Untyped items use classification language and guide only Type");
    const untypedMenu = await itemMenu(inbox, untyped.id);
    assert(untypedMenu.items.map(item => item.separator ? 'separator' : item.title).join('|') === 'Open|Send to Itacan|Choose type|separator|Delete' && untypedMenu.items[1].disabled && untypedMenu.items[2].icon === 'repeat-2', "Untyped context menu uses Choose type and the shared classification icon"); untypedMenu.hide();
    const blocker = await capture({ text: 'Required field order', type: 'task' }); await inbox.select(blocker.id); await settle();
    assert(inbox.detail.querySelector('.hub-attention')?.dataset.captureField === 'Workspace', "Highest required visual field is guided first");
    await select(inbox.detail, 'Save to', project.projectId); await click(inbox.detail, 'Add to Itacan');
    assert(inbox.detail.querySelector('.hub-attention')?.dataset.captureField === 'Location' && inbox.detail.querySelectorAll('.hub-attention').length === 1, "Fixing the first blocker guides the next field on submission");
    const multiline = await capture({ text: 'First line\nSecond line', type: 'task' }); await inbox.select(multiline.id); await settle();
    const sourceEditor = inbox.taskInput, priorText = sourceEditor.value;
    const multiEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); sourceEditor.dispatchEvent(multiEnter); await settle();
    assert(!multiEnter.defaultPrevented && sourceEditor.value === priorText && service.get(multiline.id), "Multiline Enter retains its normal editing meaning");
    const enterReady = await capture({ text: 'Enter submits the Ready task', type: 'task', workspaceId: project.projectId, location: project.root + '/Design' }); await inbox.select(enterReady.id); await settle();
    inbox.taskInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await settle();
    assert(!service.get(enterReady.id), "Ready single-line Enter submits through normal persistence");
    const send = await capture({ text: "Contextual save reuses existing task creation", type: "task", workspaceId: project.projectId, location: project.root + "/Design" });
    await itemMenu(inbox, send.id, "Send to Itacan");
    assert(!service.get(send.id), "Send to Itacan selects the contextual Ready item and commits through the existing save flow");
    await itemMenu(inbox, file.id, "Delete");
    assert(inbox.confirmation?.options.destructive && service.get(file.id), "Contextual Delete uses the existing confirmation before removing the item");
    await click(inbox.confirmation.contentEl, "Cancel");
    inbox.rows.get(file.id).button.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true })); await settle();
    assert(inbox.itemMenu && window.lastMenu.items[0].title === "Open", "Shift F10 opens the same item menu from the focused list");
    await inbox.close(); await settle();
    assert(!document.querySelector('.hub-fixture-menu'), "Closing Inbox cleans up its contextual menu");
    for (const id of ids) if (service.get(id)) await service.delete(id);
}

async function verifyInbox({ service, plugin, memory, project, resource, openQuick, openInbox, capture, legacyCapture, stage, select, click, setField, count, assertViewport, setFailSave, recoveryId, controlHost }) {
    const { vault, objects, contents } = memory;
    const plain = await capture("Resolve this text as a task");
    const link = await capture("https://example.org/review");
    const imageRefs = await stage("Inbox image.png");
    const image = await service.capture({ type: "file", attachments: imageRefs });
    const mixedRefs = await stage("captured-paper.pdf", "application/pdf");
    const mixed = await legacyCapture("Read the paper\nPreserve these source notes", mixedRefs);
    const referenced = await service.capture({ type: "file", attachments: [{ id: "reference-original", path: resource.root + "/original.pdf", name: "original.pdf", ownership: "reference", mime: "application/pdf", size: 3 }] });
    const missingRefs = await stage("missing-source.png"), missing = await legacyCapture("Missing referenced source", missingRefs);
    await vault.delete(objects.get(missingRefs[0].path));
    const noFiles = count() - service.list({ filter: "files" }).length;
    let inbox = await openInbox();
    const rows = () => [...inbox.list.querySelectorAll("button[data-capture-id]")];
    const choose = async id => { const row = inbox.list.querySelector(`[data-capture-id="${id}"]`); assert(row, "Capture visible in list"); row.click(); await settle(); };
    const checkActions = labels => {
        const section = inbox.detail.querySelector(".hub-inbox-actions-section"), heading = section?.querySelector("h3"), group = section?.querySelector(".hub-inbox-detail-actions");
        assert(heading?.textContent === "Actions" && group?.getAttribute("aria-labelledby") === heading.id, "Neutral Capture actions have a small explicit accessible Actions heading");
        const buttons = [...group.querySelectorAll("button")];
        assert(buttons.map(button => button.textContent.trim()).join("|") === labels.join("|"), "Neutral Capture exposes only meaningful actions: " + labels.join(", "));
        const expectedIcons = { "Make task": "square", "Make note": "notebook-text", "Move to\u2026": "folder", Open: "external-link", Delete: "trash-2" };
        assert(buttons.every(button => button.querySelector(`[data-icon="${expectedIcons[button.textContent.trim()]}"]`)), "Neutral Capture actions preserve canonical object and action icons");
        assert(buttons.every(button => !button.classList.contains("mod-cta")), "Neutral Actions preserve uniform secondary button hierarchy");
        const deleteButton = buttons.find(button => button.textContent.trim() === "Delete"), deleteColor = getComputedStyle(deleteButton).color.match(/\d+/g)?.map(Number);
        assert(deleteColor?.[0] > deleteColor?.[1] && deleteColor?.[0] > deleteColor?.[2], "Delete remains conventionally red in the Actions group");
        const groupStyle = getComputedStyle(group), sectionStyle = getComputedStyle(section);
        assert(groupStyle.display === "flex" && groupStyle.flexWrap === "wrap" && Number.parseFloat(groupStyle.gap) > 0 && sectionStyle.borderTopWidth === "0px", "Actions use simple consistent spacing and wrap without a heavy extra card");
        assert(buttons.every(button => button.getBoundingClientRect().width <= group.clientWidth + 1) && inbox.detail.scrollWidth <= inbox.detail.clientWidth + 1, "Context actions remain inside the detail pane at the current viewport");
    };
    const inboxHeader = inbox.contentEl.querySelector(".hub-capture-header");
    assert(inboxHeader && inboxHeader.querySelector(".hub-window-header [data-icon=inbox]") && inboxHeader.querySelector("h2").textContent === "Inbox", "Inbox title uses its feature icon");
    assert(inboxHeader.querySelector("p").textContent === "Saved items awaiting organisation", "Inbox subtitle describes saved items using the exact requested wording");
    assert(rows().length === count() && inbox.filterButtons[0].button.textContent.trim() === `All (${count()})`, "Inbox list and All count show every unresolved item");
    assert(!inbox.contentEl.querySelector(".hub-inbox-count") && !/\d+ captures?$/.test(inbox.contentEl.textContent), "Inbox has no footer statistic");
    const globalFooter = inbox.contentEl.querySelector(".hub-inbox-footer"), globalClose = [...globalFooter.querySelectorAll("button")].find(button => button.textContent.trim() === "Close");
    assert(globalClose && globalFooter.children.length === 1 && Math.abs(globalClose.getBoundingClientRect().right - globalFooter.getBoundingClientRect().right) < 1, "Inbox footer retains only Close at the right");
    assert(inbox.detail.querySelector(".hub-inbox-preview,.hub-inbox-action-body"), "Selecting a Capture opens its existing classification or continuation state");
    assert(!inbox.list.querySelector(".status-dot"), "Inbox rows do not invent unread or decorative status states");
    await click(inbox.filters, "Texts");
    assert(rows().length === noFiles && rows().every(row => !service.get(row.dataset.captureId).attachments.length), "Text filter includes text and links only");
    await click(inbox.filters, "Files");
    assert(rows().length === count() - noFiles && rows().every(row => service.get(row.dataset.captureId).attachments.length), "Files filter includes image and mixed attachment captures");
    await click(inbox.filters, "All");
    assert(inbox.sort.tagName === "BUTTON" && inbox.sort.getAttribute("aria-haspopup") === "menu" && inbox.sort.getAttribute("aria-expanded") === "false" && getComputedStyle(inbox.sort.querySelector('[data-icon="chevron-right"]')).display !== "none" && getComputedStyle(inbox.sort.querySelector('[data-icon="chevron-down"]')).display === "none", "Closed Inbox sort shows the right disclosure chevron");
    assert(inbox.sort.dataset.value === "most-complete" && inbox.sortLabel.textContent === "Most complete", "Native sort trigger exposes the default most-complete state");
    inbox.sort.focus();
    const openSortKey = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }); inbox.sort.dispatchEvent(openSortKey); await settle();
    const oldestMenu = window.lastMenu;
    assert(openSortKey.defaultPrevented && inbox.sortMenu === oldestMenu && inbox.sort.getAttribute("aria-expanded") === "true", "ArrowDown opens the native sort menu without changing Inbox context");
    assert(getComputedStyle(inbox.sort.querySelector('[data-icon="chevron-down"]')).display !== "none" && getComputedStyle(inbox.sort.querySelector('[data-icon="chevron-right"]')).display === "none", "Open Inbox sort shows the down disclosure chevron");
    assert(oldestMenu.items.map(item => item.title).join("|") === "Most complete|Least complete|Newest first|Oldest first|Item type" && oldestMenu.items[0].checked && oldestMenu.items.slice(1).every(item => !item.checked), "Native sort menu exposes five ordered options and checks the current selection");
    const menuRect = oldestMenu.element.getBoundingClientRect();
    assert(menuRect.left >= 0 && menuRect.top >= 0 && menuRect.right <= innerWidth && menuRect.bottom <= innerHeight, "Native sort menu fixture stays within viewport bounds");
    oldestMenu.items[0].element.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    assert(document.activeElement === oldestMenu.items[4].element, "Native Menu fixture keyboard navigation reaches Item type");
    oldestMenu.items[4].element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    assert(document.activeElement === oldestMenu.items[3].element, "ArrowUp focuses the oldest-first option");
    oldestMenu.items[3].element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await settle();
    assert(!oldestMenu.element.isConnected && !inbox.sortMenu && inbox.sort.getAttribute("aria-expanded") === "false" && inbox.sort.dataset.value === "oldest" && inbox.sortLabel.textContent === "Oldest first" && document.activeElement === inbox.sort, "Keyboard native sort selection updates trigger state, closes the menu and restores focus");
    assert(rows()[0].dataset.captureId === service.list({ sort: "oldest" })[0].id, "Oldest-first sort uses captured timestamps");
    inbox.sort.click(); await settle();
    const escapeMenu = window.lastMenu;
    assert(escapeMenu.items[3].checked && escapeMenu.items.filter(item => !item.checked).length === 4, "Reopened native sort menu checks the newly selected oldest-first option");
    escapeMenu.items[0].element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await settle();
    assert(!escapeMenu.element.isConnected && !inbox.sortMenu && inbox.sort.getAttribute("aria-expanded") === "false" && inbox.containerEl.isConnected && inbox.sort.dataset.value === "oldest" && document.activeElement === inbox.sort, "Escape closes only the native menu and returns focus without closing Inbox");
    inbox.sort.click(); await settle();
    const outsideMenu = window.lastMenu, textFilter = inbox.filterButtons.find(item => item.key === "text").button;
    textFilter.focus(); textFilter.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); await settle();
    assert(!outsideMenu.element.isConnected && inbox.sort.getAttribute("aria-expanded") === "false" && document.activeElement === textFilter, "Closing the native menu outside preserves focus on the clicked existing control");
    await select(inbox.contentEl, "Sort items", "newest");
    assert(rows()[0].dataset.captureId === service.list()[0].id, "Newest-first remains chronological when selected");
    inbox.sort.click(); await settle(); const closingMenu = window.lastMenu; inbox.close(); await settle();
    assert(!closingMenu.element.isConnected && !document.querySelector(".hub-fixture-menu"), "Closing Inbox also tears down its open native sort menu");
    inbox = await openInbox();
    assert(inbox.sort.dataset.value === "newest", "The manually selected sort survives reopening Inbox");
    await choose(recoveryId);
    assert(inbox.mode === "file" && !inbox.detail.querySelector(".hub-inbox-actions-section"), "Failed direct File save resumes its journaled routing form without classification");
    const recoveryMenu = await itemMenu(inbox, recoveryId);
    assert(!recoveryMenu.items.some(item => item.title === "Change type"), "Pending save receipts omit invalid type changes"); recoveryMenu.hide();
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(recoveryId) && objects.has(resource.root + "/Quantum Gravity/direct-cancel.pdf"), "Continuing Add to Itacan completes the journaled destination after closing failed Quick Add");
    rows()[0].focus();
    rows()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); await settle();
    assert(document.activeElement === rows()[1] && inbox.selectedId === rows()[1].dataset.captureId, "Arrow keys select and focus the next Capture row");
    await choose(missing.id);
    assert(inbox.detail.textContent.includes("Source file unavailable"), "Missing original attachment has a clear neutral preview state");
    checkActions(["Make task", "Make note", "Move to\u2026", "Delete"]);
    await choose(link.id);
    assert(inbox.mode === "unsorted" && inbox.detail.querySelector("textarea").value === link.text && !inbox.detail.querySelector(".hub-inbox-actions-section,.hub-capture-source,.hub-inbox-preview"), "Unsorted links use the same editable decision surface without source/action clutter");
    await choose(image.id);
    assert(inbox.mode === "file" && !inbox.detail.querySelector(".hub-inbox-actions-section,.hub-capture-types") && inbox.detail.querySelector(".hub-capture-attachment button"), "Single-file Capture opens routing directly and retains native Open in its file row");
    await click(inbox.detail, "Open");
    assert(plugin.app.workspace.lastOpened === imageRefs[0].path, "Image Open reuses the native file handler");
    inbox = await openInbox();
    await choose(plain.id);
    const unsortedHeading = inbox.detail.querySelector("h3"), unsortedText = inbox.detail.querySelector("textarea");
    assert(unsortedHeading.textContent === "Text" && unsortedText.value === plain.text, "Untyped items use a neutral Text title and editable content");
    assert(!inbox.detail.querySelector(".hub-inbox-actions-section,.hub-capture-source,.hub-inbox-preview,.hub-capture-muted") && !/Actions|Make task|Make note|Quick Add|Home\.md/.test(inbox.detail.textContent), "Unsorted decision pane omits classification actions and source/timestamp metadata");
    const typeButtons = [...inbox.detail.querySelectorAll(".hub-capture-type")];
    assert(typeButtons.map(item => item.textContent.trim()).join("|") === "Task|Note" && typeButtons[0].querySelector('[data-icon="square"]') && typeButtons[1].querySelector('[data-icon="notebook-text"]'), "Unsorted items reuse the shared Task/Note Type control and icons");
    const unsortedIcon = inbox.list.querySelector(`[data-capture-id="${plain.id}"] .hub-inbox-unsorted-icon`);
    assert(unsortedIcon?.querySelector("svg.lucide-file-question-mark") && getComputedStyle(unsortedIcon).color === "rgb(119, 119, 119)", "Unsorted rows use the exact Lucide file-question-mark SVG in a subdued neutral color");
    const unsortedFooter = inbox.detail.querySelector(".hub-inbox-unsorted-footer"), unsortedDelete = unsortedFooter.querySelector("button");
    assert(unsortedDelete.textContent.trim() === "Delete" && unsortedDelete.querySelector('[data-icon="trash-2"]') && parseFloat(getComputedStyle(unsortedFooter).borderTopWidth) === 1 && Math.abs(unsortedDelete.getBoundingClientRect().right - unsortedFooter.getBoundingClientRect().right) < 1, "Unsorted Delete sits bottom-right after a separator");
    unsortedText.value = "An edited unsorted thought"; unsortedText.dispatchEvent(new Event("input", { bubbles: true }));
    await choose(link.id); await choose(plain.id);
    assert(service.get(plain.id).text === "An edited unsorted thought" && inbox.detail.querySelector("textarea").value === "An edited unsorted thought" && !service.get(plain.id).intent, "Editing and switching preserves canonical text without prematurely choosing a Type");
    const sameEditor = inbox.detail.querySelector("textarea"); sameEditor.value = plain.text; sameEditor.dispatchEvent(new Event("input", { bubbles: true }));
    await click(inbox.detail, "Task");
    assert(service.get(plain.id).intent?.type === "task", "The Type button immediately persists Task intent");
    const checkMode = type => {
        const expected = [type[0].toUpperCase() + type.slice(1), "Add to Itacan"];
        assert(inbox.mode === type && inbox.detail.querySelector(".hub-inbox-detail-title").textContent === expected[0] && inbox.save.textContent.trim() === expected[1], "Inbox action heading and primary action agree for " + type);
        assert(!inbox.detail.querySelector(".hub-capture-types"), "Inbox " + type + " keeps permanent Type buttons out of specifications");
        const body = inbox.detail.querySelector(".hub-inbox-action-body"), footer = inbox.detail.querySelector(".hub-inbox-action-footer");
        assert(body && footer && getComputedStyle(body).overflowY === "auto", "Inbox " + type + " form has its own scrollable body and stable action footer");
        const before = footer.getBoundingClientRect(); body.scrollTop = body.scrollHeight;
        const after = footer.getBoundingClientRect(), pane = inbox.detail.getBoundingClientRect();
        const footerButtons = [...footer.querySelectorAll("button")];
        assert(footerButtons.map(item => item.textContent.trim()).join("|") === "Delete|Add to Itacan" && !inbox.detail.textContent.includes("Cancel"), "Typed " + type + " footer has only Delete and Add to Itacan");
        assert(footerButtons[0].getBoundingClientRect().left < footerButtons[1].getBoundingClientRect().left, "Typed footer separates Delete on the left from Add to Itacan on the right");
        assert(Math.abs(before.top - after.top) < 1 && after.bottom <= pane.bottom && after.top >= pane.top, "Scrolling the " + type + " form keeps Delete and the primary action inside pane bounds");
    };
    checkMode("task");
    assert(!inbox.detail.querySelector("textarea"), "A simple single-line task does not repeat the same captured content editor");
    inbox.form.update({ type: "note" });
    assert(inbox.form.value().type === "task" && !inbox.detail.querySelector("[aria-label='Note title']"), "Fixed Inbox task state rejects an action-local type switch");
    setField(inbox.detail, "Task", "Preserve this persistent task edit");
    await choose(link.id); await choose(plain.id); checkMode("task");
    assert(inbox.taskInput.value === "Preserve this persistent task edit" && service.get(plain.id).text === inbox.taskInput.value, "Selecting another Capture preserves typed Task edits");
    await inbox.close(); inbox = await openInbox(); await choose(plain.id); checkMode("task");
    assert(inbox.taskInput.value === "Preserve this persistent task edit" && service.get(plain.id).intent.type === "task", "Closing and reopening resumes persisted Task edits and classification");
    const classifiedNote = await capture("Choose this as a note"); await choose(classifiedNote.id); await click(inbox.detail, "Note"); checkMode("note");
    assert(service.get(classifiedNote.id).intent?.type === "note" && inbox.detail.querySelector("[aria-label='Note title']") && !inbox.detail.querySelector("input[aria-label='Task']"), "Note classification immediately persists and opens only Note continuation fields");
    setField(inbox.detail, "Note title", "Persistent note title");
    await choose(plain.id); await choose(classifiedNote.id);
    assert(inbox.detail.querySelector('[aria-label="Note title"]').value === "Persistent note title", "Selecting another Capture preserves the Note title");
    await choose(plain.id); checkMode("task");
    await select(inbox.detail, "Save to", project.projectId); await select(inbox.detail, "Location", project.root + "/Design");
    setField(inbox.detail, "Task", "Resolve this text as a task");
    await inbox.flushEdits(); const prior = count(); setFailSave(); await click(inbox.detail, "Add to Itacan");
    assert(count() === prior && service.get(plain.id)?.text === plain.text && inbox.error.textContent.includes("Simulated persistence failure"), "Failed task persistence retains the Capture and shows native inline feedback");
    assert(!contents.get(project.root + "/Design/Tasks.md").includes(plain.text), "Failed journal save never creates a destination task");
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(plain.id) && count() === prior - 1 && contents.get(project.root + "/Design/Tasks.md").includes(plain.text), "Successful Make task persists a normal task before resolving the Capture");
    assert(inbox.selectedId && inbox.selectedId !== plain.id && (inbox.detail.querySelector(".hub-inbox-preview") || inbox.form), "Resolution selects a sensible next Capture and resumes its appropriate state");
    const atlasTask = await service.capture({ text: "Follow the Atlas source", attachments: [], source: { origin: "Atlas", url: "https://example.org/source", title: "Atlas source", workspaceId: project.projectId } });
    await choose(atlasTask.id); await click(inbox.detail, "Task");
    await select(inbox.detail, "Save to", project.projectId); await select(inbox.detail, "Location", project.root + "/Design"); await click(inbox.detail, "Add to Itacan");
    assert(!service.get(atlasTask.id) && Object.values(plugin.projectWizard.data.taskMetadata).some(item => item.captureSource?.url === "https://example.org/source"), "Source-only Make task resolves its Capture while preserving origin metadata in canonical task data");

    const editable = await capture("Initial note content"); await choose(editable.id); await click(inbox.detail, "Note");
    const editableContent = inbox.detail.querySelector("textarea"); editableContent.value = "Edited content\nPreserve this second line"; editableContent.dispatchEvent(new Event("input", { bubbles: true }));
    await select(inbox.detail, "Save to", resource.projectId); await select(inbox.detail, "Destination folder", resource.root); setField(inbox.detail, "Note title", "Edited Inbox note");
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(editable.id) && contents.get(resource.root + "/Edited Inbox note.md").includes("Edited content\nPreserve this second line"), "Make note saves edited captured content rather than a stale original snapshot");
    await choose(mixed.id); await click(inbox.detail, "Make task");
    checkMode("task");
    assert(inbox.detail.querySelector("textarea"), "Multiline capture content remains available in task processing without losing details");
    await select(inbox.detail, "Save to", project.projectId); await select(inbox.detail, "Location", project.root + "/Design");
    setField(inbox.detail, "Task", "Read the paper"); await click(inbox.detail, "Add to Itacan");
    assert(service.get(mixed.id)?.attachments.length === 1 && service.get(mixed.id).text.includes("Preserve these source notes"), "Task creation retains unsupported attachments and multiline source content in Inbox");
    assert(![...inbox.detail.querySelectorAll("button")].some(item => item.textContent.trim() === "Make task"), "Retained Capture cannot create a duplicate task");
    await click(inbox.detail, "Make note");
    checkMode("note");
    await select(inbox.detail, "Save to", project.projectId); await select(inbox.detail, "Destination folder", project.root + "/Design");
    setField(inbox.detail, "Note title", "Paper source notes"); await click(inbox.detail, "Add to Itacan");
    assert(!service.get(mixed.id) && objects.has(project.root + "/Design/Paper source notes.md"), "Make note resolves the remaining Capture only after creating a normal Markdown file");
    assert(contents.get(project.root + "/Design/Paper source notes.md").includes("Preserve these source notes") && contents.get(project.root + "/Design/Paper source notes.md").includes("captured-paper.pdf"), "New note preserves captured text and native attachment links");
    assert(objects.has(project.root + "/Design/captured-paper.pdf") && !objects.has(mixedRefs[0].path), "Owned attachment transfers into the destination without retaining a duplicate staged binary");

    const movingRefs = await stage("movable.pdf", "application/pdf"), moving = await capture("", movingRefs);
    await choose(moving.id); await click(inbox.detail, "File");
    checkMode("file");
    assert(!inbox.detail.querySelector("[aria-label='Task'],[aria-label='Note title']"), "Move action contains only destination controls");
    await select(inbox.detail, "Save to", resource.projectId); await select(inbox.detail, "Destination folder", resource.root + "/Quantum Gravity");
    vault.failMove = true; const beforeMove = count(); await click(inbox.detail, "Add to Itacan");
    assert(count() === beforeMove && service.get(moving.id) && objects.has(movingRefs[0].path), "Failed file move keeps both Capture and staged source intact");
    assert(inbox.error.textContent.includes("Simulated file move failure"), "Move failure displays the existing inline error treatment");
    await click(inbox.detail, "Add to Itacan");
    assert(!service.get(moving.id) && objects.has(resource.root + "/Quantum Gravity/movable.pdf") && !objects.has(movingRefs[0].path), "Retry moves the staged file once and resolves its Capture");

    for (const mode of ["note", "file"]) {
        const oldFolderPath = resource.root + "/Pending " + mode + " destination";
        const oldFolder = memory.folder(oldFolderPath); vault.emit("create", oldFolder);
        const recoveryRefs = await stage("prepared-" + mode + "-recovery.pdf", "application/pdf");
        const recoveryText = "Original " + mode + " recovery content\nKeep the complete captured text.";
        const recoveryCapture = await legacyCapture(recoveryText, recoveryRefs);
        const actionLabel = mode === "note" ? "Make note" : "Move to…", primaryLabel = "Add to Itacan";
        await choose(recoveryCapture.id); await click(inbox.detail, actionLabel); checkMode(mode);
        await select(inbox.detail, "Save to", resource.projectId); await select(inbox.detail, "Destination folder", oldFolderPath);
        if (mode === "note") setField(inbox.detail, "Note title", "Prepared note recovery");
        vault.failMove = true; await click(inbox.detail, primaryLabel);
        assert(service.get(recoveryCapture.id)?.operation?.state === "prepared" && objects.has(recoveryRefs[0].path), "Failed " + mode + " processing preserves its prepared receipt and original staged source");
        await inbox.close(); inbox = await openInbox(); await choose(recoveryCapture.id);
        assert(inbox.containerEl.isConnected && inbox.mode === mode && inbox.save.textContent.trim() === "Add to Itacan", "Pending legacy " + mode + " Capture retains its original completion type after reopening");
        await vault.delete(oldFolder); await settle();
        await choose(recoveryCapture.id); checkMode(mode);
        assert(inbox.form.value().type === mode && !inbox.detail.querySelector(".hub-capture-types,[aria-label='Type']"), "Reopened prepared " + mode + " recovery retains one fixed action type");
        assert(inbox.detail.querySelector("textarea").value === recoveryText && inbox.detail.querySelector("textarea").readOnly, "Prepared " + mode + " recovery preserves stored captured content in a read-only editor");
        if (mode === "note") assert(inbox.detail.querySelector("input[aria-label='Note title']").value === "Prepared note recovery", "Reopening pending note processing restores its stored note title");
        assert(!inbox.form.value().folder && isBlocked(inbox.save), "Removed prepared " + mode + " destination clears its folder and keeps the primary action disabled");
        await select(inbox.detail, "Save to", project.projectId); await select(inbox.detail, "Destination folder", project.root + "/Design");
        await click(inbox.detail, primaryLabel);
        assert(!service.get(recoveryCapture.id) && objects.has(project.root + "/Design/" + recoveryRefs[0].name) && !objects.has(recoveryRefs[0].path), "Prepared " + mode + " recovery reroutes into a valid Project workspace folder and resolves safely");
        assert([...objects.keys()].filter(path => path.endsWith("/" + recoveryRefs[0].name)).length === 1 && [...contents].filter(([path, text]) => path.endsWith(".md") && typeof text === "string" && text.includes(recoveryText)).length === 1, "Rerouted " + mode + " processing creates one file and one note without duplicate captured data");
    }

    await choose(referenced.id); await click(inbox.detail, "Delete"); await click(inbox.confirmation.contentEl, "Delete");
    assert(!service.get(referenced.id) && objects.has(resource.root + "/original.pdf"), "Deleting an existing-file reference preserves the original user file");
    const ownedRefs = await stage("delete-owned.png"), owned = await capture("", ownedRefs);
    await choose(owned.id); await click(inbox.detail, "Delete"); await click(inbox.confirmation.contentEl, "Delete");
    assert(!service.get(owned.id) && !objects.has(ownedRefs[0].path), "Deleting an owned Capture safely removes only its staging copy");

    const removed = await capture("Destination removed while reviewing");
    await choose(removed.id); await click(inbox.detail, "Note");
    await select(inbox.detail, "Save to", resource.projectId); await select(inbox.detail, "Destination folder", resource.root + "/Quantum Gravity"); setField(inbox.detail, "Note title", "Destination removal");
    const destination = objects.get(resource.root + "/Quantum Gravity"); objects.delete(destination.path);
    vault.emit("delete", destination); await settle(); inbox.sync();
    assert(isBlocked(inbox.save) && service.get(removed.id) && !inbox.form.value().folder, "Removed destination clears the selected folder and disables Add without resolving the Capture");
    objects.set(destination.path, destination); vault.emit("create", destination); await settle();

    for (let i = 0; i < 120; i++) await capture("Capture " + i + ": " + "A long idea with enough text to wrap inside the native list and detail panes. ".repeat(10));
    assert(rows().length === count(), "Large Inbox retains every Capture");
    if (innerWidth >= 1000) {
        const filters = inbox.contentEl.querySelector('.hub-inbox-filters').getBoundingClientRect(), sort = inbox.sort.getBoundingClientRect();
        assert(Math.abs(filters.top - sort.top) < 1 && filters.right + 8 <= sort.left, 'Desktop filters and fixed-width sort share one comfortable header row even with three-digit counts');
    }
    assert(controlHost.scrollWidth <= controlHost.clientWidth + 1 && controlHost.getBoundingClientRect().right <= innerWidth, "Five global controls and a three-digit unresolved badge remain inside narrow footer geometry");
    assertViewport(inbox);
    assert(getComputedStyle(inbox.list).overflowY === "auto" && getComputedStyle(inbox.detail.querySelector(".hub-inbox-action-body")).overflowY === "auto", "Capture list and right form body scroll independently");
    assert(inbox.list.scrollHeight > inbox.list.clientHeight, "Many Captures scroll inside the list");
    await choose(service.list()[0].id); assertViewport(inbox);
    const focusables = [...inbox.modalEl.querySelectorAll("button,input,select,textarea,[tabindex]")].filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && !element.closest("[hidden]"));
    focusables.at(-1).focus(); focusables.at(-1).dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    assert(document.activeElement === focusables[0], "Native Modal fixture traps forward Tab within the dialog");
    focusables[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    assert(document.activeElement === focusables.at(-1), "Native Modal fixture traps reverse Tab within the dialog");
    for (const item of [...service.list()]) await service.delete(item.id);
    assert(count() === 0 && inbox.list.textContent.includes("Your Inbox is empty") && inbox.detail.textContent.includes("Select an item"), "Empty Inbox and no-selection detail have useful conventional states");
    const badge = document.querySelector(".hub-inbox-badge"); assert(badge.hidden, "Resolving and deleting all Captures hides the zero-count global badge");
    assertViewport(inbox);
    const finalRefs = await stage("detector-image.png"), finalCapture = await legacyCapture("Detector comparison\nA final visual check of the native Inbox treatment.", finalRefs);
    await choose(finalCapture.id);
    window.capturePreview = { inbox, service, project, resource, openQuick, openInbox, select, click, setField };
    const preview = new URLSearchParams(location.search).get("preview") ?? "task";
    if (preview === 'polish') {
        for (const item of [...service.list()]) await service.delete(item.id);
        const examples = {
            task: await service.capture({ text: 'Compare detector sensitivity', type: 'task' }),
            note: await service.capture({ text: 'A note to organise', type: 'note', title: 'A note to organise', workspaceId: resource.projectId }),
            file: await service.capture({ attachments: await stage('Reference paper.pdf', 'application/pdf'), workspaceId: resource.projectId }),
            ready: await service.capture({ text: 'Review the latest measurements', type: 'task', workspaceId: project.projectId, location: project.root + '/Design' }),
            readyNote: await service.capture({ text: 'A fully organised note', type: 'note', title: 'A fully organised note', workspaceId: resource.projectId, folder: resource.root }),
            untyped: await service.capture({ text: 'An idea to classify later' })
        };
        await select(inbox.contentEl, 'Sort items', 'most-complete');
        window.capturePreview.selectPolish = async mode => {
            await choose(examples[mode].id); await settle();
            if (['task', 'note', 'file'].includes(mode)) { await click(inbox.detail, 'Add to Itacan'); await freezeGuidancePeak(inbox.detail); }
            if (['ready', 'readyNote'].includes(mode)) {
                const cue = inbox.readyArrow.getAnimations()[0]; if (cue) { cue.pause(); cue.currentTime = 400; await settle(); }
            }
        };
        await window.capturePreview.selectPolish('note'); assertViewport(inbox); return;
    }
    if (["neutral", "unsorted"].includes(preview)) {
        const unsorted = await capture("An idea to come back to\nContinue organising this thought when ready."); await choose(unsorted.id); return;
    }
    if (["quick", "quick-task", "quick-file", "quick-note", "quick-guidance", "note-picker", "note-list", "note-heading", "note-empty"].includes(preview)) {
        inbox.close(); const quick = await openQuick();
        if (preview === "quick-guidance") {
            quick.input.value = 'A thought to organise'; quick.input.dispatchEvent(new Event('input', { bubbles: true }));
            await click(quick.contentEl, 'More options'); await click(quick.contentEl, 'Note');
            await click(quick.contentEl, 'Add to Itacan'); await freezeGuidancePeak(quick.body);
        } else if (preview === "quick-task") {
            quick.input.value = "Compare detector sensitivity across the two readout methods"; quick.input.dispatchEvent(new Event("input", { bubbles: true }));
            await click(quick.contentEl, "More options"); await click(quick.contentEl, "Task"); await select(quick.contentEl, "Save to", project.projectId);
        } else if (preview === "quick-file") {
            await quick.addAttachments([new File(["preview"], "detector-reference.pdf", { type: "application/pdf" })]); await settle();
            await click(quick.contentEl, "More options"); await select(quick.contentEl, "Save to", resource.projectId);
        } else if (["quick-note", "note-picker", "note-list", "note-heading", "note-empty"].includes(preview)) {
            quick.input.value = "A thought to add to the existing note"; quick.input.dispatchEvent(new Event("input", { bubbles: true }));
            await click(quick.contentEl, "More options"); await click(quick.contentEl, "Note");
            await click(quick.contentEl, "Add text to existing note"); await select(quick.contentEl, "Save to", project.projectId);
            if (preview !== "quick-note") {
                quick.contentEl.querySelector('[aria-label="Location"]').click(); await settle();
                const picker = window.lastModal;
                if (preview !== "note-empty") { picker.contentEl.querySelector(`[data-capture-path="${project.root}/Design/Nested folder/Position targets.md"]`).click(); await settle(); }
                if (preview === "note-list") await click(picker.contentEl, "In list");
                if (preview === "note-heading") await click(picker.contentEl, "Under heading");
            }
        }
        assertViewport(quick); return;
    }
    if (preview === 'inbox-guidance') {
        const item = await service.capture({ text: 'A thought to organise', type: 'note', title: 'A thought to organise' });
        await choose(item.id); await click(inbox.detail, 'Add to Itacan'); await freezeGuidancePeak(inbox.detail); return;
    }
    if (["note", "image", "file"].includes(preview)) {
        const item = preview === "note" ? await service.capture({ text: "A research thought to organise", type: "note", workspaceId: resource.projectId, folder: resource.root, title: "Research thought" }) :
            await service.capture({ attachments: await stage(preview === "image" ? "detector-image.png" : "reference-paper.pdf", preview === "image" ? "image/png" : "application/pdf"), workspaceId: resource.projectId });
        await choose(item.id); await settle(); return;
    }
    if (preview !== "neutral") {
        const reviewTask = await capture("Compare detector sensitivity across the two readout methods"); await choose(reviewTask.id);
        await click(inbox.detail, "Task");
        await select(inbox.detail, "Save to", project.projectId);
        if (preview !== "incomplete-task") await select(inbox.detail, "Location", project.root + "/Design");
        if (preview === "destination") inbox.detail.querySelector("button[aria-label='Save to']").click();
        else if (preview === "folder") inbox.detail.querySelector("button[aria-label='Location']").click();
        else if (preview === "delete-confirmation") await click(inbox.detail, "Delete");
        else if (preview === "type-confirmation") await changeType(inbox, reviewTask.id, "Note");
        else if (preview === "context-menu") await itemMenu(inbox, reviewTask.id);
        await settle();
    }
    // The default screenshot reviews compact task grouping and the stable pane
    // footer. Optional ?preview=destination|folder|neutral reviews native pickers;
    // quick|quick-task|quick-file reviews the corresponding Quick Add surface.
}

// Pause only an isolated preview at the actual first peak for visual inspection.
async function freezeGuidancePeak(host) {
    const pulse = host.querySelector('.hub-attention')?.getAnimations({ subtree: true })[0];
    if (pulse) { pulse.pause(); pulse.currentTime = 450; await settle(); }
}
