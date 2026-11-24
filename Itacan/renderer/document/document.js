import { el, button, report } from '../ui/elements.js';
import { askName } from '../ui/dialog.js';
import { renderPreview, scrollToHeading } from './preview.js';
import { makeEditor } from './editor.js';

export function documentView(buffer, pane, { openNote, anchor, changedMode }) {
  const root = el('section', 'document-pane panel');
  const heading = el('h1', 'note-name', buffer.path.split('/').at(-1).replace(/\.md$/i, ''));
  const toolbar = el('div', 'document-tools');
  const modes = el('div', 'switcher');
  const actions = el('div', 'actions');
  const preview = el('article', 'prose');
  const source = el('div', 'source');
  let editor;
  let disposed = false;
  const read = button('Read', () => mode(false));
  const edit = button('Edit', () => mode(true));
  modes.append(read, edit);
  const save = button('Save', () => buffer.save(), { variant: 'primary' });
  const status = el('span', 'save-status');
  const copy = button('Save a copy', async () => {
    const parts = buffer.path.split('/');
    const name = await askName('Save a copy', parts.pop().replace(/\.md$/i, '') + ' copy');
    if (!name) return;
    const draft = buffer.text;
    const path = await window.itacan.create(buffer.session, parts.join('/'), name, 'note', draft);
    if (buffer.text === draft) {
      const disk = await window.itacan.readNote(buffer.session, buffer.path).catch(() => null);
      if (disk) {
        buffer.revision = disk.revision;
        buffer.saved = disk.text.replace(/\r\n?/g, '\n');
        buffer.failed = false;
        buffer.edit(buffer.saved);
      }
    }
    await openNote(path, true);
  });
  actions.append(status, copy, save);
  toolbar.append(modes, actions);
  root.append(heading, toolbar, preview, source);
  let displayed;
  function update(origin) {
    if (disposed) return;
    if (editor && origin !== editor && editor.state.doc.toString() !== buffer.text) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: buffer.text } });
    }
    if (!pane.edit && displayed !== buffer.text) {
      renderPreview(preview, buffer.text, buffer.path, buffer.session, openNote, report);
      displayed = buffer.text;
    }
    save.disabled = !buffer.dirty;
    status.textContent = buffer.dirty ? 'Unsaved changes' : 'Saved';
    copy.hidden = !buffer.failed;
  }
  function mode(editing, persist = true) {
    pane.edit = editing;
    read.setAttribute('aria-pressed', String(!editing));
    edit.setAttribute('aria-pressed', String(editing));
    source.hidden = !editing;
    preview.hidden = editing;
    if (editing && !editor) editor = makeEditor(source, buffer.text, doc => buffer.edit(doc.toString(), editor));
    update();
    if (editing && persist) editor.focus();
    if (persist) changedMode();
  }
  buffer.listeners.add(update);
  mode(pane.edit, false);
  return {
    root, display(editing, fragment) {
      mode(editing, false);
      if (fragment) scrollToHeading(preview, fragment);
    }, mounted() { if (pane.edit) editor?.focus(); if (anchor) scrollToHeading(preview, anchor); },
    dispose() { disposed = true; buffer.listeners.delete(update); editor?.destroy(); }
  };
}
