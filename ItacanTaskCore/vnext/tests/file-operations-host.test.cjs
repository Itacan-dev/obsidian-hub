"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),vm=require('node:vm'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto'),{TaskEngine}=require('../engine.cjs');
test('one shared vault host admits one filesystem actor across windows and shares only its internal clipboard',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-file-host-')),file=path.join(root,'tasks.sqlite'),engine=new TaskEngine(file),handlers=new Map(),windows=new Map();
 for(const id of[1,2]){const w=new EventEmitter();Object.assign(w,{id,isDestroyed:()=>false,webContents:Object.assign(new EventEmitter(),{send(){}})});windows.set(id,w);}
 const app=new EventEmitter();app.isReady=()=>true;const module={exports:{}};
 const child=new EventEmitter(),client={ready:Promise.resolve(),subscribe:(...args)=>engine.subscribe(...args),call:(method,...args)=>engine[method](...args),async close(){await engine.close();this.exited=true;child.emit('exit',0);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../host/main.cjs'),'utf8'),{module,process,setTimeout,console,require(name){if(name==='node:path')return path;if(name==='electron')return{ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:name=>handlers.delete(name)},utilityProcess:{fork(){}},BrowserWindow:{fromId:id=>windows.get(id)},app};if(name==='./electron.cjs')return{openTaskService:()=>({child,client})};throw Error(name);}});
 const a=module.exports.attach(1,file),b=module.exports.attach(2,file);
 const call=(binding,id,method,...args)=>handlers.get(binding.channel)({sender:windows.get(id).webContents},{method,args});
 t.after(async()=>{await call(a,1,'close');await call(b,2,'close');});
 assert((await call(a,1,'fileOperation',{action:'acquire'})).result);
 assert.equal((await call(b,2,'fileOperation',{action:'acquire'})).error.code,'FILE_OPERATION_BUSY');
 const clipboard={id:randomUUID(),cut:true,paths:['Synthetic/One.md']};await call(a,1,'fileOperation',{action:'clipboardSet',value:clipboard});assert.deepEqual((await call(b,2,'fileOperation',{action:'clipboardGet'})).result,clipboard);
 const operationId=randomUUID(),intent={kind:'copy',requestHash:'a'.repeat(64),mappings:[],from:'Synthetic/A',to:'Synthetic/B'};
 await call(a,1,'fileOperation',{action:'prepare',operationId,intent});
 assert.equal((await call(b,2,'fileOperation',{action:'cancel',operationId})).error.code,'FILE_OPERATION_BUSY');
 await call(a,1,'fileOperation',{action:'release'});assert((await call(b,2,'fileOperation',{action:'acquire'})).result);
 assert.equal((await call(b,2,'fileOperation',{action:'list'})).result.length,1);assert((await call(b,2,'fileOperation',{action:'cancel',operationId})).result.cancelled);await call(b,2,'fileOperation',{action:'release'});
});
