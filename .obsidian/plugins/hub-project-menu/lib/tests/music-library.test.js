"use strict";
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { MUSIC_PROVIDERS, musicDefaults, normalizeMusicConfig, normalizeMusicSource, createMusicItem } = require("../domain/music");
const { MusicLibrary } = require("../services/music-library");
const { HubDataStore } = require("../services/data-store");

const videoId = "dQw4w9WgXcQ", playlistId = "PL1234567890abcdefgh", spotifyId = "4cOdK2wGLETKBW3PvgPWqT";
function domain() {
    assert.equal(musicDefaults().enabled, false);
    assert.deepEqual(MUSIC_PROVIDERS.map(provider => provider.id), ["spotify", "youtube", "youtube-music", "local"]);
    const defaults = musicDefaults(); defaults.providers.local = false;
    assert.equal(musicDefaults().providers.local, true, "Fresh defaults never share mutable provider preferences");
    assert.deepEqual(normalizeMusicConfig(undefined), musicDefaults());
    assert.deepEqual(normalizeMusicConfig({ providers: { local: false }, enabled: 1 }).providers,
        { spotify: true, youtube: true, "youtube-music": true, local: false });
    assert.equal(normalizeMusicConfig({ enabled: 1 }).enabled, false, "Only explicit enablement shows the launcher");
    assert.throws(() => normalizeMusicConfig({ version: 2 }), /newer version/);
    for (const type of ["track", "album", "playlist", "artist"]) {
        const item = normalizeMusicSource("spotify", `https://open.spotify.com/intl-en/${type}/${spotifyId}?si=test`);
        assert.equal(item.source, `https://open.spotify.com/${type}/${spotifyId}`);
        assert.equal(item.sourceType, type); assert.equal(item.metadata.uri, `spotify:${type}:${spotifyId}`);
        assert.equal(normalizeMusicSource("spotify", `https://open.spotify.com/embed/${type}/${spotifyId}`).source, item.source);
    }
    assert.throws(() => normalizeMusicSource("spotify", `https://open.spotify.com/show/${spotifyId}`), /supports track/);
    assert.throws(() => normalizeMusicSource("spotify", "https://open.spotify.com/track/short"), /complete/);
    for (const url of [`https://youtu.be/${videoId}?t=1m30s`, `https://m.youtube.com/watch?v=${videoId}&t=90s`,
        `https://www.youtube.com/shorts/${videoId}?t=90`, `https://www.youtube.com/live/${videoId}?start=90`, `https://www.youtube-nocookie.com/embed/${videoId}?start=90`]) {
        const item = normalizeMusicSource("youtube", url);
        assert.equal(item.source, `https://www.youtube.com/watch?v=${videoId}&t=90`);
        assert.equal(item.metadata.videoId, videoId); assert.equal(item.metadata.startSeconds, 90);
    }
    const playlist = normalizeMusicSource("youtube", `youtube.com/playlist?list=${playlistId}&si=test`);
    assert.equal(playlist.sourceType, "playlist"); assert.equal(playlist.metadata.playlistId, playlistId);
    assert.equal(normalizeMusicSource("youtube", `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`).sourceType, "playlist");
    const music = normalizeMusicSource("youtube-music", `https://music.youtube.com/watch?v=${videoId}&list=${playlistId}&si=test`);
    assert.equal(music.source, `https://music.youtube.com/watch?v=${videoId}&list=${playlistId}`);
    assert.equal(music.sourceType, "playlist");
    const album = normalizeMusicSource("youtube-music", "https://music.youtube.com/browse/MPREb_pFZHNub3JEs?si=test");
    assert.equal(album.source, "https://music.youtube.com/browse/MPREb_pFZHNub3JEs");
    assert.equal(album.sourceType, "album"); assert.equal(album.metadata.browseId, "MPREb_pFZHNub3JEs");
    assert.throws(() => normalizeMusicSource("youtube-music", "https://music.youtube.com/browse/home"), /song, album or playlist/);
    assert.throws(() => normalizeMusicSource("youtube-music", `https://youtube.com/watch?v=${videoId}`), /music.youtube.com/);
    assert.throws(() => normalizeMusicSource("youtube", `https://music.youtube.com/watch?v=${videoId}`), /YouTube video or playlist/);
    for (const url of [`https://youtube.com.evil.example/watch?v=${videoId}`, `javascript:alert(1)`, `https://user:secret@youtube.com/watch?v=${videoId}`,
        `https://youtube.com:8443/watch?v=${videoId}`, "https://youtube.com/watch?v=bad", "https://youtube.com/feed/trending", "https://youtube.com/playlist?list=bad"]) {
        assert.throws(() => normalizeMusicSource("youtube", url), undefined, url);
    }
    assert.equal(createMusicItem({ provider: "local", source: "C:\\Music\\A gentle song.MP3" }, "stable").name, "A gentle song");
    assert.equal(createMusicItem({ provider: "local", source: "Assets/Music/song.ogg" }).sourceType, "file");
    assert.throws(() => normalizeMusicSource("local", "../song.mp3"), /local audio/);
    assert.throws(() => normalizeMusicSource("local", "https://example.com/song.mp3"), /local audio/);
    assert.throws(() => normalizeMusicSource("local", "C:\\Music\\file.exe"), /audio file/);
    const legacy = { items: [{ provider: "local", source: "Assets/Music/song.ogg" }, { provider: "local", source: "Assets/Music/song.ogg" }] };
    assert.deepEqual(normalizeMusicConfig(legacy), normalizeMusicConfig(legacy), "Migration identities stay stable without writing");
    assert.equal(new Set(normalizeMusicConfig(legacy).items.map(item => item.id)).size, 2);
}

async function persistence() {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "itacan-music-library-"));
    const directory = path.join(root, ".obsidian", "plugins", "hub-project-menu"), dataPath = path.join(directory, "data.json");
    const audio = path.join(root, "quiet track.mp3"), secondAudio = path.join(root, "second track.ogg");
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(dataPath, JSON.stringify({ unrelated: { theme: "unchanged", tasks: [1, 2] } }));
    await fs.promises.writeFile(audio, Buffer.from([0, 1, 2])); await fs.promises.writeFile(secondAudio, Buffer.from([0, 1, 2]));
    const vaultFiles = new Map([["Assets/Music/vault-song.ogg", { path: "Assets/Music/vault-song.ogg", name: "vault-song.ogg" }]]);
    const plugin = { app: { vault: { configDir: ".obsidian", adapter: { getBasePath: () => root }, getAbstractFileByPath: value => vaultFiles.get(value) } },
        manifest: { id: "hub-project-menu", dir: ".obsidian/plugins/hub-project-menu" },
        loadData: async () => JSON.parse(await fs.promises.readFile(dataPath, "utf8")), saveData() { throw Error("Must use the existing atomic store."); } };
    try {
        plugin.dataStore = new HubDataStore(plugin); plugin.projectWizard = { data: await plugin.dataStore.load() };
        const before = await fs.promises.readFile(dataPath, "utf8"), library = new MusicLibrary(plugin, { metadata: false });
        assert.equal(library.state.enabled, false); assert.deepEqual(library.list({ enabledOnly: true }), []);
        assert.equal(await fs.promises.readFile(dataPath, "utf8"), before, "Reading defaults does not rewrite an existing install");
        let changed = 0; library.onChange(() => changed++);
        const video = await library.add({ provider: "youtube", source: `https://youtu.be/${videoId}`, name: "Focus video" });
        const spotify = await library.add({ provider: "spotify", source: `https://open.spotify.com/playlist/${spotifyId}` });
        assert.deepEqual(library.list({ enabledOnly: true }), [], "Saving an item does not enable Music implicitly");
        await library.setEnabled(true); assert.equal(library.list({ enabledOnly: true }).length, 2);
        for (const provider of MUSIC_PROVIDERS) {
            await library.setProviderEnabled(provider.id, false);
            assert.equal(library.state.providers[provider.id], false); assert.equal(library.list().length, 2);
            assert.ok(library.list({ enabledOnly: true }).every(item => item.provider !== provider.id));
            await library.setProviderEnabled(provider.id, true);
        }
        await library.setEnabled(false); assert.equal(library.list().length, 2); assert.equal(library.list({ enabledOnly: true }).length, 0);
        await library.setEnabled(true);
        await Promise.all([library.rename(video.id, "Renamed video"), library.move(spotify.id, -1), library.setItemEnabled(video.id, false)]);
        assert.deepEqual(library.list().map(item => item.id), [spotify.id, video.id]);
        assert.equal(library.get(video.id).name, "Renamed video"); assert.equal(library.list({ enabledOnly: true }).length, 1);
        const local = await library.addLocalFiles([{ name: "quiet track.mp3", path: audio }, secondAudio]);
        assert.deepEqual(local.map(item => item.source), [audio, secondAudio]);
        assert.deepEqual(local.map(item => item.name), ["quiet track", "second track"]);
        assert.equal(await fs.promises.readFile(audio, "hex"), "000102", "External files are referenced without copying or editing");
        const vaultLocal = await library.addLocalFiles([{ name: "vault-song.ogg", path: path.join(root, "Assets/Music/vault-song.ogg") }]);
        assert.equal(vaultLocal[0].source, "Assets/Music/vault-song.ogg", "Existing vault files preserve native vault references");
        const configured = library.list();
        await assert.rejects(library.addLocalFiles([audio, path.join(root, "missing.wav")]), /cannot be read/);
        assert.deepEqual(library.list(), configured, "A failed multi-file selection commits no partial references");
        await assert.rejects(library.addLocalFiles([audio, path.join(root, "bad.exe")]), /audio file/);
        await assert.rejects(library.rename(video.id, "  "), /display name/);
        await assert.rejects(library.reorder([video.id]), /library changed/);
        await library.reorder([...configured].reverse().map(item => item.id));
        assert.equal(library.list()[0].id, vaultLocal[0].id);
        await library.remove(spotify.id); assert.equal(library.get(spotify.id), null);
        assert.ok(changed >= 18, "Persisted mutations notify the Settings/launcher/controller owners");
        const disk = JSON.parse(await fs.promises.readFile(dataPath, "utf8"));
        assert.deepEqual(disk.unrelated, { theme: "unchanged", tasks: [1, 2] }); assert.deepEqual(disk.music, library.state);
        assert.ok((await fs.promises.readdir(directory)).every(name => !name.endsWith(".tmp")), "Existing atomic save cleans temporary files");
        const reloaded = new MusicLibrary({ ...plugin, projectWizard: { data: disk } }, { metadata: false });
        assert.deepEqual(reloaded.state, library.state, "Enablement, names, order and sources survive reload"); reloaded.destroy();
        const previous = plugin.projectWizard.data.music, externallyChanged = { ...disk, externalValue: "preserve" };
        await fs.promises.writeFile(dataPath, JSON.stringify(externallyChanged));
        await assert.rejects(library.setEnabled(false), error => error.code === "HUB_STATE_CONFLICT");
        assert.strictEqual(plugin.projectWizard.data.music, previous, "A conflict restores in-memory configuration");
        assert.deepEqual(JSON.parse(await fs.promises.readFile(dataPath, "utf8")), externallyChanged, "External edits are preserved");
        library.destroy();
    } finally { await fs.promises.rm(root, { recursive: true, force: true }); }
}

async function optionalMetadata() {
    const data = {}, plugin = { app: { vault: {} }, projectWizard: { data }, dataStore: { writeQueue: Promise.resolve(), async save() {} } };
    let requested;
    const library = new MusicLibrary(plugin, { request: async options => { requested = options.url; return { status: 200,
        json: { title: "Provider title", thumbnail_url: "https://i.scdn.co/image/art", html: "<script>untrusted</script>" } }; } });
    const item = await library.add({ provider: "spotify", source: `https://open.spotify.com/track/${spotifyId}` });
    assert.equal(item.name, "Provider title"); assert.equal(item.artwork, "https://i.scdn.co/image/art"); assert.equal(item.html, undefined);
    assert.ok(requested.startsWith("https://open.spotify.com/oembed?url="));
    const renamed = await library.add({ provider: "spotify", source: `https://open.spotify.com/track/${spotifyId}`, name: "Personal name" });
    assert.equal(renamed.name, "Personal name", "A chosen display name takes precedence over optional metadata");
    library.options.request = async () => { throw Error("Unavailable metadata"); };
    const fallback = await library.add({ provider: "youtube", source: `https://youtu.be/${videoId}` });
    assert.ok(fallback.name.includes("YouTube")); assert.equal(fallback.metadata.videoId, videoId);
    assert.equal(data.music.items.length, 3, "Optional metadata failure does not prevent saving a valid reference"); library.destroy();
    const future = { version: 2, enabled: true, items: [{ futureValue: "retain" }] }, futureData = { music: future };
    const futureLibrary = new MusicLibrary({ ...plugin, projectWizard: { data: futureData } }, { metadata: false });
    assert.equal(futureLibrary.state.enabled, false); assert.ok(futureLibrary.compatibilityError.includes("newer version"));
    await assert.rejects(futureLibrary.setEnabled(true), /newer version/);
    assert.strictEqual(futureData.music, future, "Future libraries remain read-only without breaking unrelated plugin startup"); futureLibrary.destroy();
}

async function run() {
    domain(); await persistence(); await optionalMetadata();
    console.log("Music library passed: safe defaults, provider URL validation, atomic configuration, toggles, ordering, external/vault references, conflict rollback and optional metadata.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
