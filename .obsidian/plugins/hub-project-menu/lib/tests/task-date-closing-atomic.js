export async function run(edit) {
 let checks=0;
 const check=(v,m)=>{checks++;if(!v)throw Error(m)},frame=()=>new Promise(r=>requestAnimationFrame(r)),baseline=new URLSearchParams(location.search).get('home-source')==='baseline',layout=devicePixelRatio>1?'small-150':'desktop',mode=edit?'edit':'add',prefix='date-atomic-'+(baseline?'before':'after')+'-'+layout+'-'+mode,
 key=value=>new Promise(resolve=>{window.hubTestKeyDone=resolve;window.hubTestKeyRequest=value}),pointer=(target,action='click')=>new Promise(resolve=>{const b=target.getBoundingClientRect();window.hubTestPointerDone=resolve;window.hubTestPointerRequest={x:b.x+b.width/2,y:b.y+b.height/2,action}}),
 shot=name=>new Promise(resolve=>{window.hubTestScreenshotDone=resolve;window.hubTestScreenshotRequest=prefix+'-'+name}),traces=[];window.hubTaskOpeningFrames=traces;
 const blue=async(base64,rect)=>{const b=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),c=document.createElement('canvas');c.width=b.width;c.height=b.height;const ctx=c.getContext('2d');ctx.drawImage(b,0,0);b.close();const d=ctx.getImageData(Math.round(rect.x*devicePixelRatio),Math.round(rect.y*devicePixelRatio),Math.floor(rect.width*devicePixelRatio),Math.floor(rect.height*devicePixelRatio)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+2]>d[i]+30&&d[i+2]>d[i+1]+10)n++;return n;};
 try{
  const source=await(await fetch('task-opening.html')).text(),setup=source.slice(source.indexOf(' const source=await'),source.indexOf(' const originalRead=')),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,{service,openTaskCreator,openTaskEditor,p,contents,plugin}=await new AsyncFunction('check',setup+';return env;')(check);
  const made=edit?await service.create(p.root,'Atomic date closing',{}):null,targetTask=made?{path:made.path,line:made.line??1,text:'Atomic date closing'}:null,fingerprint=()=>JSON.stringify({contents:[...contents],data:plugin.projectWizard.data}),saved=fingerprint();
  let modal,f;
  const ensure=async()=>{if(!modal?.modalEl.isConnected){modal=edit?openTaskEditor(service,targetTask):openTaskCreator(service,{root:p.root});await modal.ready;f=modal.taskFields;f.input.value='Atomic date closing';f.input.dispatchEvent(new Event('input',{bubbles:true}));}};
  const routes=['heading','cancel','apply','importance','description','other','escape','steps','parent-cancel','close'];
  for(const name of ['start','due'])for(const configured of [false,true])for(const route of routes){
   await ensure();f.state.fromDate=configured?'2090-10-20':'';f.state.dueDate=configured?'2090-10-22':'';f.state.fromTime=f.state.dueTime='';f.refresh();
   const heading=modal.contentEl.querySelector('[data-task-property='+name+']');heading.click();
   const section=modal.contentEl.querySelector('.hub-task-config-section:not([hidden])'),date=section.querySelector('input[type=date]'),time=section.querySelector('input[type=time]'),dateKey=name==='start'?'fromDate':'dueDate',prior=f.state[dateKey],next=name==='start'?'2090-10-21':'2090-10-23';
   if(route!=='heading'||configured){date.value=next;date.dispatchEvent(new Event('input',{bubbles:true}));}
   if(route==='apply'){time.value='00:00';time.dispatchEvent(new Event('input',{bubbles:true}));}
   check(document.activeElement===date,name+' native automatic date focus');
   const dismiss=route==='heading'?heading:route==='cancel'?section.querySelector('.hub-task-popover-actions button'):route==='apply'?section.querySelector('.mod-cta'):route==='importance'?modal.contentEl.querySelector('[data-task-property=necessity]'):route==='description'?modal.contentEl.querySelector('[data-task-property=description]'):route==='other'?modal.contentEl.querySelector('[data-task-property='+(name==='start'?'due':'start')+']'):route==='steps'?f.checklist.toggle:route==='parent-cancel'?modal.contentEl.querySelector('.hub-task-dialog-actions button:not([hidden]):not(.mod-cta):not(.hub-task-remove)'):route==='close'?modal.modalEl.querySelector('.modal-close-button'):null;
   if(dismiss)dismiss.scrollIntoView({block:'nearest'});date.focus({preventScroll:true});await frame();
   const title=name+'-'+(configured?'configured':'empty')+'-'+route,events=[],frames=[],start=performance.now(),bounds=date.getBoundingClientRect(),capture=label=>{const b=section.getBoundingClientRect();return{label,ms:performance.now()-start,hidden:section.hidden,visible:!!b.height&&getComputedStyle(section).display!=='none',height:b.height,focus:document.activeElement===date,active:document.activeElement?.getAttribute('aria-label')??document.activeElement?.className,expanded:heading.getAttribute('aria-expanded'),children:section.children.length,value:date.value,hint:!date.parentElement?.querySelector('.hub-task-date-placeholder')?.hidden&&getComputedStyle(date.parentElement?.querySelector('.hub-task-date-placeholder')??date).visibility==='visible'};};
   const log=event=>events.push({...capture(event.type),target:event.target.getAttribute?.('aria-label')??event.target.className,trusted:event.isTrusted}),types=['pointerdown','mousedown','blur','focusout','focusin','pointerup','mouseup','click'];for(const type of types)modal.modalEl.addEventListener(type,log,true);
   const observer=new MutationObserver(records=>{for(const r of records)events.push({...capture('mutation:'+r.attributeName),target:r.target.className});});observer.observe(section,{attributes:true,attributeFilter:['hidden','inert']});observer.observe(heading,{attributes:true,attributeFilter:['aria-expanded']});
   const visual=!configured&&['heading','cancel','apply','importance'].includes(route),trace={mode,name,configured,route,focusedBlue:null,pressedBlue:null,events,frames};traces.push(trace);let focusedBlue=null,pressedBlue=null;
   if(visual){focusedBlue=trace.focusedBlue=await blue(await shot(title+'-focused'),bounds);check(focusedBlue>15,'Actual native selected segment painted before '+title);}
   if(route==='escape'){await key('Escape');}
   else{
    await pointer(dismiss,'down');for(let i=0;i<3;i++){frames.push(capture('held-press-'+i));await frame();}
    if(visual){pressedBlue=trace.pressedBlue=await blue(await shot(title+'-pressed'),bounds);if(baseline)check(pressedBlue<focusedBlue/2,'Baseline year highlight disappears while controls remain '+title+' '+focusedBlue+'/'+pressedBlue);else check(pressedBlue===focusedBlue,'Native segment pixels retained until activation '+title+' '+focusedBlue+'/'+pressedBlue);}
    check(frames.every(v=>v.visible&&!v.hidden),title+' no premature pointerdown activation');
    check(frames.every(v=>v.focus===!baseline),title+(baseline?' baseline exposes unfocused visible field':' retains date focus throughout held press'));
    await pointer(dismiss,'up');
   }
   for(let i=0;i<4;i++){frames.push(capture('after-activation-'+i));await frame();}
   check(frames.filter(v=>v.label.startsWith('after-')).every(v=>v.hidden&&!v.visible&&v.height===0&&v.children===0),title+' first and subsequent rendered frames already collapsed');
   if(!baseline)check(events.filter(v=>v.label==='blur'||v.label==='focusout').every(v=>!v.visible),title+' native blur occurs only after controls hidden');
   if(visual)await shot(title+'-collapsed');
   if(route==='apply'){check(f.state[dateKey]===next&&f.state[name==='start'?'fromTime':'dueTime']==='00:00'&&f.presentation.dates,'Apply updates parent date/midnight and live card');}
   else check(f.state[dateKey]===prior,title+' unapplied endpoint edits discarded');
   if(['heading','cancel','apply','escape'].includes(route))check(document.activeElement===heading,title+' restores heading focus');
   if(['importance','description','other'].includes(route)){const expected=route==='importance'?'necessity':route==='other'?(name==='start'?'due':'start'):'description',open=modal.contentEl.querySelector('[data-task-property='+expected+']');check(open.getAttribute('aria-expanded')==='true'&&modal.contentEl.querySelectorAll('.hub-task-config-section:not([hidden])').length===1,'Switch is exclusive and opens destination');}
   check(scrollY===0,title+' workspace remains stationary');
   observer.disconnect();for(const type of types)modal.modalEl.removeEventListener(type,log,true);
   if(modal.modalEl.isConnected){const open=modal.contentEl.querySelector('.hub-task-config-action[aria-expanded=true]');if(open)open.click();if(f.steps.hasPending)f.steps.draftInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));}
  }
  await ensure();
  if(!baseline){
   // A canceled drag must not dismiss or apply anything on press.
   const heading=modal.contentEl.querySelector('[data-task-property=start]');heading.click();let section=modal.contentEl.querySelector('.hub-task-config-section:not([hidden])'),date=section.querySelector('input[type=date]'),cancel=section.querySelector('.hub-task-popover-actions button');await pointer(cancel,'down');await pointer(modal.contentEl.querySelector('.hub-window-title'),'up');check(!section.hidden&&document.activeElement===date,'Canceled press keeps focused date and endpoint');await key('Escape');
   // Unrelated focus interactions and keyboard navigation retain their behavior.
   heading.click();section=modal.contentEl.querySelector('.hub-task-config-section:not([hidden])');date=section.querySelector('input[type=date]');await pointer(modal.contentEl.querySelector('.hub-window-title'));check(!section.hidden&&document.activeElement!==date,'Outside title/header click retains normal blur and does not invent dismissal');date.focus();await key('Tab');check(!section.hidden,'Keyboard Tab never prematurely dismisses');await key('Escape');
   modal.contentEl.querySelector('[data-task-property=description]').click();const text=modal.contentEl.querySelector('.hub-task-config-section:not([hidden]) textarea'),done=modal.contentEl.querySelector('.hub-task-config-section:not([hidden]) .mod-cta');text.focus();await pointer(done,'down');check(document.activeElement===done,'Other configurations retain pointer focus behavior');await pointer(done,'up');
   // Invalid Apply remains an isolated endpoint with its existing validation.
   f.state.fromDate='2090-10-20';f.state.dueDate='2090-10-22';f.refresh();heading.click();section=modal.contentEl.querySelector('.hub-task-config-section:not([hidden])');date=section.querySelector('input[type=date]');date.value='2090-10-23';date.dispatchEvent(new Event('input',{bubbles:true}));await pointer(section.querySelector('.mod-cta'));check(!section.hidden&&section.querySelector('[role=alert]').textContent&&f.state.fromDate==='2090-10-20','Invalid Apply retains validation and isolates date changes');await key('Escape');
   for(const name of ['start','due']){modal.contentEl.querySelector('[data-task-property='+name+']').click();section=modal.contentEl.querySelector('.hub-task-config-section:not([hidden])');const time=section.querySelector('input[type=time]');time.value='00:00';time.dispatchEvent(new Event('input',{bubbles:true}));time.focus();const cancel=section.querySelector('.hub-task-popover-actions button');await pointer(cancel,'down');check(document.activeElement===time&&!section.hidden,'Optional time retains native focus on Cancel press');await pointer(cancel,'up');check(section.hidden&&!section.children.length,'Optional time endpoint closes atomically');}
  }
  modal.close();check(fingerprint()===saved,'Parent Cancel and closing tests do not persist dates or Steps');
  if(!baseline){
   // Native submit activation still runs after the protected mouse press, and
   // parent Save discards an unapplied endpoint rather than committing it.
   await ensure();f.state.fromDate='2090-10-20';f.state.dueDate='2090-10-22';f.refresh();modal.contentEl.querySelector('[data-task-property=start]').click();const section=modal.contentEl.querySelector('.hub-task-config-section:not([hidden])'),date=section.querySelector('input[type=date]');date.value='2090-10-21';date.dispatchEvent(new Event('input',{bubbles:true}));const ids=new Set(Object.keys(plugin.projectWizard.data.taskMetadata)),save=modal.contentEl.querySelector('.hub-task-dialog-actions .mod-cta');await pointer(save,'down');check(document.activeElement===date&&!section.hidden,'Parent Save press retains native focus');await pointer(save,'up');for(let i=0;i<12&&modal.modalEl.isConnected;i++)await frame();check(!modal.modalEl.isConnected&&section.hidden,'Normal native parent submit saves and closes');const stored=edit?await service.read(targetTask):plugin.projectWizard.data.taskMetadata[Object.keys(plugin.projectWizard.data.taskMetadata).find(id=>!ids.has(id))];check(stored?.fromDate==='2090-10-20'&&stored.dueDate==='2090-10-22','Parent Save persists applied draft and discards local date edit');
  }
  document.querySelector('#result').textContent='PASS: '+checks+' atomic date closing checks '+(baseline?'baseline ':'fixed ')+mode+' '+layout;
 }catch(error){document.querySelector('#result').textContent='FAIL '+error.stack;}
}
