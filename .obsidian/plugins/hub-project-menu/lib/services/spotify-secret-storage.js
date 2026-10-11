"use strict";
// Adapted from caezium/obsidian-spotify-control src/secure-storage.ts (MIT).
// Copyright (c) 2026 caezium. Full notice: ../../THIRD-PARTY-NOTICES.md.
const { Buffer } = require("buffer");

function usable(storage) {
    try {
        return !!storage && typeof storage.encryptString === "function" && typeof storage.decryptString === "function" &&
            storage.isEncryptionAvailable() && storage.getSelectedStorageBackend?.() !== "basic_text";
    } catch (_) { return false; }
}

function findStorage(value) {
    for (const storage of [value?.safeStorage, value?.remote?.safeStorage, value]) if (usable(storage)) return storage;
    return null;
}

function desktopStorage() {
    // Atlas/Oath already use Obsidian's main-process Electron remote bridge.
    const exposed = findStorage(globalThis.window?.electron);
    if (exposed) return exposed;
    try { const storage = findStorage(require("electron")); if (storage) return storage; } catch (_) { /* Node tests/mobile. */ }
    try { return findStorage(require("@electron/remote")); } catch (_) { return null; }
}

class SpotifySecretStorage {
    constructor(storage) { this.storage = storage === undefined ? desktopStorage() : findStorage(storage); }
    get available() { return usable(this.storage); }
    encrypt(tokens) {
        if (!this.available) throw Error("Secure token storage is unavailable. Connect Spotify on an Obsidian desktop with OS keychain support.");
        // Deliberately no upstream plaintext fallback: auth cannot silently
        // become unprotected ordinary settings when an OS keychain fails.
        try { return this.storage.encryptString(JSON.stringify(tokens)).toString("base64"); }
        catch (_) { throw Error("Spotify credentials could not be saved securely. Try connecting again."); }
    }
    decrypt(ciphertext) {
        if (!ciphertext || !this.available) return null;
        try { return JSON.parse(this.storage.decryptString(Buffer.from(ciphertext, "base64"))); }
        catch (_) { return null; }
    }
}

module.exports = { SpotifySecretStorage };
