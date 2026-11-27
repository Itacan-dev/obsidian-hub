import { el, button, report } from '../ui/elements.js';
import { inSavedOrder,reorderRows,reorderHandle } from '../ui/reorder.js';
import { onContext } from '../ui/menu.js';
import { workspaceName } from './context.js';

export function placements(ctx, entry, workspace) {
  const open = placement => ctx.openNote(entry.path,undefined,'',placement,workspace);
  return [{label:'Open',run:()=>open('replace')},{label:'Open in…',items:[
    {label:'New tab',run:()=>open('tab')},{label:'Right split',run:()=>open('split')},{label:'Split below',run:()=>open('below')}
  ]}];
}
export function fileTree(ctx, workspace, {foldersOnly=false, expanded=[], selected, changed=()=>{}, activeFile, folderMenu, fileDrag, folderOrder, reorderFolders, select=foldersOnly ? ctx.openFolder : null} = {}) {
  const rail = el('aside','file-tree panel');
  const filter = el('input','text-input');
  filter.type = 'search'; filter.placeholder = 'Search files…'; filter.setAttribute('aria-label','Search workspace files');
  const tree = el('div','tree-rows');
  const header = button(workspaceName(ctx.library,workspace), () => ctx.openFolder(workspace,{workspace}), {symbol:'folder'});
  header.dataset.folder = workspace;
  fileDrag?.target(header,workspace);
  rail.append(header);
  if (!foldersOnly) rail.append(filter);
  rail.append(tree);
  let generation = 0;
  const editor = el('div','rail-create');
  async function createAt(kind,parent) {
    const label=kind==='note'?'Note name':'Folder name';
    const input=el('input','text-input'); input.placeholder=label; input.setAttribute('aria-label',label);
    const commit=button('Create',async()=>{
      const name=input.value.trim();
      if (!name) return input.focus();
      await window.itacan.create(ctx.library.session,parent,name,kind);
      if (parent!==workspace && !expanded.includes(parent)) {expanded.push(parent);await changed();}
      filter.value=''; editor.replaceChildren(); await render();
    });
    input.onkeydown=e=>{
      if(e.key==='Enter') {e.preventDefault();commit.click();}
      if(e.key==='Escape') editor.replaceChildren();
    };
    editor.replaceChildren(el('strong','',parent),input,commit,button('Cancel',()=>editor.replaceChildren()));
    input.focus();
  }
  function bindFolder(control,path) {
    if (folderMenu) onContext(control,()=>folderMenu(path));
    else onContext(control,()=>[
      {label:'New note',run:()=>createAt('note',path)},
      {label:'New folder',run:()=>createAt('folder',path)},
      {label:'Open workspace',run:()=>ctx.openFolder(path)}
    ]);
  }
  bindFolder(header,workspace);
  if (!foldersOnly) rail.append(button('New folder',()=>createAt('folder',workspace)),editor);
  async function populate(parent, path, query, ticket) {
    const entries = await window.itacan.entries(ctx.library.session,path);
    if (path === workspace) {
      for (const target of ctx.workspaces.attachments(workspace)) {
        const resource = workspaceName(ctx.library,target.split('/').slice(0,2).join('/'));
        entries.push({name:resource+' / '+target.split('/').slice(2).join('/'), path:target, kind:'folder', shared:true});
      }
    }
    if (ticket !== generation) return;
    for (const entry of path===workspace && folderOrder ? inSavedOrder(entries,folderOrder) : entries) {
      if (entry.kind === 'folder') {
        const group = el('div','tree-group');
        const line = el('div','tree-line');
        const nested = el('div','tree-children');
        const open = expanded.includes(entry.path) || !!query;
        const toggle = button(open ? '▾' : '▸', async () => {
          const index = expanded.indexOf(entry.path);
          if (index >= 0) expanded.splice(index,1); else expanded.push(entry.path);
          await changed(); await render();
        });
        toggle.setAttribute('aria-label',(open ? 'Collapse ' : 'Expand ')+entry.name);
        toggle.dataset.toggle = entry.path;
        toggle.setAttribute('aria-expanded',String(open));
        const folder = button(entry.name,() => select ? select(entry.path) : toggle.click(),{symbol:'folder'});
        bindFolder(folder,entry.path); fileDrag?.target(folder,entry.path);
        if (!entry.shared) fileDrag?.source(folder,()=>[entry.path]);
        folder.dataset.folder = entry.path;
        line.append(toggle,folder);
        if(path===workspace && reorderFolders && !query && !entry.shared) {
          line.dataset.root=entry.path;
          line.append(reorderHandle('Reorder '+entry.name));
        }
        group.append(line,nested); parent.append(group);
        if (open) {
          try {
            await populate(nested,entry.path,query && !entry.name.toLowerCase().includes(query) ? query : '',ticket);
          } catch (error) {
            if (!entry.shared) throw error;
            nested.append(el('p','empty','Resource folder unavailable. Reconnect its files or detach it from this Project.'));
          }
          if (query && !nested.children.length && !entry.name.toLowerCase().includes(query)) group.remove();
        }
      } else if (!foldersOnly && entry.name.toLowerCase().includes(query) && (entry.kind === 'note' || entry.openable)) {
        const b = button(entry.name,() => ctx.openNote(entry.path,undefined,'','replace',workspace),{symbol:entry.kind});
        b.dataset.path = entry.path;
        if (entry.path===activeFile?.()) b.setAttribute('aria-current','page');
        fileDrag?.source(b,()=>[entry.path]);
        b.onauxclick=e=>{if(e.button===1){e.preventDefault();ctx.openNote(entry.path,undefined,'','split',workspace).catch(report);}};
        onContext(b,() => placements(ctx,entry,workspace));
        parent.append(b);
      }
    }
  }
  async function render() {
    const ticket = ++generation, fragment = document.createDocumentFragment();
    await populate(fragment,workspace,filter.value.trim().toLowerCase(),ticket);
    if (ticket === generation) {
      const focused = tree.contains(document.activeElement) ? document.activeElement : null;
      tree.replaceChildren(fragment);
      if (foldersOnly) setSelected(selected);
      if (focused) {
        const controls = [...tree.querySelectorAll('button')];
        const replacement = controls.find(b => focused.dataset.folder ? b.dataset.folder === focused.dataset.folder :
          focused.dataset.path ? b.dataset.path === focused.dataset.path : b.dataset.toggle === focused.dataset.toggle);
        replacement?.focus({preventScroll:true});
      }
    }
  }
  if(reorderFolders) reorderRows(tree,'[data-root]',async (row,index,rows)=>{
    const order=rows.map(r=>r.dataset.root);
    order.splice(index,0,order.splice(rows.indexOf(row),1)[0]);
    folderOrder.splice(0,folderOrder.length,...order);
    await reorderFolders();await render();
    tree.querySelector('[data-root="'+CSS.escape(row.dataset.root)+'"] [data-reorder]')?.focus({preventScroll:true});
  });
  filter.oninput = () => render().catch(report);
  void render().catch(report);
  function setSelected(path) {
    selected = path;
    for (const control of rail.querySelectorAll('[data-folder]')) {
      if (control.dataset.folder === path) control.setAttribute('aria-current','location');
      else control.removeAttribute('aria-current');
    }
  }
  return {root:rail, header, refresh:render, setSelected};
}
