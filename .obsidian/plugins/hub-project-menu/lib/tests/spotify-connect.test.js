"use strict";
const test = require("node:test");
const assert = require("assert/strict");
const http = require("http");
const { randomBytes, createCipheriv, createDecipheriv, createHash } = require("crypto");
const { SpotifyConnectBackend, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES, playbackPayload, selectDevice, expired } = require("../services/spotify-connect");
const { SpotifySecretStorage } = require("../services/spotify-secret-storage");
const { MusicLibrary } = require("../services/music-library");
const { createMusicItem } = require("../domain/music");

const CLIENT_ID = "1234567890abcdef1234567890abcdef";
const ID = "4cOdK2wGLETKBW3PvgPWqT";
const copy = value => JSON.parse(JSON.stringify(value));
const response = (status, body, headers = {}) => ({ status, text: body === undefined ? "" : JSON.stringify(body), headers });
const access = (now, values = {}) => ({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_at: now + 3600000, ...values });
const device = (id, active = true, values = {}) => ({ id, name: id, is_active: active, is_restricted: false, supports_volume: true, ...values });

// Real encryption, injected rather than claiming Node has an OS keychain.
function secureStorage() {
    const key = randomBytes(32);
    return { isEncryptionAvailable: () => true,
        encryptString(text) {
            const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce);
            const payload = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
            return Buffer.concat([nonce, cipher.getAuthTag(), payload]);
        },
        decryptString(bytes) {
            const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28));
            return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
        }
    };
}
function fixture(options = {}) {
    const now = { value: 1800000000000 }, storage = options.safeStorage ?? secureStorage(), writes = [], calls = [], sleeps = [];
    const data = copy(options.data || { music: { version: 1, enabled: true, items: [createMusicItem({ provider: "spotify", source: `https://open.spotify.com/playlist/${ID}`, name: "Existing playlist" }, "saved-id")] }, unrelated: { preserved: true } });
    data.spotifyConnect ||= { version: 1, clientId: CLIENT_ID };
    if (options.authed !== false) data.spotifyConnect.tokensEnc = new SpotifySecretStorage(storage).encrypt(access(now.value, options.tokens));
    const plugin = { app: { vault: {} }, projectWizard: { data }, dataStore: { writeQueue: Promise.resolve(), async save(value) { writes.push(copy(value)); } } };
    plugin.musicLibrary = new MusicLibrary(plugin, { metadata: false });
    const backend = new SpotifyConnectBackend(plugin, { safeStorage: storage, now: () => now.value, callbackPort: 0,
        request: async request => { calls.push(request); return options.request ? options.request(request) : response(204); },
        sleep: async duration => { sleeps.push(duration); }, ...options.backend });
    return { backend, plugin, writes, calls, now, storage, sleeps, close() { backend.destroy(); plugin.musicLibrary.destroy(); } };
}
function callback(url) {
    return new Promise((resolve, reject) => {
        http.get(url, result => { let body = ""; result.on("data", part => body += part); result.on("end", () => resolve({ status: result.statusCode, body, headers: result.headers })); }).on("error", reject);
    });
}
async function until(condition) {
    for (let attempt = 0; attempt < 100; attempt++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
    throw Error("Timed out waiting for the synthetic callback");
}

test("existing saved Spotify links map to track/context payloads without changing library metadata", () => {
    for (const type of ["track", "playlist", "album", "artist"]) {
        const item = createMusicItem({ provider: "spotify", source: `https://open.spotify.com/intl-en/${type}/${ID}?si=ignored`, name: "Custom name", enabled: false }, "existing-id");
        item.artwork = "https://i.scdn.co/image/known"; item.metadata.extra = "keep";
        const before = copy(item), expected = `spotify:${type}:${ID}`;
        assert.deepEqual(playbackPayload(item), type === "track" ? { uris: [expected] } : { context_uri: expected });
        assert.deepEqual(item, before);
        assert.deepEqual(playbackPayload({ source: `https://open.spotify.com/embed/${type}/${ID}` }), playbackPayload(item));
    }
    assert.throws(() => playbackPayload({ source: "https://example.com/track/wrong" }));
});

test("unconfigured installs do not write settings or contact Spotify; safe storage has no plaintext fallback", async () => {
    const data = { music: { version: 1, enabled: false }, unrelated: 42 }, f = fixture({ data, authed: false, safeStorage: false });
    try {
        const before = copy(f.plugin.projectWizard.data); await f.backend.restore();
        assert.equal(f.backend.snapshot.connected, false); assert.equal(f.backend.snapshot.secureStorageAvailable, false);
        assert.deepEqual(f.plugin.projectWizard.data, before); assert.equal(f.writes.length, 0); assert.equal(f.calls.length, 0);
        await assert.rejects(f.backend.connect(), /Secure token storage/);
        assert.throws(() => new SpotifySecretStorage({ isEncryptionAvailable: () => true, getSelectedStorageBackend: () => "basic_text", encryptString() {}, decryptString() {} }).encrypt({}), /Secure token storage/);
        assert.throws(() => new SpotifySecretStorage({ isEncryptionAvailable: () => true, encryptString() { throw Error("OS failure"); }, decryptString() {} }).encrypt({}), /saved securely/);
        assert.equal(f.writes.length, 0);
    } finally { f.close(); }
    assert.equal(SPOTIFY_REDIRECT_URI, "http://127.0.0.1:43827/itacan-spotify-callback");
    assert.equal(SPOTIFY_SCOPES, "user-read-playback-state user-modify-playback-state");
});

test("PKCE loopback callback checks state, consumes once, encrypts tokens, restores, and disconnects locally", async () => {
    let authorize, exchanged;
    const f = fixture({ authed: false, backend: { openExternal: async url => { authorize = new URL(url); } }, request: async request => {
        exchanged = new URLSearchParams(request.body);
        return response(200, { access_token: "synthetic-authorized-access", refresh_token: "synthetic-authorized-refresh", expires_in: 3600 });
    } });
    try {
        await f.backend.restore(); const existing = copy(f.plugin.projectWizard.data.music);
        await f.backend.connect(); assert.equal(f.backend.snapshot.connecting, true);
        assert.equal(authorize.origin + authorize.pathname, "https://accounts.spotify.com/authorize");
        assert.equal(authorize.searchParams.get("scope"), SPOTIFY_SCOPES); assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
        assert.equal(authorize.searchParams.get("redirect_uri"), f.backend.snapshot.redirectUri);
        assert.equal(authorize.searchParams.has("client_secret"), false);
        const bad = new URL(f.backend.snapshot.redirectUri); bad.searchParams.set("code", "synthetic-code"); bad.searchParams.set("state", "wrong");
        assert.equal((await callback(bad)).status, 400); assert.equal(f.calls.length, 0); assert.equal(f.backend.snapshot.connecting, true);
        const good = new URL(f.backend.snapshot.redirectUri); good.searchParams.set("code", "synthetic-code"); good.searchParams.set("state", authorize.searchParams.get("state"));
        const returned = await callback(good); assert.equal(returned.status, 200); assert.equal(returned.body.includes("synthetic-code"), false);
        assert.equal(returned.headers["cache-control"], "no-store");
        await until(() => f.backend.snapshot.connected && !f.backend.snapshot.connecting);
        assert.equal(exchanged.get("grant_type"), "authorization_code"); assert.equal(exchanged.get("redirect_uri"), authorize.searchParams.get("redirect_uri"));
        assert.equal(createHash("sha256").update(exchanged.get("code_verifier")).digest("base64url"), authorize.searchParams.get("code_challenge"));
        assert.equal(exchanged.has("client_secret"), false); assert.equal(f.backend.server, null); assert.equal(f.backend.pending, null);
        const disk = f.writes.at(-1), publicState = JSON.stringify(f.backend.snapshot);
        assert.ok(disk.spotifyConnect.tokensEnc); assert.equal(JSON.stringify(disk).includes("synthetic-authorized-access"), false);
        assert.equal(JSON.stringify(disk).includes("synthetic-authorized-refresh"), false); assert.equal(publicState.includes("access_token"), false);
        assert.deepEqual(disk.music, existing); assert.deepEqual(disk.unrelated, { preserved: true });
        const restored = new SpotifyConnectBackend({ ...f.plugin, projectWizard: { data: copy(disk) } }, { safeStorage: f.storage });
        await restored.restore(); assert.equal(restored.snapshot.connected, true); restored.destroy();
        await f.backend.disconnect(); assert.equal(f.backend.snapshot.connected, false); assert.equal("tokensEnc" in f.plugin.projectWizard.data.spotifyConnect, false);
        assert.equal(f.calls.length, 1, "Disconnect does not call an undocumented remote revocation endpoint");
    } finally { f.close(); }
});

test("callback denial, cancel, timeout, and changed Client ID clean up the loopback attempt", async () => {
    let authorize;
    const f = fixture({ authed: false, backend: { authTimeoutMs: 20, openExternal: async url => { authorize = new URL(url); } } });
    try {
        await assert.rejects(f.backend.setClientId("bad-client"), /32-character/);
        await f.backend.connect();
        const denied = new URL(f.backend.snapshot.redirectUri); denied.searchParams.set("error", "access_denied"); denied.searchParams.set("state", authorize.searchParams.get("state"));
        assert.equal((await callback(denied)).status, 400); assert.equal(f.backend.server, null); assert.equal(f.backend.snapshot.status, "error");
        await f.backend.connect(); await f.backend.disconnect(); assert.equal(f.backend.server, null); assert.equal(f.backend.snapshot.connecting, false);
        await f.backend.connect(); await until(() => !f.backend.snapshot.connecting); assert.match(f.backend.snapshot.message, /timed out/); assert.equal(f.backend.server, null);
        await f.backend.connect(); await f.backend.setClientId("abcdef1234567890abcdef1234567890");
        assert.equal(f.backend.server, null); assert.equal(f.backend.snapshot.connected, false); assert.equal(f.backend.snapshot.clientId, "abcdef1234567890abcdef1234567890");
        assert.equal(f.calls.length, 0);
    } finally { f.close(); }
});

test("token expiry refresh is deduplicated and retains the old refresh token if omitted", async () => {
    let release, refreshes = 0;
    const held = new Promise(resolve => { release = resolve; });
    const f = fixture({ tokens: { expires_at: 1800000000000 + 1000 }, request: async request => {
        if (request.url === "https://accounts.spotify.com/api/token") { refreshes++; await held; return response(200, { access_token: "synthetic-renewed", expires_in: 3600 }); }
        return response(200, { is_playing: false, device: device("active") });
    } });
    try {
        await f.backend.restore(); assert.equal(f.calls.length, 0, "Restore creates no background refresh/polling");
        assert.equal(expired(access(f.now.value), f.now.value), false); assert.equal(expired({ expires_at: f.now.value + 29999 }, f.now.value), true);
        const a = f.backend.getPlaybackState(), b = f.backend.getPlaybackState(); await until(() => refreshes === 1); release(); await Promise.all([a, b]);
        assert.equal(refreshes, 1); assert.equal(f.backend.tokens.refresh_token, "synthetic-refresh");
        assert.equal(f.backend.tokens.expires_at, f.now.value + 3600000); assert.equal(f.calls.at(-1).headers.Authorization, "Bearer synthetic-renewed");
    } finally { release(); f.close(); }
});

test("204 success never parses Obsidian's stray body or json getter", async () => {
    const f = fixture({ request: async () => ({ status: 204, text: "stray response bytes", get json() { throw Error("204 must not parse JSON"); } }) });
    try { await f.backend.restore(); assert.equal(await f.backend.pause(), null); assert.equal(await f.backend.getPlaybackState(), null); }
    finally { f.close(); }
});

test("401 refreshes credentials once and safely retries the same request", async () => {
    let reads = 0, refreshes = 0;
    const f = fixture({ request: async request => {
        if (request.url.includes("/api/token")) { refreshes++; return response(200, { access_token: "synthetic-after-401", refresh_token: "synthetic-rotated-refresh", expires_in: 3600 }); }
        if (++reads === 1) return response(401, { error: { message: "expired" } });
        assert.equal(request.headers.Authorization, "Bearer synthetic-after-401"); return response(200, { is_playing: true });
    } });
    try { await f.backend.restore(); assert.equal((await f.backend.getPlaybackState()).is_playing, true); assert.equal(reads, 2); assert.equal(refreshes, 1); }
    finally { f.close(); }
    let attempts = 0;
    const failed = fixture({ request: async request => request.url.includes("/api/token") ? response(200, { access_token: "synthetic-refreshed-but-rejected", expires_in: 3600 }) : (attempts++, response(401)) });
    try { await failed.backend.restore(); await assert.rejects(failed.backend.getPlaybackState(), /Connect Spotify/); assert.equal(attempts, 2, "No 401 retry loop"); }
    finally { failed.close(); }
});

test("permanent refresh failures clear credentials; temporary failures retain them with cooldown", async () => {
    const permanent = fixture({ tokens: { expires_at: 1 }, request: async () => response(400, { error: "invalid_grant", error_description: "not exposed" }) });
    try {
        await permanent.backend.restore(); await assert.rejects(permanent.backend.getPlaybackState(), /session expired/);
        assert.equal(permanent.backend.snapshot.connected, false); assert.equal(permanent.plugin.projectWizard.data.spotifyConnect.tokensEnc, undefined);
        await assert.rejects(permanent.backend.getPlaybackState(), /Connect Spotify/); assert.equal(permanent.calls.length, 1);
    } finally { permanent.close(); }
    const temporary = fixture({ tokens: { expires_at: 1 }, request: async () => response(503) });
    try {
        await temporary.backend.restore(); await assert.rejects(temporary.backend.getPlaybackState(), /temporarily unavailable/);
        assert.equal(temporary.backend.snapshot.connected, true); await assert.rejects(temporary.backend.getPlaybackState(), /Wait/); assert.equal(temporary.calls.length, 1);
        temporary.now.value += 30000; await assert.rejects(temporary.backend.getPlaybackState(), /temporarily unavailable/);
        assert.equal(temporary.backend.tokenRetryUntil - temporary.now.value, 60000, "Repeated transient failures use the adapted bounded backoff schedule");
    } finally { temporary.close(); }
    let tokenAttempts = 0;
    const throttled = fixture({ tokens: { expires_at: 1 }, request: async request => {
        if (!request.url.includes("/api/token")) return response(204);
        return ++tokenAttempts === 1 ? response(429, undefined, { "retry-after": "9" }) : response(200, { access_token: "synthetic-after-token-cooldown", expires_in: 3600 });
    } });
    try {
        await throttled.backend.restore(); await assert.rejects(throttled.backend.getPlaybackState(), error => error.status === 429 && error.retryAfterMs === 9000);
        await assert.rejects(throttled.backend.getPlaybackState(), error => error.retryAfterMs === 9000); assert.equal(tokenAttempts, 1);
        assert.equal(throttled.backend.snapshot.connected, true); throttled.now.value += 9000;
        assert.equal(await throttled.backend.getPlaybackState(), null); assert.equal(tokenAttempts, 2);
    } finally { throttled.close(); }
});

test("429 honors Retry-After across requests and never blindly repeats a transport action", async () => {
    let first = true;
    const f = fixture({ request: async () => { if (first) { first = false; return response(429, { error: { message: "private body" } }, { "Retry-After": "8" }); } return response(204); } });
    try {
        await f.backend.restore(); await assert.rejects(f.backend.next(), error => error.status === 429 && error.retryAfterMs === 8000 && !error.message.includes("private"));
        await assert.rejects(f.backend.pause(), error => error.status === 429); assert.equal(f.calls.length, 1);
        f.now.value += 8000; assert.equal(await f.backend.pause(), null); assert.equal(f.calls.length, 2);
    } finally { f.close(); }
});

test("device selection ignores restricted/unavailable devices and prefers a usable active device", () => {
    const inactive = device("inactive", false), active = device("active"), restricted = device("restricted", true, { is_restricted: true });
    assert.equal(selectDevice([restricted, inactive, active]), active); assert.equal(selectDevice([restricted, inactive]), inactive);
    assert.equal(selectDevice([{ is_active: true }, device("", true), restricted]), null); assert.equal(selectDevice([]), null);
});

test("start track/context uses exact saved URI and transfers an inactive usable device without foregrounding Spotify", async () => {
    const f = fixture({ request: async request => new URL(request.url).pathname.endsWith("/devices") ? response(200, { devices: [device("restricted", true, { is_restricted: true }), device("speaker", false)] }) : response(204) });
    try {
        await f.backend.restore(); const existing = copy(f.plugin.projectWizard.data.music.items[0]);
        await f.backend.startItem({ source: `https://open.spotify.com/track/${ID}` });
        const transfer = f.calls.find(request => new URL(request.url).pathname === "/v1/me/player"), play = f.calls.at(-1);
        assert.deepEqual(JSON.parse(transfer.body), { device_ids: ["speaker"], play: false }); assert.deepEqual(f.sleeps, [400]);
        assert.deepEqual(JSON.parse(play.body), { uris: [`spotify:track:${ID}`] }); assert.equal(new URL(play.url).searchParams.get("device_id"), "speaker");
        f.backend.playback = { device: device("active") }; const before = f.calls.length;
        await f.backend.startItem(existing); assert.deepEqual(JSON.parse(f.calls.at(-1).body), { context_uri: `spotify:playlist:${ID}` });
        assert.equal(f.calls.length, before + 1, "A known usable active device does not require a transfer/device refresh");
        assert.deepEqual(f.plugin.projectWizard.data.music.items[0], existing);
    } finally { f.close(); }
});

test("NO_ACTIVE_DEVICE transfer retries the original command once and bounds wake-up retries", async () => {
    let commands = 0;
    const f = fixture({ request: async request => {
        const path = new URL(request.url).pathname;
        if (path.endsWith("/devices")) return response(200, { devices: [device("speaker", false)] });
        if (path.endsWith("/player")) return response(204);
        if (++commands === 1) return response(404, { error: { reason: "NO_ACTIVE_DEVICE" } });
        if (commands === 2) return response(403, { error: { message: "Player command failed: Restriction violated" } });
        return response(204);
    } });
    try {
        await f.backend.restore(); assert.equal(await f.backend.next(), null); assert.equal(commands, 3); assert.deepEqual(f.sleeps, [400, 1200]);
        assert.equal(new URL(f.calls.at(-1).url).searchParams.get("device_id"), "speaker");
    } finally { f.close(); }
    const noDevice = fixture({ request: async request => new URL(request.url).pathname.endsWith("/devices") ? response(200, { devices: [device("restricted", true, { is_restricted: true })] }) : response(404, { error: { reason: "NO_ACTIVE_DEVICE" } }) });
    try {
        await noDevice.backend.restore(); await assert.rejects(noDevice.backend.startItem({ source: `https://open.spotify.com/album/${ID}` }), /Open Spotify on a device/);
        const before = noDevice.calls.length; assert.equal(await noDevice.backend.pause(), null); assert.equal(noDevice.calls.length, before + 1, "Pausing no active device never wakes another one");
    } finally { noDevice.close(); }
});

test("pause accepts explicit no-active state but never silently treats an unknown 404 as paused", async () => {
    const f = fixture({ request: async () => response(404, { error: { message: "Player command failed: No active device found" } }) });
    try {
        await f.backend.restore(); assert.equal(await f.backend.pause(), null); assert.equal(f.calls.length, 1);
        f.backend.options.request = async () => response(404, { error: { message: "Device not found", reason: "DEVICE_NOT_FOUND" } });
        await assert.rejects(f.backend.pause(), error => error.status === 404 && !error.noActiveDevice);
        f.backend.options.request = async () => response(404);
        await assert.rejects(f.backend.pause(), error => error.status === 404 && !error.noActiveDevice);
    } finally { f.close(); }
});

test("seek/volume clamp units and 400/403/network failures are actionable without sensitive response text", async () => {
    const f = fixture();
    try {
        await f.backend.restore(); await f.backend.seek(123.456); assert.equal(new URL(f.calls.at(-1).url).searchParams.get("position_ms"), "123456");
        await f.backend.setVolume(1.5); assert.equal(new URL(f.calls.at(-1).url).searchParams.get("volume_percent"), "100");
        await f.backend.setVolume(-1); assert.equal(new URL(f.calls.at(-1).url).searchParams.get("volume_percent"), "0");
        await f.backend.previous(); assert.equal(f.calls.at(-1).method, "POST");
        f.backend.options.request = async () => response(400, { error: { message: "sensitive response material" } });
        await assert.rejects(f.backend.next(), error => error.status === 400 && !error.message.includes("sensitive"));
        f.backend.options.request = async () => response(403, { error: { message: "Player command failed: Restriction violated" } });
        await assert.rejects(f.backend.next(), /Premium/); assert.deepEqual(f.sleeps, [800]);
        f.backend.options.request = async () => { throw Error("sensitive request material"); };
        await assert.rejects(f.backend.next(), error => /could not be reached/.test(error.message) && !error.message.includes("sensitive"));
    } finally { f.close(); }
});

test("public settings use the existing serialized Music/atomic store and roll back failed writes", async () => {
    const f = fixture({ authed: false });
    try {
        await Promise.all([f.backend.setClientId("abcdef1234567890abcdef1234567890"), f.plugin.musicLibrary.rename("saved-id", "Renamed during client save")]);
        assert.equal(f.plugin.projectWizard.data.music.items[0].name, "Renamed during client save"); assert.equal(f.backend.snapshot.clientId, "abcdef1234567890abcdef1234567890");
        const before = copy(f.plugin.projectWizard.data.spotifyConnect); f.plugin.dataStore.save = async () => { throw Error("atomic conflict"); };
        await assert.rejects(f.backend.setClientId(CLIENT_ID), /atomic conflict/); assert.deepEqual(f.plugin.projectWizard.data.spotifyConnect, before);
    } finally { f.close(); }
    const failingAuthed = fixture();
    try {
        await failingAuthed.backend.restore(); let observed;
        failingAuthed.backend.onChange(state => { observed = state.connected; });
        failingAuthed.plugin.dataStore.save = async () => { throw Error("atomic conflict"); };
        await assert.rejects(failingAuthed.backend.setClientId("abcdef1234567890abcdef1234567890"), /atomic conflict/);
        assert.equal(observed, false, "Auth-dependent controls are notified even if a Client ID save fails after clearing in-memory credentials");
    } finally { failingAuthed.close(); }
    const future = fixture({ authed: false, data: { spotifyConnect: { version: 2, clientId: CLIENT_ID, opaque: "preserve" } } });
    try { await future.backend.restore(); assert.equal(future.backend.snapshot.status, "error"); await assert.rejects(future.backend.setClientId(""), /newer Itacan/); assert.equal(future.writes.length, 0); }
    finally { future.close(); }
});

test("disconnect during refresh prevents an old response from reviving encrypted credentials", async () => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const f = fixture({ tokens: { expires_at: 1 }, request: async () => { await held; return response(200, { access_token: "synthetic-stale-refresh", expires_in: 3600 }); } });
    try {
        await f.backend.restore(); const refresh = f.backend.getPlaybackState(); await until(() => f.calls.length === 1);
        await f.backend.disconnect(); release(); await assert.rejects(refresh, error => error.cancelled);
        assert.equal(f.backend.snapshot.connected, false); assert.equal(f.plugin.projectWizard.data.spotifyConnect.tokensEnc, undefined);
    } finally { release(); f.close(); }
});

test("cancel while the loopback listener is starting cannot open a stale authorization page", async () => {
    let opened = 0;
    const f = fixture({ authed: false, backend: { openExternal: async () => { opened++; } } });
    try {
        const connecting = f.backend.connect(); await f.backend.disconnect();
        await assert.rejects(connecting, error => error.cancelled);
        assert.equal(opened, 0); assert.equal(f.backend.server, null); assert.equal(f.backend.snapshot.connecting, false);
    } finally { f.close(); }
});
