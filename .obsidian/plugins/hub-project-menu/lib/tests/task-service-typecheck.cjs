"use strict";
const path = require("node:path");
let ts;
try { ts = require(process.argv[2] || "typescript"); }
catch (_) { process.stderr.write("Supply an existing TypeScript compiler; no installation is performed.\n"); process.exit(1); }
const program = ts.createProgram([path.join(__dirname, "task-service-types.fixture.ts")], {
    noEmit: true, strict: true, skipLibCheck: false, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16, types: []
});
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const item of diagnostics) process.stderr.write(ts.flattenDiagnosticMessageText(item.messageText, "\n") + "\n");
process.stdout.write(`TypeScript ${ts.version}: ${diagnostics.length} diagnostics\n`);
process.exitCode = diagnostics.length ? 1 : 0;
