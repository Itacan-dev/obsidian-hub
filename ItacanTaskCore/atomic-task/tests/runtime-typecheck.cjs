"use strict";
const path=require("node:path"),ts=require(process.argv[2]||"typescript"),p=ts.createProgram([path.join(__dirname,"runtime-types.fixture.ts")],{noEmit:true,strict:true,skipLibCheck:false,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.Node16,moduleResolution:ts.ModuleResolutionKind.Node16,types:[]}),d=ts.getPreEmitDiagnostics(p);
for(const e of d)process.stderr.write(ts.flattenDiagnosticMessageText(e.messageText,"\n")+"\n");process.stdout.write(`N3-B2-B TypeScript ${ts.version}: ${d.length} diagnostics\n`);process.exitCode=d.length?1:0;
