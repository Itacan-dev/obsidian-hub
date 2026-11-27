import { el, button, report } from '../ui/elements.js';
import { splitLayout, splitPane, mountSplits } from './splits.js';
import { resizeDivider } from './divider.js';
import { onContext } from '../ui/menu.js';
import { pickPath } from '../ui/forms.js';
import { mediaView } from '../document/media.js';
import { documentView } from '../document/document.js';
import {fileDrag,fileDragType} from './file-drag.js';
import {paneDrop} from './pane-drop.js';
import { fileTree } from './tree.js';
import { taskPanel } from '../tasks/tasks.js';

export function addTab(layout, file, edit, placement) {
  if (placement === 'split' || placement === 'below') {
    const next={file,tabs:[file],edit};
    splitPane(layout,layout.panes[layout.active],next,placement==='below'?'column':'row');
    layout.panes.splice(++layout.active,0,next);
    return true;
  }
  const pane = layout.panes[layout.active];
  if (pane.file === file && pane.edit === edit) return false;
  if (!pane.tabs.includes(file)) {
    if (placement === 'replace' && pane.file) pane.tabs.splice(pane.tabs.indexOf(pane.file),1,file);
    else pane.tabs.push(file);
  }
  pane.file = file;
  pane.edit = edit;
  return true;
}

// Reading positions belong to an open tab in one pane, including a visit away from the desk.
const positionsByPane = new WeakMap();

export async function deskView(ctx, anchor) {
  const { layout, documents } = ctx;
  const root = el('section', 'desk');
  const grid = el('div', 'desk-grid');
  const panes = el('div', 'panes');
  const hosts = new Map();
  const rail = el('aside','desk-rail');
  const railHeading = el('header','rail-heading');
  const navigationHost = el('div','rail-navigation');
  const panels = el('div','rail-panels');
  rail.append(railHeading,navigationHost,panels);
  let tree, tasks, explorer, workspace;
  function snapshot() {
    splitLayout(layout);
    for (const [pane,part] of hosts) {
      if (part.view && pane.tabs.includes(part.file)) (pane.views ||= {})[part.file]=part.view.snapshot();
      if (pane.views) for (const file of Object.keys(pane.views)) if (!pane.tabs.includes(file)) delete pane.views[file];
    }
    return structuredClone(layout);
  }
  const remember = () => ctx.presets.remember({layout:snapshot()});
  const current = () => layout.panes[layout.active];
  const railDrag=fileDrag(async (paths,parent)=>{
    await remember();
    for(const path of paths) await ctx.changeFile(path,parent,path.split('/').at(-1));
    await ctx.showDesk();
  },async (files,parent)=>{
    ctx.install(await window.itacan.importFiles(ctx.library.session,parent,files),'files');
    await explorer.refresh();
  });
  function showContext() {
    const folder = ctx.workspaces.contextFor(current().file,layout.workspace);
    layout.workspace=folder;
    if (!layout.folder?.startsWith(folder+'/') && layout.folder !== folder) layout.folder = ctx.workspaces.explorer(folder)?.folder || folder;
    if (folder !== workspace) {
      workspace = folder;
      if (!layout.expanded) {
        const parts=current().file.split('/');
        layout.expanded=parts.slice(2,-1).map((_,i)=>parts.slice(0,i+3).join('/'));
      }
      const order=[...(ctx.workspaces.explorer(folder)?.order || [])];
      const reorderFolders=()=>ctx.workspaces.saveExplorer({
        expanded:[],folder,...ctx.workspaces.explorer(folder),path:folder,order
      });
      explorer=fileTree(ctx,folder,{expanded:layout.expanded,fileDrag:railDrag,folderOrder:order,reorderFolders,
        activeFile:()=>current().file,changed:remember});
      tree = explorer.root;
      tasks = taskPanel(ctx,folder,()=>current().file);
      railHeading.replaceChildren(explorer.header);
      panels.replaceChildren(tree,tasks.root);
    }
    for (const [pane, part] of hosts) part.host.classList.toggle('selected-pane', pane === current());
    for (const btn of tree?.querySelectorAll('[data-path]') || []) {
      if (btn.dataset.path===current().file) btn.setAttribute('aria-current','page'); else btn.removeAttribute('aria-current');
    }
    ctx.noteBreadcrumb(current().file);
  }
  function activate(pane,file) {
    pane.file=file;
    pane.edit=pane.views?.[file]?.editing ?? false;
    layout.active=layout.panes.indexOf(pane);
  }
  function removeTab(pane,file) {
    const active=current(), index=pane.tabs.indexOf(file);
    if(index<0)return;
    pane.tabs.splice(index,1);
    if (pane.file===file) activate(pane,pane.tabs[Math.min(index,pane.tabs.length-1)] || '');
    if (!pane.tabs.length && layout.panes.length>1) layout.panes.splice(layout.panes.indexOf(pane),1);
    layout.active=layout.panes.includes(active)?layout.panes.indexOf(active):Math.min(layout.active,layout.panes.length-1);
  }
  async function closeTabs(pane,files) {
    const closing=files.filter(file=>!layout.panes.some(p=>p!==pane && p.tabs.includes(file))).map(file=>documents.open.get(file)).filter(Boolean);
    if (!await documents.allowClose(closing)) return;
    for (const buffer of closing) documents.open.delete(buffer.path);
    for (const file of files) removeTab(pane,file);
    await remember(); await ctx.showDesk();
  }
  const tabType='application/x-itacan-tab';
  let drag;
  async function moveTab(from,file,to,index,edge) {
    if(from===to && !edge && from.tabs.indexOf(file)===index)return;
    if(!from)file=(await documents.get(file)).path;
    snapshot();
    if(edge) {
      const next={tabs:[],file:'',edit:false};
      const before=edge==='left' || edge==='top';
      splitPane(layout,to,next,edge==='left' || edge==='right'?'row':'column',before);
      layout.panes.splice(layout.panes.indexOf(to)+Number(!before),0,next);
      to=next;index=0;
    }
    if (from===to) {
      to.tabs.splice(to.tabs.indexOf(file),1);
      to.tabs.splice(index,0,file);
    } else {
      const prefs=from?.views?.[file];
      if(from)removeTab(from,file);
      if (!to.tabs.includes(file)) {
        to.tabs.splice(index,0,file);
        if(prefs)(to.views ||= {})[file]=prefs;
      }
    }
    activate(to,file);await remember();await ctx.showDesk();
  }
  function bindTab(tab,pane,path) {
    tab.draggable=true;
    tab.ondragstart=e=>{drag={pane,path};e.dataTransfer.setData(tabType,path);e.dataTransfer.effectAllowed='move';};
    tab.ondragend=()=>{drag=null;};
    tab.onmousedown=e=>{if(e.button===1)e.preventDefault();};
    tab.onauxclick=e=>{if(e.button===1){e.preventDefault();closeTabs(pane,[path]).catch(report);}};
    onContext(tab,()=>{
      const options=[{label:'Close tab',run:()=>closeTabs(pane,[path])},
        {label:'Close pane',run:()=>closeTabs(pane,[...pane.tabs])},
        {label:'Split right',run:()=>ctx.openNote(path,pane.edit,'','split')},
        {label:'Split below',run:()=>ctx.openNote(path,pane.edit,'','below')}];
      for(const [index,target] of layout.panes.entries())if(target!==pane)
        options.push({label:'Move to pane '+(index+1),run:()=>moveTab(pane,path,target,target.tabs.length)});
      for(const [delta,label] of [[-1,'Move tab earlier'],[1,'Move tab later']]){
        const at=pane.tabs.indexOf(path)+delta;
        if(at>=0 && at<pane.tabs.length)options.push({label,run:()=>moveTab(pane,path,pane,at)});
      }
      return options;
    });
  }
  function createPane(pane) {
    const host = el('div', 'pane');
    const tabs = el('div', 'tabs');
    host.append(tabs);
    function select() {
      const index = layout.panes.indexOf(pane);
      if (layout.active === index || index < 0) return;
      layout.active = index;
      showContext();
      void remember().catch(report);
    }
    const observe=e=>{if(e.isTrusted)ctx.observeWorkspace(pane.file);};
    for(const type of ['pointerdown','wheel','keydown']) host.addEventListener(type,observe,{passive:true});
    host.addEventListener('pointerdown', select);
    host.addEventListener('focusin', select);
    panes.append(host);
    function dragged(event) {
      const types=event.dataTransfer.types;
      if(types.includes(tabType))return drag;
      if(types.includes(fileDragType) && railDrag.paths.length===1 && /\.(?:md|pdf|png|jpe?g|webp|gif|avif)$/i.test(railDrag.paths[0]))
        return {path:railDrag.paths[0]};
    }
    const clearDrop=paneDrop(host,pane,dragged,(source,to,index,edge)=>{
      drag=null;railDrag.finish();
      return moveTab(source.pane,source.path,to,index,edge);
    });
    const positions = positionsByPane.get(pane) || new Map();
    positionsByPane.set(pane, positions);
    const part = { host, tabs, positions, clearDrop };
    hosts.set(pane, part);
    return part;
  }
  async function syncDesk(anchor) {
    const changed=[];
    for (const [pane, part] of hosts) {
      if (layout.panes.includes(pane)) continue;
      part.view?.dispose(); part.host.remove(); hosts.delete(pane);
    }
    for (const pane of layout.panes) {
      const part = hosts.get(pane) || createPane(pane);
      for (const wrap of [...part.tabs.children]) {
        if (!pane.tabs.includes(wrap.dataset.file)) {
          part.positions.delete(wrap.dataset.file);wrap.remove();
        }
      }
      for (const [index,path] of pane.tabs.entries()) {
        let wrap=[...part.tabs.children].find(w=>w.dataset.file===path);
        if(!wrap) {
          wrap=el('div','document-tab');wrap.dataset.file=path;
          const name=path.split('/').at(-1);
          const tab=button(name,async()=>{
            if (pane.file===path) return;
            activate(pane,path);await remember();await ctx.showDesk();
          });
          tab.title=tab.dataset.path=path;bindTab(tab,pane,path);
          const close=button('',()=>closeTabs(pane,[path]),{variant:'tab-close',symbol:'close'});
          close.title='Close '+name;close.setAttribute('aria-label',close.title);
          wrap.append(tab,close);
        }
        if(part.tabs.children[index]!==wrap)part.tabs.insertBefore(wrap,part.tabs.children[index] || null);
        wrap.firstElementChild.setAttribute('aria-pressed',String(path===pane.file));
      }
      if (part.file === pane.file && part.view) {
        if (pane === current()) part.view.display(pane.edit, anchor);
        continue;
      }
      let next, content;
      try {
        const buffer = await documents.get(pane.file);
        const position = part.positions.get(pane.file) || {...pane.views?.[pane.file],read:pane.views?.[pane.file]?.read || 0};
        part.positions.set(pane.file,position);
        next = buffer.kind ? mediaView(buffer,position) : documentView(buffer, pane, {
          openNote:ctx.openNote, pickCopyFolder:()=>pickPath(ctx,'Choose a folder for the recovered copy','folder'), anchor: pane === current() ? anchor : '', position,
          changedMode: () => void remember().catch(report)
        });
        content = next.root;
      } catch (error) {
        content = el('section','empty');
        const path=pane.file;
        content.append(el('p','','Document unavailable · '+path+' · '+error.message),button('Relink document',async()=>{
          const selected=await pickPath(ctx,'Relink document','document','');
          if (!selected)return;
          const file=(await documents.get(selected)).path;
          await ctx.relinkDocument(path,file);
          for(const other of layout.panes) {
            other.tabs=[...new Set(other.tabs.map(tab=>tab===path?file:tab))];
            if(other.file===path)other.file=file;
            if(other.views?.[path]){other.views[file]=other.views[path];delete other.views[path];}
          }
          activate(pane,file);await remember();await ctx.showDesk();
        }));
      }
      if (part.view && pane.tabs.includes(part.file)) (pane.views ||= {})[part.file]=part.view.snapshot();
      part.view?.dispose();
      if (part.host.lastElementChild === part.tabs) part.host.append(content);
      else part.host.lastElementChild.replaceWith(content);
      part.view = next;
      part.file = pane.file;
      changed.push(part);
    }
    arrange();
    // Restore offsets only after a new split has its final viewport.
    if(root.isConnected)for(const part of changed) {
      part.view?.mounted();
      part.tabs.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest',container:'nearest'});
    }
    showContext();
  }
  root.addEventListener('dragend',()=>{drag=null;for(const part of hosts.values())part.clearDrop();});
  let renderedTree,renderedPanes=[];
  function arrange(){
    const tree=splitLayout(layout);
    if(tree===renderedTree && renderedPanes.length===layout.panes.length &&
       layout.panes.every((p,i)=>p===renderedPanes[i]))return;
    const elements=new Map(layout.panes.map(p=>[p.id,hosts.get(p).host]));
    mountSplits(tree,elements,panes,remember);
    renderedTree=tree;renderedPanes=[...layout.panes];
  }
  const railToggle = button('', async () => {
    layout.railClosed = !layout.railClosed; styleRail(); await remember();
  },{symbol:'back',variant:'icon-button rail-toggle'});
  function styleRail() {
    grid.classList.toggle('closed-rail',!!layout.railClosed);
    if (layout.railWidth) grid.style.setProperty('--rail-width',layout.railWidth+'px');
    else grid.style.removeProperty('--rail-width');
    railToggle.setAttribute('aria-expanded',String(!layout.railClosed));
    railToggle.title = layout.railClosed ? 'Show workspace rail' : 'Hide workspace rail';
    railToggle.setAttribute('aria-label',railToggle.title);
  }
  // CSS measures the responsive full rail. Only a deliberate adjustment is saved.
  const fullRail=el('div','rail-measure');
  grid.append(fullRail);
  const divider = resizeDivider('Workspace rail width', () => rail.offsetWidth,
    width => {
      layout.railWidth=Math.round(Math.max(170,Math.min(width,fullRail.offsetWidth)));
      styleRail();
    }, remember, {rememberSize:()=>{
      const previous=layout.railWidth;
      return ()=>{layout.railWidth=previous;styleRail();};
    }});
  divider.onkeydown=e=>{
    const full=fullRail.offsetWidth, half=Math.max(170,Math.round(full/2));
    const sizes={Home:0,End:full,ArrowLeft:rail.offsetWidth>half+1?half:0,ArrowRight:full};
    if (!(e.key in sizes)) return;
    e.preventDefault();
    const width=sizes[e.key];
    layout.railClosed=width===0;
    if(width===full) delete layout.railWidth;
    else if(width) layout.railWidth=width;
    styleRail();
    if(layout.railClosed) railToggle.focus();
    remember().catch(report);
  };
  divider.ondblclick=()=>{delete layout.railWidth;styleRail();remember().catch(report);};
  styleRail();
  grid.append(rail,divider,panes,railToggle); root.append(grid);
  await syncDesk(anchor);
  return {
    root, navigationHost, syncDesk, snapshot,
    closeTab:()=>closeTabs(current(),[current().file]),
    cycleTab:async step=>{
      const pane=current(), count=pane.tabs.length;
      if(count<2)return;
      activate(pane,pane.tabs[(pane.tabs.indexOf(pane.file)+step+count)%count]);
      await remember();await ctx.showDesk();
    },
    refresh(group,action,id) {if (!group || group === 'task' || group === 'oath') tasks?.refresh(id);}, save: () => documents.open.get(current().file)?.save().catch(report),
    mounted: () => { for (const [pane,part] of hosts) part.view?.mounted(pane === current()); },
    dispose: () => { for (const part of hosts.values()) part.view?.dispose(); }
  };
}
