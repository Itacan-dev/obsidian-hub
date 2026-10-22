"use strict";
const path=require("node:path"),ts=require(process.argv[2]);
const program=ts.createProgram([path.join(__dirname,"native-cutover-types.fixture.ts")],{strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,ignoreDeprecations:"6.0",skipLibCheck:false,lib:["lib.es2022.d.ts","lib.dom.d.ts"]});
const diagnostics=ts.getPreEmitDiagnostics(program);for(const d of diagnostics)process.stderr.write(ts.flattenDiagnosticMessageText(d.messageText,"\n")+"\n");process.stdout.write("Cutover preparation TypeScript "+ts.version+": "+diagnostics.length+" diagnostics\n");process.exitCode=diagnostics.length?1:0;
