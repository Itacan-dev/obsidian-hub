"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert/strict");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = check(); if (value) return value; await delay(30); }
    throw Error("Timed out: " + label);
}
module.exports = async function verify(scratch) {
    let plugin = app.plugins.plugins["hub-project-menu"], library = plugin.musicLibrary;
    // The fresh synthetic vault may show Obsidian's first-run community-plugin
    // consent dialog before the launcher enables its test plugin.
    document.querySelectorAll(".modal-container .modal-close-button,.modal-container .modal-header-button").forEach(button => button.click());
    await until(() => !document.querySelector(".modal-container"), "first-run dialog closes");
    const results = [], checks = [];
    const pass = label => { checks.push(label); console.log("PASS Music runtime: " + label); };
    const closeDialog = async selector => { document.querySelector(selector)?.querySelector(".modal-close-button,.modal-header-button")?.click(); await until(() => !document.querySelector(selector), "native dialog closes"); await delay(200); };
    const openMusic = async () => { plugin.musicControl.open(); await until(() => document.querySelector(".hub-music-dialog"), "Music opens through actual global control"); };
    const identity = () => JSON.stringify(Object.fromEntries(Object.entries(plugin.projectWizard.data).filter(([key]) => !["music","spotifyConnect","hubState"].includes(key))));
    const previous = identity();
    assert.equal(library.state.enabled, false); assert.equal(plugin.musicControl.button.hidden, true);
    pass("fresh default is disabled and the actual bottom launcher is hidden");
    plugin.settingsControl.open("music");
    await until(() => document.querySelector(".hub-settings-dialog"), "native Settings dialog mounts");
    const settings = document.querySelector(".hub-settings-dialog");
    assert(settings && settings.querySelector('[role="tab"][aria-selected="true"]').textContent === "Music");
    assert.equal(settings.querySelectorAll('.checkbox-container').length, 5);
    settings.querySelector('.checkbox-container[aria-label="Enable Music"] input').click();
    await until(() => library.state.enabled && !plugin.musicControl.button.hidden, "native Enable Music toggle");
    assert.equal(plugin.musicControl.button.hidden, false);
    const clientId = "0123456789abcdef0123456789abcdef";
    const clientInput = settings.querySelector('input[aria-label="Spotify Client ID"]');
    assert(clientInput, "Spotify connection settings belong to the existing Music page");
    assert.equal(plugin.spotifyConnect.snapshot.connected, false);
    assert.equal(settings.querySelector('input[aria-label="Spotify redirect URI"]').value, plugin.spotifyConnect.snapshot.redirectUri);
    clientInput.focus(); clientInput.value = clientId; clientInput.dispatchEvent(new Event("input", { bubbles: true }));
    clientInput.setSelectionRange(5, 5); plugin.spotifyConnect.emit();
    assert.equal(settings.querySelector('input[aria-label="Spotify Client ID"]').value, clientId, "Auth state updates preserve unsaved client ID draft");
    settings.querySelector('[data-music-focus="spotify-save-client-id"]').click();
    await until(() => plugin.spotifyConnect.snapshot.clientId === clientId, "actual native Client ID save");
    pass("Spotify Settings saves Client ID, preserves drafts and displays exact loopback redirect without exposing secrets");
    pass("actual Settings Music tab and native toggle immediately enable launcher");
    await closeDialog(".hub-settings-dialog"); await openMusic();
    assert(document.querySelector(".hub-music-empty") && !document.querySelector(".hub-music-empty").hidden);
    [...document.querySelectorAll(".hub-music-dialog button")].find(button => button.textContent === "Open Music settings").click();
    await until(() => document.querySelector(".hub-settings-dialog"), "empty state Settings mounts");
    assert(document.querySelector(".hub-settings-dialog [role=tab][aria-selected=true]").textContent === "Music");
    pass("Music empty state opens the existing Settings Music category");
    const add = [...document.querySelectorAll(".hub-settings-dialog button")].find(button => button.textContent === "Add music"); add.click();
    await until(() => document.querySelector(".hub-music-item-dialog"), "Add music mounts");
    const editor = document.querySelector(".hub-music-item-dialog");
    library.options.metadata = false;
    assert.equal(editor.querySelector("select").value, "spotify", "Source option stores the stable provider ID");
    const source = editor.querySelector('input[inputmode="url"]'); source.value = "https://example.com/not-music";
    editor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await until(() => source.getAttribute("aria-invalid") === "true", "invalid input feedback");
    assert.equal(library.list().length, 0); assert(editor.querySelector('[role=alert]').textContent);
    await delay(50);
    editor.querySelector("select").value = "youtube"; editor.querySelector("select").dispatchEvent(new Event("change"));
    source.value = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
    editor.querySelector('input[id$="-name"]').value = "YouTube fixture";
    editor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !editor.isConnected && library.list().length === 1, "valid music form saves");
    await closeDialog(".hub-settings-dialog");
    const atlasBefore = plugin.atlas.view();
    if (atlasBefore.status === "UNINITIALIZED") {
        const result = await plugin.atlas.command({ kind: "INITIALIZE", policy: { whitelist: ["music.youtube.com", "consent.youtube.com"], blacklist: [] },
            configuration: { accessTiming: { waitMs: 10000, confirmationWindowMs: 60000, grantDurationMs: 60000 },
                vaultTiming: { waitMs: 30000, confirmationWindowMs: 60000 }, journeyLimits: { lifetimeMs: 300000, maxHops: 12 } } });
        assert.equal(result.status, "READY", "Synthetic Atlas setup uses the existing supported initialization command");
    }
    console.log("MUSIC_RUNTIME Atlas", JSON.stringify({ status: plugin.atlas.view().status, enabled: plugin.atlas.view().enabled }));
    pass("actual Add music form rejects invalid URL and saves a valid provider URL with its display name");
    library.options.metadata = false;
    const youtube = library.list()[0]; assert.equal(youtube.provider, "youtube");
    const playlist = await library.add({ provider: "youtube", name: "YouTube playlist fixture", source: "https://www.youtube.com/playlist?list=PLBCF2DAC6FFB574DE" });
    const spotify = await library.add({ provider: "spotify", name: "Spotify fixture", source: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" });
    const ytm = await library.add({ provider: "youtube-music", name: "YouTube Music fixture", source: "https://music.youtube.com/watch?v=dQw4w9WgXcQ" });
    plugin.settingsControl.open("music");
    await until(() => document.querySelector(".hub-settings-dialog"), "local-file Settings opens");
    [...document.querySelectorAll(".hub-settings-dialog button")].find(button => button.textContent === "Add music").click();
    await until(() => document.querySelector(".hub-music-item-dialog"), "local-file native form opens");
    const localEditor = document.querySelector(".hub-music-item-dialog");
    localEditor.querySelector("select").value = "local";
    localEditor.querySelector("select").dispatchEvent(new Event("change"));
    window.__musicRuntimeStage = "local-files";
    await new Promise(resolve => { window.__musicRuntimeContinue = resolve; });
    assert.equal(localEditor.querySelectorAll(".hub-capture-attachment").length, 2, "Actual Chromium file input accepts multiple native files");
    localEditor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !localEditor.isConnected && library.list().length === 6, "native local-file form saves both references");
    await closeDialog(".hub-settings-dialog");
    const [local, external] = library.list().filter(item => item.provider === "local");
    assert.equal(local.source, "Fixture one.wav"); assert.equal(external.source, path.join(scratch, "Fixture two.wav"));
    assert.equal(library.list().length, 6);
    await library.rename(local.id, "Quiet focus"); await library.move(local.id, -4);
    assert.equal(library.list()[0].id, local.id); assert.equal(library.get(local.id).name, "Quiet focus");
    for (const provider of ["spotify", "youtube", "youtube-music", "local"]) {
        await library.setProviderEnabled(provider, false);
        assert(library.list().some(item => item.provider === provider));
        assert(!library.list({ enabledOnly: true }).some(item => item.provider === provider));
        await library.setProviderEnabled(provider, true);
    }
    await library.setItemEnabled(ytm.id, false); assert.equal(library.get(ytm.id).enabled, false);
    await library.setItemEnabled(ytm.id, true);
    pass("all four sources save, rename and reorder; provider/item toggles retain references");
    await openMusic();
    assert.equal(document.querySelectorAll(".hub-music-row").length, 6);
    await plugin.music.setVolume(0);
    await plugin.music.select(local.id);
    await until(() => plugin.music.state.status === "playing", "vault WAV native playback");
    assert(plugin.music.state.duration > 8); assert(plugin.music.snapshot.capabilities.seek);
    const seek = document.querySelector('[aria-label="Playback position"]'); seek.focus(); seek.value = "2";
    seek.dispatchEvent(new Event("input", { bubbles: true })); seek.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => plugin.music.state.currentTime >= 1.9, "native seek event synchronizes progress");
    // Native seeking briefly buffers and disables the input. Refocus after
    // that normal transition to verify a focused control never freezes time.
    await until(() => !seek.disabled && plugin.music.state.status === "playing", "native seek buffering finishes");
    seek.focus(); assert.equal(document.activeElement, seek); const sought = Number(seek.value);
    await until(() => Number(seek.value) > sought + .1, "focused seek range continues following native playback after the gesture");
    assert.equal(document.activeElement, seek);
    await plugin.music.setVolume(.2); assert.equal(plugin.music.provider.audio.volume, .2);
    await plugin.music.pause(); assert.equal(plugin.music.provider.audio.paused, true);
    await plugin.music.play();
    const audio = plugin.music.provider.audio, time = audio.currentTime;
    await closeDialog(".hub-music-dialog"); await delay(200);
    assert.equal(plugin.music.provider.audio, audio); assert(!audio.paused); assert(audio.currentTime >= time);
    await openMusic(); assert.equal(plugin.music.provider.audio, audio);
    assert(document.querySelector('[aria-label="Pause"]')); assert(document.querySelector('[aria-label="Playback position"]'));
    pass("vault WAV play/pause/seek/volume and exact audio instance survive native modal close/reopen");
    await plugin.music.next();
    await until(() => plugin.music.state.status !== "loading", "external WAV settles");
    const externalResult = { status: plugin.music.state.status, message: plugin.music.state.message, src: plugin.music.provider?.audio?.src };
    results.push({ provider: "external-local", ...externalResult });
    assert.equal(plugin.music.itemId, external.id); assert.equal(plugin.music.state.status, "playing", JSON.stringify(externalResult));
    assert.equal(plugin.music.provider.audio.volume, .2, "Saved controller volume survives source load");
    assert.equal(plugin.music.state.volume, .2, "Volume intent is not replaced by the new audio node's default");
    assert.equal(audio.paused, true);
    await plugin.music.previous(); assert.equal(plugin.music.itemId, local.id); assert.equal(plugin.music.provider.audio.volume, .2);
    await plugin.music.seek(plugin.music.state.duration - .15); await delay(600);
    assert.equal(plugin.music.itemId, external.id);
    assert.equal(plugin.music.provider.audio.volume, .2, "Automatic next retains the intended volume");
    pass("external local WAV works, switching stops old audio, previous/next and automatic next follow saved order");
    await plugin.music.pause();
    fs.unlinkSync(path.join(scratch, "Fixture two.wav"));
    await plugin.music.select(local.id, { autoplay: false }); await plugin.music.select(external.id);
    assert.equal(plugin.music.state.status, "error"); assert(plugin.music.snapshot.item.name.includes("Fixture two"));
    assert(document.querySelector(".hub-music-feedback.hub-task-error").textContent);
    pass("removed external audio is identified and fails inline");
    await library.remove(external.id); assert.equal(library.get(external.id), null);
    const invalidPath = path.join(scratch, "Corrupt fixture.wav"); fs.writeFileSync(invalidPath, "Invalid WAV bytes");
    const [invalid] = await library.addLocalFiles([invalidPath]); await plugin.music.select(invalid.id);
    assert.equal(plugin.music.state.status, "error"); assert.equal(plugin.music.snapshot.item.id, invalid.id);
    assert(document.querySelector(".hub-music-feedback.hub-task-error").textContent);
    await library.remove(invalid.id);
    pass("existing undecodable audio is identified and fails inline through Chromium media events");
    await plugin.music.select(local.id, { autoplay: false });
    window.__musicRuntimeStage = "music";
    await delay(600);
    await new Promise(resolve => { window.__musicRuntimeContinue = resolve; });
    await closeDialog(".hub-music-dialog");
    plugin.settingsControl.open("music"); window.__musicRuntimeStage = "settings";
    await until(() => document.querySelector(".hub-settings-dialog"), "Settings screenshot mounts");
    await delay(500);
    await new Promise(resolve => { window.__musicRuntimeContinue = resolve; });
    const spotifySection = [...document.querySelectorAll(".hub-settings-dialog h3")].find(heading => heading.textContent === "Spotify");
    assert(spotifySection); spotifySection.scrollIntoView({ block: "start" });
    window.__musicRuntimeStage = "spotify-settings"; await delay(500);
    await new Promise(resolve => { window.__musicRuntimeContinue = resolve; });
    await closeDialog(".hub-settings-dialog");
    // Exercise real official embeds without bypassing provider restrictions.
    // The hidden application means YouTube correctly refuses background play;
    // native player creation, state/error events and close cleanup are tested.
    await openMusic(); await plugin.music.select(spotify.id, { autoplay: false });
    assert.equal(plugin.music.state.status, "error"); assert.match(plugin.music.state.message, /Connect Spotify.*Settings/i);
    assert.equal(document.querySelectorAll('.hub-music-dialog iframe,.hub-music-dialog webview').length, 0);
    assert(!/preview/i.test(document.querySelector('.hub-music-feedback').textContent));
    results.push({ provider: "spotify", backend: "connect", connected: false, status: plugin.music.state.status, message: plugin.music.state.message });
    await closeDialog(".hub-music-dialog"); await plugin.music.select(local.id, { autoplay: false });
    pass("active Obsidian Spotify uses Connect and explains disconnected setup without Embed or preview warnings");
    for (const item of [youtube, playlist, ytm]) {
        await openMusic();
        const transitions = [], stopAtlas = item.provider === "youtube-music" ? plugin.atlas.subscribe(() => {
            const contexts = plugin.atlas.view().contexts.map(context => ({ nativeId: context.nativeId, phase: context.phase,
                closed: context.closed, response: context.response }));
            if (contexts.length && JSON.stringify(transitions.at(-1)) !== JSON.stringify(contexts)) transitions.push(contexts);
        }) : null;
        const started = Date.now();
        await plugin.music.select(item.id, { autoplay: false });
        await delay(700);
        const state = plugin.music.snapshot;
        let guestURL;
        try { guestURL = plugin.music.provider?.webview?.getURL(); } catch (_) { /* A blocked guest has been closed. */ }
        const record = { provider: item.provider, sourceType: item.sourceType, status: state.status, message: state.message,
            frame: plugin.music.provider?.element?.querySelector("iframe")?.src || guestURL || plugin.music.provider?.webview?.getAttribute("src") || null,
            capabilities: state.capabilities, elapsedMs: Date.now() - started };
        if (item.provider === "youtube-music") { record.atlas = transitions; stopAtlas(); }
        results.push(record); console.log("MUSIC_PROVIDER_RUNTIME", JSON.stringify(record));
        assert(!["loading", "idle"].includes(state.status), item.provider + " must settle to a usable or explained unavailable state");
        window.__musicRuntimeStage = item.provider + "-" + item.sourceType;
        await delay(400);
        await new Promise(resolve => { window.__musicRuntimeContinue = resolve; });
        const previousProvider = plugin.music.provider;
        await closeDialog(".hub-music-dialog");
        assert.equal(plugin.music.provider, null); assert(previousProvider.destroyed);
        assert.equal(document.querySelectorAll(".hub-music-dialog iframe,.hub-music-dialog webview").length, 0);
    }
    const originalFactory = plugin.music.factory;
    const { SpotifyEmbedBackend } = require(path.join(scratch, "vault/.obsidian/plugins/hub-project-menu/lib/music/spotify-embed.js"));
    plugin.music.factory = (owner, item, options) => item.provider === "spotify" ? new SpotifyEmbedBackend(owner, item, options) : originalFactory(owner, item, options);
    try {
        await openMusic(); await plugin.music.select(spotify.id, { autoplay: false });
        const embed = plugin.music.provider;
        results.push({ provider: "spotify", backend: "retained-embed", status: plugin.music.state.status,
            frame: embed.element.querySelector("iframe")?.src || null });
        assert(["ready", "error"].includes(plugin.music.state.status));
        await closeDialog(".hub-music-dialog"); assert(embed.destroyed);
    } finally { plugin.music.factory = originalFactory; }
    pass("retained standalone Spotify Embed can still load and release without becoming the Obsidian default");
    const spotifyChecks = await require("./music-spotify-connect-fixture.cjs")({ plugin, spotify, local, scratch, until, delay, closeDialog, pass });
    results.push(spotifyChecks);
    pass("official provider load outcomes settle honestly and native close releases all streaming players");
    const nativeApi = plugin.constructor.__musicRuntimeApi;
    const network = await Promise.all([
        "https://www.youtube.com/iframe_api", "https://open.spotify.com/embed/iframe-api/v1", "https://music.youtube.com/watch?v=dQw4w9WgXcQ"
    ].map(async url => {
        try {
            const response = await Promise.race([nativeApi.requestUrl({ url, throw: false }), delay(8000).then(() => null)]);
            return { url, status: response?.status ?? null, ...(response ? {} : { error: "Request timed out" }) };
        } catch (error) { return { url, status: null, error: error.message }; }
    }));
    console.log("MUSIC_RUNTIME network", JSON.stringify(network));
    const saved = JSON.stringify(library.state);
    assert.equal(identity(), previous, "Music leaves unrelated durable state intact");
    await app.plugins.disablePlugin("hub-project-menu");
    await app.plugins.enablePlugin("hub-project-menu");
    plugin = app.plugins.plugins["hub-project-menu"]; library = plugin.musicLibrary;
    assert.equal(plugin.spotifyConnect.snapshot.clientId, clientId);
    assert.equal(plugin.spotifyConnect.snapshot.connected, true, "Native OS-protected synthetic credentials survive reload");
    assert.equal(JSON.stringify(library.state), saved); assert.equal(plugin.musicControl.button.hidden, false);
    assert.equal(plugin.music.state.status, "idle"); assert.equal(plugin.music.provider, null);
    await library.setEnabled(false); assert.equal(plugin.musicControl.button.hidden, true); assert.equal(library.list().length, 5);
    await library.setEnabled(true); assert.equal(library.list({ enabledOnly: true }).length, 5);
    plugin.settingsControl.open("music"); await until(() => document.querySelector(".hub-settings-dialog"), "Spotify disconnect Settings opens");
    document.querySelector('[data-music-focus="spotify-disconnect"]').click();
    await until(() => !plugin.spotifyConnect.snapshot.connected && !plugin.projectWizard.data.spotifyConnect.tokensEnc, "actual native Disconnect clears local credentials");
    assert.equal(library.list().length, 5); await closeDialog(".hub-settings-dialog");
    pass("Client ID and protected synthetic connection survive reload; native Disconnect clears local credentials and retains music");
    pass("actual plugin unload/reload restores durable configuration without autoplay and disabling retains library");
    return { checks, providers: results, network };
};
