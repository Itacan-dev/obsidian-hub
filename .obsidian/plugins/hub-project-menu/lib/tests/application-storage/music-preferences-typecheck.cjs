"use strict";
const path = require("node:path"), ts = require(process.argv[2] || "typescript");
const program = ts.createProgram([path.join(__dirname, "music-preferences-types.fixture.ts")], { noEmit: true, strict: true, skipLibCheck: false, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.Node16, moduleResolution: ts.ModuleResolutionKind.Node16, types: [] });
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const diagnostic of diagnostics) process.stderr.write(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n") + "\n");
process.stdout.write(`C1-B1 TypeScript ${ts.version}: ${diagnostics.length} diagnostics\n`); process.exitCode = diagnostics.length ? 1 : 0;
