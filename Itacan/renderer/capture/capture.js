import { el, button } from '../ui/elements.js';
import { field, pickPath, confirmAction } from '../ui/forms.js';
import { askName, showDialog } from '../ui/dialog.js';
import { taskEditor } from '../tasks/tasks.js';

function destinations(ctx, textValue, id, resolved) {
  const row = el('div', 'actions capture-destinations');
  async function process(kind) {
    const text = textValue();
    if (!text.trim()) throw Error('Enter some text first.');
    if (kind === 'task') {
      if (await taskEditor(ctx, { title: text.split('\n')[0], description: text.includes('\n') ? text : '' }, id)) resolved();
      return;
    }
    const append = kind === 'append';
    const path = await pickPath(ctx, append ? 'Choose a note' : 'Choose a folder', append ? 'note' : 'folder');
    if (!path) return;
    if (append) {
      const buffer = ctx.documents.open.get(path);
      await buffer?.pending;
      const source = buffer || await window.itacan.readNote(ctx.library.session, path);
      const draft = source.text;
      const { state, saved } = await window.itacan.fileText(ctx.library.session, {
        id, text, path, draft, revision: source.revision
      });
      buffer?.acceptAppend(saved, draft);
      ctx.install(state);
    } else {
      const name = await askName('New note');
      if (!name) return;
      const { state } = await window.itacan.fileText(ctx.library.session, { id, text, folder: path, name });
      ctx.install(state);
    }
    resolved();
  }
  for (const [kind, label] of [['task', 'Create task'], ['note', 'Create note'], ['append', 'Add to note']]) row.append(button(label, () => process(kind)));
  return row;
}
export function quickAdd(ctx) {
  const body = el('div', 'capture-form');
  const input = field(body, 'Capture text', 'textarea');
  const done = () => body.closest('dialog')?.close();
  body.append(destinations(ctx, () => input.value, null, done), button('Capture files…', async () => {
    const next = await window.itacan.captureFiles(ctx.library.session, input.value);
    if (next) { ctx.install(next); done(); }
  }));
  return showDialog({
    title: 'Quick Add', content: body, wide: true, actions: [
      { label: 'Cancel', value: null }, { label: 'Send to Inbox', value: true, primary: true, run: () => ctx.update('inbox', 'add', { text: input.value }) }
    ]
  });
}

export function inbox(ctx) {
  const body = el('div', 'inbox');
  const search = field(body, 'Filter captures', 'search');
  const sort = field(body, 'Order', 'select', 'Newest first', ['Newest first', 'Oldest first']);
  const list = el('div', 'inbox-list'); body.append(list);
  function render() {
    list.replaceChildren();
    const items = ctx.state.inbox.filter(i => (i.name || i.text).toLowerCase().includes(search.value.toLowerCase()));
    if (sort.value === 'Oldest first') items.reverse();
    if (!items.length) list.append(el('p', 'empty', 'No captures to show.'));
    for (const item of items) {
      const card = el('section', 'capture-card');
      card.append(el('p', 'multiline', item.name || item.text));
      if (!item.name) card.append(destinations(ctx, () => item.text, item.id, render));
      else card.append(button('File attachment', async () => {
        const path = await pickPath(ctx, 'File attachment in folder', 'folder');
        if (path) { ctx.install(await window.itacan.resolveAttachment(ctx.library.session, item.id, path)); render(); }
      }));
      card.append(button('Remove', async () => {
        if (!await confirmAction('Remove capture?', item.name || item.text, 'Remove')) return;
        if (item.name) ctx.install(await window.itacan.resolveAttachment(ctx.library.session, item.id, null));
        else await ctx.update('inbox', 'remove', { id: item.id });
        render();
      }));
      list.append(card);
    }
  }
  search.oninput = render; sort.onchange = render; render();
  return showDialog({ title: 'Inbox', wide: true, content: body, actions: [{ label: 'Done', value: true }] });
}
