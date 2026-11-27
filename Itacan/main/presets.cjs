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
module.exports = { updateLayout };
