"use strict";
const { ToggleComponent, Menu } = require("obsidian");
const { MUSIC_PROVIDERS, musicProvider } = require("../domain/music");
const { row, section } = require("./settings-pages");
const { setHubIcon } = require("./icons");
const { action } = require("./capture-modal");
const { openMusicItemEditor } = require("./music-item-editor");
const { bindMenuToggle } = require("./menu-toggle");
const { hasKeyboardFocus, focusControl } = require("./focus-restoration");

function mountMusicSettings(parent, service) {
    const error = parent.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
    const host = parent.createDiv({ cls: "hub-music-settings" });
    const spotify = service.plugin?.spotifyConnect;
    let clientIdDraft = spotify?.snapshot.clientId ?? "";
    let clientIdDirty = false;
    let disposed = false, busy = false, editor = null, toggles = [];
    const toggle = (control, label, value, change) => {
        const component = new ToggleComponent(control).setValue(value).onChange(value => { void run(() => change(value)); });
        component.toggleEl?.setAttribute("aria-label", label); component.setDisabled(busy);
        toggles.push(component);
        return component;
    };
    let itemMenu = null, itemMenuButton = null, menuToggles = [];
    const run = async (work, returnKey = null) => {
        if (disposed || busy) return;
        busy = true; error.textContent = "";
        host.setAttribute("aria-busy", "true");
        const controls = [...host.querySelectorAll("button,input,select")], disabled = controls.map(control => control.disabled);
        controls.forEach(control => control.disabled = true);
        toggles.forEach(component => component.setDisabled(true));
        try { await work(); }
        catch (problem) { if (!disposed) error.textContent = problem.message || "Could not save music settings. Try again."; }
        finally {
            busy = false;
            if (!disposed) { host.removeAttribute("aria-busy"); controls.forEach((control, index) => { control.disabled = disabled[index]; }); render();
                if (returnKey && (host.ownerDocument.activeElement === host.ownerDocument.body || host.contains(host.ownerDocument.activeElement))) focusControl([...host.querySelectorAll("[data-music-focus]")].find(control => control.dataset.musicFocus === returnKey) ?? host.querySelector('[data-music-focus="add"]')); }
        }
    };
    const openEditor = options => {
        if (disposed || busy || editor) return;
        const returnKey = options.returnFocus?.dataset?.musicFocus;
        editor = openMusicItemEditor(service, { ...options, onClose() {
            editor = null;
            if (!disposed) {
                render();
                if (returnKey) [...host.querySelectorAll("[data-music-focus]")].find(control => control.dataset.musicFocus === returnKey)?.focus({ preventScroll: true });
            }
        } });
    };
    function render() {
        if (disposed || busy) return;
        itemMenu?.hide(); menuToggles.splice(0).forEach(stop => stop());
        const active = host.ownerDocument.activeElement;
        const focusKey = host.contains(active) ? active?.dataset?.musicFocus : null;
        const selection = focusKey && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
        host.empty(); toggles = [];
        const state = service.state;
        if (service.compatibilityError) {
            host.createEl("p", { cls: "hub-task-error", text: service.compatibilityError + " Update Itacan to edit this library.", attr: { role: "alert" } });
            return;
        }
        let group = section(host, "General");
        const control = row(group, "Enable Music", "Show Music in the bottom bar. Your saved music is retained when disabled.");
        const enabled = toggle(control, "Enable Music", state.enabled, value => service.setEnabled(value));
        if (enabled.toggleEl) enabled.toggleEl.dataset.musicFocus = "enabled";
        group = section(host, "Sources");
        for (const provider of MUSIC_PROVIDERS) {
            const control = row(group, provider.name);
            const label = control.parentElement.querySelector(".hub-settings-label");
            label.classList.add("hub-music-provider-label");
            const icon = label.ownerDocument.createElement("span"); icon.className = "hub-capture-icon"; icon.setAttribute("aria-hidden", "true");
            label.prepend(icon); setHubIcon(icon, provider.icon);
            const component = toggle(control, provider.name, state.providers[provider.id], value => service.setProviderEnabled(provider.id, value));
            if (component.toggleEl) component.toggleEl.dataset.musicFocus = provider.id;
        }
        if (spotify) {
            const connection = spotify.snapshot;
            if (!clientIdDirty) clientIdDraft = connection.clientId;
            group = section(host, "Spotify");
            const clientControl = row(group, "Client ID", "Use the Client ID from your Spotify Developer Dashboard app. No Client Secret is needed.");
            const clientFields = clientControl.createDiv({ cls: "hub-music-client-control" });
            const clientInput = clientFields.createEl("input", { attr: { type: "text", value: clientIdDraft,
                "aria-label": "Spotify Client ID", placeholder: "Spotify Client ID", spellcheck: "false", autocomplete: "off" } });
            clientInput.dataset.musicFocus = "spotify-client-id";
            clientInput.disabled = connection.connecting;
            const saveClientId = action(clientFields, "Save", "check", () => { void run(async () => {
                await spotify.setClientId(clientIdDraft); clientIdDirty = false;
            }); });
            saveClientId.dataset.musicFocus = "spotify-save-client-id";
            saveClientId.disabled = connection.connecting || clientIdDraft.trim() === connection.clientId;
            clientInput.addEventListener("input", () => {
                clientIdDraft = clientInput.value; clientIdDirty = true;
                saveClientId.disabled = clientIdDraft.trim() === spotify.snapshot.clientId;
                if (connect) connect.disabled = !clientIdDraft.trim() || !spotify.snapshot.secureStorageAvailable;
            });
            clientInput.addEventListener("keydown", event => {
                if (event.key === "Enter" && !saveClientId.disabled) { event.preventDefault(); saveClientId.click(); }
            });
            const redirectControl = row(group, "Redirect URI", "Add this exact URI to the app's redirect URIs in Spotify Developer Dashboard, then save the app.");
            redirectControl.createEl("input", { attr: { type: "text", value: connection.redirectUri, readonly: "",
                "aria-label": "Spotify redirect URI", title: connection.redirectUri, spellcheck: "false" } }).dataset.musicFocus = "spotify-redirect-uri";
            const accountControl = row(group, "Connection", connection.connecting ? "Waiting for Spotify authorization in your browser." : connection.connected ? "Connected to Spotify." : "Spotify is not connected.");
            let connect = null;
            if (!connection.connected && !connection.connecting) {
                connect = action(accountControl, "Connect Spotify", "external-link", () => { void run(async () => {
                    if (clientIdDraft.trim() !== spotify.snapshot.clientId) {
                        await spotify.setClientId(clientIdDraft); clientIdDirty = false;
                    }
                    await spotify.connect();
                }); });
                connect.dataset.musicFocus = "spotify-connect";
                connect.disabled = !clientIdDraft.trim() || !connection.secureStorageAvailable;
            } else {
                const disconnect = action(accountControl, connection.connecting ? "Cancel connection" : "Disconnect Spotify", "unlink", () => { void run(() => spotify.disconnect()); });
                disconnect.dataset.musicFocus = "spotify-disconnect";
            }
            if (connection.message) group.createEl("p", { cls: connection.status === "error" ? "hub-task-error" : "hub-settings-description",
                text: connection.message, attr: { role: connection.status === "error" ? "alert" : "status", "aria-live": "polite" } });
            else if (!connection.secureStorageAvailable) group.createEl("p", { cls: "hub-task-error", text: "Secure credential storage is unavailable in this Obsidian runtime. Spotify cannot connect.", attr: { role: "alert" } });
            group.createEl("p", { cls: "hub-settings-description", text: "Spotify Premium and a running Spotify app or another Spotify Connect device are required. Disconnect clears Itacan's local credentials." });
        }
        group = section(host, "Music library");
        const add = action(row(group, "Configured music", "Save links and file references, then choose them in Music."), "Add music", "plus", () => openEditor({ returnFocus: add }));
        add.dataset.musicFocus = "add";
        const list = group.createDiv({ cls: "hub-music-library" });
        if (!state.items.length) list.createEl("p", { cls: "hub-capture-muted", text: "No music configured. Add a music link or local audio files." });
        state.items.forEach((item, index) => {
            const entry = list.createDiv({ cls: "hub-music-library-row" });
            const copy = entry.createDiv({ cls: "hub-music-library-copy" });
            copy.createDiv({ cls: "hub-music-library-name", text: item.name });
            copy.createDiv({ cls: "hub-music-library-source", text: `${musicProvider(item.provider)?.name ?? item.provider} · ${item.sourceType === "file" ? "Audio file" : item.sourceType}` });
            copy.createDiv({ cls: "hub-music-library-source", text: item.source, attr: { title: item.source } });
            const controls = entry.createDiv({ cls: "hub-music-library-actions" });
            const component = toggle(controls, "Enable " + item.name, item.enabled, value => service.setItemEnabled(item.id, value));
            if (component.toggleEl) component.toggleEl.dataset.musicFocus = "item-" + item.id;
            const menuButton = action(controls, "", "ellipsis", event => {
                if (itemMenu && itemMenuButton === menuButton) { itemMenu.hide(); return; }
                itemMenu?.hide(); itemMenuButton = menuButton;
                let keyboard = hasKeyboardFocus(menuButton, event);
                const menu = itemMenu = new Menu(), doc = host.ownerDocument;
                const onKey = () => { keyboard = true; }, onPointer = () => { keyboard = false; };
                doc.addEventListener("keydown", onKey, true); doc.addEventListener("pointerdown", onPointer, true);
                menu.onHide(() => {
                    doc.removeEventListener("keydown", onKey, true); doc.removeEventListener("pointerdown", onPointer, true);
                    if (itemMenu === menu) { itemMenu = null; itemMenuButton = null; }
                    menuButton.setAttribute("aria-expanded", "false");
                    const focused = doc.activeElement;
                    if (!disposed && !editor && keyboard && (focused === doc.body || menu.dom?.contains(focused))) focusControl(menuButton);
                });
                const manage = work => { void run(work, keyboard ? menuButton.dataset.musicFocus : null); };
                menuButton.setAttribute("aria-expanded", "true");
                menu.addItem(option => option.setTitle("Rename").setIcon("square-pen").onClick(() => openEditor({ item, returnFocus: menuButton })));
                menu.addItem(option => option.setTitle("Move up").setIcon("arrow-up").setDisabled(index === 0).onClick(() => { manage(() => service.move(item.id, -1)); }));
                menu.addItem(option => option.setTitle("Move down").setIcon("arrow-down").setDisabled(index === state.items.length - 1).onClick(() => { manage(() => service.move(item.id, 1)); }));
                menu.addSeparator();
                menu.addItem(option => option.setTitle("Remove").setIcon("trash-2").onClick(() => { manage(() => service.remove(item.id)); }));
                const rect = menuButton.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
            }, "hub-music-library-menu");
            menuButton.setAttribute("aria-label", "Options for " + item.name); menuButton.setAttribute("aria-haspopup", "menu"); menuButton.title = "Music options";
            menuButton.dataset.musicFocus = "menu-" + item.id;
            menuButton.setAttribute("aria-expanded", "false");
            menuToggles.push(bindMenuToggle(menuButton, { isOpen: () => !!itemMenu && itemMenuButton === menuButton, close: () => itemMenu?.hide() }));
        });
        if (focusKey) {
            const control = [...host.querySelectorAll("[data-music-focus]")].find(control => control.dataset.musicFocus === focusKey);
            control?.focus({ preventScroll: true });
            if (selection) control?.setSelectionRange?.(...selection);
        }
    }
    const unsubscribe = service.onChange(render), unsubscribeSpotify = spotify?.onChange(render); render();
    return () => { disposed = true; itemMenu?.hide(); menuToggles.splice(0).forEach(stop => stop()); unsubscribe(); unsubscribeSpotify?.(); editor?.close(); };
}
module.exports = { mountMusicSettings };
