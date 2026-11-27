const {validName} = require('./library.cjs');
const {validLayout} = require('./work-format.cjs');

function updateLayout(state, action, {name, layout, next}) {
  const index = state.presets.findIndex(p => p.name === name);
  if (['rename','up','down','reorder'].includes(action)) {
    if (index < 0) throw Error('Preset is unavailable.');
    if (action === 'rename') {
      validName(next);
      if (state.presets.some(p => p.name === next && p.name !== name)) throw Error('Name already in use.');
      state.presets[index].name = next;
    } else {
      const to = action==='reorder' ? state.presets.findIndex(p=>p.name===next) : index + (action === 'up' ? -1 : 1);
      if (to >= 0 && to < state.presets.length) state.presets.splice(to,0,state.presets.splice(index,1)[0]);
    }
    return;
  }
  if (action === 'remove') {
    state.presets = state.presets.filter(preset => preset.name !== name);
    return;
  }
  if (!validLayout(layout)) throw Error('Invalid document layout.');
  if (action === 'remember') {
    state.lastLayout = layout;
    const owner = layout.workspace || layout.folder?.split('/').slice(0,2).join('/');
    if (owner) (state.workspaceLayouts ||= {})[owner] = structuredClone(layout);
  }
  else if (action === 'preset') {
    validName(name);
    if (index >= 0) state.presets[index].layout = layout;
    else state.presets.push({name, layout});
  } else throw Error('Unknown layout action.');
}

function movePathKeys(records, moved) {
  const entries = [];
  for (const [path, value] of Object.entries(records)) {
    const destination = moved(path);
    if (destination) entries.push([destination, value]);
  }
  return Object.fromEntries(entries);
}

function rewriteLayoutRefs(state, moved) {
  if (state.workspaceLayouts) state.workspaceLayouts = movePathKeys(state.workspaceLayouts, moved);
  const layouts = new Set([
    state.lastLayout,
    ...Object.values(state.workspaceLayouts || {}),
    ...state.presets.map(preset => preset.layout)
  ]);
  for (const layout of layouts) {
    if (!layout) continue;
    if (layout.workspace) layout.workspace = moved(layout.workspace);
    if (layout.explorer) {
      const explorer = layout.explorer;
      if (explorer.order) explorer.order = explorer.order.map(moved).filter(Boolean);
      explorer.folder = moved(explorer.folder);
      explorer.expanded = explorer.expanded.map(moved).filter(Boolean);
    }
    if (layout.folder) layout.folder = moved(layout.folder);
    if (layout.expanded) layout.expanded = layout.expanded.map(moved).filter(Boolean);
    for (const pane of layout.panes) {
      if (pane.views) pane.views = movePathKeys(pane.views, moved);
      pane.tabs = pane.tabs.map(moved).filter(Boolean);
      pane.file = moved(pane.file) || pane.tabs[0] || '';
    }
    layout.panes = layout.panes.filter(pane => pane.file);
    if (!layout.panes.length) layout.panes.push({ file: '', tabs: [], edit: false });
    layout.active = Math.min(layout.active, layout.panes.length - 1);
  }
}

module.exports = { rewriteLayoutRefs, updateLayout };
