"use strict";
const { randomUUID, createHash } = require("crypto");
const nodePath = require("path");

const MUSIC_VERSION = 1;
const MUSIC_PROVIDERS = Object.freeze([
    { id: "spotify", name: "Spotify", icon: "audio-lines" },
    { id: "youtube", name: "YouTube", icon: "square-play" },
    { id: "youtube-music", name: "YouTube Music", icon: "music-2" },
    { id: "local", name: "Local files", icon: "file-audio" }
].map(Object.freeze));
const LOCAL_AUDIO_EXTENSIONS = Object.freeze(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "webm"]);
const musicProvider = id => MUSIC_PROVIDERS.find(provider => provider.id === id) ?? null;
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = value => typeof value === "string" ? value.trim() : "";

function musicDefaults() {
    return { version: MUSIC_VERSION, enabled: false,
        providers: Object.fromEntries(MUSIC_PROVIDERS.map(provider => [provider.id, true])), items: [] };
}
function normalizeMusicConfig(saved) {
    saved = object(saved);
    if (Number(saved.version) > MUSIC_VERSION) throw Error("This music library was saved by a newer version of Itacan.");
    const providers = object(saved.providers), ids = new Set();
    const items = (Array.isArray(saved.items) ? saved.items : []).filter(item => item && musicProvider(item.provider) && text(item.source)).map((item, index) => {
        let id = text(item.id);
        // Partially saved older configurations gain deterministic IDs on first
        // edit, so reading defaults never creates new identities or writes data.
        if (!id || ids.has(id)) id = "music-" + createHash("sha256").update(`${item.provider}:${item.source}:${index}`).digest("hex").slice(0, 24);
        ids.add(id);
        return { id, name: text(item.name) || musicDisplayName(item), provider: item.provider,
            source: text(item.source), sourceType: text(item.sourceType) || (item.provider === "local" ? "file" : "video"),
            enabled: item.enabled !== false, metadata: { ...object(item.metadata) },
            ...(safeArtwork(item.artwork) ? { artwork: safeArtwork(item.artwork) } : {}) };
    });
    return { version: MUSIC_VERSION, enabled: saved.enabled === true,
        providers: Object.fromEntries(MUSIC_PROVIDERS.map(provider => [provider.id, providers[provider.id] !== false])), items };
}
function safeArtwork(value) {
    try { const url = new URL(text(value)); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
    catch (_) { return null; }
}
function sourceUrl(source) {
    const input = text(source);
    if (!input) throw Error("Paste a music URL.");
    let url;
    try { url = new URL(/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|open\.spotify\.com)\//i.test(input) ? "https://" + input : input); }
    catch (_) { throw Error("Enter a valid music URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && url.port !== "443" && url.port !== "80")) {
        throw Error("Enter a valid music URL.");
    }
    return url;
}
function startSeconds(value) {
    value = String(value ?? "");
    if (/^\d+(?:\.\d+)?s?$/.test(value)) return Math.floor(Number(value.replace(/s$/, "")));
    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
}
function normalizeMusicSource(provider, source) {
    if (!musicProvider(provider)) throw Error("Choose a supported music source.");
    if (provider === "local") {
        const path = text(source);
        if (!path || path.includes("\0") || /^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) throw Error("Choose a local audio file.");
        const extension = nodePath.extname(path).slice(1).toLowerCase();
        if (!LOCAL_AUDIO_EXTENSIONS.includes(extension)) throw Error("Choose an MP3, WAV, OGG, M4A, AAC, FLAC, Opus or WebM audio file.");
        if (!nodePath.isAbsolute(path) && !nodePath.win32.isAbsolute(path) && path.split(/[\\/]/).some(part => part === "..")) throw Error("Choose a local audio file.");
        return { source: path, sourceType: "file", metadata: { extension } };
    }
    const url = sourceUrl(source), host = url.hostname.toLowerCase();
    if (provider === "spotify") {
        if (host !== "open.spotify.com") throw Error("Use an open.spotify.com track, album, playlist or artist URL.");
        const parts = url.pathname.split("/").filter(Boolean);
        if (/^intl-[a-z-]+$/i.test(parts[0] ?? "")) parts.shift();
        if (parts[0] === "embed") parts.shift();
        const [sourceType, spotifyId] = parts;
        if (!["track", "album", "playlist", "artist"].includes(sourceType)) throw Error("Spotify supports track, album, playlist and artist links here.");
        if (parts.length !== 2 || !/^[a-zA-Z0-9]{22}$/.test(spotifyId ?? "")) throw Error("Enter a complete Spotify URL.");
        return { source: `https://open.spotify.com/${sourceType}/${spotifyId}`, sourceType,
            metadata: { spotifyId, uri: `spotify:${sourceType}:${spotifyId}` } };
    }
    const music = provider === "youtube-music";
    if (music ? host !== "music.youtube.com" : !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
        throw Error(music ? "Use a music.youtube.com song or playlist URL." : "Use a YouTube video or playlist URL.");
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (music && parts.length === 2 && parts[0] === "browse" && /^MPRE[a-zA-Z0-9_-]{4,146}$/.test(parts[1])) {
        return { source: `https://music.youtube.com/browse/${parts[1]}`, sourceType: "album", metadata: { browseId: parts[1] } };
    }
    let videoId = "", playlistId = url.searchParams.get("list") || "";
    if (["youtu.be", "www.youtu.be"].includes(host) && parts.length === 1) videoId = parts[0];
    else if (parts.length === 1 && parts[0] === "watch") videoId = url.searchParams.get("v") || "";
    else if (!music && parts.length === 2 && ["shorts", "live", "embed", "v"].includes(parts[0]) && parts[1] !== "videoseries") videoId = parts[1];
    else if (!(parts.length === 1 && parts[0] === "playlist") && !(parts.length === 2 && parts[0] === "embed" && parts[1] === "videoseries" && !music)) {
        throw Error(music ? "Use a YouTube Music song, album or playlist URL." : "Use a YouTube video or playlist URL.");
    }
    if (videoId && !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) throw Error("The YouTube video URL is incomplete.");
    if (playlistId && !/^[a-zA-Z0-9_-]{10,150}$/.test(playlistId)) throw Error("The YouTube playlist URL is incomplete.");
    if (!videoId && !playlistId) throw Error("The URL needs a video or playlist ID.");
    const canonical = new URL(`https://${music ? "music.youtube.com" : "www.youtube.com"}/${videoId ? "watch" : "playlist"}`);
    if (videoId) canonical.searchParams.set("v", videoId);
    if (playlistId) canonical.searchParams.set("list", playlistId);
    const seconds = startSeconds(url.searchParams.get("t") ?? url.searchParams.get("start") ?? url.hash.match(/^#t=(.*)$/)?.[1]);
    if (seconds) canonical.searchParams.set("t", String(seconds));
    const metadata = { ...(videoId ? { videoId } : {}), ...(playlistId ? { playlistId } : {}), ...(seconds ? { startSeconds: seconds } : {}) };
    return { source: canonical.href, sourceType: playlistId ? "playlist" : "video", metadata,
        ...(videoId ? { artwork: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` } : {}) };
}
function musicDisplayName(item) {
    if (item.provider === "local") return String(item.source ?? "").split(/[\\/]/).pop().replace(/\.[^.]+$/, "") || "Local audio";
    const name = musicProvider(item.provider)?.name || "Music";
    const type = item.sourceType || "music", id = item.metadata?.spotifyId || item.metadata?.videoId || item.metadata?.playlistId || item.metadata?.browseId || "";
    return `${name} ${type}${id ? " · " + id : ""}`;
}
function createMusicItem(values, id = randomUUID()) {
    const normalized = normalizeMusicSource(values.provider, values.source);
    return { id, provider: values.provider, ...normalized, name: text(values.name) || musicDisplayName({ provider: values.provider, ...normalized }),
        enabled: values.enabled !== false };
}
module.exports = { MUSIC_VERSION, MUSIC_PROVIDERS, LOCAL_AUDIO_EXTENSIONS, musicProvider, musicDefaults,
    normalizeMusicConfig, normalizeMusicSource, musicDisplayName, createMusicItem, safeArtwork };
