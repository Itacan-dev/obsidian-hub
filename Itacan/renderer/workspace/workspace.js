import { el, button, report, dashboardDate, icon } from '../ui/elements.js';
import { menu, onContext } from '../ui/menu.js';
import { progressPanel } from '../progress/panel.js';
import { taskPanel } from '../tasks/tasks.js';
import { pickPath, confirmAction } from '../ui/forms.js';
import { askName } from '../ui/dialog.js';
import { contextSearch } from '../ui/context-search.js';
import { fileTree, placements } from './tree.js';
import { fileDrag } from './file-drag.js';
import { resizeDivider } from './divider.js';
import { workspaceName } from './context.js';
import { attachFolder } from './shared-folders.js';
import { launchShortcuts } from '../settings/settings.js';
import { roadmapDialog, workspacePlan } from '../plan/project.js';

export async function workspaceView(library, folder, ctx, route = {}) {
  const owner = ctx.workspaces.contextFor(folder,route.workspace);
  const go = (path,options={}) => ctx.openFolder(path,{workspace:owner,...options});
  const root = el('section','workspace view-width');
  const isProject = owner.startsWith('Projects/');
  const cover = el('div','dashboard-cover workspace-cover');
  const title = el('header','dashboard-heading');
  const titleBox = el('div');
  titleBox.append(el('h1','',workspaceName(library,owner)),el('p','context-label',isProject ? 'Project' : 'Resource'));
  title.append(titleBox,dashboardDate());
  const shortcuts = el('div','workspace-shortcuts');
  if (isProject) shortcuts.append(el('strong','context-label','Work'));
  shortcuts.append(contextSearch(ctx,owner,()=>folder));
  if (isProject) shortcuts.append(button('Roadmap', () => roadmapDialog(ctx,owner)),button('Today’s plan', () => workspacePlan(ctx,owner)));
  shortcuts.append(launchShortcuts(ctx));
  root.append(cover,title);
  const work = el('div','workspace-work');
  const files = el('section','files panel');
  const heading = el('header','section-heading');
  heading.append(el('h2','','Files'));
  const tools = el('div','actions explorer-tools');
  const browser = el('div','folder-browser');
  const content = el('div','folder-contents');
  const location = el('nav','actions folder-crumbs');

  const list = el('div','file-list');
  list.setAttribute('role','listbox'); list.setAttribute('aria-label','Folder contents'); list.setAttribute('aria-multiselectable','true');
  const selected = new Set();
  let anchor = null;

  let entries = [];
  const stored = ctx.workspaces.explorer(owner) || {};
  const order=[...(stored.order || [])];
  const expanded = [...(stored.expanded || [])];
  let sort = stored.sort || 'name', direction = stored.direction || 1, width = stored.width;
  const saveView = () => ctx.workspaces.saveExplorer({path:owner, expanded,sort,direction,width,folder,order});
  const drag=fileDrag(async (paths,parent)=>{
    let next=folder;
    if(paths.length>1) {
      const entries=await window.itacan.entries(library.session,parent);
      const occupied=new Set(entries.map(entry=>entry.name));
      const collision=paths.find(path=>occupied.has(path.split('/').at(-1)));
      if(collision)throw Error('An item already has the name '+collision.split('/').at(-1)+'.');
    }
    try {
      for(const path of paths) {
        const name=path.split('/').at(-1);
        await ctx.changeFile(path,parent,name);
        if(path===folder || folder.startsWith(path+'/'))next=parent+'/'+name+folder.slice(path.length);
      }
    } finally {await go(next,{refreshTree:true,retainSelection:true});}
  },async (files,parent)=>{
    ctx.install(await window.itacan.importFiles(library.session,parent,files),'files');
    await go(folder,{refreshTree:true,retainSelection:true});
  },parent=>parent!==owner);
  drag.target(list,()=>folder);
  const tree = fileTree(ctx,owner,{foldersOnly:true,expanded,selected:folder,select:go,changed:saveView,folderMenu,fileDrag:drag,folderOrder:order,reorderFolders:saveView});
  const divider = resizeDivider('Folder navigation width',() => tree.root.getBoundingClientRect().width,
    next => {
      const available=browser.clientWidth;
      width=Math.round(Math.max(Math.min(160,available*.4), Math.min(available-165,next)));
      browser.style.setProperty('--folder-width',width+'px');
    },saveView,{rememberSize:()=>{
      const previous=width;
      return ()=>{
        width=previous;
        if(width)browser.style.setProperty('--folder-width',width+'px');
        else browser.style.removeProperty('--folder-width');
      };
    }});
  divider.ondblclick=()=>{width=null;browser.style.removeProperty('--folder-width');saveView().catch(report);};
  if (width) browser.style.setProperty('--folder-width',width+'px');
  async function create(kind, parent = folder) {
    const base = kind === 'note' ? 'New note' : 'New folder';
    const existing = await window.itacan.entries(library.session,parent);
    const names = new Set(existing.map(item => item.name));
    let name = base, counter = 1;
    while (names.has(name+(kind==='note'?'.md':''))) name = base+' ('+(++counter)+')';
    const path = await window.itacan.create(library.session,parent,name,kind);
    await go(parent,{rename:path,selected:path,refreshTree:true});
  }
  function rename(path) {
    const row = [...list.children].find(row=>row.dataset.path===path);
    if (!row) return;
    const name = path.split('/').at(-1), parent = path.split('/').slice(0,-1).join('/');
    const note = entries.find(e=>e.path===path)?.kind==='note';
    const input = el('input','text-input');
    input.value = note ? name.slice(0,-3) : name;
    input.setAttribute('aria-label','Item name');
    row.before(input); row.hidden = true; input.focus(); input.select();
    let finished = false;
    async function finish(cancel) {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      const next = value && note && !/\.md$/i.test(value) ? value+'.md' : value;
      if (!cancel && next && next!==name) {
        try {
          await ctx.changeFile(path,parent,next);
          await go(parent,{selected:parent+'/'+next,refreshTree:true});
          return;
        } catch (error) { finished=false; report(error); input.focus(); return; }
      }
      input.remove(); row.hidden=false; row.focus();
    }
    input.onkeydown=e=>{
      if (!['Escape','Enter'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); void finish(e.key==='Escape');
    };
    input.onblur=()=>void finish(false);
  }
  async function manage(action, paths) {
    const first = paths[0], parent = first.split('/').slice(0,-1).join('/');
    const destination = action === 'Move' ? await pickPath(ctx,'Move to folder','folder') : parent;
    if (!destination) return;
    let name = first.split('/').at(-1);
    if (action === 'Rename') {
      if (entries.some(e=>e.path===first)) return rename(first);
      if (first!==owner) return go(parent,{rename:first,selected:first});
      name = await askName('Rename workspace',name,'Rename');
    }
    if (!name || action === 'Delete' && !await confirmAction('Delete selection?',paths.join('\n'),'Delete')) return;
    try {
      for (const path of paths) {
        if (!await ctx.changeFile(path,destination,action === 'Rename' ? name : path.split('/').at(-1),action === 'Delete')) break;
      }
    } finally {
      if (paths.includes(owner)) await ctx.refresh();
      else await go(paths.includes(folder) ? parent : folder,{refreshTree:true});
    }
  }
  const manageOptions = paths => ['Rename','Move','Delete'].filter(a => a !== 'Rename' || paths.length === 1)
    .filter(a => a !== 'Move' || paths[0] !== owner).map(label => ({label,run:() => manage(label,paths)}));
  function clip(paths,cut) {
    ctx.fileClipboard = {paths:[...paths],cut};
  }
  async function paste(parent) {
    const clip = ctx.fileClipboard;
    if (!clip) return;
    try {
      for (const path of [...clip.paths]) {
        if (clip.cut) {
          await ctx.changeFile(path,parent,path.split('/').at(-1));
          clip.paths.splice(clip.paths.indexOf(path),1);
        } else await window.itacan.copyItem(library.session,path,parent);
      }
    } finally { await go(folder,{refreshTree:true}); }
  }
  function folderMenu(path) {
    const attached = ctx.workspaces.attachments(owner)?.includes(path);
    return [
      {label:'New note',disabled:path===owner,run:()=>create('note',path)},
      {label:'New folder',run:()=>create('folder',path)},
      {label:'Paste',disabled:!ctx.fileClipboard?.paths.length,run:()=>paste(path)},
      {label:'Show in system explorer',run:()=>window.itacan.revealItem(library.session,path)},
      ...(attached ? [{label:'Detach from Project',run:async()=>{
        await ctx.workspaces.detachFolder({project:owner,folder:path});
        await go(owner,{refreshTree:true});
      }}] : path!==owner ? manageOptions([path]) : [])
    ];
  }
  function fileOptions(entry) {
    const paths=[...selected];
    const files=entries.filter(e=>selected.has(e.path) && (e.kind==='note' || e.openable));
    const items = [{label:'Add selected files to plan',disabled:!files.length,run:()=>ctx.plans.addMany({
      items:files.map(e=>({kind:e.kind,ref:e.path}))
    })}];
    if (paths.length===1) {
      if (entry.kind==='note' || entry.openable) items.push(...placements(ctx,entry,owner));
      else items.push({label:'Open',run:()=>open(entry),disabled:entry.kind==='file' && !entry.openable});
      if (entry.kind==='folder') items.push(...folderMenu(entry.path).slice(0,3));
      items.push({label:'Show in system explorer',run:()=>window.itacan.revealItem(library.session,entry.path)});
    }
    return [...items,...manageOptions(paths),
      {label:'Cut',run:()=>clip(paths,true)},{label:'Copy',run:()=>clip(paths,false)},
      {label:paths.length===1?'Copy path':'Copy paths',run:()=>window.itacan.copyPaths(library.session,paths)}];
  }
  const open = entry => entry.kind === 'folder' ? go(entry.path) :
    (entry.kind === 'note' || entry.openable) && ctx.openNote(entry.path,undefined,'','replace',owner);
  function sync() { for (const row of list.children) row.setAttribute('aria-selected',String(selected.has(row.dataset.path))); }
  function render() {
    list.replaceChildren();
    entries.sort((a,b) => Number(b.kind==='folder')-Number(a.kind==='folder') || direction * (sort==='name' ?
      a.name.localeCompare(b.name,undefined,{numeric:true}) : a[sort]-b[sort]));
    for (const [index,entry] of entries.entries()) {
      const row = el('button','file-row');
      row.setAttribute('role','option'); row.dataset.path = entry.path;
      row.append(el('span','file-name',entry.name));
      for (const key of ['mtime','ctime']) row.append(el('small','muted',entry[key] ? new Date(entry[key]).toLocaleDateString() : '—'));
      drag.source(row,()=>{
        if(!selected.has(entry.path)){selected.clear();selected.add(entry.path);anchor=index;sync();}
        return [...selected];
      });
      if(entry.kind==='folder') drag.target(row,entry.path);
      if(entry.kind==='note' || entry.openable) row.onauxclick=e=>{
        if(e.button===1){e.preventDefault();ctx.openNote(entry.path,undefined,'','split',owner).catch(report);}
      };
      row.onclick = e => {
        if (e.shiftKey && anchor !== null) {
          if (!e.ctrlKey) selected.clear();
          for (const item of entries.slice(Math.min(anchor,index),Math.max(anchor,index)+1)) selected.add(item.path);
        } else {
          if (!e.ctrlKey && !e.metaKey) selected.clear();
          if (selected.has(entry.path)) selected.delete(entry.path); else selected.add(entry.path);
          anchor = index;
        }
        sync();
      };
      row.ondblclick = e => {
        if (!(e?.ctrlKey || e?.metaKey || e?.shiftKey)) Promise.resolve(open(entry)).catch(report);
      };
      row.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); row.ondblclick(); }
        if (e.key === 'Delete') manage('Delete',selected.size ? [...selected] : [entry.path]).catch(report);
      };
      onContext(row,() => {
        if (!selected.has(entry.path)) { selected.clear(); selected.add(entry.path); sync(); }
        return fileOptions(entry);
      });
      list.append(row);
    }
    sync();
    if (!entries.length) list.append(el('p','empty','This folder is empty.'));
  }
  content.oncontextmenu=e=>{
    if (e.defaultPrevented) return;
    e.preventDefault(); menu(content,folderMenu(folder),e);
  };
  files.onkeydown=e=>{
    if (e.target.closest('input')) return;
    const mod=e.ctrlKey || e.metaKey, key=e.key.toLowerCase();
    if (mod && key==='a') { for(const entry of entries) selected.add(entry.path); sync(); }
    else if (mod && (key==='x' || key==='c') && selected.size) clip(selected,key==='x');
    else if (mod && key==='v') paste(folder).catch(report);
    else if (mod && e.shiftKey && key==='n') create('folder').catch(report);
    else if (key==='f2' && selected.size===1) rename([...selected][0]);
    else if (key==='escape') { selected.clear(); sync(); }
    else if (['ArrowUp','ArrowDown','Home','End'].includes(e.key) && e.target.closest('.file-row')) {
      const rows=[...list.children], index=rows.indexOf(e.target.closest('.file-row'));
      const to=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowDown'?1:-1)));
      rows[to].dispatchEvent(new MouseEvent('click',{shiftKey:e.shiftKey})); rows[to].focus();
    } else return;
    e.preventDefault();
  };
  const columns = el('div','file-columns');
  const sortChoices = [];
  async function applySort(key, order) {
    sort = key;
    direction = order;
    anchor = null;
    render();
    await saveView();
  }
  for (const [key,label] of [['name','Name'],['mtime','Modified'],['ctime','Created']]) {
    const defaultOrder = key === 'name' ? 1 : -1;
    columns.append(button(label, () => applySort(key, sort === key ? -direction : defaultOrder), {variant:'quiet'}));
    const labels = key === 'name' ? ['Ascending','Descending'] : ['Oldest','Newest'];
    labels.forEach((order,index) => sortChoices.push({
      label:label+' · '+order, run:() => applySort(key,index===0 ? 1 : -1)
    }));
  }
  const sortButton = button('Sort by', () => menu(sortButton,sortChoices));
  const newNote = button('New note', () => create('note'));

  tools.append(newNote, button('New folder', () => create('folder')), sortButton);
  if (isProject) onContext(titleBox,()=>manageOptions([owner]));
  for (const [i,control] of [...tools.children].entries()) {
    const name=control.textContent;
    control.setAttribute('aria-label',name); control.title=control.title || name;
    control.replaceChildren(icon(['notePlus','folderPlus','sort'][i]));
  }
  tree.root.prepend(tools);
  if (isProject) heading.append(button('Attach Resource folder',async()=>{
    if (await attachFolder(ctx,owner)) await tree.refresh();
  },{variant:'quiet',symbol:'plus'}));
  content.append(location,columns,list);
  browser.append(tree.root,divider,content); files.append(heading,browser);
  const tasks = taskPanel(ctx,owner);
  const progress=progressPanel(ctx,owner),side=el('div','workspace-summary');
  side.append(tasks.root,progress.root);
  work.append(files,side); root.append(shortcuts,work);
  async function openFolder(path, options) {
    const rows = await window.itacan.entries(library.session,path,true);
    if (ctx.workspaces.lastFolder() !== path || ctx.workspaces.lastWorkspace() !== owner) await ctx.workspaces.visit({path,workspace:owner});
    const changed = path !== folder;
    folder = path;
    entries = rows;
    if (!options.retainSelection || changed) selected.clear();
    else for(const path of selected) if(!rows.some(row=>row.path===path)) selected.delete(path);
    if (options.selected) selected.add(options.selected);
    anchor = null;
    if (changed || !location.childElementCount) {
      const parts = folder.split('/');
      location.replaceChildren(...parts.slice(1).map((name,index) => {
        const target = parts.slice(0,index+2).join('/');
        return button(index ? name : workspaceName(library,target), () => go(target),{variant:'quiet'});
      }));
    }
    newNote.disabled = folder === owner;
    newNote.title = newNote.disabled ? 'Create notes inside a workspace folder' : 'New note';
    if (options.refreshTree) {
      const saved=ctx.workspaces.explorer(owner);
      if(saved?.order)order.splice(0,order.length,...saved.order);
      if(saved?.expanded)expanded.splice(0,expanded.length,...saved.expanded);
      await tree.refresh();progress.refresh('files');
    }
    tree.setSelected(folder);
    const top=list.scrollTop;
    render();
    list.scrollTop=changed?0:top;
  }
  await openFolder(folder,route);
  return {root,owner,openFolder,refresh(group, action, id) {
    progress.refresh(group);
    if (!group || group === 'task' || group === 'oath' || group === 'workspace' && ['attach','detach'].includes(action)) tasks.refresh(id);
  },mounted(options, lostFocus) {
    if (options.rename) rename(options.rename);
    else if (options.selected) [...list.children].find(row=>row.dataset.path===options.selected)?.focus();
    else if (lostFocus) location.lastElementChild.focus({preventScroll:true});
  }};
}
