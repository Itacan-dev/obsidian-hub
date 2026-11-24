import { el, button } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { field, pickPath, confirmAction } from '../ui/forms.js';

export async function taskEditor(ctx, original = {}, captureId) {
  const body = el('div', 'task-form');
  const owners = [...ctx.library.projects, ...ctx.library.resources].map(o => o.path);
  const title = field(body, 'Title', 'text', original.title || ''); title.required = true;
  const owner = field(body, 'Workspace', 'select', original.owner || owners[0], owners);
  const description = field(body, 'Description', 'textarea', original.description || '');
  let location = original.location || '';
  const locationButton = button(location || 'Choose note or folder', async () => {
    const path = await pickPath(ctx, 'Task location', 'location', owner.value);
    if (path) { location = path === owner.value ? '' : path; locationButton.textContent = location || 'Choose note or folder'; }
  });
  function clear() { location = ''; locationButton.textContent = 'Choose note or folder'; }
  owner.onchange = clear;
  const links = el('div', 'actions'); links.append(locationButton, button('Clear location', clear)); body.append(links);
  const grid = el('div', 'task-dates'); body.append(grid);
  const start = field(grid, 'Start date', 'date', original.start);
  const due = field(grid, 'Due date', 'date', original.due);
  const startTime = field(grid, 'Start time', 'time', original.startTime);
  const dueTime = field(grid, 'Due time', 'time', original.dueTime);
  const importance = field(grid, 'Importance', 'select', original.importance, ['', 'Should do', 'Must do']);
  const repeat = field(grid, 'Repeat', 'select', original.repeat, ['', 'daily', 'weekly']);
  const interval = field(grid, 'Repeat every', 'number', original.interval || 1); interval.min = 1; interval.max = 366;
  const steps = el('div', 'task-steps'); body.append(el('strong', '', 'Steps'), steps);
  function addStep(step = {}) {
    const row = el('div', 'actions');
    const done = el('input'); done.type = 'checkbox'; done.checked = !!step.done; done.setAttribute('aria-label', 'Step complete');
    const text = el('input'); text.value = step.text || ''; text.setAttribute('aria-label', 'Step text');
    row.append(done, text, button('Remove', () => row.remove()));
    steps.append(row); return text;
  }
  for (const step of original.steps || []) addStep(step);
  body.append(button('Add step', () => addStep().focus()));
  const actions = [{ label: 'Cancel', value: false }];
  if (original.id) actions.push({
    label: 'Delete task', value: true, run: async () => {
      if (!await confirmAction('Delete task?', original.title, 'Delete')) throw Error('Task retained.');
      await ctx.update('task', 'delete', { id: original.id });
    }
  });
  actions.push({
    label: 'Save task', value: true, primary: true, run: () => ctx.update('task', 'save', {
      id: original.id, captureId, title: title.value, description: description.value, owner: owner.value, location,
      start: start.value, due: due.value, startTime: startTime.value, dueTime: dueTime.value, repeat: repeat.value,
      interval: interval.value, importance: importance.value, steps: [...steps.children].map(row => {
        const [done, text] = row.querySelectorAll('input'); return { text: text.value, done: done.checked };
      })
    })
  });
  return showDialog({ title: original.id ? 'Edit task' : 'New task', content: body, actions, wide: true });
}

export function taskPanel(ctx, owner) {
  const panel = el('section', 'panel work-panel');
  const header = el('header', 'section-heading');
  header.append(el('h2', '', 'Tasks'), button('New task', () => taskEditor(ctx, { owner }), { symbol: 'plus' }));
  const filter = field(panel, 'Show tasks', 'select', 'Open', ['Open', 'Completed', 'All']);
  panel.prepend(header);
  const list = el('div', 'task-list'); panel.append(list);
  function refresh() {
    list.replaceChildren();
    const tasks = ctx.state.tasks.filter(t => (!owner || owner === t.owner) &&
      (filter.value === 'All' || t.done === (filter.value === 'Completed'))).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    for (const task of tasks) {
      const row = el('div', 'task-row');
      row.append(button(task.done ? 'Reopen' : 'Complete', () => ctx.update('task', 'toggle', { id: task.id })),
        button(task.title, () => taskEditor(ctx, task), { variant: 'quiet' }),
        el('small', 'muted', [owner ? '' : task.owner.split('/').at(-1), task.importance, task.due].filter(Boolean).join(' · ')));
      if (task.location) row.append(button('Location', async () => {
        if (/\.md$/i.test(task.location)) await ctx.openNote(task.location);
        else await ctx.openFolder(task.location);
      }));
      list.append(row);
    }
    if (!tasks.length) list.append(el('p', 'empty', 'No matching tasks.'));
  }
  filter.onchange = refresh; refresh(); return { root: panel, refresh };
}
