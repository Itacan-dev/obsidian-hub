"use strict";
// Backend portions adapted from caezium/obsidian-spotify-control (MIT):
// src/auth.ts, src/api.ts, src/secure-storage.ts; commit
// bcac3ccd3231ba879e3a3e8444b3f7fb3bae9464. Copyright (c) 2026 caezium.
// Full copyright/permission notice: ../../THIRD-PARTY-NOTICES.md.

const http = require("http");
const { Buffer } = require("buffer");
const { randomBytes, createHash, timingSafeEqual } = require("crypto");
const { normalizeMusicSource } = require("../domain/music");
const { SpotifySecretStorage } = require("./spotify-secret-storage");

const SPOTIFY_REDIRECT_URI = "http://127.0.0.1:43827/itacan-spotify-callback";
const SPOTIFY_SCOPES = "user-read-playback-state user-modify-playback-state";
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";
const CONNECT_MESSAGE = "Connect Spotify in Settings.";
const DEVICE_MESSAGE = "Open Spotify on a device, then try again.";
const RESTRICTION_MESSAGE = "Spotify cannot control this playback right now. Check Spotify Premium, app access, and the device, then try again.";

function expired(tokens, now = Date.now()) { return !tokens?.expires_at || now >= tokens.expires_at - 30000; }
function pkce() {
    const verifier = randomBytes(48).toString("base64url");
    return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url"), state: randomBytes(24).toString("base64url") };
}
function equalState(expected, received) {
    const a = Buffer.from(expected || ""), b = Buffer.from(received || "");
    return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
function responseBody(response) {
    // Player writes legitimately return 204, including Obsidian responses
    // with stray non-JSON bytes. Never touch .json on a 204 response.
    if (response?.status === 204) return null;
    try {
        if (response?.text?.trim()) return JSON.parse(response.text);
        return response?.json ?? null;
    } catch (_) { return null; }
}
function retryAfter(response, now) {
    const headers = response?.headers || {}, key = Object.keys(headers).find(name => name.toLowerCase() === "retry-after");
    const value = key ? headers[key] : undefined, seconds = Number(value);
    if (value !== undefined && Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(1000, date - now) : 30000;
}
function spotifyError(response, now = Date.now()) {
    const status = Number(response?.status) || 0, raw = responseBody(response)?.error;
    const reason = typeof raw?.reason === "string" ? raw.reason : undefined;
    const restriction = status === 403 && /restriction violated/i.test(raw?.message || "");
    const noDevice = status === 404 || reason === "NO_ACTIVE_DEVICE";
    const noActiveDevice = reason === "NO_ACTIVE_DEVICE" || status === 404 && /no active device/i.test(raw?.message || "");
    const message = status === 401 ? CONNECT_MESSAGE : noDevice ? DEVICE_MESSAGE : status === 403 ? RESTRICTION_MESSAGE :
        status === 429 ? "Spotify is rate limiting requests. Wait and try again." : status === 400 ? "Spotify could not play this saved item. Check that it is available to your account." :
            status >= 500 ? "Spotify is temporarily unavailable. Try again shortly." : "Spotify could not complete the request. Try again.";
    // Do not propagate upstream response text, request objects or auth values
    // into an error that UI/Obsidian might log.
    return Object.assign(Error(message), { status, reason, noDevice, noActiveDevice, restriction, ...(status === 429 ? { retryAfterMs: retryAfter(response, now) } : {}) });
}
function selectDevice(devices) {
    const usable = (Array.isArray(devices) ? devices : []).filter(device => typeof device?.id === "string" && device.id && !device.is_restricted);
    return usable.find(device => device.is_active) || usable[0] || null;
}
function playbackPayload(item) {
    // Existing saved URLs are authoritative; no library migration/re-add.
    const source = normalizeMusicSource("spotify", item?.source);
    return source.sourceType === "track" ? { uris: [source.metadata.uri] } : { context_uri: source.metadata.uri };
}
function tokensFrom(data, now, previous) {
    if (typeof data?.access_token !== "string" || !data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) {
        throw Error("Spotify returned an incomplete authorization response. Connect again in Settings.");
    }
    const refresh_token = data.refresh_token || previous?.refresh_token;
    if (typeof refresh_token !== "string" || !refresh_token) throw Error("Spotify did not provide a refresh token. Connect again in Settings.");
    return { access_token: data.access_token, refresh_token, token_type: "Bearer", expires_at: now + Number(data.expires_in) * 1000 };
}

class SpotifyConnectBackend {
    constructor(plugin, options = {}) {
        this.plugin = plugin; this.options = options; this.now = options.now || Date.now;
        this.sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
        this.secretStorage = new SpotifySecretStorage(options.safeStorage);
        this.listeners = new Set(); this.writeQueue = Promise.resolve(); this.generation = 0;
        this.tokens = null; this.pending = null; this.exchanging = false; this.server = null; this.authTimer = null; this.authListenCancel = null; this.refreshPromise = null;
        this.rateLimitUntil = 0; this.tokenRetryUntil = 0; this.refreshFailures = 0; this.playback = null; this.message = ""; this.destroyed = false;
        this.redirectUri = options.callbackPort === undefined ? SPOTIFY_REDIRECT_URI : `http://127.0.0.1:${options.callbackPort}/itacan-spotify-callback`;
    }
    get config() {
        const value = this.plugin.projectWizard.data.spotifyConnect;
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    get snapshot() {
        return { clientId: String(this.config.clientId || ""), redirectUri: this.redirectUri, connected: !!this.tokens,
            connecting: !!this.pending || this.exchanging, secureStorageAvailable: this.secretStorage.available,
            status: this.pending || this.exchanging ? "connecting" : this.message ? "error" : this.tokens ? "connected" : "disconnected", message: this.message, playback: this.playback };
    }
    onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit() { if (!this.destroyed) for (const listener of this.listeners) { try { listener(this.snapshot); } catch (_) { /* Detached view. */ } } }
    active(generation = this.generation) {
        if (this.destroyed || generation !== this.generation) { const error = Error("Spotify request was cancelled."); error.cancelled = true; throw error; }
    }
    async restore() {
        this.active();
        if (Number(this.config.version || 1) > 1) { this.message = "Spotify connection settings require a newer Itacan version."; this.emit(); return; }
        const tokens = this.secretStorage.decrypt(this.config.tokensEnc);
        if (tokens?.access_token && tokens?.refresh_token && Number.isFinite(tokens.expires_at)) this.tokens = tokens;
        else if (this.config.tokensEnc) this.message = "Stored Spotify credentials cannot be unlocked on this device. Connect again in Settings.";
        this.emit();
    }
    save(patch, generation = this.generation) {
        const work = async () => {
            this.active(generation);
            if (Number(this.config.version || 1) > 1) throw Error("Spotify connection settings require a newer Itacan version.");
            await this.plugin.dataStore.writeQueue?.catch(() => {}); this.active(generation);
            const data = this.plugin.projectWizard.data, previous = data.spotifyConnect;
            const next = { ...this.config, version: 1, ...patch };
            if (next.tokensEnc === undefined) delete next.tokensEnc;
            data.spotifyConnect = next;
            try { await this.plugin.dataStore.save(data); this.plugin.projectWizard.data.spotifyConnect = next; }
            catch (error) {
                if (data.spotifyConnect === next) { if (previous === undefined) delete data.spotifyConnect; else data.spotifyConnect = previous; }
                throw error;
            }
        };
        // Reuse Music's existing serialized configuration owner, preserving
        // concurrent library edits and the shared atomic conflict checks.
        if (this.plugin.musicLibrary?.enqueue) return this.plugin.musicLibrary.enqueue(work);
        const result = this.writeQueue.catch(() => {}).then(work); this.writeQueue = result; return result;
    }
    async setClientId(value) {
        const clientId = String(value || "").trim();
        if (clientId && !/^[a-fA-F0-9]{32}$/.test(clientId)) throw Error("Enter the 32-character Spotify Developer Client ID.");
        if (clientId === this.snapshot.clientId) return;
        this.cancelAuth(); this.generation++; this.tokens = null; this.playback = null; this.message = "";
        this.rateLimitUntil = 0; this.tokenRetryUntil = 0; this.refreshFailures = 0;
        try { await this.save({ clientId, tokensEnc: undefined }); } finally { this.emit(); }
    }
    cancelAuth(graceful = false) {
        this.pending = null; this.exchanging = false; clearTimeout(this.authTimer); this.authTimer = null;
        this.authListenCancel?.(); this.authListenCancel = null;
        this.server?.close(); if (!graceful) this.server?.closeAllConnections?.(); this.server = null;
    }
    async connect() {
        this.active();
        if (!/^[a-fA-F0-9]{32}$/.test(this.snapshot.clientId)) throw Error("Enter your Spotify Client ID in Settings first.");
        if (!this.secretStorage.available) throw Error("Secure token storage is unavailable. Connect Spotify on an Obsidian desktop with OS keychain support.");
        this.cancelAuth(); const generation = ++this.generation;
        const pending = { ...pkce(), clientId: this.snapshot.clientId, generation };
        this.pending = pending; this.message = "Complete the Spotify connection in your browser."; this.emit();
        try {
            await this.listenForCallback(pending); this.active(generation);
            const url = new URL(AUTHORIZE_URL);
            for (const [key, value] of Object.entries({ response_type: "code", client_id: pending.clientId, redirect_uri: this.redirectUri,
                scope: SPOTIFY_SCOPES, state: pending.state, code_challenge_method: "S256", code_challenge: pending.challenge })) url.searchParams.set(key, value);
            const open = this.options.openExternal || (address => {
                const shell = globalThis.window?.electron?.shell || require("electron").shell;
                if (!shell?.openExternal) throw Error("The system browser is unavailable. Connect Spotify on Obsidian desktop.");
                return shell.openExternal(address);
            });
            await open(url.toString());
        } catch (error) {
            if (generation === this.generation) { this.cancelAuth(); this.message = error.cancelled ? "" : "Spotify connection could not start. Try again."; this.emit(); }
            if (error.code === "EADDRINUSE") throw Error("Spotify's local callback port is busy. Finish or cancel another connection attempt, then try again.");
            if (error.cancelled) throw error;
            throw Error(this.message || "Spotify connection could not start. Try again.");
        }
    }
    listenForCallback(pending) {
        // Spotify's current requirements permit HTTP only on IP-literal
        // loopback. Upstream's obsidian:// callback is deliberately not copied.
        // https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
        const address = new URL(this.redirectUri), port = Number(address.port);
        return new Promise((resolve, reject) => {
            const cancel = () => { const error = Error("Spotify connection was cancelled."); error.cancelled = true; reject(error); };
            this.authListenCancel = cancel;
            const server = (this.options.createServer || http.createServer)((request, response) => {
                const finish = (status, message) => {
                    response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
                        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Connection": "close" });
                    response.end(`<!doctype html><title>Itacan Spotify</title><p>${message}</p>`);
                };
                let callback;
                try { callback = new URL(request.url, this.redirectUri); } catch (_) { finish(400, "Invalid callback."); return; }
                if (request.method !== "GET" || callback.pathname !== address.pathname || request.headers.host !== new URL(this.redirectUri).host ||
                    request.socket.remoteAddress !== "127.0.0.1") { finish(404, "Not found."); return; }
                if (this.pending !== pending || !equalState(pending.state, callback.searchParams.get("state"))) {
                    finish(400, "The connection attempt does not match. Return to Itacan Settings and try again."); return;
                }
                if (callback.searchParams.has("error") || !callback.searchParams.get("code")) {
                    finish(400, "Spotify connection was not approved. Return to Itacan Settings to try again.");
                    this.cancelAuth(true); this.message = "Spotify connection was not approved. Try again in Settings."; this.emit(); return;
                }
                // Consume the pending attempt before exchanging; duplicate
                // callbacks cannot replay an authorization code.
                finish(200, "Return to Itacan Settings to check your Spotify connection. You may close this tab.");
                this.cancelAuth(true); this.exchanging = true; this.emit();
                void this.exchange(callback.searchParams.get("code"), pending).catch(error => {
                    if (!this.destroyed && pending.generation === this.generation) { this.message = error.message; this.emit(); }
                }).finally(() => { if (pending.generation === this.generation) { this.exchanging = false; this.emit(); } });
            });
            this.server = server; server.requestTimeout = 15000; server.headersTimeout = 15000; server.once("error", reject);
            server.listen(port, "127.0.0.1", () => {
                server.removeListener("error", reject);
                if (this.destroyed || this.pending !== pending) { server.close(); server.closeAllConnections?.(); cancel(); return; }
                if (this.authListenCancel === cancel) this.authListenCancel = null;
                // Keep a diagnostic test's port=0 exact redirect consistent
                // across authorize and token exchange; production is fixed.
                this.redirectUri = `http://127.0.0.1:${server.address().port}${address.pathname}`;
                server.on("error", () => { if (this.pending === pending) { this.cancelAuth(); this.message = "Spotify's callback listener stopped. Try connecting again."; this.emit(); } });
                this.authTimer = setTimeout(() => {
                    if (this.pending === pending) { this.cancelAuth(); this.message = "Spotify connection timed out. Try again in Settings."; this.emit(); }
                }, this.options.authTimeoutMs || 300000);
                this.authTimer.unref?.(); server.unref?.(); resolve();
            });
        });
    }
    async exchange(code, pending) {
        const generation = pending.generation; this.active(generation);
        const response = await this.send({ url: TOKEN_URL, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri,
                client_id: pending.clientId, code_verifier: pending.verifier }).toString(), throw: false });
        this.active(generation);
        if (response.status !== 200) throw Error("Spotify authorization failed. Check your Client ID, redirect URI, and app access, then connect again.");
        await this.storeTokens(tokensFrom(responseBody(response), this.now()), generation);
        this.message = ""; this.tokenRetryUntil = 0; this.refreshFailures = 0; this.emit();
    }
    async storeTokens(tokens, generation = this.generation) {
        this.active(generation); const tokensEnc = this.secretStorage.encrypt(tokens);
        await this.save({ tokensEnc }, generation); this.active(generation); this.tokens = tokens;
    }
    async disconnect() {
        this.cancelAuth(); this.generation++; this.tokens = null; this.playback = null; this.message = ""; this.rateLimitUntil = 0; this.tokenRetryUntil = 0; this.refreshFailures = 0;
        try { await this.save({ tokensEnc: undefined }); } finally { this.emit(); }
        // Local credentials cleared; no undocumented Spotify revoke endpoint
        // or claim of Spotify-side account revocation.
    }
    async send(options) {
        let request = this.options.request;
        if (!request) { try { request = require("obsidian").requestUrl; } catch (_) { /* Bare Node. */ } }
        if (!request) throw Error("Spotify requests are unavailable in this host.");
        try {
            const response = await request(options);
            if (!response || !Number.isFinite(Number(response.status))) throw Error("Incomplete response");
            return response;
        }
        catch (_) { throw Error("Spotify could not be reached. Check your connection and try again."); }
    }
    async ensureFreshToken() {
        this.active(); if (!this.tokens) throw Error(CONNECT_MESSAGE);
        if (expired(this.tokens, this.now())) await this.refresh();
        if (!this.tokens) throw Error(CONNECT_MESSAGE); return this.tokens.access_token;
    }
    refresh() {
        if (this.refreshPromise) return this.refreshPromise;
        const promise = this.doRefresh().finally(() => { if (this.refreshPromise === promise) this.refreshPromise = null; });
        this.refreshPromise = promise; return promise;
    }
    refreshBackoff() {
        // Upstream's bounded transient schedule, applied on demand instead
        // of retaining a background timer while the Music window is closed.
        const schedule = [30000, 60000, 120000, 300000];
        const delay = schedule[Math.min(this.refreshFailures++, schedule.length - 1)];
        this.tokenRetryUntil = this.now() + delay;
    }
    async doRefresh() {
        this.active(); if (!this.tokens?.refresh_token) throw Error(CONNECT_MESSAGE);
        if (this.tokenRetryUntil > this.now()) throw Object.assign(Error("Spotify token refresh is temporarily unavailable. Wait and try again."), { retryAfterMs: this.tokenRetryUntil - this.now() });
        const generation = this.generation, previous = this.tokens;
        let response;
        try {
            response = await this.send({ url: TOKEN_URL, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: previous.refresh_token, client_id: this.snapshot.clientId }).toString(), throw: false });
        } catch (error) { this.active(generation); this.refreshBackoff(); throw error; }
        this.active(generation);
        if (response.status === 429 || response.status >= 500) {
            if (response.status === 429) this.tokenRetryUntil = this.now() + retryAfter(response, this.now()); else this.refreshBackoff();
            throw spotifyError(response, this.now());
        }
        if (response.status >= 400) {
            this.tokens = null; this.playback = null; this.message = "Spotify session expired. Connect again in Settings.";
            await this.save({ tokensEnc: undefined }, generation); this.emit(); throw Error(this.message);
        }
        await this.storeTokens(tokensFrom(responseBody(response), this.now(), previous), generation); this.tokenRetryUntil = 0; this.refreshFailures = 0; this.message = ""; this.emit();
    }
    async request(method, path, { body, query } = {}) {
        this.active();
        if (this.rateLimitUntil > this.now()) throw Object.assign(Error("Spotify is rate limiting requests. Wait and try again."), { status: 429, retryAfterMs: this.rateLimitUntil - this.now() });
        const generation = this.generation, token = await this.ensureFreshToken(); this.active(generation);
        const issue = async accessToken => {
            this.active(generation);
            const url = new URL(API_URL + path);
            for (const [key, value] of Object.entries(query || {})) if (value !== undefined) url.searchParams.set(key, String(value));
            return this.send({ url: url.toString(), method, headers: { Authorization: `Bearer ${accessToken}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}), throw: false });
        };
        let response = await issue(token); this.active(generation);
        if (response.status === 401) { await this.refresh(); this.active(generation); response = await issue(this.tokens.access_token); this.active(generation); }
        if (response.status >= 200 && response.status < 300) return responseBody(response);
        const error = spotifyError(response, this.now());
        if (response.status === 429) this.rateLimitUntil = this.now() + error.retryAfterMs;
        throw error;
    }
    async getPlaybackState() {
        const playback = await this.request("GET", "/me/player"); this.playback = playback; this.emit(); return playback;
    }
    async getAvailableDevices() { return (await this.request("GET", "/me/player/devices"))?.devices || []; }
    async transferTo(deviceId, play = false) {
        if (typeof deviceId !== "string" || !deviceId) throw Error(DEVICE_MESSAGE);
        return this.request("PUT", "/me/player", { body: { device_ids: [deviceId], play: !!play } });
    }
    async command(method, path, options = {}, { transfer = true } = {}) {
        const generation = this.generation;
        try { return await this.request(method, path, options); }
        catch (error) {
            if (error.noActiveDevice && !transfer) return null;
            if (error.noDevice && !transfer) throw error;
            if (error.noDevice) {
                const target = selectDevice(await this.getAvailableDevices()); this.active(generation);
                if (!target) throw Error(DEVICE_MESSAGE);
                await this.transferTo(target.id, false); await this.sleep(400); this.active(generation);
                const retry = { ...options, query: { ...options.query, device_id: target.id } };
                try { return await this.request(method, path, retry); }
                catch (wakeError) {
                    if (!wakeError.restriction && !wakeError.noDevice) throw wakeError;
                    await this.sleep(1200); this.active(generation); return this.request(method, path, retry);
                }
            }
            if (error.restriction) { await this.sleep(800); this.active(generation); return this.request(method, path, options); }
            throw error;
        }
    }
    async playCommand(body) {
        const generation = this.generation;
        const current = this.playback?.device;
        let device = selectDevice(current?.is_active ? [current] : []);
        if (!device) device = selectDevice(await this.getAvailableDevices());
        this.active(generation);
        if (!device) throw Error(DEVICE_MESSAGE);
        if (!device.is_active) { await this.transferTo(device.id, false); await this.sleep(400); this.active(generation); }
        return this.command("PUT", "/me/player/play", { ...(body ? { body } : {}), query: { device_id: device.id } });
    }
    startItem(item) { return this.playCommand(playbackPayload(item)); }
    resume() { return this.playCommand(); }
    pause() { return this.command("PUT", "/me/player/pause", {}, { transfer: false }); }
    previous() { return this.command("POST", "/me/player/previous"); }
    next() { return this.command("POST", "/me/player/next"); }
    seek(seconds) { return this.command("PUT", "/me/player/seek", { query: { position_ms: Math.max(0, Math.round((Number(seconds) || 0) * 1000)) } }); }
    setVolume(value) {
        return this.command("PUT", "/me/player/volume", { query: { volume_percent: Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100))) } });
    }
    destroy() { this.destroyed = true; this.generation++; this.cancelAuth(); this.tokens = null; this.playback = null; this.listeners.clear(); }
}

module.exports = { SpotifyConnectBackend, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPES, playbackPayload, selectDevice, expired, pkce, responseBody };
