"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { LocalAudioProvider, localResource } = require("../music/local-audio");
const { YouTubeProvider } = require("../music/youtube");
const { SpotifyProvider } = require("../music/spotify");
const { SpotifyEmbedBackend } = require("../music/spotify-embed");
const { configuredMusicDestination, configuredConsentDestination, constrainMusicGuest } = require("../music/browser-guard");

class Element extends EventTarget {
    constructor(document, name) {
        super(); this.ownerDocument = document; this.tagName = name; this.children = []; this.attributes = new Map();
        this.classList = { add() {} }; this.duration = 120; this.currentTime = 0; this.volume = 1;
        this.paused = true; this.ended = false; this.loads = 0;
    }
    get isConnected() { return !!this.root || !!this.parentElement?.isConnected; }
    appendChild(child) { child.remove(); this.children.push(child); child.parentElement = this; return child; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); if (name === "src") this.src = ""; }
    querySelector(name) { return this.children.find(child => child.tagName === name) || null; }
    load() { this.loads++; if (this.src) queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata"))); }
    play() { this.paused = false; this.dispatchEvent(new Event("playing")); return Promise.resolve(); }
    pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
}
function documentFixture() {
    const document = new EventTarget(); document.hidden = false;
    document.defaultView = new EventTarget(); document.defaultView.location = { origin: "app://obsidian.md" };
    document.createElement = name => new Element(document, name);
    document.head = document.createElement("head"); document.head.root = true;
    const host = document.createElement("div"); host.root = true;
    return { document, host };
}
const plugin = { app: { vault: { getAbstractFileByPath: source => source === "Music/song.mp3" ? { path: source } : null,
    getResourcePath: file => "app://local/" + file.path } } };
const local = { provider: "local", name: "Song", source: "Music/song.mp3" };

test("local adapter retains its playing audio element after the modal host is detached", async () => {
    const { document, host } = documentFixture(), states = [];
    const provider = new LocalAudioProvider(plugin, local, { document, onState: state => states.push(state) });
    provider.mount(host); await provider.load(); await provider.play();
    assert.equal(provider.element.isConnected, false); assert.equal(host.children.length, 0);
    const audio = provider.audio;
    provider.seek(40); provider.setVolume(0.25); provider.element.remove(); provider.suspend();
    assert.equal(audio.paused, false); assert.equal(audio.currentTime, 40); assert.equal(audio.volume, 0.25);
    provider.mount(host); assert.equal(provider.audio, audio); assert.equal(audio.loads, 1); assert.equal(provider.element.isConnected, false);
    assert.equal(states.some(state => state.status === "playing"), true);
    provider.destroy(); assert.equal(audio.paused, true); assert.equal(audio.src, "");
});

test("local source resolver rejects a removed vault file without interpreting it as an external URL", async () => {
    await assert.rejects(localResource(plugin, { source: "Music/missing.mp3" }), /missing from the vault/);
    await assert.rejects(localResource(plugin, { source: "https://example.com/audio.mp3" }), /missing from the vault/);
});

test("external local files reuse Obsidian's native resource route across adapter versions with a plain-browser fallback", async () => {
    const fs = require("fs"), path = require("path"), os = require("os"), { pathToFileURL } = require("url");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hub-music-provider-"));
    const source = path.join(directory, "Quiet #1.wav"); fs.writeFileSync(source, "fixture");
    const expected = "app://native-resource/" + pathToFileURL(source).href.slice(8) + "?" + Math.round(fs.statSync(source).mtimeMs);
    const externalPlugin = { app: { vault: { getAbstractFileByPath: () => null,
        adapter: { resourcePathPrefix: "app://native-resource/", getResourcePath() { throw Error("Older adapters join external references to the vault"); } } } } };
    try {
        assert.equal(await localResource(externalPlugin, { source }), expected);
        assert.equal(fs.existsSync(source), true);
        delete externalPlugin.app.vault.adapter;
        assert.equal(await localResource(externalPlugin, { source }), pathToFileURL(source).href);
        fs.unlinkSync(source); await assert.rejects(localResource(externalPlugin, { source }), /missing or unreadable/);
    } finally { if (fs.existsSync(source)) fs.unlinkSync(source); fs.rmdirSync(directory); }
});

test("late YouTube SDK loading cannot create a player after switching sources", async () => {
    const { document, host } = documentFixture(); let resolveAPI, players = 0;
    const provider = new YouTubeProvider(plugin, { source: "https://www.youtube.com/watch?v=12345678901", name: "Video" },
        { document, youtubeAPI: new Promise(resolve => { resolveAPI = resolve; }) });
    provider.mount(host); const operation = provider.load(); provider.destroy();
    await assert.rejects(operation, error => error.cancelled === true);
    resolveAPI({ Player: class { constructor() { players++; } } }); await Promise.resolve();
    assert.equal(players, 0);
});

test("official YouTube playlist controls synchronize and suspend pauses the visible player", async () => {
    const { document, host } = documentFixture(); let player, options;
    class Player {
        constructor(_host, input) { player = this; options = input; queueMicrotask(() => input.events.onReady({ target: this })); }
        getIframe() { return document.createElement("iframe"); }
        cuePlaylist(value) { this.list = value.list; }
        getCurrentTime() { return 12; } getDuration() { return 90; } getVolume() { return 50; }
        playVideo() { this.playing = true; options.events.onStateChange({ data: 1 }); }
        pauseVideo() { this.playing = false; this.pauses = (this.pauses || 0) + 1; }
        nextVideo() { this.next = true; } previousVideo() { this.previous = true; }
        seekTo(value) { this.seek = value; } setVolume(value) { this.volume = value; } destroy() { this.destroyed = true; }
    }
    const provider = new YouTubeProvider(plugin, { source: "https://www.youtube.com/playlist?list=PLconfigured", name: "Playlist" },
        { document, youtubeAPI: { Player } });
    provider.mount(host); await provider.load(); provider.play(); provider.next(); provider.previous();
    provider.seek(20); provider.setVolume(0.3);
    assert.equal(Object.hasOwn(options, "videoId"), false, "Playlist-only constructor must omit the videoId property entirely");
    assert.equal(options.playerVars.listType, "playlist"); assert.equal(options.playerVars.list, "PLconfigured");
    assert.equal(player.list, "PLconfigured"); assert.equal(player.next, true); assert.equal(player.previous, true);
    assert.equal(player.seek, 20); assert.equal(player.volume, 30); assert.equal(player.playing, true);
    document.defaultView.dispatchEvent(new Event("blur")); assert.equal(player.playing, true);
    document.hidden = true; document.dispatchEvent(new Event("visibilitychange")); assert.equal(player.playing, false);
    document.hidden = false; provider.play(); assert.equal(player.playing, true);
    provider.suspend(); assert.equal(player.playing, false);
    provider.destroy(); assert.equal(player.destroyed, true);
});

test("retained Spotify Embed backend uses official playback state and supported music controls", async () => {
    const { document, host } = documentFixture(), callbacks = new Map(), states = [];
    const controller = { addListener: (name, callback) => callbacks.set(name, callback), removeListener: name => callbacks.delete(name),
        resume() { this.resumed = true; }, pause() { this.paused = true; this.pauses = (this.pauses || 0) + 1; }, destroy() { this.destroyed = true; } };
    const provider = new SpotifyEmbedBackend(plugin, { source: "https://open.spotify.com/track/abc", name: "Track" }, { document,
        spotifyAPI: { createController(_host, _options, callback) { callback(controller); queueMicrotask(() => callbacks.get("ready")()); } },
        onState: state => states.push(state) });
    provider.mount(host); await provider.load(); provider.play();
    callbacks.get("playback_update")({ data: { isPaused: false, isBuffering: false, duration: 29000, position: 2000, playingURI: "spotify:track:abc" } });
    assert.equal(controller.resumed, true); assert.equal(states.at(-1).currentTime, 2);
    assert.equal(states.at(-1).duration, 29); assert.match(states.at(-1).message, /may be playing a preview/);
    assert.equal(provider.capabilities.seek, false); assert.equal(provider.capabilities.volume, false);
    assert.equal(provider.capabilities.previous, false); assert.equal(provider.capabilities.persistent, false);
    provider.suspend(); provider.destroy(); assert.equal(controller.paused, true); assert.equal(controller.pauses, 1);
    assert.equal(controller.destroyed, true); assert.equal(callbacks.size, 0);
});

test("closing the retained idle Spotify Embed destroys it without an unnecessary pause", async () => {
    const { document, host } = documentFixture(), callbacks = new Map(); let pauses = 0, destroyed = false;
    const controller = { addListener: (name, callback) => callbacks.set(name, callback), removeListener: name => callbacks.delete(name),
        pause() { pauses++; }, destroy() { destroyed = true; } };
    const provider = new SpotifyEmbedBackend(plugin, { source: "https://open.spotify.com/track/abc", name: "Track" }, { document,
        spotifyAPI: { createController(_host, _options, callback) { callback(controller); queueMicrotask(() => callbacks.get("ready")()); } } });
    provider.mount(host); await provider.load(); provider.suspend(); provider.destroy();
    assert.equal(pauses, 0); assert.equal(destroyed, true);
});

test("a late retained Spotify Embed callback destroys its own player after source cancellation", async () => {
    const { document, host } = documentFixture(); let callback;
    const provider = new SpotifyEmbedBackend(plugin, { source: "https://open.spotify.com/track/abc", name: "Track" },
        { document, spotifyAPI: { createController(_host, _options, ready) { callback = ready; } } });
    provider.mount(host); const operation = provider.load(); await Promise.resolve(); await Promise.resolve();
    provider.destroy(); await assert.rejects(operation, error => error.cancelled === true);
    let destroyed = false; callback({ destroy() { destroyed = true; } }); assert.equal(destroyed, true);
});

function connectFixture() {
    const { document, host } = documentFixture(), calls = [], states = [];
    const raw = { is_playing: true, progress_ms: 2000,
        item: { uri: "spotify:track:current", name: "Current track", duration_ms: 180000,
            artists: [{ name: "Current artist" }], album: { images: [{ url: "https://i.scdn.co/image/artwork" }] } },
        device: { id: "active-device", is_active: true, is_restricted: false, supports_volume: true, volume_percent: 40 },
        actions: { disallows: {} } };
    const service = { snapshot: { connected: true, playback: raw }, raw,
        onChange(callback) { this.changed = callback; return () => { this.changed = null; }; },
        async getPlaybackState() { calls.push(["state"]); return this.raw; },
        async startItem(item) { calls.push(["start", item]); }, async resume() { calls.push(["resume"]); },
        async pause() { calls.push(["pause"]); }, async previous() { calls.push(["previous"]); }, async next() { calls.push(["next"]); },
        async seek(seconds) { calls.push(["seek", seconds]); }, async setVolume(volume) { calls.push(["volume", volume]); } };
    const item = { provider: "spotify", id: "saved", name: "Saved playlist", sourceType: "playlist",
        source: "https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n", metadata: { spotifyId: "3cEYpjA9oz9GiPac4AsH4n" } };
    const provider = new SpotifyProvider({ ...plugin, spotifyConnect: service }, item, { document, onState: state => states.push(state) });
    return { provider, item, service, raw, document, host, calls, states };
}

test("Obsidian Spotify facade chooses Connect directly and maps playback state into common metadata/controls", async () => {
    const { provider, item, host, calls, states } = connectFixture();
    provider.mount(host); await provider.load(); await provider.play();
    assert.equal(provider.element.querySelector("iframe"), null);
    assert.equal(provider.capabilities.visiblePlayer, false); assert.equal(provider.capabilities.persistent, true);
    assert.equal(provider.capabilities.seek, true); assert.equal(provider.capabilities.volume, true);
    assert.deepEqual(calls.find(call => call[0] === "start"), ["start", item], "The existing saved reference is started unchanged");
    assert.equal(states.some(state => state.currentTime === 2 && state.duration === 180), true);
    assert.equal(states.some(state => state.title === item.name && state.trackTitle === "Current track"), true);
    assert.equal(states.some(state => state.artist === "Current artist"), true);
    assert.equal(states.some(state => state.artwork === "https://i.scdn.co/image/artwork"), true);
    assert.equal(states.some(state => /preview/i.test(state.message || "")), false);
    await provider.play(); await provider.pause(); await provider.previous(); await provider.next();
    await provider.seek(12); await provider.setVolume(.3);
    for (const method of ["resume", "pause", "previous", "next"]) assert(calls.some(call => call[0] === method), method);
    assert(calls.some(call => call[0] === "seek" && call[1] === 12));
    assert(calls.some(call => call[0] === "volume" && call[1] === .3));
    provider.destroy();
});

test("Connect modal close preserves remote playback, reopens with fresh state and switching can await pause", async () => {
    const { provider, host, calls, service } = connectFixture();
    provider.mount(host); await provider.load(); await provider.play(); const starts = calls.filter(call => call[0] === "start").length;
    provider.detach(); assert.equal(provider.destroyed, false); assert.equal(calls.some(call => call[0] === "pause"), false);
    const states = calls.filter(call => call[0] === "state").length;
    provider.mount(host); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert(calls.filter(call => call[0] === "state").length > states, "Reopening queries the remote state");
    assert.equal(calls.filter(call => call[0] === "start").length, starts, "Reopening does not restart the saved playlist");
    let paused = false; service.pause = () => new Promise(resolve => { service.finishPause = () => { paused = true; resolve(); }; });
    const operation = provider.suspend(); assert.equal(paused, false); await new Promise(setImmediate); service.finishPause(); await operation;
    assert.equal(paused, true); provider.destroy(); assert.equal(service.changed, null);
});

test("Connect capabilities follow the current device rather than advertising volume on an unsupported device", async () => {
    const { provider, host, raw } = connectFixture(); raw.device.supports_volume = false;
    provider.mount(host); await provider.load(); assert.equal(provider.capabilities.volume, false);
    provider.destroy();
});

test("disconnected Obsidian Spotify explains Settings connection without loading the retained Embed SDK", async () => {
    const { document, host } = documentFixture(); let embeds = 0;
    const service = { snapshot: { connected: false }, onChange() { return () => {}; },
        getPlaybackState() { throw Error("Disconnected state must not issue playback requests"); } };
    const provider = new SpotifyProvider({ ...plugin, spotifyConnect: service },
        { provider: "spotify", source: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", name: "Saved track" },
        { document, spotifyAPI: { createController() { embeds++; } } });
    provider.mount(host); await assert.rejects(provider.load(), /Connect Spotify.*Settings/i);
    assert.equal(embeds, 0); assert.equal(provider.element.querySelector("iframe"), null);
    provider.destroy();
});

test("switching away from Connect waits for an in-flight start before sending the final pause", async () => {
    const { provider, host, service, calls } = connectFixture(); provider.mount(host); await provider.load();
    let finish;
    service.startItem = () => new Promise(resolve => { finish = () => { calls.push(["start-complete"]); resolve(); }; });
    const play = provider.play(); await Promise.resolve(); await Promise.resolve();
    const suspension = provider.suspend(); await Promise.resolve(); await Promise.resolve();
    assert.equal(calls.some(call => call[0] === "pause"), false, "A late play must never overtake the source-switch pause");
    finish(); await Promise.all([play, suspension]);
    assert(calls.findIndex(call => call[0] === "pause") > calls.findIndex(call => call[0] === "start-complete"));
    provider.destroy();
});

test("Connect volume dragging sends the in-flight value and latest intent without a request per intermediate step", async () => {
    const { provider, host, service } = connectFixture(); provider.mount(host); await provider.load();
    const values = []; let finish;
    service.setVolume = value => { values.push(value); return values.length === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(); };
    const first = provider.setVolume(.2); await new Promise(setImmediate);
    const second = provider.setVolume(.3), latest = provider.setVolume(.8);
    assert.deepEqual(values, [.2]); finish(); await Promise.all([first, second, latest]);
    assert.deepEqual(values, [.2, .8]); provider.destroy();
});

test("Connect polls moderately while visible and detaching cancels subsequent polling", async context => {
    context.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const { provider, host, calls } = connectFixture(); provider.mount(host); await provider.load();
    const count = () => calls.filter(call => call[0] === "state").length;
    const initial = count(); context.mock.timers.tick(4999); await new Promise(setImmediate); assert.equal(count(), initial);
    context.mock.timers.tick(1); await new Promise(setImmediate); assert.equal(count(), initial + 1);
    provider.detach(); const detached = count(); context.mock.timers.tick(20000); await new Promise(setImmediate);
    assert.equal(count(), detached, "No playback API polling remains while the modal is closed");
    provider.mount(host); await new Promise(setImmediate); assert.equal(count(), detached + 1);
    provider.destroy();
});

test("lost authentication blocks switching away from owned remote playback until it can be paused", async () => {
    const { provider, host, service, calls } = connectFixture(); provider.mount(host); await provider.load(); await provider.play();
    service.snapshot.connected = false; service.changed();
    await assert.rejects(provider.suspend(), /Spotify/i);
    assert.equal(calls.some(call => call[0] === "pause"), false, "Disconnected control must not pretend to have paused the device");
    service.snapshot.connected = true; service.changed(); await provider.suspend();
    assert.equal(calls.filter(call => call[0] === "pause").length, 1, "Reconnect allows the preserved playback owner to finish pausing");
    provider.destroy();
});

test("successful pause releases playback ownership so later disconnect does not falsely block switching", async () => {
    const { provider, host, service, calls } = connectFixture(); provider.mount(host); await provider.load(); await provider.play();
    await provider.pause(); const pauses = calls.filter(call => call[0] === "pause").length;
    service.snapshot.connected = false; service.changed(); await provider.suspend();
    assert.equal(calls.filter(call => call[0] === "pause").length, pauses); provider.destroy();
});

test("adjusting Connect volume or position alone does not claim ownership of externally started playback", async () => {
    const { provider, host, service } = connectFixture(); provider.mount(host); await provider.load();
    await provider.setVolume(.3); await provider.seek(20);
    service.snapshot.connected = false; service.changed(); await provider.suspend(); provider.destroy();
});

test("YouTube Music destination fence permits the configured queue while rejecting discovery, another song and foreign hosts", () => {
    const source = "https://music.youtube.com/playlist?list=OLAKconfigured";
    assert.equal(configuredMusicDestination(source, "https://music.youtube.com/watch?v=newtrack001&list=OLAKconfigured&index=2"), true);
    for (const destination of ["https://music.youtube.com/search?q=other", "https://music.youtube.com/watch?v=newtrack001&list=PLanother",
        "https://music.youtube.com/", "https://music.youtube.com.evil.example/playlist?list=OLAKconfigured", "http://music.youtube.com/playlist?list=OLAKconfigured"])
        assert.equal(configuredMusicDestination(source, destination), false, destination);
    const song = "https://music.youtube.com/watch?v=savedtrack1";
    assert.equal(configuredMusicDestination(song, song + "&t=10"), true);
    assert.equal(configuredMusicDestination(song, "https://music.youtube.com/watch?v=othertrack1"), false);
    assert.equal(configuredMusicDestination(song, song + "&list=RDAMVMsavedtrack1"), true);
    assert.equal(configuredMusicDestination(song, "https://music.youtube.com/watch?v=othertrack1&list=RDAMVMsavedtrack1"), false);
    assert.equal(configuredMusicDestination(song, "https://music.youtube.com/playlist?list=RDAMVMsavedtrack1"), false);
    assert.equal(configuredMusicDestination(song, song + "&v=savedtrack1"), false);
    assert.equal(configuredMusicDestination(source, source + "&list=OLAKconfigured"), false);
    assert.equal(configuredMusicDestination(song, song + "&list=first&list=second"), false);
    assert.equal(configuredMusicDestination(source, "https://music.youtube.com/watch?v=firstvideo1&v=othervideo1&list=OLAKconfigured"), false);
    assert.equal(configuredMusicDestination(song, song.replace("music.youtube.com", "music.youtube.com:8443")), false);
    assert.equal(configuredMusicDestination(song, song.replace("music.youtube.com", "music.youtube.com:443")), true);
});

test("official YouTube consent binds exactly one return URL to the configured content", () => {
    const source = "https://music.youtube.com/watch?v=savedtrack1";
    const consent = "https://consent.youtube.com/m?continue=" + encodeURIComponent(source + "&cbrd=1") + "&gl=SE";
    assert.equal(configuredConsentDestination(source, consent), true);
    assert.equal(configuredConsentDestination(source, consent.replace("/m?", "/ml?")), true);
    const album = "https://music.youtube.com/browse/MPREconfiguredAlbum";
    assert.equal(configuredConsentDestination(album, "https://consent.youtube.com/m?continue=" + encodeURIComponent(album + "?cbrd=1")), true);
    assert.equal(configuredConsentDestination(album, "https://consent.youtube.com/m?continue=" + encodeURIComponent(album + "?q=discovery")), false);
    for (const destination of ["https://consent.youtube.com/m?continue=" + encodeURIComponent("https://music.youtube.com/watch?v=anotherone1"),
        "https://consent.youtube.com/m?continue=" + encodeURIComponent("https://music.youtube.com/search?q=other"),
        "https://consent.youtube.com/m?continue=" + encodeURIComponent("https://example.com"),
        consent + "&continue=" + encodeURIComponent(source), consent.replace("consent.youtube.com", "consent.youtube.com.evil.example"),
        consent.replace("https:", "http:"), "https://consent.youtube.com/save"]) assert.equal(configuredConsentDestination(source, destination), false);
});

test("the native YouTube Music fence prevents unrelated navigation and closes its sole guest without granting session access", () => {
    const { EventEmitter } = require("events"), Module = require("module"), guest = new EventEmitter(), browserSession = {};
    Object.assign(guest, { session: browserSession, isDestroyed: () => !!guest.closed, getType: () => "webview",
        stop() { this.stopped = true; }, close() { this.closed = true; }, setWindowOpenHandler(handler) { this.popup = handler; } });
    const originalLoad = Module._load;
    Module._load = function(name) { return name === "electron" ? { webContents: { fromId: id => id === 123 ? guest : null },
        session: { fromPartition: value => value === "persist:vault-test" ? browserSession : {} } } : originalLoad.apply(this, arguments); };
    let blocked = 0, fence;
    try {
        assert.throws(() => constrainMusicGuest(123, "another-session", "https://music.youtube.com/watch?v=savedtrack1"), /unavailable/);
        fence = constrainMusicGuest(123, "persist:vault-test", "https://music.youtube.com/watch?v=savedtrack1", () => blocked++);
    } finally { Module._load = originalLoad; }
    assert.deepEqual(guest.popup(), { action: "deny" });
    let prevented = false;
    guest.emit("will-frame-navigate", { isMainFrame: true, url: "https://music.youtube.com/watch?v=savedtrack1&t=10", preventDefault() { prevented = true; } });
    assert.equal(prevented, false); assert.equal(guest.closed, undefined);
    guest.emit("will-frame-navigate", { isMainFrame: true, url: "https://music.youtube.com/search?q=unconfigured", preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.equal(guest.closed, true); assert.equal(blocked, 1);
    fence.destroy(); assert.equal(guest.listenerCount("will-frame-navigate"), 0);
});

test("native consent form submission is available only after a content-bound official consent page loads", () => {
    const { EventEmitter } = require("events"), Module = require("module"), session = {};
    const createGuest = () => Object.assign(new EventEmitter(), { session, isDestroyed() { return !!this.closed; }, getType: () => "webview",
        stop() {}, close() { this.closed = true; }, setWindowOpenHandler() {} });
    const guests = Array.from({ length: 4 }, createGuest), originalLoad = Module._load;
    Module._load = function(name) { return name === "electron" ? { webContents: { fromId: id => guests[id] }, session: { fromPartition: () => session } }
        : originalLoad.apply(this, arguments); };
    const source = "https://music.youtube.com/watch?v=savedtrack1", consent = "https://consent.youtube.com/m?continue=" + encodeURIComponent(source + "&cbrd=1");
    let fences;
    try { fences = guests.map((_guest, id) => constrainMusicGuest(id, "persist:vault-test", source)); }
    finally { Module._load = originalLoad; }
    const navigate = (guest, url) => { let prevented = false; guest.emit("will-frame-navigate", { isMainFrame: true, url, preventDefault() { prevented = true; } }); return prevented; };
    assert.equal(navigate(guests[0], "https://consent.youtube.com/save"), true);
    assert.equal(navigate(guests[1], consent), false); guests[1].emit("did-navigate", {}, consent);
    assert.equal(navigate(guests[1], "https://consent.youtube.com/save"), false);
    assert.equal(navigate(guests[1], source + "&cbrd=1"), false); guests[1].emit("did-navigate", {}, source + "&cbrd=1");
    assert.equal(navigate(guests[1], "https://consent.youtube.com/save"), true);
    assert.equal(navigate(guests[2], consent), false);
    guests[2].emit("did-navigate-in-page", {}, consent, true);
    assert.equal(navigate(guests[2], "https://consent.youtube.com/save"), false, "Actual Obsidian main-frame consent arrival enables its form");
    guests[2].emit("did-navigate-in-page", {}, source + "&cbrd=1", true);
    assert.equal(navigate(guests[2], "https://consent.youtube.com/save"), true, "Returning to saved music ends the consent flow");
    guests[3].emit("did-navigate-in-page", {}, consent, false);
    assert.equal(navigate(guests[3], "https://consent.youtube.com/save"), true, "A subframe cannot enable consent submission");
    for (const fence of fences) fence.destroy();
});
