import { button, el, report } from '../ui/elements.js';
import { showDialog } from '../ui/dialog.js';
import { field } from '../ui/forms.js';
import { taskEditor } from '../tasks/tasks.js';
import './oath.css';

const conditions = {
  duration: 'Fixed duration',
  manual: 'Until ended',
  tasks: 'Until selected tasks are complete'
};

function taskCandidates(ctx, owner) {
  return ctx.tasks.list().filter(task => !task.done && ctx.tasks.inWorkspace(owner, task));
}

async function setup(ctx) {
  const body = el('div', 'oath-form');
  const workspaces = [...ctx.library.projects, ...ctx.library.resources].map(workspace => workspace.path);
  if (!workspaces.length) throw Error('Create a workspace before taking an Oath.');
  const lastWorkspace = ctx.workspaces.lastWorkspace() || ctx.workspaces.lastFolder()?.split('/').slice(0, 2).join('/');
  const owner = field(body, 'Workspace', 'select', workspaces.includes(lastWorkspace) ? lastWorkspace : workspaces[0], workspaces);
  const timing = el('div', 'oath-fields');
  const fulfilment = el('div', 'oath-fields');
  body.append(timing, fulfilment);
  const when = field(timing, 'Start', 'select', 'Now', ['Now', 'Schedule']);
  const start = field(timing, 'Scheduled start', 'datetime-local');
  function showSchedule() {
    start.parentElement.hidden = when.value === 'Now';
    start.required = !start.parentElement.hidden;
  }
  when.onchange = showSchedule;
  showSchedule();

  const condition = field(fulfilment, 'Fulfilment', 'select', conditions.duration, Object.values(conditions));
  const minutes = field(fulfilment, 'Duration in minutes', 'number', 50);
  minutes.min = 1;
  minutes.max = 10080;
  function showDuration() {
    minutes.parentElement.hidden = condition.value !== conditions.duration;
    minutes.required = !minutes.parentElement.hidden;
  }
  condition.onchange = showDuration;
  showDuration();

  const list = el('fieldset', 'oath-tasks');
  const selected = new Set();
  function showTasks() {
    list.replaceChildren(el('legend', '', 'Selected work'));
    const tasks = taskCandidates(ctx, owner.value);
    for (const task of tasks) {
      const row = el('label');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = selected.has(task.id);
      box.onchange = () => box.checked ? selected.add(task.id) : selected.delete(task.id);
      row.append(box, task.title);
      list.append(row);
    }
    if (!tasks.length) list.append(el('p', 'empty', 'Create a task for this session.'));
  }
  owner.onchange = () => {
    selected.clear();
    showTasks();
  };
  showTasks();
  body.append(list, button('New task', async () => {
    const existing = new Set(ctx.tasks.list().map(task => task.id));
    await taskEditor(ctx, { owner: owner.value });
    for (const task of taskCandidates(ctx, owner.value)) {
      if (!existing.has(task.id)) selected.add(task.id);
    }
    showTasks();
  }));
  body.append(el('p', 'oath-pledge', 'I solemnly swear that I will do the work, the whole work, and nothing but the work.'));
  return showDialog({
    title: 'Take a Regular Oath',
    description: 'Commit to one workspace and its attached folders. Itacan keeps you in that workspace until fulfilment or Break Oath. Other applications and their notifications remain available.',
    content: body,
    actions: [
      { label: 'Cancel', value: false },
      {
        label: 'Take Oath', value: true, primary: true,
        run: () => ctx.oaths.start({
          owner: owner.value,
          condition: Object.keys(conditions).find(key => conditions[key] === condition.value),
          taskIds: [...selected],
          minutes: minutes.valueAsNumber,
          startsAt: when.value === 'Schedule' ? new Date(start.value).toISOString() : null
        })
      }
    ]
  });
}

export async function confirmBreak(ctx) {
  const oath = ctx.oaths.current();
  if (!oath) return true;
  return showDialog({
    title: 'Break this Oath?',
    description: 'Breaking ends this commitment and records the outcome in Oath history.',
    actions: [
      { label: 'Keep Oath', value: false, primary: true },
      { label: 'Break Oath', value: true, run: () => ctx.oaths.break({ id: oath.id }) }
    ]
  });
}

async function activeDialog(ctx, oath) {
  const body = el('div', 'oath-form');
  const heading = el('strong', 'oath-condition', conditions[oath.condition]);
  const status = el('p', 'muted oath-status');
  const list = el('div', 'oath-tasks');
  const actions = el('div', 'actions oath-actions');
  body.append(heading, status, list, actions);

  function changed(operation, data = {}) {
    return operation({ id: oath.id, ...data });
  }

  function showTasks(current, tasks) {
    list.replaceChildren();
    for (const task of tasks) {
      const row = el('label');
      const check = el('input');
      check.type = 'checkbox';
      check.checked = !!task?.done;
      check.disabled = !task || current.status === 'scheduled';
      check.onchange = async () => {
        check.disabled = true;
        try {
          await ctx.tasks.setCompleted({ id: task.id, done: check.checked });
          render();
        } catch (error) {
          check.checked = task.done;
          check.disabled = false;
          report(error);
        }
      };
      row.append(check, task?.title || 'Task unavailable');
      list.append(row);
    }
  }

  function showActions(current) {
    actions.replaceChildren();
    const candidates = taskCandidates(ctx, current.owner).filter(task => !current.taskIds.includes(task.id));
    if (candidates.length) {
      const select = el('select', 'text-input');
      select.setAttribute('aria-label', 'Additional task');
      for (const task of candidates) select.add(new Option(task.title, task.id));
      const add = el('div', 'actions oath-action-row');
      add.append(select, button('Add task to Oath', async () => {
        await changed(ctx.oaths.addTask, { taskId: select.value });
        render();
      }));
      actions.append(add);
    }
    if (current.status === 'active' && current.condition === 'manual') {
      actions.append(button('End Oath', async () => {
        const answer = await showDialog({
          title: 'Did you complete the work you swore to do?',
          actions: [
            { label: 'Keep working', value: null },
            { label: 'No', value: false },
            { label: 'Yes', value: true, primary: true }
          ]
        });
        if (answer === true) await changed(ctx.oaths.end, { fulfilled: true });
        if (answer === false) await confirmBreak(ctx);
        render();
      }));
    }
    if (current.status === 'active' && current.condition !== 'duration') {
      const rest = el('div', 'actions oath-action-row');
      const minutes = field(rest, 'Rest minutes', 'number', 5);
      minutes.min = 1;
      minutes.max = 60;
      rest.append(button('Start rest', async () => {
        await changed(ctx.oaths.rest, { minutes: minutes.valueAsNumber });
        render();
      }));
      actions.append(rest);
    }
    if (current.status === 'rest') {
      actions.append(button('Resume now', async () => {
        await changed(ctx.oaths.resume);
        render();
      }));
    }
    const day = new Intl.DateTimeFormat('sv-SE', {
      timeZone: current.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    if (current.status === 'scheduled' && day < current.day) {
      actions.append(button('Cancel scheduled Oath', async () => {
        await changed(ctx.oaths.cancelScheduled);
        render();
      }));
    } else {
      actions.append(button('Break Oath', async () => {
        await confirmBreak(ctx);
        render();
      }));
    }
  }

  let rendered = '';
  function render() {
    const current = ctx.oaths.current();
    if (current?.id !== oath.id) {
      const finished = ctx.oaths.history().find(record => record.id === oath.id);
      heading.textContent = finished ? 'Oath ' + finished.status : 'This Oath has ended';
      status.replaceChildren(el('span', 'oath-workspace', oath.owner));
      list.replaceChildren();
      actions.replaceChildren();
      return;
    }
    const deadline = current.restUntil || (current.status === 'scheduled' ? current.startsAt : current.endsAt);
    status.replaceChildren(el('span', 'oath-workspace', current.owner), ' · ', el('span', 'oath-state', current.status));
    if (deadline) {
      const time = el('time', 'oath-deadline', new Date(deadline).toLocaleString());
      time.dateTime = deadline;
      status.append(' · ', time);
    }

    // Keep controls mounted on timer ticks so keyboard focus and pending inputs survive.
    const tasks = current.taskIds.map(id => ctx.tasks.find(id));
    const key = JSON.stringify([current.status, tasks.map(task => [task?.title, task?.done]), ctx.tasks.list().map(task => task.id)]);
    if (key === rendered) return;
    rendered = key;
    showTasks(current, tasks);
    showActions(current);
  }
  render();
  const interval = setInterval(render, 1000);
  try {
    return await showDialog({ title: 'The Oath', content: body, actions: [{ label: 'Done', value: true }] });
  } finally {
    clearInterval(interval);
  }
}

export function oathControl(ctx) {
  const root = button('The Oath', async () => {
    await ctx.reloadWork();
    const current = ctx.oaths.current();
    if (current) await activeDialog(ctx, current);
    else await setup(ctx);
  });
  root.classList.add('oath-control');
  function refresh() {
    root.hidden = !ctx.library;
    const oath = ctx.oaths.current();
    root.textContent = oath ? 'The Oath · ' + oath.status : 'The Oath';
    root.classList.toggle('active', !!oath && oath.status !== 'scheduled');
  }
  return { root, refresh };
}
