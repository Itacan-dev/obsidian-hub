"use strict";
const path=require("node:path"),ts=require(process.argv[2]||"C:/Users/El_Baraka 2025/AppData/Local/Programs/Microsoft VS Code/6d62b1d5da/resources/app/extensions/node_modules/typescript/lib/typescript.js");
const p=ts.createProgram([path.join(__dirname,"request-recovery-types.fixture.ts")],{strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,ignoreDeprecations:"6.0",skipLibCheck:false,lib:["lib.es2022.d.ts","lib.dom.d.ts"]}),d=ts.getPreEmitDiagnostics(p);
for(const x of d)process.stderr.write(ts.flattenDiagnosticMessageText(x.messageText,"\n")+"\n");process.stdout.write("Request recovery TypeScript "+ts.version+": "+d.length+" diagnostics\n");process.exitCode=d.length?1:0;
