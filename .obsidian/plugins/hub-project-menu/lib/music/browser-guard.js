"use strict";

function configuredMusicDestination(source, destination) {
    let configured, target;
    try { configured = new URL(source); target = new URL(destination); } catch (_) { return false; }
    if (target.protocol !== "https:" || target.hostname !== "music.youtube.com" || target.port || target.username || target.password) return false;
    if (target.searchParams.getAll("v").length > 1 || target.searchParams.getAll("list").length > 1) return false;
    const playlist = configured.searchParams.get("list"), video = configured.searchParams.get("v");
    if (playlist) return ["/watch", "/playlist"].includes(target.pathname) && target.searchParams.getAll("list").length === 1
        && target.searchParams.get("list") === playlist;
    // The service can add queue/radio context around the same saved song. Its
    // video identity must stay exact; a different song still closes the guest.
    if (video) return target.pathname === "/watch" && target.searchParams.getAll("v").length === 1 && target.searchParams.get("v") === video;
    if (/^\/browse\/MPRE[a-zA-Z0-9_-]+$/.test(configured.pathname) && target.pathname === configured.pathname) {
        return [...target.searchParams].every(([key, value]) => ["cbrd", "hl", "gl"].includes(key) || configured.searchParams.get(key) === value);
    }
    return target.pathname === configured.pathname && target.search === configured.search;
}

function configuredConsentDestination(source, destination) {
    let target;
    try { target = new URL(destination); } catch (_) { return false; }
    if (target.protocol !== "https:" || target.hostname !== "consent.youtube.com" || target.port || target.username || target.password
        || !["/m", "/ml"].includes(target.pathname) || target.searchParams.getAll("continue").length !== 1) return false;
    return configuredMusicDestination(source, target.searchParams.get("continue"));
}

function consentSubmission(source, destination) {
    let target;
    try { target = new URL(destination); } catch (_) { return false; }
    if (target.protocol !== "https:" || target.hostname !== "consent.youtube.com" || target.port || target.username || target.password
        || target.pathname !== "/save") return false;
    const returns = target.searchParams.getAll("continue");
    return returns.length === 0 || returns.length === 1 && configuredMusicDestination(source, returns[0]);
}

// Loaded with the same MAIN-process remote.require mechanism as atlas-native.
// It adds a configured-content fence to an already Atlas-protected guest. It
// never creates a browser/session, changes Atlas policy or grants access.
function constrainMusicGuest(nativeId, partition, source, onBlocked) {
    const { webContents, session } = require("electron"), contents = webContents.fromId(nativeId);
    if (!contents || contents.isDestroyed() || contents.getType() !== "webview" || contents.session !== session.fromPartition(partition)
        || !configuredMusicDestination(source, source)) throw new Error("The protected Music browser is unavailable.");
    let stopped = false, consentLoaded = false;
    const permitted = destination => configuredMusicDestination(source, destination) || configuredConsentDestination(source, destination)
        || consentLoaded && consentSubmission(source, destination);
    const close = () => { if (!contents.isDestroyed()) { contents.stop(); contents.close({ waitForBeforeUnload: false }); } };
    const block = () => {
        if (stopped) return; stopped = true; close();
        try { onBlocked?.(); } catch (_) { /* A closed renderer cannot receive status. */ }
    };
    const navigate = (event, legacyURL, _inPlace, legacyMain) => {
        if ((event.isMainFrame ?? legacyMain ?? true) && !permitted(event.url ?? legacyURL)) {
            event.preventDefault(); block();
        }
    };
    const inPage = (event, url, isMainFrame) => {
        if (!isMainFrame) return;
        if (!permitted(url)) { block(); return; }
        // Obsidian can report the initial consent document as an in-page
        // arrival. Arm its form only after this same validated main-frame event.
        arrived(event, url);
    };
    const arrived = (_event, url) => {
        // The actual service can require regional cookie consent. Its initial
        // screen must bind its return URL to the saved content. Atlas must
        // independently permit consent.youtube.com; this fence grants nothing.
        // Only after that screen loads may its own /save consent form submit. Every departure
        // still passes the content fence AND Atlas's unchanged native policy.
        if (configuredConsentDestination(source, url)) consentLoaded = true;
        else if (configuredMusicDestination(source, url)) consentLoaded = false;
    };
    // Atlas already installs an immutable deny handler for its guests. State
    // the Music requirement here too; no service link can open another player.
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-frame-navigate", navigate);
    contents.on("will-redirect", navigate);
    contents.on("did-navigate", arrived);
    // History API routing has no preventable will-navigate event in Electron.
    // Close the service immediately if it routes into discovery/search.
    contents.on("did-navigate-in-page", inPage);
    return { destroy() {
        stopped = true; close();
        contents.removeListener("will-frame-navigate", navigate); contents.removeListener("will-redirect", navigate);
        contents.removeListener("did-navigate-in-page", inPage); contents.removeListener("did-navigate", arrived);
    } };
}

module.exports = { constrainMusicGuest, configuredMusicDestination, configuredConsentDestination };
