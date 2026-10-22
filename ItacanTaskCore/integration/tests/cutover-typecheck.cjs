"use strict";
const path = require("node:path"), ts = require(process.argv[2] || "C:/Users/El_Baraka 2025/AppData/Local/Programs/Microsoft VS Code/6d62b1d5da/resources/app/extensions/node_modules/typescript/lib/typescript.js");
const program = ts.createProgram([path.join(__dirname, "cutover-types.fixture.ts")], { strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,ignoreDeprecations:"6.0",skipLibCheck:false,lib:["lib.es2022.d.ts","lib.dom.d.ts"] });
const diagnostics = ts.getPreEmitDiagnostics(program); for (const d of diagnostics) process.stderr.write(ts.flattenDiagnosticMessageText(d.messageText, "\n") + "\n");
process.stdout.write("Controlled cutover TypeScript " + ts.version + ": " + diagnostics.length + " diagnostics\n"); process.exitCode = diagnostics.length ? 1 : 0;
