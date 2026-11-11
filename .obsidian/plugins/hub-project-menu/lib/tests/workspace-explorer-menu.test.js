"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
class Item {
    setTitle(value) { this.title = value; return this; }
    setDisabled(value) { this.disabled = value; return this; }
    setIcon() { return this; }
    setChecked(value) { this.checked = value; return this; }
    setWarning() { return this; }
    onClick(run) { this.run = run; return this; }
    setSubmenu() { return this.submenu = new Menu(); }
}
class Menu {
    constructor() { this.items = []; }
    addItem(fn) { const item = new Item(); fn(item); this.items.push(item); }
    addSeparator() { this.items.push(null); }
    showAtPosition(point) { this.point = point; }
    showAtMouseEvent(event) { this.event = event; }
    hide() { this.hidden = true; }
}
const notices = [], reveals = [], calls = [];
const compiled = { exports: {} };
new Function("module", "require", fs.readFileSync(path.join(__dirname, "../ui/workspace-explorer-menu.js"), "utf8"))(compiled, name => {
    if (name === "obsidian") return { Menu, Notice: class { constructor(value) { notices.push(value); } } };
    if (name === "./color-system") return { ownMenuColors: value => value, ownNoticeColors: value => value };
    if (name === "electron") return { shell: { showItemInFolder: value => reveals.push(value), openPath: async value => { reveals.push(value); return ""; } } };
    return require(name);
});
const file = { path: "Projects/P/Note.md" };
const plugin = { app: { vault: { adapter: { getBasePath: () => "C:/Fixture" }, getAbstractFileByPath: value => value === file.path ? file : null },
    plugins: { plugins: { quickadd: { api: { inputPrompt: async () => "Renamed" } } } }, workspace: { getLeaf: value => ({ openFile: item => calls.push([value, item]) }) } },
    renameProjectFile: item => calls.push(["rename", item]), deleteProjectFile: item => calls.push(["delete", item]), duplicateProjectFile: item => calls.push(["duplicate", item]) };
async function run() {
    const host = compiled.exports.createExplorerHost(plugin, { FolderPicker: class { constructor(app, callback) { this.callback = callback; } open() { this.callback("Projects/P"); } }, confirm: async () => true });
    const menu = host.showMenu({ type: "contextmenu" }, [
        { title: "Open", run: () => calls.push("opened") }, null,
        { title: "Open in…", items: [{ title: "New tab", run: () => calls.push("tab") }] },
        { title: "Unavailable", disabled: true }
    ]);
    menu.items[0].run(); await Promise.resolve();
    assert(menu.hidden, "Action dismisses the native menu before running"); assert(calls.includes("opened"));
    menu.hidden = false; menu.items[2].submenu.items[0].run(); await Promise.resolve();
    assert(menu.hidden && calls.includes("tab"), "Submenu action dismisses its parent");
    assert(menu.items[3].disabled);
    assert(host.canReveal()); host.reveal(file.path); await host.reveal(file.path, true);
    assert.equal(reveals.length, 2);
    await host.renameFolder("Before", value => calls.push(value)); assert(calls.includes("Renamed"));
    await host.deleteFolder("Folder", () => calls.push("folder deleted")); assert(calls.includes("folder deleted"));
    host.renameFile(file.path); host.deleteFile(file.path); host.duplicateFile(file.path); host.openWindow(file.path);
    assert(calls.some(value => Array.isArray(value) && value[0] === "window" && value[1] === file));
    host.moveTo(target => calls.push(target)); assert(calls.includes("Projects/P"));
    const failed = host.showMenu({ type: "contextmenu" }, [{ title: "Failure", run: () => { throw Error("Fixture failure"); } }]);
    failed.items[0].run(); await new Promise(resolve => setImmediate(resolve)); assert(notices.includes("Fixture failure"));
    console.log("Explorer menu checks passed: scoped actions, submenus, dismissal, capability checks, retained callbacks and error reporting.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
