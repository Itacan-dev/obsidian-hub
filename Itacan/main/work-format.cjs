const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string';
const strings = value => Array.isArray(value) && value.every(text);
const timestamp = value => text(value) && Number.isFinite(Date.parse(value));
const explorer = value => record(value) && strings(value.expanded) &&
  (value.folder === undefined || text(value.folder)) && (value.order === undefined || strings(value.order));

function validLayout(layout) {
  if (!record(layout) || !Array.isArray(layout.panes) || !Number.isInteger(layout.active) || !layout.panes[layout.active]) return false;
  if (layout.expanded !== undefined && !strings(layout.expanded) || layout.explorer !== undefined && !explorer(layout.explorer)) return false;
  if ([layout.workspace,layout.folder].some(path => path !== undefined && !text(path))) return false;
  return layout.panes.every(pane => record(pane) && strings(pane.tabs) && (pane.file == null || text(pane.file)) &&
    (pane.file ? pane.tabs.includes(pane.file) : !pane.tabs.length) &&
    (pane.views === undefined || record(pane.views)));
}

function plan(value) {
  if (!record(value) || !text(value.id) || !text(value.note) || !/^\d{4}-\d\d-\d\d$/.test(value.day)) return false;
  const day = new Date(value.day + 'T00:00:00Z');
  if (!Number.isFinite(+day) || day.toISOString().slice(0,10) !== value.day) return false;
  // Version 0.2 Plans only had id, day, note and entries before they finished.
  if ([value.started,value.endsAt,value.finished].some(at => at !== undefined && !timestamp(at))) return false;
  return Array.isArray(value.entries) && value.entries.every(entry => record(entry) && text(entry.id) &&
    ['task','note','file','workspace'].includes(entry.kind) && text(entry.ref) && text(entry.label));
}

function oath(value) {
  return record(value) && text(value.id) && text(value.owner) && text(value.day) && timestamp(value.startsAt) &&
    ['manual','duration','tasks'].includes(value.condition) && strings(value.taskIds) &&
    Array.isArray(value.selected) && value.selected.every(task => record(task) && text(task.id) && text(task.title)) &&
    Array.isArray(value.rests) && value.rests.every(rest => record(rest) && timestamp(rest.start) &&
      (rest.end === undefined || timestamp(rest.end))) &&
    (value.startedAt == null || timestamp(value.startedAt)) && (value.endsAt === undefined || timestamp(value.endsAt));
}

function validateStoredWork(state) {
  if (!record(state) || state.version !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.inbox)) throw Error('Unknown library work format.');
  function invalid(field) { throw Error('Invalid library ' + field + '. Preserve the work file for recovery.'); }
  if (state.revision !== undefined && (!Number.isSafeInteger(state.revision) || state.revision < 0)) invalid('revision');
  if (state.lastLayout != null && !validLayout(state.lastLayout)) invalid('last layout');
  if (state.plan != null && !plan(state.plan)) invalid('Plan');
  if (state.oath != null && (!oath(state.oath) || !['scheduled','active','rest'].includes(state.oath.status) ||
      state.oath.status === 'rest' && (!timestamp(state.oath.restUntil) || !state.oath.rests.length))) invalid('Oath');
  const capture = item => record(item) && text(item.id) && (text(item.text) || text(item.name));
  const lists = {
    tasks: item => record(item) && text(item.id) && text(item.title) && text(item.owner) && Array.isArray(item.steps) &&
      item.steps.every(step => record(step) && text(step.text)),
    inbox: capture, quickFiles: capture,
    history: item => plan(item) && timestamp(item.finished),
    presets: item => record(item) && text(item.name) && validLayout(item.layout),
    reports: item => record(item) && text(item.day) && text(item.owner) && text(item.updated),
    activity: item => record(item) && text(item.day) && text(item.owner) && text(item.action),
    oathHistory: item => oath(item) && timestamp(item.endedAt) && text(item.status),
    playlist: text
  };
  for (const [field,valid] of Object.entries(lists)) {
    if (state[field] !== undefined && (!Array.isArray(state[field]) || !state[field].every(valid))) invalid(field);
  }
  const maps = {workspaceLayouts:validLayout, explorers:explorer, sharedFolders:strings, projectOrder:strings};
  for (const [field,valid] of Object.entries(maps)) {
    if (state[field] !== undefined && (!record(state[field]) || !Object.values(state[field]).every(valid))) invalid(field);
  }
}

module.exports = {validateStoredWork,validLayout};
