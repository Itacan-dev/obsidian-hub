"use strict";
const assert = require("assert/strict"), http = require("http");

// Actual native Settings, callback listener, OS-protected persistence and UI
// use deliberately synthetic OAuth/API responses. No real account is accessed.
module.exports = async function verify({ plugin, spotify, local, until, delay, closeDialog, pass }) {
    const backend = plugin.spotifyConnect, requests = [];
    assert.equal(backend.snapshot.secureStorageAvailable, true, "Native OS-protected token storage is available");
    let authorization, position = 0, updated = Date.now(), playing = false, volume = 40, track = "Synthetic Connect track";
    const progress = () => position + (playing ? Date.now() - updated : 0);
    const commit = () => { position = progress(); updated = Date.now(); };
    const playback = () => ({ is_playing: playing, progress_ms: progress(), timestamp: Date.now(),
        item: { uri: "spotify:track:synthetic", name: track, duration_ms: 180000, artists: [{ name: "Synthetic artist" }],
            album: { images: [{ url: "https://i.scdn.co/image/synthetic-artwork" }] } },
        device: { id: "synthetic-device", is_active: true, is_restricted: false, supports_volume: true, volume_percent: volume },
        actions: { disallows: {} } });
    const response = (status, body) => ({ status, headers: {}, text: body === undefined ? "" : JSON.stringify(body), json: body });
    backend.options.openExternal = async value => { authorization = new URL(value); };
    backend.options.request = async options => {
        const url = new URL(options.url), method = options.method || "GET";
        if (url.origin === "https://accounts.spotify.com" && url.pathname === "/api/token") {
            return response(200, { access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 3600 });
        }
        assert.equal(url.origin, "https://api.spotify.com");
        requests.push({ method, path: url.pathname });
        if (method === "GET" && url.pathname === "/v1/me/player") return response(200, playback());
        if (url.pathname === "/v1/me/player/devices") return response(200, { devices: [playback().device] });
        if (url.pathname === "/v1/me/player/play") {
            commit(); playing = true;
            if (options.body) {
                const payload = JSON.parse(options.body);
                assert(payload.uris?.[0]?.startsWith("spotify:track:") || payload.context_uri?.startsWith("spotify:"));
            }
        } else if (url.pathname === "/v1/me/player/pause") { await delay(50); commit(); playing = false; }
        else if (url.pathname === "/v1/me/player/seek") { position = Number(url.searchParams.get("position_ms")); updated = Date.now(); }
        else if (url.pathname === "/v1/me/player/volume") volume = Number(url.searchParams.get("volume_percent"));
        else if (url.pathname.endsWith("/next")) { commit(); track = "Synthetic next track"; }
        else if (url.pathname.endsWith("/previous")) { commit(); track = "Synthetic Connect track"; }
        else if (method === "PUT" && url.pathname === "/v1/me/player") { /* Synthetic transfer succeeds. */ }
        else throw Error("Unexpected synthetic Spotify endpoint");
        return response(204);
    };
    plugin.settingsControl.open("music");
    await until(() => document.querySelector(".hub-settings-dialog"), "Spotify native connection Settings opens");
    document.querySelector('[data-music-focus="spotify-connect"]').click();
    await until(() => authorization && backend.snapshot.connecting, "Connect reaches the official external authorization point");
    assert.equal(authorization.origin, "https://accounts.spotify.com"); assert.equal(authorization.pathname, "/authorize");
    assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorization.searchParams.get("scope"), "user-read-playback-state user-modify-playback-state");
    assert.equal(authorization.searchParams.get("redirect_uri"), backend.snapshot.redirectUri);
    const callback = new URL(backend.snapshot.redirectUri);
    callback.searchParams.set("code", "synthetic-code"); callback.searchParams.set("state", authorization.searchParams.get("state"));
    const status = await new Promise((resolve, reject) => {
        const request = http.get(callback, response => { response.resume(); response.once("end", () => resolve(response.statusCode)); });
        request.once("error", () => reject(Error("Synthetic local Spotify callback was unavailable")));
    });
    assert.equal(status, 200); await until(() => backend.snapshot.connected, "synthetic callback finishes actual OS-protected persistence");
    const saved = JSON.stringify(plugin.projectWizard.data.spotifyConnect);
    assert(plugin.projectWizard.data.spotifyConnect.tokensEnc);
    assert(!saved.includes("synthetic-access") && !saved.includes("synthetic-refresh"), "Saved credentials are encrypted rather than plaintext");
    pass("actual native Spotify OAuth action reaches official PKCE authorization and a synthetic loopback callback stores protected credentials");
    await closeDialog(".hub-settings-dialog"); plugin.musicControl.open();
    await until(() => document.querySelector(".hub-music-dialog"), "connected Music opens");
    await plugin.music.select(spotify.id); await until(() => plugin.music.state.status === "playing", "simulated Connect starts configured music");
    assert.equal(document.querySelectorAll('.hub-music-dialog iframe,.hub-music-dialog webview').length, 0);
    assert(!/preview/i.test(document.querySelector('.hub-music-feedback').textContent));
    assert.equal(plugin.music.snapshot.artist, "Synthetic artist"); assert.equal(plugin.music.snapshot.trackTitle, track);
    assert.equal(plugin.music.snapshot.artwork, "https://i.scdn.co/image/synthetic-artwork");
    await plugin.music.seek(12); assert(plugin.music.state.currentTime >= 12);
    await plugin.music.setVolume(.6); assert.equal(volume, 60);
    await plugin.music.next(); assert.equal(plugin.music.snapshot.trackTitle, "Synthetic next track");
    await plugin.music.previous(); assert.equal(plugin.music.snapshot.trackTitle, "Synthetic Connect track");
    await plugin.music.pause(); assert.equal(playing, false); await plugin.music.play(); assert.equal(playing, true);
    const selected = plugin.music.provider, starts = requests.filter(value => value.path === "/v1/me/player/play").length;
    await closeDialog(".hub-music-dialog"); assert.equal(playing, true); assert.equal(plugin.music.provider, selected);
    const reads = requests.filter(value => value.method === "GET" && value.path === "/v1/me/player").length;
    await delay(5500);
    assert.equal(requests.filter(value => value.method === "GET" && value.path === "/v1/me/player").length, reads, "Closing the modal stops remote state polling");
    plugin.musicControl.open(); await until(() => document.querySelector(".hub-music-dialog"), "connected Music reopens");
    await until(() => requests.filter(value => value.method === "GET" && value.path === "/v1/me/player").length > reads, "reopening freshly synchronizes Connect");
    assert.equal(plugin.music.provider, selected);
    assert.equal(requests.filter(value => value.path === "/v1/me/player/play").length, starts, "Reopening does not restart the selected item");
    window.__musicRuntimeStage = "spotify-connect-simulated";
    await new Promise(resolve => { window.__musicRuntimeContinue = resolve; });
    let localPlayedBeforePause = false;
    const stop = plugin.music.onChange(state => { if (state.item?.id === local.id && state.status === "playing" && playing) localPlayedBeforePause = true; });
    await plugin.music.select(local.id); stop(); assert.equal(playing, false); assert.equal(localPlayedBeforePause, false);
    await plugin.music.pause(); await closeDialog(".hub-music-dialog");
    pass("native Music with synthetic Connect API verifies metadata/controls, persistent close, stopped polling, fresh reopen and awaited pause before Local playback");
    return { provider: "spotify", backend: "connect", evidence: "synthetic OAuth/API with actual native Settings, callback, secure storage and UI",
        authorization: { origin: authorization.origin, pathname: authorization.pathname, redirectUri: backend.snapshot.redirectUri,
            scopes: authorization.searchParams.get("scope"), pkceMethod: "S256" }, controls: ["start", "resume", "pause", "previous", "next", "seek", "volume"],
        lifecycle: ["close preserves playback", "close stops polling", "reopen freshly queries", "reopen does not restart", "switch awaits pause"], requests };
};
