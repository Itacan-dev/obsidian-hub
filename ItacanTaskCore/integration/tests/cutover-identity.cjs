"use strict";
// Read only from the copied local-storage database in the owned Temp profile.
module.exports = async function () {
    const deviceId = globalThis.localStorage.getItem("obsidian-hub::device-id");
    if (typeof deviceId !== "string" || !deviceId.trim()) throw Error("Existing local device identity unavailable; do not allocate a replacement.");
    return { checks: ["existing localStorage device identity read from verified Temp snapshot; original profile unchanged"], deviceId, snapshotOnly: true };
};
