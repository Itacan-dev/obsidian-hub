import { el, button, report } from './elements.js';
import { taskEditor } from '../tasks/tasks.js';
import { workspaceName } from '../workspace/context.js';

export function contextSearch(ctx, scope, currentFolder) {
  const region = el('div','context-search');
  const input = el('input','text-input');
  const results = el('div','search-results panel');
  const label = !scope ? 'Search Itacan' : scope.startsWith('Projects/') ? 'Search this project' : 'Search '+workspaceName(ctx.library,scope);
  input.type = 'search';
  input.placeholder = label+'…';
  input.setAttribute('aria-label',label);
  input.setAttribute('role','combobox');
  results.id = 'results-'+crypto.randomUUID();
  results.setAttribute('role','listbox');
  input.setAttribute('aria-controls',results.id);
  region.append(input,results);
  let folderOnly = false;
  if (currentFolder) {
    const chooser=el('select','search-scope');
    chooser.setAttribute('aria-label','Search scope');
    chooser.add(new Option('Workspace','workspace'));
    chooser.add(new Option('Current folder','folder'));
    chooser.onchange=()=>{
      folderOnly=chooser.value==='folder';
      const prompt=folderOnly?'Search current folder':label;
      input.placeholder=prompt+'…';input.setAttribute('aria-label',prompt);
      input.focus();schedule();
    };
    region.classList.add('scoped-search');
    region.prepend(chooser);
  }
  let generation = 0, timer, index, token;
  function cancel() {
    if (token) window.itacan.cancelSearch(ctx.library.session,token).catch(()=>{});
    token=null;
  }
  function close() {
    cancel(); clearTimeout(timer); generation++; index = -1;
    results.hidden = true;results.inert=false;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
  }
  function schedule() {
    cancel(); clearTimeout(timer);generation++;index=-1;
    const query = input.value.trim().toLowerCase();
    if (!query) return close();
    results.inert=true;
    input.removeAttribute('aria-activedescendant');
    results.querySelector('[aria-selected="true"]')?.removeAttribute('aria-selected');
    const ticket = generation;
    timer = setTimeout(() => search(query,ticket).catch(report),100);
  }
  async function search(query,ticket) {
    const stale = () => ticket !== generation || !region.isConnected;
    const key=crypto.randomUUID(), session=ctx.library.session;
    token=key;
    const oath=ctx.oaths.current();
    const allowed=oath?.status==='active' ? [oath.owner,...ctx.workspaces.attachments(oath.owner)] : null;
    const roots=folderOnly ? [currentFolder()] : scope ? [scope,...ctx.workspaces.attachments(scope)] : allowed;
    const inside=(path,folders)=>!folders || folders.some(folder=>path===folder || path?.startsWith(folder+'/'));
    const visible=path=>inside(path,roots) && inside(path,allowed);
    const request=phase=>window.itacan.search(session,{scope,query,token:key,phase,folders:roots,stream:phase==='content'});
    const names=await request('names');
    if(stale())return;
    results.replaceChildren();
    const groups=new Map();
    function match(group,label,detail,open) {
      let list=groups.get(group);
      if(!list){
        list=el('div','match-list');
        results.append(el('strong','',group),list);groups.set(group,list);
      }
      const option=button(label,async()=>{close();await open();});
      option.append(el('small','muted',detail));option.setAttribute('role','option');
      option.tabIndex=-1;option.id='match-'+crypto.randomUUID();
      option.onpointerdown=e=>e.preventDefault();list.append(option);
    }
    for(const workspace of [...ctx.library.projects,...ctx.library.resources,...(ctx.library.extraResources || [])])
      if(visible(workspace.path) && workspace.name.toLowerCase().includes(query))
        match(workspace.path.split('/')[0],workspace.name,workspace.path,()=>ctx.openFolder(workspace.path));
    for(const item of names) {
      if(!visible(item.path))continue;
      match(item.kind==='folder'?'Folders':'Files',item.name,item.path,
        ()=>item.kind==='folder'?ctx.openFolder(item.path,{workspace:scope}):ctx.openNote(item.path,undefined,'','replace',scope));
    }
    for(const task of ctx.tasks.list()) {
      if(scope && !ctx.tasks.inWorkspace(scope,task)) continue;
      if(allowed && !ctx.tasks.inWorkspace(oath.owner,task)) continue;
      if(folderOnly && !inside(task.location || task.owner,roots)) continue;
      if([task.title,task.description].some(s=>s?.toLowerCase().includes(query)))
        match('Tasks',task.title,task.owner,()=>taskEditor(ctx,task));
    }
    function reveal() {
      results.hidden=false;results.inert=false;input.setAttribute('aria-expanded','true');
    }
    const overlay=new Set();
    function noteHit(item) {
      match('Note matches',item.name,item.snippet,()=>ctx.openNote(item.path,true,{line:item.line},'replace',scope));
    }
    for(const buffer of ctx.documents.open.values()) {
      if(!buffer.dirty || !visible(buffer.path))continue;
      overlay.add(buffer.path);
      const lines=buffer.text.split('\n');
      const line=lines.findIndex(text=>text.toLowerCase().includes(query));
      if(line>=0)noteHit({path:buffer.path,name:buffer.path.split('/').at(-1),line:line+1,snippet:lines[line].slice(0,180)});
    }
    if(groups.size)reveal();
    const unsubscribe=window.itacan.onSearchMatches(session,key,items=>{
      if(stale())return;
      for(const item of items)if(!overlay.has(item.path) && visible(item.path))noteHit(item);
      if(groups.size)reveal();
    });
    try { await request('content'); } finally { unsubscribe(); }
    if(stale())return;
    if(!groups.size)results.append(el('p','empty','No matches in this scope.'));
    reveal();
    if(token===key)token=null;
  }
  input.oninput=input.onfocus=schedule; input.onblur=close;
  input.onkeydown=e=>{
    const rows=[...results.querySelectorAll('button')];
    if (e.key==='Escape') close();
    if (results.hidden || results.inert || !rows.length) return;
    if (e.key==='Enter') { e.preventDefault(); rows[Math.max(0,index)].click(); }
    if (['ArrowDown','ArrowUp'].includes(e.key)) {
      e.preventDefault();
      index=(index<0 ? (e.key==='ArrowDown'?0:rows.length-1) : (index+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length);
      rows.forEach((r,i)=>r.setAttribute('aria-selected',String(i===index)));
      input.setAttribute('aria-activedescendant',rows[index].id); rows[index].scrollIntoView({block:'nearest',container:'nearest'});
    }
  };
  close(); return region;
}
