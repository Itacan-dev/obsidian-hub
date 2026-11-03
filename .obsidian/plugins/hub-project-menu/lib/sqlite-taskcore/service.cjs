"use strict";
// Process entry point; no Electron, Obsidian or old TaskCore dependencies.
const {TaskEngine}=require('./engine.cjs'),path=require('node:path');
const send=process.parentPort?value=>process.parentPort.postMessage(value):value=>process.send(value);
const listen=fn=>process.parentPort?process.parentPort.on('message',e=>fn(e.data)):process.on('message',fn);
const file=process.env.ITACAN_VNEXT_DB;if(!file||!path.isAbsolute(file))throw Error('Explicit local database required');
const fault=process.env.ITACAN_VNEXT_TEST_BOUNDARY;let armed=false;
const engine=new TaskEngine(file,{busyTimeout:250,testBoundary:fault?(stage,operationId)=>{if(armed&&stage===fault){send({event:'test-boundary',stage,operationId});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}}:null});
const methods=new Set(['execute','getTask','listOwners','listTasks','readHistory','readStatistics','getOperation','readOutbox','getCursor','checkpoint']);
engine.subscribe({},change=>send({event:'change',change}));
listen(async message=>{const {requestId,method,args=[]}=message??{};try{if(!Number.isSafeInteger(requestId)||requestId<1||!Array.isArray(args))throw Error('Invalid RPC request');if(method==='test.arm'&&fault){armed=true;send({requestId,result:true});return;}if(method==='close'){await engine.close();send({requestId,result:true});setTimeout(()=>process.exit(0),20);return;}if(!methods.has(method))throw Error('Unsupported service method');const result=await engine[method](...args);send({requestId,result});}catch(error){send({requestId,error:{code:error.code??'INVALID_REQUEST',message:error.message}});}});
send({event:'ready',versions:process.versions});
