import { el, button, report } from './elements.js';
import { taskEditor } from '../tasks/tasks.js';

export function contextSearch(ctx, scope) {
  const region = el('div','context-search');
  const input = el('input','text-input');
  const results = el('div','search-results panel');
  const label = !scope ? 'Search Itacan' : scope.startsWith('Projects/') ? 'Search this project' : 'Search '+scope.split('/')[1];
  input.type = 'search';
  input.placeholder = label+'…';
  input.setAttribute('aria-label',label);
  input.setAttribute('role','combobox');
  results.id = 'results-'+crypto.randomUUID();
  results.setAttribute('role','listbox');
  input.setAttribute('aria-controls',results.id);
  region.append(input,results);
  let generation = 0, timer, index;
  function close() {
    clearTimeout(timer); generation++; index = -1;
    results.hidden = true;results.inert=false;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
  }
  function schedule() {
    clearTimeout(timer);generation++;index=-1;
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
    const groups = new Map();
    function match(group,label,detail,open) {
      if (!groups.has(group)) groups.set(group,[]);
      groups.get(group).push({label,detail,open});
    }
    async function visit(folder) {
      if (stale()) return;
      for (const item of await window.itacan.entries(ctx.library.session,folder)) {
        if (stale()) return;
        const {name,path,kind} = item;
        const open = () => kind==='folder' ? ctx.openFolder(path) : kind==='note' ? ctx.openNote(path) : window.itacan.openAttachment(ctx.library.session,path);
        if (name.toLowerCase().includes(query) && (kind!=='file' || item.openable)) match(kind==='folder'?'Folders':'Files',name,path,open);
        if (kind==='folder') await visit(path);
        else if (kind==='note') {
          const note = ctx.documents.open.get(path) || await window.itacan.readNote(ctx.library.session,path).catch(() => null);
          const line = note?.text.split('\n').find(line => line.toLowerCase().includes(query));
          if (line) match('Note matches',name,line.slice(0,180),open);
        }
      }
    }
    for (const workspace of [...ctx.library.projects,...ctx.library.resources]) {
      if (scope && workspace.path!==scope) continue;
      if (workspace.name.toLowerCase().includes(query)) match(workspace.path.split('/')[0],workspace.name,workspace.path,()=>ctx.openFolder(workspace.path));
      await visit(workspace.path);
    }
    if (stale()) return;
    for (const task of ctx.state.tasks) {
      if ((!scope || task.owner===scope) && [task.title,task.description].some(s=>s?.toLowerCase().includes(query)))
        match('Tasks',task.title,task.owner,()=>taskEditor(ctx,task));
    }
    results.replaceChildren();
    for (const [group,items] of groups) {
      results.append(el('strong','',group));
      for (const item of items) {
        const option = button(item.label,async()=>{ close(); await item.open(); });
        option.append(el('small','muted',item.detail));
        option.setAttribute('role','option'); option.tabIndex=-1; option.id='match-'+crypto.randomUUID();
        option.onpointerdown=e=>e.preventDefault(); results.append(option);
      }
    }
    if (!groups.size) results.append(el('p','empty','No matches in this scope.'));
    results.inert=false;results.hidden=false; input.setAttribute('aria-expanded','true');
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
