import { el, button, report } from '../ui/elements.js';
import { askName } from '../ui/dialog.js';
import { renderPreview, scrollToHeading } from './preview.js';
import { makeEditor } from './editor.js';

export function documentView(buffer, pane, { openNote, anchor, position, changedMode }) {
  const root = el('section', 'document-pane panel');
  const heading = el('h1', 'note-name', buffer.path.split('/').at(-1).replace(/\.md$/i, ''));
  const name = heading.textContent;
  heading.setAttribute('aria-label',name);
  heading.textContent = buffer.path.replace(/\.md$/i,'').split('/').join(' / ');
  heading.title = heading.textContent;
  const inlineTitle = el('div','reading-title',name);
  inlineTitle.setAttribute('aria-hidden','true');
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
  toolbar.append(heading, modes, actions);
  root.append(toolbar, preview, source);
  let displayed;
  function update(origin) {
    if (disposed) return;
    if (editor && origin !== editor && editor.state.doc.toString() !== buffer.text) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: buffer.text } });
    }
    if (!pane.edit && displayed !== buffer.text) {
      renderPreview(preview, buffer.text, buffer.path, buffer.session, openNote, report);
      preview.prepend(inlineTitle);
      displayed = buffer.text;
    }
    save.disabled = !buffer.dirty;
    status.textContent = buffer.dirty ? 'Unsaved changes' : 'Saved';
    copy.hidden = !buffer.failed;
  }
  function rememberPosition() {
    if (!root.isConnected) return;
    if (!preview.hidden) position.read = preview.scrollTop;
    else if (editor) {
      position.edit = editor.scrollSnapshot();
      position.editTop = editor.scrollDOM.scrollTop;
      const {anchor,head} = editor.state.selection.main;
      position.selection = {anchor,head};
    }
  }
  function restorePosition() {
    if (!pane.edit) preview.scrollTop = position.read;
    else if (position.edit) editor.dispatch({effects:position.edit});
    else if (position.editTop) editor.requestMeasure({read:()=>position.editTop,write:top=>{editor.scrollDOM.scrollTop=top;}});
  }
  function mode(editing, persist = true) {
    const switching = editing !== preview.hidden;
    if (switching) rememberPosition();
    const changed = pane.edit !== editing;
    pane.edit = editing;
    read.setAttribute('aria-pressed', String(!editing));
    edit.setAttribute('aria-pressed', String(editing));
    source.hidden = !editing;
    preview.hidden = editing;
    if (editing && !editor) editor = makeEditor(source, buffer.text, doc => buffer.edit(doc.toString(), editor),position.selection);
    update();
    if (editing && persist) editor.focus();
    if (switching && root.isConnected) restorePosition();
    if (persist && changed) changedMode();
  }
  buffer.listeners.add(update);
  mode(pane.edit, false);
  return {
    root, snapshot() {
      rememberPosition();
      return {editing:preview.hidden,read:position.read,editTop:position.editTop,selection:position.selection};
    }, display(editing, fragment) {
      mode(editing, false);
      if (fragment) scrollToHeading(preview, fragment);
    }, mounted(focus) {
      if (focus && pane.edit) editor?.focus();
      restorePosition();
      if (anchor) scrollToHeading(preview, anchor);
    },
    dispose() { rememberPosition(); disposed = true; buffer.listeners.delete(update); editor?.destroy(); }
  };
}
