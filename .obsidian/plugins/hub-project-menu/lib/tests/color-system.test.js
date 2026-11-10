"use strict";
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../.."),colors=require("../ui/color-system");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8"),contract=css.slice(0,css.indexOf("/* END ITACAN DEFAULT COLOR CONTRACT */"));
// Color-name replacement must never corrupt layout identifiers such as white-space.
for(const file of ['styles.css','lib/ui/oath-dock/dock.css','../../../System/Dashboards/Home/view.css','../../../System/Dashboards/Project/view.css']) {
 const source=fs.readFileSync(path.resolve(root,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 for(const block of source.matchAll(/[^{}]+\{([^{}]*)\}/g))for(const declaration of block[1].split(';')) {
  if(!declaration.trim())continue;
  const name=declaration.split(':')[0].trim();assert(/^[-\w]+$/.test(name),'Invalid CSS property in '+file+': '+name);
 }
}
const definitions=new Map([...contract.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map(m=>[m[1],m[2]]));
for(const name of colors.NATIVE_COLOR_PROPERTIES)assert(definitions.has(name),"Missing owned native alias "+name);
// These are demonstrated native consumers, not an arbitrary alias-count target.
const addedNativeRoles={
 "--dropdown-background":"--hub-color-surface-button",
 "--dropdown-background-hover":"--hub-color-surface-button-hover",
 "--input-date-separator":"--hub-color-text-muted",
 "--blockquote-border-color":"--hub-color-accent",
 "--hr-color":"--hub-color-border",
 "--code-border-color":"--hub-color-border"
};
for(const [native,role]of Object.entries(addedNativeRoles)) {
 assert(colors.NATIVE_COLOR_PROPERTIES.includes(native),'Host island must restore '+native);
 assert.equal(definitions.get(native),'var('+role+')','Native dependency mapping '+native);
}
assert(!definitions.get('--hub-color-accent-text').includes('--hub-color-accent-hover'),'Text must not depend on hover fill');
assert(!definitions.get('--hub-color-series-step-completion').includes('--hub-color-activity-edited'),'Step completion must not depend on edited activity');
assert.equal(definitions.get('--checkbox-marker-color'),'var(--hub-color-checkbox-marker)');
assert.equal(definitions.get('--text-success'),'var(--hub-color-success)');
const visiting=new Set(),done=new Set();function visit(name){if(done.has(name))return;assert(!visiting.has(name),"Circular color alias "+name);visiting.add(name);for(const m of (definitions.get(name)||"").matchAll(/var\((--[\w-]+)/g)){assert(definitions.has(m[1]),"Inherited dependency "+name+" -> "+m[1]);visit(m[1])}visiting.delete(name);done.add(name)}
// Mode-specific repeats in the final Light block are leaves, and do not affect closure.
for(const name of definitions.keys())visit(name);
const files=[path.join(root,"plugin.js")];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==="oath-dock")continue;const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.js')&&!e.name.includes('-DESKTOP-'))files.push(f)}}for(const name of ['ui','services','domain','music'])walk(path.join(root,'lib',name));
const entries=[];for(const f of files){const source=fs.readFileSync(f,'utf8');for(const m of source.matchAll(/\bnew\s+(?:Menu|Notice)\s*\(/g)){const kind=m[0].includes('Menu')?'Menu':'Notice';assert(source.slice(Math.max(0,m.index-40),m.index).trimEnd().endsWith('own'+kind+'Colors('),'Unowned '+kind+' in '+f);entries.push({file:path.relative(root,f).split(path.sep).join('/'),kind,line:source.slice(0,m.index).split('\n').length})}if(/extends\s+(?:Modal|FuzzySuggestModal)/.test(source)){for(const m of source.matchAll(/onOpen\(\)\s*\{/g))assert(source.slice(m.index,m.index+100).includes('ownModalColors(this)'),'Unowned modal entry '+f)}}
assert(css.includes('body.theme-dark :where(.hub-color-scope)'),'Dark ownership gate');assert(!contract.includes('.hub-button-scope'),'Styling class must not confer ownership');
assert(css.includes('button.mod-warning:not(.hub-color-host-island, .hub-color-host-island *)'),'Destructive consumer must stop at host islands');
const appearance=fs.readFileSync(path.join(root,'lib/ui/settings-pages.js'),'utf8');assert(appearance.includes('disabled: ""')&&appearance.includes('aria-disabled'), 'Unrelated Appearance previews remain disabled');
const athena=fs.readFileSync(path.join(root,'lib/athena/src/integration.ts'),'utf8');assert.equal((athena.match(/options\.ownColors\?\./g)||[]).length,2,'Athena sidebar and source modal are owned');
// Active numeric literals outside the contract must be documented compatibility
// fallbacks, not a new component-local color authority. Excluded blocks are skipped.
let literals=0;for(const m of css.slice(contract.length).matchAll(/([^{}]+)\{([^{}]*)\}/g)){if(/atlas/i.test(m[1])||/atlas/i.test(m[2]))continue;for(const v of m[2].matchAll(/var\((--hub-(?:palette-|color-)[\w-]+)/g))assert(definitions.has(v[1]),'Unknown owned color token '+v[1]);for(const line of m[2].replace(/\/\*[\s\S]*?\*\//g,'').split('\n'))if(/#[\da-f]{3,8}\b|rgba?\([\d\s,.]+\)|(?<![-\w])(?:black|white|red|blue|green|yellow|orange|purple|gray|grey|cyan|magenta|lime)(?![-\w])/i.test(line)){assert(line.includes('var(--hub-'),'Unowned CSS literal: '+line.trim());literals++}}
const jsCompatibility={'lib/ui/progress-colors.js':['#0dc94f'],'lib/ui/attention.js':['#1e1e1e'],'lib/ui/settings-pages.js':['#8b5cf6','#528dd7','#549d7a','#bb914a','#90949c']};
for(const f of files){const rel=path.relative(root,f).split(path.sep).join('/');if(rel==='lib/ui/color-palettes.js')continue;const source=fs.readFileSync(f,'utf8');for(const value of source.match(/#[0-9a-f]{3,8}\b/gi)||[])assert(jsCompatibility[rel]?.includes(value.toLowerCase()),'New component-local JS color '+rel+' '+value)}
console.log('PASS color source boundaries:',colors.NATIVE_COLOR_PROPERTIES.length,'native aliases,',entries.length,'owned native popups, acyclic token closure, unrelated previews disabled, scoped compatibility literals:',literals);

// Original goldens are immutable; only reviewed Stage 2 paths may override them.
const stage2=require('./color-stage2-checks'),patches=JSON.parse(fs.readFileSync(path.join(__dirname,'color-stage2-expectations.json'),'utf8'));
for(const [file,hash]of Object.entries(patches.baselineHashes))assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex'),hash,'Original baseline changed: '+file);
for(const [kind,changes]of Object.entries(patches.changes))for(const change of changes){assert(stage2.isApprovedStage2Change(kind,change.path),'Unapproved Stage 2 delta '+kind+' '+change.path);if(kind==='native'){const control=JSON.parse(fs.readFileSync(path.join(__dirname,'color-native-baseline.json'),'utf8')).controls[change.path[0]];assert(control.tag==='BUTTON'&&control.cls==='mod-cta','Only native primary fills may change');}}
assert(definitions.has('--hub-color-primary-action-background')&&definitions.has('--hub-color-primary-action-background-hover')&&definitions.has('--hub-color-primary-action-text')&&definitions.has('--hub-color-focus-ring'));
assert.equal(colors.NATIVE_COLOR_PROPERTIES.length,158,'Stage 2 does not expand native aliases');
console.log('PASS immutable baseline hashes and restricted Stage 2 deltas');

const registry=require('../ui/color-palettes');
for(const palette of registry.PALETTES){registry.validatePalette(palette);for(const name of Object.keys({...palette.accent,...palette.coordinated}))assert(definitions.has(name),'Palette bypasses existing contract '+name);}
const controls=fs.readFileSync(path.join(root,'lib/ui/appearance-controls.js'),'utf8');
assert(controls.includes('role:"radiogroup"')&&controls.includes('role:"switch"')&&controls.includes('service.set('));
assert(controls.includes('classList.contains("theme-dark")'),'Palette UI must gate on host Dark');
assert(controls.includes('disabled:""')&&controls.includes('Custom colors are not available yet'),'Custom picker stays disabled');
console.log('PASS registry is restricted to owned tokens and only intended Appearance controls activate');
