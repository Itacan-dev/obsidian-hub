"use strict";
// Offline read-only vault capture. This entry point never loads Obsidian or a native host.
const fs = require("node:fs/promises"), path = require("node:path");
const preparation = require("../../.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation");
async function main() {
    const args = process.argv.slice(2), options = {};
    while (args.length) { const key = args.shift(); if (!["--vault", "--archives-root"].includes(key) || !args.length) throw Error("Explicit --vault and --archives-root required"); options[key] = args.shift(); }
    if (!options["--vault"] || !options["--archives-root"]) throw Error("Explicit --vault and --archives-root required");
    const vaultRoot = await fs.realpath(options["--vault"]), registration = JSON.parse(await fs.readFile(path.join(process.env.APPDATA, "obsidian/obsidian.json"), "utf8"));
    const matches = Object.entries(registration.vaults ?? {}).filter(([, value]) => path.relative(path.resolve(value.path), vaultRoot) === "");
    if (matches.length !== 1) throw Error("Stable registered vault identity is unavailable");
    const result = await preparation.captureArchive({ vaultRoot, vaultId: matches[0][0], localDataRoot: process.env.LOCALAPPDATA, archivesRoot: options["--archives-root"] });
    const preflight = await preparation.cutoverPreflight({ archive: result.archive });
    // Bounded summary only; never print task bodies, descriptions or History.
    console.log(JSON.stringify({ archive: result.archive, verifiedBackups: result.manifest.sources.length, sourceChangesDuringCapture: result.manifest.sources.filter(s => !s.sourceUnchangedDuringCapture).length,
        candidates: result.manifest.candidates, resourceSources: result.manifest.sources.filter(s => s.owner?.type === "resource").length, unresolvedSources: result.manifest.sources.filter(s => !s.owner).map(s => ({ path: s.path, issues: s.issues })), preflight: { ...preflight, preview: undefined } }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error.code || "PREPARATION_FAILED"); process.exitCode = 1; });
