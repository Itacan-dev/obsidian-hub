"use strict";
// Small macOS launch boundary; Windows keeps its existing executable policy.
async function openMacShortcut(shortcut, { shell = globalThis.window?.electron?.shell ?? require('electron').shell, execFile = require('child_process').execFile } = {}) {
    if (shortcut.type === 'website') {
        if (typeof shell?.openExternal !== 'function') throw Error('External browser launching is unavailable in this Obsidian host.');
        return shell.openExternal(shortcut.url);
    }
    if (shortcut.id !== 'zotero' || shortcut.type !== 'application') throw Error('This application shortcut is unavailable on macOS.');
    return new Promise((resolve, reject) => {
        execFile('/usr/bin/open', ['-a', 'Zotero'], { timeout: 10000 }, error => {
            if (error) reject(Error('Could not open Zotero. Install Zotero in Applications and try again.'));
            else resolve();
        });
    });
}
module.exports = { openMacShortcut };
