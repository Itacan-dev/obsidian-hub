"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "hub-music-runtime-"));
const plugin = path.resolve(__dirname, "../.."), vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
const copiedPlugin = path.join(vault, ".obsidian/plugins/hub-project-menu");
fs.mkdirSync(copiedPlugin, { recursive: true }); fs.mkdirSync(profile, { recursive: true });
for (const name of ["main.js", "manifest.json", "styles.css", "atlas-native.cjs"]) fs.copyFileSync(path.join(plugin, name), path.join(copiedPlugin, name));
// Capture the exact public API provided by Obsidian's real plugin loader; the
// normal global Node require does not resolve the virtual `obsidian` module.
fs.appendFileSync(path.join(copiedPlugin, "main.js"), '\nmodule.exports.__musicRuntimeApi = require("obsidian");\n');
fs.cpSync(path.join(plugin, "lib"), path.join(copiedPlugin, "lib"), {
    recursive: true, filter: source => !source.includes(path.sep + "tests") && !source.includes(path.sep + "node_modules")
});
fs.writeFileSync(path.join(vault, "Home.md"), "# Music runtime fixture\nThis vault contains only synthetic test content.\n");
function silentWav(seconds = 10) {
    const count = 8000 * seconds, buffer = Buffer.alloc(44 + count * 2);
    buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36); buffer.writeUInt32LE(count * 2, 40); return buffer;
}
fs.writeFileSync(path.join(vault, "Fixture one.wav"), silentWav());
fs.writeFileSync(path.join(scratch, "Fixture two.wav"), silentWav());
fs.writeFileSync(path.join(vault, ".obsidian/community-plugins.json"), JSON.stringify(["hub-project-menu"]));
fs.writeFileSync(path.join(vault, ".obsidian/app.json"), JSON.stringify({ safeMode: false, showInlineTitle: true }));
fs.writeFileSync(path.join(vault, ".obsidian/appearance.json"), JSON.stringify({ theme: "obsidian", cssTheme: "", baseFontSize: 17, showRibbon: false, nativeMenus: false }));
fs.writeFileSync(path.join(profile, "obsidian.json"), JSON.stringify({ vaults: { musicruntime: { path: vault, ts: 1, open: true } }, cli: false, updateDisabled: true }));
const env = { ...process.env, HUB_MUSIC_RUNTIME_ROOT: scratch };
delete env.ELECTRON_RUN_AS_NODE;
const binary = path.join(plugin, "lib/atlas/tests/native/node_modules/electron/dist/electron.exe");
if (!fs.existsSync(binary)) throw Error("Existing native-test Electron is required; this runner does not install dependencies");
const child = spawn(binary, [path.join(__dirname, "music-obsidian-host.cjs")], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let completed = false;
child.stdout.on("data", data => { const text = data.toString(); process.stdout.write(text); completed ||= text.includes("PASS actual isolated Obsidian Music runtime"); });
child.stderr.on("data", data => process.stderr.write(data));
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("close", code => {
    const resolved = path.resolve(scratch);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("hub-music-runtime-")) throw Error("Unexpected Music runtime cleanup path");
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    process.exitCode = code === 0 && completed ? 0 : 1;
});
