import { el, button, report } from '../ui/elements.js';
import { field, confirmAction } from '../ui/forms.js';
import { showDialog } from '../ui/dialog.js';
import { menu } from '../ui/menu.js';
import { fileAttachments, fileCapturedText } from './actions.js';

export function inbox(ctx) {
  const body = el('div','inbox');
  const aside = el('aside','inbox-sidebar');
  const toolbar = el('div','actions');
  const list = el('div','inbox-list');
  const detail = el('section','inbox-detail');
  detail.setAttribute('aria-label','Item details');
  const selected = new Set();
  let filter = 'All', sort = ctx.inbox.sort(), anchor, edit, editedId, busy = false, emptySelection = false;
  function visible() {
    const items = ctx.inbox.list().filter(i => filter==='All' || (filter==='Files')===!!i.name);
    if (sort==='Type') items.sort((a,b) => Number(!!a.name)-Number(!!b.name));
    else items.sort((a,b) => (sort==='Oldest' ? 1 : -1)*a.created.localeCompare(b.created));
    return items;
  }
  async function flush() {
    const item = ctx.inbox.list().find(i => i.id===editedId);
    if (item && edit && item.text !== edit.value) await ctx.inbox.edit({id:item.id,text:edit.value});
  }
  async function act(fn) {
    if (busy) return;
    busy = true; body.inert = true;
    try {
      await flush();
      try { await fn(); } finally { render(); }
    } finally { busy = false; body.inert = false; }
  }
  const sortButton = button('Sort by',() => menu(sortButton,['Newest','Oldest','Type'].map(label => ({
    label:({Newest:'Newest first',Oldest:'Oldest first',Type:'Item type'})[label],run:() => act(async () => { await ctx.inbox.setSort({sort:label}); sort = label; })
  }))));
  const filters = ['All','Texts','Files'].map(label => button(label,() => act(() => {
    filter = label; emptySelection = false; selected.clear(); anchor = null;
  })));
  const filterGroup=el('div','segmented-controls'); filterGroup.setAttribute('aria-label','Filter items'); filterGroup.append(...filters);
  toolbar.append(filterGroup,sortButton); aside.append(toolbar,list); body.append(aside,detail);
  function select(item,event) {
    const items = visible();
    return act(() => {
      const multi = event.ctrlKey || event.metaKey, range = event.shiftKey && anchor;
      if (!multi && !range) selected.clear();
      const origin = items.find(i => i.id===anchor);
      if ((multi || range) && selected.size && !!origin?.name !== !!item.name) return;
      if (range && origin) {
        const start = items.indexOf(origin), end = items.indexOf(item);
        if (!multi) selected.clear();
        for (const i of items.slice(Math.min(start,end),Math.max(start,end)+1)) if (!!i.name===!!item.name) selected.add(i.id);
      } else {
        if (multi && selected.has(item.id)) selected.delete(item.id); else selected.add(item.id);
        anchor = item.id;
      }
      emptySelection = !selected.size;
    }).then(() => [...list.children].find(row => row.dataset.id===item.id)?.focus());
  }
  function render() {
    const listTop=list.scrollTop;
    edit = null; editedId = null;
    list.replaceChildren(); detail.replaceChildren();
    filters.forEach((b,i) => b.setAttribute('aria-pressed',String(['All','Texts','Files'][i]===filter)));
    const items = visible();
    const counts = [ctx.inbox.list().length,ctx.inbox.list().filter(i=>!i.name).length,ctx.inbox.list().filter(i=>i.name).length];
    filters.forEach((b,i)=>{ const label=['All','Texts','Files'][i]; b.setAttribute('aria-label',label); b.textContent=label+' ('+counts[i]+')'; });
    for (const id of selected) if (!items.some(i => i.id===id)) selected.delete(id);
    if (!emptySelection && !selected.size && items.length) { selected.add(items[0].id); anchor=items[0].id; }
    for (const [index,item] of items.entries()) {
      const row = el('button','inbox-row',item.name || item.text.split('\n')[0]);
      row.setAttribute('aria-label',row.textContent);
      row.append(el('small','muted',new Date(item.created).toLocaleString()));
      row.dataset.id=item.id; row.setAttribute('aria-pressed',String(selected.has(item.id)));
      row.onclick=e=>select(item,e).catch(report);
      row.oncontextmenu=async e=>{
        e.preventDefault();
        if(!selected.has(item.id))await select(item,{});
        const current=[...list.children].find(b=>b.dataset.id===item.id);
        const commands=[...detail.querySelectorAll('.capture-destinations button,.inbox-delete')];
        if(current)menu(current,commands.map(b=>({label:b.textContent,run:()=>b.click()})),e);
      };
      row.onkeydown=e=>{
        if(e.key==='ContextMenu' || e.shiftKey && e.key==='F10'){e.preventDefault();row.oncontextmenu(e).catch(report);return;}
        if(e.key==='Escape' && selected.size>1){e.preventDefault();e.stopPropagation();select(item,{}).catch(report);return;}
        if (e.key==='Delete') {e.preventDefault();detail.querySelector('.inbox-delete')?.click();return;}
        if (!['ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
        e.preventDefault();
        const n=e.key==='Home'?0:e.key==='End'?items.length-1:index+(e.key==='ArrowUp'?-1:1);
        if(items[n]) select(items[n],e).catch(report);
      };
      list.append(row);
    }
    list.scrollTop=listTop;
    const picks = items.filter(i=>selected.has(i.id));
    if (!picks.length) { detail.append(el('p','empty',items.length?'Select an item to organize.':'No captures to show.')); return; }
    const first=picks[0], bulk=picks.length>1;
    detail.append(el('h3','',bulk ? picks.length+(first.name?' files selected':' texts selected') : first.name ? 'File' : 'Text'));
    if (bulk) {
      if (first.name) for (const item of picks) detail.append(button('Deselect '+(item.name||item.text.split('\n')[0]),() => select(item,{ctrlKey:true})));
    } else if (first.name) {
      detail.append(el('p','',first.name));
    } else {
      edit=field(detail,'Captured text','textarea',first.text); editedId=first.id;
    }
    const actions=el('div','capture-destinations actions');
    if (first.name) actions.append(button(bulk?'Add files to…':'Add file to…',() => act(() => fileAttachments(ctx,picks,false))));
    else for(const [kind,label] of [['task','Create task…'],['note',bulk?'Create notes…':'Create note…'],['append','Add to note…']]){
      const text = bulk ? ({task:'Create '+picks.length+' tasks…',note:'Create '+picks.length+' notes…',append:'Add '+picks.length+' texts to note…'})[kind] : label;
      actions.append(button(text,() => act(() => fileCapturedText(ctx,kind,picks.map(p=>ctx.inbox.list().find(i=>i.id===p.id))))));
    }
    const remove=button('Delete',() => act(async () => {
      if (!await confirmAction('Remove captures?',picks.map(i=>i.name || i.text).join('\n'),'Remove')) return;
      for(const p of picks) {
        if(p.name) await fileAttachments(ctx,[p],false,true);
        else await ctx.inbox.remove({id:p.id});
      }
    }));
    remove.classList.add('inbox-delete');
    const clear=button('Clear selection',()=>act(()=>{selected.clear();emptySelection=true;anchor=null;}));
    detail.append(actions,bulk?clear:remove);
  }
  render();
  return showDialog({title:'Inbox',description:'Saved items awaiting organisation',content:body,wide:true,
    beforeClose:async()=>{if(busy) throw Error('Finish the current Inbox action first.'); await flush();},
    actions:[{label:'Close',value:true}]});
}
