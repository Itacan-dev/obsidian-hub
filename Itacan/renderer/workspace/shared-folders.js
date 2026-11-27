import { el, button, report } from '../ui/elements.js';
import { field } from '../ui/forms.js';
import { showDialog } from '../ui/dialog.js';

export async function attachFolder(ctx, project) {
  const resources = ctx.library.resources;
  const body = el('div', 'path-picker');
  const resource = field(body, 'Resource', 'select', resources[0].name, resources.map(item => item.name));
  const trail = el('nav', 'actions');
  const list = el('div', 'picker-list');
  body.append(trail, list);
  let path, request = 0;
  const source = () => resources.find(item => item.name === resource.value);
  async function enter(folder) {
    const ticket = ++request;
    path = null;
    list.replaceChildren();
    trail.replaceChildren();
    const children = await window.itacan.entries(ctx.library.session,folder);
    if (ticket !== request) return;
    path = folder;
    const root = source().path;
    trail.append(button(source().name, () => enter(root), {variant:'quiet'}));
    let current = root;
    for (const name of folder.slice(root.length + 1).split('/').filter(Boolean)) {
      current += '/' + name;
      const target = current;
      trail.append(button(name, () => enter(target), {variant:'quiet'}));
    }
    for (const child of children.filter(item => item.kind === 'folder'))
      list.append(button(child.name, () => enter(child.path), {symbol:'folder'}));
    if (!list.children.length) list.append(el('p','empty','No subfolders.'));
  }
  resource.onchange = () => enter(source().path).catch(report);
  await enter(source().path);
  return showDialog({ title:'Attach Resource folder', content:body, actions:[
    {label:'Cancel', value:false},
    {label:'Attach folder', primary:true, value:true, run:async () => {
      if (!path || path === source().path) throw Error('Choose a folder inside the Resource.');
      await ctx.workspaces.attachFolder({project,folder:path});
    }}
  ]});
}
