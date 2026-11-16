"use strict";
// Loads the locally installed Obsidian application in an isolated, hidden
// Electron process. The launcher supplies a fresh profile and synthetic vault.
const electron = require("electron"), fs = require("fs"), path = require("path");
const { EventEmitter } = require("events");
const os = require("os");
os.userInfo = () => ({ username: "hub-explorer-fixture-" + process.pid, homedir: os.homedir(), uid: -1, gid: -1, shell: null });
const scratch = process.env.HUB_EXPLORER_RUNTIME_ROOT;
if (!scratch || !path.basename(scratch).startsWith("hub-explorer-runtime-")) throw Error("Missing isolated Explorer runtime root");
const vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
// Obsidian resolves this independently of the preload realm. Match the
// maintained vNext disposable host's normal application module path.
fs.cpSync(path.join(__dirname, "../atlas/tests/native/node_modules/@electron/remote"), path.join(scratch, "node_modules/@electron/remote"), { recursive: true });
electron.app.setAppPath(scratch);
electron.app.setPath("userData", profile);
electron.app.setName("Hub Explorer Runtime Test");
for (const name of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient", "setLoginItemSettings", "setUserTasks", "setJumpList"]) electron.app[name] = () => false;
electron.app.isDefaultProtocolClient = () => true;
electron.app.commandLine.appendSwitch("disable-gpu");
electron.app.commandLine.appendSwitch("no-sandbox");
const NativeWindow = electron.BrowserWindow;
const ownedWindows = [];
function HiddenWindow(options = {}) {
    // Electron's built-in classes cannot be subclassed. Return a genuine
    // BrowserWindow, preserving its native registry and remote identity.
    const window = new NativeWindow({ ...options, show: false, webPreferences: { ...options.webPreferences,
        backgroundThrottling: false, preload: path.join(__dirname, "music-obsidian-preload.cjs") } });
    window.show = () => {}; window.showInactive = () => {};
    ownedWindows.push(window); return window;
}
Object.setPrototypeOf(HiddenWindow, NativeWindow); HiddenWindow.prototype = NativeWindow.prototype;
// Electron's export getters are immutable. Supply a shallow facade to the
// application's main module, retaining the real Electron implementations.
const appElectron = { ...electron, BrowserWindow: HiddenWindow };
electron.protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true, corsEnabled: true } }
]);
const remote = require("../atlas/tests/native/node_modules/@electron/remote/main");
remote.initialize();
appElectron.remote = { enable: contents => remote.enable(contents) };
for (const name of ["showErrorBox", "showMessageBox", "showMessageBoxSync", "showOpenDialog", "showOpenDialogSync"]) {
    electron.dialog[name] = (...args) => {
        console.error("Unexpected Obsidian dialog:", name, JSON.stringify(args.at(-1)));
        if (name.endsWith("Sync")) return name.includes("Message") ? 1 : undefined;
        return Promise.resolve({ canceled: true, response: 1, filePaths: [] });
    };
}
electron.shell.openExternal = async () => { throw Error("External browsing is outside the Explorer fixture"); };
const archive = process.env.HUB_EXPLORER_OBSIDIAN_ARCHIVE || "C:\\Program Files\\Obsidian\\resources\\obsidian.asar";
if (!fs.existsSync(archive)) throw Error("Installed Obsidian archive is unavailable");
const events = new EventEmitter();
events.on("check-start", () => events.emit("check-end"));
const Module = require("module"), originalLoad = Module._load;
Module._load = function (name) { return name === "electron" ? appElectron : originalLoad.apply(this, arguments); };
const boot = require(path.join(archive, "main.js"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let failed = false;
const timer=setTimeout(()=>{console.error("Native explorer test timed out");electron.app.exit(1)},120000);
electron.app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "window") {
        contents.on("console-message", event => {
            const message = event.message || "";
            if (/error|failed|fail|pass|explorer_runtime/i.test(message)) console.log("Obsidian:", message);
        });
        contents.on("render-process-gone", (_event, details) => { failed = true; console.error(details); electron.app.exit(1); });
    }
});
electron.app.whenReady().then(async () => {
    const assert = require("assert/strict");
    try {
        let window;
        for (let attempt = 0; attempt < 350; attempt++) {
            window = ownedWindows.find(value => !value.isDestroyed());
            if (window && await window.webContents.executeJavaScript("!!window.app?.plugins?.plugins?.['hub-project-menu'] && typeof window.hubMountWorkspaceExplorer === 'function'").catch(() => false)) break;
            if (window && attempt === 20) await window.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();await app.plugins.enablePlugin('hub-project-menu')})()").catch(() => {});
            await delay(100);
        }
        if (!window || !await window.webContents.executeJavaScript("typeof window.hubExplorerHost === 'object'")) throw Error("Fixture plugin did not initialize");
        window.setSize(1200, 900);
        const wc = window.webContents, evaluate = expression => wc.executeJavaScript(expression).catch(error => { throw Error(expression.slice(0, 180) + ": " + error.message); });
        wc.debugger.attach("1.3");
        const call = (method, params = {}) => wc.debugger.sendCommand(method, params);
        const settle = () => delay(100);
        const click = async (expression, { button = "left", count = 1 } = {}) => {
            const point = await evaluate(`(()=>{const e=(${expression});if(!e)throw Error('Missing native fixture target: '+${JSON.stringify(expression)});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,top=document.elementFromPoint(x,y);if(!e.contains(top))throw Error('Obscured target '+${JSON.stringify(expression)}+': '+top?.outerHTML.slice(0,350));return{x,y}})()`);
            await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
            await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button, clickCount: count });
            await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button, clickCount: count });
            await settle();
        };
        const key = async (key, code, vk, modifiers = 0) => {
            await call("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, modifiers, ...(key === "Enter" ? { text: "\r" } : {}) });
            await call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, modifiers }); await settle();
            await evaluate("window.__explorerProbe?.plugin?.fileOperations?.tail.catch(()=>{})"); await settle();
        };
        const nativeItem = title => `[...document.querySelectorAll('.menu .menu-item')].find(e=>e.querySelector('.menu-item-title')?.textContent===${JSON.stringify(title)})`;
        await evaluate(`require(${JSON.stringify(path.join(__dirname, "workspace-explorer-obsidian-fixture.cjs"))})()`);
        assert(await evaluate("__explorerProbe.root.querySelector('.hub-explorer-create-note').disabled"), "Root New note disabled in actual Obsidian");
        await click("__explorerProbe.row(__explorerProbe.child)");
        assert(await evaluate("(()=>{const e=document.createElement('span');window.hubSetIcon(e,'notebook-plus');return e.querySelector('svg').outerHTML===__explorerProbe.root.querySelector('.hub-explorer-create-note svg').outerHTML})()"),'Toolbar uses the shared Quick Add notebook-plus renderer');
        assert(await evaluate("__explorerProbe.detail(__explorerProbe.child+'/Nested').querySelector('svg').classList.contains('lucide-folder-closed')"),'Actual right-list folder-closed icon renders');
        assert(await evaluate("__explorerProbe.row(__explorerProbe.child).querySelector(':scope > .hub-explorer-icon svg').classList.contains('lucide-folder-closed')"),'Navigation preserves the collapsed folder icon');
        await click("__explorerProbe.row(__explorerProbe.child).querySelector('.hub-explorer-disclosure')");
        assert(await evaluate("__explorerProbe.row(__explorerProbe.child).querySelector(':scope > .hub-explorer-icon svg').classList.contains('lucide-folder-open')"),'Actual expanded folder-open icon renders');
        assert(await evaluate("!!__explorerProbe.root.querySelector('.hub-explorer-sort svg.lucide-arrow-up-down')"),'Actual arrow-up-down icon renders');

        assert(await evaluate("__explorerProbe.row(__explorerProbe.child).classList.contains('is-current-folder')"), "Native pointer navigates folder");
        await click("__explorerProbe.detail(__explorerProbe.child+'/One.md')");
        assert.equal(await evaluate("__explorerProbe.opens.length"), 0, "Single pointer click selects only");
        await click("__explorerProbe.detail(__explorerProbe.child+'/One.md')", { count: 2 });
        assert.equal(await evaluate("__explorerProbe.opens.length"), 1, "Double pointer click uses opening callback");
        await click("__explorerProbe.detail(__explorerProbe.child+'/One.md')", { button: "right" });
        const titles = await evaluate("__explorerProbe.menus.at(-1).entries.filter(Boolean).map(e=>e.title)");
        assert(titles.includes("Open in…") && titles.includes("Rename") && titles.includes("Delete"));
        assert(titles.includes("Cut")&&titles.includes("Copy")&&!titles.some(title=>/Bookmark|Obsidian|Make a copy/.test(title)), "Final clipboard menu without inherited actions");
        assert(await evaluate("!!document.querySelector('.menu')"), "Actual native Menu is visible");
        await click(nativeItem("Open in…")); await delay(250);
        await click(nativeItem("New tab"));
        assert.equal(await evaluate("__explorerProbe.opens.at(-1).placement"), "tab", "Native Open in submenu retains alternate route");
        await click("__explorerProbe.detail(__explorerProbe.child+'/One.md')", { button: "right" });
        await click(nativeItem("Show in system explorer"));
        assert.equal(await evaluate("__explorerProbe.reveals.length"), 1, "System reveal invokes desktop bridge (spied; no external window): " + JSON.stringify(await evaluate("__explorerProbe.desktopInfo")));
        await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
        await click(nativeItem("Name: Descending"));
        assert.equal(await evaluate("__explorerProbe.saved[__explorerProbe.projectRoot].fullExplorer.sort.sortDirection"), "desc", "Native menu updates shared sort");
        await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
        await key("Escape", "Escape", 27);
        assert.equal(await evaluate("__explorerProbe.root.querySelector('.hub-explorer-sort').getAttribute('aria-expanded')"), "false", "Native Escape closes sort menu");
        await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
        const compactWidth=await evaluate("document.querySelector('.hub-explorer-sort-menu').getBoundingClientRect().width");
        assert(compactWidth<210,'Sort menu stays compact');
        assert(await evaluate("(()=>{const b=__explorerProbe.root.querySelector('.hub-explorer-sort').getBoundingClientRect(),m=document.querySelector('.hub-explorer-sort-menu').getBoundingClientRect();return Math.abs((b.left+b.width/2)-(m.left+m.width/2))<1&&m.top>=b.bottom})()"),'Native sort menu centers beneath its button');
        assert(await evaluate("__explorerProbe.root.querySelector('.hub-explorer-breadcrumb').firstElementChild.matches('.hub-explorer-crumb')"),'Native breadcrumb starts with workspace label');
        assert.equal(await evaluate("document.querySelector('.hub-explorer-sort-menu').querySelectorAll('.menu-item').length"),6,'Sort has six options without footer');
        await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
        assert(!await evaluate("!!document.querySelector('.hub-explorer-sort-menu')"),'Second actual pointer click closes sort menu');
        for(const option of ['Name: Ascending','Name: Descending','Modified: Oldest','Modified: Newest','Created: Oldest','Created: Newest']){
            await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
            assert.equal(await evaluate("document.querySelector('.hub-explorer-sort-menu').getBoundingClientRect().width"),compactWidth,'Sort width stays fixed across selections');
            await click(nativeItem(option));
            assert(!await evaluate("!!document.querySelector('.hub-explorer-sort-menu')"),'Option closes sort menu');
        }
        await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
        await click("__explorerProbe.root.querySelector('.hub-explorer-heading')");
        assert(!await evaluate("!!document.querySelector('.hub-explorer-sort-menu')"),'Outside click dismisses sort menu');
        assert(await evaluate("(()=>{const c=__explorerProbe.root.querySelector('.hub-explorer-crumb'),s=__explorerProbe.root.querySelector('.hub-explorer-crumb-separator');return getComputedStyle(c).color===getComputedStyle(s).color&&s.getBoundingClientRect().width===16})()"),'Breadcrumb chevrons match labels and use larger icons');
        assert(await evaluate("(()=>{const r=__explorerProbe.root.querySelector('.hub-explorer-breadcrumb'),s=r.querySelector('.hub-explorer-crumb-separator').getBoundingClientRect(),t=r.querySelector('.hub-explorer-crumb-label').getBoundingClientRect();return CSS.supports('text-box-trim','trim-both')&&Math.abs(s.top+s.height/2-t.top-t.height/2)<1&&r.getBoundingClientRect().height===26})()"),'Breadcrumb cap-height and chevron centers align without changing row height');
        const openedBeforeCreate = await evaluate("__explorerProbe.opens.length");
        await click("__explorerProbe.root.querySelector('.hub-explorer-create-note')");
        assert(await evaluate("!!__explorerProbe.root.querySelector('.project-create-input')"), JSON.stringify(await evaluate("({active:document.activeElement?.outerHTML.slice(0,400),menus:document.querySelectorAll('.menu').length,modal:document.querySelector('.modal')?.textContent.slice(0,100),disabled:__explorerProbe.root.querySelector('.hub-explorer-create-note').disabled,status:__explorerProbe.root.querySelector('.hub-explorer-status').textContent})")));
        assert.equal(await evaluate("__explorerProbe.root.querySelector('.project-create-input').value"), "New note");
        assert(await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/New note.md')"),'Actual file exists before rename confirmation');
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value='Native created'");
        await key("Enter", "Enter", 13);
        assert(await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/Native created.md')"), "Native Enter creates in disposable vault");
        assert.equal(await evaluate("__explorerProbe.opens.length"), openedBeforeCreate, "Creation does not open note");
        await click("__explorerProbe.root.querySelector('.hub-explorer-create-note')");
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value='one'");
        await key("Enter", "Enter", 13);
        assert.equal(await evaluate("app.vault.adapter.read(__explorerProbe.child+'/One.md')"), "Synthetic one", "Case-colliding creation preserves existing bytes");
        assert(await evaluate("!!__explorerProbe.root.querySelector('.project-create-input[aria-invalid=true]')"), "Case-colliding creation retains its error editor");
        await key("Escape", "Escape", 27);
        await click("__explorerProbe.root.querySelector('.hub-explorer-create-folder')");
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value='Cancelled native'");
        await key("Escape", "Escape", 27);
        assert(!await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/Cancelled native')"), "Native Escape leaves no folder");
        assert(!await evaluate("!!__explorerProbe.root.querySelector('.project-create-input')"), "Native Escape cancels inline editor");
        await click("__explorerProbe.detail(__explorerProbe.child+'/Native created.md')");
        await key("a", "KeyA", 65, 2);
        assert.equal(await evaluate("__explorerProbe.root.querySelectorAll('.hub-explorer-contents .is-selected').length"), 6, "Native Ctrl+A is explorer-scoped");
        await key("Escape", "Escape", 27);
        await click("__explorerProbe.detail(__explorerProbe.child+'/Native created.md')");
        await key("Delete", "Delete", 46);
        assert(!await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/Native created.md')"), "Existing Delete callback trashes synthetic note");
        assert(!await evaluate("!!__explorerProbe.detail(__explorerProbe.child+'/Native created.md')"), "Deleted item leaves the right pane");
        await click("__explorerProbe.root.querySelector('.hub-explorer-create-note')");
        assert.equal(await evaluate("__explorerProbe.root.querySelector('.project-create-input').value"),'New note (2)','Actual repeated creation uses numbered default');
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value=''");await key('Enter','Enter',13);
        assert(await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/New note (2).md')"),'Empty name retains generated note');
        await click("__explorerProbe.root.querySelector('.hub-explorer-create-note')");
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value='Outside confirmed'");
        await click("__explorerProbe.root.querySelector('.hub-explorer-heading')");
        await evaluate("__explorerProbe.plugin.fileOperations.tail");await settle();
        assert(await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/Outside confirmed.md')"),'Actual outside click commits rename');

        await evaluate("__explorerProbe.root.querySelector('.hub-explorer-contents').focus()");
        await key("N", "KeyN", 78, 10);
        assert.equal(await evaluate("__explorerProbe.root.querySelector('.project-create-input').value"), "New folder (2)", "Native Ctrl+Shift+N starts inline folder creation");
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value='Native folder'");
        await key("Enter", "Enter", 13);
        assert(await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/Native folder')"), "Native folder created in current directory");
        assert(await evaluate("!!__explorerProbe.row(__explorerProbe.child+'/Native folder')"), "Created folder appears in tree");
        await click("__explorerProbe.detail(__explorerProbe.child+'/Two.md')");
        await key("F2","F2",113);
        assert.equal(await evaluate("__explorerProbe.root.querySelector('.project-create-input').value"),"Two","Native F2 inline rename");
        await evaluate("__explorerProbe.root.querySelector('.project-create-input').value='Renamed two'");
        await key("Enter","Enter",13);
        assert.equal(await evaluate("(async()=> (await __explorerProbe.task()).location.id)()"),await evaluate("__explorerProbe.reference(__explorerProbe.child+'/Renamed two.md')"),"Actual native task reference migrates on F2 rename");
        await click("__explorerProbe.detail(__explorerProbe.child+'/Renamed two.md')");
        await key("c","KeyC",67,2);
        await click("__explorerProbe.row(__explorerProbe.child+'/Native folder')");
        await key("v","KeyV",86,2);
        assert(await evaluate("!!app.vault.getAbstractFileByPath(__explorerProbe.child+'/Native folder/Renamed two.md')"),"Actual clipboard copies file");
        assert.equal(await evaluate("(async()=> (await __explorerProbe.runtime.list()).tasks.length)()"),1,"Copy does not duplicate native tasks");
        await click("__explorerProbe.row(__explorerProbe.child)");
        await click("__explorerProbe.detail(__explorerProbe.child+'/Renamed two.md')");
        await key("x","KeyX",88,2);
        await click("__explorerProbe.row(__explorerProbe.child+'/Nested')");
        await key("v","KeyV",86,2);
        assert.equal(await evaluate("(async()=> (await __explorerProbe.task()).location.id)()"),await evaluate("__explorerProbe.reference(__explorerProbe.child+'/Nested/Renamed two.md')"),"Actual cut/paste migrates task reference");
        await click("__explorerProbe.detail(__explorerProbe.child+'/Nested/Renamed two.md')");
        await key("Delete","Delete",46);
        assert.equal(await evaluate("(async()=> (await __explorerProbe.task()).location.type)()"),"folder","Actual trash reassigns native task to parent folder");
        assert(await evaluate("(async()=> (await __explorerProbe.task()).id===__explorerProbe.linkedId)()"),"Actual task identity survives rename, move and deletion");
        await click("__explorerProbe.row(__explorerProbe.child)");
        const originalTreeWidth=await evaluate("__explorerProbe.root.querySelector('.hub-explorer-tree').getBoundingClientRect().width");
        const edge = await evaluate("(()=>{const e=__explorerProbe.root.querySelector('.hub-explorer-splitter'),r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()");
        const width = await evaluate("__explorerProbe.root.querySelector('.hub-explorer-tree').getBoundingClientRect().width");
        await call("Input.dispatchMouseEvent", { type: "mousePressed", ...edge, button: "left", clickCount: 1 });
        await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: edge.x + 70, y: edge.y, button: "left", buttons: 1 });
        await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: edge.x + 70, y: edge.y, button: "left", clickCount: 1 }); await settle();
        assert(await evaluate("__explorerProbe.root.querySelector('.hub-explorer-tree').getBoundingClientRect().width") > width + 50, "Native pointer separator resize");
        await click("__explorerProbe.root.querySelector('.hub-explorer-sort')");
        assert(await evaluate("(()=>{const b=__explorerProbe.root.querySelector('.hub-explorer-sort').getBoundingClientRect(),m=document.querySelector('.hub-explorer-sort-menu').getBoundingClientRect();return Math.abs(b.left+b.width/2-m.left-m.width/2)<1})()"),'Sort centers after dragging pane divider');
        await key('Escape','Escape',27);
        await click("__explorerProbe.root.querySelector('.hub-explorer-splitter')",{count:2});
        assert.equal(await evaluate("__explorerProbe.saved[__explorerProbe.projectRoot].fullExplorer.treeWidth"),null,'Actual double click resets saved width');
        assert(Math.abs(await evaluate("__explorerProbe.root.querySelector('.hub-explorer-tree').getBoundingClientRect().width")-originalTreeWidth)<1,'Actual double click uses original default');
        for (const theme of ["dark", "light"]) {
            await evaluate(`document.body.classList.remove('theme-dark','theme-light');document.body.classList.add('theme-${theme}')`);
            for (const palette of ["default", "custom"]) {
                if (palette === "custom") await evaluate("__explorerProbe.host.style.setProperty('--interactive-accent','#027a66');__explorerProbe.host.style.setProperty('--background-modifier-border','#9a7552')");
                for (const zoom of [1, 1.25]) {
                    wc.setZoomFactor(zoom); await delay(350);
                    assert(await evaluate("(()=>{const r=__explorerProbe.root.querySelector('.hub-explorer-breadcrumb'),s=r.querySelector('.hub-explorer-crumb-separator').getBoundingClientRect(),t=r.querySelector('.hub-explorer-crumb-label').getBoundingClientRect();return Math.abs(s.top+s.height/2-t.top-t.height/2)<1&&s.width===16&&r.getBoundingClientRect().height===26})()"),'Breadcrumb alignment across themes, palettes and zoom');
                    await evaluate("(()=>{const button=__explorerProbe.root.querySelector('.hub-explorer-sort');const entries=__explorerProbe.menus.find(m=>m.entries.some(e=>e?.title==='Name: Ascending')).entries;window.hubExplorerHost.showMenu({type:'click',currentTarget:button,preventDefault(){},stopPropagation(){}},entries,{compactSort:true});})()"); await settle();
                    assert(await evaluate("!!document.querySelector('.hub-explorer-sort-menu')"),'Menu opened '+theme+palette+zoom+' '+JSON.stringify(await evaluate("({expanded:__explorerProbe.root.querySelector('.hub-explorer-sort').getAttribute('aria-expanded'),active:document.activeElement?.outerHTML.slice(0,200),menus:document.querySelectorAll('.menu').length})")));
                    assert(await evaluate("(()=>{const b=__explorerProbe.root.querySelector('.hub-explorer-sort').getBoundingClientRect(),m=document.querySelector('.hub-explorer-sort-menu').getBoundingClientRect();return Math.abs(b.left+b.width/2-m.left-m.width/2)<1})()"),'Sort centering '+theme+palette+zoom+' '+JSON.stringify(await evaluate("(()=>{const b=__explorerProbe.root.querySelector('.hub-explorer-sort'),m=document.querySelector('.hub-explorer-sort-menu');return{b:b.getBoundingClientRect().toJSON(),m:m.getBoundingClientRect().toJSON(),style:m.getAttribute('style'),width:m.offsetWidth,zoom:getComputedStyle(m).zoom,csswidth:getComputedStyle(m).width}})()")));
                    await evaluate("__explorerProbe.menus.at(-1).menu.hide(); void 0");

                    await click("__explorerProbe.detail(__explorerProbe.child+'/One.md')");await key('F2','F2',113);
                    assert(await evaluate("(()=>{const e=__explorerProbe.root.querySelector('.project-create-input'),s=getComputedStyle(e),r=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect();return s.boxShadow==='none'&&s.backgroundImage==='none'&&r.right<=n.right&&r.width<n.width&&e.closest('.hub-explorer-detail-row').getBoundingClientRect().height<=37})()"),'Compact flat native filename editor across themes and zooms');
                    await key('Escape','Escape',27);

                    assert(await evaluate("__explorerProbe.root.scrollWidth<=__explorerProbe.root.clientWidth+1"), "No overflow " + theme + palette + zoom);
                    assert(await evaluate("(()=>{const a=__explorerProbe.root.querySelector('.hub-explorer-toolbar').getBoundingClientRect(),b=__explorerProbe.root.querySelector('.hub-explorer-location').getBoundingClientRect();return Math.abs(a.top-b.top)<1&&Math.abs(a.bottom-b.bottom)<1})()"), "Aligned native header");
                }
                wc.setZoomFactor(1);
                fs.writeFileSync(path.join(scratch, "explorer-" + theme + "-" + palette + ".png"), (await wc.capturePage()).toPNG());
            }
            await evaluate("__explorerProbe.setMode(true)"); await settle();
            await evaluate("(()=>{const r=__explorerProbe.row(__explorerProbe.child);if(r.closest('[role=treeitem]').getAttribute('aria-expanded')==='true')r.click()})()");
            assert(await evaluate("!!__explorerProbe.row(__explorerProbe.child+'/One.md')" ) === false, "Collapsed Note branch remains collapsed");
            await click("__explorerProbe.row(__explorerProbe.child)");
            assert(await evaluate("!!__explorerProbe.row(__explorerProbe.child+'/One.md')"), "Note retains mixed tree and row expansion");
            await click("__explorerProbe.row(__explorerProbe.child+'/One.md')");
            assert(await evaluate("__explorerProbe.opens.at(-1).path.endsWith('/One.md')"), "Note single-click opening retained");
            await evaluate("__explorerProbe.setMode(false)"); await settle();
            assert(!await evaluate("!!__explorerProbe.root.querySelector('.hub-explorer-tree [data-path$=\".md\"]')"), "Full returns to folder-only tree");
        }
        await evaluate(`(async()=>{
            const p=__explorerProbe,plugin=p.plugin,resources=plugin.projectWizard.getResourceTypes(),resource=resources.find(r=>r.resourceType==='references')??resources[0];
            const target=resource.root+'/Explorer transfer';await app.vault.createFolder(target);
            const result=await p.runtime.createTask({text:'Synthetic completed transfer',nativeLocation:p.reference(p.child+'/One.md'),completed:true,steps:[{text:'Preserved step'}]});p.transferId=result.task.id;
            await plugin.fileOperations.move(p.child+'/One.md',target+'/One.md',{filesView:true});
            const destination=plugin.nativeTaskHost.runtime({type:'resource',id:resource.resourceType}),moved=(await destination.list()).tasks.find(t=>t.id===result.task.id);
            if(!moved||!moved.completed||moved.steps[0].text!=='Preserved step')throw Error('Actual cross-workspace transfer lost identity or metadata');
            if((await p.runtime.list()).tasks.some(t=>t.id===result.task.id))throw Error('Previous owner still contains transferred task');
            const history=await plugin.nativeTaskHost.completionFeed.read();if(!history.records.some(h=>h.nativeHistory.taskId===result.task.id&&h.nativeHistory.owner.id==='explorer-fixture'))throw Error('History attribution changed during transfer');
            await plugin.fileOperations.move(target+'/One.md',p.child+'/One.md',{filesView:true});
            const reviewId=require('crypto').randomUUID(),intent=await plugin.fileOperations.plan('rename',p.child+'/One.md',p.child+'/Review.md',{},'a'.repeat(64));
            await plugin.fileOperations.enqueue(async()=>{await plugin.nativeTaskHost.files.request({action:'prepare',operationId:reviewId,intent});await plugin.nativeTaskHost.files.request({action:'progress',operationId:reviewId,progress:{phase:'review',message:'Synthetic ambiguity'}});});
            app.commands.executeCommandById('hub-project-menu:file-operation-recovery');
            for(let i=0;i<100&&!plugin.fileOperationRecoveryModal?.contentEl.textContent.includes('Keep original source');i++)await new Promise(r=>setTimeout(r,20));
            const recovery=plugin.fileOperationRecoveryModal;
            if(!recovery?.containerEl.classList.contains('hub-color-scope')&&!recovery?.containerEl.querySelector('.hub-color-scope'))throw Error('Recovery modal lacks color ownership');
            const keep=[...recovery.contentEl.querySelectorAll('button')].find(b=>b.textContent.startsWith('Keep original source'));
            if(!keep)throw Error('Recovery review choices missing');keep.click();
            for(let i=0;i<100&&(await plugin.fileOperations.list()).length;i++)await new Promise(r=>setTimeout(r,20));
            if((await plugin.fileOperations.list()).length)throw Error('Explicit source review did not resolve the pending intent');recovery.close();
            if(plugin.fileOperationRecoveryModal)throw Error('Recovery modal lifecycle was not cleaned');
            const renamed='Projects/Explorer renamed';await plugin.fileOperations.rename(p.projectRoot,renamed,{workspaceRename:true});
            await plugin.fileOperations.rename(renamed+'/Hub.md',renamed+'/Renamed hub.md',{workspaceRename:true});
            if(!(await p.runtime.list()).tasks.some(t=>t.id===result.task.id))throw Error('Workspace rename changed task ownership');
            if((await plugin.fileOperations.list()).length)throw Error('Unexpected unresolved filesystem operation');
            const partialRoot='Projects/Partial project';await app.vault.createFolder(partialRoot);
            const partial=await app.vault.create(partialRoot+'/Partial project.md','---\\ntype: project\\nprojectId: partial-fixture\\nstatus: active\\n---\\n');
            for(let i=0;i<100&&!plugin.projectWizard.getProjectRecords().some(w=>w.projectId==='partial-fixture');i++)await new Promise(r=>setTimeout(r,20));
            await plugin.nativeTaskHost.refreshInventory();const card=document.body.createDiv(),title=card.createDiv({cls:'home-project-title',text:'Partial project'}),dash=document.body.createDiv();
            const originalRename=plugin.fileOperations.rename.bind(plugin.fileOperations);let calls=0;
            plugin.fileOperations.rename=async(...args)=>{if(++calls===2)throw Error('Synthetic second rename failure');return originalRename(...args);};
            try{await plugin.performRename(partial,'Partial renamed',card,dash);}finally{plugin.fileOperations.rename=originalRename;}
            if(card.dataset.projectPath!=='Projects/Partial renamed/Partial project.md'||!app.vault.getAbstractFileByPath(card.dataset.projectPath))throw Error('Partial Project rename pointed the card at a nonexistent rollback path');card.remove();dash.remove();

        })()`);
        await evaluate("__explorerProbe.cleanup()");
        assert(!await evaluate("!!document.querySelector('.hub-explorer-splitter')"), "Explorer teardown removes controls");
        await evaluate("(async()=>{const p=app.plugins.plugins['hub-project-menu'];app.plugins.disablePlugin('hub-project-menu');await p.nativeTaskStopping})()");
        console.log("PASS actual isolated Obsidian explorer runtime", JSON.stringify({ hidden: !window.isVisible(), scratch, themes: 2, palettes: 2, zooms: 2 }));
    } catch (error) {
        failed = true; console.error(error.stack);
        const window = ownedWindows.find(value => !value.isDestroyed());
        if (window) {
            fs.writeFileSync(path.join(scratch, "failure.png"), (await window.webContents.capturePage()).toPNG());
            await window.webContents.executeJavaScript("(async()=>{window.__explorerProbe?.cleanup();const p=window.app?.plugins?.plugins?.['hub-project-menu'];if(p){app.plugins.disablePlugin('hub-project-menu');await p.nativeTaskStopping}})()").catch(() => {});
        }
    }
    finally { clearTimeout(timer); electron.app.exit(failed ? 1 : 0); }
});
try { boot(archive, events); }
catch (error) { failed = true; clearTimeout(timer); console.error(error.stack); electron.app.exit(1); }
