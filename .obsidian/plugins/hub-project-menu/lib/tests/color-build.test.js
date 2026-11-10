"use strict";
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm');
const {buildItacan,factories}=require('../../build-itacan');
const root=path.resolve(__dirname,'../..'),baseline=process.argv[2]||path.join(root,'main.js'),output=fs.mkdtempSync(path.join(os.tmpdir(),'hub-palette-build-'));
const report=buildItacan({root,baseline,output});
const before=factories(fs.readFileSync(baseline,'utf8')),after=factories(fs.readFileSync(path.join(output,'main.js'),'utf8'));
for(const [id,text]of before)if(id.startsWith('lib/atlas/')||id.startsWith('lib/athena/')||id.startsWith('../'))assert.equal(after.get(id),text,'Opaque factory changed '+id);
const cache=new Map();function load(id){if(cache.has(id))return cache.get(id).exports;const m={exports:{}};cache.set(id,m);const fn=vm.runInNewContext('('+after.get(id)+')',{require,console,setTimeout,clearTimeout,queueMicrotask});fn(m,m.exports,load);return m.exports;}
assert.equal(JSON.stringify(load('lib/ui/color-palettes.js').PALETTES),JSON.stringify(require('../ui/color-palettes').PALETTES));
assert.equal(typeof load('lib/services/appearance.js').AppearanceService,'function');
const manifest=JSON.parse(fs.readFileSync(path.join(output,'strict-oath-assets.json')));assert(manifest.files['lib/domain/oath-dock-colors.js']);
for(const [file,hash]of Object.entries(manifest.files))assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(path.join(output,file))).digest('hex'),hash);
console.log('PASS staged bundle loads new registry/service, retains every excluded/opaque factory byte-for-byte and verifies complete dock manifest',report);
