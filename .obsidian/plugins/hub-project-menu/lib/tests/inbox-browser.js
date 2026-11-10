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
        name = name.replace(/^node:/, "");
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
    await Promise.all(["ui/quick-add", "ui/inbox", "ui/capture-controls", "services/inbox", "ui/task-editor"].map(preload));
    return name => {
        const load = requestName => {
            const name = requestName.replace(/^node:/, "");
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

// The genuine Obsidian runner covers persistence/restart and native keyboard
// dispatch. This fast browser fixture checks the same compact capture surfaces.
window.onload = async () => {
 try {
  const load=await modules(),{HubInboxService}=load('services/inbox'),{QuickAddModal}=load('ui/quick-add'),{InboxModal}=load('ui/inbox'),{openTaskCreator}=load('ui/task-editor'),{createNativeTaskLocations}=load('services/native-task-locations');
  const memory=isolatedVault(),{vault,folder,file}=memory;
  folder('Projects/Fixture');folder('Projects/Fixture/Nested');file('Projects/Fixture/Fixture.md','# Fixture');file('Projects/Fixture/Nested/Note.md','Existing\r\n');folder('Resources/Explorations');file('Resources/Explorations/Explorations.md','# Explorations');
  const project={contextKind:'project',projectId:'fixture',name:'Fixture',root:'Projects/Fixture',path:'Projects/Fixture/Fixture.md',status:'active'},resource={contextKind:'resource',resourceType:'references',id:'references',projectId:'resource:references',name:'Explorations',root:'Resources/Explorations',path:'Resources/Explorations/Explorations.md'};
  let persisted={},failSave=false,created=0;const ops=new Map();
  const plugin={app:{vault,fileManager:{renameFile:memory.rename,generateMarkdownLink:f=>'[['+f.path+']]'},workspace:{activeLeaf:{view:{containerEl:document.getElementById('fixture')}},getActiveFile:()=>null},metadataCache:new Emitter()},projectWizard:{data:{},getProjectRecords:()=>[project],getResourceTypes:()=>[resource],getCategories:()=>[],getContextForPath:p=>[project,resource].find(w=>p===w.root||p?.startsWith(w.root+'/'))},oath:{canOpen:()=>true},planning:{phases:()=>[],subscribe:()=>{}},register(){},registerDomEvent(el,name,fn){el.addEventListener(name,fn);},dataStore:{save:async data=>{if(failSave){failSave=false;throw Error('Synthetic failure');}persisted=JSON.parse(JSON.stringify(data));}}};
  plugin.app.metadataCache.getFileCache=()=>({});
  const owner={type:'project',id:'fixture'},locations=createNativeTaskLocations(plugin);
  plugin.nativeTaskHost={matches:()=>true,nativeTasks:{availabilityFor:()=> 'current'},runtime:()=>({getOperation:async id=>ops.get(id),createTask:async(values,id,taskId)=>{created++;ops.set(id,{taskId});}}),refreshInventory:async()=>{},status:()=>({owners:[{owner,state:'ready'},{owner:{type:'resource',id:'references'},state:'ready'}]}),create:options=>openTaskCreator({app:plugin.app,nativeOwner:owner,nativeLocations:locations,context:()=>project,workspaceContext:()=>project,phases:()=>[],formContext:()=>({destination:{owner},sourcePath:project.path,nativeOwner:owner}),defaultCreationLocation:async()=>({nativeOwner:owner,nativeLocation:''})},options)};
  let service=new HubInboxService(plugin),quick;
  const open=()=>{quick=new QuickAddModal(plugin.app,service,{source:{path:'Projects/Fixture/Nested/Note.md',workspaceId:'fixture'},onResume:()=>open()});quick.open();return quick;};
  open();assert(!quick.attach.hidden&&!quick.textPath.hidden,'Empty capture offers both inputs');
  quick.input.value='Title\nDescription';quick.input.dispatchEvent(new Event('input',{bubbles:true}));await service.queue;assert(quick.attach.hidden,'Text hides file input');await quick.close();open();assert(quick.input.value==='Title\nDescription','Closing preserves text draft');
  const origin=quick;await quick.specify('task');await origin.child.ready;assert(origin.child.getDraft().description==='Description','Specify reuses Add Task with multiline data');origin.child.close();await settle();assert(document.querySelector('.hub-quick-add-dialog'),'Cancelling task returns to Quick Add');
  failSave=true;await quick.sendInbox();assert(quick.input.value==='Title\nDescription'&&service.count===0,'Failed save preserves capture');await quick.sendInbox();await settle();assert(service.count===1&&quick.input.value===''&&quick.containerEl.isConnected,'Successful save clears content and keeps Quick Add open');
  await quick.addAttachments([new File(['data'],'one.pdf',{type:'application/pdf'})]);assert(quick.textPath.hidden&&quick.chooser.textContent==='File location','File capture hides text and offers only File location');const ref=quick.draft.attachments[0];await quick.close();open();assert(quick.draft.attachments[0].path===ref.path,'File references survive close/reopen');await quick.clearDraft();assert(!memory.objects.has(ref.path)&&!quick.textPath.hidden&&!quick.attach.hidden,'Clear releases owned files and restores both input methods');await quick.close();
  const inbox=new InboxModal(plugin.app,service);inbox.open();assert(inbox.sourceInput.value==='Title\nDescription','Inbox shows full captured text');inbox.sourceInput.value='Edited';inbox.sourceInput.dispatchEvent(new Event('input',{bubbles:true}));await inbox.close();assert(service.captures[0].text==='Edited','Inbox edits persist before close');
  service.destroy();plugin.projectWizard.data=JSON.parse(JSON.stringify(persisted));service=new HubInboxService(plugin);assert(service.count===1,'Saved Inbox survives service reconstruction');service.destroy();
  document.getElementById('result').textContent='PASS '+results.length+' compact capture checks\n'+results.join('\n');
 } catch(error) { document.getElementById('result').textContent='FAIL: '+error.stack; }
};
