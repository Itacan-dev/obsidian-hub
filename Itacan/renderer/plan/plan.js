import { el, button } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { confirmAction, field, pickPath } from '../ui/forms.js';
import { taskEditor } from '../tasks/tasks.js';

function label(ctx, entry) {
  return entry.kind === 'task' ? ctx.state.tasks.find(t => t.id === entry.ref)?.title || entry.label : entry.label;
}

async function selectReference(ctx, kind) {
  if (kind === 'note') return pickPath(ctx, 'Choose a Plan document', 'note');
  const body = el('div');
  const choices = kind === 'task' ? ctx.state.tasks.filter(t => !t.done).map(t => [t.id, t.title]) :
    [...ctx.library.projects, ...ctx.library.resources].map(w => [w.path, w.path]);
  const select = field(body, kind === 'task' ? 'Task' : 'Workspace', 'select', '', []);
  for (const [value, name] of choices) select.add(new Option(name, value));
  if (!choices.length) body.append(el('p', 'empty', 'No items available.'));
  const ok = await showDialog({
    title: 'Add ' + kind, content: body, actions: [
      { label: 'Cancel', value: false }, {
        label: 'Add', primary: true, value: true, run() {
          if (!select.value) throw Error('Choose an item first.');
        }
      }
    ]
  });
  return ok && select.value;
}

export async function dailyPlan(ctx) {
  await ctx.reloadWork();
  const body = el('div', 'daily-plan');
  let draftPlanId, draft;
  let saveNotes = async () => { };
  function render() {
    saveNotes = async () => { };
    body.replaceChildren();
    const plan = ctx.state.plan;
    if (plan) {
      const change = async (action, data) => {
        await saveNotes();
        return ctx.update('plan', action, { ...data, planId: plan.id });
      };
      body.append(el('h3', '', plan.day));
      if (draftPlanId !== plan.id) {
        draftPlanId = plan.id;
        draft = plan.note;
      }
      const note = field(body, 'Plan notes', 'textarea', draft);
      note.oninput = () => { draft = note.value; };
      saveNotes = async () => {
        if (ctx.state.plan?.note === draft) return;
        await ctx.update('plan', 'note', { note: draft, planId: plan.id });
      };
      body.append(button('Save notes', saveNotes));
      const list = el('ol', 'plan-list');
      for (const [index, entry] of plan.entries.entries()) {
        const row = el('li');
        const task = entry.kind === 'task' && ctx.state.tasks.find(t => t.id === entry.ref);
        const open = button(label(ctx, entry), async () => {
          await saveNotes();
          if (task) { await taskEditor(ctx, task); render(); return; }
          const opened = await (entry.kind === 'note' ? ctx.openNote(entry.ref) : ctx.openFolder(entry.ref));
          if (opened) body.closest('dialog')?.close();
        }, { variant: 'quiet' });
        open.disabled = !!entry.missing || entry.kind === 'task' && !task;
        row.append(el('small', 'muted', entry.kind), open);
        if (task) row.append(button(task.done ? 'Reopen' : 'Complete', async () => {
          await saveNotes();
          await ctx.update('task', 'toggle', { id: task.id }); render();
        }));
        const order = el('div', 'actions');
        for (const [action, text] of [['up', 'Up'], ['down', 'Down'], ['remove', 'Remove']]) {
          const control = button(text, async () => { await change(action, { id: entry.id }); render(); });
          control.disabled = action === 'up' && index === 0 || action === 'down' && index === plan.entries.length - 1;
          order.append(control);
        }
        row.append(order); list.append(row);
      }
      body.append(list);
      const actions = el('div', 'actions');
      for (const [kind, text] of [['task', 'Add task'], ['note', 'Add document'], ['workspace', 'Add workspace']]) {
        actions.append(button(text, async () => {
          const ref = await selectReference(ctx, kind);
          if (ref) { await change('add', { kind, ref }); render(); }
        }));
      }
      actions.append(button('Finish plan', async () => {
        if (await confirmAction('Finish this plan?', 'Keep the ordered entries and notes in daily history.', 'Finish')) {
          await change('finish'); render();
        }
      }));
      body.append(actions);
    } else body.append(button('Start today’s plan', async () => { await ctx.update('plan', 'start'); render(); }, { variant: 'primary' }));
    if (ctx.state.history.length) body.append(el('h3', '', 'Daily history'));
    for (const past of ctx.state.history) {
      const details = el('details', 'plan-history');
      details.append(el('summary', '', past.day), el('p', 'multiline', past.note));
      const list = el('ol');
      for (const item of past.entries) list.append(el('li', '', item.label + (item.done ? ' · Completed' : '')));
      details.append(list); body.append(details);
    }
  }
  render();
  return showDialog({ title: 'Daily Plan', wide: true, content: body, beforeClose: async () => {
    try { await saveNotes(); }
    catch (error) {
      if (!await confirmAction('Leave without saving Plan notes?', error.message, 'Discard notes')) throw error;
    }
  }, actions: [{ label: 'Done', value: true }] });
}

export function planPanel(ctx) {
  const root = el('section', 'panel work-panel');
  const header = el('header', 'section-heading');
  header.append(el('h2', '', 'Daily Plan'), button('Open plan', () => dailyPlan(ctx)));
  const list = el('ol', 'plan-preview');
  function refresh() {
    list.replaceChildren();
    for (const entry of ctx.state.plan?.entries || []) list.append(el('li', '', label(ctx, entry)));
    if (!list.children.length) list.append(el('li', 'empty', ctx.state.plan ? 'No entries yet.' : 'No active plan.'));
  }
  root.append(header, list); refresh(); return { root, refresh };
}
