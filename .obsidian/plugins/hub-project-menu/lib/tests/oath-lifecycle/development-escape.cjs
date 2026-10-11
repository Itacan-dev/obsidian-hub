"use strict";
// Test entrypoint only. Never imported by a production source or bundle.
function installEscape(win, release, onEscape) {
    let running = null;
    const escape = reason => running ??= Promise.resolve().then(release).then(() => onEscape(reason));
    const input = (event, key) => {
        if (key.type === "keyDown" && key.key === "F12" && key.control && key.alt && key.shift) {
            event.preventDefault(); void escape("development-shortcut");
        }
    };
    win.webContents.on("before-input-event", input);
    const watchdog = setTimeout(() => void escape("development-watchdog"), 45000);
    return { get pending() { return running; }, dispose() { clearTimeout(watchdog); win.webContents.removeListener("before-input-event", input); } };
}
module.exports = { installEscape };
