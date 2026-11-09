"use strict";
function isApprovedStage2Change(kind,path) {
 const [state,id,property]=path,dark=String(state).startsWith('dark');
 if(kind==='default')return dark&&id==='cta'&&property==='background';
 if(kind==='native')return Number.isInteger(state)&&id==='background'&&path.length===2;
 const metadata=kind==='consistency'?['home-history-location']:['home-history','week-range','appearance-note'];
 if(metadata.includes(id)&&['color','border','outline'].includes(property))return true;
 if(!dark)return false;
 if(kind==='consistency')return ['ordinary-action','task-action','inbox-action'].includes(id)&&property==='background';
 if(kind==='stage2'){
  if((String(id).startsWith('primary-')||id==='disabled-primary')&&property==='background')return true;
  if(id==='wrapper')return state==='dark-keyboard-focus-wrapped-select'&&property==='outline';
  if(state==='dark-keyboard-'+id&&String(id).startsWith('focus-'))return ['outline','outlineWidth','outlineStyle','outlineOffset'].includes(property)||(id==='focus-athena-checkbox'&&property==='shadow');
 }
 return false;
}
function applyApprovedStage2Changes(original,kind,patches) {
 const value=JSON.parse(JSON.stringify(original));
 for(const change of patches.changes[kind]||[]){if(!isApprovedStage2Change(kind,change.path))throw Error('Unapproved Stage 2 change '+kind+' '+change.path);let target=value;for(const key of change.path.slice(0,-1)){if(!Object.hasOwn(target,key))throw Error('Missing baseline path '+change.path);target=target[key]}
  const key=change.path.at(-1);if(target[key]!==change.before)throw Error('Stage 2 baseline predecessor changed: '+kind+' '+change.path.join('.'));target[key]=change.after;
 }
 return value;
}
function createStage2Gallery(doc){const root=doc.createElement('div');root.className='hub-button-scope';root.id='stage2';
 root.innerHTML=`<h2>Stage 2 ? restrained primary actions</h2><section id="actions"></section>
 <section><div class="hub-oath-actions"><button class="mod-cta" data-s="oath">Take the Oath</button></div><div class="hub-capture-content"><button class="mod-warning" data-s="danger">Delete</button></div><div class="hub-option-group"><button class="is-selected" data-s="selected">Selected option</button></div><button class="mod-cta" disabled data-s="disabled-primary">Unavailable</button><a href="#" data-s="link">Accent text link</a></section>
 <section class="home-panel"><div class="home-completed-task-row"><span class="home-recent-type" data-s="home-history">Project name ? Home History</span></div><span class="project-activity-location" data-s="project-history">Project name ? Workspace History</span><span class="home-calendar-week-range" data-s="week-range">November 2?8</span><p class="hub-settings-preview-note" data-s="appearance-note">Preview only. Controls are not active yet.</p><span class="home-calendar-day-empty" data-s="faint-empty">No events</span><span class="hub-task-steps-chevron" style="color:var(--text-faint)" data-s="faint-decoration">?</span></section>
 <section id="focus-grid"><div class="hub-capture-actions"><button data-s="focus-cancel">Cancel</button></div><div class="hub-capture-form-scope hub-button-scope"><input type="text" placeholder="Search or title" data-s="focus-input"><select data-s="focus-select"><option>Workspace</option></select><div class="hub-task-select-control"><select data-s="focus-wrapped-select"><option>Project phase</option></select></div><button class="hub-task-location-trigger" data-s="focus-trigger">Choose location</button></div><button class="hub-task-location-entry" data-s="focus-location">Task location</button><div class="hub-task-location-dialog"><nav class="hub-task-location-breadcrumbs"><button data-s="focus-crumb">Folder</button></nav></div><button class="home-nav-button" data-s="focus-home">Home</button><button class="project-nav-button" data-s="focus-project">Work</button><button class="hub-settings-category" data-s="focus-settings">Appearance</button><div class="hub-presets-menu"><div class="menu-item" tabindex="0" role="menuitem" data-s="focus-menu">Preset</div></div><div class="hub-athena"><input type="checkbox" data-s="focus-athena-checkbox"></div></section>`;
 const contexts={quick:'hub-capture-actions',task:'hub-task-dialog-actions',location:'hub-task-dialog-actions',inbox:'hub-inbox-action-footer',brief:'',music:'hub-capture-actions',planning:'hub-task-popover-actions',preset:'hub-capture-actions',recovery:''};
 for(const [name,cls]of Object.entries(contexts)){const group=doc.createElement('div');group.className=cls;const button=doc.createElement('button');button.className='mod-cta'+(name==='inbox'?' hub-guided-submit':name==='brief'?' hub-brief-primary':'');button.dataset.s='primary-'+name;button.innerHTML='<svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10M7 2v10" stroke="currentColor" fill="none"/></svg><span>'+name+'</span>';if(name==='inbox')button.querySelector('svg').classList.add('hub-inbox-submit-arrow');group.append(button);root.querySelector('#actions').append(group)}
 return root;
}
function stage2Snapshot(root){const out={};for(const e of root.querySelectorAll('[data-s]')){const c=root.ownerDocument.defaultView.getComputedStyle(e),r=e.getBoundingClientRect();out[e.dataset.s]={color:c.color,background:c.backgroundColor,border:c.borderColor,shadow:c.boxShadow,outline:c.outlineColor,outlineWidth:c.outlineWidth,outlineStyle:c.outlineStyle,outlineOffset:c.outlineOffset,opacity:c.opacity,width:r.width,height:r.height,font:c.font,padding:c.padding,margin:c.margin,icon:e.querySelector('path')?root.ownerDocument.defaultView.getComputedStyle(e.querySelector('path')).stroke:null};}return out;}
function relativeLuminance(color){const parts=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return parts.reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0)}
function contrast(a,b){const values=[relativeLuminance(a),relativeLuminance(b)].sort((a,b)=>a-b);return(values[1]+.05)/(values[0]+.05)}
function checkPrimaryPair(normal,hover){if(relativeLuminance(hover.background)<=relativeLuminance(normal.background))throw Error('Primary hover must brighten');if(contrast(normal.color,normal.background)<4.5||contrast(hover.color,hover.background)<4.5)throw Error('Primary text contrast below 4.5');if(normal.color!==hover.color||normal.icon!==hover.icon)throw Error('Primary foreground switched on hover');if(normal.icon&&contrast(normal.icon,normal.background)<4.5)throw Error('Primary icon contrast');}
module.exports={isApprovedStage2Change,applyApprovedStage2Changes,createStage2Gallery,stage2Snapshot,contrast,checkPrimaryPair};
