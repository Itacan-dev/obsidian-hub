"use strict";
const fs = require("fs"), path = require("path"), { createHash } = require("crypto");
const { managedBlacklistContains } = require("../core/index");
const { sourceUrl, categories, maxFeedBytes, validateFeed } = require("./hosts-feed");
const refreshIntervalMs = 86_400_000;
const digest = text => createHash("sha256").update(text, "utf8").digest("hex");
const time = value => Number.isSafeInteger(value) && value >= 0;
const validator = value => value === null || typeof value === "string" && value.length <= 300 && !/[\r\n]/.test(value);

function readBundle(directory) {
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, "metadata.json"), "utf8"));
    const text = fs.readFileSync(path.join(directory, "hosts"), "utf8");
    if (!/^[a-f0-9]{40}$/.test(metadata.revision) || metadata.sourceUrl !== sourceUrl.replace("/master/", `/${metadata.revision}/`) || digest(text) !== metadata.sha256) throw new Error("BUNDLED_BLACKLIST_INVALID");
    return { text, sourceUrl: metadata.sourceUrl, sha256: metadata.sha256, fetchedAt: null, upstreamVersion: metadata.revision,
        etag: null, lastModified: null };
}
function createManagedService({ repository, bundle, fetch: fetchFeed, now = Date.now, publish = work => work(), changed = () => {} }) {
    let current = null, origin = "BUNDLE", lastAttemptAt = null, lastResult = "LOADING", inFlight = null;
    const notify = () => { try { changed(); } catch (_) { /* committed data is independent of UI clients */ } };
    const save = state => { try { return repository.saveManagedCache(state); } catch (_) { return false; } };
    const checkpoint = (feed = current?.record, result = lastResult) => ({ schemaVersion: 1, feed, lastAttemptAt, lastResult: result });
    function readFeed(record) {
        if (!record || typeof record.text !== "string" || !(record.sourceUrl === sourceUrl || /^https:\/\/raw\.githubusercontent\.com\/StevenBlack\/hosts\/[a-f0-9]{40}\/alternates\/fakenews-gambling-porn-social\/hosts$/.test(record.sourceUrl)) ||
            digest(record.text) !== record.sha256 || !(record.fetchedAt === null || time(record.fetchedAt)) || !validator(record.upstreamVersion) || !validator(record.etag) || !validator(record.lastModified)) return null;
        const valid = validateFeed(record.text); return valid ? { ...valid, record } : null;
    }
    const ready = Promise.resolve().then(async () => {
        let cached = null; try { cached = repository.loadManagedCache(); } catch (_) { /* verified bundle remains available */ }
        if (cached?.schemaVersion === 1) {
            current = readFeed(cached.feed);
            lastAttemptAt = time(cached.lastAttemptAt) ? cached.lastAttemptAt : null;
            if (current) { origin = "CACHE"; lastResult = /^[A-Z_]{1,60}$/.test(cached.lastResult) ? cached.lastResult : "ACTIVE"; }
        }
        if (!current) {
            current = readFeed(await bundle());
            if (!current) throw new Error("BUNDLED_BLACKLIST_INVALID");
            origin = "BUNDLE"; lastResult = cached ? "CACHE_INVALID_USING_BUNDLE" : "ACTIVE";
            if (!save(checkpoint())) lastResult = "CACHE_UNAVAILABLE_USING_BUNDLE";
        }
        if (lastResult === "UPDATING") lastResult = "INTERRUPTED_UPDATE";
        notify();
    }).catch(() => { current = null; lastResult = "MANAGED_AUTHORITY_UNAVAILABLE"; notify(); });

    async function download() {
        const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 30_000); timeout.unref?.();
        try {
            const headers = {};
            if (current.record.etag) headers["If-None-Match"] = current.record.etag;
            if (current.record.lastModified) headers["If-Modified-Since"] = current.record.lastModified;
            const response = await fetchFeed(sourceUrl, { headers, credentials: "omit", redirect: "error", cache: "no-store", signal: abort.signal });
            if (response.status === 304) {
                if (!headers["If-None-Match"] && !headers["If-Modified-Since"]) throw new Error("INVALID_CACHE_RESPONSE");
                return { unchanged: true };
            }
            if (!response.ok || !response.body || Number(response.headers.get("content-length") ?? 0) > maxFeedBytes) throw new Error("DOWNLOAD_FAILED");
            const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
            let bytes = 0, text = "";
            try {
                while (true) {
                    const chunk = await reader.read(); if (chunk.done) break;
                    bytes += chunk.value.length; if (bytes > maxFeedBytes) throw new Error("FEED_TOO_LARGE");
                    text += decoder.decode(chunk.value, { stream: true });
                }
                text += decoder.decode();
            } finally { await reader.cancel(); }
            const etag = response.headers.get("etag"), lastModified = response.headers.get("last-modified");
            if (!validator(etag) || !validator(lastModified)) throw new Error("INVALID_CACHE_HEADERS");
            return { unchanged: false, text, etag, lastModified };
        } finally { clearTimeout(timeout); }
    }
    async function refresh(force) {
        await ready;
        const timestamp = now();
        if (!current || !time(timestamp)) return;
        if (!force && lastAttemptAt !== null && timestamp - lastAttemptAt < refreshIntervalMs) return;
        lastAttemptAt = timestamp; lastResult = "UPDATING";
        if (!save(checkpoint())) { lastResult = "CACHE_WRITE_FAILED"; notify(); return; }
        notify();
        try {
            const downloaded = await download();
            const next = downloaded.unchanged ? { parsed: current.parsed, compiled: current.compiled } : validateFeed(downloaded.text, current.compiled.size);
            if (!next) { lastResult = "INVALID_FEED"; }
            else {
                const record = downloaded.unchanged ? { ...current.record, fetchedAt: timestamp } : {
                    text: downloaded.text, sourceUrl, sha256: digest(downloaded.text), fetchedAt: timestamp,
                    upstreamVersion: downloaded.etag, etag: downloaded.etag, lastModified: downloaded.lastModified };
                const result = downloaded.unchanged ? "NOT_MODIFIED" : "UPDATED";
                const committed = await publish(async () => {
                    if (!save(checkpoint(record, result))) return false;
                    current = { ...next, record }; origin = "UPDATE"; lastResult = result; return true;
                });
                if (!committed) lastResult = "CACHE_WRITE_FAILED";
                notify(); return;
            }
        } catch (_) { lastResult = "NETWORK_UPDATE_FAILED"; }
        save(checkpoint()); notify();
    }
    return { ready, getBlacklist: () => current?.compiled ?? null,
        view: (/** @type {readonly string[]} */ whitelist = []) => ({ enabled: true, active: !!current, count: current?.compiled.size ?? 0, source: sourceUrl, categories,
            origin, upstreamDate: current?.parsed.upstreamDate ?? null, version: current?.record.upstreamVersion ?? null,
            hash: current?.record.sha256 ?? null, lastSuccessfulSync: current?.record.fetchedAt ?? null, lastAttemptAt,
            status: lastResult, error: /FAILED|INVALID|UNAVAILABLE/.test(lastResult) ? lastResult : null,
            conflicts: current ? whitelist.filter(h => managedBlacklistContains(current.compiled, h) === true) : [] }),
        lookup: hostname => current ? managedBlacklistContains(current.compiled, hostname) : null,
        refresh({ force = false } = {}) {
            if (!inFlight) inFlight = refresh(force).finally(() => { inFlight = null; }); return inFlight;
        } };
}
module.exports = { createManagedService, readBundle, refreshIntervalMs, digest };
