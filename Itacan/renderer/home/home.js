import { el, button, icon } from '../ui/elements.js';
import { askName } from '../ui/dialog.js';

import { taskPanel } from '../tasks/tasks.js';
import { planPanel } from '../plan/plan.js';
import { confirmAction } from '../ui/forms.js';

const resourceArt = { Knowledge: 'knowledge', Research: 'research', Explorations: 'explorations', Inspiration: 'inspiration' };
function card(entry, image, open) {
  const control = el('button', 'collection-card');
  const picture = el('img');
  picture.src = '/assets/' + image + '.jpg';
  picture.alt = '';
  const caption = el('span', 'card-caption');
  caption.append(el('span', '', entry.name), icon('arrow'));
  control.append(picture, caption);
  control.onclick = () => open(entry.path);
  return control;
}

export function homeView(library, ctx) {
  const { openFolder, chooseLibrary, refresh } = ctx;
  const root = el('section', 'home view-width');
  const hero = el('header', 'home-cover');
  const now = new Date();
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  hero.append(el('p', 'cover-date', date.format(now)),
    el('h1', '', library ? (now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening') : 'Welcome to Itacan'));
  root.append(hero);
  if (!library) {
    const welcome = el('section', 'welcome panel');
    welcome.append(el('h2', '', 'Open your library'), el('p', 'muted', 'Choose your Itacan folder, or select an empty folder to start a library on this device.'),
      button('Choose a folder', chooseLibrary, { variant: 'primary', symbol: 'folder' }));
    root.append(welcome);
    return { root };
  }

  const projects = el('section', 'home-section');
  const projectHeader = el('header', 'section-heading');
  projectHeader.append(el('h2', '', 'Projects'), button('New project', async () => {
    const name = await askName('New project');
    if (!name) return;
    await window.itacan.create(library.session, 'Projects', name, 'folder');
    await refresh();
  }, { symbol: 'plus' }));
  projects.append(projectHeader);
  const projectGrid = el('div', 'project-grid');
  for (const project of library.projects) projectGrid.append(card(project, 'project', openFolder));
  if (!library.projects.length) projectGrid.append(el('p', 'empty', 'Your projects will appear here.'));
  projects.append(projectGrid);

  const resources = el('section', 'home-section');
  resources.append(el('h2', '', 'Resources'));
  const grid = el('div', 'resource-grid');
  for (const resource of library.resources) grid.append(card(resource, resourceArt[resource.name] || 'research', openFolder));
  resources.append(grid);
  const desk = el('div','home-desk actions');
  if (ctx.layout.panes.some(p => p.file)) desk.append(button('Resume documents', ctx.showDesk));
  for (const preset of ctx.state.presets) {
    desk.append(button(preset.name, () => ctx.restore(preset.layout)), button('Remove ' + preset.name, async () => {
      if (!await confirmAction('Remove layout?',preset.name,'Remove')) return;
      await ctx.update('layout','remove',{name:preset.name});
      await refresh();
    }, {variant:'quiet'}));
  }
  const tasks = taskPanel(ctx);
  const plan = planPanel(ctx);
  root.append(desk, projects, resources, tasks.root, plan.root);
  return { root, refresh() { tasks.refresh(); plan.refresh(); } };
}
