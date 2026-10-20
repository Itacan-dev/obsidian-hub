"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");
const root = path.resolve(__dirname, ".."), plugin = path.resolve(root, "../..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "athena-obsidian-")), vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
const target = path.join(vault, ".obsidian/plugins/hub-project-menu");
fs.mkdirSync(target, { recursive: true }); fs.mkdirSync(profile, { recursive: true });
for (const name of ["main.js", "manifest.json", "styles.css", "atlas-native.cjs", "strict-oath-assets.json"]) fs.copyFileSync(path.join(plugin, name), path.join(target, name));
// Test-only state isolation and access to the real virtual Obsidian API.
const main = path.join(target, "main.js"), marker = ".installAthena(this, {", bundle = fs.readFileSync(main, "utf8");
if (!bundle.includes(marker)) throw Error("Athena integration is absent from the production bundle");
fs.writeFileSync(main, bundle.replace(marker, marker + " storeRoot: " + JSON.stringify(path.join(scratch, "device-state")) + ",") + '\nmodule.exports.__athenaRuntimeApi = require("obsidian");\n');
fs.cpSync(path.join(plugin, "lib"), path.join(target, "lib"), { recursive: true, filter: source => !["tests", "node_modules", ".cache"].some(name => source.split(path.sep).includes(name)) });
for (const directory of ["Unregistered", "Private", "Research", "Code"]) fs.mkdirSync(path.join(vault, directory));
fs.writeFileSync(path.join(vault, "Unregistered", "Lab.md"), "# Copper\nCopper calibration wavelength is 520 nanometers.\n<img src='https://invalid.example/leak'><script>globalThis.athenaInjected=true</script>\n```dataviewjs\nthrow Error('must never execute')\n```\n");
fs.writeFileSync(path.join(vault, "Private", "Restricted.md"), "Copper private secret fixture must never be read.");
fs.writeFileSync(path.join(vault, ".obsidian", "Protected.md"), "Copper protected configuration fixture must never be read.");
fs.writeFileSync(path.join(vault, "Code", "analysis.py"), "def cobalt_calibration():\n    return 613\n");
// Minimal one-page PDF; no external assets or user research documents.
function pdf() {
  const stream = "BT /F1 12 Tf 72 720 Td (Synthetic PDF copper calibration 520 nm) Tj ET";
  const appendix = "BT /F1 12 Tf 72 720 Td (Synthetic appendix wavelength is 721 nanometers) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>", `<< /Length ${appendix.length} >>\nstream\n${appendix}\nendstream`];
  let value = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((object, i) => { offsets.push(Buffer.byteLength(value)); value += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(value); return value + `xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
}
fs.writeFileSync(path.join(vault, "Research", "Paper.pdf"), pdf());
fs.writeFileSync(path.join(vault, ".obsidian", "community-plugins.json"), JSON.stringify(["hub-project-menu"]));
fs.writeFileSync(path.join(vault, ".obsidian", "app.json"), JSON.stringify({ safeMode: false }));
fs.writeFileSync(path.join(profile, "obsidian.json"), JSON.stringify({ vaults: { athenafixture: { path: vault, ts: 1, open: true } }, cli: false, updateDisabled: true }));
const env = { ...process.env, ATHENA_OBSIDIAN_ROOT: scratch }; delete env.ELECTRON_RUN_AS_NODE;
const electron = require(path.join(plugin, "lib/atlas/tests/native/node_modules/electron"));
let completed = false;
const child = spawn(electron, [path.join(__dirname, "obsidian-host.cjs")], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", data => { process.stdout.write(data); completed ||= data.toString().includes("PASS actual isolated Obsidian Athena"); });
child.stderr.on("data", data => process.stderr.write(data));
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("close", code => {
  const resolved = path.resolve(scratch);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("athena-obsidian-")) throw Error("Unexpected fixture cleanup path");
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); process.exitCode = code === 0 && completed ? 0 : 1;
});
