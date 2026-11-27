import { dashboardDate } from '../ui/dashboard.js';
import { el, button, icon, report } from '../ui/elements.js';
import { inSavedOrder, reorderRows } from '../ui/reorder.js';
import { confirmAction } from '../ui/forms.js';
import { askName, showDialog } from '../ui/dialog.js';

import { taskPanel } from '../tasks/tasks.js';
import { progressPanel } from '../progress/panel.js';
import { calendarPanel } from './calendar.js';
import { planPanel } from '../plan/plan.js';
import { contextSearch } from '../ui/context-search.js';
import { onContext } from '../ui/menu.js';
import { launchShortcuts } from '../settings/settings.js';

import { resourceArt } from './artwork.js';
import './home.css';

function libraryGuide() {
  const body = el('section','library-guide');
  body.append(el('h3','','Open or create'),el('p','','Choose an empty folder to start, or choose the folder containing itacan-library.json to open existing work. Projects hold your own work. Resources hold material you can reuse in Projects.'),
    el('h3','','Try the Field Library'),el('p','','Choose Try Field Library and select a location for your copy. Open Forest survey → Field notes.md to read a sample note with an image and an equation.'),
    el('h3','','Move and recover'),el('p','','Save your documents, close Itacan, then copy the whole library folder. Choose its new location when you reopen. Keep a separate backup and use one writer when the folder is synchronized.'));
  return showDialog({title:'Library guide',content:body,actions:[{label:'Done',primary:true}]});
}
function card(entry, image, open) {
  const control = el('button', 'collection-card');
  control.title = entry.name;
  const picture = el('img');
  picture.src = '/assets/' + image + '.jpg';
  picture.alt = ''; picture.draggable=false;
  const caption = el('span', 'card-caption');
  caption.append(el('span', '', entry.name), icon('arrow'));
  control.append(picture, caption);
  control.onclick = () => open(entry.path);
  return control;
}

export function homeView(library, ctx) {
  const { chooseLibrary } = ctx;
  const openFolder = async path => {
    const saved = ctx.workspaces.explorer(path)?.folder || path;
    if (await ctx.openFolder(saved,{workspace:path}) === false && saved !== path) {
      await ctx.openFolder(path,{workspace:path});
      report('The last folder is unavailable: '+saved);
    }
  };
  const root = el('section', 'home view-width');
  const hero = el('header', 'dashboard-heading');
  const now = new Date();
  const cover = el('div','dashboard-cover home-cover');
  root.append(cover);
  const greeting = el('div'), context = el('p','muted');
  greeting.append(el('h1', '', library ? (now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening') : 'Welcome to Itacan'),context);
  hero.append(greeting,dashboardDate(now));
  root.append(hero);
  if (!library) {
    const welcome = el('section', 'welcome panel');
    welcome.append(el('h2', '', 'Open your library'), el('p', 'muted', 'Choose your Itacan folder, or select an empty folder to start a library on this device.'),
      button('Choose a folder', chooseLibrary, { variant: 'primary', symbol: 'folder' }),button('Try Field Library',ctx.chooseSample),button('Library guide',libraryGuide,{variant:'quiet'}));
    root.append(welcome);
    return { root };
  }

  const projects = el('section', 'home-section panel');
  const projectHeader = el('header', 'section-heading');
  projectHeader.append(el('h2', '', 'Projects'), button('New project', async () => {
    const name = await askName('New project');
    if (!name) return;
    await window.itacan.create(library.session, 'Projects', name, 'folder');
    library.projects = (await window.itacan.home()).library.projects;
    await ctx.reloadWork();
    renderProjects();
  }, { symbol: 'plus' }));
  projects.append(projectHeader);
  const projectGrid = el('div', 'project-grid');
  const selectors = el('div','segmented-controls');
  let status = 'Active';
  for (const value of ['Active','Future','Shelved']) {
    const control = button(value, () => { if(status===value)return;status = value; projectGrid.scrollLeft = 0; renderProjects(); });
    control.dataset.status = value;
    selectors.append(control);
  }
  reorderRows(projectGrid,'.collection-card',async (tile,index,rows)=>{
    const order=rows.map(row=>row.dataset.path);
    order.splice(index,0,order.splice(rows.indexOf(tile),1)[0]);
    await ctx.workspaces.orderProjects({path:tile.dataset.path,status,order});
    renderProjects();
    projectGrid.querySelector('[data-path="'+CSS.escape(tile.dataset.path)+'"]')?.focus({preventScroll:true});
  },true);
  const cardActions = entry => [
    {label:'Open',run:()=>openFolder(entry.path)},
    {label:'Add to plan',run:()=>ctx.plans.add({kind:'workspace',ref:entry.path})}
  ];
  function renderProjects() {
    projectGrid.replaceChildren();
    for (const control of selectors.children) {
      const value = control.dataset.status;
      const matching = library.projects.filter(p => ctx.workspaces.status(p.path) === value);
      control.textContent = value+' ('+matching.length+')';
      control.setAttribute('aria-pressed',String(status === value));
      if (value !== status) continue;
      for (const p of inSavedOrder(matching,ctx.workspaces.projectOrder(value))) {
        const tile = card(p,'project',openFolder);
        tile.draggable=true;tile.dataset.reorder='';tile.dataset.path=p.path;
        onContext(tile, () => [...cardActions(p),...['Active','Future','Shelved'].filter(s => s !== value).map(s => ({
          label:'Move to '+s, run:async () => { await ctx.workspaces.setStatus({path:p.path,status:s}); renderProjects();selectors.querySelector('[aria-pressed=true]').focus({preventScroll:true}); }
        })),{label:'Rename',run:async()=>{
          const name=await askName('Rename workspace',p.name,'Rename');
          if(name && name!==p.name && await ctx.changeFile(p.path,'Projects',name)) await ctx.refresh();
        }},{label:'Delete',run:async()=>{
          if(await confirmAction('Delete workspace?',p.name,'Delete') && await ctx.changeFile(p.path,'Projects',p.name,true)) await ctx.refresh();
        }}]);
        projectGrid.append(tile);
      }
      if (!matching.length) projectGrid.append(el('p','empty','No '+value.toLowerCase()+' projects.'));
    }
  }
  renderProjects(); projectHeader.lastElementChild.before(selectors); projects.append(projectGrid);
  const resources = el('section', 'home-section');
  resources.append(el('h2', '', 'Resources'));
  const grid = el('div', 'resource-grid');
  for (const resource of library.resources) {
    const tile=card(resource, resourceArt[resource.name] || 'research', openFolder);
    onContext(tile,()=>cardActions(resource));grid.append(tile);
  }
  resources.append(grid);
  if (library.extraResources?.length) {
    const others = el('details');
    others.append(el('summary','','Other folders in Resources'));
    if (library.extraResources.some(entry=>entry.name==='Research'))
      others.append(el('p','muted','Literature and the older Research folder both exist. Open Research here to review its files.'));
    for (const entry of library.extraResources) others.append(button(entry.name,()=>openFolder(entry.path),{symbol:'folder'}));
    resources.append(others);
  }
  const tasks = taskPanel(ctx);
  const plan = planPanel(ctx);
  const calendar=calendarPanel(ctx);
  const panels=el('div','home-panels');
  projects.append(resources);
  const progress=progressPanel(ctx);
  panels.append(calendar.root,plan.root,tasks.root,projects,progress.root);
  const commands = el('div','home-commands');
  commands.append(contextSearch(ctx),launchShortcuts(ctx));
  root.append(commands,panels);
  function refreshContext() {
    const today = new Date().toLocaleDateString('sv-SE');
    const count = ctx.tasks.list().filter(t=>!t.done && !(t.start>today) && ctx.workspaces.status(t.owner)==='Active').length;
    context.textContent = count ? 'You have '+count+' task'+(count===1?'':'s')+' to do.' : 'Your task list is empty — add something to work on.';
  }
  refreshContext();
  return { root, mounted:calendar.goToToday, refresh(group, action, id) {
    progress.refresh(group);
    if (group === 'oath') tasks.refresh();
    if (!group || group === 'task' || group === 'workspace' && action === 'status') {
      tasks.refresh(id); calendar.refresh(); refreshContext();
    }
    if (!group || group === 'plan' || group === 'task' && ctx.plans.current()?.entries.some(e => e.kind === 'task' && (!id || e.ref === id))) plan.refresh(group === 'task' ? id : undefined);
  } };
}
