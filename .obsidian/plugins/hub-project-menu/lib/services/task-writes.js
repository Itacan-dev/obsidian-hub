"use strict";

// Source attribution, not filenames or modification times. Keep the written
// value to recognize delayed editor notifications after vault.process resolves.
const writes = new WeakMap();
async function processTaskWrite(plugin, file, transform) {
    let files = writes.get(plugin);
    if (!files) writes.set(plugin, files = new WeakMap());
    const previous = files.get(file), write = { pending: true };
    files.set(file, write);
    try {
        return await plugin.app.vault.process(file, content => {
            write.content = transform(content);
            return write.content;
        });
    } catch (error) {
        if (previous) files.set(file, previous); else files.delete(file);
        throw error;
    } finally { write.pending = false; }
}
function isTaskWrite(plugin, file, editor) {
    const files = writes.get(plugin), write = files?.get(file);
    if (!write) return false;
    if (write.pending || editor?.getValue?.() === write.content) return true;
    files.delete(file);
    return false;
}
module.exports = { processTaskWrite, isTaskWrite };
